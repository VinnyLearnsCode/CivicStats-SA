import { fileURLToPath } from "node:url";
import { createDataStore } from "./data-store.js";

export async function verifyDatabase(dataStore) {
  if (!dataStore) throw new Error("DATABASE_URL is not configured.");
  await dataStore.checkHealth();
  await dataStore.verifyTransaction();
}

async function main() {
  const dataStore = createDataStore();
  if (!dataStore) {
    console.error("Database verification requires DATABASE_URL.");
    process.exitCode = 1;
    return;
  }
  try {
    await verifyDatabase(dataStore);
    console.log("PostgreSQL SELECT and rollback-only temporary-table checks passed.");
  } catch {
    console.error("PostgreSQL verification failed. Check the service connection and database logs without sharing DATABASE_URL.");
    process.exitCode = 1;
  } finally {
    await dataStore.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
