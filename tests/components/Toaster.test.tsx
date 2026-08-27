// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import Toaster from '../../src/components/Toaster';
import { useToast, toast } from '../../src/store/useToast';

beforeEach(() => {
  useToast.setState({ toasts: [] });
});

afterEach(() => {
  useToast.setState({ toasts: [] });
});

describe('Toaster', () => {
  it('renders nothing when there are no toasts', () => {
    const { container } = render(<Toaster />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a toast message', () => {
    render(<Toaster />);
    act(() => toast.success('تم الحفظ بنجاح'));
    expect(screen.getByText('تم الحفظ بنجاح')).toBeInTheDocument();
  });

  it('dismisses a toast when its close button is clicked', () => {
    render(<Toaster />);
    act(() => toast.error('حدث خطأ'));
    expect(screen.getByText('حدث خطأ')).toBeInTheDocument();

    const dismissButtons = screen.getAllByRole('button');
    fireEvent.click(dismissButtons[0]);

    expect(screen.queryByText('حدث خطأ')).not.toBeInTheDocument();
  });
});
