// drizzle/schema.ts
import {
  sqliteTable,
  text,
  integer,
} from 'drizzle-orm/sqlite-core';

import {
  sql,
  relations,
} from 'drizzle-orm';

// --- USERS TABLE ---
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  password: text('password').notNull(),
  planId: text('plan_id').references(() => plans.id, { onDelete: 'set null' }),
  role: text('role').default('user').notNull(),
  personalAccessToken: text('personal_access_token').notNull().unique(),
  accountExpiresAt: integer('account_expires_at', { mode: 'timestamp' }).notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).defaultNow(),
}, (table) => ({
  roleConstraint: sql`CHECK(${table.role} IN ('admin', 'user'))`,
}));

// --- PLANS TABLE ---
export const plans = sqliteTable('plans', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  priceInINR: integer('price_in_inr').notNull(),
  maxSessions: integer('max_sessions').notNull(),
  description: text('description'),
  createdAt: integer('created_at', { mode: 'timestamp' }).defaultNow(),
});

// --- SESSIONS TABLE ---
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  phoneNumber: text('phone_number').notNull(),
  status: text('status').default('active').notNull(),
  sessionName: text('session_name'),
  createdAt: integer('created_at', { mode: 'timestamp' }).defaultNow(),
}, (table) => ({
  statusConstraint: sql`CHECK(${table.status} IN ('active', 'disconnected', 'expired'))`,
}));

// --- PAYMENTS TABLE ---
export const payments = sqliteTable('payments', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  planId: text('plan_id').notNull().references(() => plans.id),
  amountInINR: integer('amount_in_inr').notNull(),
  monthsPaid: integer('months_paid').notNull(),
  transactionId: text('transaction_id').notNull().unique(),
  paidAt: integer('paid_at', { mode: 'timestamp' }).defaultNow(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
});

// --- SERVERS TABLE ---
export const servers = sqliteTable('servers', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  platformName: text('platform_name').notNull(),
  serverUrl: text('server_url').notNull(),
  apiKey: text('api_key').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).defaultNow(),
});

// --- CAMPAIGNS TABLE ---
export const campaigns = sqliteTable('campaigns', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  status: text('status').default('draft').notNull(),
  messageContent: text('message_content'),
  createdAt: integer('created_at', { mode: 'timestamp' }).defaultNow(),
}, (table) => ({
  statusConstraint: sql`CHECK(${table.status} IN ('draft', 'in_progress', 'completed', 'failed'))`,
}));

// --- MESSAGE LOGS TABLE ---
export const messageLogs = sqliteTable('message_logs', {
  id: text('id').primaryKey(),
  campaignId: text('campaign_id').notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  sessionId: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  messageContent: text('message_content'),
  status: text('status').default('sent').notNull(),
  timestamp: integer('timestamp', { mode: 'timestamp' }).defaultNow(),
}, (table) => ({
  statusConstraint: sql`CHECK(${table.status} IN ('sent', 'failed'))`,
}));

// --- MEDIA UPLOADS TABLE ---
export const mediaUploads = sqliteTable('media_uploads', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  fileName: text('file_name').notNull(),
  fileType: text('file_type').notNull(),
  r2Url: text('r2_url').notNull(),
  uploadedAt: integer('uploaded_at', { mode: 'timestamp' }).defaultNow(),
});

// --- RELATIONS ---
export const usersRelations = relations(users, ({ one, many }) => ({
  plan: one(plans, {
    fields: [users.planId],
    references: [plans.id],
  }),
  sessions: many(sessions),
  payments: many(payments),
  servers: many(servers),
  campaigns: many(campaigns),
  mediaUploads: many(mediaUploads),
}));

export const plansRelations = relations(plans, ({ many }) => ({
  users: many(users),
}));

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
  messageLogs: many(messageLogs),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  user: one(users, {
    fields: [payments.userId],
    references: [users.id],
  }),
  plan: one(plans, {
    fields: [payments.planId],
    references: [plans.id],
  }),
}));

export const serversRelations = relations(servers, ({ one }) => ({
  user: one(users, {
    fields: [servers.userId],
    references: [users.id],
  }),
}));

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  user: one(users, {
    fields: [campaigns.userId],
    references: [users.id],
  }),
  messageLogs: many(messageLogs),
}));

export const messageLogsRelations = relations(messageLogs, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [messageLogs.campaignId],
    references: [campaigns.id],
  }),
  session: one(sessions, {
    fields: [messageLogs.sessionId],
    references: [sessions.id],
  }),
}));

export const mediaUploadsRelations = relations(mediaUploads, ({ one }) => ({
  user: one(users, {
    fields: [mediaUploads.userId],
    references: [users.id],
  }),
}));