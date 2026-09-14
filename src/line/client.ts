// ไฟล์นี้ทำหน้าที่อะไร: client สำหรับ LINE Messaging API
// ใครรับผิดชอบ: ① Bot Core
// เขียนในสัปดาห์: W1
// TODO: เพิ่ม reply, push, multi-message, rich menu, webhook verification
// ⚖️ กฎเหล็ก G5, G6

import { messagingApi } from '@line/bot-sdk';
import { env } from '../config/env';

export const lineClient = new messagingApi.MessagingApiClient({
  channelAccessToken: env.lineChannelAccessToken,
});
