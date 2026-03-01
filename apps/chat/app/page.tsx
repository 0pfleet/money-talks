"use client";

import { useState, useCallback, useId } from "react";
import { useChat, type Message as AiMessage } from "ai/react";
import { ThreadsSidebar } from "@/components/threads-sidebar";
import { ChatWindow } from "@/components/chat-window";
import { ArtifactsPanel } from "@/components/artifacts-panel";

export interface Thread {
  id: string;
  title: string;
  createdAt: Date;
  lastMessage?: string;
}

export interface Artifact {
  id: string;
  threadId: string;
  title: string;
  type: "real" | "projected";
  /** Base64-encoded PNG image data */
  imageData: string;
  createdAt: Date;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  artifactIds?: string[];
}

export default function Home() {
  // ── Thread state (ephemeral, in-memory) ────────────────────────
  const [threads, setThreads] = useState<Thread[]>([
    {
      id: "default",
      title: "New conversation",
      createdAt: new Date(),
    },
  ]);
  const [activeThreadId, setActiveThreadId] = useState("default");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [artifactsPanelOpen, setArtifactsPanelOpen] = useState(true);

  // ── Artifacts (ephemeral) ──────────────────────────────────────
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);

  // ── Vercel AI SDK chat ─────────────────────────────────────────
  const {
    messages: aiMessages,
    input,
    setInput,
    handleSubmit,
    handleInputChange,
    isLoading,
    error,
  } = useChat({
    api: "/api/chat",
    id: activeThreadId,
    onFinish: (message, { finishReason }) => {
      // Extract figures from tool results and create artifacts
      // Tool results are embedded in the message parts
      if (message.role === "assistant" && message.parts) {
        for (const part of message.parts) {
          if (
            part.type === "tool-invocation" &&
            part.toolInvocation.state === "result"
          ) {
            const result = part.toolInvocation.result as
              | { text?: string; figures?: string[] }
              | undefined;
            if (result?.figures && result.figures.length > 0) {
              const newArtifacts: Artifact[] = result.figures.map(
                (fig, i) => ({
                  id: `artifact-${Date.now()}-${i}`,
                  threadId: activeThreadId,
                  title: extractChartTitle(result.text) || `Chart ${artifacts.length + i + 1}`,
                  type: "real" as const,
                  imageData: fig,
                  createdAt: new Date(),
                }),
              );
              setArtifacts((prev) => [...prev, ...newArtifacts]);
              if (!artifactsPanelOpen) setArtifactsPanelOpen(true);
            }
          }
        }
      }
    },
    onError: (err) => {
      console.error("Chat error:", err);
    },
  });

  // Convert AI SDK messages to our Message type for the chat window
  const messages: Message[] = aiMessages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      content:
        m.content ||
        // If no text content, check for tool invocations still in progress
        (m.parts?.some(
          (p) =>
            p.type === "tool-invocation" &&
              p.toolInvocation.state !== "result",
        )
          ? "Analyzing your data..."
          : ""),
    }))
    .filter((m) => m.content);

  const activeArtifacts = artifacts.filter(
    (a) => a.threadId === activeThreadId,
  );

  // ── Thread title from first user message ───────────────────────
  const handleSendMessage = useCallback(
    (content: string) => {
      // Update thread title from first message
      const threadMessages = aiMessages.filter((m) => m.role === "user");
      if (threadMessages.length === 0) {
        setThreads((prev) =>
          prev.map((t) =>
            t.id === activeThreadId
              ? {
                  ...t,
                  title:
                    content.length > 40
                      ? content.slice(0, 40) + "..."
                      : content,
                  lastMessage: content,
                }
              : t,
          ),
        );
      }

      // Set input and submit via useChat
      setInput(content);
      // Need to submit on next tick after input is set
      setTimeout(() => {
        const form = document.getElementById(
          "chat-form",
        ) as HTMLFormElement;
        form?.requestSubmit();
      }, 0);
    },
    [activeThreadId, aiMessages, setInput],
  );

  const handleNewThread = useCallback(() => {
    const id = `thread-${Date.now()}`;
    const thread: Thread = {
      id,
      title: "New conversation",
      createdAt: new Date(),
    };
    setThreads((prev) => [thread, ...prev]);
    setActiveThreadId(id);
  }, []);

  return (
    <div className="flex h-screen">
      <ThreadsSidebar
        threads={threads}
        activeThreadId={activeThreadId}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onSelectThread={setActiveThreadId}
        onNewThread={handleNewThread}
      />

      <ChatWindow
        messages={messages}
        onSendMessage={handleSendMessage}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onToggleArtifacts={() =>
          setArtifactsPanelOpen(!artifactsPanelOpen)
        }
        sidebarOpen={sidebarOpen}
        artifactsOpen={artifactsPanelOpen}
        artifactCount={activeArtifacts.length}
        input={input}
        onInputChange={handleInputChange}
        onSubmit={handleSubmit}
        isLoading={isLoading}
        error={error}
      />

      <ArtifactsPanel
        artifacts={activeArtifacts}
        isOpen={artifactsPanelOpen}
        onToggle={() => setArtifactsPanelOpen(!artifactsPanelOpen)}
      />
    </div>
  );
}

/** Try to extract a chart title from the tool result text. */
function extractChartTitle(text?: string): string | null {
  if (!text) return null;
  // Look for common chart title patterns
  const match = text.match(/(?:title|Title)[=:(]\s*['"]([^'"]+)['"]/);
  if (match) return match[1];
  // Look for "N figure(s) generated" context
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length > 0 && lines[0].length < 80) return lines[0];
  return null;
}
