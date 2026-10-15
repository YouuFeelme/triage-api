import { sql, type Kysely } from 'kysely';

// Migrations use Kysely<any> on purpose: they describe the schema at one point in history,
// so they must not depend on src/db/schema.ts, which keeps changing.

export async function up(db: Kysely<any>): Promise<void> {
  // Enums: the database itself rejects a status like 'closed' or a typo like 'in-progress'.
  await db.schema.createType('user_role').asEnum(['customer', 'agent', 'admin']).execute();
  await db.schema.createType('ticket_status').asEnum(['open', 'in_progress', 'resolved']).execute();
  await db.schema
    .createType('ticket_priority')
    .asEnum(['low', 'medium', 'high', 'urgent'])
    .execute();

  // Trigger function shared by every table with an updated_at column.
  await sql`
    CREATE FUNCTION set_updated_at() RETURNS trigger AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP FUNCTION set_updated_at()`.execute(db);
  await db.schema.dropType('ticket_priority').execute();
  await db.schema.dropType('ticket_status').execute();
  await db.schema.dropType('user_role').execute();
}
