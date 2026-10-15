import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('tickets')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('title', 'text', (col) => col.notNull())
    .addColumn('description', 'text', (col) => col.notNull())
    .addColumn('status', sql`ticket_status`, (col) => col.notNull().defaultTo('open'))
    .addColumn('priority', sql`ticket_priority`, (col) => col.notNull().defaultTo('medium'))
    // RESTRICT: a user with tickets can't be deleted by accident; the history must survive.
    .addColumn('customer_id', 'uuid', (col) =>
      col.notNull().references('users.id').onDelete('restrict'),
    )
    // SET NULL: if an agent is removed, their tickets go back to the unassigned queue.
    .addColumn('assignee_id', 'uuid', (col) => col.references('users.id').onDelete('set null'))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('resolved_at', 'timestamptz')
    .addCheckConstraint('tickets_title_length', sql`char_length(title) BETWEEN 3 AND 120`)
    .addCheckConstraint(
      'tickets_description_length',
      sql`char_length(description) BETWEEN 1 AND 5000`,
    )
    // A ticket has resolved_at if and only if it is resolved. A bug in the app can't break this.
    .addCheckConstraint(
      'tickets_resolved_at_matches_status',
      sql`(status = 'resolved') = (resolved_at IS NOT NULL)`,
    )
    .execute();

  // Each index backs a query from the design: "my tickets", "my queue", "list by status, newest first".
  await db.schema
    .createIndex('tickets_customer_id_idx')
    .on('tickets')
    .column('customer_id')
    .execute();
  await db.schema
    .createIndex('tickets_assignee_id_idx')
    .on('tickets')
    .column('assignee_id')
    .execute();
  await db.schema
    .createIndex('tickets_status_created_at_idx')
    .on('tickets')
    .expression(sql`status, created_at DESC`)
    .execute();

  await sql`
    CREATE TRIGGER tickets_set_updated_at
    BEFORE UPDATE ON tickets
    FOR EACH ROW EXECUTE FUNCTION set_updated_at()
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('tickets').execute();
}
