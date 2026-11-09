// ไฟล์นี้ทำหน้าที่อะไร: สีและชิ้นส่วนกลางของการ์ด Flex ทุกใบ ให้ตรงกับธีมของแอป (web/css/style.css)
// ใครรับผิดชอบ: ④ Frontend
//
// ทำไมต้องมี: การ์ดแต่ละใบเคยประกาศสีและโครงของตัวเอง แล้วหลุดธีมไปคนละทาง
// (ม่วงในการ์ดยืนยันของ AI, กรมท่าในการ์ดสรุป, เขียว LINE ในการ์ดแผน, การ์ดบางใบไม่มีหัว)
// ผู้ใช้ทดสอบเห็นแล้วบอกว่าไม่เหมือนแอปเดียวกัน
//
// แม่แบบคือการ์ด "บันทึกแล้ว" (recordedCard) — หัวแถบมะนาว + mascot, ตัวการ์ดพื้นขาว,
// แถบความคืบหน้า 10px, ป้ายเม็ดมน การ์ดใหม่ให้ประกอบจากชิ้นส่วนในไฟล์นี้ ไม่ต้องวาดเอง
//
// 🔴 บทเรียนจากการทดสอบบนมือถือจริง — Flex Simulator บนเดสก์ท็อปผ่อนผันกว่าแอป LINE
// สามข้อนี้ Simulator วาดให้เห็นปกติ แต่บนเครื่องจริงพัง ห้ามแก้กลับ:
//   1. กล่องในของแถบต้องกำหนด height เอง ไม่งั้นสูง 0 แล้วแถบหายทั้งแถบ
//   2. ป้ายต้องเป็น layout 'vertical' + flex 0 — ถ้าใช้ 'baseline' กล่องยุบจนกลายเป็นวงกลม
//   3. ไอคอนต้องเป็น child ตรงๆ ของแถว horizontal ห้ามห่อ box ที่ flex 0 ไม่งั้นหายไปเลย

export const FLEX_THEME = {
  /** มะนาวจัด (--lime) — แถบหัวการ์ดและจุดเน้น ใช้กับตัวหนังสือสีเข้มเท่านั้น */
  band: '#c6ff3d',
  bandText: '#4a5c38',
  /** แถบหัวของการ์ดแจ้งปัญหา — ต้องต่างจากมะนาว ไม่งั้นข้อความผิดพลาดดูเหมือนข่าวดี */
  warnBand: '#ffeec2',
  /** เส้นคั่น (--line) */
  line: '#dfe9d3',
  /** พื้นกล่องรองในการ์ด (--surface-soft) เช่นกล่องสรุป กล่องตัวอย่าง */
  soft: '#f4f8ee',
  text: '#1c2416',
  /** หัวข้อและตัวเลขสำคัญ (--text-strong) */
  strong: '#10140b',
  muted: '#6b7a5e',
  /** พื้นปุ่มหลักและป้าย "รายจ่าย" (--surface-dark) */
  dark: '#14170f',
  /** ตัวหนังสือบนพื้นดำ (--on-dark) */
  onDark: '#f6faf0',
  income: '#2f7a33',
  incomeBg: '#e4f4e5',
  /** แถบความคืบหน้าปกติ */
  bar: '#8fbf18',
  track: '#dde6d2',
  /** สีเหลืองอำพันสำหรับแถบ — บนพื้นขาวอ่านยาก ตัวหนังสือเตือนให้ใช้ warnText */
  warn: '#f5a524',
  warnText: '#9a5b00',
  warnBg: '#fdf0d5',
  danger: '#e5484d',
  dangerBg: '#fde4e4',
} as const;

const C = FLEX_THEME;

type FlexNode = Record<string, unknown>;

