// ไฟล์นี้ทำหน้าที่อะไร: ทดสอบการ์ด Flex ทั้ง 4 ใบ + rich menu (SPEC §3 S1 ตาราง Flex Message)
// ใครรับผิดชอบ: ④ Frontend
// เขียนในสัปดาห์: W3
// ⚖️ กฎเหล็ก G1, G2
//
// สิ่งที่เทสต์ชุดนี้คุ้มครองจริง ไม่ใช่แค่ "มีฟิลด์ครบ":
//   1. G2 — ค่า postback ของปุ่มในการ์ดต้องตรงกับที่ postbackHandler รับ ถ้าหลุดจะกดแล้วเงียบ
//   2. ความกว้างแถบต้องอยู่ใน 0–100% ไม่งั้น LINE ปฏิเสธทั้งข้อความ ไม่ใช่แค่แถบเพี้ยน
//   3. พิกัด rich menu ต้องปูเต็ม 2500 px พอดี ไม่เหลือแถบที่กดแล้วไม่เกิดอะไร

import { describe, expect, it } from 'vitest';
import { buildSummaryCard } from '../src/line/flex/summaryCard';
import { buildPlanCard, buildPlanCarousel } from '../src/line/flex/planCard';
import {
  buildErrorCard,
  buildUnreadableCard,
  buildAmountTooLargeCard,
} from '../src/line/flex/errorCard';
import { buildPendingCard } from '../src/line/flex/pendingCard';
import { buildRichMenu, RICH_MENU_SIZE } from '../src/line/richmenu';

/** เดินทั้ง object หาค่าทุกตัวของ key ที่สนใจ — ใช้ตรวจโครง Flex ที่ซ้อนกันหลายชั้น */
function collect(node: unknown, key: string, found: unknown[] = []): unknown[] {
  if (Array.isArray(node)) {
    for (const item of node) collect(item, key, found);
  } else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (k === key) found.push(v);
      collect(v, key, found);
    }
  }
  return found;
}

const summaryInput = {
  monthLabel: 'ก.ย. 2569',
  formattedIncome: '฿15,000.00',
  formattedExpense: '฿8,200.00',
  formattedBalance: '฿6,800.00',
  balanceIsNegative: false,
  topCategories: [
    { name: 'อาหาร', formattedAmount: '฿3,200.00', percent: 39 },
    { name: 'เดินทาง', formattedAmount: '฿2,000.00', percent: 24 },
  ],
};

describe('summaryCard', () => {
  it('altText มีตัวเลขครบ สำหรับเครื่องที่แสดง Flex ไม่ได้', () => {
    const card = buildSummaryCard(summaryInput);
    expect(card.type).toBe('flex');
    expect(card.altText).toContain('฿15,000.00');
    expect(card.altText).toContain('฿8,200.00');
    expect(card.altText).toContain('฿6,800.00');
  });

  it('แสดงยอดที่ format มาแล้วตรงตัว ไม่คำนวณเอง (G1)', () => {
    const texts = collect(buildSummaryCard(summaryInput), 'text') as string[];
    expect(texts).toContain('฿15,000.00');
    expect(texts).toContain('฿8,200.00');
    expect(texts).toContain('฿6,800.00');
  });

  it('ตัดเหลือ 3 หมวดแม้ส่งมา 5 (SPEC กำหนด top 3)', () => {
    const many = {
      ...summaryInput,
      topCategories: ['ก', 'ข', 'ค', 'ง', 'จ'].map((name) => ({
        name,
        formattedAmount: '฿100.00',
        percent: 20,
      })),
    };
    const texts = collect(buildSummaryCard(many), 'text') as string[];
    expect(texts).toContain('ค');
    expect(texts).not.toContain('ง');
  });

  it('ส่วนต่างติดลบใช้สีแดง บวกใช้สีเขียว — ผู้เรียกเป็นคนบอกว่าติดลบ ไม่ใช่การ์ดเดา', () => {
    const minus = buildSummaryCard({ ...summaryInput, balanceIsNegative: true });
    const plus = buildSummaryCard(summaryInput);
    expect(JSON.stringify(minus)).toContain('#E74C3C');
    expect(collect(plus, 'color')).toContain('#1DB446');
  });

  it('ความกว้างแถบอยู่ใน 1–100% เสมอ แม้ percent จะเพี้ยนมาจากต้นทาง', () => {
    const weird = {
      ...summaryInput,
      topCategories: [
        { name: 'ติดลบ', formattedAmount: '฿0.00', percent: -40 },
        { name: 'เกินร้อย', formattedAmount: '฿0.00', percent: 180 },
      ],
    };
    const widths = collect(buildSummaryCard(weird), 'width') as string[];
    for (const w of widths) {
      const value = Number(String(w).replace('%', ''));
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(100);
    }
  });

  it('ใส่ footnote ได้เมื่อยังไม่มีรายการ', () => {
    const card = buildSummaryCard({ ...summaryInput, footnote: 'ยังไม่มีรายการเลย' });
    expect(collect(card, 'text')).toContain('ยังไม่มีรายการเลย');
  });
});

