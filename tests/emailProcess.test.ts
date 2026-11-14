// ไฟล์นี้ทำหน้าที่อะไร: test การประมวลผลอีเมลธนาคารหนึ่งฉบับ (processMessage) โดยไม่ต่อ IMAP จริง
// ใครรับผิดชอบ: ⑤ Integration
// อ้างอิง: SPEC.md §S8 Email Ingestion + §S10 Dedup
// ⚖️ กฎเหล็ก G6
//
// 🔴 สองข้อที่เทสต์ชุดนี้ต้องพิสูจน์ให้ได้:
//   1. รอบก่อนพังกลางทางหลังบันทึกอีเมลไปแล้ว รอบถัดไปต้องสร้างรายการเงินให้ ไม่ใช่ข้ามเงียบๆ
//   2. header Authentication-Results ที่ผู้ส่งแนบมาเอง ต้องไม่ทำให้อีเมลปลอมกลายเป็นรายการเงิน

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { simpleParser } from 'mailparser';

vi.mock('../src/db/queries/users', () => ({ getUserByEmailToken: vi.fn() }));
vi.mock('../src/db/queries/emails', () => ({
  findUserEmail: vi.fn(),
  insertUserEmail: vi.fn(),
  markEmailParsed: vi.fn(),
}));
vi.mock('../src/db/queries/transactions', () => ({ backfillRefNumber: vi.fn() }));
vi.mock('../src/services/transaction.service', () => ({ createTransaction: vi.fn() }));
vi.mock('../src/services/budget.service', () => ({ formatBudgetAlert: vi.fn() }));
vi.mock('../src/line/push', () => ({ sendPush: vi.fn() }));
vi.mock('../src/services/dedup.service', () => ({ checkDuplicate: vi.fn() }));
vi.mock('../src/services/email/banks', () => ({
  ALL_BANK_DKIM_DOMAINS: ['kasikornbank.com'],
  findBankParser: vi.fn(),
}));

import { getUserByEmailToken } from '../src/db/queries/users';
import { findUserEmail, insertUserEmail, markEmailParsed } from '../src/db/queries/emails';
import { createTransaction } from '../src/services/transaction.service';
import { checkDuplicate } from '../src/services/dedup.service';
import { findBankParser } from '../src/services/email/banks';
import { processMessage } from '../src/services/email.service';

const TOKEN = '04593508be183b6f4b422b6b0a9c5db1';
const USER_ID = 'user-1';
const MESSAGE_ID = '<kplus-0001@kasikornbank.com>';
const REAL_DKIM = 'Authentication-Results: mx.google.com; dkim=pass header.i=@kasikornbank.com';

const PARSED = {
  type: 'expense' as const,
  amountSatang: 12050,
  occurredAt: new Date('2026-10-06T07:32:00.000Z'),
  refNumber: '016279123456ABC00001',
  label: 'โอนเงินพร้อมเพย์',
};

/** ประกอบอีเมลดิบแล้วให้ mailparser ตัวจริงอ่าน — header อยู่ตามลำดับที่ส่งเข้ามา (บนลงล่าง) */
async function mail(authHeaders: string[]) {
  return simpleParser(
    [
      `Delivered-To: jodtang+${TOKEN}@gmail.com`,
      ...authHeaders,
      'From: K PLUS <KPLUS@kasikornbank.com>',
      `Message-ID: ${MESSAGE_ID}`,
      'Subject: Result of PromptPay Funds Transfer (Success)',
      '',
      'body',
    ].join('\r\n')
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getUserByEmailToken).mockResolvedValue({ id: USER_ID, is_active: true } as never);
  vi.mocked(findBankParser).mockReturnValue({
    bank: 'kbank',
    parse: () => PARSED,
  } as never);
  vi.mocked(checkDuplicate).mockResolvedValue({ kind: 'unique' });
  vi.mocked(createTransaction).mockResolvedValue({ id: 'tx-1', budgetAlert: null } as never);
});

