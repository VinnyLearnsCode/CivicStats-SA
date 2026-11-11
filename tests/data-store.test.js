import assert from "node:assert/strict";
import { test } from "node:test";
import { createDataStore } from "../backend/data-store.js";

test("database store uses a bounded pool and strict TLS for legacy Neon URLs", async () => {
  let configuration;
  const queries = [];
  class MockPool {
    constructor(options) { configuration = options; }
    async query(sql) { queries.push(sql); return { rows: [{ connected: 1 }] }; }
    async end() {}
  }

  const store = createDataStore({
    databaseUrl: "postgresql://user:secret@ep-example.neon.tech/civicstats?sslmode=require",
    PoolClass: MockPool
  });
  assert.equal(new URL(configuration.connectionString).searchParams.get("sslmode"), "verify-full");
  assert.equal(configuration.max, 5);
  assert.equal(configuration.connectionTimeoutMillis, 5000);
  assert.equal(configuration.query_timeout, 5000);
  assert.equal(await store.checkHealth(), true);
  assert.deepEqual(queries, ["SELECT 1 AS connected"]);
  await store.close();
});

test("database store is absent when DATABASE_URL is missing", () => {
  assert.equal(createDataStore({ databaseUrl: "" }), null);
});

test("database health query failures remain failures", async () => {
  class FailingPool {
    constructor() {}
    async query() { throw new Error("connection refused"); }
    async end() {}
  }
  const store = createDataStore({ databaseUrl: "postgresql://user:secret@localhost/db", PoolClass: FailingPool });
  await assert.rejects(store.checkHealth(), /connection refused/);
  await store.close();
});

test("database health rejects an unexpected SELECT result", async () => {
  class InvalidPool {
    constructor() {}
    async query() { return { rows: [{ connected: 0 }] }; }
    async end() {}
  }
  const store = createDataStore({ databaseUrl: "postgresql://user:secret@localhost/db", PoolClass: InvalidPool });
  await assert.rejects(store.checkHealth(), /expected result/);
  await store.close();
});

test("safe database write probe rolls back and releases its pooled connection", async () => {
  const statements = [];
  let released = false;
  class TransactionPool {
    constructor() {}
    async connect() {
      return {
        async query(sql) {
          statements.push(sql);
          if (sql.startsWith("SELECT value")) return { rows: [{ value: "rollback-check" }] };
          return { rows: [] };
        },
        release() { released = true; }
      };
    }
    async end() {}
  }
  const store = createDataStore({ databaseUrl: "postgresql://user:secret@localhost/db", PoolClass: TransactionPool });
  await store.verifyTransaction();
  assert.equal(statements[0], "BEGIN");
  assert.ok(statements.some((sql) => sql.startsWith("INSERT INTO civicstats_connection_probe")));
  assert.equal(statements.at(-1), "ROLLBACK");
  assert.equal(released, true);
  await store.close();
});
