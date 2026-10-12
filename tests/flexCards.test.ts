// ไฟล์นี้ทำหน้าที่อะไร: ทดสอบการ์ด Flex ทั้ง 4 ใบ + rich menu (SPEC §3 S1 ตาราง Flex Message)
// ใครรับผิดชอบ: ④ Frontend
// เขียนในสัปดาห์: W3
// ⚖️ กฎเหล็ก G1, G2
//
// สิ่งที่เทสต์ชุดนี้คุ้มครองจริง ไม่ใช่แค่ "มีฟิลด์ครบ":
//   1. G2 — ค่า postback ของปุ่มในการ์ดต้องตรงกับที่ postbackHandler รับ ถ้าหลุดจะกดแล้วเงียบ
//   2. ความกว้างแถบต้องอยู่ใน 0–100% ไม่งั้น LINE ปฏิเสธทั้งข้อความ ไม่ใช่แค่แถบเพี้ยน
//   3. พิกัด rich menu ต้องปูเต็ม 2500 px พอดี ไม่เหลือแถบที่กดแล้วไม่เกิดอะไร

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildSummaryCard } from '../src/line/flex/summaryCard';
import { buildPlanCard, buildPlanCarousel } from '../src/line/flex/planCard';
import {
  buildErrorCard,
  buildUnreadableCard,
  buildAmountTooLargeCard,
} from '../src/line/flex/errorCard';
import { buildPendingCard } from '../src/line/flex/pendingCard';
import { buildRecordedCard } from '../src/line/flex/recordedCard';
import { buildBudgetCard } from '../src/line/flex/budgetCard';
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

  it('แถบสั้นมากต้องยังอ่านออกว่าเป็นขีด ไม่ใช่จุดกลม', () => {
    // ทดสอบบนมือถือจริงแล้วพบว่า 1–2% บนรางสูง 8–10px กว้างราว 6px
    // พอใส่ cornerRadius 4px เลยกลมจนดูเหมือนจุด ไม่ใช่แถบที่เพิ่งเริ่ม
    // จึงยกพื้นขั้นต่ำเป็น 5% และลดความมนลงเมื่อสั้น
    const card = buildPlanCard({ ...planInput, percentComplete: 0 });
    const widths = collect(card, 'width') as string[];
    expect(widths).toContain('5%');
    const radii = collect(card, 'cornerRadius') as string[];
    expect(radii).toContain('2px');
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

  it('5 ช่องเปิดหน้าเว็บคนละหน้า ไม่ซ้ำกัน', () => {
    const uris = menu.areas
      .filter((area) => area.action.type === 'uri')
      .map((area) => area.action.uri);
    expect(uris).toEqual([
      'https://example.test/index.html',
      'https://example.test/transactions.html',
      'https://example.test/categories.html',
      'https://example.test/analyze.html',
      'https://example.test/settings.html',
    ]);
  });

  it('ช่อง "เหลือ" ยังเป็นคำสั่งในแชท เพราะต้องตอบทันที ไม่รอ webview โหลด', () => {
    const messages = menu.areas.filter((area) => area.action.type === 'message');
    expect(messages).toHaveLength(1);
    expect(messages[0]!.action.text).toBe('เหลือ');
  });

  it('ไม่มีช่องไหนพึ่ง AI — ปิด AI แล้วเมนูยังใช้ได้ครบ (G4)', () => {
    const kinds = new Set(menu.areas.map((area) => area.action.type));
    expect([...kinds].sort()).toEqual(['message', 'uri']);
  });

  it('baseUrl ที่มี / ต่อท้าย ต้องไม่ทำให้ URL มี // ซ้อน', () => {
    const withSlash = buildRichMenu('https://example.test/');
    const uris = withSlash.areas
      .filter((a) => a.action.type === 'uri')
      .map((a) => a.action.uri as string);
    expect(uris.every((u) => !u.replace('https://', '').includes('//'))).toBe(true);
  });
});

