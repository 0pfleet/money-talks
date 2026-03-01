/**
 * Memory tools — persist and recall financial insights across sessions.
 *
 * SearchMemory:
 *   Semantic search over past insights using vector embeddings.
 *   Returns top-k relevant memories in STAR format.
 *
 * RecordMemory:
 *   Save a new insight. Embedded and stored in Qdrant + SQLite.
 *   Best used for: spending patterns, budget targets, recurring observations.
 *
 * Storage:
 *   - Qdrant (vector DB) for semantic similarity search
 *   - SQLite for metadata and full text persistence
 *
 * TODO: Implement embedding + vector search
 */

export const SEARCH_MEMORY_TOOL_NAME = "SearchMemory";
export const RECORD_MEMORY_TOOL_NAME = "RecordMemory";