const planInput = {
  title: 'โน้ตบุ๊ก',
  formattedTarget: '฿25,000.00',
  formattedSaved: '฿5,000.00',
  formattedMonthly: '฿2,000.00',
  percentComplete: 20,
  confidence: 'medium' as const,
  dueMonth: 'มิ.ย. 2570',
};

describe('planCard', () => {
  it('มีป้ายระดับความมั่นใจเสมอ (SRS §3.6 บังคับ)', () => {
    for (const [level, label] of [
      ['low', 'ความมั่นใจต่ำ'],
      ['medium', 'ความมั่นใจกลาง'],
      ['high', 'ความมั่นใจสูง'],
    ] as const) {
      const card = buildPlanCard({ ...planInput, confidence: level });
      expect(JSON.stringify(card)).toContain(label);
    }
  });

  it('แถบความคืบหน้ากว้างตาม percentComplete', () => {
    const widths = collect(buildPlanCard({ ...planInput, percentComplete: 20 }), 'width');
    expect(widths).toContain('20%');
  });

  it('🔴 กล่องในของแถบต้องมี height ของตัวเอง ไม่งั้นแถบหายบนมือถือจริง', () => {
    // เคยพลาดมาแล้ว: กล่องที่ contents ว่างและไม่กำหนด height จะสูง 0 บนแอป LINE
    // แต่ Flex Simulator บนเดสก์ท็อปยังวาดให้เห็น บั๊กจึงหลุดไปถึงเครื่องจริง
    const json = JSON.stringify(buildPlanCard(planInput));
    const inner = JSON.parse(json).contents.body.contents.find(
      (c: { backgroundColor?: string }) => c.backgroundColor === '#EEEEEE'
    );
    expect(inner.height).toBeTruthy();
    expect(inner.contents[0].height).toBe(inner.height);
  });

  it('percent 0 ยังวาดแถบได้ ไม่ใช่ 0% ที่ LINE ไม่รับ', () => {
    const widths = collect(buildPlanCard({ ...planInput, percentComplete: 0 }), 'width');
    expect(widths).toContain('1%');
  });

  it('แผนที่หลุดเป้ามีคำเตือนและเปลี่ยนสีแถบ', () => {
    const json = JSON.stringify(buildPlanCard({ ...planInput, offTrack: true }));
    expect(json).toContain('ออมช้ากว่าเป้า');
    expect(json).toContain('#E67E22');
  });

  it('แผนเดียวได้ bubble ไม่ใช่ carousel', () => {
    const card = buildPlanCarousel([planInput]);
    expect((card.contents as { type: string }).type).toBe('bubble');
  });

  it('หลายแผนได้ carousel และตัดไม่เกิน 12 ตามเพดานของ LINE', () => {
    const many = Array.from({ length: 15 }, (_, i) => ({ ...planInput, title: `แผน ${i}` }));
    const card = buildPlanCarousel(many);
    const contents = card.contents as { type: string; contents: unknown[] };
    expect(contents.type).toBe('carousel');
    expect(contents.contents).toHaveLength(12);
  });
});

