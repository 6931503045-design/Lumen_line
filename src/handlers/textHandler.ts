// ไฟล์นี้ทำหน้าที่อะไร: จัดการข้อความจาก LINE — W1 มีแค่ทางด่วน L1 (regex) เท่านั้น
// ใครรับผิดชอบ: ① Bot Core / ③ AI
// เขียนในสัปดาห์: W1
// ⚖️ กฎเหล็ก G1, G2, G3, G4
//
// 🔴 แก้บั๊กรอบ 2: services/transaction.service.ts เปลี่ยน contract ไปรับ `amountSatang` ตรงๆ
// (ไม่แปลงหน่วยให้แล้ว) จึงต้องแปลง parsed.amount (บาทดิบจาก regexParser.ts) เป็นสตางค์ที่นี่
// ก่อนส่งเข้า createTransaction — ใช้ utils/money.ts::toSatang() เท่านั้น (จุดเดียวที่อนุญาตแตะเงินดิบ)
//
// ⚠️ สมมติฐาน (ต้องให้ทีมยืนยัน): comment ใน transaction.service.ts แนะนำให้ข้อความแชทแปลงผ่าน
// utils/thaiNumber.ts::parseThaiNumber แทน — แต่ regexParser.ts ปัจจุบันคืนตัวเลขอารบิกดิบ
// (ไม่ใช่คำอ่านไทยแบบ "แปดสิบบาท") จึงยังไม่จำเป็นต้องผ่าน thaiNumber.ts สำหรับทางด่วน L1 นี้
// ถ้าทีมตั้งใจจะรวม regexParser.ts เข้ากับ thaiNumber.ts ทีหลัง (เช่นให้ L1 รองรับคำอ่านไทยด้วย)
// ให้แจ้งแล้วจะปรับจุดนี้ให้เรียก thaiNumber.parseThaiNumber แทน

import { getUserIdByLineUserId } from '../db/queries/users';
import { parseQuickExpenseText } from '../utils/regexParser';
import { createTransaction } from '../services/transaction.service';
import { toSatang, formatBaht } from '../utils/money';
import { replyFlex, replyText } from '../line/reply';
import { buildConfirmCard } from '../line/flex/confirmCard';

type LineTextMessageEvent = {
  replyToken?: string;
  source?: { userId?: string };
  message?: { type: string; text?: string };
};

export async function handleText(event: LineTextMessageEvent): Promise<void> {
  const replyToken = event.replyToken;
  const lineUserId = event.source?.userId;
  const text = event.message?.text;

  if (!replyToken || !lineUserId || !text) {
    console.error('[textHandler] event ไม่มี replyToken/userId/text ครบ');
    return;
  }

  // ⚖️ G6: user_id ที่แท้จริงต้อง query จาก line_user_id ของ event เท่านั้น ห้ามเดา/รับจากที่อื่น
  const userId = await getUserIdByLineUserId(lineUserId);
  if (!userId) {
    await replyText(replyToken, 'ยังไม่พบบัญชีผู้ใช้ครับ ลองแอดเพื่อนบอทใหม่อีกครั้งนะครับ 🙏');
    return;
  }

  const parsed = parseQuickExpenseText(text);

  // parsed.amount = บาทดิบจากที่ผู้ใช้พิมพ์ (G1: ดึงตรงๆ ไม่ประมาณ) — ยังไม่ใช่สตางค์
  if (parsed.confidence !== 'high' || parsed.amount === undefined || !parsed.category) {
    await replyText(
      replyToken,
      'ตอนนี้บอทยังจดได้แค่รูปแบบ "ชื่อ จำนวนเงิน" เช่น "กาแฟ 80" หรือ "+เงินเดือน 35000" นะครับ'
    );
    return;
  }

  try {
    // ⚖️ G3: แปลงบาท -> สตางค์ ที่นี่ที่เดียว ก่อนส่งเข้า createTransaction (contract ใหม่ของ service)
    const amountSatang = toSatang(parsed.amount);

    const tx = await createTransaction({
      userId,
      type: parsed.type ?? 'expense',
      amountSatang,
      categoryName: parsed.category,
      source: 'chat',
      parsedBy: 'regex',
    });

    const confirmCard = buildConfirmCard({
      transactionId: tx.id,
      type: tx.type === 'income' ? 'income' : 'expense',
      categoryName: parsed.category,
      formattedAmount: formatBaht(tx.amountSatang),
    });
    await replyFlex(replyToken, confirmCard);
  } catch (err) {
    console.error('[textHandler] createTransaction error:', err);
    await replyText(replyToken, 'บันทึกไม่สำเร็จ ลองพิมพ์ใหม่อีกครั้งนะครับ 🙏');
  }
}