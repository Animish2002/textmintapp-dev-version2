// src/routes/auth.routes.ts
import { Hono } from 'hono';
import { register, login, getMe } from '../controllers/authController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = new Hono();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authMiddleware(), getMe);

export default router;