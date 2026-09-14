// ไฟล์นี้ทำหน้าที่อะไร: แปลง/คำนวณ/แสดงผลเงินทั้งหมดของระบบ — เป็นไฟล์เดียวที่อนุญาตให้ "แตะเลขเงินดิบ" ได้
// ใครรับผิดชอบ: ② Database
// เขียนในสัปดาห์: W1
// อ้างอิง: SPEC.md §S5 (Money Engine), §S6 กฎข้อมูล, ภาคผนวก A
//
// ⚖️ กฎเหล็ก G3: เงินเป็นเลขบวกเสมอ (ทิศทางดูจาก type ไม่ใช่เครื่องหมาย) / DB เก็บเป็น numeric(12,2)
//    โค้ดคำนวณเป็น "สตางค์" (จำนวนเต็ม, 1 บาท = 100 สตางค์) เสมอ ห้ามใช้ float ตรงๆ กับเงินเด็ดขาด
//    เหตุผล: 0.1 + 0.2 ในภาษาคอมพิวเตอร์ (float) ไม่เท่ากับ 0.3 เป๊ะ แต่ 10 สตางค์ + 20 สตางค์ = 30 สตางค์ เป๊ะเสมอ
//    เพราะเป็นเลขจำนวนเต็ม (integer) ไม่ใช่เลขทศนิยม
//
// ⚠️ ทุกฟังก์ชันในไฟล์นี้ "ไม่ตัดสินใจ" ว่าจะบันทึกอะไรลง DB — แค่แปลงหน่วย/ปัดเศษ/จัดรูปแบบเท่านั้น
//    การตัดสินใจเชิงธุรกิจ (เช่น จะสร้างแผนออมไหม) อยู่ใน services/*.service.ts ที่เรียกไฟล์นี้ไปใช้

import { MAX_AMOUNT_SATANG } from '../config/constants';

/** จำนวนสตางค์ต่อ 1 บาท (ค่าคงที่ทางคณิตศาสตร์ ไม่ใช่ config ที่ปรับได้) */
const SATANG_PER_BAHT = 100;

/** จำนวนสตางค์ต่อ 10 บาท ใช้ตอนปัด monthly_save ลงหลักสิบบาทตาม S5.4 */
const TEN_BAHT_IN_SATANG = 1_000;

/** error เฉพาะของโมดูลเงิน แยกจาก error ทั่วไป เพื่อให้ catch แยกได้ง่ายตอนเขียน log/guard */
export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoneyError';
  }
}

/**
 * แปลงเงินหน่วยบาท (เลขหรือ string ทศนิยมจาก DB เช่น numeric(12,2) ที่ node driver
 * มักส่งมาเป็น string เพื่อกันเพี้ยน) ให้เป็นสตางค์ (จำนวนเต็ม)
 *
 * ใช้ string-parsing ล้วนๆ ไม่ผ่าน parseFloat/Number คูณ 100 ตรงๆ เพื่อกัน float error
 * เช่น (0.1 * 100) ในบางกรณีของ JS อาจได้ 10.000000000000002 ถ้าคูณเลขอื่น
 *
 * @throws MoneyError ถ้าค่าติดลบ, รูปแบบผิด, หรือเกิน MAX_AMOUNT_SATANG
 */
export function toSatang(baht: number | string): number {
  if (baht === null || baht === undefined) {
    throw new MoneyError('toSatang: ค่าที่ส่งมาเป็น null หรือ undefined');
  }

  const raw = typeof baht === 'number' ? String(baht) : baht.trim();
  if (raw === '') {
    throw new MoneyError('toSatang: ได้รับ string ว่าง');
  }

  // รับเฉพาะรูปแบบ "ตัวเลข" หรือ "ตัวเลข.ทศนิยม" (ห้ามมีเครื่องหมายลบ ตามกฎ G3 เงินติดลบไม่ได้)
  const match = /^(\d+)(?:\.(\d+))?$/.exec(raw);
  if (!match) {
    throw new MoneyError(
      `toSatang: รูปแบบตัวเลขไม่ถูกต้อง "${baht}" (เงินติดลบไม่ได้ตามกฎ G3 — ทิศทางใช้ฟิลด์ type แทน)`
    );
  }

  // group 1 เป็น capture บังคับ (ไม่มี ? ต่อท้าย) จึงมีค่าเสมอเมื่อ match สำเร็จ
  // ใช้ ! เพราะ tsconfig เปิด noUncheckedIndexedAccess ทำให้ TS มองว่าเป็น string | undefined
  const intPart = match[1]!;
  const fracPartRaw = match[2] ?? '';

  // ปัดครึ่งขึ้นถ้ามีทศนิยมเกิน 2 ตำแหน่ง (เกินหน่วยสตางค์) — ดูตัวเลขหลักที่ 3 เป็นตัวตัดสิน
  let carrySatang = 0n;
  let fracPart = fracPartRaw;
  if (fracPart.length > 2) {
    const thirdDigit = fracPart.charCodeAt(2) - 48; // '0'.charCodeAt(0) === 48
    carrySatang = thirdDigit >= 5 ? 1n : 0n;
    fracPart = fracPart.slice(0, 2);
  }
  fracPart = fracPart.padEnd(2, '0'); // "5" -> "50", "" -> "00"

  // ใช้ BigInt บวกกันตรงๆ เป็นหน่วยสตางค์ทั้งหมด กันปัญหาเลขจำนวนเต็มใหญ่เกิน Number ปลอดภัย
  const totalSatang = BigInt(intPart) * BigInt(SATANG_PER_BAHT) + BigInt(fracPart) + carrySatang;

  if (totalSatang > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new MoneyError(`toSatang: ตัวเลขใหญ่เกินกว่าจะประมวลผลได้ปลอดภัย "${baht}"`);
  }

  const result = Number(totalSatang);
  assertWithinMaxAmount(result, 'toSatang');
  return result;
}

