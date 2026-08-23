import { fetchApi } from '../lib/api';
import React, { useEffect, useState } from 'react';
import { Plus, Search, Star } from 'lucide-react';

export default function Customers() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', address: '', source: 'instore', notes: '' });

  const fetchCustomers = () => {
    fetchApi(`/api/customers?search=${search}`)
      .then(res => res.json())
      .then(setCustomers);
  };

  useEffect(() => {
    fetchCustomers();
  }, [search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetchApi('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    setIsAdding(false);
    fetchCustomers();
    setForm({ name: '', phone: '', address: '', source: 'instore', notes: '' });
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-800">العملاء</h1>
          <p className="text-neutral-500 mt-2">إدارة قاعدة بيانات العملاء (داخلي وأونلاين).</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-colors"
        >
          <Plus className="w-5 h-5" />
          إضافة عميل
        </button>
      </header>

      <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
        <div className="p-4 border-b border-neutral-100 flex items-center gap-4 bg-neutral-50/50">
          <div className="relative flex-1 max-w-md">
            <Search className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input 
              type="text"
              placeholder="ابحث بالاسم أو التليفون..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
        </div>

        {isAdding && (
          <form onSubmit={handleSubmit} className="p-6 border-b border-neutral-100 bg-blue-50/30 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">الاسم</label>
              <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full p-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">التليفون</label>
              <input required value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full p-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">العنوان</label>
              <input value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="w-full p-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">المصدر</label>
              <select value={form.source} onChange={e => setForm({...form, source: e.target.value})} className="w-full p-2 border rounded-lg">
                <option value="instore">محلي (المكتبة)</option>
                <option value="online">أونلاين (المتجر)</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">ملاحظات</label>
              <input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="w-full p-2 border rounded-lg" />
            </div>
            <div className="col-span-2 flex justify-end gap-3 mt-2">
              <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 text-neutral-600 hover:bg-neutral-100 rounded-lg">إلغاء</button>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg">حفظ العميل</button>
            </div>
          </form>
        )}

        <table className="w-full text-right">
          <thead className="bg-neutral-50 text-neutral-500 font-medium text-sm border-b border-neutral-100">
            <tr>
              <th className="py-4 px-6">الاسم</th>
              <th className="py-4 px-6">التليفون</th>
              <th className="py-4 px-6">العنوان</th>
              <th className="py-4 px-6">المصدر</th>
              <th className="py-4 px-6">نقاط الولاء</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {customers.map(c => (
              <tr key={c.id} className="hover:bg-neutral-50/50 transition-colors">
                <td className="py-4 px-6 font-medium text-neutral-800">{c.name}</td>
                <td className="py-4 px-6 text-neutral-600 font-mono">{c.phone}</td>
                <td className="py-4 px-6 text-neutral-500">{c.address || '-'}</td>
                <td className="py-4 px-6">
                  <span className={`text-xs px-2 py-1 rounded-md ${c.source === 'online' ? 'bg-purple-100 text-purple-700' : 'bg-neutral-100 text-neutral-700'}`}>
                    {c.source === 'online' ? 'أونلاين' : 'محلي'}
                  </span>
                </td>
                <td className="py-4 px-6">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                    (c.points || 0) >= 100 ? 'bg-amber-100 text-amber-700' : (c.points || 0) > 0 ? 'bg-blue-50 text-blue-600' : 'bg-neutral-100 text-neutral-400'
                  }`}>
                    <Star className="w-3.5 h-3.5" />
                    {c.points || 0} نقطة
                  </span>
                </td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={5} className="py-12 text-center text-neutral-500">لا يوجد عملاء.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
