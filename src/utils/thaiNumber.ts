// ไฟล์นี้ทำหน้าที่อะไร: แปลงตัวเลขไทย/ตัวเลขแปด/เลขภาษาไทยให้กลายเป็นจำนวนสำหรับคำนวณเงิน
// ใครรับผิดชอบ: ③ AI / ⑤ Integration
// เขียนในสัปดาห์: W2
// ⚖️ กฎเหล็ก G1, G3

const THAI_DIGIT_MAP: Record<string, string> = {
  '๐': '0',
  '๑': '1',
  '๒': '2',
  '๓': '3',
  '๔': '4',
  '๕': '5',
  '๖': '6',
  '๗': '7',
  '๘': '8',
  '๙': '9',
};

const THAI_WORD_NUMBERS: Record<string, number> = {
  ศูนย์: 0,
  หนึ่ง: 1,
  เอ็ด: 1,
  สอง: 2,
  สาม: 3,
  สี่: 4,
  ห้า: 5,
  หก: 6,
  เจ็ด: 7,
  แปด: 8,
  เก้า: 9,
  สิบ: 10,
  ร้อย: 100,
  พัน: 1000,
  หมื่น: 10000,
  แสน: 100000,
  ล้าน: 1000000,
};

const TOKEN_PATTERN = /ศูนย์|หนึ่ง|สอง|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า|สิบ|ร้อย|พัน|หมื่น|แสน|ล้าน|เอ็ด/g;

export function normalizeThaiNumber(value: string): number {
  if (value === null || value === undefined) {
    return 0;
  }

  let raw = String(value).trim();
  if (raw === '') {
    return 0;
  }

  raw = raw.replace(/\s+/g, '');
  raw = raw.replace(/[\u00A0]/g, '');
  raw = raw.replace(/[\u200B-\u200D\uFEFF]/g, '');

  // ตัวเลขภาษาไทย ๓๐๐ → 300
  raw = raw.replace(/[๐-๙]/g, (char) => THAI_DIGIT_MAP[char] ?? char);

  // ตัวย่อสกุลเงิน เช่น 50บ / 50฿ / 50บาท
  raw = raw.replace(/(บาท|฿)$/gi, '');
  raw = raw.replace(/(?<=[0-9๐-๙])\s*บ\s*$/g, '');
  raw = raw.replace(/,/g, '');

  // 1.2k / 2.5m
  const compactMatch = /^(-?\d+(?:\.\d+)?)([kKmM])$/i.exec(raw);
  if (compactMatch) {
    const number = Number(compactMatch[1]);
    const unit = compactMatch[2].toLowerCase();
    const multiplier = unit === 'k' ? 1000 : unit === 'm' ? 1000000 : 1;
    return Number.isFinite(number) ? number * multiplier : 0;
  }

  // ตัวเลขปกติ
  const parsedNumber = Number(raw);
  if (Number.isFinite(parsedNumber) && raw !== '') {
    return parsedNumber;
  }

  // ตัวเลขภาษาไทยเชิงคำ เช่น ห้าสิบ / สองร้อยห้าสิบ / หนึ่งพันสอง
  const thaiWords = parseThaiWordNumber(raw);
  if (thaiWords !== null) {
    return thaiWords;
  }

  return 0;
}

function parseThaiWordNumber(raw: string): number | null {
  const sanitized = raw
    .replace(/(บาท|฿)$/gi, '')
    .replace(/(?<=[0-9๐-๙])\s*บ\s*$/g, '')
    .replace(/\s+/g, '')
    .trim();

  if (!sanitized || !/[ก-ฮ]/u.test(sanitized)) {
    return null;
  }

  const tokens = sanitized.match(TOKEN_PATTERN);
  if (!tokens || tokens.length === 0) {
    return null;
  }

  let total = 0;
  let current = 0;

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (token === 'เอ็ด') {
      current += 1;
      continue;
    }

    if (!(token in THAI_WORD_NUMBERS)) {
      continue;
    }

    const value = THAI_WORD_NUMBERS[token];

    if (value >= 1 && value <= 9) {
      current += value;
      continue;
    }

    if (token === 'สิบ') {
      if (current === 0) {
        current = 1;
      }
      total += current * 10;
      current = 0;
      continue;
    }

    if (token === 'ร้อย') {
      if (current === 0) {
        current = 1;
      }
      total += current * 100;
      current = 0;
      continue;
    }

    if (token === 'พัน' || token === 'หมื่น' || token === 'แสน' || token === 'ล้าน') {
      if (current === 0) {
        current = 1;
      }
      total += current * value;
      current = 0;
      continue;
    }
  }

  total += current;

  const shorthandMatch = /^(.*)พัน([ก-ฮ]+)$/u.exec(sanitized);
  if (shorthandMatch) {
    const leadingText = shorthandMatch[1];
    const trailingText = shorthandMatch[2];
    const leadingValue = parseThaiWordNumber(leadingText);
    const trailingValue = parseThaiWordNumber(trailingText);

    if (
      leadingValue !== null &&
      trailingValue !== null &&
      trailingValue >= 1 &&
      trailingValue <= 9 &&
      !leadingText.includes('ร้อย') &&
      !trailingText.includes('สิบ') &&
      !trailingText.includes('ร้อย')
    ) {
      return leadingValue * 1000 + trailingValue * 100;
    }
  }

  return total > 0 ? total : null;
}
