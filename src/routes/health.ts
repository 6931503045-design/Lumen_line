// ไฟล์นี้ทำหน้าที่อะไร: endpoint ตรวจสุขภาพ + บอกว่าตั้งค่าอะไรครบแล้วบ้าง
// ใครรับผิดชอบ: ① Bot Core
// เขียนในสัปดาห์: W1
// ⚖️ กฎเหล็ก G4
//
// ทำไมต้องบอกสถานะ config ด้วย: ตอน deploy ครั้งแรกความผิดพลาดที่เจอบ่อยที่สุดคือ
// ลืมตั้ง env สักตัว แล้วอาการที่เห็นคือ "กดล็อกอินแล้วขึ้น 503" หรือ "อีเมลไม่เข้าเลย"
// ซึ่งไล่หาสาเหตุยากมากถ้าไม่มีที่ให้ดู — เปิด /health แล้วเห็นทันทีว่าขาดตัวไหน
//
// 🔒 ส่งออกแค่ true/false ว่า "ตั้งค่าไว้หรือยัง" ไม่ส่งค่าจริงออกไปเด็ดขาด
// และการรู้ว่ายังไม่ได้ตั้งไม่เป็นช่องโหว่ เพราะทุกส่วนที่ยังไม่ได้ตั้งจะปฏิเสธ request
// อยู่แล้ว (fail closed): ไม่มี CRON_SECRET -> /jobs ตอบ 503, ไม่มี SESSION_SECRET -> /api ตอบ 503

import express from 'express';
import { env } from '../config/env';

export const healthRouter = express.Router();

healthRouter.get('/', (_req, res) => {
  const features = {
    // บอท LINE: รับ webhook และตอบข้อความได้
    bot: Boolean(env.lineChannelAccessToken && env.lineChannelSecret),
    // ฐานข้อมูล
    database: Boolean(env.supabaseUrl && env.supabaseServiceRoleKey),
    // ล็อกอินเข้าหน้าเว็บ
    webLogin: Boolean(
      env.lineLoginChannelId && env.lineLoginChannelSecret && env.appBaseUrl && env.sessionSecret
    ),
    // งานตามเวลาจาก GitHub Actions
    cron: Boolean(env.cronSecret),
    // ดึงอีเมลธนาคาร
    emailIngest: Boolean(env.gmailUser && env.gmailAppPassword),
    // AI (ปิดได้ตาม G4 แอปต้องใช้งานได้ต่อ)
    ai: Boolean(env.aiEnabled && env.geminiApiKey),
  };

  const notConfigured = Object.entries(features)
    .filter(([, ready]) => !ready)
    .map(([name]) => name);

  res.status(200).json({
    ok: true,
    service: 'JOD tang',
    features,
    notConfigured,
  });
});
