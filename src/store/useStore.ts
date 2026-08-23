import { fetchApi } from '../lib/api';
import { create } from 'zustand';

interface AppState {
  activeCashSession: any | null;
  setActiveCashSession: (session: any) => void;
  fetchActiveSession: () => Promise<void>;
}

export const useStore = create<AppState>((set) => ({
  activeCashSession: null,
  setActiveCashSession: (session) => set({ activeCashSession: session }),
  fetchActiveSession: async () => {
    try {
      const res = await fetchApi('/api/cash-sessions/active');
      const data = await res.json();
      set({ activeCashSession: data });
    } catch (error) {
      console.error('Failed to fetch active session', error);
    }
  },
}));
