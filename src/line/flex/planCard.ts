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
};

const COLOR_MUTED = '#888888';
const COLOR_TRACK = '#EEEEEE';
const COLOR_BAR = '#1DB446';
const COLOR_BAR_OFFTRACK = '#E67E22';
const COLOR_WARN = '#E67E22';
const COLOR_TITLE = '#1a3a6b';

/** LINE ให้ carousel สูงสุด 12 bubble */
const MAX_BUBBLES = 12;

const CONFIDENCE_LABEL: Record<PlanConfidence, string> = {
  low: '🔴 ความมั่นใจต่ำ',
  medium: '🟡 ความมั่นใจกลาง',
  high: '🟢 ความมั่นใจสูง',
};

const CONFIDENCE_COLOR: Record<PlanConfidence, string> = {
  low: '#E74C3C',
  medium: '#E67E22',
  high: '#1DB446',
};

function infoRow(label: string, value: string) {
  return {
    type: 'box',
    layout: 'horizontal',
    contents: [
      { type: 'text', text: label, size: 'sm', color: COLOR_MUTED, flex: 4 },
      { type: 'text', text: value, size: 'sm', weight: 'bold', align: 'end', flex: 5 },
    ],
  };
}

/** bubble เดียว ใช้ทั้งเดี่ยวและใน carousel */
function planBubble(input: PlanCardInput) {
  const width = Math.max(0, Math.min(100, Math.round(input.percentComplete)));
  const barColor = input.offTrack ? COLOR_BAR_OFFTRACK : COLOR_BAR;

  const bodyContents: Record<string, unknown>[] = [
    {
      type: 'text',
      text: `🎯 ${input.title}`,
      weight: 'bold',
      size: 'md',
      color: COLOR_TITLE,
      wrap: true,
    },
    {
      type: 'text',
      text: CONFIDENCE_LABEL[input.confidence],
      size: 'xxs',
      color: CONFIDENCE_COLOR[input.confidence],
      margin: 'xs',
    },
    // แถบความคืบหน้า: กล่องนอกเป็นราง กล่องในคือส่วนที่ออมได้แล้ว
    {
      type: 'box',
      layout: 'vertical',
      height: '8px',
      backgroundColor: COLOR_TRACK,
      cornerRadius: '4px',
      margin: 'md',
      contents: [
        {
          type: 'box',
          layout: 'vertical',
          contents: [],
          width: `${width === 0 ? 1 : width}%`,
          backgroundColor: barColor,
          cornerRadius: '4px',
        },
      ],
    },
    {
      type: 'text',
      text: `${input.formattedSaved} / ${input.formattedTarget} (${width}%)`,
      size: 'xs',
      color: COLOR_MUTED,
      margin: 'sm',
    },
    { type: 'separator', margin: 'md' },
    {
      type: 'box',
      layout: 'vertical',
      margin: 'md',
      spacing: 'sm',
      contents: [
        infoRow('ออมเดือนละ', input.formattedMonthly),
        infoRow('ครบเป้า', input.dueMonth),
      ],
    },
  ];

  if (input.offTrack) {
    bodyContents.push({
      type: 'text',
      text: '⚠️ ตอนนี้ออมช้ากว่าเป้า',
      size: 'xs',
      color: COLOR_WARN,
      wrap: true,
      margin: 'md',
    });
  }

  return {
    type: 'bubble',
    size: 'kilo',
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: bodyContents,
    },
  };
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
