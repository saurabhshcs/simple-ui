import Knex from 'knex';
import knexConfig from './knexfile';
import { config } from './index';

const env = config.nodeEnv === 'production' ? 'production' : 'development';
export const db = Knex(knexConfig[env]!);
