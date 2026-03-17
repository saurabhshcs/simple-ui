import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('otp_codes', (t) => {
    t.text('id').primary();
    t.text('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.text('code').notNullable();       // bcrypt hash of the 6-digit code
    t.integer('expires_at').notNullable();
    t.integer('used').notNullable().defaultTo(0);
    t.integer('created_at').notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('otp_codes');
}
