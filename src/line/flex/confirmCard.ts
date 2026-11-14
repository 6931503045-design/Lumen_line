// ไฟล์นี้ทำหน้าที่อะไร: สร้าง Flex message "confirmCard" — โชว์หลังบันทึกผ่านทางด่วน (L1) สำเร็จ
// ใครรับผิดชอบ: ④ Frontend (ตาม SPEC §929) — แต่ทำไว้ก่อนเพื่อปิดเกณฑ์ W1 ("...+ confirmCard + ↩️ ยกเลิก")
// อ้างอิง: SPEC.md §3 S1 ตาราง Flex Message แถว confirmCard, ตาราง Postback แถว undo/edit_category
//
// ต้องมีตาม SPEC: รายการ, หมวด, ยอด, ปุ่ม ↩️ ยกเลิก / ✏️ แก้หมวด, แนบคำเตือนงบถ้ามี
// ⚠️ ขอบเขตตอนนี้: มีเฉพาะปุ่ม ↩️ ยกเลิก — ดูเหตุผลที่ซ่อน ✏️ แก้หมวด ตรง footerButtons ด้านล่าง
// ⚠️ ขอบเขต W1: "แนบคำเตือนงบถ้ามี" ยังทำไม่ได้ตอนนี้ (ยังไม่มี budget check logic ใน W1)
// รับ budgetWarning เป็น optional string ไว้ล่วงหน้า ให้ส่ง undefined ไปก่อนจนกว่าจะทำ budgets ใน W2/W3
//
// ⚠️ ไม่ import type FlexMessage เต็มจาก @line/bot-sdk เพราะ namespace เปลี่ยนบ่อยระหว่างเวอร์ชัน (เหมือน
// webhook.ts) — ส่งเป็น object ดิบตรงตาม Flex Message JSON schema ของ LINE แทน ซึ่ง replyMessage ยอมรับได้เสมอ

import { FLEX_THEME } from './theme';

export type ConfirmCardInput = {
  transactionId: string;
  type: 'income' | 'expense';
  categoryName: string;
  formattedAmount: string; // ผ่าน utils/money.ts::formatBaht มาแล้ว เช่น "฿80.00"
  budgetWarning?: string; // TODO W2/W3: ต่อ budgets service แล้วส่งข้อความเตือนมาที่นี่
};

export function buildConfirmCard(input: ConfirmCardInput) {
  const isIncome = input.type === 'income';
  const label = isIncome ? 'รายรับ' : 'รายจ่าย';
  const headerColor = isIncome ? FLEX_THEME.income : FLEX_THEME.strong;

  const bodyContents: Record<string, unknown>[] = [
    {
      type: 'text',
      text: `✅ บันทึก${label}แล้ว`,
      weight: 'bold',
      size: 'md',
      color: headerColor,
    },
    {
      type: 'box',
      layout: 'horizontal',
      margin: 'md',
      contents: [
        { type: 'text', text: 'หมวด', size: 'sm', color: FLEX_THEME.muted, flex: 2 },
        { type: 'text', text: input.categoryName, size: 'sm', flex: 4, wrap: true },
      ],
    },
    {
      type: 'box',
      layout: 'horizontal',
      contents: [
        { type: 'text', text: 'ยอด', size: 'sm', color: FLEX_THEME.muted, flex: 2 },
        { type: 'text', text: input.formattedAmount, size: 'sm', weight: 'bold', flex: 4 },
      ],
    },
  ];

  if (input.budgetWarning) {
    bodyContents.push({
      type: 'text',
      text: input.budgetWarning,
      size: 'xs',
      color: FLEX_THEME.warnText,
      wrap: true,
      margin: 'md',
    });
  }

  // ⚠️ การ์ดนี้ไม่ได้ถูกใช้แล้ว — การ์ด "บันทึกแล้ว" (recordedCard) แทนที่ และมีปุ่ม "เปลี่ยนหมวด" ของจริง
  // (postbackHandler รับ action=edit_category → set_category ครบแล้ว การ์ดเก่าในแชทที่มีปุ่มนี้จึงกดได้ด้วย)
  const footerButtons: Record<string, unknown>[] = [
    {
      type: 'button',
      style: 'secondary',
      height: 'sm',
      action: {
        type: 'postback',
        label: '↩️ ยกเลิก',
        data: `action=undo&id=${input.transactionId}`,
        displayText: 'ยกเลิกรายการล่าสุด',
      },
    },
  ];

  return {
    type: 'flex' as const,
    altText: `บันทึก${label} ${input.formattedAmount} หมวด "${input.categoryName}" แล้ว`,
    contents: {
      type: 'bubble',
      size: 'kilo',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: bodyContents,
      },
      footer: {
        type: 'box',
        layout: 'horizontal',
        spacing: 'sm',
        contents: footerButtons,
      },
    },
  };
}