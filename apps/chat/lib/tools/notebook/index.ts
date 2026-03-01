/**
 * Execute tool — run Python/SQL code in a Jupyter kernel.
 *
 * This is the agent's primary analytical tool. It sends code to a
 * Jupyter Kernel Gateway instance and returns the output (text, figures, errors).
 *
 * Architecture:
 *   Next.js API route → @jupyterlab/services → WebSocket → Kernel Gateway → ipykernel
 *
 * The kernel comes pre-loaded with:
 *   - conn: DuckDB connection with views over all financial data
 *   - pd, np, plt, px: standard analysis libraries
 *   - query(sql): helper that returns a DataFrame
 *   - tables(), schema(name): introspection helpers
 *   - monthly_spending(months): quick spending summary
 *
 * Output handling:
 *   - Text output: stdout + execute_result, truncated to MAX_TEXT_TOKENS
 *   - Figures: base64 PNG from matplotlib/plotly, returned as image data
 *   - Errors: full traceback (LLMs are excellent at reading and fixing these)
 */

import { z } from "zod";

export const EXECUTE_TOOL_NAME = "execute";

export const executeToolSchema = z.object({
  code: z
    .string()
    .describe(
      "Python code to execute. You have pandas, matplotlib, plotly, and DuckDB available. " +
        "Use `conn` for DuckDB queries or the `query(sql)` helper. " +
        "Use `plt` for matplotlib charts and `px` for plotly charts.",
    ),
});

export type ExecuteToolInput = z.infer<typeof executeToolSchema>;

/** Maximum tokens for text output before truncation. */
const MAX_TEXT_CHARS = 60_000; // ~15,000 tokens

/** Maximum number of figures to return per execution. */
const MAX_FIGURES = 5;

/**
 * Parsed result from a Jupyter kernel execution.
 */
export interface ExecutionResult {
  /** Combined text output (stdout + execute_result). */
  text: string;
  /** Base64-encoded PNG images from matplotlib/plotly. */
  figures: string[];
  /** Error info if execution failed. */
  error: {
    name: string;
    value: string;
    traceback: string;
  } | null;
  /** Whether text output was truncated. */
  truncated: boolean;
}

/**
 * Process raw IOPub messages from a Jupyter kernel into a structured result.
 *
 * IOPub message types we care about:
 *   - stream: stdout/stderr text
 *   - execute_result: the cell's return value
 *   - display_data: rich output (figures, HTML tables)
 *   - error: exception with traceback
 */
export function processIOPubMessages(messages: IOPubMessage[]): ExecutionResult {
  const textParts: string[] = [];
  const figures: string[] = [];
  let error: ExecutionResult["error"] = null;

  for (const msg of messages) {
    switch (msg.msg_type) {
      case "stream":
        textParts.push(msg.content.text);
        break;

      case "execute_result":
      case "display_data": {
        const data = msg.content.data;

        // Capture figures (base64 PNG)
        if (data["image/png"] && figures.length < MAX_FIGURES) {
          figures.push(data["image/png"]);
        }

        // Capture text representation
        if (data["text/plain"]) {
          textParts.push(data["text/plain"]);
        }

        // Capture HTML tables (pandas DataFrames render as HTML)
        if (data["text/html"] && !data["image/png"]) {
          textParts.push(data["text/html"]);
        }
        break;
      }

      case "error":
        error = {
          name: msg.content.ename,
          value: msg.content.evalue,
          traceback: msg.content.traceback.join("\n"),
        };
        break;
    }
  }

  let text = textParts.join("");
  let truncated = false;

  if (text.length > MAX_TEXT_CHARS) {
    // Preserve head and tail for context
    const headSize = Math.floor(MAX_TEXT_CHARS * 0.7);
    const tailSize = Math.floor(MAX_TEXT_CHARS * 0.2);
    const removed = text.length - headSize - tailSize;
    text =
      text.slice(0, headSize) +
      `\n\n... [truncated: ${removed.toLocaleString()} chars removed] ...\n\n` +
      text.slice(-tailSize);
    truncated = true;
  }

  return { text, figures, error, truncated };
}

/**
 * Format an ExecutionResult as a string for the LLM tool result.
 */
export function formatResultForLLM(result: ExecutionResult): string {
  const parts: string[] = [];

  if (result.error) {
    parts.push(`ERROR: ${result.error.name}: ${result.error.value}`);
    parts.push(result.error.traceback);
  }

  if (result.text) {
    parts.push(result.text);
  }

  if (result.figures.length > 0) {
    parts.push(`[${result.figures.length} figure(s) generated]`);
  }

  if (result.truncated) {
    parts.push("[output was truncated]");
  }

  return parts.join("\n\n") || "[no output]";
}

// ── IOPub message types ───────────────────────────────────────────────────

interface StreamMessage {
  msg_type: "stream";
  content: { name: "stdout" | "stderr"; text: string };
}

interface DisplayDataMessage {
  msg_type: "display_data" | "execute_result";
  content: {
    data: Record<string, string>;
    metadata: Record<string, unknown>;
  };
}

interface ErrorMessage {
  msg_type: "error";
  content: {
    ename: string;
    evalue: string;
    traceback: string[];
  };
}

type IOPubMessage = StreamMessage | DisplayDataMessage | ErrorMessage;
