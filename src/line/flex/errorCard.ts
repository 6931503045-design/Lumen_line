// ไฟล์นี้ทำหน้าที่อะไร: Flex สำหรับบอกว่าทำรายการไม่สำเร็จ พร้อมบอกวิธีพิมพ์ที่ถูกต้อง
// ใครรับผิดชอบ: ④ Frontend
// เขียนในสัปดาห์: W2
// อ้างอิง: SPEC.md §3 S1 ตาราง Flex Message แถว errorCard · SRS FR-1 ทางผิดข้อ 4–6
// ⚖️ กฎเหล็ก G4, G5
//
// ⚖️ G4: การ์ดนี้ต้องใช้ได้โดยไม่พึ่ง AI เลย ข้อความทุกบรรทัดเป็นข้อความคงที่ที่เขียนไว้ล่วงหน้า
// ⚖️ G5: 🔴 ห้ามเอาข้อความดิบของผู้ใช้มาแสดงซ้ำในการ์ด เพราะข้อความที่ระบบอ่านไม่ออก
// มีโอกาสสูงที่จะเป็นข้อความที่ผู้ใช้ส่งผิดห้อง เช่น เลขบัญชี เลขบัตร หรือเบอร์โทร
// การสะท้อนกลับจะทำให้ข้อมูลนั้นถูกบันทึกลง log ของเราโดยไม่จำเป็น

import {
  actionButton,
  bubble,
  cardBody,
  cardFooter,
  cardHeader,
  FLEX_THEME,
  sectionTitle,
  softPanel,
} from './theme';

export type ErrorCardInput = {
  /** หัวเรื่องสั้นๆ เช่น "อ่านข้อความไม่ออก" */
  title: string;
  /** อธิบายว่าทำไมถึงไม่สำเร็จ ด้วยภาษาที่ผู้ใช้ทำอะไรต่อได้ */
  reason: string;
  /** ตัวอย่างข้อความที่พิมพ์แล้วได้ผล */
  examples?: string[];
};

/**
 * หน้าตาตามแม่แบบการ์ด "บันทึกแล้ว" แต่หัวเป็นแถบเหลืองอ่อน (tone 'warn') ไม่ใช่มะนาว
 * และไม่มี mascot หน้ายิ้ม — ข้อความผิดพลาดต้องไม่ดูเหมือนข่าวดี
 */
export function buildErrorCard(input: ErrorCardInput) {
  const body: Record<string, unknown>[] = [
    { type: 'text', text: input.reason, size: 'sm', color: FLEX_THEME.text, wrap: true, margin: 'sm' },
  ];

  if (input.examples && input.examples.length > 0) {
    body.push(
      sectionTitle('ลองพิมพ์แบบนี้', 'lg'),
      softPanel(
        input.examples.map((example) => ({
          type: 'text',
          text: example,
          size: 'sm',
          weight: 'bold',
          color: FLEX_THEME.strong,
          wrap: true,
        })),
        'sm'
      )
    );
  }

  return {
    type: 'flex' as const,
    altText: `${input.title} — ${input.reason}`,
    contents: bubble({
      header: cardHeader({ title: input.title, subtitle: 'ยังไม่ได้บันทึกอะไร', tone: 'warn' }),
      body: cardBody(body),
      footer: cardFooter([actionButton('ดูวิธีใช้', { type: 'message', text: 'ช่วยเหลือ' })]),
    }),
  };
}

// ── กรณีที่เจอบ่อย เขียนไว้ให้เรียกใช้ซ้ำได้ ไม่ต้องคิดข้อความใหม่ทุกที่ ──

// ไม่มี buildNegativeAmountCard โดยตั้งใจ: ทางด่วน regex ตีกลับยอด <= 0 ตั้งแต่ชั้น parser
// (regexParser.ts) ข้อความนั้นจึงไหลไปหา AI ไม่เคยถึง createTransaction การ์ดใบนั้นเคยมี
// แต่ไม่มีทางถูกเรียก จึงเอาออก — การ์ดที่กดไปไม่ถึงแย่กว่าไม่มี เพราะคนอ่านโค้ดจะเข้าใจผิด
// ว่ามี flow นั้นอยู่

/** ไม่มีตัวเลขในข้อความ หรือรูปประโยคอ่านไม่ออก (SRS FR-1 ทางผิดข้อ 4) */
export function buildUnreadableCard() {
  return buildErrorCard({
    title: 'อ่านข้อความไม่ออก',
    reason: 'ยังจับไม่ได้ว่ารายการนี้คืออะไรและกี่บาทครับ ใส่ชื่อรายการกับจำนวนเงินมาด้วยนะครับ',
    examples: ['กาแฟ 80', 'ข้าว 1.2k', '+เงินเดือน 15000'],
  });
}

/** ยอดเกินเพดานต่อรายการ (SRS FR-1 ทางผิดข้อ 6 · NFR-9) */
export function buildAmountTooLargeCard(formattedCeiling: string) {
  return buildErrorCard({
    title: 'ยอดเกินที่รับได้',
    reason: `หนึ่งรายการรับได้ไม่เกิน ${formattedCeiling} ครับ ถ้ายอดถูกต้องจริง ลองแบ่งบันทึกเป็นหลายรายการดูนะครับ`,
  });
}

/** บันทึกไม่สำเร็จเพราะระบบมีปัญหา ไม่ใช่เพราะผู้ใช้พิมพ์ผิด */
export function buildSaveFailedCard() {
  return buildErrorCard({
    title: 'บันทึกไม่สำเร็จ',
    reason: 'ระบบมีปัญหาชั่วคราวครับ ไม่ได้เกิดจากข้อความที่พิมพ์ ลองส่งใหม่อีกครั้งนะครับ',
  });
}

/**
 * AI ปิด / โควตาหมด / ล่ม (⚖️ G4)
 *
 * ต่างจาก buildUnreadableCard ตรงที่อันนั้นคือ "ระบบอ่านแล้วแต่ไม่เข้าใจ"
 * ส่วนอันนี้คือ "ยังไม่ได้อ่านเลยเพราะตัวช่วยใช้ไม่ได้" — ผู้ใช้ต้องรู้ว่า
 * ไม่ใช่ความผิดของข้อความที่พิมพ์ และทางด่วนยังใช้ได้อยู่
 */
export function buildAiUnavailableCard() {
  return buildErrorCard({
    title: 'ตัวช่วยอ่านภาษาธรรมชาติใช้ไม่ได้ตอนนี้',
    reason: 'ยังจดได้ตามปกติด้วยรูปแบบ "ชื่อ จำนวนเงิน" และใช้คำสั่งได้เหมือนเดิมครับ',
    examples: ['กาแฟ 80', '+เงินเดือน 35000', 'สรุป / เหลือ / งบ / แผน'],
  });
}
