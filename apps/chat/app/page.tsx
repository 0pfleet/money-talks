"use client";

import { useState, useCallback } from "react";
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
  /** Artifacts generated during this message */
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

  // ── Messages per thread (ephemeral) ────────────────────────────
  const [messagesByThread, setMessagesByThread] = useState<
    Record<string, Message[]>
  >({
    default: [],
  });

  // ── Artifacts (ephemeral) ──────────────────────────────────────
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);

  const activeMessages = messagesByThread[activeThreadId] ?? [];
  const activeArtifacts = artifacts.filter(
    (a) => a.threadId === activeThreadId,
  );

  const handleNewThread = useCallback(() => {
    const id = `thread-${Date.now()}`;
    const thread: Thread = {
      id,
      title: "New conversation",
      createdAt: new Date(),
    };
    setThreads((prev) => [thread, ...prev]);
    setMessagesByThread((prev) => ({ ...prev, [id]: [] }));
    setActiveThreadId(id);
  }, []);

  const handleSendMessage = useCallback(
    (content: string) => {
      const userMsg: Message = {
        id: `msg-${Date.now()}`,
        role: "user",
        content,
      };

      setMessagesByThread((prev) => ({
        ...prev,
        [activeThreadId]: [...(prev[activeThreadId] ?? []), userMsg],
      }));

      // Update thread title from first message
      if ((messagesByThread[activeThreadId] ?? []).length === 0) {
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

      // Simulate assistant response (placeholder until wired to API)
      setTimeout(() => {
        const assistantMsg: Message = {
          id: `msg-${Date.now() + 1}`,
          role: "assistant",
          content:
            "I'm not connected to the backend yet. Once the Jupyter kernel and chat API are wired up, I'll be able to query your financial data, generate charts, and give you real advice.",
        };
        setMessagesByThread((prev) => ({
          ...prev,
          [activeThreadId]: [
            ...(prev[activeThreadId] ?? []),
            assistantMsg,
          ],
        }));
      }, 500);
    },
    [activeThreadId, messagesByThread],
  );

  const handleAddArtifact = useCallback(
    (artifact: Omit<Artifact, "id" | "threadId" | "createdAt">) => {
      const newArtifact: Artifact = {
        ...artifact,
        id: `artifact-${Date.now()}`,
        threadId: activeThreadId,
        createdAt: new Date(),
      };
      setArtifacts((prev) => [...prev, newArtifact]);
      if (!artifactsPanelOpen) setArtifactsPanelOpen(true);
    },
    [activeThreadId, artifactsPanelOpen],
  );

  return (
    <div className="flex h-screen">
      {/* Threads Sidebar */}
      <ThreadsSidebar
        threads={threads}
        activeThreadId={activeThreadId}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onSelectThread={setActiveThreadId}
        onNewThread={handleNewThread}
      />

      {/* Main Chat */}
      <ChatWindow
        messages={activeMessages}
        onSendMessage={handleSendMessage}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onToggleArtifacts={() => setArtifactsPanelOpen(!artifactsPanelOpen)}
        sidebarOpen={sidebarOpen}
        artifactsOpen={artifactsPanelOpen}
        artifactCount={activeArtifacts.length}
      />

      {/* Artifacts Panel */}
      <ArtifactsPanel
        artifacts={activeArtifacts}
        isOpen={artifactsPanelOpen}
        onToggle={() => setArtifactsPanelOpen(!artifactsPanelOpen)}
      />
    </div>
  );
}
