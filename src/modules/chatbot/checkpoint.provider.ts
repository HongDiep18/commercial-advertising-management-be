import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { ConfigService } from '@nestjs/config';

export const CHECKPOINT_SAVER = 'CHECKPOINT_SAVER';

export const checkpointProvider = {
  provide: CHECKPOINT_SAVER,
  inject: [ConfigService],
  useFactory: async (config: ConfigService): Promise<PostgresSaver> => {
    const saver = PostgresSaver.fromConnString(
      buildConnectionString(config),
    );
    // Creates checkpoints, checkpoint_blobs, checkpoint_writes tables if not exist
    await saver.setup();
    return saver;
  },
};

function buildConnectionString(config: ConfigService): string {
  const host = config.get<string>('database.host');
  const port = config.get<number>('database.port');
  const user = config.get<string>('database.username');
  const password = config.get<string>('database.password');
  const database = config.get<string>('database.database');
  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}
