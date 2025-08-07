import { createMiddleware } from 'hono/factory';
import { verify } from 'hono/jwt';

// Define a type for your JWT payload
type JwtPayload = {
  id: string;
  role: 'user' | 'admin';
};

// Extend the Hono Context with our custom user variable
export const authMiddleware = createMiddleware<{
  Variables: { user: JwtPayload };
}>(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) {
    return c.json({ error: 'Authorization header is missing' }, 401);
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return c.json({ error: 'Bearer token is missing' }, 401);
  }

  try {
    const payload = await verify(token, c.env.JWT_SECRET as string);
    // Set the user in the context for downstream handlers
    c.set('user', payload as JwtPayload);
    await next();
  } catch (e) {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
});