// src/index.ts
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './db/schema';

// Define your environment variables, including the D1 binding
export interface Env {
  DB: D1Database;
  R2_BUCKET: R2Bucket; // We'll add this for R2 later
  WASENDER_API_KEY: string; // Your Wasender API key
  WASENDER_API_URL: string; // Wasender API base URL
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const db = drizzle(env.DB, { schema }); // Initialize Drizzle with your D1 binding and schema

    if (url.pathname === '/users') {
      if (request.method === 'GET') {
        const allUsers = await db.select().from(schema.users).all();
        return Response.json(allUsers);
      } else if (request.method === 'POST') {
        try {
          const { email, name } = await request.json();
          const newUser = await db.insert(schema.users).values({
            email,
            name,
            createdAt: Date.now(),
          }).returning().get();
          return Response.json(newUser, { status: 201 });
        } catch (error) {
          console.error('Error creating user:', error);
          return new Response('Failed to create user', { status: 500 });
        }
      }
    }

    // Example of using R2 (will be detailed in the next section)
    if (url.pathname === '/upload-file' && request.method === 'POST') {
      // ... R2 upload logic here ...
      return new Response('File upload endpoint (R2)', { status: 200 });
    }

    // Example of sending a message (simplified, will need more robust logic)
    if (url.pathname === '/send-message' && request.method === 'POST') {
      try {
        const { userId, recipientNumber, messageContent } = await request.json();

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
            // Add other required fields by Wasender API
          }),
        });

        const wasenderResult = await wasenderResponse.json();

        // Log the message attempt
        await db.insert(schema.messageLogs).values({
          userId: userId,
          recipientNumber: recipientNumber,
          messageContent: messageContent,
          status: wasenderResponse.ok ? 'sent' : 'failed',
          sentAt: Date.now(),
          wasenderApiResponse: JSON.stringify(wasenderResult),
        }).execute();

        if (!wasenderResponse.ok) {
          console.error('Wasender API error:', wasenderResult);
          return new Response('Failed to send message via Wasender API', { status: 500 });
        }

        return Response.json({ message: 'Message sent successfully', wasenderResult });

      } catch (error) {
        console.error('Error sending message:', error);
        return new Response('Internal server error during message sending', { status: 500 });
      }
    }

    return new Response('Welcome to TextMint Worker!', { status: 200 });
  },
};