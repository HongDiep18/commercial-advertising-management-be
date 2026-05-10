import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import type { Pool } from 'pg';
import { CHATBOT_PG_POOL } from '../../database/chatbot-pg-pool.token';

export const CHECKPOINT_SAVER = 'CHECKPOINT_SAVER';

export const checkpointProvider = {
  provide: CHECKPOINT_SAVER,
  inject: [CHATBOT_PG_POOL],
  useFactory: async (pool: Pool): Promise<PostgresSaver> => {
    const saver = new PostgresSaver(pool);
    await saver.setup();
    return saver;
  },
};
