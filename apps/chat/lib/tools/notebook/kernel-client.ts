/**
 * Jupyter Kernel Gateway client using @jupyterlab/services.
 *
 * Manages a persistent kernel connection for the chat session.
 * Each session gets its own kernel with pre-loaded financial data.
 *
 * Connection flow:
 *   1. Connect to Kernel Gateway via ServerConnection
 *   2. Start (or reuse) a Python kernel
 *   3. Send execute_request over WebSocket
 *   4. Collect IOPub messages until kernel goes idle
 *   5. Return structured ExecutionResult
 */

import type { ExecutionResult } from "./index";
import { processIOPubMessages } from "./index";

/** Configuration for connecting to the Jupyter Kernel Gateway. */
export interface KernelConfig {
  /** Base URL of the Kernel Gateway (e.g., http://localhost:8888). */
  baseUrl: string;
  /** WebSocket URL (e.g., ws://localhost:8888). */
  wsUrl: string;
  /** Auth token for the Kernel Gateway. */
  token: string;
}

/** Default config for local development. */
export const DEFAULT_KERNEL_CONFIG: KernelConfig = {
  baseUrl: process.env.JUPYTER_BASE_URL || "http://localhost:8888",
  wsUrl: process.env.JUPYTER_WS_URL || "ws://localhost:8888",
  token: process.env.JUPYTER_TOKEN || "money-talks-dev",
};

/**
 * Execute code in a Jupyter kernel and return structured results.
 *
 * This is the main entry point for the execute tool. It:
 *   1. Connects to (or reuses) a kernel
 *   2. Sends code for execution
 *   3. Collects all IOPub messages until the kernel goes idle
 *   4. Returns parsed text, figures, and errors
 *
 * Uses @jupyterlab/services for WebSocket kernel communication.
 * The library handles the Jupyter wire protocol (message IDs,
 * channel multiplexing, HMAC auth) transparently.
 *
 * Example usage:
 *   const result = await executeInKernel("query('SELECT * FROM transactions LIMIT 5')");
 *   // result.text contains the DataFrame output
 *   // result.figures contains any matplotlib/plotly charts as base64 PNG
 *   // result.error contains traceback if execution failed
 */
export async function executeInKernel(
  code: string,
  config: KernelConfig = DEFAULT_KERNEL_CONFIG,
  timeoutMs: number = 30_000,
): Promise<ExecutionResult> {
  // Dynamic import — @jupyterlab/services is a heavy package,
  // only load when actually executing code
  const { KernelManager, ServerConnection } = await import(
    "@jupyterlab/services"
  );

  const serverSettings = ServerConnection.makeSettings({
    baseUrl: config.baseUrl,
    wsUrl: config.wsUrl,
    token: config.token,
  });

  const kernelManager = new KernelManager({ serverSettings });
  const kernel = await kernelManager.startNew({ name: "python3" });

  try {
    const result = await executeWithTimeout(kernel, code, timeoutMs);
    return result;
  } finally {
    // Don't shut down the kernel — keep it warm for the next execution.
    // The kernel persists for the lifetime of the Docker container.
    // Variables, imports, and state carry over between executions,
    // which is exactly what we want for iterative analysis.
  }
}

async function executeWithTimeout(
  kernel: any,
  code: string,
  timeoutMs: number,
): Promise<ExecutionResult> {
  return new Promise((resolve, reject) => {
    const messages: any[] = [];
    const timer = setTimeout(() => {
      kernel.interrupt();
      resolve({
        text: "[execution timed out]",
        figures: [],
        error: {
          name: "TimeoutError",
          value: `Execution exceeded ${timeoutMs / 1000}s limit`,
          traceback: "",
        },
        truncated: false,
      });
    }, timeoutMs);

    const future = kernel.requestExecute({ code });

    future.onIOPub = (msg: any) => {
      const msgType = msg.header.msg_type;
      if (
        msgType === "stream" ||
        msgType === "display_data" ||
        msgType === "execute_result" ||
        msgType === "error"
      ) {
        messages.push({ msg_type: msgType, content: msg.content });
      }
    };

    future.done
      .then(() => {
        clearTimeout(timer);
        resolve(processIOPubMessages(messages));
      })
      .catch((err: Error) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}
