// Langfuse client singleton. Every agent step gets a trace + nested spans.
// The eval harness logs one trace per source article so we can chart quality over time.

import { Langfuse } from "langfuse";

let cached: Langfuse | null = null;

export function getLangfuse(): Langfuse {
  if (cached) return cached;
  cached = new Langfuse({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: process.env.LANGFUSE_HOST || "https://cloud.langfuse.com",
  });
  return cached;
}

// Convenience: start a trace tagged with the agent loop step + question id.
export function startAgentTrace(args: {
  name: string;
  submissionId?: string;
  questionId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}) {
  return getLangfuse().trace({
    name: args.name,
    userId: args.userId,
    metadata: {
      submissionId: args.submissionId,
      questionId: args.questionId,
      ...args.metadata,
    },
  });
}
