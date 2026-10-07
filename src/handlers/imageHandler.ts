// ไฟล์นี้ทำหน้าที่อะไร: จัดการกรณีผู้ใช้ส่งภาพสลิปหรือรูปเก็บข้อมูลรายรับ-รายจ่าย
// ใครรับผิดชอบ: ⑤ Integration
// เขียนในสัปดาห์: W3
// อ้างอิง: SPEC.md §S9 Slip Reader (วงจรทั้งเส้น) + §S10 Dedup / SRS FR-15
// ⚖️ กฎเหล็ก G1, G2, G5, G6
//
// วงจรตาม §S9 และเหตุผลที่ลำดับนี้สลับไม่ได้:
//   1. หา user_id จาก line_user_id       ← G6 ไม่รู้ว่าใครก็ทำอะไรต่อไม่ได้
//   2. loading animation                 ← Vision ใช้เวลาหลายวินาที ต้องบอกผู้ใช้ว่ากำลังทำ
//   3. ดึงรูปจาก LINE Content API         ← เข้า memory เท่านั้น
//   4. readSlip (guard + Vision + Zod)   ← ตกด่านไหนก็บอกผู้ใช้ให้พิมพ์เอง (G4)
//   5. เดาหมวดจากชื่อผู้รับ                ← จับคู่กับหมวดที่ผู้ใช้มีอยู่ ไม่สร้างใหม่
//   6. เช็คซ้ำตาม S10                      ← ก่อนสร้าง pending ไม่ใช่หลัง
//   7. สร้าง pending (source='image')     ← G2 ยังไม่เขียนรายการจริง
//   8. ตอบพร้อมปุ่มยืนยัน                   ← คนกดปุ่มคือการยืนยันของมนุษย์
//
// 🔴 G5: รูปอยู่ในตัวแปร Buffer ตัวเดียวเท่านั้น ไม่มีบรรทัดไหนในไฟล์นี้เขียนรูปลงดิสก์
// ไม่มีบรรทัดไหน log เนื้อรูป และไม่ส่งรูปต่อให้ใครนอกจาก readSlip
// ตาม SPEC §S9 "MUST NOT เก็บไฟล์รูปไว้ที่ใดเลย"

import { getUserIdByLineUserId } from '../db/queries/users';
import { lineBlobClient, lineClient } from '../line/client';
import { replyText, replyTextWithQuickReply } from '../line/reply';
import { checkDuplicate } from '../services/dedup.service';
import { createPending } from '../services/pending.service';
import { FALLBACK_EXPENSE_CATEGORY, resolveCategoryName } from '../services/ai/router';
import { readSlip, type SlipData } from '../services/ai/vision';
import { formatBaht } from '../utils/money';

type LineImageMessageEvent = {
  replyToken?: string;
  source?: { userId?: string };
  message?: { type: string; id?: string };
};

/** ชื่อรายการเมื่ออ่านชื่อผู้รับไม่ได้ — ต้องมีอะไรให้ผู้ใช้เห็นในรายการเสมอ */
const FALLBACK_ITEM = 'สลิปโอนเงิน';

/**
 * ข้อความเมื่อ AI ใช้ไม่ได้ (⚖️ G4)
 *
 * ต้องบอกทางไปต่อที่ไม่ต้องใช้ AI ไม่ใช่แค่บอกว่าใช้ไม่ได้ —
 * ผู้ใช้ที่ถือสลิปอยู่ในมือยังต้องจดเงินได้ด้วยการพิมพ์
 */
const SLIP_UNAVAILABLE = [
  'ตอนนี้อ่านสลิปจากรูปให้ไม่ได้ครับ 🙏',
  'พิมพ์มาได้เลยครับ เช่น "ค่าหอ 3500" หรือ "โอนให้แม่ 500"',
].join('\n');

export async function handleImage(event: LineImageMessageEvent): Promise<void> {
  const replyToken = event.replyToken;
  const lineUserId = event.source?.userId;
  const messageId = event.message?.id;

  if (!replyToken || !lineUserId || !messageId) {
    console.error('[imageHandler] event ไม่มี replyToken/userId/messageId ครบ');
    return;
  }

  // ⚖️ G6: user_id ที่แท้จริงต้อง query จาก line_user_id ของ event เท่านั้น
  const userId = await getUserIdByLineUserId(lineUserId);
  if (!userId) {
    await replyText(replyToken, 'ยังไม่พบบัญชีผู้ใช้ครับ ลองแอดเพื่อนบอทใหม่อีกครั้งนะครับ 🙏');
    return;
  }

  // Vision ใช้เวลาหลายวินาที ถ้าไม่มีสัญญาณอะไรเลยผู้ใช้จะคิดว่าบอทเงียบแล้วส่งรูปซ้ำ
  await showLoading(lineUserId);

  let image: Buffer;
  try {
    image = await downloadImage(messageId);
  } catch (err) {
    console.error('[imageHandler] ดึงรูปจาก LINE ไม่สำเร็จ:', err);
    await replyText(replyToken, 'ดึงรูปไม่สำเร็จครับ ลองส่งอีกครั้งนะครับ 🙏');
    return;
  }

  // ⚠️ LINE ส่งรูปที่ผู้ใช้อัปโหลดมาเป็น JPEG เสมอ ไม่มี content-type ใน event
  // ให้ readSlip ตรวจขนาดและชนิดต่อเอง
  const result = await readSlip({ userId, image, mimeType: 'image/jpeg' });

  if (result.kind === 'unavailable') {
    await replyText(replyToken, SLIP_UNAVAILABLE);
    return;
  }
  if (result.kind === 'unreadable') {
    await replyText(replyToken, result.reason);
    return;
  }

  try {
    await proposeSlip(replyToken, userId, result.slip);
  } catch (err) {
    console.error('[imageHandler] สร้างคำขอจากสลิปไม่สำเร็จ:', err);
    await replyText(replyToken, 'บันทึกสลิปไม่สำเร็จครับ ลองส่งอีกครั้งนะครับ 🙏');
  }
}

