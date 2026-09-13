import { lineClient } from './client';

export async function replyText(replyToken: string, text: string): Promise<void> {
  try {
    await lineClient.replyMessage({
      replyToken,
      messages: [{ type: 'text', text }],
    });
  } catch (err) {
    console.error('[line/reply] replyText error:', err);
  }
}
