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
// หน้าตาตามแม่แบบการ์ด "บันทึกแล้ว" — ชิ้นส่วนทั้งหมดมาจาก theme.ts

import {
  actionButton,
  bubble,
  cardBody,
  cardFooter,
  cardHeader,
  FLEX_THEME,
  heavyDivider,
  labelValueRow,
  progressBar,
  sectionTitle,
  softPanel,
  trimBase,
} from './theme';

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
  /** โดเมนที่เสิร์ฟ web/ — ใช้กับ mascot และปุ่มเปิดหน้าเว็บ ไม่ส่งมาก็ยังสร้างการ์ดได้ */
  assetBaseUrl?: string;
};

const MAX_TOP_CATEGORIES = 3;

/** แถวหมวด: ชื่อ + ยอด แล้วตามด้วยแถบสัดส่วนของรายจ่ายทั้งเดือน */
function categoryRow(item: SummaryTopCategory) {
  return {
    type: 'box',
    layout: 'vertical',
    margin: 'md',
    contents: [
      {
        type: 'box',
        layout: 'horizontal',
        contents: [
          // ชื่อหมวดผู้ใช้ตั้งเองได้ ยาวแค่ไหนก็ได้ จึงต้อง wrap ไม่ใช่ปล่อยให้ตัด
          {
            type: 'text',
            text: item.name,
            size: 'sm',
            weight: 'bold',
            color: FLEX_THEME.text,
            flex: 5,
            wrap: true,
          },
          {
            type: 'text',
            text: item.formattedAmount,
            size: 'xs',
            color: FLEX_THEME.text,
            align: 'end',
            flex: 5,
            gravity: 'center',
          },
        ],
      },
      // สัดส่วนของรายจ่าย ไม่ใช่การใช้งบ — สีเดียวตลอด ไม่ไล่เขียว/เหลือง/แดงแบบแถบงบ
      // ไม่งั้นผู้ใช้จะอ่านว่าหมวดที่จ่ายเยอะ "เกินงบ" ทั้งที่อาจไม่ได้ตั้งงบไว้เลย
      progressBar(item.percent, FLEX_THEME.bar),
    ],
  };
}

export function buildSummaryCard(input: SummaryCardInput) {
  const top = input.topCategories.slice(0, MAX_TOP_CATEGORIES);
  const balanceColor = input.balanceIsNegative ? FLEX_THEME.danger : FLEX_THEME.income;

  const body: Record<string, unknown>[] = [
    // ยอดรวมก่อน เพราะตอบคำถาม "เดือนนี้เป็นยังไง" ได้ในกล่องเดียว
    softPanel(
      [
        labelValueRow('รายรับ', input.formattedIncome, FLEX_THEME.income),
        labelValueRow('รายจ่าย', input.formattedExpense, FLEX_THEME.strong),
        { type: 'separator', margin: 'sm', color: FLEX_THEME.line },
        labelValueRow('ส่วนต่าง', input.formattedBalance, balanceColor),
      ],
      'sm'
    ),
  ];

  if (top.length > 0) {
    body.push(heavyDivider(), sectionTitle('จ่ายมากสุด', 'lg'), ...top.map(categoryRow));
  }

  if (input.footnote) {
    body.push({
      type: 'text',
      text: input.footnote,
      size: 'xs',
      color: FLEX_THEME.muted,
      wrap: true,
      margin: 'lg',
    });
  }

  const buttons = [
    actionButton('ใช้ได้อีกเท่าไหร่', { type: 'message', text: 'เหลือ' }),
  ];
  if (input.assetBaseUrl) {
    buttons.push(
      actionButton(
        'ดูกราฟในเว็บ',
        { type: 'uri', uri: `${trimBase(input.assetBaseUrl)}/index.html` },
        'primary'
      )
    );
  }

  return {
    type: 'flex' as const,
    // altText คือสิ่งที่ขึ้นใน notification และในแอปที่แสดง Flex ไม่ได้
    // จึงต้องมีตัวเลขสำคัญครบในบรรทัดเดียว
    altText: `สรุปเดือนนี้ รายรับ ${input.formattedIncome} รายจ่าย ${input.formattedExpense} ส่วนต่าง ${input.formattedBalance}`,
    contents: bubble({
      header: cardHeader({
        title: 'สรุปเดือนนี้',
        subtitle: input.monthLabel,
        assetBaseUrl: input.assetBaseUrl,
      }),
      body: cardBody(body),
      footer: cardFooter(buttons),
    }),
  };
}
