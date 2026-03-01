/**
 * Chat API endpoint — the core of the agentic interface.
 *
 * Architecture:
 *   1. Receive user message + conversation history
 *   2. Build system prompt with financial analyst persona
 *   3. Attach tools: Notebook (SQL/Python), SearchMemory, RecordMemory, CreateArtifact
 *   4. Stream response from Claude via Vercel AI SDK
 *   5. Tool calls execute locally against DuckDB data lake
 *
 * TODO: Implement full tool surface and streaming
 */

export async function POST(request: Request) {
  return new Response(
    JSON.stringify({ message: "Chat endpoint — not yet implemented" }),
    { status: 501, headers: { "Content-Type": "application/json" } },
  );
}
