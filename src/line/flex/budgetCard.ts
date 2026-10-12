// ไฟล์นี้ทำหน้าที่อะไร: Flex สำหรับงบรายหมวดเดือนนี้ (คำสั่ง `งบ`)
// ใครรับผิดชอบ: ④ Frontend
// เขียนในสัปดาห์: W5
// อ้างอิง: SPEC.md §3 S1 ตาราง Flex Message · SRS FR-4 · SPEC §S5.8
// ⚖️ กฎเหล็ก G1, G3
//
// ⚖️ G1/G3: ยอดเงินทุกตัวรับมาเป็นสตริงที่ format จากสตางค์แล้ว การ์ดไม่แตะตัวเลขเงิน
// เปอร์เซ็นต์ที่รับมาใช้วาดความกว้างแถบอย่างเดียว ไม่ได้เอาไปคิดต่อ
//
// 🔴 ข้อบังคับจากการทดสอบบนมือถือจริง (เหมือน recordedCard.ts — ห้ามแก้กลับ)
//   1. กล่องในของแถบต้องกำหนด height เอง ไม่งั้นสูง 0 แล้วแถบหายทั้งแถบ
//   2. แถบที่สั้นมากต้องลดความมน ไม่งั้นดูเป็นจุดกลมแทนที่จะเป็นขีด

const C = {
  band: '#c6ff3d',
  bandText: '#4a5c38',
  line: '#dfe9d3',
  soft: '#f4f8ee',
  text: '#1c2416',
  strong: '#10140b',
  muted: '#6b7a5e',
  bar: '#8fbf18',
  warn: '#f5a524',
  danger: '#e5484d',
  track: '#dde6d2',
} as const;

const BAR_HEIGHT = '10px';
const ROUND_THRESHOLD = 14;
const MIN_BAR_WIDTH = 5;
/** เกินกว่านี้การ์ดจะยาวจนต้องเลื่อนหลายจอ — ที่เหลือบอกเป็นบรรทัดสรุปแทน */
const MAX_ROWS = 8;

export type BudgetCardRow = {
  categoryName: string;
  /** format แล้ว ไม่มีสตางค์ — ชื่อหมวดกับยอดอยู่บรรทัดเดียวกัน ยิ่งสั้นยิ่งไม่โดนตัด */
  formattedSpent: string;
  formattedLimit: string;
  percentUsed: number;
  level: 'ok' | 'warning' | 'over';
};

export type BudgetCardInput = {
  /** เช่น "ตุลาคม 2569" */
  monthLabel: string;
  rows: BudgetCardRow[];
  formattedTotalSpent: string;
  formattedTotalLimit: string;
  /** สัดส่วนรวมทุกหมวดที่ตั้งงบไว้ */
  totalPercentUsed: number;
  /** โดเมนที่เสิร์ฟ web/ — รูปใน Flex ต้องเป็น URL แบบ HTTPS เท่านั้น */
  assetBaseUrl: string;
};

function levelColor(level: BudgetCardRow['level']): string {
  if (level === 'over') return C.danger;
  if (level === 'warning') return C.warn;
  return C.bar;
}

function progressBar(percent: number, color: string) {
  const width = Math.max(MIN_BAR_WIDTH, Math.min(100, Math.round(percent)));
  return {
    type: 'box',
    layout: 'vertical',
    height: BAR_HEIGHT,
    backgroundColor: C.track,
    cornerRadius: '5px',
    margin: 'sm',
    contents: [
      {
        type: 'box',
        layout: 'vertical',
        contents: [],
        width: `${width}%`,
        height: BAR_HEIGHT, // 🔴 ดูหมายเหตุข้อ 1 ด้านบน
        backgroundColor: color,
        cornerRadius: width < ROUND_THRESHOLD ? '2px' : '5px',
      },
    ],
  };
}

