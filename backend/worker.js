import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { fileURLToPath } from "node:url";
import { createDataStore } from "./data-store.js";
import { createTreasuryImportProcessor } from "./server.js";

const pollIntervalMs = Number.parseInt(process.env.IMPORT_WORKER_POLL_INTERVAL_MS ?? "1000", 10);

function assertPollInterval(value) {
  if (!Number.isInteger(value) || value < 250 || value > 60000) {
    throw new Error("IMPORT_WORKER_POLL_INTERVAL_MS must be from 250 through 60000.");
  }
}

export async function processQueuedImportOnce({ dataStore, processImport, workerId }) {
  const job = await dataStore.claimQueuedImport(workerId);
  if (!job) return false;

  try {
    const result = await processImport(job.payload, job);
    await dataStore.completeQueuedImport(job.queue_id, workerId, result?.import_id);
    console.log(`Queued import ${job.queue_id} completed.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The queued import failed.";
    const outcome = await dataStore.failQueuedImport(job.queue_id, workerId, message);
    console.error(
      `Queued import ${job.queue_id} ${outcome.status} after attempt ${outcome.attempt_count}/${outcome.max_attempts}.`,
      message
    );
  }
  return true;
}

export async function runImportWorker({
  dataStore,
  processImport,
  workerId = `${hostname()}:${process.pid}:${randomUUID()}`,
  intervalMs = pollIntervalMs,
  signal
}) {
  assertPollInterval(intervalMs);
  while (!signal?.aborted) {
    let processed;
    try {
      processed = await processQueuedImportOnce({ dataStore, processImport, workerId });
    } catch (error) {
      console.error("Import worker queue poll failed.", error instanceof Error ? error.message : error);
      processed = false;
    }
    if (!processed && !signal?.aborted) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
}

async function main() {
  assertPollInterval(pollIntervalMs);
  const dataStore = createDataStore();
  if (!dataStore) throw new Error("DATABASE_URL must be set before starting the import worker.");

  const stop = new AbortController();
  const handleSignal = () => stop.abort();
  process.once("SIGINT", handleSignal);
  process.once("SIGTERM", handleSignal);

  try {
    await dataStore.migrate();
    const processImport = await createTreasuryImportProcessor({ dataStore });
    await runImportWorker({ dataStore, processImport, signal: stop.signal });
  } finally {
    process.removeListener("SIGINT", handleSignal);
    process.removeListener("SIGTERM", handleSignal);
    await dataStore.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error("Import worker stopped.", error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  });
}
