import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// For development with SQLite
const sqlite = new Database('test.db');
export const db = drizzle({ client: sqlite, schema });

console.log('🗄️ Database connected (SQLite)');