import { fetchApi } from '../lib/api';
import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { Download, FileText, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from '../store/useToast';

export default function Reports() {
  const [reportData, setReportData] = useState<any>(null);
  
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const endOfDay = today.toISOString().split('T')[0];

  const [dateRange, setDateRange] = useState({ start: startOfMonth, end: endOfDay });
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  const fetchReports = () => {
    fetchApi(`/api/reports?start=${dateRange.start}&end=${dateRange.end}`)
      .then(res => res.json())
      .then(setReportData);
  };

  useEffect(() => {
    fetchReports();
  }, [dateRange]);

  const handleExportPDF = async () => {
    setIsExportingPDF(true);
    try {
      // Need a backend endpoint to render via Puppeteer. Let's assume it exists.
      const response = await fetchApi(`/api/export-pdf?start=${dateRange.start}&end=${dateRange.end}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report_${dateRange.start}_${dateRange.end}.pdf`;
      a.click();
    } catch (e) {
      toast.error('فشل تصدير الـ PDF');
    }
    setIsExportingPDF(false);
  };

  const handleExportExcel = () => {
    if (!reportData) return;
    
    const wb = XLSX.utils.book_new();
    
    // Summary
    const summaryData = [
      ["المؤشر", "القيمة"],
      ["إجمالي المبيعات", reportData.totalSales],
      ["إجمالي الربح", reportData.grossProfit],
      ["المصروفات", reportData.totalExpenses],
      ["صافي الربح", reportData.netProfit],
      ["قيمة المخزون", reportData.inventoryValue],
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "الملخص");
    
    // Top Customers
    const wsCustomers = XLSX.utils.json_to_sheet(reportData.topCustomers);
    XLSX.utils.book_append_sheet(wb, wsCustomers, "أفضل العملاء");
    
    // Stagnant
    const wsStagnant = XLSX.utils.json_to_sheet(reportData.stagnantProducts);
    XLSX.utils.book_append_sheet(wb, wsStagnant, "الرواكد");
    
    // Trends
    const wsTrends = XLSX.utils.json_to_sheet(reportData.dailyTrends);
    XLSX.utils.book_append_sheet(wb, wsTrends, "اتجاهات المبيعات");

    // Top Products
    const wsTopProducts = XLSX.utils.json_to_sheet(reportData.topProducts || []);
    XLSX.utils.book_append_sheet(wb, wsTopProducts, "أفضل المنتجات");

    // Payment Methods
    const wsPayments = XLSX.utils.json_to_sheet(reportData.salesByPaymentMethod || []);
    XLSX.utils.book_append_sheet(wb, wsPayments, "طرق الدفع");

    XLSX.writeFile(wb, `report_${dateRange.start}_${dateRange.end}.xlsx`);
  };

  if (!reportData) return <div className="p-8">جاري التحميل...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8" id="report-container">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-800">التقارير والإحصاءات</h1>
          <p className="text-neutral-500 mt-2">نظرة شاملة على أداء المكتبة والمخزون.</p>
        </div>
        <div className="flex gap-3">
          <div className="flex items-center gap-2 bg-white px-4 py-2 border rounded-xl">
             <input type="date" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} className="focus:outline-none bg-transparent" />
             <span className="text-neutral-400">إلى</span>
             <input type="date" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} className="focus:outline-none bg-transparent" />
          </div>
          <button 
            onClick={handleExportExcel}
            className="bg-green-50 hover:bg-green-100 text-green-700 px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors border border-green-200"
          >
            <FileSpreadsheet className="w-5 h-5" />
            Excel
          </button>
          <button 
            onClick={handleExportPDF}
            disabled={isExportingPDF}
            className="bg-red-50 hover:bg-red-100 text-red-700 px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors border border-red-200 disabled:opacity-50"
          >
            <FileText className="w-5 h-5" />
            {isExportingPDF ? 'جاري التحضير...' : 'PDF'}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
          <p className="text-sm font-medium text-neutral-500 mb-2">إجمالي المبيعات</p>
          <p className="text-3xl font-bold text-blue-600">{reportData.totalSales} ج</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
          <p className="text-sm font-medium text-neutral-500 mb-2">إجمالي المصروفات</p>
          <p className="text-3xl font-bold text-red-600">{reportData.totalExpenses} ج</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
           <div className="flex items-center justify-between mb-2">
             <p className="text-sm font-medium text-neutral-500">صافي الربح</p>
             <span className="text-xs text-neutral-400 bg-neutral-100 px-2 py-1 rounded">إجمالي الربح - المصروفات</span>
           </div>
          <p className={`text-3xl font-bold ${reportData.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{reportData.netProfit} ج</p>
        </div>
        <div className="bg-neutral-900 p-6 rounded-2xl shadow-sm text-white">
          <p className="text-sm font-medium text-neutral-400 mb-2">قيمة المخزون الحالية</p>
          <p className="text-3xl font-bold">{reportData.inventoryValue} ج</p>
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100 h-[400px]">
        <h2 className="text-xl font-bold mb-6">اتجاه المبيعات والأرباح</h2>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={reportData.dailyTrends} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f5" />
            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#888', fontSize: 12}} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{fill: '#888', fontSize: 12}} />
            <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} cursor={{fill: '#f9fafb'}} />
            <Legend verticalAlign="top" height={36} iconType="circle" />
            <Bar dataKey="sales" name="المبيعات" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
            <Bar dataKey="profit" name="الربح" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
          <h2 className="text-xl font-bold mb-6">أفضل المنتجات مبيعاً</h2>
          <table className="w-full text-right text-sm">
            <thead>
              <tr className="text-neutral-500 border-b">
                <th className="pb-3">المنتج</th>
                <th className="pb-3">الكمية المباعة</th>
                <th className="pb-3">الإيراد</th>
                <th className="pb-3">الربح</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(reportData.topProducts || []).map((p: any, i: number) => (
                <tr key={i}>
                  <td className="py-4 font-medium">{p.name}</td>
                  <td className="py-4 text-neutral-500">{p.qty_sold}</td>
                  <td className="py-4 font-bold text-blue-600">{p.revenue} ج.م</td>
                  <td className="py-4 text-green-600">{p.profit} ج.م</td>
                </tr>
              ))}
              {(!reportData.topProducts || reportData.topProducts.length === 0) && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-neutral-500">لا توجد بيانات للفترة المحددة.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
          <h2 className="text-xl font-bold mb-6">المبيعات حسب طريقة الدفع</h2>
          <table className="w-full text-right text-sm">
            <thead>
              <tr className="text-neutral-500 border-b">
                <th className="pb-3">طريقة الدفع</th>
                <th className="pb-3">عدد الفواتير</th>
                <th className="pb-3">الإجمالي</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(reportData.salesByPaymentMethod || []).map((p: any, i: number) => (
                <tr key={i}>
                  <td className="py-4 font-medium">{p.payment_method === 'cash' ? 'نقدي' : p.payment_method === 'card' ? 'بطاقة' : p.payment_method}</td>
                  <td className="py-4 text-neutral-500">{p.count}</td>
                  <td className="py-4 font-bold text-blue-600">{p.total} ج.م</td>
                </tr>
              ))}
              {(!reportData.salesByPaymentMethod || reportData.salesByPaymentMethod.length === 0) && (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-neutral-500">لا توجد بيانات للفترة المحددة.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
          <h2 className="text-xl font-bold mb-6">أعلى العملاء شراءً</h2>
          <table className="w-full text-right text-sm">
            <thead>
              <tr className="text-neutral-500 border-b">
                <th className="pb-3">الاسم</th>
                <th className="pb-3">رقم التليفون</th>
                <th className="pb-3">إجمالي المسحوبات</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {reportData.topCustomers.map((c:any, i:number) => (
                <tr key={i}>
                  <td className="py-4 font-medium">{c.name}</td>
                  <td className="py-4 text-neutral-500 font-mono">{c.phone}</td>
                  <td className="py-4 font-bold text-blue-600">{c.total_spent} ج.م</td>
                </tr>
              ))}
              {reportData.topCustomers.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-neutral-500">لا توجد بيانات للفترة المحددة.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
          <h2 className="text-xl font-bold mb-6">الأصناف الراكدة (لم تُباع منذ 30 يوم)</h2>
          <table className="w-full text-right text-sm">
            <thead>
              <tr className="text-neutral-500 border-b">
                <th className="pb-3">المنتج</th>
                <th className="pb-3">SKU</th>
                <th className="pb-3">الرصيد المتبقي</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {reportData.stagnantProducts.map((p:any, i:number) => (
                <tr key={i}>
                  <td className="py-4 font-medium">{p.name}</td>
                  <td className="py-4 text-neutral-500 font-mono">{p.sku}</td>
                  <td className="py-4 text-red-600 font-bold">{p.current_stock}</td>
                </tr>
              ))}
              {reportData.stagnantProducts.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-neutral-500">لا توجد أصناف راكدة. ممتاز!</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
