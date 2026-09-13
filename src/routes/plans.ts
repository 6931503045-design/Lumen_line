import { Router } from 'express';

import { activatePlan, createPlan, listPlans } from '../services/plans.js';

const router = Router();

router.get('/plans', (req, res) => {
  const userId = String(req.query.userId ?? 'demo-user');
  res.json(listPlans(userId));
});

router.post('/plans', (req, res) => {
  const { userId, name, targetAmountSatang, monthlyAmountSatang, status } = req.body ?? {};

  if (!userId || !name || typeof targetAmountSatang !== 'number' || typeof monthlyAmountSatang !== 'number') {
    return res.status(400).json({ error: 'userId, name, targetAmountSatang, and monthlyAmountSatang are required' });
  }

  const plan = createPlan(userId, name, targetAmountSatang, monthlyAmountSatang, status ?? 'draft');
  return res.status(201).json(plan);
});

router.post('/plans/:id/activate', (req, res) => {
  const userId = String(req.query.userId ?? 'demo-user');
  const plan = activatePlan(userId, req.params.id);

  if (!plan) {
    return res.status(404).json({ error: 'Plan not found' });
  }

  return res.json(plan);
});

export default router;