function budgetRow(row: BudgetCardRow) {
  const color = levelColor(row.level);
  return {
    type: 'box',
    layout: 'vertical',
    margin: 'lg',
    contents: [
      {
        type: 'box',
        layout: 'horizontal',
        contents: [
          // ชื่อหมวดผู้ใช้ตั้งเองได้ ยาวแค่ไหนก็ได้ จึงต้อง wrap ไม่ใช่ปล่อยให้ตัด
          {
            type: 'text',
            text: row.categoryName,
            size: 'sm',
            weight: 'bold',
            color: C.text,
            flex: 5,
            wrap: true,
          },
          {
            type: 'text',
            text: `${Math.round(row.percentUsed)}%`,
            size: 'sm',
            weight: 'bold',
            color,
            align: 'end',
            flex: 2,
            gravity: 'center',
          },
        ],
      },
      progressBar(row.percentUsed, color),
      {
        type: 'text',
        text: `${row.formattedSpent} / ${row.formattedLimit}`,
        size: 'xxs',
        color: C.muted,
        margin: 'xs',
      },
    ],
  };
}

export function buildBudgetCard(input: BudgetCardInput) {
  const base = input.assetBaseUrl.replace(/\/$/, '');
  const shown = input.rows.slice(0, MAX_ROWS);
  const hidden = input.rows.length - shown.length;

  // หมวดที่ใกล้เต็มหรือเกินแล้วคือเหตุผลที่ผู้ใช้พิมพ์ "งบ" มาดู ต้องขึ้นก่อน
  const overCount = input.rows.filter((row) => row.level === 'over').length;
  const warnCount = input.rows.filter((row) => row.level === 'warning').length;
  const headline =
    overCount > 0
      ? `เกินงบแล้ว ${overCount} หมวด`
      : warnCount > 0
        ? `ใกล้เต็ม ${warnCount} หมวด`
        : 'งบยังอยู่ในเกณฑ์';

  const body: Record<string, unknown>[] = [
    // ยอดรวมก่อน เพราะตอบคำถาม "ภาพรวมเดือนนี้เป็นยังไง" ได้ในบรรทัดเดียว
    {
      type: 'box',
      layout: 'vertical',
      paddingAll: '12px',
      backgroundColor: C.soft,
      cornerRadius: '8px',
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            { type: 'text', text: 'รวมทุกหมวด', size: 'xs', color: C.muted, flex: 0 },
            {
              type: 'text',
              text: `${input.formattedTotalSpent} / ${input.formattedTotalLimit}`,
              size: 'xs',
              weight: 'bold',
              color: C.text,
              align: 'end',
            },
          ],
        },
        progressBar(
          input.totalPercentUsed,
          input.totalPercentUsed >= 100 ? C.danger : input.totalPercentUsed >= 80 ? C.warn : C.bar
        ),
      ],
    },
    { type: 'separator', margin: 'lg', color: C.line },
    ...shown.map(budgetRow),
  ];

  if (hidden > 0) {
    body.push({
      type: 'text',
      text: `และอีก ${hidden} หมวด — ดูครบได้ที่หน้าหมวดหมู่ในเว็บ`,
      size: 'xxs',
      color: C.muted,
      wrap: true,
      margin: 'lg',
    });
  }

  return {
    type: 'flex' as const,
    // altText ขึ้นใน notification ต้องบอกสถานะได้โดยไม่ต้องเปิดการ์ด
    altText: `งบ ${input.monthLabel} — ${headline} · ใช้ไป ${input.formattedTotalSpent} จาก ${input.formattedTotalLimit}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'horizontal',
        backgroundColor: C.band,
        paddingAll: '16px',
        paddingBottom: '12px',
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            flex: 5,
            contents: [
              { type: 'text', text: 'งบเดือนนี้', size: 'lg', weight: 'bold', color: C.strong },
              {
                type: 'text',
                text: `${input.monthLabel} · ${headline}`,
                size: 'xxs',
                color: C.bandText,
                margin: 'xs',
                wrap: true,
              },
            ],
          },
          {
            type: 'image',
            url: `${base}/img/mascot/happy.png`,
            size: 'xs',
            flex: 2,
            aspectMode: 'fit',
            gravity: 'center',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '16px',
        spacing: 'none',
        contents: body,
      },
      footer: {
        type: 'box',
        layout: 'horizontal',
        paddingAll: '14px',
        paddingTop: 'none',
        contents: [
          {
            type: 'button',
            style: 'secondary',
            height: 'sm',
            action: { type: 'message', label: 'ใช้ได้อีกเท่าไหร่', text: 'เหลือ' },
          },
        ],
      },
    },
  };
}
