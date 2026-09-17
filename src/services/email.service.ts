// ไฟล์นี้ทำหน้าที่อะไร: ดึงอีเมลธนาคารทาง IMAP แล้วแปลงเป็นรายการเงินของผู้ใช้ที่ถูกคน
// ใครรับผิดชอบ: ⑤ Integration
// เขียนในสัปดาห์: W4
// อ้างอิง: SPEC.md §S8 Email Ingestion (ลำดับ 6 ขั้นตอนด้านล่างตรงกับผังใน SPEC)
// ⚖️ กฎเหล็ก G1, G3, G5, G6
//
// G1 — "ใช้ regex เท่านั้น ไม่ใช้ AI กับอีเมล" (SPEC §S8) ไฟล์นี้ไม่ import อะไรจาก services/ai เลย
// G5 — เนื้ออีเมลผ่าน redactSensitiveText() ก่อนเขียนลง DB ทุกฉบับ
// G6 — เจ้าของรายการมาจาก token ในที่อยู่ปลายทาง ไม่ใช่จากชื่อผู้ส่งหรือเนื้อความ
//
// ลำดับตาม SPEC:
//   1. อ่าน token จากที่อยู่ปลายทาง (+token) -> หา user  -> ไม่เจอ/ไม่ active: ข้าม
//   2. ตรวจ DKIM ว่าลงนามโดยโดเมนธนาคาร          -> ไม่ผ่าน: ข้าม
//   3. Message-ID ซ้ำใน user_emails               -> ข้าม
//   4. plain text -> redact -> บันทึก user_emails
//   5. regex ของธนาคารนั้น -> ไม่ครบ: parsed=false / ครบ: S10 dedup
//   6. mark อีเมลว่าอ่านแล้ว

import { ImapFlow } from 'imapflow';
import { simpleParser, type ParsedMail } from 'mailparser';
import { env } from '../config/env';
import { redactSensitiveText } from '../utils/redact';
import { logger } from '../utils/logger';
import { getUserByEmailToken } from '../db/queries/users';
import { insertUserEmail, markEmailParsed } from '../db/queries/emails';
import { backfillRefNumber } from '../db/queries/transactions';
import { createTransaction } from './transaction.service';
import { formatBudgetAlert } from './budget.service';
import { sendPush } from '../line/push';
import { checkDuplicate } from './dedup.service';
import { ALL_BANK_DKIM_DOMAINS, findBankParser } from './email/banks';
import { checkBankDkim } from './email/dkim';
import {
  describeTokenHeaders,
  findTokenFromHeaders,
  headerValue,
} from './email/recipient';

const IMAP_HOST = 'imap.gmail.com';
const IMAP_PORT = 993;

/** ดึงสูงสุดกี่ฉบับต่อการรันหนึ่งครั้ง — กัน job ค้างยาวถ้ากล่องจดหมายบวม */
const MAX_MESSAGES_PER_RUN = 50;

export type EmailPollResult = {
  /**
   * จำนวนอีเมลทั้งหมดใน INBOX ของกล่องกลาง (ไม่ใช่ของผู้ใช้คนใดคนหนึ่ง)
   *
   * มีไว้ไล่ปัญหาอย่างเดียว: แยกให้ออกระหว่าง "อีเมลไม่เคยมาถึงกล่อง" (inboxTotal ไม่เพิ่ม)
   * กับ "มาถึงแล้วแต่ถูกอ่านไปแล้ว" (inboxTotal เพิ่ม แต่ unseen = 0) — สองอย่างนี้
   * เดิมหน้าตาเหมือนกันหมดคือ fetched: 0 ทำให้ต้องเดาว่าปัญหาอยู่ฝั่งไหน
   */
  inboxTotal: number;
  /** จำนวนอีเมลที่ยังไม่ถูกอ่านใน INBOX — job หยิบเฉพาะกลุ่มนี้ */
  unseen: number;
  /** อ่านมากี่ฉบับ (เท่ากับ unseen เว้นแต่ชน MAX_MESSAGES_PER_RUN) */
  fetched: number;
  /** สร้างรายการใหม่สำเร็จกี่ฉบับ */
  created: number;
  /** ตรวจพบว่าซ้ำกับรายการเดิม ไม่ได้สร้างใหม่ */
  duplicates: number;
  /** บันทึกไว้แล้วแต่ parse ไม่ออก (parsed=false) */
  unparsed: number;
  /** ข้ามไปเลย: ไม่มี token / DKIM ไม่ผ่าน / เคยอ่านแล้ว / ไม่ใช่ธนาคารที่รองรับ */
  skipped: number;
};

const EMPTY_RESULT: EmailPollResult = {
  inboxTotal: 0,
  unseen: 0,
  fetched: 0,
  created: 0,
  duplicates: 0,
  unparsed: 0,
  skipped: 0,
};