describe('recordedCard', () => {
  const base = 'https://example.test';
  const input = {
    groups: [
      {
        type: 'expense' as const,
        categoryName: 'อาหาร',
        items: [
          {
            transactionId: 't1',
            occurredLabel: '8 ต.ค. 2569 19:55',
            title: 'กาแฟเย็น',
            formattedAmount: '฿80',
          },
        ],
      },
    ],
    budgets: [
      { categoryName: 'อาหาร', formattedSpent: '฿3,280', formattedLimit: '฿4,000', percentUsed: 82 },
    ],
    periodNote: 'รอบงบ: รายเดือน (เริ่มวันที่ 1)',
    assetBaseUrl: base,
  };

  it('🔴 กล่องในของแถบมี height เท่ากล่องนอก (บั๊กที่เคยทำแถบหายบนมือถือ)', () => {
    const card = buildRecordedCard(input);
    const heights = collect(card, 'height') as string[];
    // ราง + แถบใน ต้องสูงเท่ากันทั้งคู่ ไม่ใช่มีแค่รางอันเดียว
    expect(heights.filter((h) => h === '10px')).toHaveLength(2);
  });

  it('🔴 ป้ายหมวดต้องเป็น vertical ไม่ใช่ baseline ไม่งั้นยุบเป็นวงกลม', () => {
    const json = JSON.parse(JSON.stringify(buildRecordedCard(input)));
    const header = json.contents.body.contents[0];
    expect(header.contents[0].layout).toBe('vertical');
    expect(header.contents[0].flex).toBe(0);
  });

  it('🔴 ไอคอนเป็น child ตรงของแถว ไม่ถูกห่อ box (ไม่งั้นหายบนมือถือ)', () => {
    const json = JSON.parse(JSON.stringify(buildRecordedCard(input)));
    const row = json.contents.body.contents[1].contents[1];
    const icons = row.contents.filter((c: { type: string }) => c.type === 'image');
    expect(icons).toHaveLength(2);
    expect(icons[0].url).toBe(`${base}/img/icon/pencil.png`);
    expect(icons[1].url).toBe(`${base}/img/icon/trash-2.png`);
  });

  it('ปุ่มลบยิง postback ที่ postbackHandler รับอยู่', () => {
    const data = collect(buildRecordedCard(input), 'data') as string[];
    expect(data).toContain('action=undo&id=t1');
  });

  it('แถบเปลี่ยนสีตามระดับ ไม่ใช่สีเดียวตลอด', () => {
    const at = (p: number) =>
      JSON.stringify(buildRecordedCard({ ...input, budgets: [{ ...input.budgets[0]!, percentUsed: p }] }));
    expect(at(20)).toContain('#8fbf18');
    expect(at(85)).toContain('#f5a524');
    expect(at(120)).toContain('#e5484d');
  });

  it('หมวดที่ยังไม่ได้ตั้งงบ ไม่วาดส่วนแถบเลย ดีกว่าโชว์แถบเปล่า', () => {
    const card = buildRecordedCard({ ...input, budgets: [] });
    expect(JSON.stringify(card)).not.toContain('รอบงบ');
  });

  it('หลายรายการนับรวมในหัวการ์ด', () => {
    const card = buildRecordedCard({
      ...input,
      groups: [
        input.groups[0]!,
        { type: 'expense' as const, categoryName: 'เครื่องดื่ม', items: [
          { transactionId: 't2', occurredLabel: 'x', title: 'เป๊ปซี่', formattedAmount: '฿10' },
          { transactionId: 't3', occurredLabel: 'x', title: 'โค้ก', formattedAmount: '฿15' }]},
      ],
    });
    expect(collect(card, 'text')).toContain('บันทึกแล้ว 3 รายการ');
  });

  it('ไม่มีชื่อรายการก็ยังสร้างการ์ดได้ และ altText ใช้ชื่อหมวดแทน', () => {
    const card = buildRecordedCard({
      ...input,
      groups: [{ ...input.groups[0]!, items: [{ ...input.groups[0]!.items[0]!, title: undefined }] }],
    });
    expect(card.altText).toContain('อาหาร');
    expect(card.altText).toContain('฿80');
  });

  it('assetBaseUrl ที่มี / ต่อท้าย ต้องไม่ทำให้ URL มี // ซ้อน', () => {
    const card = buildRecordedCard({ ...input, assetBaseUrl: 'https://example.test/' });
    const urls = collect(card, 'url') as string[];
    expect(urls.every((u) => !u.replace('https://', '').includes('//'))).toBe(true);
  });
});

