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
// Stores core user information, including their role and a reference to their subscription plan.
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  password: text('password').notNull(),
  // A foreign key to the plans table for robust plan management.
  planId: text('plan_id').references(() => plans.id, { onDelete: 'set null' }),
  role: text('role').default('user').notNull(), // 'admin' / 'user'
  personalAccessToken: text('personal_access_token').notNull().unique(),
  // The timestamp when the user's account access expires. Used for revoking access.
  accountExpiresAt: integer('account_expires_at', { mode: 'timestamp' }).notNull(),
  // Status flag for easy access revocation.
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).defaultNow(),
}, (table) => ({
  // Ensure the 'role' column can only be 'admin' or 'user' for data integrity.
  roleConstraint: sql`CHECK(${table.role} IN ('admin', 'user'))`,
}));

// --- PLANS TABLE ---
// A single source of truth for all subscription plans. This is a key improvement for scalability.
export const plans = sqliteTable('plans', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(), // 'basic', 'pro', 'plus'
  priceInINR: integer('price_in_inr').notNull(),
  // The maximum number of concurrent WhatsApp sessions allowed for this plan.
  maxSessions: integer('max_sessions').notNull(),
  description: text('description'),
  createdAt: integer('created_at', { mode: 'timestamp' }).defaultNow(),
});

// --- SESSIONS TABLE ---
// Stores individual WhatsApp sessions for each user.
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  // A foreign key to the users table. 'onDelete: cascade' ensures sessions are removed if a user is deleted.
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  phoneNumber: text('phone_number').notNull(),
  status: text('status').default('active').notNull(), // 'active' / 'disconnected' / 'expired'
  sessionName: text('session_name'), // A user-friendly name for the session
  createdAt: integer('created_at', { mode: 'timestamp' }).defaultNow(),
}, (table) => ({
  // Ensure the 'status' column is a valid value.
  statusConstraint: sql`CHECK(${table.status} IN ('active', 'disconnected', 'expired'))`,
}));

// --- PAYMENTS TABLE ---
// Tracks all payment history for users.
export const payments = sqliteTable('payments', {
  id: text('id').primaryKey(),
  // Foreign key to users. 'onDelete: cascade' removes payment history if a user is deleted.
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // Foreign key to plans. This links the payment to a specific plan.
  planId: text('plan_id').notNull().references(() => plans.id),
  amountInINR: integer('amount_in_inr').notNull(),
  monthsPaid: integer('months_paid').notNull(),
  transactionId: text('transaction_id').notNull().unique(),
  paidAt: integer('paid_at', { mode: 'timestamp' }).defaultNow(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
});

// --- SERVERS TABLE ---
// Stores details for server instances created on platforms like 'wasender'.
export const servers = sqliteTable('servers', {
  id: text('id').primaryKey(),
  // Foreign key to users. 'onDelete: cascade' removes server info if a user is deleted.
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  platformName: text('platform_name').notNull(), // 'wasender', 'another_platform'
  serverUrl: text('server_url').notNull(),
  apiKey: text('api_key').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).defaultNow(),
});

// --- CAMPAIGNS TABLE ---
// Stores the details of each bulk messaging campaign.
export const campaigns = sqliteTable('campaigns', {
  id: text('id').primaryKey(),
  // Foreign key to users.
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  status: text('status').default('draft').notNull(), // 'draft', 'in_progress', 'completed', 'failed'
  messageContent: text('message_content'),
  createdAt: integer('created_at', { mode: 'timestamp' }).defaultNow(),
}, (table) => ({
  statusConstraint: sql`CHECK(${table.status} IN ('draft', 'in_progress', 'completed', 'failed'))`,
}));

// --- MESSAGE LOGS TABLE ---
// Stores logs for individual messages sent as part of a campaign.
export const messageLogs = sqliteTable('message_logs', {
  id: text('id').primaryKey(),
  // Foreign key to campaigns.
  campaignId: text('campaign_id').notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  // Foreign key to the specific session used.
  sessionId: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  messageContent: text('message_content'),
  status: text('status').default('sent').notNull(), // 'sent' / 'failed'
  timestamp: integer('timestamp', { mode: 'timestamp' }).defaultNow(),
}, (table) => ({
  statusConstraint: sql`CHECK(${table.status} IN ('sent', 'failed'))`,
}));


// --- MEDIA UPLOADS TABLE ---
// Stores metadata for files uploaded to a service like Cloudflare R2.
export const mediaUploads = sqliteTable('media_uploads', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  fileName: text('file_name').notNull(),
  fileType: text('file_type').notNull(), // 'image' / 'video' / 'document'
  r2Url: text('r2_url').notNull(),
  uploadedAt: integer('uploaded_at', { mode: 'timestamp' }).defaultNow(),
});


// --- RELATIONS ---
// These relations are crucial for powerful queries and join operations.

export const usersRelations = relations(users, ({ one, many }) => ({
  // A user has one plan.
  plan: one(plans, {
    fields: [users.planId],
    references: [plans.id],
  }),
  // A user can have many sessions, payments, etc.
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