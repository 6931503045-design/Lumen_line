// ไฟล์นี้ทำหน้าที่อะไร: test การจับคำถาม "ทำยังไง" แบบตายตัว และคำตอบจากคู่มือ
// ใครรับผิดชอบ: ① Bot Core
// ⚖️ กฎเหล็ก G1, G4
//
// จุดที่ต้องพิสูจน์มีสองฝั่ง:
//   • คำถามวิธีใช้ที่พบบ่อยต้องได้หัวข้อที่ถูก (ไม่ต้องรอ AI ไม่เปลืองโควตา)
//   • ข้อความที่ไม่ใช่คำถามวิธีใช้ต้องไม่ถูกแย่งไป โดยเฉพาะการจดเงินและ "ซื้อได้ไหม"

import { describe, expect, it } from 'vitest';
import { HELP_TOPICS, HELP_TOPIC_ANSWERS } from '../src/config/helpTopics';
import { answerHelpTopic, matchHelpQuestion } from '../src/services/help.service';

describe('matchHelpQuestion — คำถามที่ต้องจับได้', () => {
  it.each([
    ['ตั้งงบยังไง', 'budget'],
    ['ตั้ง งบ ยังไง', 'budget'],
    ['ตั้งงบหมวดอาหารยังไงครับ', 'budget'],
    ['ลบรายการยังไง', 'edit_delete'],
    ['จดผิดทำไงดี', 'edit_delete'],
    ['ลบแผนยังไง', 'plans'],
    ['ออมเงินเข้าแผนทำยังไง', 'plans'],
    ['ส่งสลิปได้ไหม', 'slip'],
    ['เชื่อมอีเมลธนาคารยังไง', 'bank_email'],
    ['ตั้ง email forward ตรงไหน', 'bank_email'],
    ['ปิด AI ยังไง', 'ai_off'],
    ['ตั้งเงินเดือนทุกเดือนยังไง', 'recurring'],
    ['จดรายรับยังไง', 'income'],
    ['หารบิลกับเพื่อนยังไง', 'split_bill'],
    ['เพิ่มหมวดได้ไหม', 'categories'],
    ['เปิดสรุปรายวันตรงไหน', 'daily_summary'],
    ['เข้าเว็บยังไง', 'web'],
    ['ใช้ยังไง', 'basics'],
    ['จดย้อนหลังได้ไหม', 'basics'],
    ['ลืมจดเมื่อวานทำไงดี', 'basics'],
  ])('"%s" → %s', (text, topic) => {
    expect(matchHelpQuestion(text)).toBe(topic);
  });
});

describe('matchHelpQuestion — ข้อความที่ห้ามแย่งไป', () => {
  it.each([
    // มีตัวเลข = อาจเป็นการจดเงินหรือจำลองการซื้อ ต้องไปทางนั้น
    'ซื้อหูฟัง 1500 ได้ไหม',
    'ค่าหอ 3500 ทุกวันที่ 1',
    'งบ ๕๐๐ ยังไง',
    // ไม่ได้ถามวิธี
    'ค่าหอเดือนนี้',
    'เมื่อวานกินข้าวกับเพื่อน',
    'ลบรายการล่าสุด',
    // ถามวิธีแต่ไม่ตรงหัวข้อไหน — ปล่อยให้ AI ตัดสิน
    'ซื้อรองเท้าได้ไหม',
    'อากาศเป็นยังไง',
  ])('"%s" → null', (text) => {
    expect(matchHelpQuestion(text)).toBeNull();
  });

  it('"email" ไม่ถูกอ่านเป็นหัวข้อ AI เพราะมีตัว ai อยู่ข้างใน', () => {
    expect(matchHelpQuestion('email ใช้ยังไง')).toBe('bank_email');
  });
});

describe('answerHelpTopic', () => {
  it('ทุกหัวข้อมีคำตอบ และบอกทางไปดูวิธีใช้ทั้งหมด', () => {
    for (const topic of HELP_TOPICS) {
      expect(HELP_TOPIC_ANSWERS[topic].length).toBeGreaterThan(0);
      expect(answerHelpTopic(topic)).toContain('ช่วยเหลือ');
    }
  });
});
