// src/routes/auth.routes.ts
import { Hono } from 'hono';
import { register, login, getMe, testR2 } from '../controllers/authController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = new Hono();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authMiddleware(), getMe);

router.get('/test-r2',testR2)

export default router;