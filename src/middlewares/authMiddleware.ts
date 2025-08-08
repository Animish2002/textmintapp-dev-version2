import { Context, Next } from 'hono';
import { verify } from 'hono/jwt'; // Corrected import
import { z } from 'zod';

// Define the roles in a central place to avoid typos.
export const roles = ['admin', 'user'] as const;

// Zod schema for the JWT payload, including the user's role.
const jwtPayloadSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: z.enum(roles), // Ensure the role is one of the allowed values
});


export const authMiddleware = (allowedRoles: (typeof roles)[number][] = []) => {
  return async (c: Context, next: Next) => {
    // Extract the token from the 'Authorization' header
    const token = c.req.header('Authorization')?.split(' ')[1];

    if (!token) {
      return c.json({ error: 'Authorization token not provided' }, 401);
    }

    try {
      const secret = c.env?.JWT_SECRET || 'your_super_secret_key';
      
      // Verify the token and validate the payload
      const payload = await verify(token, secret); // Corrected function call
      const decoded = jwtPayloadSchema.parse(payload);

      // Role Check Logic:
      // If `allowedRoles` is empty, any valid user can proceed.
      // Otherwise, check if the user's role is in the list of allowed roles.
      if (allowedRoles.length > 0 && !allowedRoles.includes(decoded.role)) {
        return c.json({ error: 'Insufficient permissions' }, 403);
      }

      // Attach the user information to the Hono context
      c.set('user', decoded);
      
      await next();
    } catch (error) {
      console.error('JWT Verification Error:', error);
      return c.json({ error: 'Invalid token or insufficient permissions' }, 403);
    }
  };
};
