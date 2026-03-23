import { create } from 'zustand';

export type TabId = 'map' | 'missions' | 'agents' | 'base' | 'menu';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  expiresAt: number;
}

interface UIStore {
  activeTab: TabId;
  activeModal: ModalId;
  modalData: unknown;
  selectedRegionId: string | null;
  selectedAgentId: string | null;
  toasts: Toast[];
  saveSwitchRequested: boolean;

  setActiveTab: (tab: TabId) => void;
  openModal: (modal: ModalId, data?: unknown) => void;
  closeModal: () => void;
  selectRegion: (regionId: string | null) => void;
  selectAgent: (agentId: string | null) => void;
  showToast: (type: Toast['type'], message: string) => void;
  dismissToast: (id: string) => void;
  pruneExpiredToasts: () => void;
  requestSaveSelect: () => void;
  clearSaveSwitchRequest: () => void;
}

let toastCounter = 0;

export const useUIStore = create<UIStore>((set, get) => ({
  activeTab: 'map',
  selectedRegionId: null,
  selectedAgentId: null,
  toasts: [],
  saveSwitchRequested: false,

  setActiveTab: (tab) => set({ activeTab: tab }),

  selectRegion: (regionId) => set({ selectedRegionId: regionId }),

  selectAgent: (agentId) => set({ selectedAgentId: agentId }),

  showToast: (type, message) => {
    const id = `toast_${++toastCounter}`;
    const toast: Toast = { id, type, message, expiresAt: Date.now() + 3500 };
    set((state) => ({
      toasts: [...state.toasts.slice(-2), toast], // max 3 toasts
    }));
    // Auto-dismiss
    setTimeout(() => get().dismissToast(id), 3600);
  },

  dismissToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  pruneExpiredToasts: () => {
    const now = Date.now();
    set((state) => ({
      toasts: state.toasts.filter((t) => t.expiresAt > now),
    }));
  },

  requestSaveSelect: () => set({ saveSwitchRequested: true }),
  clearSaveSwitchRequest: () => set({ saveSwitchRequested: false }),
}));