const BAR_HEIGHT = '10px';
/** ต่ำกว่านี้แถบจะมนจนดูเหมือนจุด ไม่ใช่ขีด */
const ROUND_THRESHOLD = 14;
/** ยกพื้นขั้นต่ำให้แถบยังอ่านออก — ยอดจริงพิมพ์อยู่ข้างแถบแล้ว จึงไม่ทำให้เข้าใจผิด */
const MIN_BAR_WIDTH = 5;

/** ตัด / ท้าย URL ทิ้ง ไม่งั้นได้ // ซ้อน */
export function trimBase(url: string): string {
  return url.replace(/\/$/, '');
}

/** สีแถบตามระดับการใช้ — เขียว / เหลืองอำพันตั้งแต่ 80% / แดงตั้งแต่ 100% */
export function levelBarColor(percent: number): string {
  if (percent >= 100) return C.danger;
  if (percent >= 80) return C.warn;
  return C.bar;
}

/**
 * แถบความคืบหน้า — กล่องนอกเป็นราง กล่องในคือส่วนที่ใช้/ออมไปแล้ว
 * percent ใช้วาดความกว้างอย่างเดียว ไม่ใช่ยอดเงิน (⚖️ G1)
 */
export function progressBar(percent: number, color: string = levelBarColor(percent)): FlexNode {
  // จำกัด 0–100 ก่อน เพราะ LINE ปฏิเสธทั้งข้อความถ้าความกว้างอยู่นอกช่วงนี้
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
        height: BAR_HEIGHT, // 🔴 หมายเหตุข้อ 1 ด้านบน
        backgroundColor: color,
        cornerRadius: width < ROUND_THRESHOLD ? '2px' : '5px',
      },
    ],
  };
}

