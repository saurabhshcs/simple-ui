import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.table('messages', (t) => {
    t.text('model').nullable();
    t.text('provider').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.table('messages', (t) => {
    t.dropColumn('model');
    t.dropColumn('provider');
  });
}
