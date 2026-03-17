import type { Knex } from 'knex';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const dbPath = process.env['DB_PATH'] ?? path.resolve(__dirname, '../../data/simple-ui.sqlite');

const config: Record<string, Knex.Config> = {
  development: {
    client: 'better-sqlite3',
    connection: { filename: dbPath },
    useNullAsDefault: true,
    migrations: {
      directory: path.resolve(__dirname, '../db/migrations'),
      extension: 'ts',
    },
  },
  production: {
    client: 'pg',
    connection: process.env['DATABASE_URL'],
    migrations: {
      directory: path.resolve(__dirname, '../db/migrations'),
    },
    pool: { min: 2, max: 10 },
  },
};

export default config;
module.exports = config; // Knex CLI requires CommonJS export
