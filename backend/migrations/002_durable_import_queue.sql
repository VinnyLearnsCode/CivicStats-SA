CREATE TABLE import_queue (
  queue_id UUID PRIMARY KEY,
  job_type TEXT NOT NULL CHECK (job_type IN ('treasury')),
  idempotency_key TEXT NOT NULL,
  payload JSONB NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'retrying', 'succeeded', 'failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 10),
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at TIMESTAMPTZ,
  worker_id TEXT,
  result_import_id BIGINT REFERENCES import_jobs(import_id) ON DELETE SET NULL,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX import_queue_active_idempotency_idx
  ON import_queue (job_type, idempotency_key)
  WHERE status IN ('queued', 'processing', 'retrying');

CREATE INDEX import_queue_available_idx
  ON import_queue (available_at, created_at)
  WHERE status IN ('queued', 'retrying', 'processing');
