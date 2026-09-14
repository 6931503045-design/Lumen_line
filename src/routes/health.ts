// ไฟล์นี้ทำหน้าที่อะไร: endpoint ตรวจสุขภาพของ backend สำหรับ Render / GitHub Actions / monitoring
// ใครรับผิดชอบ: ① Bot Core
// เขียนในสัปดาห์: W1
// TODO: เพิ่ม health checks สำหรับ Supabase, Gemini, LINE, cron
// ⚖️ กฎเหล็ก G4

import express from 'express';

export const healthRouter = express.Router();

healthRouter.get('/', (_req, res) => {
  res.status(200).json({ ok: true, service: 'JOD tang' });
});
