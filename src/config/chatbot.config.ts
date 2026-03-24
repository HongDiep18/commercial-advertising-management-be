import { registerAs } from '@nestjs/config';

export default registerAs('chatbot', () => {
  const openAiApiKey = process.env.OPENAI_API_KEY;
  if (!openAiApiKey) {
    throw new Error('Missing required environment variable: OPENAI_API_KEY');
  }

  return {
    openAiApiKey,
    apiKey: process.env.CHATBOT_API_KEY ?? '',
    baseUrl: process.env.CHATBOT_BASE_URL ?? 'http://localhost:3001',
    crawl4aiUrl: process.env.CRAWL4AI_URL ?? 'http://crawl4ai:11235',
    crawl4aiToken: process.env.CRAWL4AI_API_TOKEN ?? '',
    crawlScheduleEnabled: process.env.CHATBOT_CRAWL_SCHEDULE_ENABLED !== 'false',
    crawlCron: process.env.CHATBOT_CRAWL_CRON ?? '0 3 * * 0',
    sessionCleanupCron: process.env.CHATBOT_SESSION_CLEANUP_CRON ?? '0 2 * * *',
  };
});
