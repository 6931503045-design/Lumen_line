// ไฟล์นี้ทำหน้าที่อะไร: ตอบคำถาม "ทำยังไง" เกี่ยวกับการใช้แอป จากคู่มือที่ทีมเขียนเอง
// ใครรับผิดชอบ: ① Bot Core
// ⚖️ กฎเหล็ก G1, G4
//
// มีสองทางเข้า ใช้คำตอบชุดเดียวกัน (config/helpTopics.ts):
//   1. matchHelpQuestion — จับแบบตายตัว ไม่ใช้ AI ทำงานได้แม้ AI_ENABLED=false (⚖️ G4)
//   2. tool explain_feature — AI เลือกหัวข้อให้เมื่อผู้ใช้ถามด้วยคำที่ข้อ 1 จับไม่ได้
//
// 🔴 ทางที่ 1 ต้อง "ไม่แย่งงาน" ทางอื่น จึงจับเฉพาะข้อความที่:
//   • ไม่มีตัวเลขเลย — ข้อความที่มีตัวเลขอาจเป็นการจดเงินหรือ "ซื้อหูฟัง 1500 ได้ไหม"
//     ซึ่งต้องไปถึง simulate_purchase ไม่ใช่ได้คู่มือกลับไป
//   • มีคำบอกว่า "ถามวิธี" (ยังไง / วิธี / ได้ไหม ...) — "ค่าหอ" เฉย ๆ ไม่ใช่คำถาม
//   • ตรงหัวข้อใดหัวข้อหนึ่ง — ถามวิธีแต่ไม่ตรงหัวข้อ ปล่อยให้ AI ตัดสินใจต่อ

import { env } from '../config/env';
import {
  HELP_TOPIC_ANSWERS,
  HELP_TOPIC_PATTERNS,
  type HelpTopic,
} from '../config/helpTopics';

/** คำที่บอกว่าผู้ใช้กำลังถามวิธีทำ ไม่ใช่สั่งให้ทำ */
const HOW_TO_MARKER =
  /ยังไง|ยังงัย|ยังไร|อย่างไร|ทำไง|ไงดี|วิธี|ตรงไหน|ที่ไหน|ได้ไหม|ได้มั้ย|ได้มั๊ย|ได้หรือเปล่า|ได้รึเปล่า|ได้ป่าว|คืออะไร|ใช้ไม่เป็น|ทำไม่เป็น|ไม่รู้จะ|how/;

/**
 * ข้อความนี้เป็นคำถามวิธีใช้หัวข้อไหน — null ถ้าไม่ใช่หรือไม่มั่นใจ
 *
 * เทียบหลังตัดช่องว่างทั้งหมดและแปลงเป็นตัวเล็ก เพราะภาษาไทยเว้นวรรคไม่แน่นอน
 * ("ตั้ง งบ ยังไง" กับ "ตั้งงบยังไง" ต้องได้ผลเดียวกัน)
 */
export function matchHelpQuestion(text: string): HelpTopic | null {
  if (/[0-9๐-๙]/.test(text)) return null;

  const normalized = text.toLowerCase().replace(/\s+/g, '');
  if (!normalized || !HOW_TO_MARKER.test(normalized)) return null;

  for (const [topic, pattern] of HELP_TOPIC_PATTERNS) {
    if (pattern.test(normalized)) return topic;
  }
  return null;
}

/**
 * คำตอบของหัวข้อ พร้อมลิงก์หน้าเว็บเมื่อคำตอบพาไปที่หน้าเว็บและระบบตั้ง APP_BASE_URL ไว้
 *
 * แนบลิงก์เฉพาะคำตอบที่พูดถึงหน้าเว็บ — ผู้ใช้ที่ถามเรื่องหารบิลไม่จำเป็นต้องได้ลิงก์
 */
export function answerHelpTopic(topic: HelpTopic): string {
  const lines = [HELP_TOPIC_ANSWERS[topic]];

  if (env.appBaseUrl && (topic === 'web' || HELP_TOPIC_ANSWERS[topic].includes('หน้าเว็บ'))) {
    lines.push('', `🌐 ${env.appBaseUrl}`);
  }

  lines.push('', 'พิมพ์ "ช่วยเหลือ" เพื่อดูวิธีใช้ทั้งหมดครับ');
  return lines.join('\n');
}
