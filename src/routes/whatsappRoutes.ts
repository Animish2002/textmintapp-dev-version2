// routes/whatsappRoutes.ts
import { Hono } from 'hono';
import { WhatsAppController } from '../controllers/whatsappController';

const whatsappRoutes = new Hono();

// Create a new WhatsApp session
whatsappRoutes.post('/sessions', WhatsAppController.createSession);

// Connect session and initialize (may return QR code)
whatsappRoutes.post('/sessions/:sessionId/connect', WhatsAppController.connectSession);

// Get QR code for session
whatsappRoutes.get('/sessions/:sessionId/qrcode', WhatsAppController.getQRCode);

// Get session status
whatsappRoutes.get('/sessions/:sessionId/status', WhatsAppController.getSessionStatus);

// Disconnect session
whatsappRoutes.post('/sessions/:sessionId/disconnect', WhatsAppController.disconnectSession);

// Delete session
whatsappRoutes.delete('/sessions/:sessionId', WhatsAppController.deleteSession);

// Get all user sessions
whatsappRoutes.get('/sessions', WhatsAppController.getUserSessions);

export default whatsappRoutes;