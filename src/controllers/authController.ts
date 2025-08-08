// src/controllers/auth.controller.ts
import { Context } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { users, plans } from '../db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { sign } from 'hono/jwt';


/**
 * Handles user registration.
 * Creates a new user in the database after hashing their password.
 */
export const register = async (c: Context) => {
  const d1 = c.env.DB as D1Database;
  const db = drizzle(d1, { schema });

  const { name, email, password } = await c.req.json();

  if (!email || !password) {
    return c.json({ error: 'Email and password are required' }, 400);
  }

  try {
    // Check for the existence of the 'free' plan.
    let freePlan = await db.select().from(plans).where(eq(plans.id, 'free')).get();

    // If the 'free' plan doesn't exist, insert it.
    if (!freePlan) {
      await db.insert(plans).values({
        id: 'free',
        name: 'Free Plan',
        priceInINR: 0,
        maxSessions: 1,
        description: 'A free plan for new users.',
      }).run();
      freePlan = await db.select().from(plans).where(eq(plans.id, 'free')).get();
    }

    const existingUser = await db.select().from(users).where(eq(users.email, email)).get();
    if (existingUser) {
      return c.json({ error: 'User with this email already exists' }, 409);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUserId = crypto.randomUUID();
    const newPersonalAccessToken = crypto.randomUUID().replace(/-/g, '');

    await db.insert(users).values({
      id: newUserId,
      email,
      name,
      password: hashedPassword,
      personalAccessToken: newPersonalAccessToken,
      planId: freePlan.id, // Use the ID from the fetched/created plan
      accountExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      isActive: true,
    }).run();
    
    return c.json({ message: 'User registered successfully' }, 201);
  } catch (error) {
    console.error('Registration error:', error);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
};

/**
 * Handles user login.
 * Verifies credentials and returns a JWT on success.
 */
export const login = async (c: Context) => {
  const d1 = c.env.DB as D1Database;
  const db = drizzle(d1, { schema });

  const { email, password } = await c.req.json();

  if (!email || !password) {
    return c.json({ error: 'Email and password are required' }, 400);
  }

  try {
    const user = await db.select().from(users).where(eq(users.email, email)).get();
    
    if (!user) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }
    
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    const secret = c.env?.JWT_SECRET || 'your_super_secret_key';
  const token = await sign({ id: user.id, email: user.email, role: user.role }, secret);

    const userPlan = await db.select().from(plans).where(eq(plans.id, user.planId as string)).get();
    
    return c.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        personalAccessToken: user.personalAccessToken,
        role: user.role,
        plan: userPlan,
      }
    }, 200);

  } catch (error) {
    console.error('Login error:', error);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
};

/**
 * A protected route handler to demonstrate middleware functionality.
 */
export const getMe = (c: Context) => {
  const user = c.get('user');
  
  if (!user) {
    return c.json({ error: 'User not authenticated' }, 401);
  }
  
  return c.json({
    message: 'User data retrieved',
    user,
  }, 200);
};