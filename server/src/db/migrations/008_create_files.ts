import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('files', (t) => {
    t.text('id').primary();
    t.text('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.text('filename').notNullable();
    t.text('path').notNullable();
    t.text('mime_type').notNullable();
    t.integer('size').notNullable();
    t.text('extracted_text');    // for PDF/DOCX/XLS — text extracted server-side
    t.integer('created_at').notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('files');
}
