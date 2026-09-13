import { Router } from 'express';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'jod-tang' });
});

router.get('/', (_req, res) => {
  res.json({
    ok: true,
    message: 'JOD tang backend is running',
    aiEnabled: false,
  });
});

export default router;
