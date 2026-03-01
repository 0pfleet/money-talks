"use client";

import type { Artifact } from "@/app/page";

interface ArtifactsPanelProps {
  artifacts: Artifact[];
  isOpen: boolean;
  onToggle: () => void;
}

export function ArtifactsPanel({
  artifacts,
  isOpen,
  onToggle,
}: ArtifactsPanelProps) {
  return (
    <aside
      className={`
        flex flex-col bg-monarch-dark-surface border-l border-monarch-dark-border
        transition-all duration-200 ease-in-out overflow-hidden
        ${isOpen ? "w-96" : "w-0"}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-monarch-dark-border">
        <h2 className="font-heading text-sm font-semibold text-warm-300 uppercase tracking-wider">
          Artifacts
        </h2>
        <button
          onClick={onToggle}
          className="p-1.5 rounded-md text-warm-500 hover:text-warm-200 hover:bg-monarch-dark-elevated transition-colors"
          title="Close artifacts"
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
            <path d="M6 4L10 8L6 12" />
          </svg>
        </button>
      </div>

      {/* Type Filter Tabs */}
      <div className="flex gap-1 px-4 pt-3">
        <TypeTab label="All" count={artifacts.length} active />
        <TypeTab
          label="Real"
          count={artifacts.filter((a) => a.type === "real").length}
          variant="real"
        />
        <TypeTab
          label="Projected"
          count={artifacts.filter((a) => a.type === "projected").length}
          variant="projected"
        />
      </div>

      {/* Artifacts List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {artifacts.length === 0 ? (
          <EmptyArtifacts />
        ) : (
          artifacts.map((artifact) => (
            <ArtifactCard key={artifact.id} artifact={artifact} />
          ))
        )}
      </div>
    </aside>
  );
}

function TypeTab({
  label,
  count,
  active = false,
  variant,
}: {
  label: string;
  count: number;
  active?: boolean;
  variant?: "real" | "projected";
}) {
  const dotColor =
    variant === "real"
      ? "bg-artifact-real"
      : variant === "projected"
        ? "bg-artifact-projected"
        : "";

  return (
    <button
      className={`
        flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
        rounded-[var(--radius-pill)] transition-colors
        ${
          active
            ? "bg-monarch-dark-elevated text-warm-200"
            : "text-warm-500 hover:text-warm-300 hover:bg-monarch-dark-elevated/50"
        }
      `}
    >
      {dotColor && (
        <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      )}
      {label}
      {count > 0 && (
        <span className="text-warm-600 ml-0.5">{count}</span>
      )}
    </button>
  );
}

function ArtifactCard({ artifact }: { artifact: Artifact }) {
  const isReal = artifact.type === "real";

  return (
    <div className="bg-monarch-dark-elevated rounded-[var(--radius-card)] card-border card-border-hover overflow-hidden transition-shadow">
      {/* Type Badge */}
      <div className="flex items-center justify-between px-3 pt-3">
        <span
          className={`
            inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium
            rounded-[var(--radius-pill)]
            ${
              isReal
                ? "bg-artifact-real-bg text-artifact-real"
                : "bg-artifact-projected-bg text-artifact-projected"
            }
          `}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${isReal ? "bg-artifact-real" : "bg-artifact-projected"}`}
          />
          {isReal ? "Real" : "Projected"}
        </span>
        <span className="text-xs text-warm-600">
          {formatTime(artifact.createdAt)}
        </span>
      </div>

      {/* Chart Image */}
      {artifact.imageData && (
        <div className="px-3 pt-2">
          <img
            src={`data:image/png;base64,${artifact.imageData}`}
            alt={artifact.title}
            className="w-full rounded-[var(--radius-media)] bg-warm-900"
          />
        </div>
      )}

      {/* Title */}
      <div className="px-3 py-3">
        <h3 className="text-sm font-medium text-warm-200 truncate">
          {artifact.title}
        </h3>
      </div>
    </div>
  );
}

function EmptyArtifacts() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      <div className="w-10 h-10 rounded-xl bg-monarch-dark-elevated card-border flex items-center justify-center mb-3">
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-warm-600"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="14" height="14" rx="2" />
          <path d="M3 13L8 8L11 11L17 5" />
        </svg>
      </div>
      <p className="text-sm text-warm-500 mb-1">No artifacts yet</p>
      <p className="text-xs text-warm-600 max-w-48">
        Charts and visualizations will appear here as the adviser generates
        them.
      </p>
    </div>
  );
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
