import { fetchApi } from '../lib/api';
import { useEffect, useState } from 'react';
import { TrendingUp, ShoppingBag, Truck, AlertTriangle } from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetchApi('/api/dashboard/today')
      .then(res => res.json())
      .then(data => setStats(data));
  }, []);

  if (!stats) return <div className="p-8 text-neutral-500">جاري التحميل...</div>;

  const cards = [
    { title: 'إجمالي مبيعات اليوم', value: `${stats.totalSales || 0} ج.م`, icon: TrendingUp, color: 'bg-blue-50 text-blue-600' },
    { title: 'مبيعات داخلي', value: `${stats.instoreTotal || 0} ج.م`, icon: ShoppingBag, color: 'bg-indigo-50 text-indigo-600' },
    { title: 'مبيعات توصيل', value: `${stats.deliveryTotal || 0} ج.م`, icon: Truck, color: 'bg-purple-50 text-purple-600' },
    { title: 'نواقص المخزون', value: `${stats.lowStockCount || 0} صنف`, icon: AlertTriangle, color: 'bg-amber-50 text-amber-600' },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-neutral-800">ملخص اليوم</h1>
        <p className="text-neutral-500 mt-2">نظرة عامة على أداء المكتبة لليوم.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100 flex items-center gap-4">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${card.color}`}>
              <card.icon className="w-7 h-7" />
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-500">{card.title}</p>
              <p className="text-2xl font-bold text-neutral-800 mt-1">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-neutral-100">
        <h2 className="text-xl font-bold text-neutral-800 mb-6">تفاصيل مالية سريعة</h2>
        <div className="grid grid-cols-2 gap-8">
          <div>
            <p className="text-sm text-neutral-500">إجمالي الطلبات</p>
            <p className="text-3xl font-bold text-neutral-800 mt-2">{stats.orderCount || 0}</p>
          </div>
          <div>
            <p className="text-sm text-neutral-500">إجمالي الربح (تقريبي)</p>
            <p className="text-3xl font-bold text-green-600 mt-2">{stats.grossProfit || 0} ج.م</p>
          </div>
        </div>
      </div>
    </div>
  );
}