/** แสดง loading animation — ล้มเหลวแล้วไม่เป็นไร อย่าให้ flow พังเพราะเรื่องความสวยงาม */
async function showLoading(lineUserId: string): Promise<void> {
  try {
    await lineClient.showLoadingAnimation({ chatId: lineUserId, loadingSeconds: 10 });
  } catch (err) {
    console.warn('[imageHandler] showLoadingAnimation ไม่สำเร็จ (ข้ามได้):', err);
  }
}

/**
 * ดึงเนื้อรูปจาก LINE Content API เข้า memory
 *
 * 🔴 G5: อ่านเป็น chunk แล้วต่อกันใน memory ไม่เขียนลงดิสก์
 * ถ้ามีใครมาแก้ให้ pipe ลงไฟล์ชั่วคราวเพื่อ "ให้ประหยัดแรม" จะผิด SPEC §S9 ทันที
 */
async function downloadImage(messageId: string): Promise<Buffer> {
  const stream = await lineBlobClient.getMessageContent(messageId);
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
  }
  return Buffer.concat(chunks);
}

/**
 * สลิปอ่านได้แล้ว — เช็คซ้ำ แล้วเสนอให้ผู้ใช้กดยืนยัน (⚖️ G2)
 *
 * ⚠️ สลิปคือเงินออกจากบัญชีผู้ใช้ → type='expense' เป็นค่าเริ่มต้นตาม SPEC §S9
 * ผู้ใช้เปลี่ยนเป็นอย่างอื่นได้ในหน้าเว็บทีหลัง
 */
async function proposeSlip(replyToken: string, userId: string, slip: SlipData): Promise<void> {
  const occurredAt = new Date(slip.occurredAtIso);

  // ── S10 Dedup ก่อนสร้าง pending (🔴 ห้ามมี AI ในการตัดสินตาม S10) ─────────
  const verdict = await checkDuplicate({
    userId,
    type: 'expense',
    amountSatang: slip.amountSatang,
    occurredAt,
    refNumber: slip.refNumber,
  });

  // ref_number ตรงกัน = สลิปใบเดิมเป๊ะ ๆ ไม่ต้องถามอะไรให้ผู้ใช้สับสน
  if (verdict.kind === 'exact') {
    await replyText(
      replyToken,
      [
        'สลิปใบนี้บันทึกไว้แล้วครับ ✅',
        `${formatBaht(slip.amountSatang)}${slip.receiver ? ` · ${slip.receiver}` : ''}`,
        'ไม่ได้บันทึกซ้ำให้นะครับ',
      ].join('\n')
    );
    return;
  }

  const categoryName =
    (await resolveCategoryName(userId, slip.receiver, 'expense')) ?? FALLBACK_EXPENSE_CATEGORY;

  const pending = await createPending({
    userId,
    action: 'create_transaction',
    source: 'image',
    payload: {
      type: 'expense',
      amountSatang: slip.amountSatang,
      totalSatang: slip.amountSatang,
      splitCount: 1,
      item: slip.receiver ?? FALLBACK_ITEM,
      occurredAtIso: slip.occurredAtIso,
      categoryName,
      refNumber: slip.refNumber,
    },
  });

  const lines = ['อ่านสลิปได้แล้วครับ ✨', '', pending.summary];

  // ยอดเท่ากันและเวลาใกล้กันมาก = "น่าจะซ้ำ" แต่ไม่แน่ (SPEC §S9 "คำเตือนถ้าอาจซ้ำ")
  // ไม่ปฏิเสธให้เอง เพราะคนโอนยอดเดิมสองครั้งติดกันก็มีจริง ให้ผู้ใช้ตัดสิน
  if (verdict.kind === 'probable') {
    lines.push(
      '',
      '⚠️ มีรายการยอดเท่ากันในช่วงเวลาใกล้กันอยู่แล้ว',
      'ถ้าเป็นรายการเดียวกัน กด "ไม่ใช่" เพื่อไม่ให้บันทึกซ้ำนะครับ'
    );
  }

  if (slip.bank) {
    lines.push('', `ธนาคาร: ${slip.bank}`);
  }

  await replyTextWithQuickReply(replyToken, lines.join('\n'), [
    {
      type: 'action',
      action: {
        type: 'postback',
        label: 'ยืนยัน',
        data: `action=ai_confirm&id=${pending.id}`,
        displayText: 'ยืนยัน',
      },
    },
    {
      type: 'action',
      action: {
        type: 'postback',
        label: 'ไม่ใช่',
        data: `action=ai_cancel&id=${pending.id}`,
        displayText: 'ไม่ใช่',
      },
    },
  ]);
}
