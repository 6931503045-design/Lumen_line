// ไฟล์นี้ทำหน้าที่อะไร: จัดการ postback event จากปุ่มใน Flex message (ตอนนี้มีแค่ confirmCard: undo/edit_category)
// ใครรับผิดชอบ: ① Bot Core
// เขียนในสัปดาห์: W1 (บางส่วน — restore/edit_category เต็มรูปแบบเป็น W2)
// อ้างอิง: SPEC.md §3 S1 ตาราง Postback
// ⚖️ กฎเหล็ก G2, G6 — ทุก action ต้องเช็คว่า record เป็นของผู้ใช้ที่กด และกดซ้ำต้องไม่เกิดผลซ้ำ
//
// ⚠️ ขอบเขต W1: ทำเฉพาะ action=undo ให้ทำงานจริง (ตามเกณฑ์ปิด W1 ใน Prompt_AI_Agent_v3.md บรรทัด 912
// ที่ระบุแค่ "confirmCard + ↩️ ยกเลิก") ส่วน action=edit_category ตอบข้อความ stub ไปก่อน (ต้องมี
// quick reply รายการหมวดของ user ก่อน ซึ่งยังไม่ได้ทำ query สำหรับ list categories) — ยกเป็นงานถัดไป

import { getUserIdByLineUserId } from '../db/queries/users';
import {
  getTransactionOwnedByUser,
  softDeleteTransaction,
  restoreTransaction,
} from '../db/queries/transactions';
import { replyText, replyTextWithQuickReply } from '../line/reply';

type LinePostbackEvent = {
  replyToken?: string;
  source?: { userId?: string };
  postback?: { data?: string };
};

export async function handlePostback(event: LinePostbackEvent): Promise<void> {
  const replyToken = event.replyToken;
  const lineUserId = event.source?.userId;
  const data = event.postback?.data;

  if (!replyToken || !lineUserId || !data) {
    console.error('[postbackHandler] event ไม่มี replyToken/userId/data ครบ');
    return;
  }

  const params = new URLSearchParams(data);
  const action = params.get('action');
  const id = params.get('id');

  if (!action || !id) {
    console.error('[postbackHandler] postback data รูปแบบผิด:', data);
    return;
  }

  // ⚖️ G6: ต้อง query user_id จาก event เท่านั้น แล้วเช็คว่า record เป็นของคนนี้จริงก่อนแก้อะไรทั้งสิ้น
  const userId = await getUserIdByLineUserId(lineUserId);
  if (!userId) {
    await replyText(replyToken, 'ยังไม่พบบัญชีผู้ใช้ครับ ลองแอดเพื่อนบอทใหม่อีกครั้งนะครับ 🙏');
    return;
  }

  switch (action) {
    case 'undo':
      await handleUndo(replyToken, userId, id);
      break;
    case 'restore':
      await handleRestore(replyToken, userId, id);
      break;
    case 'edit_category':
      // TODO W2: ต้องมี db/queries/categories.ts::listCategoriesByUser() ก่อน แล้วส่ง quick reply
      await replyText(replyToken, 'ฟีเจอร์แก้หมวดยังไม่เปิดใช้งานตอนนี้ครับ 🙏 (กำลังทำต่อ)');
      break;
    default:
      console.error('[postbackHandler] ไม่รู้จัก action:', action);
      break;
  }
}

async function handleUndo(replyToken: string, userId: string, transactionId: string): Promise<void> {
  const tx = await getTransactionOwnedByUser(transactionId, userId);

  if (!tx) {
    // ไม่เจอ หรือไม่ใช่ของ user คนนี้ (G6) — ไม่บอกรายละเอียดเพิ่มเพื่อกัน enumeration
    await replyText(replyToken, 'ไม่พบรายการนี้ครับ อาจถูกยกเลิกไปแล้ว');
    return;
  }

  if (tx.deleted_at) {
    // กดซ้ำ (idempotent ตาม G2/SPEC "ทุก action ... กดซ้ำต้องไม่เกิดผลซ้ำ")
    await replyText(replyToken, 'รายการนี้ถูกยกเลิกไปแล้วครับ');
    return;
  }

  try {
    await softDeleteTransaction(transactionId);
    await replyTextWithQuickReply(replyToken, 'ยกเลิกรายการล่าสุดแล้วครับ ↩️', [
      {
        type: 'action',
        action: {
          type: 'postback',
          label: 'เอากลับคืน',
          data: `action=restore&id=${transactionId}`,
          displayText: 'เอากลับคืน',
        },
      },
    ]);
  } catch (err) {
    console.error('[postbackHandler] softDeleteTransaction error:', err);
    await replyText(replyToken, 'ยกเลิกไม่สำเร็จ ลองใหม่อีกครั้งนะครับ 🙏');
  }
}

async function handleRestore(replyToken: string, userId: string, transactionId: string): Promise<void> {
  const tx = await getTransactionOwnedByUser(transactionId, userId);

  if (!tx) {
    await replyText(replyToken, 'ไม่พบรายการนี้ครับ');
    return;
  }

  if (!tx.deleted_at) {
    await replyText(replyToken, 'รายการนี้ยังไม่ได้ถูกยกเลิกครับ');
    return;
  }

  try {
    await restoreTransaction(transactionId);
    await replyText(replyToken, 'เอารายการกลับคืนแล้วครับ ✅');
  } catch (err) {
    console.error('[postbackHandler] restoreTransaction error:', err);
    await replyText(replyToken, 'เอากลับคืนไม่สำเร็จ ลองใหม่อีกครั้งนะครับ 🙏');
  }
}