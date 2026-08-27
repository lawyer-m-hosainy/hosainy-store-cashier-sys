// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import POS from '../../src/pages/POS';

vi.mock('../../src/store/useStore', () => ({
  useStore: () => ({ activeCashSession: { id: 1, opening_balance: 100 } }),
}));

const mockProducts = [
  { id: 1, name: 'Apple', sell_price: 10, current_stock: 5, sku: 'APL' },
  { id: 2, name: 'Orange', sell_price: 20, current_stock: 0, sku: 'ORG' },
  { id: 3, name: 'Rice', sell_price: 10, current_stock: 100, sku: '00003' },
];

vi.mock('../../src/lib/api', () => ({
  fetchApi: vi.fn((url: string) => {
    if (url.startsWith('/api/products')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockProducts) });
    }
    if (url.startsWith('/api/customers')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  }),
}));

function renderPOS() {
  return render(
    <MemoryRouter>
      <POS />
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe('POS cart', () => {
  it('starts with an empty cart and a disabled checkout button', async () => {
    renderPOS();
    await screen.findByText('Apple');
    expect(screen.getByText('السلة فارغة')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /دفع وإصدار الفاتورة/ })).toBeDisabled();
  });

  it('disables an out-of-stock product', async () => {
    renderPOS();
    const orangeButton = await screen.findByRole('button', { name: /Orange/ });
    expect(orangeButton).toBeDisabled();
  });

  it('adds a product to the cart and shows it in the sidebar with the right total', async () => {
    renderPOS();
    const appleButton = await screen.findByRole('button', { name: /Apple/ });
    fireEvent.click(appleButton);

    expect(await screen.findByText('10 ج.م')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /دفع وإصدار الفاتورة/ })).not.toBeDisabled();
  });

  it('increments quantity and updates the line + cart total when clicking the same product again', async () => {
    renderPOS();
    const appleButton = await screen.findByRole('button', { name: /Apple/ });
    fireEvent.click(appleButton);
    fireEvent.click(appleButton);

    // Only one cart line for Apple, quantity 2, total 20
    await waitFor(() => {
      expect(screen.getByText('20 ج.م')).toBeInTheDocument();
    });
  });

  it('increments and decrements quantity via the +/- controls in the cart', async () => {
    renderPOS();
    const appleButton = await screen.findByRole('button', { name: /Apple/ });
    fireEvent.click(appleButton);
    await screen.findByText('10 ج.م');

    const plusButtons = screen.getAllByRole('button').filter(b => b.querySelector('svg.lucide-plus'));
    fireEvent.click(plusButtons[0]);
    await waitFor(() => expect(screen.getByText('20 ج.م')).toBeInTheDocument());

    const minusButtons = screen.getAllByRole('button').filter(b => b.querySelector('svg.lucide-minus'));
    fireEvent.click(minusButtons[0]);
    await waitFor(() => expect(screen.getByText('10 ج.م')).toBeInTheDocument());
  });

  it('removes an item from the cart and returns to the empty state', async () => {
    renderPOS();
    const appleButton = await screen.findByRole('button', { name: /Apple/ });
    fireEvent.click(appleButton);
    await screen.findByText('10 ج.م');

    const trashButtons = screen.getAllByRole('button').filter(b => b.querySelector('svg.lucide-trash-2'));
    // The last trash icon in the DOM belongs to the cart line item (the header ones come first).
    fireEvent.click(trashButtons[trashButtons.length - 1]);

    await waitFor(() => expect(screen.getByText('السلة فارغة')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /دفع وإصدار الفاتورة/ })).toBeDisabled();
  });

  it('adds a weighted item to the cart from a scale barcode', async () => {
    renderPOS();
    await screen.findByText('Apple');
    const searchInput = screen.getByPlaceholderText(/ابحث عن منتج/);

    // "2" + "1" + itemCode "00003" + weight "01500" (1.5kg) + checksum "9" = 13 chars
    fireEvent.change(searchInput, { target: { value: '2100003015009' } });

    await waitFor(() => expect(screen.getByText('15 ج.م')).toBeInTheDocument());
  });
});
