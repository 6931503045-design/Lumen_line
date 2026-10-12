// ไฟล์นี้ทำหน้าที่อะไร: การ์ด "บันทึกแล้ว" — รายการที่เพิ่งจด พร้อมแถบงบของหมวดนั้น
// ใครรับผิดชอบ: ④ Frontend
// เขียนในสัปดาห์: W5
// อ้างอิง: SPEC.md §3 S1 ตาราง Flex Message · SRS FR-1 / FR-4
// ⚖️ กฎเหล็ก G1, G3, G7
//
// ⚖️ G1/G3: ยอดเงินทุกตัวรับมาเป็นสตริงที่ format จากสตางค์แล้ว การ์ดไม่แตะตัวเลขเงิน
// เปอร์เซ็นต์ที่รับมาใช้เป็น "ความกว้างแถบ" อย่างเดียว ไม่ได้เอาไปคิดเงินต่อ
//
// 🔴 บทเรียนจากการทดสอบบนมือถือจริง — Flex Simulator บนเดสก์ท็อปผ่อนผันกว่าแอป LINE
// สามข้อนี้ Simulator วาดให้เห็นปกติ แต่บนเครื่องจริงพัง ห้ามแก้กลับ:
//   1. กล่องในของแถบต้องกำหนด height เอง ไม่งั้นสูง 0 แล้วแถบหายทั้งแถบ
//   2. ป้ายต้องเป็น layout 'vertical' + flex 0 — ถ้าใช้ 'baseline' กล่องยุบจนกลายเป็นวงกลม
//   3. ไอคอนต้องเป็น child ตรงๆ ของแถว horizontal ห้ามห่อ box ที่ flex 0 ไม่งั้นหายไปเลย

const C = {
  band: '#c6ff3d',
  bandText: '#4a5c38',
  line: '#dfe9d3',
  text: '#1c2416',
  strong: '#10140b',
  muted: '#6b7a5e',
  dark: '#14170f',
  onDark: '#f6faf0',
  incomeBg: '#e4f4e5',
  bar: '#8fbf18',
  warn: '#f5a524',
  danger: '#e5484d',
  track: '#dde6d2',
} as const;

const BAR_HEIGHT = '10px';
/** ต่ำกว่านี้แถบจะมนจนดูเหมือนจุด ไม่ใช่ขีด */
const ROUND_THRESHOLD = 14;
/** ยกพื้นขั้นต่ำให้แถบยังอ่านออก — ยอดจริงพิมพ์อยู่ข้างแถบแล้ว จึงไม่ทำให้เข้าใจผิด */
const MIN_BAR_WIDTH = 5;

export type RecordedItem = {
  transactionId: string;
  /** เช่น "8 ต.ค. 2569 19:55" — format มาแล้ว */
  occurredLabel: string;
  /**
   * ชื่อรายการ เช่น "กาแฟเย็น" — ไม่ใส่ก็ได้
   * ทางด่วน (regex) อ่านได้แค่หมวดกับยอด ไม่มีชื่อรายการแยก ถ้าใส่ชื่อหมวดซ้ำลงมา
   * จะกลายเป็นข้อความเดียวกันสองที่ติดกัน จึงปล่อยว่างแล้วให้แถวเหลือแค่เวลากับยอด
   */
  title?: string;
  /** format แล้ว เช่น "฿80" */
  formattedAmount: string;
};

export type RecordedGroup = {
  type: 'income' | 'expense';
  categoryName: string;
  items: RecordedItem[];
};

export type RecordedBudget = {
  categoryName: string;
  /** format แล้ว ไม่ต้องมีสตางค์ — แถวนี้แคบ ยิ่งสั้นยิ่งไม่โดนตัด */
  formattedSpent: string;
  formattedLimit: string;
  percentUsed: number;
};

export type RecordedCardInput = {
  groups: RecordedGroup[];
  budgets: RecordedBudget[];
  /** เช่น "รอบงบ: รายเดือน (เริ่มวันที่ 1)" */
  periodNote: string;
  /** โดเมนที่เสิร์ฟ web/ — รูปใน Flex ต้องเป็น URL แบบ HTTPS เท่านั้น */
  assetBaseUrl: string;
};

function barColor(percent: number): string {
  if (percent >= 100) return C.danger;
  if (percent >= 80) return C.warn;
  return C.bar;
}

function progressBar(percent: number) {
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
        backgroundColor: barColor(percent),
        cornerRadius: width < ROUND_THRESHOLD ? '2px' : '5px',
      },
    ],
  };
}

/** ป้ายเม็ดมน — 🔴 ต้อง vertical ไม่ใช่ baseline (หมายเหตุข้อ 2) */
function pill(label: string, background: string, color: string) {
  return {
    type: 'box',
    layout: 'vertical',
    flex: 0,
    backgroundColor: background,
    cornerRadius: '12px',
    paddingTop: '3px',
    paddingBottom: '3px',
    paddingStart: '10px',
    paddingEnd: '10px',
    contents: [{ type: 'text', text: label, size: 'xxs', weight: 'bold', color, align: 'center' }],
  };
}

/**
 * ไอคอนที่กดได้
 *
 * 🔴 ต้องเป็น image ไม่ใช่ icon — component icon ใช้ได้เฉพาะใน baseline box
 * และ action ต้องอยู่บนตัว image เอง ไม่ใช่กล่องที่ครอบ ไม่งั้นแตะแล้วไม่ติด
 */
