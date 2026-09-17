// ไฟล์นี้ทำหน้าที่อะไร: test การหา +token จาก header ของอีเมลที่ถูก Gmail forward มา
// ใครรับผิดชอบ: ⑤ Integration
// เขียนในสัปดาห์: W4
// อ้างอิง: SPEC.md §S8 ขั้นตอนที่ 1 (หาเจ้าของจาก token)
// ⚖️ กฎเหล็ก G6 — เจ้าของรายการมาจาก token ในที่อยู่ปลายทาง ไม่ใช่จากชื่อผู้ส่ง
//
// 🔴 ไฟล์นี้เกิดจากบั๊กจริงที่เจอตอนทดสอบกับ Gmail ของจริง: อีเมลธนาคารถูก forward
// เข้ามาถูกที่อยู่แล้ว แต่ถูกข้ามทุกฉบับด้วย "ไม่พบ +token ในที่อยู่ปลายทาง"
// เพราะ Gmail ตัด +<token> ทิ้งจาก Delivered-To (มองว่าเป็นกล่องเดียวกับ user@gmail.com)
// ที่อยู่เต็มไปโผล่ที่ X-Forwarded-To / X-Forwarded-For แทน

import { describe, expect, it } from 'vitest';
import type { ParsedMail } from 'mailparser';
import { findTokenFromHeaders } from '../src/services/email/recipient';

const TOKEN = '04593508be183b6f4b422b6b0a9c5db1';
const BOT = 'jodtang.mfu';
const WITH_TOKEN = `${BOT}+${TOKEN}@gmail.com`;
const WITHOUT_TOKEN = `${BOT}@gmail.com`;
const PERSONAL = 'teerat.won@gmail.com';

/** จำลอง ParsedMail เท่าที่ findTokenFromHeaders ใช้จริง */
function mail(headers: Record<string, string | string[]>, to?: string): ParsedMail {
  return {
    headers: new Map(Object.entries(headers)),
    to: to ? { text: to } : undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe('findTokenFromHeaders — อีเมลที่ Gmail forward มา', () => {
  it('🔴 เคสจริงที่เคยพัง: Delivered-To ถูกตัด +token ทิ้ง แต่ X-Forwarded-To ยังมีอยู่', () => {
    const parsed = mail(
      {
        'delivered-to': WITHOUT_TOKEN, // Gmail normalize ตัด +token ทิ้ง
        'x-forwarded-to': WITH_TOKEN,
        'x-forwarded-for': `${PERSONAL} ${WITH_TOKEN}`,
      },
      PERSONAL // To: ยังเป็นที่อยู่เดิมของผู้ใช้ ไม่มี token
    );
    expect(findTokenFromHeaders(parsed)).toBe(TOKEN);
  });

  it('มีแต่ X-Forwarded-For ก็ยังหาเจอ', () => {
    const parsed = mail({
      'delivered-to': WITHOUT_TOKEN,
      'x-forwarded-for': `${PERSONAL} ${WITH_TOKEN}`,
    });
    expect(findTokenFromHeaders(parsed)).toBe(TOKEN);
  });

  it('ส่งตรงไม่ผ่าน forward: Delivered-To มี +token อยู่แล้ว', () => {
    expect(findTokenFromHeaders(mail({ 'delivered-to': WITH_TOKEN }))).toBe(TOKEN);
  });

  it('เซิร์ฟเวอร์อื่นที่ใช้ X-Original-To', () => {
    expect(findTokenFromHeaders(mail({ 'x-original-to': WITH_TOKEN }))).toBe(TOKEN);
  });

  it('เหลือแค่ To: ที่มี token ก็ยังหาเจอ', () => {
    expect(findTokenFromHeaders(mail({}, WITH_TOKEN))).toBe(TOKEN);
  });

  it('Delivered-To ซ้ำหลายบรรทัด (ปกติของอีเมล forward) — ต้องหาเจอในบรรทัดที่มี token', () => {
    const parsed = mail({ 'delivered-to': [PERSONAL, WITH_TOKEN] });
    expect(findTokenFromHeaders(parsed)).toBe(TOKEN);
  });

  it('ไม่มี token ที่ไหนเลย → null ไม่ใช่เดาเอาจากผู้รับคนแรก', () => {
    const parsed = mail(
      { 'delivered-to': WITHOUT_TOKEN, 'x-forwarded-to': WITHOUT_TOKEN },
      PERSONAL
    );
    expect(findTokenFromHeaders(parsed)).toBeNull();
  });

  it('อีเมลเปล่าไม่มี header เลย → null ไม่ throw', () => {
    expect(findTokenFromHeaders(mail({}))).toBeNull();
  });

  it('⚖️ G6: ไม่หยิบ token จาก From — ผู้ส่งปลอมที่อยู่ตัวเองได้', () => {
    const parsed = mail(
      { from: WITH_TOKEN, 'delivered-to': WITHOUT_TOKEN },
      PERSONAL
    );
    expect(findTokenFromHeaders(parsed)).toBeNull();
  });
});
