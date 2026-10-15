/**
 * Fills the development database with realistic sample data: one admin, two agents, three
 * customers, tickets in every status (some backdated, so metrics have history) and comments.
 *
 *   npm run db:seed
 *
 * It wipes all existing data first, so it refuses to run in production.
 */
import { sql } from 'kysely';
import { env } from '../config/env';
import { hashPassword } from '../lib/password';
import { closeDatabase, db } from './database';
import type { NewComment, NewTicket, NewUser, TicketPriority, TicketStatus } from './schema';

const SEED_PASSWORD = 'Password123!';
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const now = Date.now();
const daysAgo = (days: number): Date => new Date(now - days * DAY_MS);

type SeedUserKey = 'admin' | 'lucia' | 'mateo' | 'ana' | 'carlos' | 'sofia';

const USERS: Record<SeedUserKey, Omit<NewUser, 'passwordHash'>> = {
  admin: { email: 'admin@triage.dev', name: 'Ada Admin', role: 'admin', createdAt: daysAgo(40) },
  lucia: {
    email: 'lucia@triage.dev',
    name: 'Lucía Restrepo',
    role: 'agent',
    createdAt: daysAgo(35),
  },
  mateo: { email: 'mateo@triage.dev', name: 'Mateo Gómez', role: 'agent', createdAt: daysAgo(35) },
  ana: { email: 'ana@example.com', name: 'Ana Torres', role: 'customer', createdAt: daysAgo(30) },
  carlos: {
    email: 'carlos@example.com',
    name: 'Carlos Ruiz',
    role: 'customer',
    createdAt: daysAgo(28),
  },
  sofia: {
    email: 'sofia@example.com',
    name: 'Sofía Vargas',
    role: 'customer',
    createdAt: daysAgo(26),
  },
};

interface SeedTicket {
  title: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  customer: SeedUserKey;
  assignee: SeedUserKey | null;
  createdDaysAgo: number;
  /** Only for resolved tickets: how long it took to resolve. */
  resolvedAfterHours?: number;
}

const TICKETS: SeedTicket[] = [
  {
    title: "Can't log in after password reset",
    description: 'I reset my password but the login page keeps saying invalid credentials.',
    priority: 'urgent',
    status: 'in_progress',
    customer: 'ana',
    assignee: 'lucia',
    createdDaysAgo: 1,
  },
  {
    title: 'Invoice shows the wrong billing address',
    description: 'My October invoice still has my old office address.',
    priority: 'medium',
    status: 'open',
    customer: 'carlos',
    assignee: null,
    createdDaysAgo: 0.2,
  },
  {
    title: 'Export to CSV times out on large reports',
    description: 'Exporting the yearly report fails after about 30 seconds with a gateway error.',
    priority: 'high',
    status: 'in_progress',
    customer: 'sofia',
    assignee: 'mateo',
    createdDaysAgo: 3,
  },
  {
    title: 'How do I add a teammate to my account?',
    description: "I can't find where to invite people from my team.",
    priority: 'low',
    status: 'resolved',
    customer: 'ana',
    assignee: 'lucia',
    createdDaysAgo: 6,
    resolvedAfterHours: 5,
  },
  {
    title: 'Mobile app crashes when uploading a photo',
    description:
      'The app closes as soon as I pick a photo from the gallery. iPhone 15, latest version.',
    priority: 'high',
    status: 'open',
    customer: 'carlos',
    assignee: null,
    createdDaysAgo: 2,
  },
  {
    title: 'Charged twice for the October subscription',
    description: 'I see two identical charges on my card for October.',
    priority: 'urgent',
    status: 'resolved',
    customer: 'sofia',
    assignee: 'mateo',
    createdDaysAgo: 9,
    resolvedAfterHours: 3,
  },
  {
    title: 'Notification emails go to spam',
    description: 'All emails from the platform land in my spam folder.',
    priority: 'medium',
    status: 'resolved',
    customer: 'carlos',
    assignee: 'lucia',
    createdDaysAgo: 12,
    resolvedAfterHours: 30,
  },
  {
    title: 'Dashboard loads very slowly in the morning',
    description: 'Between 8 and 9 a.m. the dashboard takes more than 20 seconds to load.',
    priority: 'medium',
    status: 'open',
    customer: 'ana',
    assignee: 'mateo',
    createdDaysAgo: 4,
  },
  {
    title: 'Request: dark mode for the web app',
    description: 'It would be great to have a dark theme for late shifts.',
    priority: 'low',
    status: 'open',
    customer: 'sofia',
    assignee: null,
    createdDaysAgo: 15,
  },
  {
    title: 'API returns 500 when the title has emojis',
    description: 'Creating a ticket through the API with an emoji in the title returns a 500.',
    priority: 'high',
    status: 'resolved',
    customer: 'ana',
    assignee: 'mateo',
    createdDaysAgo: 20,
    resolvedAfterHours: 50,
  },
  {
    title: 'Password reset link expired immediately',
    description: 'The reset link says it expired even though I clicked it right away.',
    priority: 'high',
    status: 'resolved',
    customer: 'carlos',
    assignee: 'lucia',
    createdDaysAgo: 25,
    resolvedAfterHours: 8,
  },
  {
    title: "Can't change my profile picture",
    description: 'The upload button does nothing when I click it.',
    priority: 'low',
    status: 'in_progress',
    customer: 'sofia',
    assignee: 'lucia',
    createdDaysAgo: 1.5,
  },
];

