import { fetchApi } from '../lib/api';
import React, { useEffect, useState } from 'react';
import { ClipboardCheck, Save } from 'lucide-react';
import { toast } from '../store/useToast';

export default function Inventory() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [isCounting, setIsCounting] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  const fetchProducts = () => {
    fetchApi('/api/products')
      .then(res => res.json())
      .then(setProducts);
  };

  const fetchCategories = () => {
    fetchApi('/api/categories')
      .then(res => res.json())
      .then(setCategories)
      .catch(() => setCategories([]));
  };

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  const handleStart = () => {
    setIsCounting(true);
    const initialCounts: Record<number, string> = {};
    const filteredProducts = selectedCategory ? products.filter(p => p.category_id == selectedCategory) : products;
    filteredProducts.forEach(p => initialCounts[p.id] = p.current_stock.toString());
    setCounts(initialCounts);
  };

  const handleCountChange = (id: number, value: string) => {
    setCounts(prev => ({ ...prev, [id]: value }));
  };

  const handleSave = async () => {
    if(!confirm('هل أنت متأكد من اعتماد الجرد؟ سيتم تحديث الكميات في النظام.')) return;
    
    const filteredProducts = selectedCategory ? products.filter(p => p.category_id == selectedCategory) : products;

    const adjustments = filteredProducts.map(p => {
      const actual = parseInt(counts[p.id]) || 0;
      return {
        product_id: p.id,
        expected: p.current_stock,
        actual: actual,
        difference: actual - p.current_stock,
        reason: selectedCategory ? 'جرد جزئي' : 'جرد شامل'
      };
    }).filter(a => a.difference !== 0);

    if (adjustments.length > 0) {
      const res = await fetchApi('/api/inventory/count', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: new Date().toISOString().split('T')[0],
          adjustments
        })
      });
      if (!res.ok) {
        toast.error('فشل اعتماد الجرد');
        return;
      }
    }

    toast.success('تم اعتماد الجرد بنجاح.');
    setIsCounting(false);
    fetchProducts();
  };

  const displayProducts = selectedCategory ? products.filter(p => p.category_id == selectedCategory) : products;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-800">جرد المخزون</h1>
          <p className="text-neutral-500 mt-2">تسوية وتحديث الكميات الفعلية للمنتجات.</p>
        </div>
        {!isCounting ? (
          <div className="flex gap-3 items-center">
            <select 
              value={selectedCategory} 
              onChange={e => setSelectedCategory(e.target.value)}
              className="p-3 border rounded-xl bg-white"
            >
              <option value="">جميع الفئات (جرد شامل)</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button 
              onClick={handleStart}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-colors"
            >
              <ClipboardCheck className="w-5 h-5" />
              بدء جلسة جرد
            </button>
          </div>
        ) : (
          <div className="flex gap-3 items-center">
            <span className="text-sm font-medium bg-blue-100 text-blue-800 px-3 py-1 rounded-full">
              {selectedCategory ? 'جرد جزئي' : 'جرد شامل'}
            </span>
             <button 
              onClick={() => setIsCounting(false)}
              className="bg-white border border-neutral-200 text-neutral-600 px-6 py-3 rounded-xl font-medium transition-colors hover:bg-neutral-50"
            >
              إلغاء
            </button>
            <button 
              onClick={handleSave}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-colors"
            >
              <Save className="w-5 h-5" />
              اعتماد الجرد
            </button>
          </div>
        )}
      </header>

      <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
        {isCounting && (
           <div className="bg-blue-50/50 p-4 border-b border-blue-100 text-blue-800 flex items-center gap-3">
             <ClipboardCheck className="w-6 h-6 text-blue-600" />
             <div>
               <p className="font-bold">جلسة جرد نشطة</p>
               <p className="text-sm opacity-80">يرجى إدخال الكمية الفعلية الموجودة في الرفوف. اتركه كما هو إذا كان متطابقاً.</p>
             </div>
           </div>
        )}
        <table className="w-full text-right">
          <thead className="bg-neutral-50 text-neutral-500 font-medium text-sm border-b border-neutral-100">
            <tr>
              <th className="py-4 px-6">SKU</th>
              <th className="py-4 px-6">المنتج</th>
              <th className="py-4 px-6">الرصيد بالنظام</th>
              {isCounting && (
                <>
                  <th className="py-4 px-6">الرصيد الفعلي</th>
                  <th className="py-4 px-6">الفرق</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {displayProducts.map(p => {
              const actual = isCounting ? (parseInt(counts[p.id]) || 0) : p.current_stock;
              const diff = actual - p.current_stock;
              return (
                <tr key={p.id} className="hover:bg-neutral-50/50 transition-colors">
                  <td className="py-4 px-6 font-mono text-sm text-neutral-500">{p.sku}</td>
                  <td className="py-4 px-6 font-medium text-neutral-800">{p.name}</td>
                  <td className="py-4 px-6">{p.current_stock}</td>
                  {isCounting && (
                    <>
                      <td className="py-3 px-6">
                        <input 
                          type="number" 
                          value={counts[p.id]} 
                          onChange={(e) => handleCountChange(p.id, e.target.value)}
                          className="w-24 p-2 border border-neutral-300 rounded-lg text-center"
                        />
                      </td>
                      <td className="py-4 px-6">
                        {diff !== 0 ? (
                           <span className={`font-bold ${diff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                             {diff > 0 ? '+' : ''}{diff}
                           </span>
                        ) : <span className="text-neutral-300">-</span>}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
            {displayProducts.length === 0 && (
              <tr>
                <td colSpan={isCounting ? 5 : 3} className="py-12 text-center text-neutral-500">لا توجد منتجات.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
