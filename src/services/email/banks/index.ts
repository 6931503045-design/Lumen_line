// ไฟล์นี้ทำหน้าที่อะไร: ทะเบียน parser ของธนาคารทั้งหมด และตัวเลือกว่าอีเมลฉบับนี้เป็นของเจ้าไหน
// ใครรับผิดชอบ: ⑤ Integration
// เขียนในสัปดาห์: W4
// อ้างอิง: SPEC.md §S8
//
// เพิ่มธนาคารใหม่ = เขียนไฟล์ใน banks/ แล้วใส่ชื่อในอาร์เรย์ข้างล่าง ไม่ต้องแตะ email.service.ts

import { kbankParser } from './kbank';
import type { BankEmailParser } from './types';

export const BANK_PARSERS: readonly BankEmailParser[] = [kbankParser];

/** โดเมนทั้งหมดที่ยอมรับใน DKIM รวมทุกธนาคาร */
export const ALL_BANK_DKIM_DOMAINS: readonly string[] = BANK_PARSERS.flatMap(
  (parser) => [...parser.dkimDomains]
);

/** หา parser ที่ตรงกับอีเมลฉบับนี้ คืน null ถ้าไม่ใช่อีเมลธนาคารที่รองรับ */
export function findBankParser(
  fromAddress: string,
  subject: string,
  text: string
): BankEmailParser | null {
  return BANK_PARSERS.find((parser) => parser.matches(fromAddress, subject, text)) ?? null;
}

export type { BankEmailParseResult, BankEmailParser } from './types';
