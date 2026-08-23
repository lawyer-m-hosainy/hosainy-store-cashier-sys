import React, { useEffect, useState } from 'react';
import { fetchApi } from '../lib/api';
import { Plus, Shield, User, Key, Ban, CheckCircle } from 'lucide-react';

export default function Users() {
  const [users, setUsers] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', username: '', password: '', role: 'employee' });

  const loadUsers = () => {
    fetchApi('/api/auth/users')
      .then(res => res.json())
      .then(setUsers);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetchApi('/api/auth/users', {
      method: 'POST',
      body: JSON.stringify(form)
    });
    if (res.ok) {
      setShowAdd(false);
      setForm({ name: '', username: '', password: '', role: 'employee' });
      loadUsers();
    } else {
      const err = await res.json();
      alert(err.error);
    }
  };

  const toggleStatus = async (id: number, currentStatus: number) => {
    if(!confirm('هل أنت متأكد من تغيير حالة المستخدم؟')) return;
    await fetchApi(`/api/auth/users/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ is_active: currentStatus ? 0 : 1 })
    });
    loadUsers();
  };

  const resetPassword = async (id: number) => {
    const newPass = prompt('أدخل كلمة المرور الجديدة:');
    if (!newPass) return;
    await fetchApi(`/api/auth/users/${id}/password`, {
      method: 'PUT',
      body: JSON.stringify({ password: newPass })
    });
    alert('تم تغيير كلمة المرور بنجاح.');
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-800">إدارة المستخدمين</h1>
          <p className="text-neutral-500 mt-2">إضافة موظفين، وتحديد الصلاحيات.</p>
        </div>
        <button 
          onClick={() => setShowAdd(!showAdd)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors"
        >
          <Plus className="w-5 h-5" />
          إضافة مستخدم
        </button>
      </header>

      {showAdd && (
        <form onSubmit={handleAdd} className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100 flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm text-neutral-500 mb-1">الاسم</label>
            <input required type="text" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} className="w-full p-2 border rounded-lg focus:outline-none focus:border-blue-500" />
          </div>
          <div className="flex-1">
            <label className="block text-sm text-neutral-500 mb-1">اسم المستخدم</label>
            <input required type="text" dir="ltr" value={form.username} onChange={e=>setForm({...form, username:e.target.value})} className="w-full p-2 border rounded-lg focus:outline-none focus:border-blue-500" />
          </div>
          <div className="flex-1">
            <label className="block text-sm text-neutral-500 mb-1">كلمة المرور</label>
            <input required type="password" dir="ltr" value={form.password} onChange={e=>setForm({...form, password:e.target.value})} className="w-full p-2 border rounded-lg focus:outline-none focus:border-blue-500" />
          </div>
          <div className="flex-1">
            <label className="block text-sm text-neutral-500 mb-1">الصلاحية</label>
            <select value={form.role} onChange={e=>setForm({...form, role:e.target.value})} className="w-full p-2 border rounded-lg focus:outline-none focus:border-blue-500">
              <option value="employee">موظف (بيع فقط)</option>
              <option value="owner">مدير عام</option>
            </select>
          </div>
          <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium">حفظ</button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {users.map(u => (
          <div key={u.id} className={`bg-white p-6 rounded-2xl shadow-sm border ${u.is_active ? 'border-neutral-100' : 'border-red-200 opacity-75'}`}>
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${u.role === 'owner' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                  {u.role === 'owner' ? <Shield className="w-6 h-6" /> : <User className="w-6 h-6" />}
                </div>
                <div>
                  <h3 className="font-bold text-lg">{u.name}</h3>
                  <p className="text-sm text-neutral-500 font-mono" dir="ltr">@{u.username}</p>
                </div>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {u.is_active ? 'نشط' : 'معطل'}
              </span>
            </div>
            
            <div className="flex gap-2 mt-6">
              <button onClick={() => resetPassword(u.id)} className="flex-1 bg-neutral-50 hover:bg-neutral-100 text-neutral-700 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors">
                <Key className="w-4 h-4" />
                تغيير المرور
              </button>
              <button 
                onClick={() => toggleStatus(u.id, u.is_active)} 
                className={`flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors ${u.is_active ? 'bg-red-50 hover:bg-red-100 text-red-700' : 'bg-green-50 hover:bg-green-100 text-green-700'}`}
              >
                {u.is_active ? <><Ban className="w-4 h-4" /> تعطيل</> : <><CheckCircle className="w-4 h-4" /> تفعيل</>}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
