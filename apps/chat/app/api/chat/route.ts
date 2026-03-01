/**
 * Chat API endpoint — the core of the agentic financial adviser.
 *
 * Flow:
 *   1. Receive user message + conversation history
 *   2. Build system prompt (financial adviser persona)
 *   3. Attach tools: execute (Jupyter kernel), SearchMemory, RecordMemory
 *   4. Stream response from Claude via Vercel AI SDK
 *   5. Tool calls execute locally — code runs in Jupyter, data stays on machine
 *
 * The agent loop (maxSteps) lets Claude:
 *   - Execute code to query data
 *   - See the results (text, figures, errors)
 *   - Execute more code to refine the analysis or fix errors
 *   - Finally respond with insights and advice
 */

import { anthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import { z } from "zod";

import { SYSTEM_PROMPT } from "@/lib/prompts";
import { executeInKernel } from "@/lib/tools/notebook/kernel-client";
import { executeToolSchema, formatResultForLLM } from "@/lib/tools/notebook";

export async function POST(request: Request) {
  const { messages } = await request.json();

  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: SYSTEM_PROMPT,
    messages,
    maxSteps: 10,
    tools: {
      execute: {
        description:
          "Execute Python code in a Jupyter notebook with pandas, matplotlib, plotly, and DuckDB. " +
          "The `conn` variable is a pre-connected DuckDB instance with views over all financial tables. " +
          "Use `query(sql)` for quick SQL queries. Use `plt` for charts. " +
          "Variables persist between calls.",
        parameters: executeToolSchema,
        execute: async ({ code }) => {
          const result = await executeInKernel(code);
          return {
            text: formatResultForLLM(result),
            figures: result.figures,
          };
        },
      },

      searchMemory: {
        description:
          "Search your memory for past insights about this user's finances. " +
          "Always call this at the start of a conversation.",
        parameters: z.object({
          query: z.string().describe("What to search for in memory"),
        }),
        execute: async ({ query }) => {
          // TODO: Implement Qdrant vector search
          return { results: [] as string[], message: "Memory not yet implemented" };
        },
      },

      recordMemory: {
        description:
          "Save a financial insight for future sessions. " +
          "Use for spending patterns, goals, recurring observations.",
        parameters: z.object({
          memory: z
            .string()
            .describe("The insight to remember, in STAR format if possible"),
        }),
        execute: async ({ memory }) => {
          // TODO: Implement Qdrant + SQLite storage
          return { saved: false, message: "Memory not yet implemented" };
        },
      },
    },
  });

  return result.toDataStreamResponse();
}
