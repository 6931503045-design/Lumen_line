import { Client } from '@line/bot-sdk';

import { config } from '../config.js';

export const lineClient = config.line.channelAccessToken
  ? new Client({ channelAccessToken: config.line.channelAccessToken, channelSecret: config.line.channelSecret })
  : null;

export async function replyText(replyToken: string, text: string) {
  if (!lineClient || !replyToken) {
    return { ok: false, reason: 'line_disabled' };
  }

  try {
    await lineClient.replyMessage(replyToken, {
      type: 'text',
      text,
    });

    return { ok: true };
  } catch (error) {
    console.warn('LINE reply failed:', error);
    return { ok: false, reason: 'line_reply_failed' };
  }
}

export async function pushText(userId: string, text: string) {
  if (!lineClient || !userId) {
    return { ok: false, reason: 'line_disabled' };
  }

  try {
    await lineClient.pushMessage(userId, {
      type: 'text',
      text,
    });

    return { ok: true };
  } catch (error) {
    console.warn('LINE push failed:', error);
    return { ok: false, reason: 'line_push_failed' };
  }
}
