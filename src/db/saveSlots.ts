import Dexie, { type Table } from 'dexie';

// ─────────────────────────────────────────────
// Save slot metadata (separate lightweight DB)
// ─────────────────────────────────────────────

export interface SaveSlot {
  id: string;
  agencyName: string;
  bossName: string;
  logoId: string;
  createdAt: number;
  lastSavedAt: number;
  // Snapshot for display in slot picker
  money: number;
  intel: number;
  totalMissionsCompleted: number;
}

class MetaDB extends Dexie {
  slots!: Table<SaveSlot, string>;

  constructor() {
    super('shadow-ops-meta');
    this.version(1).stores({
      slots: 'id, createdAt, lastSavedAt',
    });
  }
}

export const metaDb = new MetaDB();

export async function listSaveSlots(): Promise<SaveSlot[]> {
  return metaDb.slots.orderBy('lastSavedAt').reverse().toArray();
}

export async function deleteSaveSlot(slotId: string): Promise<void> {
  // Delete the game data DB for this slot
  await new Dexie(`shadow-ops-save-${slotId}`).delete();
  // Remove from the meta index
  await metaDb.slots.delete(slotId);
  // Forget as active slot if it was active
  if (localStorage.getItem('shadow-ops-active-slot') === slotId) {
    localStorage.removeItem('shadow-ops-active-slot');
  }
}
