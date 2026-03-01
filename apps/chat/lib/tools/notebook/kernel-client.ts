/**
 * Jupyter Kernel Gateway client — raw HTTP + WebSocket implementation.
 *
 * Talks directly to the Kernel Gateway REST API and WebSocket channel.
 * No @jupyterlab/services dependency — simpler, works reliably in Node.js.
 *
 * Connection flow:
 *   1. POST /api/kernels → start a kernel
 *   2. WebSocket /api/kernels/{id}/channels → send execute_request
 *   3. Collect IOPub messages until kernel goes idle
 *   4. Return structured ExecutionResult
 */

import { WebSocket } from "ws";
import { processIOPubMessages, type ExecutionResult } from "./index";

export interface KernelConfig {
  baseUrl: string;
  wsUrl: string;
  token: string;
}

const DEFAULT_CONFIG: KernelConfig = {
  baseUrl: process.env.JUPYTER_BASE_URL || "http://localhost:8888",
  wsUrl: process.env.JUPYTER_WS_URL || "ws://localhost:8888",
  token: process.env.JUPYTER_TOKEN || "money-talks-dev",
};

// Cache the kernel ID so we reuse the same kernel across requests
let cachedKernelId: string | null = null;

/**
 * Execute code in a Jupyter kernel and return structured results.
 */
export async function executeInKernel(
  code: string,
  config: KernelConfig = DEFAULT_CONFIG,
  timeoutMs: number = 30_000,
): Promise<ExecutionResult> {
  const kernelId = await getOrCreateKernel(config);
  return executeOnKernel(kernelId, code, config, timeoutMs);
}

async function getOrCreateKernel(config: KernelConfig): Promise<string> {
  if (cachedKernelId) {
    // Verify it's still alive
    try {
      const res = await fetch(
        `${config.baseUrl}/api/kernels/${cachedKernelId}`,
        { headers: { Authorization: `token ${config.token}` } },
      );
      if (res.ok) return cachedKernelId;
    } catch {
      // Kernel died, create a new one
    }
  }

  const res = await fetch(`${config.baseUrl}/api/kernels`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `token ${config.token}`,
    },
    body: JSON.stringify({ name: "python3" }),
  });

  if (!res.ok) {
    throw new Error(
      `Failed to create kernel: ${res.status} ${await res.text()}`,
    );
  }

  const kernel = (await res.json()) as { id: string };
  cachedKernelId = kernel.id;
  return kernel.id;
}

function executeOnKernel(
  kernelId: string,
  code: string,
  config: KernelConfig,
  timeoutMs: number,
): Promise<ExecutionResult> {
  return new Promise((resolve, reject) => {
    const wsUrl = `${config.wsUrl}/api/kernels/${kernelId}/channels?token=${config.token}`;
    const ws = new WebSocket(wsUrl);

    const msgId = crypto.randomUUID();
    const messages: any[] = [];
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        ws.close();
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
      }
    }, timeoutMs);

    ws.on("error", (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(new Error(`WebSocket error: ${err.message}`));
      }
    });

    ws.on("open", () => {
      // Send execute_request on the shell channel
      const executeRequest = {
        channel: "shell",
        header: {
          msg_id: msgId,
          username: "money-talks",
          session: crypto.randomUUID(),
          msg_type: "execute_request",
          version: "5.4",
          date: new Date().toISOString(),
        },
        parent_header: {},
        metadata: {},
        content: {
          code,
          silent: false,
          store_history: true,
          user_expressions: {},
          allow_stdin: false,
          stop_on_error: true,
        },
      };
      ws.send(JSON.stringify(executeRequest));
    });

    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString());

      // Only process messages that are responses to our request
      if (msg.parent_header?.msg_id !== msgId) return;

      const msgType = msg.header?.msg_type;

      if (msg.channel === "iopub") {
        if (
          msgType === "stream" ||
          msgType === "display_data" ||
          msgType === "execute_result" ||
          msgType === "error"
        ) {
          messages.push({ msg_type: msgType, content: msg.content });
        }

        // Kernel is done when it goes idle after our request
        if (
          msgType === "status" &&
          msg.content?.execution_state === "idle"
        ) {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            ws.close();
            resolve(processIOPubMessages(messages));
          }
        }
      }

      // Also resolve on shell reply (backup)
      if (msg.channel === "shell" && msgType === "execute_reply") {
        // Wait a tick for any final IOPub messages
        setTimeout(() => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            ws.close();
            resolve(processIOPubMessages(messages));
          }
        }, 100);
      }
    });

    ws.on("close", () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(processIOPubMessages(messages));
      }
    });
  });
}
