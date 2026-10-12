// ไฟล์นี้ทำหน้าที่อะไร: ติดตั้ง rich menu ขึ้น LINE — รันมือครั้งเดียวตอน deploy
// ใครรับผิดชอบ: ④ Frontend
// เขียนในสัปดาห์: W5
// อ้างอิง: SPEC.md §4 ข้อ 15 Rich Menu · SRS FR-18
//
// ทำไมเป็นสคริปต์แยก ไม่ใช่โค้ดที่รันตอนเซิร์ฟเวอร์บูต: LINE เก็บเมนูไว้ให้เองจนกว่าจะลบ
// ถ้าติดตั้งทุกครั้งที่บูต เมนูจะถูกสร้างใหม่ทุกรอบ deploy และบน Render ที่ปลุกเครื่อง
// บ่อย ๆ จะยิง API ฟรี ๆ วันละหลายครั้งโดยไม่ได้อะไรเพิ่ม
//
// วิธีรัน:  npm run richmenu:install
// ต้องมี LINE_CHANNEL_ACCESS_TOKEN ใน .env และไฟล์ web/img/richmenu.png

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildRichMenu, installRichMenu, RICH_MENU_SIZE } from '../src/line/richmenu';
import { env } from '../src/config/env';

const IMAGE_PATH = resolve(__dirname, '../web/img/richmenu.png');

async function main(): Promise<void> {
  const menu = buildRichMenu(env.appBaseUrl);

  console.log('เมนูที่จะติดตั้ง:');
  for (const area of menu.areas) {
    const action = area.action as { type: string; text?: string; uri?: string; label?: string };
    const target = action.type === 'uri' ? action.uri : `พิมพ์ "${action.text}"`;
    console.log(`  ${String(action.label).padEnd(10)} -> ${target}`);
  }

  const png = await readFile(IMAGE_PATH);
  // ตรวจขนาดจากหัวไฟล์ PNG ก่อนยิงขึ้นไป — LINE ตอบ 400 เฉย ๆ ถ้าขนาดไม่ตรง
  // ซึ่งอ่านไม่ออกว่าผิดเพราะอะไร เช็คเองตรงนี้แล้วบอกให้ชัดกว่า
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  if (width !== RICH_MENU_SIZE.width || height !== RICH_MENU_SIZE.height) {
    throw new Error(
      `รูปต้องเป็น ${RICH_MENU_SIZE.width}x${RICH_MENU_SIZE.height} แต่ไฟล์นี้ ${width}x${height}`
    );
  }

  const id = await installRichMenu(new Blob([new Uint8Array(png)], { type: 'image/png' }));
  console.log(`\nติดตั้งแล้ว richMenuId=${id}`);
  console.log('เปิดแชทบอทแล้วกดปุ่ม "เมนู" ด้านล่างเพื่อตรวจ');
}

// ถ้า .env ยังไม่ครบ config/env จะ throw ตั้งแต่ตอน import ก่อนจะถึงบรรทัดนี้
// ข้อความของมันบอกชัดอยู่แล้วว่าขาดตัวไหน จึงไม่ดักซ้ำ
main().catch((err: unknown) => {
  console.error(`\nติดตั้งไม่สำเร็จ: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
