import {
  sqliteTable,
  text,
  integer,
} from 'drizzle-orm/sqlite-core';

import {
  sql,
  relations,
} from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name'),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  personal_access_token: text('personal_access_token').notNull().unique(),
  plan: text('plan').default('basic').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(sql`1`),
  accountValidTill: integer('account_valid_till', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`strftime('%s', 'now')`),
}, (table) => ({
  planConstraint: sql`CHECK(${table.plan} IN ('basic', 'pro', 'plus'))`,
}));

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  phoneNumber: text('phone_number'),
  waApiKey: text('wa_api_key'),
  status: text('status').default('active'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`strftime('%s', 'now')`),
}, (table) => ({
  statusConstraint: sql`CHECK(${table.status} IN ('active', 'inactive', 'expired'))`,
}));

// Campaigns, Media, and Reports tables are fine as-is.

export const campaigns = sqliteTable('campaigns', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  sessionId: text('session_id').references(() => sessions.id, { onDelete: 'cascade' }),
  name: text('name'),
  message: text('message'),
  mediaUrls: text('media_urls'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`strftime('%s', 'now')`),
});

export const media = sqliteTable('media', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  fileName: text('file_name'),
  fileType: text('file_type'),
  r2Url: text('r2_url'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`strftime('%s', 'now')`),
});

export const reports = sqliteTable('reports', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  campaignId: text('campaign_id').references(() => campaigns.id, { onDelete: 'cascade' }),
  successCount: integer('success_count').default(0),
  failureCount: integer('failure_count').default(0),
  details: text('details'),
  generatedAt: integer('generated_at', { mode: 'timestamp' }).default(sql`strftime('%s', 'now')`),
});

export const payments = sqliteTable('payments', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  amount: integer('amount').notNull(),
  plan: text('plan').notNull(),
  monthsPaid: integer('months_paid').default(1),
  paymentDate: integer('payment_date', { mode: 'timestamp' }).default(sql`strftime('%s', 'now')`),
  validTill: integer('valid_till', { mode: 'timestamp' }).notNull(),
  paymentMethod: text('payment_method'),
  transactionId: text('transaction_id'),
}, (table) => ({
  planConstraint: sql`CHECK(${table.plan} IN ('basic', 'pro', 'plus'))`,
}));

// Relations remain unchanged
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  campaigns: many(campaigns),
  media: many(media),
  reports: many(reports),
  payments: many(payments),
}));

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
  campaigns: many(campaigns),
}));

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  user: one(users, {
    fields: [campaigns.userId],
    references: [users.id],
  }),
  session: one(sessions, {
    fields: [campaigns.sessionId],
    references: [sessions.id],
  }),
  reports: many(reports),
}));

export const mediaRelations = relations(media, ({ one }) => ({
  user: one(users, {
    fields: [media.userId],
    references: [users.id],
  }),
}));

export const reportsRelations = relations(reports, ({ one }) => ({
  user: one(users, {
    fields: [reports.userId],
    references: [users.id],
  }),
  campaign: one(campaigns, {
    fields: [reports.campaignId],
    references: [campaigns.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  user: one(users, {
    fields: [payments.userId],
    references: [users.id],
  }),
}));