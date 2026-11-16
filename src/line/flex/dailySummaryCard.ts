// ไฟล์นี้ทำหน้าที่อะไร: การ์ด "สรุปวันนี้" — ส่งตอน 21:00 (FR-17) และตอบคำถาม "วันนี้ใช้ไปเท่าไหร่"
// ใครรับผิดชอบ: ④ Frontend
// ⚖️ กฎเหล็ก G1, G3, G7
//
// ⚖️ G1/G3: ยอดเงินทุกตัวรับมาเป็นสตริงที่ format จากสตางค์แล้ว (dailySummary.service) การ์ดไม่แตะตัวเลขเงิน
// ข้อมูลชุดเดียวกับข้อความสรุปเดิมทุกบรรทัด: รายจ่าย+จำนวนรายการ / รายรับ / เงินเหลือทั้งเดือน
// / อีเมลที่อ่านไม่ออก / วิธีปิดการแจ้งเตือน — เปลี่ยนแค่หน้าตาให้เป็นชุดเดียวกับการ์ด "บันทึกแล้ว"

import {
  actionButton,
  bubble,
  cardBody,
  cardFooter,
  cardHeader,
  FLEX_THEME as C,
  heavyDivider,
  labelValueRow,
  softPanel,
  trimBase,
  typeTag,
} from './theme';

export type DailySummaryCardInput = {
  /** เช่น "17 ก.ย. 2569" */
  dateLabel: string;
  /** วันนี้ยังไม่มีรายการเลย (ทั้งรายจ่ายและรายรับเป็นศูนย์) */
  empty: boolean;
  formattedExpense: string;
  expenseCount: number;
  /** null = วันนี้ไม่มีรายรับ ไม่ต้องแสดงแถว */
  formattedIncome: string | null;
  /** เงินเหลือใช้ได้ทั้งเดือน (ค่าบวกเสมอ) — ถ้า overspent จะเป็นยอดที่เกิน */
  formattedMonthRemaining: string;
  overspent: boolean;
  unparsedEmails: number;
  /** false = ผู้ใช้ถามเอง ไม่ต้องบอกวิธีปิดสรุปรายวัน */
  showOptOut: boolean;
  /** ข้อความเต็มแบบเดิม ใช้เป็น altText (แจ้งเตือนบนมือถือ และเครื่องที่แสดง Flex ไม่ได้) */
  plainText: string;
  /** โดเมนที่เสิร์ฟ web/ — ไม่ส่งมา = ไม่มี mascot และไม่มีปุ่มเปิดเว็บ */
  assetBaseUrl?: string;
};

/** LINE ปฏิเสธทั้งข้อความถ้า altText ยาวเกิน 400 ตัวอักษร */
const ALT_TEXT_MAX = 400;

function amountRow(type: 'income' | 'expense', label: string, amount: string) {
  return {
    type: 'box',
    layout: 'vertical',
    margin: 'lg',
    contents: [
      { type: 'box', layout: 'horizontal', contents: [typeTag(type, label)] },
      {
        type: 'text',
        text: amount,
        size: 'xxl',
        weight: 'bold',
        color: type === 'income' ? C.income : C.strong,
        margin: 'sm',
      },
    ],
  };
}

export function buildDailySummaryCard(input: DailySummaryCardInput) {
  const base = input.assetBaseUrl ? trimBase(input.assetBaseUrl) : '';
  const body: Record<string, unknown>[] = [];

  if (input.empty) {
    body.push(
      { type: 'text', text: 'วันนี้ยังไม่ได้จดรายการเลย', size: 'md', weight: 'bold', color: C.strong, margin: 'sm' },
      softPanel(
        [
          { type: 'text', text: 'พิมพ์ชื่อกับยอดได้เลย เช่น', size: 'xs', color: C.muted },
          { type: 'text', text: 'ข้าว 50', size: 'sm', weight: 'bold', color: C.strong },
        ],
        'md'
      )
    );
  } else {
    body.push(amountRow('expense', `${input.expenseCount} รายการ`, input.formattedExpense));
    if (input.formattedIncome) body.push(amountRow('income', 'วันนี้', input.formattedIncome));
  }

  body.push(
    heavyDivider('lg'),
    {
      type: 'box',
      layout: 'vertical',
      margin: 'lg',
      contents: [
        input.overspent
          ? labelValueRow('⚠️ เดือนนี้ใช้เกินไปแล้ว', input.formattedMonthRemaining, C.danger)
          : labelValueRow('เดือนนี้เหลือใช้ได้อีก', input.formattedMonthRemaining, C.strong),
      ],
    }
  );

  if (input.unparsedEmails > 0) {
    body.push({
      type: 'box',
      layout: 'vertical',
      margin: 'md',
      paddingAll: '10px',
      backgroundColor: C.warnBg,
      cornerRadius: '8px',
      contents: [
        {
          type: 'text',
          text: `📧 มีอีเมลธนาคาร ${input.unparsedEmails} ฉบับที่ระบบอ่านยอดไม่ออก`,
          size: 'xs',
          color: C.warnText,
          wrap: true,
        },
      ],
    });
  }

  if (input.showOptOut) {
    body.push({
      type: 'text',
      text: 'ปิดสรุปรายวันได้ที่หน้าเว็บ → ตั้งค่า',
      size: 'xxs',
      color: C.muted,
      align: 'end',
      margin: 'lg',
    });
  }

  return {
    type: 'flex' as const,
    altText: input.plainText.slice(0, ALT_TEXT_MAX),
    contents: bubble({
      header: cardHeader({
        title: 'สรุปวันนี้',
        subtitle: input.dateLabel,
        assetBaseUrl: base || undefined,
      }),
      body: cardBody(body),
      ...(base
        ? {
            footer: cardFooter([
              actionButton('ดูรายการทั้งหมด', { type: 'uri', uri: `${base}/transactions.html` }),
            ]),
          }
        : {}),
    }),
  };
}