/** ประมวลผลอีเมลหนึ่งฉบับ คืนผลว่าจัดอยู่ในหมวดไหนของ EmailPollResult */
async function processMessage(
  mail: ParsedMail
): Promise<'created' | 'duplicate' | 'unparsed' | 'skipped'> {
  // ── 1. หาเจ้าของจาก token ────────────────────────────────────────────────
  const token = findTokenFromHeaders(mail);
  if (!token) {
    logger.warn(
      `[email] ข้าม: ไม่พบ +token ในที่อยู่ปลายทาง (${describeTokenHeaders(mail)})`
    );
    return 'skipped';
  }

  const owner = await getUserByEmailToken(token);
  if (!owner || !owner.is_active) {
    logger.warn('[email] ข้าม: token ไม่ตรงกับผู้ใช้ที่ใช้งานอยู่');
    return 'skipped';
  }

  const fromAddress = mail.from?.text ?? '';
  const subject = mail.subject ?? '';
  const text = mail.text ?? '';

  // ── 2. ตรวจ DKIM ก่อนเชื่ออะไรในอีเมลนี้ ─────────────────────────────────
  const dkim = checkBankDkim(headerValue(mail, 'authentication-results'), ALL_BANK_DKIM_DOMAINS);
  if (!dkim.passed) {
    logger.warn(
      `[email] ข้าม: DKIM ไม่ผ่านโดเมนธนาคาร (ลงนามโดย: ${dkim.signedBy.join(', ') || 'ไม่มี'})`
    );
    return 'skipped';
  }

  const messageId = mail.messageId;
  if (!messageId) {
    logger.warn('[email] ข้าม: อีเมลไม่มี Message-ID จึงกันซ้ำไม่ได้');
    return 'skipped';
  }

  // ── 3 + 4. กันซ้ำด้วย Message-ID แล้วบันทึกเนื้อที่ปิดข้อมูลส่วนตัวแล้ว ───────
  // insert ทำหน้าที่ทั้งกันซ้ำและบันทึกในคำสั่งเดียว: ถ้าชน unique = เคยอ่านแล้ว
  const received = mail.date ?? new Date();
  const stored = await insertUserEmail({
    userId: owner.id,
    messageId,
    bodyRedacted: redactSensitiveText(text),
    receivedAt: received,
  });

  if (!stored) {
    return 'skipped'; // เคยอ่านฉบับนี้ไปแล้ว
  }

  // ── 5. อ่านรายละเอียดด้วย regex ของธนาคารนั้น ─────────────────────────────
  const parser = findBankParser(fromAddress, subject, text);
  if (!parser) {
    logger.warn('[email] บันทึกไว้แต่ยังไม่รองรับธนาคารนี้');
    return 'unparsed';
  }

  const parsed = parser.parse(text);
  if (!parsed) {
    // อ่านไม่ครบ — เก็บ body_redacted ไว้แล้ว กลับมา parse ใหม่ได้เมื่อแก้ pattern
    logger.warn(`[email] บันทึกไว้แต่ parse ไม่ออก (${parser.bank})`);
    return 'unparsed';
  }

  const occurredAt = parsed.occurredAt ?? received;

  const verdict = await checkDuplicate({
    userId: owner.id,
    type: parsed.type,
    amountSatang: parsed.amountSatang,
    occurredAt,
    refNumber: parsed.refNumber,
  });

  if (verdict.kind !== 'unique') {
    // SPEC §S10: อีเมลที่ซ้ำ "ไม่สร้าง + ใส่ matched_transaction_id"
    // และกรณี "น่าจะซ้ำ" ให้เติม ref_number ให้รายการเดิมด้วย เพื่อให้ครั้งหน้าตรวจเจอแบบแม่นยำ
    if (verdict.kind === 'probable' && parsed.refNumber && !verdict.existingRefNumber) {
      await backfillRefNumber(verdict.transactionId, owner.id, parsed.refNumber);
    }
    await markEmailParsed(stored.id, verdict.transactionId);
    return 'duplicate';
  }

  // note = ชื่อประเภทรายการที่ธนาคารเขียนมาเอง เช่น "โอนเงินพร้อมเพย์"
  // ไม่ใช่การเดา (G1) — ถ้าอ่านไม่เจอจะเป็น null แล้วรายการขึ้นว่า "ไม่ระบุ" ตามเดิม
  //
  // ยังไม่ส่ง categoryName เพราะอีเมลธนาคารไม่ได้บอกว่าเงินไปเป็นค่าอะไร
  // ผลข้างเคียงที่ต้องรู้: รายการจากอีเมลจึงไม่มีหมวด และจะไม่ไปกระตุ้นการเตือนงบรายหมวด (S5.8)
  // จนกว่าจะมีตัวเดาหมวดจากชื่อปลายทาง (S4 keyword/learned) มาเสียบตรงนี้
  const transaction = await createTransaction({
    userId: owner.id,
    type: parsed.type,
    amountSatang: parsed.amountSatang,
    note: parsed.label ?? undefined,
    occurredAt,
    source: 'email',
    parsedBy: 'regex',
    refNumber: parsed.refNumber,
  });

  // S5.8: รายการจากอีเมลไม่มี reply ให้แนบคำเตือนงบไปด้วย ต้อง push แทน
  // dedup_key ผูกกับหมวด+เดือน+ระดับ เพื่อให้เตือนระดับละครั้งเดียวต่อเดือนตาม SPEC
  // (ธงใน budgets กันไว้ชั้นหนึ่งแล้ว อันนี้กันซ้ำอีกชั้นเผื่อ job รันพร้อมกัน)
  if (transaction.budgetAlert) {
    const alert = transaction.budgetAlert;
    const month = occurredAt.toISOString().slice(0, 7);
    await sendPush(
      owner.id,
      alert.threshold === 100 ? 'budgetOver' : 'budgetWarning',
      `budget${alert.threshold}:${month}:${alert.categoryId}`,
      formatBudgetAlert(alert)
    ).catch((err) => {
      // ส่งเตือนไม่ได้ ต้องไม่ทำให้รายการที่บันทึกสำเร็จแล้วกลายเป็นล้มเหลว
      logger.error('[email] ส่งคำเตือนงบไม่สำเร็จ (รายการถูกบันทึกแล้ว):', err);
    });
  }

  await markEmailParsed(stored.id, transaction.id);
  return 'created';
}

