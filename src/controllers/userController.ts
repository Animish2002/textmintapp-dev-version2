import { Context } from 'hono';
import { authMiddleware } from '../middlewares/authMiddleware';
import { dbMiddleware } from '../db/drizzle';

export const getProfile = [dbMiddleware, authMiddleware, async (c: Context) => {
  const user = c.get('user');
  const db = c.get('db');

  const profile = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.id, user.id),
    // Exclude sensitive data
    columns: {
      password: false,
      personalAccessToken: false,
      // ... any other sensitive fields
    },
    // Eager load the related plan data
    with: {
      plan: true,
    },
  });

  if (!profile) {
    return c.json({ error: 'User not found' }, 404);
  }

  return c.json(profile, 200);
}];