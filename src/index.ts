// src/index.ts
import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './db/schema';
import { InferInsertModel } from 'drizzle-orm';

// Define your environment variables, including the D1 binding
export interface Env {
  DB: D1Database;
  R2_BUCKET: R2Bucket; // We'll add this for R2 later
  WASENDER_API_KEY: string; // Your Wasender API key
  WASENDER_API_URL: string; // Wasender API base URL
  JWT_SECRET: string; // Add JWT_SECRET for authentication
}

// Extend the Hono Context to include our Drizzle DB instance
// and potentially a 'user' object from auth middleware later
type Variables = {
  db: ReturnType<typeof drizzle>;
  user?: { id: string; role: 'user' | 'admin' }; // Optional: for future auth middleware
};

// Initialize Hono app with our custom environment and variables
const app = new Hono<{ Bindings: Env, Variables: Variables }>();

// --- Middleware ---

// Middleware to inject the Drizzle DB client into the context
app.use('*', async (c, next) => {
  const db = drizzle(c.env.DB, { schema });
  c.set('db', db); // Make db accessible via c.get('db')
  await next();
});

// --- Controllers / Handlers ---

// Type for inserting a new user
type NewUser = InferInsertModel<typeof schema.users>;

// GET /api/users - Get all users
app.get('/api/users', async (c) => {
  const db = c.get('db');
  const allUsers = await db.select().from(schema.users).all();
  return c.json(allUsers);
});

// POST /api/users - Create a new user
app.post('/api/users', async (c) => {
  const db = c.get('db');
  try {
    const { email, name, password } = await c.req.json();

    // Basic validation (you'd want more robust validation here)
    if (!email || !password) {
      return c.json({ error: 'Email and password are required' }, 400);
    }

    // Hash password (using a placeholder for now, integrate argon2 or bcrypt later)
    const hashedPassword = `hashed_${password}`; // Replace with actual hashing

    const newUser: NewUser = {
      id: crypto.randomUUID(), // Generate a unique ID
      email,
      name,
      password: hashedPassword,
      planId: null, // Default to null, can be updated later
      role: 'user', // Default role
      personalAccessToken: crypto.randomUUID(), // Generate a personal access token
      accountExpiresAt: new Date(Date.now() + 31536000000), // Account expires in 1 year
      isActive: true,
      // CORRECTED: Use new Date() for createdAt
      createdAt: new Date(), // Set to current Date object
    };

    const insertedUser = await db.insert(schema.users).values(newUser).returning().get();
    // Exclude password from the response for security
    const { password: _, ...userWithoutPassword } = insertedUser;
    return c.json(userWithoutPassword, 201);
  } catch (error) {
    console.error('Error creating user:', error);
    return c.json({ error: 'Failed to create user' }, 500);
  }
});

// POST /api/upload-file - Handle file uploads to R2
app.post('/api/upload-file', async (c) => {
  const env = c.env;
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return c.json({ error: 'No file uploaded' }, 400);
    }

    const fileName = file.name;
    const fileType = file.type;
    const arrayBuffer = await file.arrayBuffer();

    // Upload to R2
    await env.R2_BUCKET.put(fileName, arrayBuffer, {
      httpMetadata: { contentType: fileType },
    });

    const r2Url = `https://${env.R2_BUCKET.name}.r2.cloudflarestorage.com/${fileName}`; // Example R2 URL

    // Store metadata in your Drizzle schema
    const db = c.get('db');
    // You'll need a userId here, which would come from authentication
    // For now, let's use a placeholder or assume it's passed in the form data
    const userId = formData.get('userId') as string || 'placeholder-user-id'; // Replace with actual user ID from auth

    await db.insert(schema.mediaUploads).values({
      id: crypto.randomUUID(),
      userId: userId,
      fileName: fileName,
      fileType: fileType,
      r2Url: r2Url,
      uploadedAt: Date.now(), // This is fine if schema allows number or Date, but Date is safer
    }).execute();

    return c.json({ message: 'File uploaded successfully', url: r2Url }, 200);
  } catch (error) {
    console.error('Error uploading file to R2:', error);
    return c.json({ error: 'Failed to upload file' }, 500);
  }
});

// POST /api/send-message - Send a message via Wasender
app.post('/api/send-message', async (c) => {
  const env = c.env;
  const db = c.get('db');
  try {
    const { userId, sessionId, recipientNumber, messageContent } = await c.req.json();

    // Basic validation
    if (!userId || !sessionId || !recipientNumber || !messageContent) {
      return c.json({ error: 'Missing required fields for sending message' }, 400);
    }

    // Call Wasender API
    const wasenderResponse = await fetch(env.WASENDER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.WASENDER_API_KEY}`, // Assuming Bearer token
      },
      body: JSON.stringify({
        // Adjust payload based on Wasender API documentation
        to: recipientNumber,
        message: messageContent,
        // Add other required fields by Wasender API, e.g., session ID if needed by Wasender
      }),
    });

    const wasenderResult = await wasenderResponse.json();

    // Log the message attempt
    await db.insert(schema.messageLogs).values({
      id: crypto.randomUUID(),
      campaignId: 'placeholder-campaign-id', // You'd link this to an actual campaign
      sessionId: sessionId,
      messageContent: messageContent,
      status: wasenderResponse.ok ? 'sent' : 'failed',
      timestamp: Date.now(), // This is fine if schema allows number or Date, but Date is safer
    }).execute();

    if (!wasenderResponse.ok) {
      console.error('Wasender API error:', wasenderResult);
      return c.json({ error: 'Failed to send message via Wasender API', details: wasenderResult }, 500);
    }

    return c.json({ message: 'Message sent successfully', wasenderResult });

  } catch (error) {
    console.error('Error sending message:', error);
    return c.json({ error: 'Internal server error during message sending' }, 500);
  }
});

// Add a simple root route as a health check
app.get('/', (c) => c.text('Welcome to TextMint Worker! Hono is active.'));

export default app;
