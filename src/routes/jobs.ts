// ไฟล์นี้ทำหน้าที่อะไร: endpoint สำหรับ cron tasks จาก GitHub Actions และตรวจ CRON_SECRET
// ใครรับผิดชอบ: ① Bot Core
// เขียนในสัปดาห์: W3
// TODO: เพิ่ม jobs recurring, daily summary, cleanup, plan checks ที่ idempotent
// ⚖️ กฎเหล็ก G4, G6
//
// 🔒 เดิม route นี้เปิดให้ใครยิงก็ได้ (ไม่มีการตรวจ secret ทั้งที่คอมเมนต์หัวไฟล์บอกว่าตรวจ)
// ตอนนี้ทุก request ต้องแนบ header `x-cron-secret` ให้ตรงกับ env.cronSecret
// เจตนา "fail closed": ถ้ายังไม่ได้ตั้ง CRON_SECRET จะตอบ 503 ปฏิเสธทุก request ไปเลย
// ไม่ใช่ปล่อยผ่าน — เพราะ job พวกนี้จะไปแตะเงินของผู้ใช้ทุกคนเมื่อเขียนเสร็จ

import express from 'express';
import { timingSafeEqual } from 'node:crypto';
import { env } from '../config/env';
import { isJobName, JOBS } from '../jobs';
import { logger } from '../utils/logger';

export const jobsRouter = express.Router();

/** เทียบ secret แบบ timing-safe กันการเดาค่าทีละไบต์จากเวลาที่ใช้ตอบ */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual โยน error ถ้าความยาวไม่เท่ากัน จึงต้องเช็คก่อน
  // (ความยาวที่ไม่ตรงไม่ถือเป็นความลับที่ต้องปกปิด เพราะยังไงก็ผิดอยู่แล้ว)
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

jobsRouter.use((req, res, next) => {
  if (!env.cronSecret) {
    console.error('[jobs] ปฏิเสธ request เพราะยังไม่ได้ตั้ง CRON_SECRET');
    res.status(503).json({ ok: false, error: 'cron ยังไม่พร้อมใช้งาน' });
    return;
  }

  const provided = req.header('x-cron-secret') ?? '';
  if (!secretMatches(provided, env.cronSecret)) {
    res.status(401).json({ ok: false, error: 'unauthorized' });
    return;
  }

  next();
});

/**
 * รันงานตามชื่อ เช่น POST /jobs/run?job=emailPoll
 *
 * ตอบ 200 พร้อมสรุปผลเสมอเมื่องานรันจบ แม้ผลจะเป็น 0 รายการ เพื่อให้ GitHub Actions
 * แยกออกว่า "งานรันแล้วไม่มีอะไรทำ" (200) ต่างจาก "งานพัง" (500) — สองอย่างนี้
 * ต้องไม่หน้าตาเหมือนกันใน log ไม่งั้นระบบตายเงียบแล้วไม่มีใครรู้
 */
jobsRouter.post('/run', (req, res, next) => {
  const requested = String(req.query.job ?? req.body?.job ?? '');

  if (!requested) {
    res.status(400).json({ ok: false, error: 'ต้องระบุชื่องาน เช่น ?job=emailPoll' });
    return;
  }
  if (!isJobName(requested)) {
    res.status(404).json({
      ok: false,
      error: `ไม่รู้จักงานชื่อ "${requested}"`,
      available: Object.keys(JOBS),
    });
    return;
  }

  const startedAt = Date.now();
  JOBS[requested]()
    .then((result) => {
      const durationMs = Date.now() - startedAt;
      logger.info(`[jobs] ${requested} เสร็จใน ${durationMs}ms`, result);
      res.status(200).json({ ok: true, job: requested, durationMs, result });
    })
    .catch(next);
});
