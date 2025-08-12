import { Context } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { plans } from '../db/schema';
import { eq } from 'drizzle-orm';

/**
 * Fetches all plans from the database.
 */
export const getAllPlans = async (c: Context) => {
  const d1 = c.env.DB as D1Database;
  const db = drizzle(d1, { schema });
  
  try {
    const allPlans = await db.select().from(plans).all();
    return c.json(allPlans, 200);
  } catch (error) {
    console.error('Error fetching plans:', error);
    return c.json({ error: 'Failed to fetch plans' }, 500);
  }
};

/**
 * Fetches a single plan by its ID.
 */
export const getPlanById = async (c: Context) => {
  const d1 = c.env.DB as D1Database;
  const db = drizzle(d1, { schema });

  const { id } = c.req.param();

  if (!id) {
    return c.json({ error: 'Plan ID is required' }, 400);
  }

  try {
    const plan = await db.select().from(plans).where(eq(plans.id, id)).get();
    if (!plan) {
      return c.json({ error: 'Plan not found' }, 404);
    }
    return c.json(plan, 200);
  } catch (error) {
    console.error('Error fetching plan:', error);
    return c.json({ error: 'Failed to fetch plan' }, 500);
  }
};

/**
 * Creates a new plan. This is an admin-only route.
 */
export const createPlan = async (c: Context) => {
  const d1 = c.env.DB as D1Database;
  const db = drizzle(d1, { schema });

  const { id, name, priceInINR, maxSessions, description } = await c.req.json();

  if (!id || !name || priceInINR === undefined || maxSessions === undefined) {
    return c.json({ error: 'All fields are required' }, 400);
  }

  try {
    await db.insert(plans).values({
      id: id,
      name: name,
      priceInINR: priceInINR,
      maxSessions: maxSessions,
      description: description,
    }).run();
    return c.json({ message: 'Plan created successfully' }, 201);
  } catch (error) {
    console.error('Error creating plan:', error);
    return c.json({ error: 'Failed to create plan' }, 500);
  }
};

/**
 * Updates an existing plan. This is an admin-only route.
 */
export const updatePlan = async (c: Context) => {
  const d1 = c.env.DB as D1Database;
  const db = drizzle(d1, { schema });

  const { id } = c.req.param();
  const updateData = await c.req.json();

  if (!id) {
    return c.json({ error: 'Plan ID is required' }, 400);
  }

  try {
    await db.update(plans).set(updateData).where(eq(plans.id, id)).run();
    return c.json({ message: 'Plan updated successfully' }, 200);
  } catch (error) {
    console.error('Error updating plan:', error);
    return c.json({ error: 'Failed to update plan' }, 500);
  }
};

/**
 * Deletes a plan. This is an admin-only route.
 */
export const deletePlan = async (c: Context) => {
  const d1 = c.env.DB as D1Database;
  const db = drizzle(d1, { schema });

  const { id } = c.req.param();

  if (!id) {
    return c.json({ error: 'Plan ID is required' }, 400);
  }

  try {
    await db.delete(plans).where(eq(plans.id, id)).run();
    return c.json({ message: 'Plan deleted successfully' }, 200);
  } catch (error) {
    console.error('Error deleting plan:', error);
    return c.json({ error: 'Failed to delete plan' }, 500);
  }
};
