// ไฟล์นี้ทำหน้าที่อะไร: endpoint สำหรับ LINE webhook รับข้อความและตรวจลายเซ็นก่อนประมวลผล
// ใครรับผิดชอบ: ① Bot Core
// เขียนในสัปดาห์: W1
// TODO: เพิ่ม verifySignature, dedup webhookEventId, dispatch to handlers
// ⚖️ กฎเหล็ก G5, G6

import express from 'express';

export const webhookRouter = express.Router();

webhookRouter.post('/', (_req, res) => {
  res.status(200).json({ ok: true, message: 'Webhook scaffold ready' });
});