describe('processMessage — เส้นปกติ', () => {
  it('อีเมลใหม่ที่อ่านครบ → สร้างรายการแล้วผูกกับอีเมล', async () => {
    vi.mocked(insertUserEmail).mockResolvedValue({ id: 'email-1', parsed: false });

    expect(await processMessage(await mail([REAL_DKIM]))).toBe('created');

    expect(createTransaction).toHaveBeenCalledTimes(1);
    expect(createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        amountSatang: 12050,
        source: 'email',
        refNumber: PARSED.refNumber,
      })
    );
    expect(markEmailParsed).toHaveBeenCalledWith('email-1', 'tx-1');
    expect(findUserEmail).not.toHaveBeenCalled();
  });
});

describe('processMessage — รอบก่อนพังกลางทาง', () => {
  it('🔴 เคสที่เคยทำรายการหาย: อีเมลถูกบันทึกไว้แล้วแต่ยังไม่มีรายการ → ต้องสร้างรายการให้', async () => {
    // insert ชนของเดิม เพราะรอบก่อนบันทึกอีเมลสำเร็จ แล้วไปพังตอน createTransaction
    vi.mocked(insertUserEmail).mockResolvedValue(null);
    vi.mocked(findUserEmail).mockResolvedValue({ id: 'email-1', parsed: false });

    expect(await processMessage(await mail([REAL_DKIM]))).toBe('created');

    expect(findUserEmail).toHaveBeenCalledWith(USER_ID, MESSAGE_ID);
    expect(createTransaction).toHaveBeenCalledTimes(1);
    expect(markEmailParsed).toHaveBeenCalledWith('email-1', 'tx-1');
  });

  it('รอบก่อนสร้างรายการไปแล้วแต่พังก่อนผูกอีเมล → ไม่สร้างซ้ำ แค่ผูกกับรายการเดิม', async () => {
    vi.mocked(insertUserEmail).mockResolvedValue(null);
    vi.mocked(findUserEmail).mockResolvedValue({ id: 'email-1', parsed: false });
    vi.mocked(checkDuplicate).mockResolvedValue({ kind: 'exact', transactionId: 'tx-old' });

    expect(await processMessage(await mail([REAL_DKIM]))).toBe('duplicate');

    expect(createTransaction).not.toHaveBeenCalled();
    expect(markEmailParsed).toHaveBeenCalledWith('email-1', 'tx-old');
  });

  it('อีเมลที่ทำจบไปแล้วจริง (parsed=true) → ข้าม ไม่แตะรายการเงิน', async () => {
    vi.mocked(insertUserEmail).mockResolvedValue(null);
    vi.mocked(findUserEmail).mockResolvedValue({ id: 'email-1', parsed: true });

    expect(await processMessage(await mail([REAL_DKIM]))).toBe('skipped');

    expect(checkDuplicate).not.toHaveBeenCalled();
    expect(createTransaction).not.toHaveBeenCalled();
    expect(markEmailParsed).not.toHaveBeenCalled();
  });
});

describe('processMessage — อีเมลปลอม', () => {
  it('🔴 ผู้ส่งแนบ Authentication-Results ปลอมมาเอง (อยู่ใต้ของ Gmail) → ข้าม ไม่บันทึกอะไรเลย', async () => {
    const forged = await mail([
      'Authentication-Results: mx.google.com; dkim=pass header.i=@attacker.example',
      'Authentication-Results: mx.google.com; dkim=pass header.i=@kasikornbank.com',
    ]);

    expect(await processMessage(forged)).toBe('skipped');

    expect(insertUserEmail).not.toHaveBeenCalled();
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it('header ที่ไม่ได้เขียนโดย Gmail → ข้าม', async () => {
    const forged = await mail([
      'Authentication-Results: mail.attacker.example; dkim=pass header.i=@kasikornbank.com',
    ]);

    expect(await processMessage(forged)).toBe('skipped');
    expect(insertUserEmail).not.toHaveBeenCalled();
  });
});