/** ป้ายเม็ดมน — 🔴 ต้อง vertical ไม่ใช่ baseline (หมายเหตุข้อ 2) */
export function pill(label: string, background: string, color: string): FlexNode {
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

/** กล่องพื้นอ่อนมุมมน — ใช้กับยอดรวม สิ่งที่ AI เข้าใจ ตัวอย่างวิธีพิมพ์ */
export function softPanel(contents: FlexNode[], margin?: string): FlexNode {
  return {
    type: 'box',
    layout: 'vertical',
    paddingAll: '12px',
    backgroundColor: C.soft,
    cornerRadius: '8px',
    spacing: 'sm',
    ...(margin ? { margin } : {}),
    contents,
  };
}

/** แถวป้ายซ้าย–ค่าขวา เช่น "รายรับ ฿15,000.00" */
export function labelValueRow(label: string, value: string, valueColor: string = C.text): FlexNode {
  return {
    type: 'box',
    layout: 'horizontal',
    contents: [
      { type: 'text', text: label, size: 'sm', color: C.muted, flex: 4, gravity: 'center' },
      {
        type: 'text',
        text: value,
        size: 'sm',
        weight: 'bold',
        color: valueColor,
        align: 'end',
        flex: 5,
        gravity: 'center',
        wrap: true,
      },
    ],
  };
}

/** หัวข้อย่อยในตัวการ์ด เช่น "จ่ายมากสุด" */
export function sectionTitle(text: string, margin = 'xl'): FlexNode {
  return { type: 'text', text, size: 'xs', weight: 'bold', color: C.muted, margin };
}

/** เส้นคั่นหนาสีเข้ม — แบ่งส่วนหลักของการ์ด แบบเดียวกับก่อนแถบงบในการ์ดบันทึกแล้ว */
export function heavyDivider(margin = 'xl'): FlexNode {
  return { type: 'box', layout: 'vertical', height: '2px', backgroundColor: C.dark, margin, contents: [] };
}

export type CardTone = 'default' | 'warn';

export type CardHeaderInput = {
  title: string;
  subtitle?: string;
  /** โดเมนที่เสิร์ฟ web/ — ไม่ส่งมา = ไม่มี mascot (รูปใน Flex ต้องเป็น URL แบบ HTTPS) */
  assetBaseUrl?: string;
  /** warn = การ์ดแจ้งปัญหา ใช้แถบเหลืองอ่อนและไม่มี mascot หน้ายิ้ม */
  tone?: CardTone;
};

/** หัวการ์ด: แถบมะนาว + หัวข้อตัวหนา + คำอธิบายสั้น + mascot ทางขวา */
export function cardHeader(input: CardHeaderInput): FlexNode {
  const warn = input.tone === 'warn';
  const texts: FlexNode[] = [
    { type: 'text', text: input.title, size: 'lg', weight: 'bold', color: C.strong, wrap: true },
  ];
  if (input.subtitle) {
    texts.push({
      type: 'text',
      text: input.subtitle,
      size: 'xxs',
      color: warn ? C.warnText : C.bandText,
      margin: 'xs',
      wrap: true,
    });
  }

  const contents: FlexNode[] = [{ type: 'box', layout: 'vertical', flex: 5, contents: texts }];
  if (input.assetBaseUrl && !warn) {
    contents.push({
      type: 'image',
      url: `${trimBase(input.assetBaseUrl)}/img/mascot/happy.png`,
      size: 'xs',
      flex: 2,
      aspectMode: 'fit',
      gravity: 'center',
    });
  }

  return {
    type: 'box',
    layout: 'horizontal',
    backgroundColor: warn ? C.warnBand : C.band,
    paddingAll: '16px',
    paddingBottom: '12px',
    contents,
  };
}

export type ButtonVariant = 'primary' | 'secondary';

/**
 * ปุ่มแบบเดียวกับ .primary-btn / .secondary-btn ของเว็บ
 *
 * ทำเป็น box ที่มี action แทน component button ของ LINE เพราะปุ่ม primary ของ LINE
 * บังคับตัวหนังสือสีขาว ทำปุ่มดำตัวหนังสือมะนาวแบบเว็บไม่ได้ ส่วน secondary เป็นสีเทาของ LINE เอง
 * action ต้องอยู่บนกล่องนอกสุดของปุ่ม แตะตรงไหนของปุ่มก็ติด
 */
export function actionButton(
  label: string,
  action: Record<string, unknown>,
  variant: ButtonVariant = 'secondary'
): FlexNode {
  const primary = variant === 'primary';
  return {
    type: 'box',
    layout: 'vertical',
    flex: 1,
    backgroundColor: primary ? C.dark : C.soft,
    cornerRadius: '14px',
    paddingTop: '11px',
    paddingBottom: '11px',
    paddingStart: '8px',
    paddingEnd: '8px',
    action: { label, ...action },
    contents: [
      {
        type: 'text',
        text: label,
        size: 'sm',
        weight: 'bold',
        color: primary ? C.band : C.strong,
        align: 'center',
      },
    ],
  };
}

/** ส่วนท้ายการ์ดสำหรับปุ่ม — ปุ่มเรียงแนวนอน กว้างเท่ากัน */
export function cardFooter(buttons: FlexNode[]): FlexNode {
  return {
    type: 'box',
    layout: 'horizontal',
    spacing: 'sm',
    paddingAll: '14px',
    paddingTop: 'none',
    contents: buttons,
  };
}

/** ตัวการ์ด: พื้นขาว padding เท่ากันทุกใบ */
export function cardBody(contents: FlexNode[]): FlexNode {
  return {
    type: 'box',
    layout: 'vertical',
    paddingAll: '16px',
    paddingTop: '12px',
    spacing: 'none',
    contents,
  };
}

/** bubble ขนาดเดียวกันทุกใบ (mega) — การ์ดคนละขนาดวางต่อกันในแชทแล้วดูไม่ใช่ชุดเดียวกัน */
export function bubble(parts: { header: FlexNode; body: FlexNode; footer?: FlexNode }): FlexNode {
  return {
    type: 'bubble',
    size: 'mega',
    header: parts.header,
    body: parts.body,
    ...(parts.footer ? { footer: parts.footer } : {}),
  };
}
