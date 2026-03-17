import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PGVectorStore } from '@langchain/community/vectorstores/pgvector';
import { ChatOpenAI } from '@langchain/openai';
import { END, START, StateGraph } from '@langchain/langgraph';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { addHours } from 'date-fns';
import { PrismaService } from '../../database/prisma.service';
import { CHECKPOINT_SAVER } from './checkpoint.provider';
import { VECTOR_STORE } from './vectorstore.provider';
import { ChatStateAnnotation, ChatState } from './graph/state';
import { AD_PACKAGE_SELECT, SYSTEM_GUARDRAILS } from './graph/constants';

export interface SessionMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

@Injectable()
export class ChatbotService {
  private readonly graph: ReturnType<typeof this.buildGraph>;
  private readonly llm: ChatOpenAI;
  private readonly logger = new Logger(ChatbotService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(VECTOR_STORE) private readonly vectorStore: PGVectorStore,
    @Inject(CHECKPOINT_SAVER) private readonly checkpointer: PostgresSaver,
    config: ConfigService,
  ) {
    this.llm = new ChatOpenAI({
      openAIApiKey: config.get<string>('chatbot.openAiApiKey'),
      modelName: 'gpt-4.1',
      temperature: 0.3,
    });
    this.graph = this.buildGraph();
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  async *chatStream(
    message: string,
    opts: { userId?: string; guestId?: string },
  ): AsyncGenerator<string> {
    const threadId = opts.userId
      ? `user:${opts.userId}`
      : `guest:${opts.guestId}`;

    this.logger.log(
      `[chat] threadId=${threadId} message="${message.slice(0, 120)}"`,
    );

    let fullReply = '';

    const eventStream = this.graph.streamEvents(
      { messages: [new HumanMessage(message)] },
      { configurable: { thread_id: threadId }, version: 'v2' },
    );

    for await (const event of eventStream) {
      if (
        event.event === 'on_chat_model_stream' &&
        event.metadata?.langgraph_node === 'generate'
      ) {
        const content = event.data?.chunk?.content;
        const token = typeof content === 'string' ? content : '';
        if (token) {
          fullReply += token;
          yield token;
        }
      }
    }

    await this.appendToSession(opts, message, fullReply);
  }

  async getSessionMessages(opts: {
    userId?: string;
    guestId?: string;
  }): Promise<SessionMessage[]> {
    const session = await this.findSession(opts);
    return (session?.messages as unknown as SessionMessage[]) ?? [];
  }

  async clearSession(opts: {
    userId?: string;
    guestId?: string;
  }): Promise<void> {
    const threadId = opts.userId
      ? `user:${opts.userId}`
      : `guest:${opts.guestId}`;

    await Promise.all([
      this.prisma.chatSession.updateMany({
        where: opts.userId
          ? { userId: opts.userId }
          : { guestId: opts.guestId },
        data: { messages: [] },
      }),
      this.prisma.$executeRaw`DELETE FROM checkpoints WHERE thread_id = ${threadId}`,
      this.prisma.$executeRaw`DELETE FROM checkpoint_blobs WHERE thread_id = ${threadId}`,
      this.prisma.$executeRaw`DELETE FROM checkpoint_writes WHERE thread_id = ${threadId}`,
    ]);
  }

  // ─── Graph ───────────────────────────────────────────────────────────────────

  private buildGraph() {
    const workflow = new StateGraph(ChatStateAnnotation)
      .addNode('classify', this.classifyNode.bind(this))
      .addNode('vectorRetrieve', this.vectorRetrieveNode.bind(this))
      .addNode('dbRetrieve', this.dbRetrieveNode.bind(this))
      .addNode('generate', this.generateNode.bind(this))
      .addEdge(START, 'classify')
      .addConditionalEdges('classify', (state: ChatState) =>
        state.intent === 'static' ? 'vectorRetrieve' : 'dbRetrieve',
      )
      .addEdge('vectorRetrieve', 'generate')
      .addEdge('dbRetrieve', 'generate')
      .addEdge('generate', END);

    return workflow.compile({ checkpointer: this.checkpointer });
  }

  // ─── Nodes ───────────────────────────────────────────────────────────────────

  private async classifyNode(state: ChatState): Promise<Partial<ChatState>> {
    const lastMessage = state.messages[state.messages.length - 1];
    const text =
      typeof lastMessage.content === 'string' ? lastMessage.content : '';

    const ClassifySchema = z.object({
      lang: z
        .string()
        .describe(
          'Detected language: "Traditional Chinese", "Vietnamese", or "English"',
        ),
      intent: z
        .enum(['static', 'data'])
        .describe(
          '"static" for how-to, navigation, pricing, registration. "data" for news or ads lookup.',
        ),
    });

    const result = await this.llm.withStructuredOutput(ClassifySchema).invoke([
      new SystemMessage(
        'Detect the language and classify the intent of this message.',
      ),
      new HumanMessage(text),
    ]);

    this.logger.log(
      `[classify] lang="${result.lang}" intent="${result.intent}"`,
    );
    return { lang: result.lang, intent: result.intent };
  }

  private async vectorRetrieveNode(
    state: ChatState,
  ): Promise<Partial<ChatState>> {
    const lastMessage = state.messages[state.messages.length - 1];
    const query =
      typeof lastMessage.content === 'string' ? lastMessage.content : '';

    const vectorDocs = await this.vectorStore.similaritySearch(query, 5);

    const keywordDocs = await this.prisma.$queryRaw<
      { content: string; metadata: Record<string, string> }[]
    >`
      SELECT content, metadata
      FROM document_chunks
      WHERE content ILIKE ${'%' + query + '%'}
      LIMIT 3
    `;

    const allDocs = [
      ...vectorDocs.map((d) => ({
        content: d.pageContent,
        sourceUrl: d.metadata.sourceUrl as string,
      })),
      ...keywordDocs.map((d) => ({
        content: d.content,
        sourceUrl: d.metadata?.sourceUrl ?? '',
      })),
    ];

    const seen = new Set<string>();
    const unique = allDocs.filter((d) => {
      const key = d.content.slice(0, 80);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    this.logger.log(`[vectorRetrieve] docs=${unique.length}`);
    return {
      context: unique.map((d) => d.content).join('\n\n---\n\n'),
    };
  }

  private async dbRetrieveNode(state: ChatState): Promise<Partial<ChatState>> {
    const lastMessage = state.messages[state.messages.length - 1];
    const query = (
      typeof lastMessage.content === 'string' ? lastMessage.content : ''
    ).toLowerCase();

    this.logger.log(`[dbRetrieve] query="${query.slice(0, 80)}"`);
    // News questions → redirect to /news page, no DB fetch needed
    if (/news|article|latest|tin tức|新聞|最新/.test(query)) {
      this.logger.log('[dbRetrieve] → news redirect');
      return {
        context:
          'For the latest news, please visit the News page at /news on our platform.',
      };
    }

    // Ads packages → fetch live data from DB (public fields only)
    if (/advertis|ad package|sponsor|quảng cáo|廣告/.test(query)) {
      this.logger.log('[dbRetrieve] → ad packages lookup');
      const packages = await this.prisma.adPackage.findMany({
        select: AD_PACKAGE_SELECT,
        where: { isActive: true },
      });
      return {
        context: packages
          .map(
            (p) =>
              `${p.nameZh ?? p.name}: ${p.description ?? ''} (${p.pricingModel})`,
          )
          .join('\n'),
      };
    }

    return { context: '' };
  }

  private async generateNode(state: ChatState): Promise<Partial<ChatState>> {
    const systemPrompt = [
      SYSTEM_GUARDRAILS,
      `\nRespond in: ${state.lang || 'the same language as the user'}.`,
      state.context ? `\nRelevant context:\n---\n${state.context}\n---` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const response = await this.llm.invoke([
      new SystemMessage(systemPrompt),
      ...state.messages,
    ]);

    return { messages: [response] };
  }

  // ─── Session helpers ─────────────────────────────────────────────────────────

  private async findSession(opts: { userId?: string; guestId?: string }) {
    if (opts.userId) {
      return this.prisma.chatSession.findUnique({
        where: { userId: opts.userId },
      });
    }
    return this.prisma.chatSession.findFirst({
      where: { guestId: opts.guestId },
    });
  }

  private async appendToSession(
    opts: { userId?: string; guestId?: string },
    userMessage: string,
    assistantReply: string,
  ): Promise<void> {
    const newMessages: SessionMessage[] = [
      {
        role: 'user',
        content: userMessage,
        timestamp: new Date().toISOString(),
      },
      {
        role: 'assistant',
        content: assistantReply,
        timestamp: new Date().toISOString(),
      },
    ];

    const session = await this.findSession(opts);

    if (!session) {
      await this.prisma.chatSession.create({
        data: {
          userId: opts.userId ?? null,
          guestId: opts.guestId ?? null,
          messages: newMessages as unknown as never,
          expiresAt: opts.userId ? null : addHours(new Date(), 24),
        },
      });
      return;
    }

    const existing =
      (session.messages as unknown as SessionMessage[]) ?? [];
    const updated = [...existing, ...newMessages].slice(-20);

    await this.prisma.chatSession.update({
      where: { id: session.id },
      data: {
        messages: updated as unknown as never,
        ...(opts.guestId && { expiresAt: addHours(new Date(), 24) }),
      },
    });
  }
}
