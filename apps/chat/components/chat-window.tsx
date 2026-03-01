"use client";

import { useState, useRef, useEffect, type FormEvent } from "react";
import type { Message } from "@/app/page";

interface ChatWindowProps {
  messages: Message[];
  onSendMessage: (content: string) => void;
  onToggleSidebar: () => void;
  onToggleArtifacts: () => void;
  sidebarOpen: boolean;
  artifactsOpen: boolean;
  artifactCount: number;
}

export function ChatWindow({
  messages,
  onSendMessage,
  onToggleSidebar,
  onToggleArtifacts,
  sidebarOpen,
  artifactsOpen,
  artifactCount,
}: ChatWindowProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height =
        Math.min(inputRef.current.scrollHeight, 200) + "px";
    }
  }, [input]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    onSendMessage(trimmed);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <main className="flex-1 flex flex-col min-w-0 bg-monarch-dark">
      {/* Header Bar */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-monarch-dark-border">
        <div className="flex items-center gap-3">
          {/* Sidebar toggle (visible when collapsed) */}
          {!sidebarOpen && (
            <button
              onClick={onToggleSidebar}
              className="p-1.5 rounded-md text-warm-500 hover:text-warm-200 hover:bg-monarch-dark-elevated transition-colors"
              title="Open sidebar"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 18 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              >
                <path d="M3 5H15M3 9H15M3 13H15" />
              </svg>
            </button>
          )}
          <h1 className="font-heading text-lg font-semibold text-warm-100">
            money-talks
          </h1>
        </div>

        {/* Artifacts toggle */}
        <button
          onClick={onToggleArtifacts}
          className={`
            flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-pill)]
            text-sm transition-colors
            ${
              artifactsOpen
                ? "bg-monarch-dark-elevated text-warm-200"
                : "text-warm-500 hover:text-warm-200 hover:bg-monarch-dark-elevated"
            }
          `}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2" y="2" width="5" height="5" rx="1" />
            <rect x="9" y="2" width="5" height="5" rx="1" />
            <rect x="2" y="9" width="5" height="5" rx="1" />
            <rect x="9" y="9" width="5" height="5" rx="1" />
          </svg>
          Artifacts
          {artifactCount > 0 && (
            <span className="bg-monarch-orange text-white text-xs font-medium px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
              {artifactCount}
            </span>
          )}
        </button>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <EmptyState onSuggestionClick={onSendMessage} />
        ) : (
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-monarch-dark-border p-4">
        <form
          onSubmit={handleSubmit}
          className="max-w-3xl mx-auto relative"
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your finances..."
            rows={1}
            className="
              w-full resize-none bg-monarch-dark-surface
              text-warm-100 placeholder:text-warm-600
              rounded-[var(--radius-input)] px-4 py-3 pr-12
              border border-monarch-dark-border
              focus:outline-none focus:border-monarch-orange/50
              transition-colors text-sm leading-relaxed
            "
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="
              absolute right-2 bottom-2 p-2
              rounded-lg text-warm-500
              hover:text-monarch-orange hover:bg-monarch-dark-elevated
              disabled:opacity-30 disabled:hover:text-warm-500
              disabled:hover:bg-transparent
              transition-colors
            "
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="currentColor"
            >
              <path d="M2.5 16.5L16.5 9L2.5 1.5V7.5L11.5 9L2.5 10.5V16.5Z" />
            </svg>
          </button>
        </form>
        <p className="text-center text-xs text-warm-600 mt-2">
          Your data stays local. Only your questions reach Claude.
        </p>
      </div>
    </main>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`
          max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed
          ${
            isUser
              ? "bg-monarch-orange text-white rounded-br-md"
              : "bg-monarch-dark-surface card-border text-warm-200 rounded-bl-md"
          }
        `}
      >
        {!isUser && (
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-monarch-orange" />
            <span className="text-xs font-medium text-warm-400">
              Adviser
            </span>
          </div>
        )}
        <p className="whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  );
}

function EmptyState({ onSuggestionClick }: { onSuggestionClick: (msg: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      <div className="w-12 h-12 rounded-2xl bg-monarch-orange/10 flex items-center justify-center mb-4">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#FF692D"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2L2 7L12 12L22 7L12 2Z" />
          <path d="M2 17L12 22L22 17" />
          <path d="M2 12L12 17L22 12" />
        </svg>
      </div>
      <h2 className="font-heading text-xl font-semibold text-warm-100 mb-2">
        What do you want to know?
      </h2>
      <p className="text-sm text-warm-500 max-w-sm mb-8">
        Ask about your spending, budgets, trends, or anything else about
        your finances. I&apos;ll query your data, make charts, and give you
        straight answers.
      </p>

      {/* Suggestion chips */}
      <div className="flex flex-wrap gap-2 max-w-md justify-center">
        {[
          "How much did I spend this month?",
          "Show my spending trend by category",
          "What subscriptions am I paying for?",
          "Am I on track with my budget?",
        ].map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => onSuggestionClick(suggestion)}
            className="
              px-3 py-2 text-xs text-warm-400
              bg-monarch-dark-surface card-border
              rounded-[var(--radius-pill)]
              hover:text-warm-200 hover:bg-monarch-dark-elevated
              transition-colors cursor-pointer
            "
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}
