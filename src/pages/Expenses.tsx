import { fetchApi } from '../lib/api';
import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';

export default function Expenses() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], category: 'أخرى', amount: '', description: '' });

  const fetchExpenses = () => {
    fetchApi('/api/expenses').then(res => res.json()).then(setExpenses);
  };

  useEffect(() => { fetchExpenses(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetchApi('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    setIsAdding(false);
    fetchExpenses();
    setForm({ date: new Date().toISOString().split('T')[0], category: 'أخرى', amount: '', description: '' });
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-800">المصروفات</h1>
          <p className="text-neutral-500 mt-2">تسجيل ومتابعة مصروفات المكتبة.</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-colors"
        >
          <Plus className="w-5 h-5" />
          إضافة مصروف
        </button>
      </header>

      {isAdding && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-6 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">التاريخ</label>
            <input type="date" required value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="w-full p-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">الفئة</label>
            <select required value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full p-2 border rounded-lg">
              <option value="إيجار">إيجار</option>
              <option value="رواتب">رواتب</option>
              <option value="مرافق">مرافق (كهرباء، مياه، نت)</option>
              <option value="تسويق">تسويق</option>
              <option value="أخرى">أخرى</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">المبلغ</label>
            <input type="number" step="0.01" required value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} className="w-full p-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">الوصف</label>
            <input required value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full p-2 border rounded-lg" />
          </div>
          <div className="col-span-2 flex justify-end gap-3 mt-4">
            <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 text-neutral-600 hover:bg-neutral-100 rounded-lg">إلغاء</button>
            <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg">حفظ المصروف</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
        <table className="w-full text-right">
          <thead className="bg-neutral-50 text-neutral-500 font-medium text-sm border-b border-neutral-100">
            <tr>
              <th className="py-4 px-6">التاريخ</th>
              <th className="py-4 px-6">الفئة</th>
              <th className="py-4 px-6">الوصف</th>
              <th className="py-4 px-6">المبلغ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {expenses.map(exp => (
              <tr key={exp.id} className="hover:bg-neutral-50/50 transition-colors">
                <td className="py-4 px-6 font-mono text-sm">{exp.date}</td>
                <td className="py-4 px-6 font-medium text-neutral-800">
                  <span className="bg-neutral-100 px-2.5 py-1 rounded-md text-sm">{exp.category}</span>
                </td>
                <td className="py-4 px-6 text-neutral-600">{exp.description}</td>
                <td className="py-4 px-6 font-bold text-red-600">{exp.amount} ج.م</td>
              </tr>
            ))}
            {expenses.length === 0 && (
              <tr>
                <td colSpan={4} className="py-12 text-center text-neutral-500">لا توجد مصروفات مسجلة.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
