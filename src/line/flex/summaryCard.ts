// ไฟล์นี้ทำหน้าที่อะไร: Flex สำหรับแสดงสรุปรายรับ-รายจ่ายของเดือนนี้ (คำสั่ง `สรุป`)
// ใครรับผิดชอบ: ④ Frontend
// เขียนในสัปดาห์: W2
// อ้างอิง: SPEC.md §3 S1 ตาราง Flex Message แถว summaryCard · SRS FR-7
// ⚖️ กฎเหล็ก G1, G7
//
// ⚖️ G1: ไฟล์นี้ "ห้ามคำนวณเงิน" — รับเฉพาะสตริงที่ format มาแล้วจาก service
// แม้แต่การตัดสินว่าส่วนต่างติดลบหรือไม่ ก็ให้ผู้เรียกส่ง balanceIsNegative มา
// ไม่ใช่มาแกะเครื่องหมายลบออกจากสตริงเอง ซึ่งจะพังทันทีที่เปลี่ยนรูปแบบการ format
//
// ⚖️ G7: รายการ type='transfer' ไม่ถูกนับอยู่แล้วตั้งแต่ชั้น service ที่นี่ไม่ต้องทำอะไรเพิ่ม
//
// ⚠️ ไม่ import type FlexMessage เต็มจาก @line/bot-sdk ด้วยเหตุผลเดียวกับ confirmCard.ts
// (namespace เปลี่ยนบ่อยระหว่างเวอร์ชัน) — ส่งเป็น object ดิบตาม Flex Message JSON schema

export type SummaryTopCategory = {
  name: string;
  /** format แล้ว เช่น "฿3,200.00" */
  formattedAmount: string;
  /** 0–100 ใช้เป็นความกว้างของแถบ เป็นเรื่องแสดงผลล้วนๆ ไม่ใช่ยอดเงิน */
  percent: number;
};

export type SummaryCardInput = {
  /** เช่น "กันยายน 2569" */
  monthLabel: string;
  formattedIncome: string;
  formattedExpense: string;
  formattedBalance: string;
  /** true = ส่วนต่างติดลบ ผู้เรียกเป็นคนตัดสิน ไม่ใช่การ์ด (G1) */
  balanceIsNegative: boolean;
  /** สูงสุด 3 หมวดตาม SPEC — ถ้าส่งมามากกว่านั้นการ์ดจะตัดให้เอง */
  topCategories: SummaryTopCategory[];
  /** ข้อความท้ายการ์ด เช่น ชวนให้เริ่มจดเมื่อยังไม่มีรายการ */
  footnote?: string;
};

const COLOR_INCOME = '#1DB446';
const COLOR_EXPENSE = '#E74C3C';
const COLOR_MUTED = '#888888';
const COLOR_TRACK = '#EEEEEE';
const COLOR_BAR = '#1a3a6b';

const MAX_TOP_CATEGORIES = 3;

/** แถวตัวเลข 1 บรรทัด: ป้ายซ้าย ยอดขวา */
function amountRow(label: string, value: string, color?: string) {
  return {
    type: 'box',
    layout: 'horizontal',
    contents: [
      { type: 'text', text: label, size: 'sm', color: COLOR_MUTED, flex: 3 },
      {
        type: 'text',
        text: value,
        size: 'sm',
        weight: 'bold',
        align: 'end',
        flex: 5,
        ...(color ? { color } : {}),
      },
    ],
  };
}

/** แถวหมวด: ชื่อ + ยอด แล้วตามด้วยแถบสัดส่วน */
function categoryRow(item: SummaryTopCategory) {
  // จำกัด 0–100 ก่อนเอาไปทำความกว้าง เพราะ LINE ไม่รับค่านอกช่วงนี้
  // (ไม่ใช่การคำนวณเงิน เป็นการกันค่าเพี้ยนของ UI ล้วนๆ)
  const width = Math.max(0, Math.min(100, Math.round(item.percent)));
  return {
    type: 'box',
    layout: 'vertical',
    margin: 'md',
    spacing: 'xs',
    contents: [
      {
        type: 'box',
        layout: 'horizontal',
        contents: [
          { type: 'text', text: item.name, size: 'sm', flex: 5, wrap: true },
          {
            type: 'text',
            text: item.formattedAmount,
            size: 'sm',
            color: COLOR_MUTED,
            align: 'end',
            flex: 4,
          },
        ],
      },
      {
        type: 'box',
        layout: 'vertical',
        height: '6px',
        backgroundColor: COLOR_TRACK,
        cornerRadius: '3px',
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            contents: [],
            // width เป็น 0% ไม่ได้ใน LINE — ใช้ 1% แทนเพื่อให้ยังเห็นว่ามีแถบอยู่
            width: `${width === 0 ? 1 : width}%`,
            backgroundColor: COLOR_BAR,
            cornerRadius: '3px',
          },
        ],
      },
    ],
  };
}

export function buildSummaryCard(input: SummaryCardInput) {
  const top = input.topCategories.slice(0, MAX_TOP_CATEGORIES);

  const bodyContents: Record<string, unknown>[] = [
    {
      type: 'text',
      text: '📊 สรุปเดือนนี้',
      weight: 'bold',
      size: 'md',
      color: COLOR_BAR,
    },
    { type: 'text', text: input.monthLabel, size: 'xs', color: COLOR_MUTED },
    { type: 'separator', margin: 'md' },
    {
      type: 'box',
      layout: 'vertical',
      margin: 'md',
      spacing: 'sm',
      contents: [
        amountRow('รายรับ', input.formattedIncome, COLOR_INCOME),
        amountRow('รายจ่าย', input.formattedExpense, COLOR_EXPENSE),
        amountRow(
          'ส่วนต่าง',
          input.formattedBalance,
          input.balanceIsNegative ? COLOR_EXPENSE : COLOR_INCOME
        ),
      ],
    },
  ];

  if (top.length > 0) {
    bodyContents.push(
      { type: 'separator', margin: 'lg' },
      {
        type: 'text',
        text: 'จ่ายมากสุด',
        size: 'sm',
        weight: 'bold',
        margin: 'lg',
      },
      ...top.map(categoryRow)
    );
  }

  if (input.footnote) {
    bodyContents.push({
      type: 'text',
      text: input.footnote,
      size: 'xs',
      color: COLOR_MUTED,
      wrap: true,
      margin: 'lg',
    });
  }

  return {
    type: 'flex' as const,
    // altText คือสิ่งที่ขึ้นใน notification และในแอปที่แสดง Flex ไม่ได้
    // จึงต้องมีตัวเลขสำคัญครบในบรรทัดเดียว
    altText: `สรุปเดือนนี้ รายรับ ${input.formattedIncome} รายจ่าย ${input.formattedExpense} ส่วนต่าง ${input.formattedBalance}`,
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
        contents: [
          {
            type: 'button',
            style: 'secondary',
            height: 'sm',
            action: {
              type: 'message',
              label: 'ใช้ได้อีกเท่าไหร่',
              text: 'เหลือ',
            },
          },
        ],
      },
    },
  };
}
