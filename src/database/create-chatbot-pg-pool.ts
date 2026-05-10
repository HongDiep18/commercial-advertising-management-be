import { ConfigService } from '@nestjs/config';
import { Pool, type PoolConfig } from 'pg';

/**
 * Builds a `pg` Pool for LangChain chatbot features.
 * Sets `family: 4` so TCP uses IPv4 only — Supabase DNS returns IPv6 first, while many PaaS
 * (e.g. Render) have no outbound IPv6, which causes `ENETUNREACH`.
 */
export function createChatbotPgPool(config: ConfigService): Pool {
  const host = config.get<string>('database.host', 'localhost');
  const usesSupabaseTls: boolean = host.includes('supabase.co');
  const poolConfig: PoolConfig & { family?: number } = {
    host,
    port: config.get<number>('database.port'),
    user: config.get<string>('database.username'),
    password: config.get<string>('database.password'),
    database: config.get<string>('database.database'),
    family: 4,
    ssl: usesSupabaseTls ? { rejectUnauthorized: false } : undefined,
  };
  return new Pool(poolConfig);
}
