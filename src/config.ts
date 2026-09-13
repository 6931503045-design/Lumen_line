import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT ?? '3000'),
  aiEnabled: (process.env.AI_ENABLED ?? 'false').toLowerCase() === 'true',
  line: {
    channelSecret: process.env.LINE_CHANNEL_SECRET ?? '',
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN ?? '',
  },
  supabaseUrl: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? '',
  databaseUrl: process.env.DATABASE_URL ?? '',
};