/**
 * รอบการดึงอีเมลหนึ่งรอบ — เรียกจาก jobs/emailPoll.ts
 * ไม่โยน error ออกไปถ้าอีเมลฉบับใดฉบับหนึ่งพัง เพื่อให้ฉบับที่เหลือยังถูกประมวลผล
 */
export async function pollBankEmails(): Promise<EmailPollResult> {
  if (!env.gmailUser || !env.gmailAppPassword) {
    logger.warn('[email] ข้ามการดึงอีเมล: ยังไม่ได้ตั้ง GMAIL_USER / GMAIL_APP_PASSWORD');
    return { ...EMPTY_RESULT };
  }

  const result: EmailPollResult = { ...EMPTY_RESULT };

  const client = new ImapFlow({
    host: IMAP_HOST,
    port: IMAP_PORT,
    secure: true,
    auth: { user: env.gmailUser, pass: env.gmailAppPassword },
    logger: false,
  });

  await client.connect();
  const lock = await client.getMailboxLock('INBOX');

  try {
    // นับจำนวนทั้งกล่องไว้ก่อน เพื่อให้ผลลัพธ์บอกได้ว่า "ไม่มีอีเมลเข้ามาเลย" ต่างจาก
    // "เข้ามาแล้วแต่ถูกอ่านไปแล้ว" — mailbox.exists มาจาก SELECT ตอน getMailboxLock
    // จึงไม่เสีย round-trip เพิ่ม
    result.inboxTotal =
      typeof client.mailbox === 'object' ? (client.mailbox.exists ?? 0) : 0;

    const unseenUids = await client.search({ seen: false }, { uid: true });
    result.unseen = (unseenUids || []).length;
    const uids = (unseenUids || []).slice(0, MAX_MESSAGES_PER_RUN);

    for (const uid of uids) {
      result.fetched += 1;
      try {
        const message = await client.fetchOne(String(uid), { source: true }, { uid: true });
        if (!message || !message.source) {
          result.skipped += 1;
          continue;
        }

        const mail = await simpleParser(message.source);
        const outcome = await processMessage(mail);

        if (outcome === 'created') result.created += 1;
        else if (outcome === 'duplicate') result.duplicates += 1;
        else if (outcome === 'unparsed') result.unparsed += 1;
        else result.skipped += 1;

        // ── 6. mark ว่าอ่านแล้ว เพื่อไม่ให้รอบถัดไปหยิบซ้ำ ──────────────────
        await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true });
      } catch (err) {
        // ฉบับนี้พังก็ปล่อยไว้ให้ยังไม่อ่าน รอบหน้าจะลองใหม่ และอย่าให้ฉบับอื่นพังตาม
        result.skipped += 1;
        logger.error('[email] ประมวลผลอีเมลฉบับหนึ่งไม่สำเร็จ:', err);
      }
    }
  } finally {
    lock.release();
    await client.logout().catch(() => undefined);
  }

  logger.info('[email] รอบการดึงอีเมลจบ:', result);
  return result;
}
