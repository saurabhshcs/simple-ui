import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('devices', (t) => {
    t.text('id').primary();
    t.text('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.text('fingerprint').notNullable();
    t.text('name');
    t.integer('confirmed').notNullable().defaultTo(0);
    t.text('confirm_token');
    t.integer('token_expires');
    t.integer('registered_at');
    t.integer('created_at').notNullable();
    t.unique(['user_id', 'fingerprint']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('devices');
}
