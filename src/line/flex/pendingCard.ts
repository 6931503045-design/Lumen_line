// ไฟล์นี้ทำหน้าที่อะไร: การ์ด "AI เข้าใจแบบนี้ ยืนยันไหม?" ก่อนบันทึกจริง
// ใครรับผิดชอบ: ④ Frontend
// เขียนในสัปดาห์: W2
// อ้างอิง: SPEC.md §3 S1 ตาราง Flex Message แถว pendingCard · SPEC §S11 · SRS FR-13
// ⚖️ กฎเหล็ก G2
//
// 🔴 G2 คือเหตุผลทั้งหมดที่การ์ดนี้มีอยู่: AI ห้ามเขียนข้อมูลลงฐานเอง ทุกคำขอที่จะเขียน
// ต้องกลายเป็น pending_action แล้วรอให้ "คน" กดยืนยันก่อน การกดปุ่มในการ์ดนี้
// คือการยืนยันของมนุษย์ตามกฎข้อนั้น — ห้ามเพิ่มทางลัดที่ข้ามการกดปุ่มนี้เด็ดขาด
//
// ⚠️ ค่า data ของปุ่มต้องตรงกับที่ postbackHandler รับอยู่ (action=ai_confirm / ai_cancel)
// ถ้าจะเปลี่ยนชื่อ action ต้องแก้ทั้งสองที่พร้อมกัน ไม่งั้นปุ่มจะกดแล้วเงียบ

import {
  actionButton,
  bubble,
  cardBody,
  cardFooter,
  cardHeader,
  FLEX_THEME,
  softPanel,
} from './theme';

export type PendingCardInput = {
  /** id ของ pending_action ที่ service สร้างไว้ */
  pendingId: string;
  /** สรุปสิ่งที่ AI เข้าใจ มาจาก pending.summary ที่ service เขียนให้แล้ว */
  summary: string;
  /** หัวการ์ด — ค่าเริ่มต้นสำหรับข้อความแชท สลิปส่ง "อ่านสลิปได้แล้ว" มาแทน */
  title?: string;
  /** บรรทัดเสริมใต้สรุป เช่น ธนาคาร หรือคำเตือนว่าอาจซ้ำ */
  notes?: string[];
  /** true = มีคำเตือนที่ผู้ใช้ต้องอ่านก่อนกด (เช่น อาจเป็นรายการซ้ำ) แสดงบรรทัดแรกของ notes เป็นกล่องเตือน */
  warnFirstNote?: boolean;
  /** โดเมนที่เสิร์ฟ web/ — ใช้กับ mascot ไม่ส่งมาก็ยังสร้างการ์ดได้ */
  assetBaseUrl?: string;
};

/** หน้าตาตามแม่แบบการ์ด "บันทึกแล้ว" — ชิ้นส่วนทั้งหมดมาจาก theme.ts */
export function buildPendingCard(input: PendingCardInput) {
  const notes = input.notes ?? [];
  const body: Record<string, unknown>[] = [
    softPanel(
      [{ type: 'text', text: input.summary, size: 'sm', color: FLEX_THEME.text, wrap: true }],
      'sm'
    ),
  ];

  notes.forEach((note, index) => {
    const warn = index === 0 && input.warnFirstNote;
    body.push(
      warn
        ? {
            type: 'box',
            layout: 'vertical',
            margin: 'md',
            paddingAll: '10px',
            backgroundColor: FLEX_THEME.warnBg,
            cornerRadius: '8px',
            contents: [{ type: 'text', text: note, size: 'xs', color: FLEX_THEME.warnText, wrap: true }],
          }
        : { type: 'text', text: note, size: 'xs', color: FLEX_THEME.muted, wrap: true, margin: 'md' }
    );
  });

  return {
    type: 'flex' as const,
    altText: `ยืนยันไหม: ${input.summary}`,
    contents: bubble({
      header: cardHeader({
        title: input.title ?? 'เข้าใจแบบนี้ถูกไหมครับ',
        // ⚖️ G2: ต้องบอกให้ชัดตั้งแต่หัวการ์ดว่ายังไม่ได้บันทึก ผู้ใช้จะได้ไม่เข้าใจว่าบันทึกไปแล้ว
        subtitle: 'ยังไม่ได้บันทึก — กดยืนยันก่อนนะครับ',
        assetBaseUrl: input.assetBaseUrl,
      }),
      body: cardBody(body),
      footer: cardFooter([
        actionButton('ไม่ใช่', {
          type: 'postback',
          data: `action=ai_cancel&id=${input.pendingId}`,
          displayText: 'ไม่ใช่',
        }),
        actionButton(
          'ยืนยัน',
          {
            type: 'postback',
            data: `action=ai_confirm&id=${input.pendingId}`,
            displayText: 'ยืนยัน',
          },
          'primary'
        ),
      ]),
    }),
  };
}
