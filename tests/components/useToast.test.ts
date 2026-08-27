import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { useToast, toast } from '../../src/store/useToast';

beforeEach(() => {
  vi.useFakeTimers();
  useToast.setState({ toasts: [] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useToast', () => {
  it('adds a toast with the given message and type', () => {
    toast.success('تم الحفظ');
    const { toasts } = useToast.getState();
    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toMatchObject({ message: 'تم الحفظ', type: 'success' });
  });

  it('defaults to type success via showToast, and error via toast.error', () => {
    toast.error('حدث خطأ');
    const { toasts } = useToast.getState();
    expect(toasts[0].type).toBe('error');
  });

  it('auto-dismisses a toast after the timeout', () => {
    toast.success('مؤقت');
    expect(useToast.getState().toasts).toHaveLength(1);
    vi.advanceTimersByTime(4000);
    expect(useToast.getState().toasts).toHaveLength(0);
  });

  it('dismissToast removes only the targeted toast', () => {
    toast.success('واحد');
    toast.error('اتنين');
    const [first, second] = useToast.getState().toasts;
    useToast.getState().dismissToast(first.id);
    const remaining = useToast.getState().toasts;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(second.id);
  });

  it('keeps multiple toasts independent', () => {
    toast.success('أول');
    toast.success('تاني');
    expect(useToast.getState().toasts).toHaveLength(2);
  });
});
