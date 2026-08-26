import { create } from 'zustand';

type ToastType = 'success' | 'error';
type Toast = { id: number; message: string; type: ToastType };

interface ToastState {
  toasts: Toast[];
  showToast: (message: string, type?: ToastType) => void;
  dismissToast: (id: number) => void;
}

let nextId = 1;

export const useToast = create<ToastState>((set) => ({
  toasts: [],
  showToast: (message, type = 'success') => {
    const id = nextId++;
    set(state => ({ toasts: [...state.toasts, { id, message, type }] }));
    setTimeout(() => {
      set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }));
    }, 4000);
  },
  dismissToast: (id) => set(state => ({ toasts: state.toasts.filter(t => t.id !== id) })),
}));

// Convenience helpers usable outside React components too.
export const toast = {
  success: (message: string) => useToast.getState().showToast(message, 'success'),
  error: (message: string) => useToast.getState().showToast(message, 'error'),
};
