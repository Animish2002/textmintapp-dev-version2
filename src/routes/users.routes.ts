// src/routes/users.routes.ts
import { Hono } from 'hono';
import { authMiddleware } from '../middlewares/authMiddleware';
import { getAllUsers, getUserById, updateUser, deleteUser } from '../controllers/user.controller';

const router = new Hono();


router.get('/', authMiddleware(['admin']), getAllUsers);
router.get('/:id', authMiddleware(), getUserById);
router.put('/:id', authMiddleware(), updateUser);
router.delete('/:id', authMiddleware(), deleteUser);

export default router;
