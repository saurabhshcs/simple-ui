import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('users', (t) => {
    t.text('id').primary();
    t.text('email').unique().notNullable();
    t.text('password').notNullable();
    t.integer('created_at').notNullable();
    t.integer('updated_at').notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('users');
}
