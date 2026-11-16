import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

type Database = ReturnType<typeof drizzle>;

let client: ReturnType<typeof postgres> | null = null;
let database: Database | null = null;

function getDatabase(): Database {
  if (database) return database;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  client = postgres(connectionString, {
    ssl: "require",
    connect_timeout: 10,
  });
  database = drizzle(client);
  return database;
}

// Route modules are imported during `next build`; defer opening the database
// until a handler actually uses it so configuration is only required at runtime.
export const db = new Proxy({} as Database, {
  get(_target, property) {
    const currentDatabase = getDatabase();
    const value = Reflect.get(currentDatabase, property, currentDatabase) as unknown;
    return typeof value === "function" ? value.bind(currentDatabase) : value;
  },
});

export async function closeDb() {
  if (!client) return;

  const currentClient = client;
  client = null;
  database = null;
  await currentClient.end();
}

