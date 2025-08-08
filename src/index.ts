import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { trimTrailingSlash } from 'hono/trailing-slash';
import authRoutes from './routes/auth.routes';
import plansRoutes from "./routes/plan.routes";
import userRoutes from "./routes/users.routes";

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', prettyJSON());
app.use('*', trimTrailingSlash());
app.use('*', cors({
  origin: '*', // Configure this properly for production
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));


app.route('/api/auth', authRoutes);
app.route('/api/plans', plansRoutes);
app.route('/api/users', userRoutes);

// Health check
app.get('/', (c) => {
  return c.json({
    message: 'WhatsApp Dashboard API',
    version: '1.0.0',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Error handler
app.onError((err, c) => {
  console.error('Application error:', err);
  return c.json({
    error: 'Internal server error',
    message: err.message
  }, 500);
});


// 404 handler
app.notFound((c) => {
  return c.json({
    error: 'Not found',
    message: 'The requested resource was not found'
  }, 404);
});


export default app;
