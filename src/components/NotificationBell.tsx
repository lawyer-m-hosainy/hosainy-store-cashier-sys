import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, PackageX, AlertTriangle, Clock, XCircle } from 'lucide-react';
import { fetchApi } from '../lib/api';

type AlertsData = {
  outOfStock: any[];
  lowStock: any[];
  expiringSoon: any[];
  expired: any[];
};

const POLL_INTERVAL_MS = 5 * 60 * 1000;

export default function NotificationBell() {
  const [alerts, setAlerts] = useState<AlertsData | null>(null);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchAlerts = () => {
    fetchApi('/api/dashboard/alerts')
      .then(res => (res.ok ? res.json() : null))
      .then(data => data && setAlerts(data))
      .catch(() => {});
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!alerts) return null;

  const totalCount = alerts.outOfStock.length + alerts.lowStock.length + alerts.expiringSoon.length + alerts.expired.length;

  const goToFilter = (filter: string) => {
    setOpen(false);
    navigate(`/products?filter=${filter}`);
  };

  const sections = [
    { key: 'out_of_stock', title: 'نفذ من المخزون', items: alerts.outOfStock, icon: PackageX, color: 'text-red-600 bg-red-50' },
    { key: 'low_stock', title: 'مخزون منخفض', items: alerts.lowStock, icon: AlertTriangle, color: 'text-amber-600 bg-amber-50' },
    { key: 'expiring', title: 'قرب انتهاء الصلاحية', items: alerts.expiringSoon, icon: Clock, color: 'text-orange-600 bg-orange-50' },
    { key: 'expired', title: 'منتهي الصلاحية', items: alerts.expired, icon: XCircle, color: 'text-red-700 bg-red-50' },
  ];

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => { setOpen(o => !o); if (!open) fetchAlerts(); }}
        className="relative p-2 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded-lg transition-colors"
        title="التنبيهات"
      >
        <Bell className="w-5 h-5" />
        {totalCount > 0 && (
          <span className="absolute -top-1 -left-1 bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full border-2 border-white">
            {totalCount > 99 ? '99+' : totalCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 mt-2 w-96 bg-white rounded-2xl shadow-2xl border border-neutral-100 z-50 max-h-[28rem] overflow-auto">
          <div className="p-4 border-b border-neutral-100 font-bold text-neutral-800">التنبيهات</div>
          {totalCount === 0 ? (
            <div className="p-8 text-center text-neutral-400 text-sm">لا توجد تنبيهات حالياً. كل شيء تمام!</div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {sections.filter(s => s.items.length > 0).map(section => (
                <div key={section.key} className="p-3">
                  <button
                    onClick={() => goToFilter(section.key)}
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-neutral-50 transition-colors"
                  >
                    <span className="flex items-center gap-2 text-sm font-bold text-neutral-700">
                      <span className={`w-6 h-6 rounded-md flex items-center justify-center ${section.color}`}>
                        <section.icon className="w-3.5 h-3.5" />
                      </span>
                      {section.title}
                    </span>
                    <span className="text-xs font-bold bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">{section.items.length}</span>
                  </button>
                  <div className="mt-1 space-y-0.5">
                    {section.items.slice(0, 4).map((item: any) => (
                      <div key={item.id} className="px-2 py-1 text-xs text-neutral-500 truncate">
                        {item.name} {item.expiry_date ? `— ${item.expiry_date}` : item.current_stock !== undefined ? `— الرصيد: ${item.current_stock}` : ''}
                      </div>
                    ))}
                    {section.items.length > 4 && (
                      <div className="px-2 py-1 text-xs text-blue-600 font-medium">+{section.items.length - 4} أخرى</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
