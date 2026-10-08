// ไฟล์นี้ทำหน้าที่อะไร: client สำหรับ LINE Messaging API
// ใครรับผิดชอบ: ① Bot Core
// เขียนในสัปดาห์: W1 (ข้อความ) / W3 (รูป)
// TODO: เพิ่ม rich menu
// ⚖️ กฎเหล็ก G5, G6

import { messagingApi } from '@line/bot-sdk';
import { env } from '../config/env';

export const lineClient = new messagingApi.MessagingApiClient({
  channelAccessToken: env.lineChannelAccessToken,
});

/**
 * client แยกสำหรับดึง "เนื้อไฟล์" ที่ผู้ใช้ส่งมา (รูปสลิป) — SPEC §S9
 *
 * ทำไมต้องเป็นอีกตัว: LINE แยก Content API ออกจาก Messaging API คนละ host กัน
 * (api-data.line.me กับ api.line.me) SDK จึงมี client แยกให้
 *
 * ⚖️ G5: สิ่งที่ได้จาก client นี้คือ stream ของรูปสลิปซึ่งเป็นข้อมูลการเงินของผู้ใช้
 * ห้ามเขียนลงดิสก์ ห้ามเก็บไว้ที่ใดเลย ตาม SPEC §S9 ("MUST NOT เก็บไฟล์รูปไว้ที่ใดเลย")
 * ให้อ่านเข้า memory ส่งให้ Vision แล้วปล่อยให้ GC เก็บไป
 */
export const lineBlobClient = new messagingApi.MessagingApiBlobClient({
  channelAccessToken: env.lineChannelAccessToken,
});
