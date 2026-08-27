import React, { useRef, useState, useEffect } from 'react';
import { fetchApi } from '../lib/api';
import { Database, Download, Upload, AlertTriangle, Send, Bell, MessageCircle, LogOut, Loader2 } from 'lucide-react';
import { toast } from '../store/useToast';

type WhatsAppState = { status: string; qr: string | null; number: string | null; error: string | null };

export default function Settings() {
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [config, setConfig] = useState({
    telegram_bot_token: '',
    telegram_chat_id: '',
    whatsapp_number: '',
    report_daily: '0',
    report_weekly: '0',
    report_monthly: '0'
  });

  const [wa, setWa] = useState<WhatsAppState>({ status: 'idle', qr: null, number: null, error: null });

  useEffect(() => {
    fetchApi('/api/settings').then(r=>r.json()).then(data => {
      setConfig({
        telegram_bot_token: data.telegram_bot_token || '',
        telegram_chat_id: data.telegram_chat_id || '',
        whatsapp_number: data.whatsapp_number || '',
        report_daily: data.report_daily || '0',
        report_weekly: data.report_weekly || '0',
        report_monthly: data.report_monthly || '0'
      });
    });
  }, []);

  const fetchWaStatus = () => {
    fetchApi('/api/whatsapp/status').then(r => r.ok ? r.json() : null).then(data => data && setWa(data));
  };

  useEffect(() => {
    fetchWaStatus();
    const interval = setInterval(fetchWaStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const connectWhatsApp = async () => {
    if (!config.whatsapp_number) {
      toast.error('أدخل رقم الواتساب أولاً واحفظ الإعدادات');
      return;
    }
    const res = await fetchApi('/api/whatsapp/connect', { method: 'POST' });
    if (!res.ok) {
      toast.error('فشل بدء الربط');
      return;
    }
    fetchWaStatus();
  };

  const disconnectWhatsApp = async () => {
    if (!confirm('هل تريد فصل رقم الواتساب المرتبط؟')) return;
    const res = await fetchApi('/api/whatsapp/logout', { method: 'POST' });
    if (!res.ok) {
      toast.error('فشل قطع الاتصال');
      return;
    }
    toast.success('تم فصل الواتساب');
    fetchWaStatus();
  };

  const testWhatsApp = async () => {
    const res = await fetchApi('/api/whatsapp/test', { method: 'POST' });
    if (res.ok) toast.success('تم إرسال رسالة تجريبية بنجاح!');
    else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error || 'فشل الإرسال');
    }
  };

  const saveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetchApi('/api/settings', {
      method: 'POST',
      body: JSON.stringify(config)
    });
    if (!res.ok) {
      toast.error('فشل حفظ الإعدادات');
      return;
    }
    toast.success('تم حفظ الإعدادات بنجاح');
  };

  const testTelegram = async () => {
    if(!config.telegram_bot_token || !config.telegram_chat_id) {
       toast.error('يرجى حفظ التوكن ومعرف المحادثة أولاً');
       return;
    }
    const res = await fetchApi('/api/reports/test-telegram', { method: 'POST' });
    if(res.ok) toast.success('تم إرسال رسالة تجريبية بنجاح!');
    else toast.error('فشل الإرسال، تأكد من التوكن والمعرف');
  };

  const handleBackup = async () => {
    try {
      const res = await fetchApi('/api/backup/download');
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_${new Date().toISOString().split('T')[0]}.sqlite`;
        a.click();
      } else {
        toast.error('حدث خطأ أثناء النسخ الاحتياطي');
      }
    } catch (e) {
      toast.error('حدث خطأ أثناء النسخ الاحتياطي');
    }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('تحذير: استعادة النسخة الاحتياطية ستمسح جميع البيانات الحالية بشكل لا يمكن التراجع عنه. هل أنت متأكد؟')) {
       e.target.value = '';
       return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('db', file);

    try {
      const res = await fetchApi('/api/backup/restore', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        toast.error(data.error || 'حدث خطأ');
      }
    } catch (e) {
      toast.error('حدث خطأ أثناء الاستعادة');
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-neutral-800">الإعدادات</h1>
        <p className="text-neutral-500 mt-2">إدارة النظام وقواعد البيانات.</p>
      </header>

      <section className="bg-white p-8 rounded-2xl shadow-sm border border-neutral-100">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold">التقارير التلقائية (Telegram / واتساب)</h2>
            <p className="text-neutral-500 text-sm">إعداد إرسال التقارير تلقائياً عبر تليجرام أو واتساب.</p>
          </div>
        </div>

        <form onSubmit={saveConfig} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Telegram Bot Token</label>
              <input
                type="text"
                dir="ltr"
                value={config.telegram_bot_token}
                onChange={e => setConfig({...config, telegram_bot_token: e.target.value})}
                className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Chat ID</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  dir="ltr"
                  value={config.telegram_chat_id}
                  onChange={e => setConfig({...config, telegram_chat_id: e.target.value})}
                  className="flex-1 px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                />
                <button type="button" onClick={testTelegram} className="bg-neutral-100 hover:bg-neutral-200 text-neutral-700 px-4 rounded-xl flex items-center justify-center transition-colors">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">رقم الواتساب (بالمفتاح الدولي، بدون + أو 00)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  dir="ltr"
                  placeholder="201234567890"
                  value={config.whatsapp_number}
                  onChange={e => setConfig({...config, whatsapp_number: e.target.value})}
                  className="flex-1 px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                />
                <button type="button" onClick={testWhatsApp} disabled={wa.status !== 'ready'} className="bg-neutral-100 hover:bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed text-neutral-700 px-4 rounded-xl flex items-center justify-center transition-colors">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="border-t border-neutral-100 pt-6">
             <h3 className="font-bold mb-4">جدولة التقارير</h3>
             <div className="flex gap-6">
               <label className="flex items-center gap-2 cursor-pointer">
                 <input type="checkbox" checked={config.report_daily === '1'} onChange={e => setConfig({...config, report_daily: e.target.checked ? '1' : '0'})} className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500" />
                 <span>تقرير يومي</span>
               </label>
               <label className="flex items-center gap-2 cursor-pointer">
                 <input type="checkbox" checked={config.report_weekly === '1'} onChange={e => setConfig({...config, report_weekly: e.target.checked ? '1' : '0'})} className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500" />
                 <span>تقرير أسبوعي</span>
               </label>
               <label className="flex items-center gap-2 cursor-pointer">
                 <input type="checkbox" checked={config.report_monthly === '1'} onChange={e => setConfig({...config, report_monthly: e.target.checked ? '1' : '0'})} className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500" />
                 <span>تقرير شهري</span>
               </label>
             </div>
          </div>

          <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl transition-colors">
            حفظ الإعدادات
          </button>
        </form>
      </section>

      <section className="bg-white p-8 rounded-2xl shadow-sm border border-neutral-100">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center">
            <MessageCircle className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold">ربط الواتساب</h2>
            <p className="text-neutral-500 text-sm">اربط رقم واتساب عادي بمسح كود QR لإرسال التقارير عليه.</p>
          </div>
          <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${
            wa.status === 'ready' ? 'bg-green-100 text-green-700' :
            wa.status === 'qr' ? 'bg-amber-100 text-amber-700' :
            wa.status === 'initializing' || wa.status === 'authenticated' ? 'bg-blue-100 text-blue-700' :
            'bg-neutral-100 text-neutral-500'
          }`}>
            {wa.status === 'ready' ? 'متصل' :
             wa.status === 'qr' ? 'امسح الكود' :
             wa.status === 'initializing' ? 'جاري الاتصال...' :
             wa.status === 'authenticated' ? 'تم التحقق...' :
             wa.status === 'auth_failure' ? 'فشل الاتصال' :
             'غير متصل'}
          </span>
        </div>

        {wa.status === 'ready' ? (
          <div className="flex items-center justify-between bg-green-50 border border-green-100 rounded-xl p-4">
            <div className="flex items-center gap-3 text-green-800">
              <MessageCircle className="w-5 h-5" />
              <span className="font-medium">متصل برقم: {wa.number || '—'}</span>
            </div>
            <button onClick={disconnectWhatsApp} className="flex items-center gap-2 text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg font-medium transition-colors">
              <LogOut className="w-4 h-4" />
              فصل الاتصال
            </button>
          </div>
        ) : wa.status === 'qr' && wa.qr ? (
          <div className="flex flex-col items-center gap-3 p-6 bg-neutral-50 rounded-xl border border-neutral-100">
            <img src={wa.qr} alt="WhatsApp QR" className="w-56 h-56 rounded-lg border" />
            <p className="text-sm text-neutral-500">افتح واتساب على موبايلك ← الأجهزة المرتبطة ← ربط جهاز، وامسح الكود.</p>
          </div>
        ) : wa.status === 'initializing' || wa.status === 'authenticated' ? (
          <div className="flex items-center justify-center gap-3 p-8 text-neutral-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            جاري تجهيز الاتصال...
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 p-6 bg-neutral-50 rounded-xl border border-neutral-100">
            {wa.error && <p className="text-sm text-red-600">{wa.error}</p>}
            <button onClick={connectWhatsApp} className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-colors">
              <MessageCircle className="w-5 h-5" />
              ربط واتساب
            </button>
          </div>
        )}
      </section>

      <section className="bg-white p-8 rounded-2xl shadow-sm border border-neutral-100">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold">النسخ الاحتياطي (Backup)</h2>
            <p className="text-neutral-500 text-sm">حفظ واستعادة بيانات البرنامج بالكامل.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border border-neutral-100 rounded-xl p-6 flex flex-col items-center justify-center text-center space-y-4 hover:border-blue-200 transition-colors">
            <Download className="w-10 h-10 text-blue-500" />
            <div>
              <h3 className="font-bold mb-1">نسخ احتياطي الآن</h3>
              <p className="text-sm text-neutral-500">تحميل نسخة من قاعدة البيانات إلى جهازك.</p>
            </div>
            <button onClick={handleBackup} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors w-full">
              تحميل النسخة
            </button>
          </div>

          <div className="border border-neutral-100 rounded-xl p-6 flex flex-col items-center justify-center text-center space-y-4 hover:border-red-200 transition-colors">
            <Upload className="w-10 h-10 text-red-500" />
            <div>
              <h3 className="font-bold mb-1">استعادة نسخة احتياطية</h3>
              <p className="text-sm text-neutral-500">استعادة النظام من ملف تم حفظه مسبقاً.</p>
            </div>
            <input 
              type="file" 
              accept=".sqlite" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleRestore} 
            />
            <button 
              onClick={() => fileInputRef.current?.click()} 
              disabled={loading}
              className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-6 py-2 rounded-lg font-medium transition-colors w-full flex justify-center items-center gap-2"
            >
              <AlertTriangle className="w-4 h-4" />
              {loading ? 'جاري الاستعادة...' : 'رفع واستعادة'}
            </button>
          </div>
        </div>
        
        <div className="mt-8 bg-neutral-50 p-4 rounded-lg flex gap-3 text-sm text-neutral-600">
           <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0" />
           <p><strong>ملاحظة هامة:</strong> عملية الاستعادة ستقوم بإيقاف النظام لحظياً وتبديل قاعدة البيانات، ثم إعادة التشغيل. تأكد من عدم وجود موظفين يعملون على النظام أثناء الاستعادة.</p>
        </div>
      </section>
    </div>
  );
}