async function main(): Promise<void> {
  if (env.NODE_ENV === 'production') {
    console.error('Refusing to seed: NODE_ENV is production and seeding deletes all data.');
    process.exit(1);
  }

  // Hashing is deliberately slow, so every seed user shares one hash.
  const passwordHash = await hashPassword(SEED_PASSWORD);

  await db.transaction().execute(async (trx) => {
    // Start from a clean slate. CASCADE follows the foreign keys.
    await sql`TRUNCATE users, refresh_tokens, tickets, comments CASCADE`.execute(trx);

    const insertedUsers = await trx
      .insertInto('users')
      .values(Object.values(USERS).map((user) => ({ ...user, passwordHash })))
      .returning(['id', 'email'])
      .execute();

    const idByEmail = new Map(insertedUsers.map((user) => [user.email, user.id]));
    const userId = (key: SeedUserKey): string => {
      const id = idByEmail.get(USERS[key].email);
      if (!id) throw new Error(`Seed user "${key}" was not inserted`);
      return id;
    };

    const ticketRows: NewTicket[] = TICKETS.map((ticket) => {
      const createdAt = daysAgo(ticket.createdDaysAgo);
      const resolvedAt =
        ticket.status === 'resolved' && ticket.resolvedAfterHours !== undefined
          ? new Date(createdAt.getTime() + ticket.resolvedAfterHours * HOUR_MS)
          : null;
      return {
        title: ticket.title,
        description: ticket.description,
        priority: ticket.priority,
        status: ticket.status,
        customerId: userId(ticket.customer),
        assigneeId: ticket.assignee ? userId(ticket.assignee) : null,
        createdAt,
        updatedAt: resolvedAt ?? createdAt,
        resolvedAt,
      };
    });

    const insertedTickets = await trx
      .insertInto('tickets')
      .values(ticketRows)
      .returning(['id', 'title', 'createdAt'])
      .execute();

    const findTicket = (title: string) => {
      const found = insertedTickets.find((t) => t.title === title);
      if (!found) throw new Error(`Seed ticket "${title}" was not inserted`);
      return found;
    };
    const after = (base: Date, hours: number): Date => new Date(base.getTime() + hours * HOUR_MS);

    const login = findTicket("Can't log in after password reset");
    const csv = findTicket('Export to CSV times out on large reports');
    const charge = findTicket('Charged twice for the October subscription');

    const comments: NewComment[] = [
      {
        ticketId: login.id,
        authorId: userId('lucia'),
        body: 'Thanks Ana! Could you tell me which browser you are using?',
        createdAt: after(login.createdAt, 1),
      },
      {
        ticketId: login.id,
        authorId: userId('ana'),
        body: 'Chrome on Windows. I also tried in incognito mode.',
        createdAt: after(login.createdAt, 2),
      },
      {
        ticketId: login.id,
        authorId: userId('lucia'),
        body: 'Logs show the reset token was consumed twice. Escalating to the auth team.',
        isInternal: true,
        createdAt: after(login.createdAt, 3),
      },
      {
        ticketId: csv.id,
        authorId: userId('mateo'),
        body: 'Reproduced with a 50k-row report. The query takes 45 s; checking indexes.',
        isInternal: true,
        createdAt: after(csv.createdAt, 4),
      },
      {
        ticketId: charge.id,
        authorId: userId('mateo'),
        body: 'Sorry about that, Sofía. The duplicate charge has been refunded.',
        createdAt: after(charge.createdAt, 3),
      },
    ];

    await trx.insertInto('comments').values(comments).execute();

    console.log(
      `Seeded ${insertedUsers.length} users, ${insertedTickets.length} tickets, ${comments.length} comments.\n`,
    );
  });

  console.log(`Every user's password is: ${SEED_PASSWORD}`);
  console.table(Object.values(USERS).map(({ email, name, role }) => ({ email, name, role })));

  await closeDatabase();
}

void main().catch(async (error: unknown) => {
  console.error('Seeding failed:', error);
  await closeDatabase();
  process.exit(1);
});
