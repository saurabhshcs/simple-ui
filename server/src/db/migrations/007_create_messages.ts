import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('messages', (t) => {
    t.text('id').primary();
    t.text('conversation_id').notNullable().references('id').inTable('conversations').onDelete('CASCADE');
    t.text('role').notNullable();       // 'user' | 'assistant' | 'system'
    t.text('content').notNullable();
    t.text('file_ids').notNullable().defaultTo('[]');  // JSON array of file IDs
    t.integer('created_at').notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('messages');
}
