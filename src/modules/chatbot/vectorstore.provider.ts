import { PGVectorStore } from '@langchain/community/vectorstores/pgvector';
import { OpenAIEmbeddings } from '@langchain/openai';
import { ConfigService } from '@nestjs/config';
import type { Pool } from 'pg';
import { CHATBOT_PG_POOL } from '../../database/chatbot-pg-pool.token';

export const VECTOR_STORE = 'VECTOR_STORE';

export const vectorStoreProvider = {
  provide: VECTOR_STORE,
  inject: [ConfigService, CHATBOT_PG_POOL],
  useFactory: async (
    config: ConfigService,
    pool: Pool,
  ): Promise<PGVectorStore> => {
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: config.get<string>('chatbot.openAiApiKey'),
      modelName: 'text-embedding-3-small',
    });

    return PGVectorStore.initialize(embeddings, {
      pool,
      tableName: 'document_chunks',
      columns: {
        idColumnName: 'id',
        vectorColumnName: 'embedding',
        contentColumnName: 'content',
        metadataColumnName: 'metadata',
      },
    });
  },
};
