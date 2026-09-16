// ไฟล์นี้ทำหน้าที่อะไร: ส่งข้อความตอบกลับด้วย reply token (ฟรี ไม่มีโควตา — ใช้ให้มากที่สุด)
// ใครรับผิดชอบ: ① Bot Core
// เขียนในสัปดาห์: W1
//
// 🔴 แก้บั๊ก TS2322: @line/bot-sdk มี type QuickReply/PostbackAction ของตัวเองที่เข้มงวด
// (ต้องการ `type: 'postback'` เป็น literal ไม่ใช่ string ทั่วไป) — Record<string, unknown> ที่ใช้ก่อนหน้า
// ไม่ผ่าน ตอนนี้ประกาศ type ของ quickReply action ให้ตรงตาม schema จริงของ LINE โดยตรงแทน

import { lineClient } from './client';

export async function replyText(replyToken: string, text: string): Promise<void> {
  try {
    await lineClient.replyMessage({
      replyToken,
      messages: [{ type: 'text', text }],
    });
  } catch (err) {
    console.error('[line/reply] replyText error:', err);
  }
}

export type PostbackQuickReplyItem = {
  type: 'action';
  action: {
    type: 'postback';
    label: string;
    data: string;
    displayText?: string;
  };
};

/** ส่งข้อความพร้อมปุ่ม quick reply แบบ postback (ใช้กับปุ่ม "เอากลับคืน" หลังกด ↩️ ยกเลิก) */
export async function replyTextWithQuickReply(
  replyToken: string,
  text: string,
  items: PostbackQuickReplyItem[]
): Promise<void> {
  try {
    await lineClient.replyMessage({
      replyToken,
      messages: [{ type: 'text', text, quickReply: { items } }],
    });
  } catch (err) {
    console.error('[line/reply] replyTextWithQuickReply error:', err);
  }
}

/**
 * ส่ง Flex message ตอบกลับ (เช่น confirmCard จาก line/flex/confirmCard.ts)
 * รับ flexMessage เป็น object ดิบที่มี { type: 'flex', altText, contents } ตรงตาม LINE schema
 * cast เป็น any ตอนส่งเข้า SDK เพราะ FlexMessage type ของ @line/bot-sdk เปลี่ยน namespace บ่อยระหว่างเวอร์ชัน
 * (เหมือนเหตุผลเดียวกับที่ webhook.ts ไม่ import WebhookEvent type เต็มมา)
 */
export async function replyFlex(
  replyToken: string,
  flexMessage: { type: 'flex'; altText: string; contents: unknown },
  /**
   * ข้อความเสริมที่ส่งต่อท้ายการ์ดใน reply เดียวกัน (ใช้กับคำเตือนงบรายหมวด S5.8)
   * LINE ให้ส่งได้สูงสุด 5 ข้อความต่อ 1 reply token และคิดเป็น "ครั้งเดียว" — ไม่กินโควตาเพิ่ม
   */
  extraText?: string
): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messages: any[] = [flexMessage as any];
    if (extraText) {
      messages.push({ type: 'text', text: extraText });
    }

    await lineClient.replyMessage({ replyToken, messages });
  } catch (err) {
    console.error('[line/reply] replyFlex error:', err);
  }
}