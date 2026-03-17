import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('api_keys', (t) => {
    t.text('id').primary();
    t.text('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.text('provider').notNullable();   // 'openai' | 'anthropic' | 'gemini'
    t.text('key_value').notNullable();  // AES-256-GCM encrypted: "iv:ciphertext"
    t.integer('created_at').notNullable();
    t.integer('updated_at').notNullable();
    t.unique(['user_id', 'provider']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('api_keys');
}