/**
 * แปลงสตางค์ (จำนวนเต็ม) กลับเป็น string ทศนิยม 2 ตำแหน่งสำหรับเขียนลง DB
 * (คอลัมน์ numeric(12,2)) เช่น fromSatang(8050) -> "80.50"
 *
 * คืนเป็น string เสมอ ไม่ใช่ number เพราะการส่ง number ที่มีทศนิยมไปให้ driver
 * ก็เสี่ยงเจอปัญหา float ตอน serialize อยู่ดี — ส่ง string ตรงไปตรงมาปลอดภัยสุด
 */
export function fromSatang(satang: number): string {
  assertIntegerSatang(satang, 'fromSatang');
  if (satang < 0) {
    throw new MoneyError('fromSatang: เงินติดลบไม่ได้ (กฎ G3)');
  }

  const bahtPart = Math.trunc(satang / SATANG_PER_BAHT);
  const satangPart = satang % SATANG_PER_BAHT;
  return `${bahtPart}.${String(satangPart).padStart(2, '0')}`;
}

/**
 * จัดรูปแบบสตางค์เป็นข้อความแสดงผล เช่น formatBaht(125000) -> "฿1,250.00"
 * ใช้ทั้งฝั่งข้อความตอบใน LINE (Flex card, ข้อความตอบกลับ) และฝั่ง log/report
 * (ฝั่ง LIFF frontend มีฟังก์ชันแยกต่างหากของตัวเองใน js/api.js ตาม SPEC §S2)
 *
 * รองรับค่าติดลบเพื่อใช้แสดง "ใช้เกินไปแล้ว -฿250.00" ตาม S5.2 (ค่าติดลบเกิดจากการคำนวณ
 * ผลต่างในโค้ด ไม่ใช่ค่าที่เก็บลง DB ตรงๆ — DB ยังคงเก็บแต่เลขบวกเสมอ)
 */
export function formatBaht(satang: number): string {
  assertIntegerSatang(satang, 'formatBaht');

  const negative = satang < 0;
  const absoluteSatang = Math.abs(satang);
  // fromSatang คืนรูปแบบ "<บาท>.<สตางค์ 2 หลัก>" เสมอ จึงแยกได้ 2 ส่วนแน่นอน
  const [bahtPart, satangPart] = fromSatang(absoluteSatang).split('.') as [string, string];
  const bahtWithComma = bahtPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  return `${negative ? '-' : ''}฿${bahtWithComma}.${satangPart}`;
}

/**
 * บวกจำนวนเงิน (หน่วยสตางค์) หลายค่าเข้าด้วยกัน — เป็นจำนวนเต็มล้วนๆ จึงไม่มีปัญหา float
 * รับค่าติดลบได้ (สำหรับคำนวณผลต่างระหว่างทาง เช่น สูตร S5.2) แต่ทุกอินพุตต้องเป็นจำนวนเต็มสตางค์
 */
export function add(...amountsSatang: number[]): number {
  return amountsSatang.reduce((sum, amount) => {
    assertIntegerSatang(amount, 'add');
    return sum + amount;
  }, 0);
}