function iconButton(url: string, label: string, action: Record<string, unknown>) {
  return {
    type: 'image',
    url,
    size: '18px',
    flex: 0,
    margin: 'md',
    aspectMode: 'fit',
    action,
  };
}

function groupHeader(group: RecordedGroup) {
  const isIncome = group.type === 'income';
  return {
    type: 'box',
    layout: 'horizontal',
    margin: 'lg',
    spacing: 'sm',
    contents: [
      pill(
        isIncome ? 'รายรับ' : 'รายจ่าย',
        isIncome ? C.incomeBg : C.dark,
        isIncome ? '#2f7a33' : C.onDark
      ),
      {
        type: 'text',
        text: group.categoryName,
        size: 'sm',
        weight: 'bold',
        color: C.text,
        gravity: 'center',
      },
    ],
  };
}

function itemRow(item: RecordedItem, isIncome: boolean, base: string) {
  return {
    type: 'box',
    layout: 'vertical',
    margin: 'md',
    contents: [
      { type: 'text', text: item.occurredLabel, size: 'xxs', color: C.muted },
      {
        type: 'box',
        layout: 'horizontal',
        margin: 'xs',
        contents: [
          {
            type: 'text',
            text: item.title ?? 'รายการนี้',
            size: 'sm',
            color: item.title ? C.text : C.muted,
            flex: 5,
            wrap: true,
            gravity: 'center',
          },
          {
            type: 'text',
            text: item.formattedAmount,
            size: 'sm',
            weight: 'bold',
            color: isIncome ? '#2f7a33' : C.strong,
            align: 'end',
            flex: 4,
            gravity: 'center',
          },
          // 🔴 ไอคอนอยู่ตรงนี้ ไม่ห่อ box (หมายเหตุข้อ 3)
          //
          // ✏️ ใช้ uri ไม่ใช่ postback โดยตั้งใจ: การแก้ไขต้องกรอกยอด/วันเวลา/หมวด
          // ซึ่งทำในแชทลำบาก ส่วนหน้าเว็บมีฟอร์มครบอยู่แล้ว พาไปที่รายการนั้นเลยเร็วกว่า
          // (เคยเป็น postback action=edit ซึ่ง postbackHandler ไม่มี case รองรับ
          //  กดแล้วเงียบสนิทไม่มีอะไรเกิดขึ้น)
          iconButton(`${base}/img/icon/pencil.png`, 'แก้ไข', {
            type: 'uri',
            label: 'แก้ไข',
            uri: `${base}/transactions.html?tx=${encodeURIComponent(item.transactionId)}`,
          }),
          iconButton(`${base}/img/icon/trash-2.png`, 'ลบ', {
            type: 'postback',
            label: 'ลบ',
            data: `action=undo&id=${item.transactionId}`,
            displayText: 'ลบรายการนี้',
          }),
        ],
      },
    ],
  };
}

function budgetRow(budget: RecordedBudget) {
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
            text: budget.categoryName,
            size: 'sm',
            weight: 'bold',
            color: C.text,
            flex: 5,
            wrap: true,
          },
          // ตัวเล็กกว่าชื่อเพราะแถวนี้แคบ และยอดยาวกว่าชื่อได้ง่าย
          {
            type: 'text',
            text: `${budget.formattedSpent} / ${budget.formattedLimit}`,
            size: 'xs',
            color: C.text,
            align: 'end',
            flex: 5,
            gravity: 'center',
          },
        ],
      },
      progressBar(budget.percentUsed),
    ],
  };
}

export function buildRecordedCard(input: RecordedCardInput) {
  const base = input.assetBaseUrl.replace(/\/$/, '');
  const count = input.groups.reduce((sum, group) => sum + group.items.length, 0);

  const body: Record<string, unknown>[] = [];
  input.groups.forEach((group, index) => {
    if (index > 0) body.push({ type: 'separator', margin: 'md', color: C.line });
    body.push(groupHeader(group));
    group.items.forEach((item) => body.push(itemRow(item, group.type === 'income', base)));
  });

  if (input.budgets.length > 0) {
    body.push({
      type: 'box',
      layout: 'vertical',
      height: '2px',
      backgroundColor: C.dark,
      margin: 'xl',
      contents: [],
    });
    input.budgets.forEach((budget) => body.push(budgetRow(budget)));
    body.push({
      type: 'text',
      text: input.periodNote,
      size: 'xxs',
      color: C.muted,
      align: 'end',
      margin: 'lg',
    });
  }

  const headline = count > 1 ? `บันทึกแล้ว ${count} รายการ` : 'บันทึกแล้ว';
  const first = input.groups[0]?.items[0];

  return {
    type: 'flex' as const,
    // altText ขึ้นใน notification และในเครื่องที่แสดง Flex ไม่ได้ ต้องมียอดให้ครบ
    altText:
      count === 1 && first
        ? `บันทึก ${first.title ?? input.groups[0]?.categoryName ?? 'รายการ'} ${first.formattedAmount} แล้ว`
        : headline,
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
              { type: 'text', text: headline, size: 'lg', weight: 'bold', color: C.strong },
              {
                type: 'text',
                text: 'อย่าลืมตรวจรายการที่บันทึกไว้นะ',
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
        paddingTop: '8px',
        spacing: 'none',
        contents: body,
      },
    },
  };
}
