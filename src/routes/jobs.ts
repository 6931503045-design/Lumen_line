// ไฟล์นี้ทำหน้าที่อะไร: endpoint สำหรับ cron tasks จาก GitHub Actions และตรวจ CRON_SECRET
// ใครรับผิดชอบ: ① Bot Core
// เขียนในสัปดาห์: W3
// TODO: เพิ่ม jobs recurring, daily summary, cleanup, plan checks ที่ idempotent
// ⚖️ กฎเหล็ก G4, G6

import express from 'express';

export const jobsRouter = express.Router();

jobsRouter.post('/run', (_req, res) => {
  res.status(200).json({ ok: true, message: 'Cron job scaffold ready' });
});
