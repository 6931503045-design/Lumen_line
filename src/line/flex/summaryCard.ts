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

import { FLEX_THEME } from './theme';

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

const COLOR_INCOME = FLEX_THEME.income;
const COLOR_EXPENSE = FLEX_THEME.danger;
const COLOR_MUTED = FLEX_THEME.muted;
const COLOR_TRACK = FLEX_THEME.track;
const COLOR_BAR = FLEX_THEME.strong;

const MAX_TOP_CATEGORIES = 3;

// สเกลสีของแถบ: เขียว (0%) → เหลืองอำพัน (50%) → แดง (100%)
// ไล่ผ่านเหลืองแทนการไล่เขียว→แดงตรงๆ เพราะจุดกึ่งกลางแบบตรงจะเป็นสีน้ำตาลขุ่น
const GRADIENT_START: string = FLEX_THEME.bar;
const GRADIENT_MID: string = FLEX_THEME.warn;
const GRADIENT_END: string = FLEX_THEME.danger;

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mixHex(a: string, b: string, t: number): string {
  // 🔴 ห้ามใช้ ca.map((v, i) => ... cb[i] ...) ตรงนี้
  // tsconfig เปิด noUncheckedIndexedAccess ไว้ การ index tuple ด้วยตัวแปร (ไม่ใช่เลขคงที่)
  // จะได้ชนิด number | undefined แล้ว build ล้มด้วย TS2532 ทั้งที่โค้ดถูกตามตรรกะ
  // แยกค่าออกมาด้วย destructuring แทน — tuple ความยาวคงที่จึงได้ number ตรง ๆ ไม่ต้องใส่ !
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);

  const mix = (from: number, to: number): string =>
    Math.round(from + (to - from) * t)
      .toString(16)
      .padStart(2, '0');

  return `#${mix(ar, br)}${mix(ag, bg)}${mix(ab, bb)}`.toUpperCase();
}

/** สีบนสเกล ณ ตำแหน่ง p (0–100) ของรางทั้งเส้น */
function scaleColor(p: number): string {
  return p <= 50
    ? mixHex(GRADIENT_START, GRADIENT_MID, p / 50)
    : mixHex(GRADIENT_MID, GRADIENT_END, (p - 50) / 50);
}

/**
 * ไล่สีของแถบยาว barWidth% โดยยึดสเกลของ "รางทั้งเส้น" ไม่ใช่ของตัวแถบ
 * แถบสั้นจึงเขียวเกือบล้วน แถบยาวจึงค่อยแดงที่ปลาย — สีบอกสัดส่วนได้ตรงกับความยาว
 * (เป็นการคำนวณสีของ UI ล้วนๆ ไม่ใช่ยอดเงิน — ไม่ขัด G1)
 */
function barGradient(barWidth: number) {
  const gradient: Record<string, string> = {
    type: 'linearGradient',
    angle: '90deg',
    startColor: GRADIENT_START,
    endColor: scaleColor(barWidth),
  };
  // เกิน 50% แถบผ่านจุดเหลืองของราง — ปักสีกลางไว้ตรงตำแหน่งนั้นของตัวแถบ
  if (barWidth > 50) {
    gradient.centerColor = GRADIENT_MID;
    gradient.centerPosition = `${Math.round((50 / barWidth) * 100)}%`;
  }
  return gradient;
}

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
  // เหตุผลเดียวกับ planCard: แถบที่สั้นมากต้องยังอ่านออกว่าเป็น "ขีด" ไม่ใช่จุดกลม
  // ยกพื้นขั้นต่ำ 5% แล้วลดความมนลงเมื่อสั้น — ตัวเลขจริงพิมพ์อยู่ข้างแถบแล้ว
  const barWidth = Math.max(5, width);
  const barRadius = barWidth < 14 ? '2px' : '3px';
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
            // 🔴 ต้องมี filler ข้างใน ห้ามปล่อย contents: [] — แอป LINE บนมือถือ
            // ไม่วาดกล่องที่ไม่มีลูกเลย (Simulator บนเดสก์ท็อปยังวาดให้ จึงหลุดรอดตอนทดสอบ)
            contents: [{ type: 'filler' }],
            // 🔴 ต้องกำหนด height ซ้ำที่กล่องใน ไม่ใช่พึ่งความสูงของกล่องนอก
            // ไม่งั้นกล่องในสูง 0 แล้วแถบหายทั้งแถบบนแอป LINE จริง
            height: '6px',
            width: `${barWidth}%`,
            // backgroundColor ไว้เป็นสีสำรองให้ไคลเอนต์รุ่นเก่าที่ไม่รู้จัก gradient
            backgroundColor: scaleColor(barWidth),
            background: barGradient(barWidth),
            cornerRadius: barRadius,
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
