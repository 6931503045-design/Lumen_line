// ไฟล์นี้ทำหน้าที่อะไร: การ์ด "ใช้ได้อีกเท่าไหร่" — วันนี้ / พรุ่งนี้ / สัปดาห์นี้ / เดือนนี้ / เพดานทั้ง 3 ระดับ
// ใครรับผิดชอบ: ④ Frontend
// อ้างอิง: SPEC.md §S5.2 (safe-to-spend) · ร่าง §S5.10 (เพดานการใช้จ่าย)
// ⚖️ กฎเหล็ก G1, G3
//
// ⚖️ G1/G3: ยอดเงินทุกตัวรับมาเป็นสตริงที่ format แล้ว (command.service) การ์ดไม่แตะตัวเลขเงิน
// percent ใช้วาดความกว้างแถบอย่างเดียว
//
// การ์ดใบเดียวรองรับทุกคำถาม เพราะคำตอบมีโครงเดียวกัน: ยอดคำตอบตัวใหญ่ → ที่มาของตัวเลข → หมายเหตุ
// หน้าตาตรงกับการ์ด "วันนี้ใช้ได้อีก ฿245" ในสไลด์นำเสนอ

import {
  bubble,
  cardBody,
  cardHeader,
  FLEX_THEME as C,
  heavyDivider,
  labelValueRow,
  progressBar,
  sectionTitle,
  trimBase,
} from './theme';

export type AllowanceMeter = {
  /** หัวแถว เช่น "วันนี้" "สัปดาห์นี้" */
  label: string;
  /** ใช้ไป / เพดาน — format แล้ว */
  formattedSpent: string;
  formattedCeiling: string;
  /** สัดส่วนที่ใช้ไปเทียบเพดาน ใช้วาดแถบเท่านั้น */
  percent: number;
  /** "เหลือ ฿x" หรือ "เกิน ฿x" */
  status: string;
  over: boolean;
};

export type AllowanceCardInput = {
  /** หัวการ์ด เช่น "วันนี้ใช้ได้อีก" */
  title: string;
  subtitle?: string;
  /** ยอดคำตอบตัวใหญ่ เช่น "฿245.00" — ไม่ส่ง = การ์ดแจ้งข้อมูล ไม่มีตัวเลขหลัก */
  amount?: string;
  /** true = ยอดหลักเป็นยอดที่เกิน/ขาด ใช้สีแดง */
  amountOver?: boolean;
  /** บรรทัดเล็กใต้ยอด เช่น "(ถ้าวันนี้ไม่ใช้เพิ่มแล้ว)" */
  amountCaption?: string;
  /** กล่องเตือนสีเหลือง เช่น "เดือนนี้ใช้เกินแล้ว ขาดอยู่ ฿500" */
  alert?: string;
  /** ย่อหน้าอธิบาย เมื่อไม่มีตัวเลขให้ตอบ */
  message?: string;
  /** แถบใช้ไปเทียบเพดาน (คำตอบที่คิดจากเพดาน) */
  meters?: AllowanceMeter[];
  /** แถวที่มาของตัวเลข ใต้หัวข้อ "คิดมาจาก" */
  breakdown?: { label: string; value: string }[];
  /** แถวสำหรับระดับเพดานที่ปิดอยู่ เช่น "รายสัปดาห์ · ปิดอยู่" */
  offRows?: { label: string; value: string }[];
  /** หมายเหตุท้ายการ์ด เช่น วิธีเปลี่ยนเพดาน และ AI_DISCLAIMER */
  footnotes?: string[];
  altText: string;
  assetBaseUrl?: string;
};

function meterRow(meter: AllowanceMeter, first: boolean) {
  return {
    type: 'box',
    layout: 'vertical',
    margin: first ? 'md' : 'lg',
    contents: [
      {
        type: 'box',
        layout: 'horizontal',
        contents: [
          { type: 'text', text: meter.label, size: 'sm', weight: 'bold', color: C.text, flex: 4 },
          {
            type: 'text',
            text: meter.status,
            size: 'sm',
            weight: 'bold',
            color: meter.over ? C.danger : C.income,
            align: 'end',
            flex: 5,
          },
        ],
      },
      progressBar(meter.percent),
      {
        type: 'text',
        text: `ใช้ไป ${meter.formattedSpent} / เพดาน ${meter.formattedCeiling}`,
        size: 'xxs',
        color: C.muted,
        align: 'end',
        margin: 'sm',
      },
    ],
  };
}

export function buildAllowanceCard(input: AllowanceCardInput) {
  const base = input.assetBaseUrl ? trimBase(input.assetBaseUrl) : undefined;
  const body: Record<string, unknown>[] = [];

  if (input.amount) {
    body.push({
      type: 'text',
      text: input.amount,
      size: '3xl',
      weight: 'bold',
      color: input.amountOver ? C.danger : C.strong,
      margin: 'sm',
    });
  }
  if (input.amountCaption) {
    body.push({ type: 'text', text: input.amountCaption, size: 'xs', color: C.muted, wrap: true });
  }
  if (input.message) {
    body.push({ type: 'text', text: input.message, size: 'sm', color: C.text, wrap: true, margin: 'sm' });
  }
  if (input.alert) {
    body.push({
      type: 'box',
      layout: 'vertical',
      margin: 'md',
      paddingAll: '10px',
      backgroundColor: C.warnBg,
      cornerRadius: '8px',
      contents: [{ type: 'text', text: input.alert, size: 'xs', color: C.warnText, weight: 'bold', wrap: true }],
    });
  }

  (input.meters ?? []).forEach((meter, index) => body.push(meterRow(meter, index === 0 && !input.amount)));

  if (input.offRows && input.offRows.length > 0) {
    body.push({
      type: 'box',
      layout: 'vertical',
      margin: 'lg',
      spacing: 'sm',
      contents: input.offRows.map((row) => labelValueRow(row.label, row.value, C.muted)),
    });
  }

  if (input.breakdown && input.breakdown.length > 0) {
    if (body.length > 0) body.push(heavyDivider('lg'));
    body.push(sectionTitle('คิดมาจาก', 'lg'), {
      type: 'box',
      layout: 'vertical',
      margin: 'sm',
      spacing: 'sm',
      contents: input.breakdown.map((row) => labelValueRow(row.label, row.value)),
    });
  }

  (input.footnotes ?? []).forEach((note, index) => {
    body.push({
      type: 'text',
      text: note,
      size: 'xxs',
      color: C.muted,
      wrap: true,
      margin: index === 0 ? 'lg' : 'xs',
    });
  });

  return {
    type: 'flex' as const,
    altText: input.altText,
    contents: bubble({
      header: cardHeader({ title: input.title, subtitle: input.subtitle, assetBaseUrl: base }),
      body: cardBody(body),
    }),
  };
}
