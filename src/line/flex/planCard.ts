// ไฟล์นี้ทำหน้าที่อะไร: Flex สำหรับแผนออม — ความคืบหน้า เป้าหมาย และยอดออมต่อเดือน (คำสั่ง `แผน`)
// ใครรับผิดชอบ: ④ Frontend
// เขียนในสัปดาห์: W3
// อ้างอิง: SPEC.md §3 S1 ตาราง Flex Message แถว planCard · SRS FR-5 / FR-8 · SPEC §S5.3–S5.6
// ⚖️ กฎเหล็ก G1, G3, G7
//
// ⚖️ G1/G3: ยอดเงินทุกตัวรับมาเป็นสตริงที่ format จากสตางค์แล้ว การ์ดไม่แตะตัวเลขเงิน
// ⚖️ G7: การโอนเข้าแผน (type='transfer') ไม่ใช่รายจ่าย — service กรองให้แล้วตั้งแต่ต้นทาง
//
// 🔴 ป้ายระดับความมั่นใจเป็นของบังคับ ไม่ใช่ของตกแต่ง: SRS §3.6 กำหนดว่าทุกทางเลือกของแผน
// ต้องบอก "ระดับความมั่นใจ" เพราะแผนที่คำนวณจากข้อมูล 3 วันไม่ควรถูกนำเสนอเท่ากับ 3 เดือน
//
// หน้าตาตามแม่แบบการ์ด "บันทึกแล้ว" — ชิ้นส่วนทั้งหมดมาจาก theme.ts

import {
  actionButton,
  bubble,
  cardBody,
  cardFooter,
  cardHeader,
  FLEX_THEME,
  labelValueRow,
  pill,
  progressBar,
  trimBase,
} from './theme';

export type PlanConfidence = 'low' | 'medium' | 'high';

export type PlanCardInput = {
  title: string;
  formattedTarget: string;
  formattedSaved: string;
  formattedMonthly: string;
  /** 0–100 ใช้เป็นความกว้างแถบ เป็นเรื่องแสดงผล ไม่ใช่ยอดเงิน */
  percentComplete: number;
  confidence: PlanConfidence;
  /** เช่น "มิ.ย. 2570" */
  dueMonth: string;
  /** true = ออมช้ากว่าเป้า ผู้เรียกเป็นคนตัดสิน (G1) */
  offTrack?: boolean;
  /** โดเมนที่เสิร์ฟ web/ — ใช้กับ mascot และปุ่มเปิดหน้าเว็บ ไม่ส่งมาก็ยังสร้างการ์ดได้ */
  assetBaseUrl?: string;
};

/** LINE ให้ carousel สูงสุด 12 bubble */
const MAX_BUBBLES = 12;

/** ป้ายความมั่นใจ — สีพื้นกับสีตัวหนังสือคู่กัน บอกระดับได้แม้อ่านไม่ทัน */
const CONFIDENCE: Record<PlanConfidence, { label: string; bg: string; color: string }> = {
  low: { label: 'ความมั่นใจต่ำ', bg: FLEX_THEME.dangerBg, color: FLEX_THEME.danger },
  medium: { label: 'ความมั่นใจกลาง', bg: FLEX_THEME.warnBg, color: FLEX_THEME.warnText },
  high: { label: 'ความมั่นใจสูง', bg: FLEX_THEME.incomeBg, color: FLEX_THEME.income },
};

/** bubble เดียว ใช้ทั้งเดี่ยวและใน carousel */
function planBubble(input: PlanCardInput) {
  const width = Math.max(0, Math.min(100, Math.round(input.percentComplete)));
  const barColor = input.offTrack ? FLEX_THEME.warn : FLEX_THEME.bar;
  const confidence = CONFIDENCE[input.confidence];

  const body: Record<string, unknown>[] = [
    {
      type: 'box',
      layout: 'horizontal',
      margin: 'sm',
      contents: [
        pill(confidence.label, confidence.bg, confidence.color),
        {
          type: 'text',
          text: `${width}%`,
          size: 'lg',
          weight: 'bold',
          color: input.offTrack ? FLEX_THEME.warnText : FLEX_THEME.strong,
          align: 'end',
          gravity: 'center',
        },
      ],
    },
    // 🔴 แถบต้องเป็นลูกตรงของ body — เทสต์ตรวจ height ของกล่องในจากตำแหน่งนี้
    progressBar(input.percentComplete, barColor),
    {
      type: 'text',
      text: `ออมแล้ว ${input.formattedSaved} / ${input.formattedTarget}`,
      size: 'xs',
      color: FLEX_THEME.muted,
      margin: 'sm',
      wrap: true,
    },
    { type: 'separator', margin: 'lg', color: FLEX_THEME.line },
    {
      type: 'box',
      layout: 'vertical',
      margin: 'lg',
      spacing: 'sm',
      contents: [
        labelValueRow('ออมเดือนละ', input.formattedMonthly),
        labelValueRow('ครบเป้า', input.dueMonth),
      ],
    },
  ];

  if (input.offTrack) {
    body.push({
      type: 'box',
      layout: 'vertical',
      margin: 'lg',
      paddingAll: '10px',
      backgroundColor: FLEX_THEME.warnBg,
      cornerRadius: '8px',
      contents: [
        {
          type: 'text',
          text: 'ตอนนี้ออมช้ากว่าเป้า ลองพิมพ์ "ออม 500" เพื่อโอนเข้าแผนเพิ่ม',
          size: 'xs',
          color: FLEX_THEME.warnText,
          wrap: true,
        },
      ],
    });
  }

  const footer = input.assetBaseUrl
    ? cardFooter([
        actionButton(
          'ดูแผนในเว็บ',
          { type: 'uri', uri: `${trimBase(input.assetBaseUrl)}/analyze.html` },
          'primary'
        ),
      ])
    : undefined;

  return bubble({
    header: cardHeader({
      title: input.title,
      subtitle: `แผนออม · ครบเป้า ${input.dueMonth}`,
      assetBaseUrl: input.assetBaseUrl,
    }),
    body: cardBody(body),
    footer,
  });
}

/** การ์ดแผนเดียว */
export function buildPlanCard(input: PlanCardInput) {
  return {
    type: 'flex' as const,
    altText: `แผน "${input.title}" ออมแล้ว ${input.formattedSaved} จาก ${input.formattedTarget}`,
    contents: planBubble(input),
  };
}

/**
 * หลายแผนในข้อความเดียว — ผู้ใช้มีแผน active ได้สูงสุด 3 แผน (MAX_ACTIVE_PLANS)
 * แต่ยังเผื่อ MAX_BUBBLES ของ LINE ไว้ เพราะถ้าวันหนึ่งเพดานแผนถูกปรับขึ้น
 * การ์ดนี้จะตัดให้เองแทนที่จะให้ LINE ปฏิเสธทั้งข้อความ
 */
export function buildPlanCarousel(plans: PlanCardInput[]) {
  const shown = plans.slice(0, MAX_BUBBLES);
  const only = shown[0];
  if (shown.length === 1 && only) return buildPlanCard(only);

  return {
    type: 'flex' as const,
    altText: `แผนออมของคุณ ${shown.length} แผน`,
    contents: {
      type: 'carousel',
      contents: shown.map(planBubble),
    },
  };
}
