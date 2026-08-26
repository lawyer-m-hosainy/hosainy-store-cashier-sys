import { fetchApi } from '../lib/api';
import { useState } from 'react';
import { useStore } from '../store/useStore';
import { Wallet, CheckCircle, AlertTriangle } from 'lucide-react';

export default function CashSession() {
  const { activeCashSession, fetchActiveSession } = useStore();
  const [openingBalance, setOpeningBalance] = useState(0);
  const [closingActual, setClosingActual] = useState(0);
  const [result, setResult] = useState<any>(null);

  const handleOpen = async () => {
    const res = await fetchApi('/api/cash-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: new Date().toISOString().split('T')[0],
        opening_balance: openingBalance,
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'فشل فتح الوردية');
      fetchActiveSession();
      return;
    }
    fetchActiveSession();
  };

  const handleClose = async () => {
    const res = await fetchApi(`/api/cash-sessions/${activeCashSession.id}/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        closing_balance_actual: closingActual,
      })
    });
    const data = await res.json();
    setResult(data);
    fetchActiveSession();
  };

  if (!activeCashSession) {
    return (
      <div className="p-8 max-w-2xl mx-auto mt-12">
        <div className="bg-white p-10 rounded-3xl shadow-sm border border-neutral-100 text-center">
          <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Wallet className="w-10 h-10 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-neutral-800">فتح وردية جديدة</h1>
          <p className="text-neutral-500 mt-3 text-lg">أدخل الرصيد الافتتاحي (الفكة/العهدة) الموجودة في الدرج الآن.</p>
          
          <div className="mt-8 max-w-xs mx-auto">
            <div className="relative">
              <input 
                type="number" 
                value={openingBalance}
                onChange={e => setOpeningBalance(+e.target.value)}
                className="w-full text-center text-4xl font-bold p-4 border-2 border-neutral-200 rounded-2xl focus:outline-none focus:border-blue-500"
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 font-medium">ج.م</span>
            </div>
            <button 
              onClick={handleOpen}
              className="w-full mt-6 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition-colors text-lg"
            >
              فتح الخزينة وبدء العمل
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl mx-auto mt-12">
      <div className="bg-white p-10 rounded-3xl shadow-sm border border-neutral-100 text-center relative overflow-hidden">
        {result && (
          <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-8">
            <CheckCircle className="w-20 h-20 text-green-500 mb-6" />
            <h2 className="text-3xl font-bold text-neutral-800">تم تقفيل الخزينة بنجاح!</h2>
            <div className="mt-8 w-full max-w-sm space-y-4 text-right">
              <div className="flex justify-between p-4 bg-neutral-50 rounded-xl">
                <span className="text-neutral-500 font-medium">الرصيد المتوقع (حسب النظام)</span>
                <span className="font-bold text-neutral-800">{result.expected} ج.م</span>
              </div>
              <div className="flex justify-between p-4 bg-neutral-50 rounded-xl">
                <span className="text-neutral-500 font-medium">الرصيد الفعلي (المُدخل)</span>
                <span className="font-bold text-neutral-800">{closingActual} ج.م</span>
              </div>
              <div className={`flex justify-between p-4 rounded-xl ${result.difference === 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                <span className="font-bold">الفرق (العجز/الزيادة)</span>
                <span className="font-bold">{result.difference} ج.م</span>
              </div>
            </div>
            <button onClick={() => setResult(null)} className="mt-8 px-8 py-3 border-2 border-neutral-200 rounded-xl font-bold text-neutral-600 hover:bg-neutral-50">عودة</button>
          </div>
        )}

        <div className="w-20 h-20 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Wallet className="w-10 h-10 text-green-600" />
        </div>
        <h1 className="text-3xl font-bold text-neutral-800">تقفيل الوردية الحالية</h1>
        <p className="text-neutral-500 mt-3 text-lg">قم بعدّ النقدية الموجودة في الدرج وأدخل المبلغ الفعلي للمطابقة.</p>
        
        <div className="mt-8 max-w-xs mx-auto text-right">
          <div className="bg-neutral-50 p-4 rounded-xl mb-6">
            <span className="block text-sm text-neutral-500 font-medium mb-1">الرصيد الافتتاحي اليوم:</span>
            <span className="block text-xl font-bold text-neutral-800">{activeCashSession.opening_balance} ج.م</span>
          </div>

          <label className="block text-sm font-bold text-neutral-700 mb-2">النقدية الفعلية بالدرج الآن:</label>
          <div className="relative">
            <input 
              type="number" 
              value={closingActual}
              onChange={e => setClosingActual(+e.target.value)}
              className="w-full text-center text-4xl font-bold p-4 border-2 border-neutral-200 rounded-2xl focus:outline-none focus:border-blue-500"
            />
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 font-medium">ج.م</span>
          </div>
          <button 
            onClick={handleClose}
            className="w-full mt-6 py-4 bg-neutral-900 hover:bg-black text-white font-bold rounded-2xl transition-colors text-lg flex items-center justify-center gap-2"
          >
            <AlertTriangle className="w-5 h-5 opacity-70" />
            تقفيل الخزينة
          </button>
        </div>
      </div>
    </div>
  );
}
