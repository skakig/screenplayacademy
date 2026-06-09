// Persistence adapter contract for the screenplay editor.
//
// The editor hook (useScreenplayDocument) owns local state only. All network
// I/O — inserts, updates, deletes, draft snapshots — must go through an
// adapter that implements this interface. Pass 1 ships a no-op adapter so
// /editor-lab can prove the writing engine without Supabase. Pass 2 will add
// a SupabasePersistenceAdapter behind the same contract.

export type PersistRow = {
  localId: string;
  block_type: string;
  content: string;
  order_index: number;
  metadata?: any;
};

export type PersistSnapshot = PersistRow & { serverId?: string };

export interface PersistenceAdapter {
  /**
   * Queue an insert for a brand-new local block. The adapter calls
   * `onServerId` once the server assigns a real ID so the hook can patch
   * the local block in place (without changing its React key).
   */
  queueInsert(row: PersistRow, onServerId: (serverId: string) => void): void;

  /**
   * Schedule a debounced update for an existing block. `getSnapshot` is
   * called at flush time so the adapter always saves the latest local
   * content, not the content at the moment the update was scheduled.
   */
  scheduleUpdate(
    localId: string,
    getSnapshot: () => PersistSnapshot | undefined,
    delayMs?: number,
  ): void;

  /** Fire-and-forget delete. Adapter may no-op if the block was never persisted. */
  queueDelete(serverId: string): void;

  /** Optional: cancel any pending work for a local block (e.g. on delete). */
  cancelPending?(localId: string): void;

  /** Optional: retry every block whose final save attempt failed. */
  retryFailed?(): void;

  /** Optional: returns the set of localIds whose last attempt failed permanently. */
  getFailedIds?(): Set<string>;
}

/**
 * No-op adapter. Used by /editor-lab and as a safe default for tests.
 * Everything stays in memory; the writing engine is fully exercised without
 * any network dependency.
 */
export const NullPersistenceAdapter: PersistenceAdapter = {
  queueInsert: () => {},
  scheduleUpdate: () => {},
  queueDelete: () => {},
  cancelPending: () => {},
  retryFailed: () => {},
  getFailedIds: () => new Set(),
};
