"use client";

import type { Thread } from "@/app/page";

interface ThreadsSidebarProps {
  threads: Thread[];
  activeThreadId: string;
  isOpen: boolean;
  onToggle: () => void;
  onSelectThread: (id: string) => void;
  onNewThread: () => void;
}

export function ThreadsSidebar({
  threads,
  activeThreadId,
  isOpen,
  onToggle,
  onSelectThread,
  onNewThread,
}: ThreadsSidebarProps) {
  return (
    <aside
      className={`
        flex flex-col bg-monarch-dark-surface border-r border-monarch-dark-border
        transition-all duration-200 ease-in-out overflow-hidden
        ${isOpen ? "w-64" : "w-0"}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-monarch-dark-border">
        <h2 className="font-heading text-sm font-semibold text-warm-300 uppercase tracking-wider">
          Threads
        </h2>
        <button
          onClick={onToggle}
          className="p-1.5 rounded-md text-warm-500 hover:text-warm-200 hover:bg-monarch-dark-elevated transition-colors"
          title="Collapse sidebar"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <path d="M10 4L6 8L10 12" />
          </svg>
        </button>
      </div>

      {/* New Thread Button */}
      <div className="p-3">
        <button
          onClick={onNewThread}
          className="
            w-full flex items-center gap-2 px-3 py-2.5
            bg-monarch-orange text-white text-sm font-medium
            rounded-[var(--radius-pill)] hover:bg-monarch-orange-hover
            transition-colors
          "
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M8 3V13M3 8H13" />
          </svg>
          New conversation
        </button>
      </div>

      {/* Thread List */}
      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        {threads.map((thread) => {
          const isActive = thread.id === activeThreadId;
          return (
            <button
              key={thread.id}
              onClick={() => onSelectThread(thread.id)}
              className={`
                w-full text-left px-3 py-2.5 rounded-lg mb-0.5
                text-sm transition-colors truncate
                ${
                  isActive
                    ? "bg-monarch-dark-elevated text-warm-100"
                    : "text-warm-400 hover:text-warm-200 hover:bg-monarch-dark-elevated/50"
                }
              `}
            >
              <span className="block truncate">{thread.title}</span>
              <span className="block text-xs text-warm-600 mt-0.5">
                {formatRelativeTime(thread.createdAt)}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-monarch-dark-border">
        <div className="flex items-center gap-2 px-2">
          <div className="w-2 h-2 rounded-full bg-monarch-orange" />
          <span className="text-xs text-warm-500">money-talks</span>
        </div>
      </div>
    </aside>
  );
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;

  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
