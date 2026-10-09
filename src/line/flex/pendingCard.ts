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

export type PendingCardInput = {
  /** id ของ pending_action ที่ service สร้างไว้ */
  pendingId: string;
  /** สรุปสิ่งที่ AI เข้าใจ มาจาก pending.summary ที่ service เขียนให้แล้ว */
  summary: string;
};

const COLOR_AI = '#6B4FBB';
const COLOR_MUTED = '#888888';
const COLOR_SUMMARY_BG = '#F4F1FB';

export function buildPendingCard(input: PendingCardInput) {
  return {
    type: 'flex' as const,
    altText: `ยืนยันไหม: ${input.summary}`,
    contents: {
      type: 'bubble',
      size: 'kilo',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'text',
            text: '🤖 เข้าใจแบบนี้ถูกไหมครับ',
            weight: 'bold',
            size: 'md',
            color: COLOR_AI,
            wrap: true,
          },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'md',
            paddingAll: '10px',
            backgroundColor: COLOR_SUMMARY_BG,
            cornerRadius: '4px',
            contents: [{ type: 'text', text: input.summary, size: 'sm', wrap: true }],
          },
          {
            type: 'text',
            text: 'กดยืนยันแล้วถึงจะบันทึกครับ ยังไม่ได้บันทึกตอนนี้',
            size: 'xxs',
            color: COLOR_MUTED,
            wrap: true,
            margin: 'md',
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'horizontal',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'secondary',
            height: 'sm',
            action: {
              type: 'postback',
              label: '❌ ไม่ใช่',
              data: `action=ai_cancel&id=${input.pendingId}`,
              displayText: 'ไม่ใช่',
            },
          },
          {
            type: 'button',
            style: 'primary',
            height: 'sm',
            color: COLOR_AI,
            action: {
              type: 'postback',
              label: '✅ ยืนยัน',
              data: `action=ai_confirm&id=${input.pendingId}`,
              displayText: 'ยืนยัน',
            },
          },
        ],
      },
    },
  };
}
