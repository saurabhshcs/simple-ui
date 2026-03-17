import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('conversations', (t) => {
    t.text('id').primary();
    t.text('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.text('title').notNullable().defaultTo('New conversation');
    t.text('model').notNullable();
    t.text('provider').notNullable();
    t.integer('created_at').notNullable();
    t.integer('updated_at').notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('conversations');
}
