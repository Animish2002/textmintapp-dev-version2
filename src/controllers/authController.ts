// src/controllers/auth.controller.ts
import { Context } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { users, plans } from '../db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { sign } from 'hono/jwt';


const createUserFolderStructure = async (r2: any, userId: string, userName: string): Promise<void> => {
  // Skip in local development without --remote
  if (typeof r2 === 'string') {
    console.warn('Running in local dev without --remote, skipping R2 operations');
    return;
  }

  // Check if R2 bucket is properly initialized
  if (!r2 || typeof r2.put !== 'function') {
    console.error('R2 bucket not properly initialized');
    return;
  }

  const sanitizedUserName = userName?.replace(/[^a-zA-Z0-9-_]/g, '_') || 'user';
  const folders = ['images', 'videos', 'documents'];
  const userFolder = `${sanitizedUserName}_${userId}`;
  
  try {
    console.log(`Creating folder structure for user: ${userFolder}`);
    
    for (const folder of folders) {
      const folderPath = `${userFolder}/${folder}/.keep`; // Using .keep instead of .gitkeep
      
      try {
        await r2.put(folderPath, new Uint8Array(), {
          httpMetadata: { contentType: 'application/octet-stream' },
          customMetadata: {
            'created-by': 'user-registration',
            'user-id': userId,
          }
        });
        console.log(`Created folder placeholder: ${folderPath}`);
      } catch (folderError) {
        console.error(`Error creating folder ${folderPath}:`, folderError);
      }
    }
  } catch (error) {
    console.error('Error in user folder creation:', error);
  }
};

// Updated register function with better R2 handling
export const register = async (c: Context) => {
  const d1 = c.env.DB as D1Database;
  const r2 = c.env.R2_BUCKET;
  const db = drizzle(d1, { schema });
  const isProduction = c.env.CF_VERSION !== undefined;

  console.log('Running in production mode:', isProduction);
  
  console.log('Available environment bindings:', Object.keys(c.env));
  console.log('R2_BUCKET available:', !!r2);
  console.log('R2_BUCKET type:', typeof r2);
  
  // Check if we're in local development
  const isLocalDev = typeof r2 === 'string' || !c.env.CF_VERSION;
  console.log('Running in local development mode:', isLocalDev);
  
  if (isLocalDev) {
    console.log('⚠️  R2 functionality limited in local development. Use "wrangler dev --remote" for full R2 support.');
  }
  
  const { name, email, role, personalAccessToken, mobile, password } = await c.req.json();

  // Basic required fields check
  if (!email || !password) {
    return c.json({ error: 'Email and password are required' }, 400);
  }
  if (!personalAccessToken) {
    return c.json({ error: 'Personal access token is required' }, 400);
  }

  try {
    // Ensure the 'free' plan exists
    let freePlan = await db.select().from(plans).where(eq(plans.id, 'free')).get();
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

    // Check if email already exists
    const existingUser = await db.select().from(users).where(eq(users.email, email)).get();
    if (existingUser) {
      return c.json({ error: 'User with this email already exists' }, 409);
    }

    // Check if personal access token already exists
    const existingToken = await db
      .select()
      .from(users)
      .where(eq(users.personalAccessToken, personalAccessToken))
      .get();

    if (existingToken) {
      return c.json({ error: 'Personal access token already exists' }, 409);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUserId = crypto.randomUUID();

    await db.insert(users).values({
      id: newUserId,
      email,
      name,
      mobile,
      password: hashedPassword,
      personalAccessToken,
      planId: freePlan?.id,
      accountExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days expiry
      isActive: true,
      createdAt: new Date(),
      role: role || 'user'
    }).run();

    // Create user folder structure in R2 storage
    await createUserFolderStructure(r2, newUserId, name);

    return c.json({ 
      message: 'User registered successfully',
      userId: newUserId,
      folderCreated: !!r2 // Indicate if folder creation was attempted
    }, 201);

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


export const testR2 =async(c:Context) =>{
    try {
    // Debug output
    console.log('R2 Binding Type:', typeof c.env.R2_BUCKET);
    console.log('R2 Methods:', Object.keys(c.env.R2_BUCKET || {}));
    
    // Simple test operation
    await c.env.R2_BUCKET.put('test.txt', new TextEncoder().encode('test content'));
    
    return c.text('R2 access works!');
  } catch (e) {
    console.error('R2 Error:', e);
    return c.text(`R2 error: ${e.message}`, 500);
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