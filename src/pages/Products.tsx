import { fetchApi } from '../lib/api';
import React, { useEffect, useState, useRef } from 'react';
import { Plus, Search, AlertCircle, Edit, Printer, Clock, RefreshCw } from 'lucide-react';
import Barcode from 'react-barcode';

export default function Products() {
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [printProduct, setPrintProduct] = useState<any>(null);
  const [form, setForm] = useState({ sku: '', name: '', cost_price: 0, sell_price: 0, current_stock: 0, reorder_level: 5, has_expiry: false, expiry_date: '' });

  // Auto-generate EAN-13 barcode
  const generateBarcode = () => {
    // Prefix "200" for internal use + 9 random digits + 1 check digit
    const prefix = '200';
    const random = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join('');
    const partial = prefix + random;
    // Calculate EAN-13 check digit
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(partial[i]) * (i % 2 === 0 ? 1 : 3);
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return partial + checkDigit;
  };

  const fetchProducts = () => {
    fetchApi(`/api/products?search=${search}`)
      .then(res => res.json())
      .then(data => setProducts(data));
  };

  useEffect(() => {
    fetchProducts();
  }, [search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetchApi('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    setIsAdding(false);
    fetchProducts();
    setForm({ sku: '', name: '', cost_price: 0, sell_price: 0, current_stock: 0, reorder_level: 5, has_expiry: false, expiry_date: '' });
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-800">المنتجات والمخزون</h1>
          <p className="text-neutral-500 mt-2">إدارة الأصناف والكميات المتوفرة.</p>
        </div>
        <button 
          onClick={() => { setForm(f => ({ ...f, sku: generateBarcode() })); setIsAdding(true); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-colors"
        >
          <Plus className="w-5 h-5" />
          إضافة منتج جديد
        </button>
      </header>

      {/* Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-barcode, #printable-barcode * {
            visibility: visible;
          }
          #printable-barcode {
            position: absolute;
            left: 0;
            top: 0;
            margin: 0;
            padding: 0;
            width: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
          }
        }
      `}</style>

      {/* Barcode Print Modal */}
      {printProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-xl max-w-sm w-full shadow-2xl">
            <div id="printable-barcode" className="text-center bg-white p-4">
              <h3 className="font-bold text-lg mb-1">{printProduct.name}</h3>
              <p className="text-neutral-700 font-semibold mb-2">{printProduct.sell_price} ج.م</p>
              <div className="flex justify-center">
                <Barcode value={printProduct.sku} width={2} height={50} fontSize={14} background="#ffffff" />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setPrintProduct(null)} className="px-4 py-2 text-neutral-600 hover:bg-neutral-100 rounded-lg">إغلاق</button>
              <button onClick={() => window.print()} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2">
                <Printer className="w-4 h-4" />
                طباعة الملصق
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
        <div className="p-4 border-b border-neutral-100 flex items-center gap-4 bg-neutral-50/50">
          <div className="relative flex-1 max-w-md">
            <Search className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input 
              type="text"
              placeholder="ابحث بالاسم أو الباركود (SKU)..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
        </div>

        {isAdding && (
          <form onSubmit={handleSubmit} className="p-6 border-b border-neutral-100 bg-blue-50/30 grid grid-cols-2 md:grid-cols-6 gap-4 items-end">
            <div className="col-span-2 md:col-span-2">
              <label className="block text-sm font-medium mb-1">الباركود (SKU)</label>
              <div className="flex gap-2">
                <input required value={form.sku} onChange={e => setForm({...form, sku: e.target.value})} className="flex-1 p-2 border rounded-lg font-mono text-sm" dir="ltr" />
                <button type="button" onClick={() => setForm(f => ({...f, sku: generateBarcode()}))} className="p-2 bg-neutral-100 hover:bg-neutral-200 rounded-lg text-neutral-600" title="توليد باركود جديد">
                  <RefreshCw className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="col-span-2 md:col-span-2">
              <label className="block text-sm font-medium mb-1">الاسم</label>
              <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full p-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">التكلفة</label>
              <input required type="number" step="0.01" value={form.cost_price} onChange={e => setForm({...form, cost_price: +e.target.value})} className="w-full p-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">سعر البيع</label>
              <input required type="number" step="0.01" value={form.sell_price} onChange={e => setForm({...form, sell_price: +e.target.value})} className="w-full p-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">الرصيد</label>
              <input required type="number" value={form.current_stock} onChange={e => setForm({...form, current_stock: +e.target.value})} className="w-full p-2 border rounded-lg" />
            </div>
            <div className="col-span-2 md:col-span-3">
              <label className="flex items-center gap-2 text-sm font-medium mb-1">
                <input type="checkbox" checked={form.has_expiry} onChange={e => setForm({...form, has_expiry: e.target.checked})} className="rounded" />
                له تاريخ صلاحية
              </label>
              {form.has_expiry && (
                <input type="date" value={form.expiry_date} onChange={e => setForm({...form, expiry_date: e.target.value})} className="w-full p-2 border rounded-lg mt-1" />
              )}
            </div>
            <div className="col-span-2 md:col-span-6 flex justify-end gap-3 mt-4">
              <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 text-neutral-600 hover:bg-neutral-100 rounded-lg">إلغاء</button>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg">حفظ المنتج</button>
            </div>
          </form>
        )}

        <table className="w-full text-right">
          <thead className="bg-neutral-50 text-neutral-500 font-medium text-sm border-b border-neutral-100">
            <tr>
              <th className="py-4 px-6">SKU</th>
              <th className="py-4 px-6">المنتج</th>
              <th className="py-4 px-6">سعر التكلفة</th>
              <th className="py-4 px-6">سعر البيع</th>
              <th className="py-4 px-6">الكمية</th>
              <th className="py-4 px-6">الصلاحية</th>
              <th className="py-4 px-6">الحالة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {products.map(product => {
              const isLow = product.current_stock <= product.reorder_level;
              const isExpiringSoon = product.has_expiry && product.expiry_date && (() => {
                const daysLeft = Math.ceil((new Date(product.expiry_date).getTime() - Date.now()) / (1000*60*60*24));
                return daysLeft <= 30;
              })();
              const isExpired = product.has_expiry && product.expiry_date && new Date(product.expiry_date) < new Date();
              return (
                <tr key={product.id} className={`hover:bg-neutral-50/50 transition-colors ${isExpired ? 'bg-red-50/50' : ''}`}>
                  <td className="py-4 px-6 font-mono text-sm text-neutral-500">{product.sku}</td>
                  <td className="py-4 px-6 font-medium text-neutral-800">{product.name}</td>
                  <td className="py-4 px-6 text-neutral-600">{product.cost_price} ج.م</td>
                  <td className="py-4 px-6 text-blue-600 font-semibold">{product.sell_price} ج.م</td>
                  <td className="py-4 px-6">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium ${isLow ? 'bg-red-50 text-red-700' : 'bg-neutral-100 text-neutral-700'}`}>
                      {product.current_stock}
                      {isLow && <AlertCircle className="w-4 h-4" />}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    {product.has_expiry && product.expiry_date ? (
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${
                        isExpired ? 'bg-red-100 text-red-700' : isExpiringSoon ? 'bg-amber-100 text-amber-700' : 'bg-green-50 text-green-700'
                      }`}>
                        <Clock className="w-3.5 h-3.5" />
                        {isExpired ? 'منتهي' : product.expiry_date}
                      </span>
                    ) : (
                      <span className="text-neutral-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setPrintProduct(product)} className="p-1.5 text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 rounded-md transition-colors" title="طباعة الباركود">
                        <Printer className="w-5 h-5" />
                      </button>
                      <button className="p-1.5 text-neutral-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="تعديل">
                        <Edit className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {products.length === 0 && (
              <tr>
                <td colSpan={7} className="py-12 text-center text-neutral-500">لا توجد منتجات.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
