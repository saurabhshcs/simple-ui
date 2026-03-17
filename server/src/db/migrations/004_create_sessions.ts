import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('sessions', (t) => {
    t.text('id').primary();   // JWT jti
    t.text('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.text('device_id').notNullable().references('id').inTable('devices').onDelete('CASCADE');
    t.integer('revoked').notNullable().defaultTo(0);
    t.integer('expires_at').notNullable();
    t.integer('created_at').notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('sessions');
}