describe('errorCard', () => {
  it('แสดงสาเหตุและตัวอย่างวิธีพิมพ์ที่ถูก', () => {
    const texts = collect(
      buildErrorCard({ title: 'หัวข้อ', reason: 'เหตุผล', examples: ['กาแฟ 80'] }),
      'text'
    ) as string[];
    expect(texts.some((t) => t.includes('หัวข้อ'))).toBe(true);
    expect(texts).toContain('เหตุผล');
    expect(texts).toContain('กาแฟ 80');
  });

  it('ไม่มีตัวอย่างก็ยังสร้างการ์ดได้', () => {
    const card = buildErrorCard({ title: 'ก', reason: 'ข' });
    expect(card.type).toBe('flex');
    expect(collect(card, 'text')).not.toContain('ลองพิมพ์แบบนี้');
  });

  it('การ์ดอ่านข้อความไม่ออกมีตัวอย่างทั้งรายรับและรายจ่าย', () => {
    const texts = collect(buildUnreadableCard(), 'text') as string[];
    expect(texts).toContain('กาแฟ 80');
    expect(texts.some((t) => t.startsWith('+'))).toBe(true);
  });

  it('การ์ดยอดเกินเพดานบอกเพดานที่ format มาแล้ว', () => {
    expect(JSON.stringify(buildAmountTooLargeCard('฿10,000,000.00'))).toContain(
      '฿10,000,000.00'
    );
  });
});

describe('pendingCard', () => {
  const card = buildPendingCard({ pendingId: 'p-123', summary: 'จ่ายค่าข้าว 80 บาท' });

  it('🔴 ค่า postback ต้องตรงกับที่ postbackHandler รับ ไม่งั้นกดแล้วเงียบ', () => {
    const data = collect(card, 'data') as string[];
    expect(data).toContain('action=ai_confirm&id=p-123');
    expect(data).toContain('action=ai_cancel&id=p-123');
  });

  it('มีปุ่มยืนยันและปุ่มปฏิเสธครบสองปุ่ม (G2)', () => {
    const labels = collect(card, 'label') as string[];
    expect(labels).toHaveLength(2);
    expect(labels.join(' ')).toContain('ยืนยัน');
  });

  it('บอกชัดว่ายังไม่ได้บันทึก — ป้องกันผู้ใช้เข้าใจว่าบันทึกไปแล้ว (G2)', () => {
    expect(JSON.stringify(card)).toContain('ยังไม่ได้บันทึก');
  });

  it('แสดงสิ่งที่ AI เข้าใจให้ตรวจก่อนกด', () => {
    expect(collect(card, 'text')).toContain('จ่ายค่าข้าว 80 บาท');
  });
});

describe('richmenu', () => {
  const menu = buildRichMenu('https://example.test');

  it('มี 6 ช่องตามที่ออกแบบไว้', () => {
    expect(menu.areas).toHaveLength(6);
  });

  it('🔴 ช่องปูเต็มความกว้าง 2500 px พอดีทุกแถว ไม่เหลือแถบที่กดไม่ได้', () => {
    for (const row of [0, 1]) {
      const y = row * (RICH_MENU_SIZE.height / 2);
      const widthSum = menu.areas
        .filter((area) => area.bounds.y === y)
        .reduce((sum, area) => sum + area.bounds.width, 0);
      expect(widthSum).toBe(RICH_MENU_SIZE.width);
    }
  });

  it('ช่องไม่ทับกัน', () => {
    const seen = new Set<string>();
    for (const area of menu.areas) {
      const key = `${area.bounds.x},${area.bounds.y}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('5 ช่องส่งคำสั่งที่ command.service รองรับอยู่แล้ว ไม่พึ่ง AI (G4)', () => {
    const texts = menu.areas
      .filter((area) => area.action.type === 'message')
      .map((area) => area.action.text);
    expect(texts).toEqual(['สรุป', 'เหลือ', 'งบ', 'แผน', 'ช่วยเหลือ']);
  });

  it('ช่องเปิดเว็บใช้ uri ที่ส่งเข้ามา', () => {
    const uri = menu.areas.find((area) => area.action.type === 'uri');
    expect(uri?.action.uri).toBe('https://example.test');
  });
});
