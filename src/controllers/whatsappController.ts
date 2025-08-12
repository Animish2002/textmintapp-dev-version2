// controllers/whatsappController.ts
import { Context } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { sessions, users } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

const WASENDER_API_BASE = 'https://www.wasenderapi.com/api';

interface WasenderSessionResponse {
	success: boolean;
	data: {
		id: number;
		name: string;
		phone_number: string;
		status: string;
		account_protection: boolean;
		log_messages: boolean;
		read_incoming_messages: boolean;
		webhook_url?: string;
		webhook_enabled: boolean;
		webhook_events: string[];
		api_key: string;
		webhook_secret: string;
		created_at: string;
		updated_at: string;
	};
}

interface WasenderQRResponse {
	success: boolean;
	data: {
		qrCode: string;
	};
}

interface WasenderStatusResponse {
	status: string;
}



export class WhatsAppController {
	// Create new WhatsApp session

	static async createSession(c: Context) {
		const d1 = c.env.DB as D1Database;
		const db = drizzle(d1, { schema });
		try {
			const { phoneNumber, sessionName } = await c.req.json();
			const authHeader = c.req.header('Authorization');

			if (!authHeader) {
				return c.json({ error: 'Authorization header required' }, 401);
			}

			const token = authHeader.replace('Bearer ', '');

			// Find user by personal access token
			const user = await db.select().from(users).where(eq(users.personalAccessToken, token)).limit(1);

			if (user.length === 0) {
				return c.json({ error: 'Invalid access token' }, 401);
			}

			const userId = user[0].id;

			// Check if user has reached session limit based on their plan
			const userSessions = await db.select().from(sessions).where(eq(sessions.userId, userId));
			const userPlan = user[0].planId;

			// You might want to check against plan limits here
			// const planLimits = await db.select().from(plans).where(eq(plans.id, userPlan));

			// Create session in Wasender
			const wasenderResponse = await fetch(`${WASENDER_API_BASE}/whatsapp-sessions`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${token}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					name: sessionName || `Session-${phoneNumber}`,
					phone_number: phoneNumber,
					account_protection: false, // As per your requirement
					log_messages: true,
					read_incoming_messages: true,
					webhook_enabled: false, // As per your requirement
					webhook_events: [],
					auto_reject_calls: false,
				}),
			});

			if (!wasenderResponse.ok) {
				const errorText = await wasenderResponse.text();
				return c.json({ error: 'Failed to create Wasender session', details: errorText }, 400);
			}

			const wasenderData: WasenderSessionResponse = await wasenderResponse.json();

			if (!wasenderData.success) {
				return c.json({ error: 'Wasender API returned error', data: wasenderData }, 400);
			}

			// Create session in our database
			const sessionId = nanoid();
			await db.insert(sessions).values({
				id: sessionId,
				userId: userId,
				phoneNumber: phoneNumber,
				sessionName: sessionName || `Session-${phoneNumber}`,
				status: 'disconnected',
				wasenderSessionId: wasenderData.data.id.toString(),
				wasenderApiKey: wasenderData.data.api_key,
				webhookSecret: wasenderData.data.webhook_secret,
				accountProtection: false,
				logMessages: true,
				readIncomingMessages: true,
				webhookEnabled: false,
				createdAt: new Date(),
			});

			return c.json({
				success: true,
				data: {
					sessionId: sessionId,
					wasenderSessionId: wasenderData.data.id,
					phoneNumber: phoneNumber,
					sessionName: sessionName,
					status: wasenderData.data.status,
					apiKey: wasenderData.data.api_key,
				},
			});
		} catch (error) {
			console.error('Create session error:', error);
			return c.json({ error: 'Internal server error' }, 500);
		}
	}

	// Connect session and get QR code
	static async connectSession(c: Context) {
        const d1 = c.env.DB as D1Database;
		const db = drizzle(d1, { schema });
		try {
			const sessionId = c.req.param('sessionId');
			const authHeader = c.req.header('Authorization');

			if (!authHeader) {
				return c.json({ error: 'Authorization header required' }, 401);
			}

			const token = authHeader.replace('Bearer ', '');

			// Find user and session
			const user = await db.select().from(users).where(eq(users.personalAccessToken, token)).limit(1);

			if (user.length === 0) {
				return c.json({ error: 'Invalid access token' }, 401);
			}

			const session = await db
				.select()
				.from(sessions)
				.where(and(eq(sessions.id, sessionId), eq(sessions.userId, user[0].id)))
				.limit(1);

			if (session.length === 0) {
				return c.json({ error: 'Session not found' }, 404);
			}

			const wasenderSessionId = session[0].wasenderSessionId;

			// Connect session in Wasender
			const connectResponse = await fetch(`${WASENDER_API_BASE}/whatsapp-sessions/${wasenderSessionId}/connect`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});

			if (!connectResponse.ok) {
				const errorText = await connectResponse.text();
				return c.json({ error: 'Failed to connect Wasender session', details: errorText }, 400);
			}

			const connectData: any = await connectResponse.json();

			// Update session status
			await db
				.update(sessions)
				.set({
					status: 'connecting',
					lastActiveAt: new Date(),
				})
				.where(eq(sessions.id, sessionId));

			// If QR code is included in connect response, return it
			if (connectData.data?.qrCode) {
				await db.update(sessions).set({ qrCode: connectData.data.qrCode }).where(eq(sessions.id, sessionId));

				return c.json({
					success: true,
					data: {
						status: connectData.data.status,
						qrCode: connectData.data.qrCode,
						message: 'Session initialized. Scan QR code to connect.',
					},
				});
			}

			return c.json({
				success: true,
				data: {
					status: connectData.data.status,
					message: 'Session connecting...',
				},
			});
		} catch (error) {
			console.error('Connect session error:', error);
			return c.json({ error: 'Internal server error' }, 500);
		}
	}

	// Get QR code for session
	static async getQRCode(c: Context) {
        const d1 = c.env.DB as D1Database;
		const db = drizzle(d1, { schema });
		try {
			const sessionId = c.req.param('sessionId');
			const authHeader = c.req.header('Authorization');

			if (!authHeader) {
				return c.json({ error: 'Authorization header required' }, 401);
			}

			const token = authHeader.replace('Bearer ', '');

			// Find user and session
			const user = await db.select().from(users).where(eq(users.personalAccessToken, token)).limit(1);

			if (user.length === 0) {
				return c.json({ error: 'Invalid access token' }, 401);
			}

			const session = await db
				.select()
				.from(sessions)
				.where(and(eq(sessions.id, sessionId), eq(sessions.userId, user[0].id)))
				.limit(1);

			if (session.length === 0) {
				return c.json({ error: 'Session not found' }, 404);
			}

			const wasenderSessionId = session[0].wasenderSessionId;

			// Get QR code from Wasender
			const qrResponse = await fetch(`${WASENDER_API_BASE}/whatsapp-sessions/${wasenderSessionId}/qrcode`, {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});

			if (!qrResponse.ok) {
				const errorText = await qrResponse.text();
				return c.json({ error: 'Failed to get QR code', details: errorText }, 400);
			}

			const qrData: WasenderQRResponse = await qrResponse.json();

			if (!qrData.success) {
				return c.json({ error: 'Failed to generate QR code', data: qrData }, 400);
			}

			// Update session with QR code
			await db.update(sessions).set({ qrCode: qrData.data.qrCode }).where(eq(sessions.id, sessionId));

			return c.json({
				success: true,
				data: {
					qrCode: qrData.data.qrCode,
					sessionId: sessionId,
					phoneNumber: session[0].phoneNumber,
				},
			});
		} catch (error) {
			console.error('Get QR code error:', error);
			return c.json({ error: 'Internal server error' }, 500);
		}
	}

	// Get session status
	static async getSessionStatus(c: Context) {
        const d1 = c.env.DB as D1Database;
		const db = drizzle(d1, { schema });
		try {
			const sessionId = c.req.param('sessionId');
			const authHeader = c.req.header('Authorization');

			if (!authHeader) {
				return c.json({ error: 'Authorization header required' }, 401);
			}

			const token = authHeader.replace('Bearer ', '');

			// Find user and session
			const user = await db.select().from(users).where(eq(users.personalAccessToken, token)).limit(1);

			if (user.length === 0) {
				return c.json({ error: 'Invalid access token' }, 401);
			}

			const session = await db
				.select()
				.from(sessions)
				.where(and(eq(sessions.id, sessionId), eq(sessions.userId, user[0].id)))
				.limit(1);

			if (session.length === 0) {
				return c.json({ error: 'Session not found' }, 404);
			}

			// Get status from Wasender using session's API key
			const statusResponse = await fetch(`${WASENDER_API_BASE}/status`, {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${session[0].wasenderApiKey}`,
				},
			});

			if (!statusResponse.ok) {
				const errorText = await statusResponse.text();
				return c.json({ error: 'Failed to get session status', details: errorText }, 400);
			}

			const statusData: WasenderStatusResponse = await statusResponse.json();

			// Update local session status
			let localStatus = 'disconnected';
			switch (statusData.status) {
				case 'connected':
					localStatus = 'connected';
					break;
				case 'connecting':
					localStatus = 'connecting';
					break;
				case 'expired':
				case 'logged_out':
					localStatus = 'expired';
					break;
				default:
					localStatus = 'disconnected';
			}

			await db
				.update(sessions)
				.set({
					status: localStatus,
					lastActiveAt: new Date(),
				})
				.where(eq(sessions.id, sessionId));

			return c.json({
				success: true,
				data: {
					sessionId: sessionId,
					status: statusData.status,
					phoneNumber: session[0].phoneNumber,
					sessionName: session[0].sessionName,
					lastActiveAt: session[0].lastActiveAt,
				},
			});
		} catch (error) {
			console.error('Get session status error:', error);
			return c.json({ error: 'Internal server error' }, 500);
		}
	}

	// Disconnect session
	static async disconnectSession(c: Context) {
        const d1 = c.env.DB as D1Database;
		const db = drizzle(d1, { schema });
		try {
			const sessionId = c.req.param('sessionId');
			const authHeader = c.req.header('Authorization');

			if (!authHeader) {
				return c.json({ error: 'Authorization header required' }, 401);
			}

			const token = authHeader.replace('Bearer ', '');

			// Find user and session
			const user = await db.select().from(users).where(eq(users.personalAccessToken, token)).limit(1);

			if (user.length === 0) {
				return c.json({ error: 'Invalid access token' }, 401);
			}

			const session = await db
				.select()
				.from(sessions)
				.where(and(eq(sessions.id, sessionId), eq(sessions.userId, user[0].id)))
				.limit(1);

			if (session.length === 0) {
				return c.json({ error: 'Session not found' }, 404);
			}

			const wasenderSessionId = session[0].wasenderSessionId;

			// Disconnect session in Wasender
			const disconnectResponse = await fetch(`${WASENDER_API_BASE}/whatsapp-sessions/${wasenderSessionId}/disconnect`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});

			if (!disconnectResponse.ok) {
				const errorText = await disconnectResponse.text();
				return c.json({ error: 'Failed to disconnect Wasender session', details: errorText }, 400);
			}

			// Update local session status
			await db
				.update(sessions)
				.set({
					status: 'disconnected',
					qrCode: null,
					lastActiveAt: new Date(),
				})
				.where(eq(sessions.id, sessionId));

			return c.json({
				success: true,
				data: {
					sessionId: sessionId,
					status: 'disconnected',
					message: 'Session disconnected successfully',
				},
			});
		} catch (error) {
			console.error('Disconnect session error:', error);
			return c.json({ error: 'Internal server error' }, 500);
		}
	}

	// Delete session
	static async deleteSession(c: Context) {
        const d1 = c.env.DB as D1Database;
		const db = drizzle(d1, { schema });
		try {
			const sessionId = c.req.param('sessionId');
			const authHeader = c.req.header('Authorization');

			if (!authHeader) {
				return c.json({ error: 'Authorization header required' }, 401);
			}

			const token = authHeader.replace('Bearer ', '');

			// Find user and session
			const user = await db.select().from(users).where(eq(users.personalAccessToken, token)).limit(1);

			if (user.length === 0) {
				return c.json({ error: 'Invalid access token' }, 401);
			}

			const session = await db
				.select()
				.from(sessions)
				.where(and(eq(sessions.id, sessionId), eq(sessions.userId, user[0].id)))
				.limit(1);

			if (session.length === 0) {
				return c.json({ error: 'Session not found' }, 404);
			}

			const wasenderSessionId = session[0].wasenderSessionId;

			// Delete session in Wasender
			const deleteResponse = await fetch(`${WASENDER_API_BASE}/whatsapp-sessions/${wasenderSessionId}`, {
				method: 'DELETE',
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});

			if (!deleteResponse.ok) {
				const errorText = await deleteResponse.text();
				console.warn('Failed to delete Wasender session:', errorText);
				// Continue with local deletion even if Wasender deletion fails
			}

			// Delete from local database
			await db.delete(sessions).where(eq(sessions.id, sessionId));

			return c.json({
				success: true,
				data: {
					message: 'Session deleted successfully',
				},
			});
		} catch (error) {
			console.error('Delete session error:', error);
			return c.json({ error: 'Internal server error' }, 500);
		}
	}

	// Get all user sessions
	static async getUserSessions(c: Context) {
        const d1 = c.env.DB as D1Database;
		const db = drizzle(d1, { schema });
		try {
			const authHeader = c.req.header('Authorization');

			if (!authHeader) {
				return c.json({ error: 'Authorization header required' }, 401);
			}

			const token = authHeader.replace('Bearer ', '');

			// Find user
			const user = await db.select().from(users).where(eq(users.personalAccessToken, token)).limit(1);

			if (user.length === 0) {
				return c.json({ error: 'Invalid access token' }, 401);
			}

			// Get all user sessions
			const userSessions = await db.select().from(sessions).where(eq(sessions.userId, user[0].id));

			return c.json({
				success: true,
				data: {
					sessions: userSessions.map((session) => ({
						sessionId: session.id,
						phoneNumber: session.phoneNumber,
						sessionName: session.sessionName,
						status: session.status,
						createdAt: session.createdAt,
						lastActiveAt: session.lastActiveAt,
					})),
				},
			});
		} catch (error) {
			console.error('Get user sessions error:', error);
			return c.json({ error: 'Internal server error' }, 500);
		}
	}
}
