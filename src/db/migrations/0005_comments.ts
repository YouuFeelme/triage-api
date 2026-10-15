import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('comments')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    // CASCADE: deleting a ticket (admin only) deletes its conversation too.
    .addColumn('ticket_id', 'uuid', (col) =>
      col.notNull().references('tickets.id').onDelete('cascade'),
    )
    .addColumn('author_id', 'uuid', (col) =>
      col.notNull().references('users.id').onDelete('restrict'),
    )
    .addColumn('body', 'text', (col) => col.notNull())
    // Internal notes are visible to agents and admins only.
    .addColumn('is_internal', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addCheckConstraint('comments_body_length', sql`char_length(body) BETWEEN 1 AND 5000`)
    .execute();

  // A ticket's conversation is always read in order: this index serves it directly.
  await db.schema
    .createIndex('comments_ticket_id_created_at_idx')
    .on('comments')
    .columns(['ticket_id', 'created_at'])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('comments').execute();
}
