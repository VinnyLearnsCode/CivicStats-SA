import { createDataStore } from "./data-store.js";

const dataStore = createDataStore();
if (!dataStore) throw new Error("DATABASE_URL must be set before running database migrations.");

try {
  await dataStore.migrate();
  console.log("CivicStats SA database migrations applied.");
} finally {
  await dataStore.close();
}