describe('budgetCard', () => {
  const base = 'https://example.test';
  const row = (name: string, pct: number, level: 'ok' | 'warning' | 'over') => ({
    categoryName: name,
    formattedSpent: '฿3,280',
    formattedLimit: '฿4,000',
    percentUsed: pct,
    level,
  });
  const input = {
    monthLabel: 'ต.ค. 2569',
    rows: [row('อาหาร', 82, 'warning' as const)],
    formattedTotalSpent: '฿5,600',
    formattedTotalLimit: '฿9,000',
    totalPercentUsed: 62,
    assetBaseUrl: base,
  };

  it('🔴 กล่องในของทุกแถบมี height เท่ากล่องนอก', () => {
    // 1 แถบรวม + 1 แถบรายหมวด = ราง 2 + แถบใน 2 = 4
    const heights = collect(buildBudgetCard(input), 'height') as string[];
    expect(heights.filter((h) => h === '10px')).toHaveLength(4);
  });

  it('altText บอกสถานะได้โดยไม่ต้องเปิดการ์ด', () => {
    const over = buildBudgetCard({ ...input, rows: [row('อาหาร', 120, 'over')] });
    expect(over.altText).toContain('เกินงบแล้ว 1 หมวด');
    expect(over.altText).toContain('฿5,600');
  });

  it('พาดหัวเปลี่ยนตามสถานะที่แย่ที่สุด', () => {
    const ok = buildBudgetCard({ ...input, rows: [row('อาหาร', 20, 'ok')] });
    expect(ok.altText).toContain('งบยังอยู่ในเกณฑ์');
    const warn = buildBudgetCard(input);
    expect(warn.altText).toContain('ใกล้เต็ม 1 หมวด');
    // เกินงบสำคัญกว่าใกล้เต็ม ต้องรายงานเกินก่อนแม้มีทั้งสองแบบ
    const both = buildBudgetCard({
      ...input,
      rows: [row('อาหาร', 85, 'warning'), row('เดินทาง', 130, 'over')],
    });
    expect(both.altText).toContain('เกินงบแล้ว 1 หมวด');
  });

  it('แถบเปลี่ยนสีตามระดับของหมวดนั้น', () => {
    expect(JSON.stringify(buildBudgetCard({ ...input, rows: [row('ก', 20, 'ok')] }))).toContain('#8fbf18');
    expect(JSON.stringify(buildBudgetCard({ ...input, rows: [row('ก', 85, 'warning')] }))).toContain('#f5a524');
    expect(JSON.stringify(buildBudgetCard({ ...input, rows: [row('ก', 130, 'over')] }))).toContain('#e5484d');
  });

  it('หมวดเยอะเกิน 8 ตัดแล้วบอกว่าเหลืออีกกี่หมวด ไม่ใช่ตัดเงียบ', () => {
    const many = Array.from({ length: 12 }, (_, i) => row(`หมวด ${i}`, 10, 'ok' as const));
    const texts = collect(buildBudgetCard({ ...input, rows: many }), 'text') as string[];
    expect(texts).toContain('หมวด 7');
    expect(texts).not.toContain('หมวด 8');
    expect(texts.some((t) => t.includes('และอีก 4 หมวด'))).toBe(true);
  });

  it('ชื่อหมวดยาวต้องตกบรรทัด ไม่โดนตัด', () => {
    const card = buildBudgetCard({
      ...input,
      rows: [row('การศึกษาและพัฒนาตนเองระยะยาว', 40, 'ok')],
    });
    const json = JSON.parse(JSON.stringify(card));
    const nameCell = json.contents.body.contents[2].contents[0].contents[0];
    expect(nameCell.wrap).toBe(true);
  });

  it('assetBaseUrl ที่มี / ต่อท้าย ต้องไม่ทำให้ URL มี // ซ้อน', () => {
    const urls = collect(buildBudgetCard({ ...input, assetBaseUrl: `${base}/` }), 'url') as string[];
    expect(urls.every((u) => !u.replace('https://', '').includes('//'))).toBe(true);
  });
});

