// ไฟล์นี้ทำหน้าที่อะไร: endpoint สำหรับ LINE webhook รับข้อความ ตรวจลายเซ็น กันซ้ำ แล้วแยกงานไปแต่ละ handler
// ใครรับผิดชอบ: ① Bot Core
// เขียนในสัปดาห์: W1
// อ้างอิง: SPEC.md §3 S1 (event follow/unfollow/message.text/postback), README.md แผนภาพ webhook
// ⚖️ กฎเหล็ก G5, G6
//
// 🆕 เพิ่ม dispatch ไป postback event (สำหรับปุ่ม ↩️ ยกเลิก / ✏️ แก้หมวด ใน confirmCard)
//
// รูปแบบตาม SPEC: ต้องตอบ 200 ภายใน < 1 วิ ก่อน แล้วค่อยประมวลผล event ต่อแบบ async (ไม่ await handler
// ก่อนตอบ res เพื่อไม่ให้ LINE คิดว่า timeout แล้ว retry ซ้ำจนเกิด event ซ้ำมากขึ้นไปอีก)

import express from 'express';
import { middleware } from '@line/bot-sdk';
import { env } from '../config/env';
import { supabase } from '../db/supabase';
import { handleFollow, handleUnfollow } from '../handlers/followHandler';
import { handleText } from '../handlers/textHandler';
import { handlePostback } from '../handlers/postbackHandler';

export const webhookRouter = express.Router();

const lineConfig = {
  channelAccessToken: env.lineChannelAccessToken,
  channelSecret: env.lineChannelSecret,
};

/**
 * โครงสร้าง event แบบคร่าวๆ พอสำหรับ W1 (follow / unfollow / message.text / postback)
 * ตั้งใจไม่ import type เต็มจาก @line/bot-sdk เพราะ namespace ของ type ใน SDK เปลี่ยนบ่อยระหว่างเวอร์ชัน
 * (v7 ใช้ WebhookEvent ตรงๆ, v8 ย้ายไปอยู่ใต้ `webhook.Event`) — ก่อนจะ narrow type ให้แม่นขึ้น
 * ให้เช็คเวอร์ชัน @line/bot-sdk ใน package.json ก่อนเสมอ
 */
type LineWebhookEvent = {
  type: string;
  webhookEventId?: string;
  replyToken?: string;
  source?: { userId?: string; type?: string };
  message?: { type: string; text?: string };
  postback?: { data?: string };
};

// middleware ของ @line/bot-sdk ต้องมาก่อน handler เสมอ — เป็นตัวตรวจ x-line-signature ด้วย raw body
// (ดูคอมเมนต์ใน index.ts ว่าทำไมห้ามมี express.json() ครอบมาก่อนหน้านี้)
webhookRouter.post('/', middleware(lineConfig), (req, res) => {
  // ต้องตอบ 200 ทันทีก่อนประมวลผลต่อ (< 1 วิ ตาม SPEC) — ไม่ await handler ตรงนี้
  res.status(200).json({ ok: true });

  const events = (req.body?.events ?? []) as LineWebhookEvent[];
  for (const event of events) {
    processEvent(event).catch((err) => {
      console.error('[webhook] processEvent error:', err);
    });
  }
});

async function processEvent(event: LineWebhookEvent): Promise<void> {
  // กันประมวลผลซ้ำ: insert webhookEventId ลง webhook_events ถ้าชน primary key (เคยทำแล้ว) ให้ข้าม
  const eventId = event.webhookEventId;

  if (eventId) {
    const { error } = await supabase.from('webhook_events').insert({ id: eventId });

    if (error) {
      // 23505 = unique_violation ของ Postgres แปลว่าเคย insert แถวนี้ไปแล้ว = event ซ้ำ ข้ามได้เลย (idempotent)
      if (error.code === '23505') return;
      console.error('[webhook] insert webhook_events error:', error);
      return;
    }
  }

  // 🔴 แก้บั๊ก: เดิมพอ insert marker สำเร็จก็ไปเรียก handler เลยโดยไม่มี try/catch
  // ถ้า handler พังกลางทาง (Supabase ล่ม, เน็ตหลุด) marker จะค้างอยู่ใน webhook_events
  // แล้วตอน LINE retry มารอบใหม่จะชน 23505 แล้ว return ทิ้งทันที = รายการของผู้ใช้หายถาวร
  // โดยไม่มีใครรู้ ตอนนี้ถ้า handler พังจะลบ marker ทิ้งเพื่อเปิดทางให้ retry ของ LINE ทำงานได้จริง
  try {
    await dispatchEvent(event);
  } catch (err) {
    if (eventId) {
      const { error: cleanupError } = await supabase
        .from('webhook_events')
        .delete()
        .eq('id', eventId);

      if (cleanupError) {
        // ลบไม่สำเร็จ = retry ของ LINE จะยังโดนข้ามอยู่ดี ต้อง log ให้เห็นชัดว่า event ไหนหาย
        console.error(
          `[webhook] ลบ marker ของ event ${eventId} ไม่สำเร็จ — retry จะถูกข้าม:`,
          cleanupError
        );
      }
    }
    throw err;
  }
}

async function dispatchEvent(event: LineWebhookEvent): Promise<void> {
  switch (event.type) {
    case 'follow':
      await handleFollow(event);
      break;
    case 'unfollow':
      await handleUnfollow(event);
      break;
    case 'message':
      if (event.message?.type === 'text') {
        await handleText(event);
      }
      break;
    case 'postback':
      await handlePostback(event);
      break;
    default:
      // event ประเภทอื่น (join ฯลฯ) ยังไม่จัดการใน W1
      break;
  }
}