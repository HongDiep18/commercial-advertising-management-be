import { BadRequestException, Injectable } from '@nestjs/common';

const MAX_SESSION_MESSAGES = 20;
import { z } from 'zod';
import { addHours } from 'date-fns';
import { PrismaService } from '../../database/prisma.service';

export const SessionMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  timestamp: z.string(),
});

const SessionMessagesSchema = z.array(SessionMessageSchema);

export type SessionMessage = z.infer<typeof SessionMessageSchema>;

type SessionOpts = { userId?: string; guestId?: string };

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  async getMessages(opts: SessionOpts): Promise<SessionMessage[]> {
    if (!opts.userId && !opts.guestId) throw new BadRequestException('Identity required');
    const session = await this.findSession(opts);
    if (!session) return [];
    return SessionMessagesSchema.parse(session.messages);
  }

  async append(
    opts: SessionOpts,
    userMessage: string,
    assistantReply: string,
  ): Promise<void> {
    if (!opts.userId && !opts.guestId) throw new BadRequestException('Identity required');
    const newMessages: SessionMessage[] = [
      { role: 'user', content: userMessage, timestamp: new Date().toISOString() },
      { role: 'assistant', content: assistantReply, timestamp: new Date().toISOString() },
    ];

    const newMessagesJson = JSON.stringify(newMessages);
    const expiresAt = opts.userId ? null : addHours(new Date(), 24);

    // jsonb_path_query_array with '$[last-N to last]' slices by insertion order —
    // deterministic regardless of timestamp collisions, no OFFSET arithmetic needed.
    const keepFrom = MAX_SESSION_MESSAGES - 1;

    if (opts.userId) {
      await this.prisma.$executeRaw`
        INSERT INTO chat_sessions (id, user_id, guest_id, messages, expires_at, created_at, updated_at)
        VALUES (gen_random_uuid(), ${opts.userId}::uuid, NULL, ${newMessagesJson}::jsonb, NULL, now(), now())
        ON CONFLICT (user_id) DO UPDATE
          SET messages = jsonb_path_query_array(
                chat_sessions.messages || ${newMessagesJson}::jsonb,
                ${`$[last-${keepFrom} to last]`}::jsonpath
              ),
              updated_at = now()
      `;
    } else {
      await this.prisma.$executeRaw`
        INSERT INTO chat_sessions (id, user_id, guest_id, messages, expires_at, created_at, updated_at)
        VALUES (gen_random_uuid(), NULL, ${opts.guestId}, ${newMessagesJson}::jsonb, ${expiresAt}, now(), now())
        ON CONFLICT (guest_id) DO UPDATE
          SET messages = jsonb_path_query_array(
                chat_sessions.messages || ${newMessagesJson}::jsonb,
                ${`$[last-${keepFrom} to last]`}::jsonpath
              ),
              expires_at = ${expiresAt},
              updated_at = now()
      `;
    }
  }

  async clear(opts: SessionOpts): Promise<void> {
    if (!opts.userId && !opts.guestId) throw new BadRequestException('Identity required');
    const threadId = opts.userId
      ? `user:${opts.userId}`
      : `guest:${opts.guestId}`;

    await this.prisma.$transaction([
      this.prisma.chatSession.updateMany({
        where: opts.userId ? { userId: opts.userId } : { guestId: opts.guestId },
        data: { messages: [] },
      }),
      this.prisma.$executeRaw`DELETE FROM checkpoints WHERE thread_id = ${threadId}`,
      this.prisma.$executeRaw`DELETE FROM checkpoint_blobs WHERE thread_id = ${threadId}`,
      this.prisma.$executeRaw`DELETE FROM checkpoint_writes WHERE thread_id = ${threadId}`,
    ]);
  }

  findSession(opts: SessionOpts) {
    if (!opts.userId && !opts.guestId) throw new BadRequestException('Identity required');
    if (opts.userId) {
      return this.prisma.chatSession.findUnique({ where: { userId: opts.userId } });
    }
    return this.prisma.chatSession.findFirst({ where: { guestId: opts.guestId } });
  }
}
