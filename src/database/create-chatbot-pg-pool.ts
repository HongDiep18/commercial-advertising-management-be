import { lookup } from 'node:dns/promises';
import { isIPv4 } from 'node:net';
import { ConfigService } from '@nestjs/config';
import { Pool, type PoolConfig } from 'pg';

/**
 * Builds a `pg` Pool for LangChain chatbot features.
 * Resolves the DB hostname to an IPv4 address before connecting. Supabase hostnames often have
 * AAAA records; Render has no outbound IPv6 → `ENETUNREACH` if anything connects using IPv6.
 * `family: 4` alone is not always honored by `pg`; a numeric IPv4 host avoids AAAA entirely.
 * For TLS (Supabase), `servername` keeps certificate validation against the real hostname.
 */
export async function createChatbotPgPool(config: ConfigService): Promise<Pool> {
  const hostName = config.get<string>('database.host', 'localhost');
  const usesSupabaseTls: boolean = hostName.includes('supabase.co');
  let connectHost = hostName;
  if (!isIPv4(hostName)) {
    const { address } = await lookup(hostName, { family: 4 });
    connectHost = address;
  }
  const poolConfig: PoolConfig = {
    host: connectHost,
    port: config.get<number>('database.port'),
    user: config.get<string>('database.username'),
    password: config.get<string>('database.password'),
    database: config.get<string>('database.database'),
    ssl: usesSupabaseTls
      ? { servername: hostName, rejectUnauthorized: true }
      : undefined,
  };
  return new Pool(poolConfig);
}
