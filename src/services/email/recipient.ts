// ไฟล์นี้ทำหน้าที่อะไร: หาว่าอีเมลฉบับนี้ถูกส่งมาถึง +token ของใคร จาก header ของอีเมล
// ใครรับผิดชอบ: ⑤ Integration
// เขียนในสัปดาห์: W4
// อ้างอิง: SPEC.md §S8 ขั้นตอนที่ 1 (หาเจ้าของจาก token)
// ⚖️ กฎเหล็ก G5, G6
//
// G6 — เจ้าของรายการมาจาก "ที่อยู่ปลายทาง" เท่านั้น ห้ามดูจาก From หรือเนื้อความ
//      เพราะสองอย่างนั้นผู้ส่งกำหนดเองได้
//
// แยกออกมาจาก email.service.ts เพื่อให้ test ได้โดยไม่ต้องโหลด config/env
// (email.service ต่อ IMAP จริง จึงต้องการ env ครบตั้งแต่ตอน import)

import type { ParsedMail } from 'mailparser';

/**
 * แปลงค่า header หนึ่งตัวเป็นข้อความ
 *
 * 🔴 แก้บั๊ก: mailparser ไม่ได้คืน string เสมอ — header ที่เป็นที่อยู่อีเมล (Delivered-To, To ฯลฯ)
 * ถูกแปลงเป็น object `{ value, html, text }` ให้แล้ว เดิมใช้ String() ตรงๆ จึงได้ "[object Object]"
 * ทำให้หา +token จาก Delivered-To ไม่เคยเจอเลยกับอีเมลจริง (เทสต์เดิมจำลอง header เป็น string
 * จึงมองไม่เห็น) อีเมลที่ forward มายังรอดเพราะ X-Forwarded-To เป็น string ธรรมดา
 */
function headerText(value: unknown): string {
  if (value && typeof value === 'object' && typeof (value as { text?: unknown }).text === 'string') {
    return (value as { text: string }).text;
  }
  return String(value);
}

/** ดึงค่า header ตัวเดียวออกมาเป็น string (mailparser คืน array ได้ถ้ามีซ้ำ) */
export function headerValue(mail: ParsedMail, name: string): string | undefined {
  const raw: unknown = mail.headers.get(name);
  if (!raw) return undefined;
  if (Array.isArray(raw)) return raw.map(headerText).join(' ');
  return headerText(raw);
}

/**
 * ค่าของ header ตัว "บนสุด" ตัวเดียว เมื่อ header ชื่อนี้มีหลายตัวในอีเมล
 *
 * 🔒 ใช้กับ header ที่ต้องรู้ว่าใครเป็นคนเขียน เช่น Authentication-Results
 * เซิร์ฟเวอร์ที่รับอีเมลเติม header ของตัวเองไว้บนสุดเสมอ ตัวที่อยู่ต่ำกว่าอาจเป็นของที่
 * ผู้ส่งแนบมาเอง จึงห้ามใช้ headerValue() ที่เอาทุกตัวมาต่อกันกับ header แบบนี้
 * (mailparser เรียง array ตามลำดับในอีเมลจากบนลงล่าง — มีเทสต์ยืนยันใน emailDkim.test.ts)
 */
export function topHeaderValue(mail: ParsedMail, name: string): string | undefined {
  const raw: unknown = mail.headers.get(name);
  if (!raw) return undefined;
  const first: unknown = Array.isArray(raw) ? raw[0] : raw;
  return first === undefined || first === null ? undefined : headerText(first);
}

/**
 * ดึง token จากที่อยู่ปลายทางแบบ plus-addressing
 * "jodtang+a1b2c3@gmail.com" -> "a1b2c3" / ไม่มี + ก็คืน null
 */
export function extractIngestToken(address: string | undefined): string | null {
  if (!address) return null;
  const match = /\+([A-Za-z0-9]+)@/.exec(address);
  return match?.[1] ?? null;
}

/** header ทุกตัวที่อาจมีที่อยู่ปลายทางแบบ +token ติดอยู่ เรียงตามความน่าเชื่อถือ */
const TOKEN_HEADERS = [
  // Gmail เขียนสองตัวนี้ตอน forward ด้วย filter และเก็บที่อยู่ปลายทาง "ตามที่ผู้ใช้ตั้งไว้"
  // ซึ่งรวม +token ด้วย
  'x-forwarded-to',
  'x-forwarded-for',
  // Delivered-To เชื่อได้เมื่อธนาคารส่งตรง แต่หลัง Gmail forward มันจะเหลือแค่ชื่อบัญชี
  // เพราะ Gmail มองว่า user+alias@gmail.com กับ user@gmail.com คือกล่องเดียวกัน
  'delivered-to',
  'x-original-to',
] as const;

/**
 * ที่อยู่ปลายทางที่มี +token อยู่
 *
 * 🔴 แก้บั๊ก: เดิมดูแค่ Delivered-To / X-Original-To / To แล้วอีเมลที่ถูก Gmail forward มา
 * ถูกข้ามทุกฉบับด้วยเหตุผล "ไม่พบ +token ในที่อยู่ปลายทาง" ทั้งที่ forward ถูกที่อยู่แล้ว
 * สาเหตุคือ Gmail ตัด +<token> ทิ้งจาก Delivered-To ส่วนที่อยู่เต็มที่ผู้ใช้ตั้งไว้
 * ไปโผล่ที่ X-Forwarded-To / X-Forwarded-For แทน
 */
export function findTokenFromHeaders(mail: ParsedMail): string | null {
  const candidates: (string | undefined)[] = TOKEN_HEADERS.map((name) =>
    headerValue(mail, name)
  );
  candidates.push(mail.to && !Array.isArray(mail.to) ? mail.to.text : undefined);

  for (const candidate of candidates) {
    const token = extractIngestToken(candidate);
    if (token) return token;
  }
  return null;
}

/**
 * สรุปว่า header ไหนมีค่าอยู่บ้างตอนหา token ไม่เจอ — ไว้ไล่ปัญหาโดยไม่ต้องเปิดอีเมลดูเอง
 *
 * ⚖️ G5: ไม่ log ที่อยู่อีเมลเต็มๆ บอกแค่ว่า header นั้น "มี/ไม่มี" และ "มี + หรือเปล่า"
 * เท่านี้พอให้แยกออกว่าเป็นเรื่อง Gmail ตัด token ทิ้ง หรือ forward ผิดที่อยู่ตั้งแต่ต้น
 */
export function describeTokenHeaders(mail: ParsedMail): string {
  const parts = [...TOKEN_HEADERS, 'to'].map((name) => {
    const value =
      name === 'to'
        ? mail.to && !Array.isArray(mail.to)
          ? mail.to.text
          : undefined
        : headerValue(mail, name);
    if (value === undefined) return `${name}=ไม่มี`;
    return `${name}=${value.includes('+') ? 'มี +' : 'ไม่มี +'}`;
  });
  return parts.join(', ');
}
