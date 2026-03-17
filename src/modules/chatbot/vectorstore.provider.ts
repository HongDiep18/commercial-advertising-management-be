import { PGVectorStore } from '@langchain/community/vectorstores/pgvector';
import { OpenAIEmbeddings } from '@langchain/openai';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

export const VECTOR_STORE = 'VECTOR_STORE';

export const vectorStoreProvider = {
  provide: VECTOR_STORE,
  inject: [ConfigService],
  useFactory: async (config: ConfigService): Promise<PGVectorStore> => {
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: config.get<string>('chatbot.openAiApiKey'),
      modelName: 'text-embedding-3-small',
    });

    const pool = new Pool({
      host: config.get<string>('database.host'),
      port: config.get<number>('database.port'),
      user: config.get<string>('database.username'),
      password: config.get<string>('database.password'),
      database: config.get<string>('database.database'),
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
