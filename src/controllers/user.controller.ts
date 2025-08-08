import { Context } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';


/**
 * Fetches all user records from the database.
 * NOTE: This should be an admin-only route in a production application.
 */
export const getAllUsers = async (c: Context) => {
  const d1 = c.env.DB as D1Database;
  const db = drizzle(d1, { schema });
  
  try {
    const allUsers = await db.select().from(users).all();
    return c.json(allUsers, 200);
  } catch (error) {
    console.error('Error fetching all users:', error);
    return c.json({ error: 'Failed to fetch users' }, 500);
  }
};

/**
 * Fetches a single user by their ID.
 * This can be used for a profile page, but sensitive fields should be excluded.
 */
export const getUserById = async (c: Context) => {
  const d1 = c.env.DB as D1Database;
  const db = drizzle(d1, { schema });

  const { id } = c.req.param();

  if (!id) {
    return c.json({ error: 'User ID is required' }, 400);
  }

  try {
    const user = await db.select().from(users).where(eq(users.id, id)).get();
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }
    // Omit sensitive data like password before returning the user object
    const { password, ...userData } = user;
    return c.json(userData, 200);
  } catch (error) {
    console.error('Error fetching user:', error);
    return c.json({ error: 'Failed to fetch user' }, 500);
  }
};

/**
 * Updates a user's information.
 * NOTE: This should be an admin-only or a self-update route.
 */
export const updateUser = async (c: Context) => {
  const d1 = c.env.DB as D1Database;
  const db = drizzle(d1, { schema });

  const { id } = c.req.param();
  const updateData = await c.req.json();

  if (!id) {
    return c.json({ error: 'User ID is required' }, 400);
  }

  try {
    await db.update(users).set(updateData).where(eq(users.id, id)).run();
    return c.json({ message: 'User updated successfully' }, 200);
  } catch (error) {
    console.error('Error updating user:', error);
    return c.json({ error: 'Failed to update user' }, 500);
  }
};

/**
 * Deletes a user.
 * NOTE: This is a highly sensitive, admin-only route.
 */
export const deleteUser = async (c: Context) => {
  const d1 = c.env.DB as D1Database;
  const db = drizzle(d1, { schema });

  const { id } = c.req.param();

  if (!id) {
    return c.json({ error: 'User ID is required' }, 400);
  }

  try {
    await db.delete(users).where(eq(users.id, id)).run();
    return c.json({ message: 'User deleted successfully' }, 200);
  } catch (error) {
    console.error('Error deleting user:', error);
    return c.json({ error: 'Failed to delete user' }, 500);
  }
};
