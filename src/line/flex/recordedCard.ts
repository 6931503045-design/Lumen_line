// ไฟล์นี้ทำหน้าที่อะไร: การ์ด "บันทึกแล้ว" — รายการที่เพิ่งจด พร้อมแถบงบของหมวดนั้น
// ใครรับผิดชอบ: ④ Frontend
// เขียนในสัปดาห์: W5
// อ้างอิง: SPEC.md §3 S1 ตาราง Flex Message · SRS FR-1 / FR-4
// ⚖️ กฎเหล็ก G1, G3, G7
//
// ⚖️ G1/G3: ยอดเงินทุกตัวรับมาเป็นสตริงที่ format จากสตางค์แล้ว การ์ดไม่แตะตัวเลขเงิน
// เปอร์เซ็นต์ที่รับมาใช้เป็น "ความกว้างแถบ" อย่างเดียว ไม่ได้เอาไปคิดเงินต่อ
//
// การ์ดนี้คือแม่แบบของการ์ดทุกใบ — ชิ้นส่วนที่ใช้ร่วมกัน (หัวการ์ด แถบ ป้าย) ย้ายไปอยู่ที่ theme.ts
// บทเรียนจากการทดสอบบนมือถือจริง 3 ข้อ (แถบหาย / ป้ายกลม / ไอคอนหาย) ดูที่หัวไฟล์ theme.ts
//   ข้อ 3 เกี่ยวกับไฟล์นี้โดยตรง: ไอคอนต้องเป็น child ตรงๆ ของแถว horizontal ห้ามห่อ box

import {
  actionButton,
  bubble,
  cardBody,
  cardFooter,
  cardHeader,
  FLEX_THEME as C,
  heavyDivider,
  progressBar,
  trimBase,
  typeTag,
} from './theme';

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

/** ป้าย "รายจ่าย · อาหาร" — ประเภทกับหมวดอยู่ในป้ายเดียว แบบการ์ดในสไลด์นำเสนอ */
function groupHeader(group: RecordedGroup) {
  return {
    type: 'box',
    layout: 'horizontal',
    margin: 'lg',
    contents: [typeTag(group.type, group.categoryName)],
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
            size: 'md',
            color: item.title ? C.text : C.muted,
            flex: 5,
            wrap: true,
            gravity: 'center',
          },
          {
            type: 'text',
            text: item.formattedAmount,
            size: 'lg',
            weight: 'bold',
            color: isIncome ? C.income : C.strong,
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

/**
 * แถวงบ: "งบอาหารเดือนนี้ ........ 62%" แล้วแถบ แล้วยอด "฿1,240 / ฿2,000"
 * ข้อมูลชุดเดิมทุกตัว (ชื่อหมวด ใช้ไป เพดาน เปอร์เซ็นต์) แค่จัดวางแบบการ์ดในสไลด์นำเสนอ
 * ⚖️ G1: เปอร์เซ็นต์มาจาก service แล้ว ที่นี่แค่ปัดเพื่อแสดงผล
 */
function budgetRow(budget: RecordedBudget) {
  const percent = Math.round(budget.percentUsed);
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
            text: `งบ${budget.categoryName}เดือนนี้`,
            size: 'xs',
            color: C.muted,
            flex: 5,
            wrap: true,
          },
          {
            type: 'text',
            text: `${percent}%`,
            size: 'xs',
            weight: 'bold',
            color: percent >= 100 ? C.danger : percent >= 80 ? C.warnText : C.muted,
            align: 'end',
            flex: 2,
            gravity: 'center',
          },
        ],
      },
      progressBar(budget.percentUsed),
      {
        type: 'text',
        text: `${budget.formattedSpent} / ${budget.formattedLimit}`,
        size: 'xxs',
        color: C.muted,
        align: 'end',
        margin: 'sm',
      },
    ],
  };
}

export function buildRecordedCard(input: RecordedCardInput) {
  const base = trimBase(input.assetBaseUrl);
  const count = input.groups.reduce((sum, group) => sum + group.items.length, 0);

  const body: Record<string, unknown>[] = [];
  input.groups.forEach((group, index) => {
    if (index > 0) body.push({ type: 'separator', margin: 'md', color: C.line });
    body.push(groupHeader(group));
    group.items.forEach((item) => body.push(itemRow(item, group.type === 'income', base)));
  });

  if (input.budgets.length > 0) {
    body.push(heavyDivider());
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
    contents: bubble({
      header: cardHeader({
        title: headline,
        subtitle: 'อย่าลืมตรวจรายการที่บันทึกไว้นะ',
        assetBaseUrl: base,
      }),
      body: cardBody(body),
      // ปุ่มเปลี่ยนหมวด (FR-01 / SPEC §S1) — หมวดคือสิ่งที่ระบบเดาผิดบ่อยที่สุด
      // ใส่เฉพาะการ์ดรายการเดียว: การ์ดหลายรายการไม่รู้ว่าผู้ใช้หมายถึงแถวไหน (แก้ทีละแถวได้ที่หน้าเว็บ)
      ...(count === 1 && first
        ? {
            footer: cardFooter([
              actionButton('เปลี่ยนหมวด', {
                type: 'postback',
                data: `action=edit_category&id=${first.transactionId}`,
                displayText: 'เปลี่ยนหมวด',
              }),
            ]),
          }
        : {}),
    }),
  };
}
