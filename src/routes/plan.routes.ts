import { Hono } from 'hono';
import { authMiddleware } from '../middlewares/authMiddleware';
import { getAllPlans, getPlanById, createPlan, updatePlan, deletePlan } from '../controllers/planController';

const router = new Hono();


router.get('/', getAllPlans);
router.get('/:id', getPlanById);

router.post('/', createPlan);
router.put('/:id', authMiddleware(), updatePlan);
router.delete('/:id', authMiddleware(), deletePlan);

export default router;