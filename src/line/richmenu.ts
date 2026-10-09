// ไฟล์นี้ทำหน้าที่อะไร: นิยาม rich menu 6 ช่องที่อยู่ใต้หน้าแชท และสคริปต์ติดตั้งขึ้น LINE
// ใครรับผิดชอบ: ④ Frontend
// เขียนในสัปดาห์: W3
// อ้างอิง: SPEC.md §4 ข้อ 15 Rich Menu · SRS FR-18
// ⚖️ กฎเหล็ก G4
//
// ⚖️ G4: ทุกช่องในเมนูนี้ยิงเป็น "ข้อความคำสั่ง" ที่ command.service รองรับอยู่แล้ว
// ไม่มีช่องไหนพึ่ง AI เลย ปิด AI แล้วเมนูยังใช้ได้ครบทุกปุ่ม
//
// ⚠️ รูปพื้นหลังไม่ได้อยู่ในโค้ด: LINE บังคับขนาด 2500×1686 px และต้องอัปโหลดเป็นไฟล์
// ทำรูปใน Canva/Figma แล้วเรียก uploadRichMenuImage() หรืออัปผ่าน LINE Developers Console
// ช่องในรูปต้องวางให้ตรงกับพิกัด areas ด้านล่าง ไม่งั้นกดแล้วได้คำสั่งผิดช่อง

import { lineClient } from './client';
import { env } from '../config/env';

/** ขนาดที่ LINE บังคับสำหรับ rich menu เต็มความสูง */
export const RICH_MENU_SIZE = { width: 2500, height: 1686 } as const;

/** 3 คอลัมน์ 2 แถว — แต่ละช่องกว้าง 833 สูง 843 */
const COL = Math.floor(RICH_MENU_SIZE.width / 3); // 833
const ROW = RICH_MENU_SIZE.height / 2; // 843

/**
 * ┌─────────┬─────────┬─────────┐
 * │  สรุป   │  เหลือ  │   งบ    │
 * ├─────────┼─────────┼─────────┤
 * │  แผน    │ เปิดเว็บ │ ช่วยเหลือ │
 * └─────────┴─────────┴─────────┘
 *
 * ช่องขวาสุดของแถวบนกว้างกว่าช่องอื่น 1 px เพื่อกินเศษที่หารสามไม่ลงตัว
 * (2500 / 3 = 833.33) ถ้าปล่อยไว้จะมีแถบ 1 px ตรงขอบที่กดแล้วไม่เกิดอะไร
 */
const LAST_COL_WIDTH = RICH_MENU_SIZE.width - COL * 2;

type MenuCell = {
  bounds: { x: number; y: number; width: number; height: number };
  action: Record<string, unknown>;
};

function messageCell(col: number, row: number, label: string, text: string): MenuCell {
  const isLast = col === 2;
  return {
    bounds: {
      x: col * COL,
      y: row * ROW,
      width: isLast ? LAST_COL_WIDTH : COL,
      height: ROW,
    },
    // type 'message' = ส่งข้อความนี้แทนผู้ใช้ ซึ่งวิ่งเข้า textHandler ตามปกติ
    // ทำให้เมนูใช้เส้นทางเดียวกับการพิมพ์เอง ไม่มีโค้ดสาขาพิเศษให้ดูแลเพิ่ม
    action: { type: 'message', label, text },
  };
}

export function buildRichMenu(webUrl: string = env.appBaseUrl) {
  const areas: MenuCell[] = [
    messageCell(0, 0, 'สรุป', 'สรุป'),
    messageCell(1, 0, 'เหลือ', 'เหลือ'),
    messageCell(2, 0, 'งบ', 'งบ'),
    messageCell(0, 1, 'แผน', 'แผน'),
    {
      bounds: { x: COL, y: ROW, width: COL, height: ROW },
      action: { type: 'uri', label: 'เปิดเว็บ', uri: webUrl },
    },
    messageCell(2, 1, 'ช่วยเหลือ', 'ช่วยเหลือ'),
  ];

  return {
    size: { ...RICH_MENU_SIZE },
    selected: true,
    name: 'JOD tang · เมนูหลัก',
    // ข้อความที่ขึ้นบนปุ่มเปิดเมนู ผู้ใช้เห็นตอนเมนูถูกพับอยู่
    chatBarText: 'เมนู',
    areas,
  };
}

/**
 * ติดตั้งเมนูขึ้น LINE แล้วตั้งเป็นเมนูเริ่มต้นของผู้ใช้ทุกคน
 *
 * เรียกครั้งเดียวตอน deploy ไม่ใช่ตอน runtime — LINE เก็บเมนูไว้ให้เองจนกว่าจะลบ
 * ถ้าเรียกซ้ำจะได้เมนูใหม่อีกอัน (เมนูเก่าค้างอยู่) จึงลบของเดิมก่อนเสมอ
 */
export async function installRichMenu(imagePng: Blob): Promise<string> {
  // ลบเมนูเดิมก่อน ไม่งั้นเมนูเก่าจะค้างสะสมในบัญชีและนับรวมในโควตา
  const existing = await lineClient.getRichMenuList();
  for (const menu of existing.richmenus) {
    await lineClient.deleteRichMenu(menu.richMenuId);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const created = await lineClient.createRichMenu(buildRichMenu() as any);
  await uploadRichMenuImage(created.richMenuId, imagePng);
  await lineClient.setDefaultRichMenu(created.richMenuId);
  return created.richMenuId;
}

/**
 * อัปรูปพื้นหลัง — ต้องเป็น PNG หรือ JPEG ขนาด 2500×1686 และไม่เกิน 1 MB
 *
 * ⚠️ การอัปรูปใช้โดเมน api-data.line.me ไม่ใช่ api.line.me จึงเป็นคนละ client กัน
 * SDK แยกเป็น blob client ให้แล้ว
 */
export async function uploadRichMenuImage(richMenuId: string, imagePng: Blob): Promise<void> {
  const { messagingApi } = await import('@line/bot-sdk');
  const blobClient = new messagingApi.MessagingApiBlobClient({
    channelAccessToken: env.lineChannelAccessToken,
  });
  // SDK อ่าน content-type จากตัว Blob เอง จึงต้องสร้าง Blob ด้วย type 'image/png'
  // ตั้งแต่ตอนอ่านไฟล์ ไม่ใช่ส่ง mime type แยกเป็นอาร์กิวเมนต์
  await blobClient.setRichMenuImage(richMenuId, imagePng);
}
