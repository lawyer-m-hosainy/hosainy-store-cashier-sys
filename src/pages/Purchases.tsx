import { fetchApi } from '../lib/api';
import React, { useEffect, useState } from 'react';
import { Plus, Search } from 'lucide-react';

export default function Purchases() {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  
  const [form, setForm] = useState({ supplier_id: '', date: new Date().toISOString().split('T')[0], invoice_number: '', payment_status: 'paid', notes: '', initial_payment: 0 });
  const [items, setItems] = useState<any[]>([]);
  
  // product selection
  const [selProduct, setSelProduct] = useState('');
  const [selQty, setSelQty] = useState(1);
  const [selCost, setSelCost] = useState(0);

  const fetchData = () => {
    fetchApi('/api/purchases').then(res => res.json()).then(setPurchases);
    fetchApi('/api/suppliers').then(res => res.json()).then(setSuppliers);
    fetchApi('/api/products').then(res => res.json()).then(setProducts);
  };

  useEffect(() => { fetchData(); }, []);

  const handleAddItem = () => {
    if(!selProduct) return;
    const prod = products.find(p => p.id == selProduct);
    if(prod) {
      setItems([...items, { product_id: prod.id, name: prod.name, qty: selQty, unit_cost: selCost, line_total: selQty * selCost }]);
      setSelProduct('');
      setSelQty(1);
      setSelCost(0);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const total = items.reduce((sum, item) => sum + item.line_total, 0);
    await fetchApi('/api/purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, total, items })
    });
    setIsAdding(false);
    fetchData();
    setForm({ supplier_id: '', date: new Date().toISOString().split('T')[0], invoice_number: '', payment_status: 'paid', notes: '', initial_payment: 0 });
    setItems([]);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-800">المشتريات</h1>
          <p className="text-neutral-500 mt-2">تسجيل فواتير الشراء وتحديث المخزون.</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-colors"
        >
          <Plus className="w-5 h-5" />
          فاتورة شراء جديدة
        </button>
      </header>

      {isAdding && (
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-6 space-y-6">
          <h2 className="text-xl font-bold">تسجيل فاتورة شراء</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">المورد</label>
              <select required value={form.supplier_id} onChange={e => setForm({...form, supplier_id: e.target.value})} className="w-full p-2 border rounded-lg">
                <option value="">اختر المورد...</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">تاريخ الفاتورة</label>
              <input type="date" required value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="w-full p-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">رقم الفاتورة (للمورد)</label>
              <input value={form.invoice_number} onChange={e => setForm({...form, invoice_number: e.target.value})} className="w-full p-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">حالة السداد</label>
              <select required value={form.payment_status} onChange={e => setForm({...form, payment_status: e.target.value})} className="w-full p-2 border rounded-lg">
                <option value="paid">مدفوع بالكامل</option>
                <option value="partial">دفع جزئي</option>
                <option value="unpaid">آجل (غير مدفوع)</option>
              </select>
            </div>
          </div>
          
          {form.payment_status === 'partial' && (
             <div>
              <label className="block text-sm font-medium mb-1 text-blue-600">الدفعة المدفوعة حالياً (ج.م)</label>
              <input type="number" required value={form.initial_payment} onChange={e => setForm({...form, initial_payment: +e.target.value})} className="w-full max-w-xs p-2 border rounded-lg" />
            </div>
          )}

          <div className="border-t pt-4">
            <h3 className="font-semibold mb-2">إضافة أصناف للفاتورة</h3>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-xs text-neutral-500 mb-1">المنتج</label>
                <select 
                  value={selProduct} 
                  onChange={e => {
                    setSelProduct(e.target.value);
                    const p = products.find(prod => prod.id == e.target.value);
                    if (p) setSelCost(p.cost_price);
                  }} 
                  className="w-full p-2 border rounded-lg"
                >
                  <option value="">اختر...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="w-24">
                <label className="block text-xs text-neutral-500 mb-1">الكمية</label>
                <input type="number" min="1" value={selQty} onChange={e => setSelQty(+e.target.value)} className="w-full p-2 border rounded-lg" />
              </div>
              <div className="w-32">
                <label className="block text-xs text-neutral-500 mb-1">تكلفة الوحدة</label>
                <input type="number" step="0.01" value={selCost} onChange={e => setSelCost(+e.target.value)} className="w-full p-2 border rounded-lg" />
              </div>
              <button type="button" onClick={handleAddItem} className="bg-neutral-800 text-white px-4 py-2 rounded-lg">إضافة</button>
            </div>
          </div>

          {items.length > 0 && (
            <div className="mt-4 border rounded-xl overflow-hidden">
               <table className="w-full text-right text-sm">
                 <thead className="bg-neutral-50">
                   <tr>
                     <th className="p-3">المنتج</th>
                     <th className="p-3">الكمية</th>
                     <th className="p-3">التكلفة</th>
                     <th className="p-3">الإجمالي</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y">
                   {items.map((it, idx) => (
                     <tr key={idx}>
                       <td className="p-3">{it.name}</td>
                       <td className="p-3">{it.qty}</td>
                       <td className="p-3">{it.unit_cost}</td>
                       <td className="p-3 font-semibold">{it.line_total} ج.م</td>
                     </tr>
                   ))}
                 </tbody>
                 <tfoot className="bg-neutral-50 font-bold">
                   <tr>
                     <td colSpan={3} className="p-3">إجمالي الفاتورة:</td>
                     <td className="p-3">{items.reduce((s, i) => s + i.line_total, 0)} ج.م</td>
                   </tr>
                 </tfoot>
               </table>
            </div>
          )}

          <div className="flex justify-end gap-3 mt-4 pt-4 border-t">
            <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 text-neutral-600 hover:bg-neutral-100 rounded-lg">إلغاء</button>
            <button type="button" onClick={handleSubmit} disabled={items.length === 0} className="px-6 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">حفظ واعتماد الفاتورة</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
        <table className="w-full text-right">
          <thead className="bg-neutral-50 text-neutral-500 font-medium text-sm border-b border-neutral-100">
            <tr>
              <th className="py-4 px-6">التاريخ</th>
              <th className="py-4 px-6">المورد</th>
              <th className="py-4 px-6">الإجمالي</th>
              <th className="py-4 px-6">السداد</th>
              <th className="py-4 px-6">رقم الفاتورة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {purchases.map(p => (
              <tr key={p.id} className="hover:bg-neutral-50/50 transition-colors">
                <td className="py-4 px-6 font-mono text-sm">{p.date}</td>
                <td className="py-4 px-6 font-medium text-neutral-800">{p.supplier_name}</td>
                <td className="py-4 px-6 font-bold">{p.total} ج.م</td>
                <td className="py-4 px-6">
                  <span className={`text-xs px-2 py-1 rounded-md ${p.payment_status === 'paid' ? 'bg-green-100 text-green-700' : p.payment_status === 'partial' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                    {p.payment_status === 'paid' ? 'مدفوع' : p.payment_status === 'partial' ? 'جزئي' : 'آجل'}
                  </span>
                </td>
                <td className="py-4 px-6 text-neutral-500 font-mono">{p.invoice_number || '-'}</td>
              </tr>
            ))}
            {purchases.length === 0 && (
              <tr>
                <td colSpan={5} className="py-12 text-center text-neutral-500">لا توجد فواتير شراء.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
