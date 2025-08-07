import { Hono } from 'hono';
import { register, login } from './controllers/authController';
import { getProfile } from './controllers/userController';
import { authMiddleware } from './middlewares/authMiddleware';
import { dbMiddleware } from './db/drizzle';

const auth = new Hono().basePath('/auth');
auth.post('/register', register);
auth.post('/login', login);

const user = new Hono().basePath('/user');
user.get('/profile', getProfile);

export const routes = new Hono();
routes.route('/api', auth);
routes.route('/api', user);