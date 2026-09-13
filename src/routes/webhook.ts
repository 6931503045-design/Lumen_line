import express from 'express';
import { middleware } from '@line/bot-sdk';
import { env } from '../config/env';
import { supabase } from '../db/supabase';
import { handleFollow, handleUnfollow } from '../handlers/followHandler';
import { handleText } from '../handlers/textHandler';

export const webhookRouter = express.Router();

const lineConfig = {
  channelAccessToken: env.lineChannelAccessToken,
  channelSecret: env.lineChannelSecret,
};

type LineWebhookEvent = {
  type: string;
  webhookEventId?: string;
  replyToken?: string;
  source?: { userId?: string; type?: string };
  message?: { type: string; text?: string };
};

webhookRouter.post('/', middleware(lineConfig), (req, res) => {
  res.status(200).json({ ok: true });

  const events = (req.body?.events ?? []) as LineWebhookEvent[];
  for (const event of events) {
    processEvent(event).catch((err) => {
      console.error('[webhook] processEvent error:', err);
    });
  }
});

async function processEvent(event: LineWebhookEvent): Promise<void> {
  if (event.webhookEventId) {
    const { error } = await supabase.from('webhook_events').insert({ id: event.webhookEventId });

    if (error) {
      if (error.code === '23505') return;
      console.error('[webhook] insert webhook_events error:', error);
      return;
    }
  }

  switch (event.type) {
    case 'follow':
      await handleFollow(event);
      break;
    case 'unfollow':
      await handleUnfollow(event);
      break;
    case 'message':
      if (event.message?.type === 'text') {
        await handleText(event);
      }
      break;
    default:
      break;
  }
}
