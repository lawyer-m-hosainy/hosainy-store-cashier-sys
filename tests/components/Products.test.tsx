// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Products from '../../src/pages/Products';

const mockProducts = [
  { id: 1, name: 'Healthy Item', sku: 'H1', cost_price: 5, sell_price: 10, current_stock: 50, reorder_level: 5, has_expiry: false, expiry_date: null },
  { id: 2, name: 'Out Of Stock Item', sku: 'O1', cost_price: 5, sell_price: 10, current_stock: 0, reorder_level: 5, has_expiry: false, expiry_date: null },
  { id: 3, name: 'Low Stock Item', sku: 'L1', cost_price: 5, sell_price: 10, current_stock: 2, reorder_level: 5, has_expiry: false, expiry_date: null },
];

vi.mock('../../src/lib/api', () => ({
  fetchApi: vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(mockProducts) })),
}));

vi.mock('react-barcode', () => ({ default: () => null }));

function renderProducts(initialPath = '/products') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Products />
    </MemoryRouter>
  );
}

describe('Products filter chips', () => {
  it('shows all products by default', async () => {
    renderProducts();
    await screen.findByText('Healthy Item');
    expect(screen.getByText('Out Of Stock Item')).toBeInTheDocument();
    expect(screen.getByText('Low Stock Item')).toBeInTheDocument();
  });

  it('filters to only out-of-stock items when that chip is clicked', async () => {
    renderProducts();
    await screen.findByText('Healthy Item');

    fireEvent.click(screen.getByRole('button', { name: 'نفذ من المخزون' }));

    await waitFor(() => {
      expect(screen.getByText('Out Of Stock Item')).toBeInTheDocument();
      expect(screen.queryByText('Healthy Item')).not.toBeInTheDocument();
      expect(screen.queryByText('Low Stock Item')).not.toBeInTheDocument();
    });
  });

  it('honors an initial ?filter= from the URL (as the notification bell links to)', async () => {
    renderProducts('/products?filter=low_stock');
    await waitFor(() => {
      expect(screen.getByText('Low Stock Item')).toBeInTheDocument();
      expect(screen.queryByText('Healthy Item')).not.toBeInTheDocument();
    });
  });

  it('returns to showing everything when "الكل" is clicked', async () => {
    renderProducts('/products?filter=out_of_stock');
    await screen.findByText('Out Of Stock Item');
    expect(screen.queryByText('Healthy Item')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'الكل' }));

    await waitFor(() => {
      expect(screen.getByText('Healthy Item')).toBeInTheDocument();
    });
  });
});
