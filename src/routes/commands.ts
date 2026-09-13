import { Router } from 'express';

import { parseUserText } from '../services/parser.js';
import { createPendingAction, listPendingActions } from '../services/pending-actions.js';

const router = Router();

router.post('/parse', (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text : '';
  const parsed = parseUserText(text);

  if (!parsed) {
    return res.status(400).json({ error: 'Could not parse text input' });
  }

  return res.json(parsed);
});

router.post('/pending', (req, res) => {
  const userId = typeof req.body?.userId === 'string' ? req.body.userId : 'demo-user';
  const actionType = typeof req.body?.actionType === 'string' ? req.body.actionType : 'generic';
  const payload = req.body?.payload && typeof req.body.payload === 'object' ? req.body.payload : {};

  const action = createPendingAction(userId, actionType, payload as Record<string, unknown>);
  return res.status(201).json(action);
});

router.get('/pending', (req, res) => {
  const userId = String(req.query.userId ?? 'demo-user');
  return res.json(listPendingActions(userId));
});

export default router;
