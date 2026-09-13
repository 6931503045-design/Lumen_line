import express from 'express';

import { config } from './config.js';
import budgetsRoutes from './routes/budgets.js';
import commandsRoutes from './routes/commands.js';
import healthRoutes from './routes/health.js';
import plansRoutes from './routes/plans.js';
import transactionsRoutes from './routes/transactions.js';
import webhookRoutes from './routes/webhook.js';

const app = express();

app.use('/webhook', express.raw({ type: 'application/json' }));
app.use('/webhook', webhookRoutes);
app.use(express.json({ limit: '1mb' }));
app.use(healthRoutes);
app.use('/api', commandsRoutes);
app.use('/api', budgetsRoutes);
app.use('/api', plansRoutes);
app.use('/api', transactionsRoutes);

app.get('/config', (_req, res) => {
  res.json({
    port: config.port,
    aiEnabled: config.aiEnabled,
    hasLineSecret: Boolean(config.line.channelSecret),
    hasDatabaseUrl: Boolean(config.databaseUrl),
  });
});

export default app;