describe('ปุ่มบนการ์ดต้องกดแล้วเกิดอะไรขึ้นจริง', () => {
  // 🔴 บั๊กที่เคยเกิด: ปุ่ม ✏️ ยิง action=edit ออกไปแต่ postbackHandler ไม่มี case นี้
  // ตกไปที่ default ซึ่งตอนนั้นแค่ log ลง console ผู้ใช้กดแล้วเงียบสนิท
  // เทสต์นี้อ่าน case จาก postbackHandler จริง แล้วเทียบกับทุก action ที่การ์ดยิงออก
  const handlerSource = readFileSync(
    resolve(__dirname, '../src/handlers/postbackHandler.ts'),
    'utf8'
  );
  const handled = new Set(
    [...handlerSource.matchAll(/case '([a-z_]+)':/g)].map((m) => m[1] as string)
  );

  /** ทุก action ที่ฝังอยู่ในการ์ด ไม่ว่าจะซ้อนลึกแค่ไหน */
  function postbackActions(card: unknown): string[] {
    return (collect(card, 'data') as string[])
      .filter((d) => typeof d === 'string' && d.startsWith('action='))
      .map((d) => d.slice('action='.length).split('&')[0] as string);
  }

  const cards: Record<string, unknown> = {
    recordedCard: buildRecordedCard({
      groups: [{ type: 'expense', categoryName: 'อาหาร', items: [
        { transactionId: 't1', occurredLabel: 'x', title: 'กาแฟ', formattedAmount: '฿80' }]}],
      budgets: [], periodNote: '', assetBaseUrl: 'https://example.test',
    }),
    pendingCard: buildPendingCard({ pendingId: 'p1', summary: 'ทดสอบ' }),
    planCard: buildPlanCard(planInput),
    summaryCard: buildSummaryCard(summaryInput),
    errorCard: buildUnreadableCard(),
    budgetCard: buildBudgetCard({
      monthLabel: 'ต.ค. 2569',
      rows: [{ categoryName: 'อาหาร', formattedSpent: '฿1', formattedLimit: '฿2',
               percentUsed: 50, level: 'ok' }],
      formattedTotalSpent: '฿1', formattedTotalLimit: '฿2', totalPercentUsed: 50,
      assetBaseUrl: 'https://example.test',
    }),
  };

  for (const [name, card] of Object.entries(cards)) {
    it(`${name}: ทุก postback มี case รองรับใน postbackHandler`, () => {
      const unhandled = postbackActions(card).filter((a) => !handled.has(a));
      expect(unhandled).toEqual([]);
    });
  }

  it('ปุ่มแก้ไขเปิดหน้าเว็บไปที่รายการนั้นโดยตรง', () => {
    const card = cards.recordedCard;
    const uris = (collect(card, 'uri') as string[]).filter(Boolean);
    expect(uris).toContain('https://example.test/transactions.html?tx=t1');
  });

  it('ทุกปุ่มที่กดได้ต้องมี action จริง ไม่ใช่รูปเปล่า', () => {
    for (const [name, card] of Object.entries(cards)) {
      for (const action of collect(card, 'action') as Record<string, unknown>[]) {
        expect(action.type, `${name} มี action ที่ไม่มี type`).toBeTruthy();
        if (action.type === 'postback') expect(action.data, name).toBeTruthy();
        if (action.type === 'uri') expect(action.uri, name).toBeTruthy();
        if (action.type === 'message') expect(action.text, name).toBeTruthy();
      }
    }
  });
});
