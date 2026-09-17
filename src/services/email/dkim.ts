// ไฟล์นี้ทำหน้าที่อะไร: ตรวจว่าอีเมลถูกลงนาม DKIM โดยโดเมนธนาคารจริงหรือไม่
// ใครรับผิดชอบ: ⑤ Integration
// เขียนในสัปดาห์: W4
// อ้างอิง: SPEC.md §S8 "MUST ตรวจ DKIM ของโดเมนธนาคาร (SPF มักไม่ผ่านหลัง forward)"
// ⚖️ กฎเหล็ก G6
//
// ทำไมถึงสำคัญมาก: ที่อยู่ +token ของผู้ใช้ไม่ใช่ความลับระดับรหัสผ่าน ถ้าไม่ตรวจว่าอีเมล
// มาจากธนาคารจริง ใครที่รู้ที่อยู่นั้นก็ส่งอีเมลปลอมเข้ามาสร้างรายการเงินในบัญชีคนอื่นได้
//
// ทำไมดู DKIM ไม่ดู SPF: ผู้ใช้ตั้ง Gmail filter ให้ forward ต่อมาอีกที การ forward
// ทำให้ SPF ไม่ผ่านเสมอ (ผู้ส่งกลายเป็น Gmail ไม่ใช่ธนาคาร) แต่ลายเซ็น DKIM ของธนาคาร
// ยังติดมากับตัวอีเมลและยังตรวจผ่านอยู่
//
// header ที่อ่านคือ Authentication-Results ที่ Gmail เขียนไว้ตอนรับอีเมลเข้ากล่อง
// รูปแบบ: "mx.google.com; dkim=pass header.i=@kasikornbank.com; spf=fail ..."

/** ดึงคู่ (ผลตรวจ, โดเมนผู้ลงนาม) ของทุกบล็อก dkim= ใน header */
const DKIM_BLOCK = /dkim=(\w+)[^;]*?header\.(?:i=@?|d=)([A-Za-z0-9.-]+)/g;

export type DkimCheck = {
  passed: boolean;
  /** โดเมนที่ลงนามผ่าน ใช้ใน log ตอนอีเมลถูกปฏิเสธ */
  signedBy: string[];
};

/**
 * ผ่านก็ต่อเมื่อมีลายเซ็น dkim=pass อย่างน้อยหนึ่งอันจากโดเมนใน whitelist
 * โดเมนย่อยของธนาคารก็นับ (เช่น mail.kbank.co.th เข้ากับ kbank.co.th)
 *
 * ไม่มี header เลย = ไม่ผ่าน ไม่ใช่ผ่าน — ระบบต้อง fail closed
 */
export function checkBankDkim(
  authenticationResults: string | undefined,
  allowedDomains: readonly string[]
): DkimCheck {
  if (!authenticationResults) {
    return { passed: false, signedBy: [] };
  }

  const signedBy: string[] = [];
  let passed = false;

  for (const match of authenticationResults.matchAll(DKIM_BLOCK)) {
    const result = (match[1] ?? '').toLowerCase();
    const domain = (match[2] ?? '').toLowerCase();
    if (result !== 'pass' || !domain) continue;

    signedBy.push(domain);
    const trusted = allowedDomains.some(
      (allowed) => domain === allowed.toLowerCase() || domain.endsWith(`.${allowed.toLowerCase()}`)
    );
    if (trusted) passed = true;
  }

  return { passed, signedBy };
}
