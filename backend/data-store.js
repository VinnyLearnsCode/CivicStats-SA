import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";

const migrationId = "001_data_platform";
const migrationUrl = new URL("./migrations/001_data_platform.sql", import.meta.url);

export class DataStoreError extends Error {
  constructor(message, { status = 500, code = "DATA_STORE_ERROR" } = {}) {
    super(message);
    this.name = "DataStoreError";
    this.status = status;
    this.code = code;
  }
}

function stableJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
    .join(",")}}`;
}

function hashValue(value) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function assertImportInput(input) {
  const requiredStrings = [
    "sourceId",
    "sourceName",
    "sourceUrl",
    "datasetId",
    "datasetTitle",
    "datasetUrl",
    "municipalityCode",
    "municipalityName",
    "provinceName",
    "sourceCode",
    "reportingPeriod",
    "unit",
    "updateFrequency"
  ];
  if (!input || requiredStrings.some((key) => typeof input[key] !== "string" || !input[key].trim())) {
    throw new TypeError("Import metadata is incomplete.");
  }
  if (!Array.isArray(input.records) || !Array.isArray(input.issues)) {
    throw new TypeError("Import records and quality issues must be arrays.");
  }
  if (input.records.some((record) =>
    !record ||
    typeof record.recordKey !== "string" ||
    !record.recordKey ||
    typeof record.sourceUrl !== "string" ||
    !record.sourceUrl ||
    record.sourceRecord === null ||
    typeof record.sourceRecord !== "object" ||
    Array.isArray(record.sourceRecord)
  )) {
    throw new TypeError("An imported source record is invalid.");
  }
  if (input.issues.some((issue) =>
    !issue ||
    !["warning", "error"].includes(issue.severity) ||
    typeof issue.code !== "string" ||
    typeof issue.message !== "string"
  )) {
    throw new TypeError("An import quality issue is invalid.");
  }
}

export function createDataStore({
  databaseUrl = process.env.DATABASE_URL,
  PoolClass = pg.Pool
} = {}) {
  if (!databaseUrl) return null;

  const pool = new PoolClass({
    connectionString: databaseUrl,
    max: 5,
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 30000
  });

  async function withTransaction(operation) {
    const client = await pool.connect();
    let started = false;
    try {
      await client.query("BEGIN");
      started = true;
      const result = await operation(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      if (started) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          throw new AggregateError([error, rollbackError], "Database operation and rollback both failed.");
        }
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async function upsertSourceAndDataset(client, input) {
    await client.query(
      `INSERT INTO data_sources (source_id, name, source_url)
       VALUES ($1, $2, $3)
       ON CONFLICT (source_id) DO UPDATE
       SET name = EXCLUDED.name, source_url = EXCLUDED.source_url`,
      [input.sourceId, input.sourceName, input.sourceUrl]
    );
    await client.query(
      `INSERT INTO source_datasets
         (dataset_id, source_id, title, source_url, api_url, geographic_level, unit, update_frequency)
       VALUES ($1, $2, $3, $4, $5, 'municipality', $6, $7)
       ON CONFLICT (dataset_id) DO UPDATE
       SET source_id = EXCLUDED.source_id,
           title = EXCLUDED.title,
           source_url = EXCLUDED.source_url,
           api_url = EXCLUDED.api_url,
           unit = EXCLUDED.unit,
           update_frequency = EXCLUDED.update_frequency`,
      [
        input.datasetId,
        input.sourceId,
        input.datasetTitle,
        input.datasetUrl,
        input.apiUrl ?? null,
        input.unit,
        input.updateFrequency
      ]
    );
  }

  async function logFailedImport(input, message) {
    const failureKey = randomUUID();
    await withTransaction(async (client) => {
      await upsertSourceAndDataset(client, input);
      await client.query(
        `INSERT INTO import_jobs
           (dataset_id, municipality_code, reporting_period, idempotency_key, status,
            completed_at, error_message)
         VALUES ($1, $2, $3, $4, 'failed', now(), $5)`,
        [input.datasetId, input.municipalityCode, input.reportingPeriod, failureKey, message]
      );
      await client.query(
        `UPDATE source_datasets
         SET validation_status = CASE
               WHEN publication_status = 'published' THEN validation_status
               ELSE 'failed_import'
             END
         WHERE dataset_id = $1`,
        [input.datasetId]
      );
    });
  }

  return {
    async migrate() {
      const sql = await readFile(migrationUrl, "utf8");
      await withTransaction(async (client) => {
        await client.query(
          "SELECT pg_advisory_xact_lock(hashtext('civicstats-sa-schema-migrations'))"
        );
        await client.query(
          `CREATE TABLE IF NOT EXISTS schema_migrations (
             migration_id TEXT PRIMARY KEY,
             applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
           )`
        );
        const existing = await client.query(
          "SELECT migration_id FROM schema_migrations WHERE migration_id = $1",
          [migrationId]
        );
        if (existing.rowCount > 0) return;
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (migration_id) VALUES ($1)",
          [migrationId]
        );
      });
    },

    async persistImport(input) {
      assertImportInput(input);
      const crosswalkVerified = input.sourceCode === input.municipalityCode;
      const issues = [...input.issues];
      if (!crosswalkVerified) {
        issues.push({
          severity: "error",
          code: "GEOGRAPHY_CODE_MISMATCH",
          message: `Treasury code ${input.sourceCode} does not match municipality code ${input.municipalityCode}; a verified crosswalk is required.`
        });
      }
      const records = crosswalkVerified ? input.records : [];
      const stableRecords = records
        .map((record) => ({
          recordKey: record.recordKey,
          sourceUrl: record.sourceUrl,
          contentHash: hashValue(record.sourceRecord)
        }))
        .sort((left, right) =>
          left.recordKey.localeCompare(right.recordKey) ||
          left.contentHash.localeCompare(right.contentHash)
        );
      const payloadHash = hashValue({
        datasetId: input.datasetId,
        municipalityCode: input.municipalityCode,
        reportingPeriod: input.reportingPeriod,
        sourceCode: input.sourceCode,
        records: stableRecords,
        issues
      });
      const idempotencyKey = hashValue({
        datasetId: input.datasetId,
        municipalityCode: input.municipalityCode,
        reportingPeriod: input.reportingPeriod,
        payloadHash
      });
      const errors = issues.filter((issue) => issue.severity === "error").length;
      const jobStatus = issues.length > 0
        ? records.length > 0 ? "partial" : "failed"
        : records.length > 0 ? "awaiting_review" : "failed";

      try {
        return await withTransaction(async (client) => {
          await upsertSourceAndDataset(client, input);
          if (input.sourceCode !== "unmatched") {
            await client.query(
              `INSERT INTO municipality_crosswalks
                 (source_id, source_code, municipality_code, source_name, province_name,
                  validation_status, validated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               ON CONFLICT (source_id, source_code) DO UPDATE
               SET municipality_code = EXCLUDED.municipality_code,
                   source_name = EXCLUDED.source_name,
                   province_name = EXCLUDED.province_name,
                   validation_status = EXCLUDED.validation_status,
                   validated_at = EXCLUDED.validated_at`,
              [
                input.sourceId,
                input.sourceCode,
                input.municipalityCode,
                input.municipalityName,
                input.provinceName,
                crosswalkVerified ? "verified" : "pending_validation",
                crosswalkVerified ? new Date().toISOString() : null
              ]
            );
          }
          const insertedJob = await client.query(
            `INSERT INTO import_jobs
               (dataset_id, municipality_code, reporting_period, idempotency_key, status)
             VALUES ($1, $2, $3, $4, 'running')
             ON CONFLICT (idempotency_key) DO NOTHING
             RETURNING import_id`,
            [input.datasetId, input.municipalityCode, input.reportingPeriod, idempotencyKey]
          );
          if (insertedJob.rowCount === 0) {
            const existing = await client.query(
              `SELECT import_id, status, records_retrieved, records_accepted, records_rejected
               FROM import_jobs WHERE idempotency_key = $1`,
              [idempotencyKey]
            );
            return { ...existing.rows[0], duplicate: true };
          }
          const importId = insertedJob.rows[0].import_id;
          for (let offset = 0; offset < records.length; offset += 250) {
            const batch = records.slice(offset, offset + 250).map((record) => ({
              import_id: importId,
              dataset_id: input.datasetId,
              municipality_code: input.municipalityCode,
              source_code: input.sourceCode,
              reporting_period: input.reportingPeriod,
              record_key: record.recordKey,
              content_hash: hashValue(record.sourceRecord),
              source_record: record.sourceRecord,
              source_url: record.sourceUrl
            }));
            await client.query(
              `INSERT INTO raw_data_records
                 (import_id, dataset_id, municipality_code, source_code, reporting_period,
                  record_key, content_hash, source_record, source_url)
               SELECT import_id, dataset_id, municipality_code, source_code, reporting_period,
                      record_key, content_hash, source_record, source_url
               FROM jsonb_to_recordset($1::jsonb) AS batch(
                 import_id BIGINT,
                 dataset_id TEXT,
                 municipality_code TEXT,
                 source_code TEXT,
                 reporting_period TEXT,
                 record_key TEXT,
                 content_hash TEXT,
                 source_record JSONB,
                 source_url TEXT
               )
               ON CONFLICT (import_id, record_key, content_hash)
               DO NOTHING`,
              [JSON.stringify(batch)]
            );
          }
          for (const issue of issues) {
            await client.query(
              `INSERT INTO data_quality_issues (import_id, severity, issue_code, message)
               VALUES ($1, $2, $3, $4)`,
              [importId, issue.severity, issue.code, issue.message]
            );
          }
          const rejected = errors;
          const retrieved = records.length + rejected;
          await client.query(
            `UPDATE import_jobs
             SET status = $2, completed_at = now(), records_retrieved = $3,
                 records_accepted = $4, records_rejected = $5
             WHERE import_id = $1`,
            [importId, jobStatus, retrieved, records.length, rejected]
          );
          await client.query(
            `UPDATE source_datasets
             SET validation_status = CASE
                   WHEN publication_status = 'published' THEN validation_status
                   ELSE $2
                 END,
                 last_imported_at = now()
             WHERE dataset_id = $1`,
            [
              input.datasetId,
              jobStatus === "awaiting_review" ? "awaiting_validation" :
                jobStatus === "partial" ? "partially_verified" : "failed_import"
            ]
          );
          return {
            import_id: importId,
            status: jobStatus,
            records_retrieved: retrieved,
            records_accepted: records.length,
            records_rejected: rejected,
            duplicate: false
          };
        });
      } catch (error) {
        try {
          await logFailedImport(input, error instanceof Error ? error.message : "Database import failed.");
        } catch (loggingError) {
          throw new AggregateError([error, loggingError], "Import failed and its failure could not be logged.");
        }
        throw error;
      }
    },

    async logFailedImport(input, message) {
      await logFailedImport(input, message);
    },

    async listImports(limit = 20) {
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        throw new TypeError("Import history limit must be from 1 through 100.");
      }
      const result = await pool.query(
        `SELECT j.import_id, j.dataset_id, d.title AS dataset_title, s.name AS source_name,
                j.municipality_code, j.reporting_period, j.status, j.started_at,
                j.completed_at, j.records_retrieved, j.records_accepted,
                j.records_rejected, j.error_message
         FROM import_jobs j
         JOIN source_datasets d ON d.dataset_id = j.dataset_id
         JOIN data_sources s ON s.source_id = d.source_id
         ORDER BY j.started_at DESC
         LIMIT $1`,
        [limit]
      );
      return result.rows;
    },

    async approveImport(importId) {
      if (!Number.isSafeInteger(importId) || importId < 1) {
        throw new DataStoreError("Import was not found.", { status: 404, code: "IMPORT_NOT_FOUND" });
      }
      return withTransaction(async (client) => {
        const jobResult = await client.query(
          `SELECT import_id, dataset_id, status
           FROM import_jobs WHERE import_id = $1 FOR UPDATE`,
          [importId]
        );
        const job = jobResult.rows[0];
        if (!job) throw new DataStoreError("Import was not found.", { status: 404, code: "IMPORT_NOT_FOUND" });
        if (job.status !== "awaiting_review") {
          throw new DataStoreError("Only complete imports with no quality issues can be approved.", {
            status: 409,
            code: "IMPORT_NOT_APPROVABLE"
          });
        }
        const issues = await client.query(
          "SELECT 1 FROM data_quality_issues WHERE import_id = $1 LIMIT 1",
          [importId]
        );
        if (issues.rowCount > 0) {
          throw new DataStoreError("Resolve data-quality issues before approving this import.", {
            status: 409,
            code: "IMPORT_HAS_QUALITY_ISSUES"
          });
        }
        await client.query(
          `INSERT INTO data_records
             (raw_record_id, dataset_id, municipality_code, reporting_period, record_key,
              source_record, source_url)
           SELECT raw_record_id, dataset_id, municipality_code, reporting_period, record_key,
                  source_record, source_url
           FROM raw_data_records
           WHERE import_id = $1 AND validation_status = 'awaiting_validation'
           ON CONFLICT (dataset_id, municipality_code, reporting_period, record_key)
           DO UPDATE SET raw_record_id = EXCLUDED.raw_record_id,
                         source_record = EXCLUDED.source_record,
                         source_url = EXCLUDED.source_url,
                         source_publication_date = EXCLUDED.source_publication_date,
                         approved_at = now()`,
          [importId]
        );
        await client.query(
          `UPDATE raw_data_records
           SET validation_status = 'verified', publication_status = 'published'
           WHERE import_id = $1 AND validation_status = 'awaiting_validation'`,
          [importId]
        );
        await client.query(
          `UPDATE import_jobs
           SET status = 'approved', completed_at = COALESCE(completed_at, now())
           WHERE import_id = $1`,
          [importId]
        );
        await client.query(
          `UPDATE source_datasets
           SET validation_status = 'partially_verified', publication_status = 'published',
               last_verified_at = now()
           WHERE dataset_id = $1`,
          [job.dataset_id]
        );
        return { import_id: importId, status: "approved" };
      });
    },

    async rejectImport(importId, reason) {
      if (!Number.isSafeInteger(importId) || importId < 1) {
        throw new DataStoreError("Import was not found.", { status: 404, code: "IMPORT_NOT_FOUND" });
      }
      if (typeof reason !== "string" || reason.trim().length < 5 || reason.length > 500) {
        throw new DataStoreError("A rejection reason between 5 and 500 characters is required.", {
          status: 400,
          code: "INVALID_REJECTION_REASON"
        });
      }
      return withTransaction(async (client) => {
        const jobResult = await client.query(
          `SELECT import_id, status FROM import_jobs WHERE import_id = $1 FOR UPDATE`,
          [importId]
        );
        const job = jobResult.rows[0];
        if (!job) throw new DataStoreError("Import was not found.", { status: 404, code: "IMPORT_NOT_FOUND" });
        if (job.status === "approved") {
          throw new DataStoreError("Published imports cannot be rejected; use a separate retraction process.", {
            status: 409,
            code: "IMPORT_ALREADY_PUBLISHED"
          });
        }
        if (job.status === "rejected") {
          return { import_id: importId, status: "rejected", duplicate: true };
        }
        if (job.status === "running") {
          throw new DataStoreError("A running import cannot be rejected.", {
            status: 409,
            code: "IMPORT_STILL_RUNNING"
          });
        }
        await client.query(
          `UPDATE raw_data_records
           SET validation_status = 'rejected', publication_status = 'unpublished'
           WHERE import_id = $1`,
          [importId]
        );
        await client.query(
          `INSERT INTO data_quality_issues (import_id, severity, issue_code, message)
           VALUES ($1, 'error', 'ADMIN_REJECTED', $2)`,
          [importId, reason.trim()]
        );
        await client.query(
          `UPDATE import_jobs
           SET status = 'rejected', completed_at = COALESCE(completed_at, now()),
               error_message = $2
           WHERE import_id = $1`,
          [importId, reason.trim()]
        );
        return { import_id: importId, status: "rejected", duplicate: false };
      });
    },

    async getImport(importId, { limit = 50, offset = 0 } = {}) {
      if (!Number.isSafeInteger(importId) || importId < 1) {
        throw new DataStoreError("Import was not found.", { status: 404, code: "IMPORT_NOT_FOUND" });
      }
      if (!Number.isInteger(limit) || limit < 1 || limit > 100 ||
        !Number.isSafeInteger(offset) || offset < 0) {
        throw new DataStoreError("Invalid import pagination.", { status: 400, code: "INVALID_PAGINATION" });
      }
      const jobResult = await pool.query(
        `SELECT j.import_id, j.dataset_id, d.title AS dataset_title, s.name AS source_name,
                j.municipality_code, j.reporting_period, j.status, j.started_at,
                j.completed_at, j.records_retrieved, j.records_accepted,
                j.records_rejected, j.error_message
         FROM import_jobs j
         JOIN source_datasets d ON d.dataset_id = j.dataset_id
         JOIN data_sources s ON s.source_id = d.source_id
         WHERE j.import_id = $1`,
        [importId]
      );
      if (!jobResult.rows[0]) {
        throw new DataStoreError("Import was not found.", { status: 404, code: "IMPORT_NOT_FOUND" });
      }
      const [recordsResult, recordCountResult, issuesResult, issueCountResult] = await Promise.all([
        pool.query(
          `SELECT raw_record_id, municipality_code, source_code, reporting_period, record_key,
                  source_record, source_url, validation_status, publication_status, imported_at
           FROM raw_data_records
           WHERE import_id = $1
           ORDER BY raw_record_id
           LIMIT $2 OFFSET $3`,
          [importId, limit, offset]
        ),
        pool.query(
          "SELECT count(*)::int AS total FROM raw_data_records WHERE import_id = $1",
          [importId]
        ),
        pool.query(
          `SELECT issue_id, severity, issue_code, message, created_at
           FROM data_quality_issues
           WHERE import_id = $1
           ORDER BY issue_id
           LIMIT 100`,
          [importId]
        ),
        pool.query(
          "SELECT count(*)::int AS total FROM data_quality_issues WHERE import_id = $1",
          [importId]
        )
      ]);
      return {
        import: jobResult.rows[0],
        records: recordsResult.rows,
        recordCount: recordCountResult.rows[0].total,
        recordLimit: limit,
        recordOffset: offset,
        qualityIssues: issuesResult.rows,
        qualityIssueCount: issueCountResult.rows[0].total,
        qualityIssueLimit: 100
      };
    },

    async getAvailability() {
      const result = await pool.query(
        `SELECT dataset_id, title, geographic_level, unit, validation_status,
                publication_status, last_imported_at, last_verified_at
         FROM source_datasets
         ORDER BY dataset_id`
      );
      return { storage: "connected", datasets: result.rows };
    },

    async getTreasuryRecords(municipalityCode, reportingPeriod) {
      const [datasetResult, jobsResult, recordsResult] = await Promise.all([
        pool.query(
          `SELECT dataset_id, title, source_url, api_url, unit, validation_status,
                  publication_status, last_imported_at, last_verified_at
           FROM source_datasets
           WHERE dataset_id = 'national-treasury-municipal-finance'`
        ),
        pool.query(
          `SELECT import_id, status, records_retrieved, records_accepted, records_rejected,
                  started_at, completed_at
           FROM import_jobs
           WHERE dataset_id = 'national-treasury-municipal-finance'
             AND municipality_code = $1 AND reporting_period = $2
           ORDER BY started_at DESC LIMIT 1`,
          [municipalityCode, reportingPeriod]
        ),
        pool.query(
          `SELECT record_id, record_key, source_record, source_url, source_publication_date,
                  approved_at
           FROM data_records
           WHERE dataset_id = 'national-treasury-municipal-finance'
             AND municipality_code = $1 AND reporting_period = $2
           ORDER BY approved_at DESC, record_id`,
          [municipalityCode, reportingPeriod]
        )
      ]);
      return {
        dataset: datasetResult.rows[0] ?? null,
        latestImport: jobsResult.rows[0] ?? null,
        records: recordsResult.rows
      };
    },

    async close() {
      await pool.end();
    }
  };
}
