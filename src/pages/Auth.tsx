import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, LogIn, Lock, User } from 'lucide-react';
import { setToken, setUser, fetchApi } from '../lib/api';

export default function Auth() {
  const [isSetup, setIsSetup] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: '', username: '', password: '' });
  
  useEffect(() => {
    fetch('/api/auth/check-setup')
      .then(res => res.json())
      .then(data => {
        setIsSetup(data.needsSetup);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSetup) {
      // Setup Owner
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (res.ok) {
        setIsSetup(false);
        alert('تم إعداد الحساب بنجاح. يرجى تسجيل الدخول.');
      }
    } else {
      // Login
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: form.username, password: form.password })
      });
      if (res.ok) {
        const data = await res.json();
        setToken(data.token);
        setUser(data.user);
        window.location.href = '/';
      } else {
        const err = await res.json();
        alert(err.error || 'خطأ في تسجيل الدخول');
      }
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-neutral-50 text-neutral-500">جاري التحميل...</div>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-neutral-100 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            {isSetup ? <UserPlus className="w-8 h-8" /> : <LogIn className="w-8 h-8" />}
          </div>
          <h1 className="text-2xl font-bold">{isSetup ? 'إعداد النظام لأول مرة' : 'تسجيل الدخول'}</h1>
          <p className="text-neutral-500 mt-2">{isSetup ? 'قم بإنشاء حساب المدير العام للبدء.' : 'مكتبة الحسيني - لوحة التحكم'}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSetup && (
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">الاسم الكامل</label>
              <div className="relative">
                <User className="absolute right-3 top-3 w-5 h-5 text-neutral-400" />
                <input 
                  type="text" 
                  required 
                  value={form.name}
                  onChange={e => setForm({...form, name: e.target.value})}
                  className="w-full pr-10 pl-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="محمد الحسيني"
                />
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">اسم المستخدم</label>
            <div className="relative">
              <User className="absolute right-3 top-3 w-5 h-5 text-neutral-400" />
              <input 
                type="text" 
                required 
                value={form.username}
                onChange={e => setForm({...form, username: e.target.value})}
                className="w-full pr-10 pl-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                dir="ltr"
                placeholder="admin"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">كلمة المرور</label>
            <div className="relative">
              <Lock className="absolute right-3 top-3 w-5 h-5 text-neutral-400" />
              <input 
                type="password" 
                required 
                value={form.password}
                onChange={e => setForm({...form, password: e.target.value})}
                className="w-full pr-10 pl-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                dir="ltr"
                placeholder="••••••••"
              />
            </div>
          </div>
          <button 
            type="submit" 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors mt-6"
          >
            {isSetup ? 'إنشاء حساب المدير' : 'دخول'}
          </button>
        </form>
      </div>
    </div>
  );
}
