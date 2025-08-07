import { Context } from 'hono';
import { sign } from 'hono/jwt';
import { InferInsertModel } from 'drizzle-orm';
import { users } from '../db/schema';
import { dbMiddleware } from '../db/drizzle';
import { hash, verify as verifyPassword } from 'argon2';

type User = InferInsertModel<typeof users>;

export const register = dbMiddleware(async (c: Context) => {
  const { email, name, password } = await c.req.json();
  const db = c.get('db');

  const existingUser = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.email, email),
  });

  if (existingUser) {
    return c.json({ error: 'User with this email already exists' }, 409);
  }

  const hashedPassword = await hash(password);
  const newUser: User = {
    id: crypto.randomUUID(),
    email,
    name,
    password: hashedPassword,
    personalAccessToken: crypto.randomUUID(),
    accountExpiresAt: new Date(Date.now() + 31536000000), // 1 year
    isActive: true,
  };

  await db.insert(users).values(newUser);

  const payload = {
    id: newUser.id,
    role: newUser.role,
  };
  const token = await sign(payload, c.env.JWT_SECRET as string);

  return c.json({ message: 'User registered successfully', token }, 201);
});

export const login = dbMiddleware(async (c: Context) => {
  const { email, password } = await c.req.json();
  const db = c.get('db');

  const user = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.email, email),
  });

  if (!user || !(await verifyPassword(user.password, password))) {
    return c.json({ error: 'Invalid email or password' }, 401);
  }

  const payload = {
    id: user.id,
    role: user.role,
  };
  const token = await sign(payload, c.env.JWT_SECRET as string);

  return c.json({ message: 'Login successful', token }, 200);
});