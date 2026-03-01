/**
 * Context window compaction — prevent overflow in long analysis sessions.
 *
 * Financial analysis conversations tend to be long: multiple queries,
 * result tables, chart descriptions, follow-up questions. Without
 * compaction, the context window fills up fast.
 *
 * Strategy (three tiers):
 *
 * 1. Tool Output Capping
 *    - Notebook outputs: max 15,000 tokens
 *    - Memory search results: max 4,000 tokens
 *    - Applied at tool execution time
 *
 * 2. Per-Step Trimming
 *    - When approaching limits, replace oldest tool outputs with "[cleared]"
 *    - Non-destructive: recent context preserved, old results can be re-queried
 *
 * 3. Boundary Compaction
 *    - When overflow is imminent: summarize older message prefix
 *    - Preserve recent messages raw (user's latest questions + agent responses)
 *    - Summary includes key financial facts discovered so far
 *
 * Token estimation: ceil(JSON.stringify(message).length / 4)
 *
 * TODO: Implement compaction logic
 */

export function estimateTokens(value: unknown): number {
  return Math.ceil(JSON.stringify(value).length / 4);
}
