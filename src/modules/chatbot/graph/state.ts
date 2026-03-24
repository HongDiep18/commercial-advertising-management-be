import { Annotation, MessagesAnnotation } from '@langchain/langgraph';

export const ChatStateAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  lang: Annotation<string>({ reducer: (_, b) => b, default: () => '' }),
  intent: Annotation<'static' | 'ads' | 'news'>({
    reducer: (_, b) => b,
    default: () => 'static',
  }),
  context: Annotation<string>({ reducer: (_, b) => b, default: () => '' }),
  summary: Annotation<string>({ reducer: (_, b) => b, default: () => '' }),
});

export type ChatState = typeof ChatStateAnnotation.State;