/**
 * หารเงิน (หน่วยสตางค์) ให้เท่ากันตาม count คน โดยรวมกันแล้วต้องเท่าของเดิม "เป๊ะ" เสมอ
 * (ห้ามหารตรงๆ ด้วย / เพราะเศษสตางค์จะหายหรือเกิน — ต้องแจกเศษให้คนแรกๆ ทีละ 1 สตางค์)
 *
 * ตัวอย่าง: splitEvenly(320_00, 3) -> [10667, 10667, 10666] (รวม = 32000 เป๊ะ)
 * ใช้กับกรณี "หารค่าข้าว 4 คน จ่าย 320" ใน S4
 */
export function splitEvenly(amountSatang: number, count: number): number[] {
  assertIntegerSatang(amountSatang, 'splitEvenly');
  if (amountSatang <= 0) {
    throw new MoneyError('splitEvenly: amountSatang ต้องมากกว่า 0');
  }
  if (!Number.isInteger(count) || count <= 0) {
    throw new MoneyError('splitEvenly: count ต้องเป็นจำนวนเต็มบวก');
  }

  const base = Math.floor(amountSatang / count);
  const remainder = amountSatang - base * count; // จำนวนสตางค์ที่หารไม่ลงตัว ต้องแจกเพิ่ม

  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

/**
 * ปัดค่าสตางค์ที่มีเศษ (เช่น ผลลัพธ์จากการหารเฉลี่ย) ขึ้นเป็นจำนวนเต็มสตางค์แบบ "ปัดครึ่งขึ้น"
 * ใช้เป็นค่า default ตามกฎ S5: "ปัดครั้งเดียวตอนท้าย (ปัดครึ่งขึ้น) ยกเว้นที่ระบุว่าปัดลง"
 */
export function roundHalfUpToSatang(value: number): number {
  if (!Number.isFinite(value)) {
    throw new MoneyError('roundHalfUpToSatang: ค่าที่ส่งมาไม่ใช่ตัวเลขที่ถูกต้อง');
  }
  return Math.floor(value + 0.5);
}

/**
 * ปัดค่าสตางค์ที่มีเศษลงเป็นจำนวนเต็มสตางค์ ("ปัดลง")
 * ใช้กับ S5.2 (ใช้ได้ต่อวัน) ที่ระบุชัดว่าต้อง "ปัดลงเป็นสตางค์"
 */
export function roundDownToSatang(value: number): number {
  if (!Number.isFinite(value)) {
    throw new MoneyError('roundDownToSatang: ค่าที่ส่งมาไม่ใช่ตัวเลขที่ถูกต้อง');
  }
  return Math.floor(value);
}

/**
 * ปัดจำนวนเงิน (สตางค์) ลงหลักสิบบาทที่ใกล้ที่สุด
 * ใช้เฉพาะตอนคำนวณ monthly_save ของแผนออม ตาม S5.4: "monthly_save ปัดลงเป็นหลักสิบบาท"
 */
export function roundDownToTenBaht(satang: number): number {
  assertIntegerSatang(satang, 'roundDownToTenBaht');
  return Math.floor(satang / TEN_BAHT_IN_SATANG) * TEN_BAHT_IN_SATANG;
}

/**
 * ตรวจสอบว่าจำนวนเงิน (สตางค์) ใช้บันทึกเป็น transaction ได้ไหม
 * ตรงกับ CHECK constraint ของตาราง transactions ใน 001_init.sql:
 *   amount > 0 and amount <= 10000000 (บาท) = MAX_AMOUNT_SATANG (สตางค์)
 * เรียกก่อนสร้าง pending_action หรือก่อน insert จริงเสมอ เพื่อคืน error ที่อ่านง่าย
 * แทนที่จะปล่อยให้ DB ปฏิเสธเฉยๆ แล้วต้องมานั่งแกะ error code ทีหลัง
 */
export function assertValidTransactionAmount(satang: number): void {
  assertIntegerSatang(satang, 'assertValidTransactionAmount');
  if (satang <= 0) {
    throw new MoneyError('จำนวนเงินต้องมากกว่า 0 บาท (กฎ G3)');
  }
  assertWithinMaxAmount(satang, 'assertValidTransactionAmount');
}

// ------------------------------------------------------------------
// ฟังก์ชันภายใน (ไม่ export) — ใช้ช่วยตรวจ input ซ้ำๆ ในไฟล์นี้
// ------------------------------------------------------------------

function assertIntegerSatang(value: number, fnName: string): void {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new MoneyError(`${fnName}: รับได้เฉพาะจำนวนเต็มหน่วยสตางค์ ได้รับ "${value}"`);
  }
}

function assertWithinMaxAmount(satang: number, fnName: string): void {
  if (Math.abs(satang) > MAX_AMOUNT_SATANG) {
    throw new MoneyError(
      `${fnName}: จำนวนเงินเกินเพดานสูงสุด ${formatBaht(MAX_AMOUNT_SATANG)}`
    );
  }
}