
// src/routes/media.routes.ts
import { Hono } from 'hono';
import { uploadMedia, getUserMedia, deleteMedia } from '../controllers/media.controller';
import { authMiddleware } from '../middlewares/authMiddleware'; // Your JWT auth middleware

const mediaRoutes = new Hono();


// Upload media
mediaRoutes.post('/upload',authMiddleware(['user']), uploadMedia);

// Get user's media with pagination and filtering
mediaRoutes.get('/',authMiddleware(), getUserMedia);

// Delete media
mediaRoutes.delete('/:id',authMiddleware(['user']), deleteMedia);

export default mediaRoutes;