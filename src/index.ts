import express from 'express';
import { env } from './config/env';
import { healthRouter } from './routes/health';
import { webhookRouter } from './routes/webhook';
import { apiRouter } from './routes/api';
import { jobsRouter } from './routes/jobs';

const app = express();

app.use('/webhook', webhookRouter);
app.use('/health', healthRouter);
app.use('/api', express.json(), apiRouter);
app.use('/jobs', express.json(), jobsRouter);

app.get('/', (_req, res) => {
  res.json({ name: 'JOD tang', status: 'scaffold-ready' });
});

const port = env.port;
app.listen(port, () => {
  console.log(`JOD tang backend running on port ${port}`);
});
