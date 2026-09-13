// ไฟล์นี้ทำหน้าที่อะไร: จุดเริ่มต้นของ backend Express สำหรับ LINE webhook, health check, jobs, และ API
// ใครรับผิดชอบ: ① Bot Core
// เขียนในสัปดาห์: W1
// TODO: เพิ่ม middleware, request validation, route registration, graceful shutdown
// ⚖️ กฎเหล็ก G4, G5, G6

import express from 'express';
import { env } from './config/env';
import { healthRouter } from './routes/health';
import { webhookRouter } from './routes/webhook';
import { apiRouter } from './routes/api';
import { jobsRouter } from './routes/jobs';

const app = express();

app.use(express.json());
app.use('/health', healthRouter);
app.use('/webhook', webhookRouter);
app.use('/api', apiRouter);
app.use('/jobs', jobsRouter);

app.get('/', (_req, res) => {
  res.json({ name: 'JOD tang', status: 'scaffold-ready' });
});

const port = env.port;
app.listen(port, () => {
  console.log(`JOD tang backend running on port ${port}`);
});
