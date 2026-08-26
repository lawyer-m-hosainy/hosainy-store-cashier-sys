import { fetchApi } from '../lib/api';
import React, { useEffect, useState, useRef } from 'react';
import { Search, ShoppingCart, Plus, Minus, Trash2, UserPlus, PauseCircle, PlayCircle, Keyboard } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useNavigate } from 'react-router-dom';

export default function POS() {
  const { activeCashSession } = useStore();
  const navigate = useNavigate();
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<any[]>([]);
  const [type, setType] = useState('instore');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [printInvoice, setPrintInvoice] = useState<any>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  
  // Hold & Recall
  const [heldCarts, setHeldCarts] = useState<any[]>([]);
  const [showHeldCarts, setShowHeldCarts] = useState(false);

  // Customers
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', address: '' });

  useEffect(() => {
    if (search.length === 13 && search.startsWith('2')) {
      // Barcode Scale Logic (e.g. 21 + 5-digit SKU + 5-digit Weight + 1-digit Checksum)
      const itemCode = search.substring(2, 7);
      const weightStr = search.substring(7, 12);
      const weight = parseInt(weightStr, 10) / 1000; // 01500 -> 1.500 kg
      
      const product = products.find(p => p.sku === itemCode);
      if (product) {
        setCart(prev => {
          const exists = prev.find(item => item.product_id === product.id);
          if (exists) {
            return prev.map(item => item.product_id === product.id ? { ...item, qty: item.qty + weight, line_total: (item.qty + weight) * item.unit_price } : item);
          }
          return [...prev, { product_id: product.id, name: product.name, unit_price: product.sell_price, qty: weight, line_total: product.sell_price * weight }];
        });
        setSearch(''); // Clear input after successful scan
        return;
      }
    }

    fetchApi(`/api/products?search=${search}`)
      .then(res => res.json())
      .then(data => setProducts(data));
  }, [search]);

  // Handle Receipt Printing Auto-Trigger
  useEffect(() => {
    if (printInvoice) {
      setTimeout(() => {
        window.print();
        setPrintInvoice(null);
      }, 500); // Wait for DOM to render the receipt before printing
    }
  }, [printInvoice]);

  useEffect(() => {
    fetchCustomers();
    const stored = localStorage.getItem('heldCarts');
    if (stored) setHeldCarts(JSON.parse(stored));
  }, []);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        handleCheckout();
      } else if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'F4') {
        e.preventDefault();
        if (cart.length > 0 && window.confirm('هل أنت متأكد من إلغاء الفاتورة الحالية؟ (F4)')) {
          setCart([]);
          setSelectedCustomerId('');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, selectedCustomerId, type, paymentMethod, activeCashSession]);

  const fetchCustomers = () => {
    fetchApi('/api/customers')
      .then(res => res.json())
      .then(data => setCustomers(data));
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetchApi('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newCustomer, source: type === 'delivery' ? 'online' : 'instore' })
    });
    const data = await res.json();
    fetchCustomers();
    setSelectedCustomerId(data.id.toString());
    setShowAddCustomer(false);
    setNewCustomer({ name: '', phone: '', address: '' });
  };

  const addToCart = (product: any) => {
    setCart(prev => {
      const exists = prev.find(item => item.product_id === product.id);
      if (exists) {
        return prev.map(item => item.product_id === product.id ? { ...item, qty: item.qty + 1, line_total: (item.qty + 1) * item.unit_price } : item);
      }
      return [...prev, { product_id: product.id, name: product.name, unit_price: product.sell_price, qty: 1, line_total: product.sell_price }];
    });
  };

  const updateQty = (id: number, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product_id === id) {
        // Round to 3 decimal places to avoid JS float issues, allow fractional qty
        const newQty = Math.max(0.001, Math.round((item.qty + delta) * 1000) / 1000);
        return { ...item, qty: newQty, line_total: newQty * item.unit_price };
      }
      return item;
    }));
  };

  const removeItem = (id: number) => {
    setCart(prev => prev.filter(item => item.product_id !== id));
  };

  const saveHeldCarts = (newCarts: any[]) => {
    setHeldCarts(newCarts);
    localStorage.setItem('heldCarts', JSON.stringify(newCarts));
  };

  const holdCurrentCart = () => {
    if (cart.length === 0) return;
    const newHold = {
      id: Date.now(),
      time: new Date().toLocaleTimeString('ar-EG'),
      cart: [...cart],
      selectedCustomerId,
      type
    };
    saveHeldCarts([...heldCarts, newHold]);
    setCart([]);
    setSelectedCustomerId('');
  };

  const recallCart = (heldCart: any) => {
    if (cart.length > 0) {
      if (!window.confirm('سلة المشتريات الحالية غير فارغة، هل تريد المتابعة واستبدالها؟')) return;
    }
    setCart(heldCart.cart);
    setSelectedCustomerId(heldCart.selectedCustomerId);
    setType(heldCart.type);
    saveHeldCarts(heldCarts.filter(c => c.id !== heldCart.id));
    setShowHeldCarts(false);
  };

  const total = cart.reduce((sum, item) => sum + item.line_total, 0);

  const handleCheckout = async () => {
    if (!activeCashSession) {
      alert('الرجاء فتح وردية خزينة أولاً من شاشة الخزينة.');
      navigate('/cash');
      return;
    }
    if (type === 'delivery' && !selectedCustomerId) {
       alert('يجب تحديد العميل في حالة التوصيل.');
       return;
    }
    
    if (cart.length === 0) return;
    if (isCheckingOut) return; // Prevent double-submit from a double-click or repeated F1 press

    const invoiceData = {
      date: new Date().toLocaleString('ar-EG'),
      items: [...cart],
      total,
      type,
      cashier: 'الكاشير' // Can be fetched from user state
    };

    setIsCheckingOut(true);
    try {
      const res = await fetchApi('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          payment_method: paymentMethod,
          cash_session_id: activeCashSession.id,
          customer_id: selectedCustomerId || null,
          items: cart
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'فشل تسجيل عملية البيع');
        return;
      }

      setPrintInvoice(invoiceData);
      setCart([]);
      setSelectedCustomerId('');
    } finally {
      setIsCheckingOut(false);
    }
  };

  if (!activeCashSession) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <ShoppingCart className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-neutral-800">الخزينة مغلقة</h2>
          <p className="text-neutral-500 mt-2">يجب فتح وردية جديدة لبدء البيع.</p>
          <button onClick={() => navigate('/cash')} className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium">الذهاب لتقفيلة الخزينة</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full relative">
      {/* Print Styles for Receipt */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #receipt-printable, #receipt-printable * { visibility: visible; }
          #receipt-printable {
            position: absolute;
            left: 0;
            top: 0;
            width: 80mm; /* Standard thermal receipt width */
            margin: 0;
            padding: 10px;
            font-size: 12px;
            color: #000;
            background: #fff;
          }
        }
      `}</style>

      {/* Hidden Printable Receipt */}
      {printInvoice && (
        <div id="receipt-printable" className="bg-white p-4 hidden print:block">
          <div className="text-center border-b border-black pb-2 mb-2">
            <h2 className="font-bold text-xl mb-1">Hosainy Store</h2>
            <p>فاتورة مبيعات</p>
            <p>{printInvoice.date}</p>
          </div>
          <table className="w-full text-right mb-2">
            <thead>
              <tr className="border-b border-black border-dashed">
                <th className="py-1">الصنف</th>
                <th className="py-1">الكمية</th>
                <th className="py-1">السعر</th>
                <th className="py-1">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {printInvoice.items.map((item: any, idx: number) => (
                <tr key={idx}>
                  <td className="py-1">{item.name}</td>
                  <td className="py-1">{item.qty}</td>
                  <td className="py-1">{item.unit_price}</td>
                  <td className="py-1">{item.line_total}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-black border-dashed pt-2 font-bold flex justify-between text-lg">
            <span>الإجمالي:</span>
            <span>{printInvoice.total} ج.م</span>
          </div>
          <div className="text-center mt-4 pt-2 border-t border-black border-dashed">
            <p>شكراً لزيارتكم!</p>
          </div>
        </div>
      )}

      {/* Products Selection */}
      <div className="flex-1 p-6 flex flex-col h-full bg-neutral-50">
        <div className="relative mb-4 flex gap-4">
          <div className="relative flex-1">
            <Search className="w-6 h-6 absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input 
              ref={searchInputRef}
              type="text"
              placeholder="ابحث عن منتج... (F2)"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-4 pr-12 py-4 text-lg rounded-2xl border-2 border-neutral-200 focus:outline-none focus:border-blue-500 shadow-sm bg-white"
            />
          </div>
          <button 
            onClick={() => setShowHeldCarts(true)}
            className="px-6 bg-white border border-neutral-200 hover:border-blue-500 text-neutral-600 rounded-2xl font-medium shadow-sm transition-colors relative flex items-center gap-2"
          >
            <PlayCircle className="w-5 h-5" />
            استرجاع
            {heldCarts.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-6 h-6 flex items-center justify-center rounded-full border-2 border-white">{heldCarts.length}</span>
            )}
          </button>
        </div>
        
        {/* Held Carts Modal */}
        {showHeldCarts && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-2xl max-w-lg w-full shadow-2xl">
              <h3 className="text-xl font-bold mb-4 border-b pb-3">الفواتير المعلقة</h3>
              <div className="space-y-3 max-h-96 overflow-auto">
                {heldCarts.map(hc => (
                  <div key={hc.id} className="flex items-center justify-between p-3 border rounded-xl hover:bg-neutral-50">
                    <div>
                      <div className="font-bold text-neutral-800">فاتورة {hc.time}</div>
                      <div className="text-sm text-neutral-500">{hc.cart.length} أصناف - {hc.cart.reduce((s:number, i:any)=>s+i.line_total, 0)} ج.م</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => saveHeldCarts(heldCarts.filter(c => c.id !== hc.id))} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-5 h-5" /></button>
                      <button onClick={() => recallCart(hc)} className="px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg font-medium">استرجاع</button>
                    </div>
                  </div>
                ))}
                {heldCarts.length === 0 && <div className="text-center py-8 text-neutral-500">لا توجد فواتير معلقة.</div>}
              </div>
              <button onClick={() => setShowHeldCarts(false)} className="mt-4 w-full p-3 bg-neutral-100 text-neutral-700 hover:bg-neutral-200 rounded-xl font-medium">إغلاق</button>
            </div>
          </div>
        )}
        
        <div className="flex-1 overflow-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-6">
            {products.map(product => (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                disabled={product.current_stock <= 0}
                className={`p-4 rounded-2xl border text-right transition-all text-right ${
                  product.current_stock <= 0 
                  ? 'bg-neutral-100 border-neutral-200 opacity-60 cursor-not-allowed'
                  : 'bg-white border-neutral-200 hover:border-blue-500 hover:shadow-md'
                }`}
              >
                <div className="font-medium text-neutral-800 line-clamp-2 min-h-[3rem]">{product.name}</div>
                <div className="mt-4 flex items-end justify-between">
                  <span className="text-lg font-bold text-blue-600">{product.sell_price} ج</span>
                  <span className={`text-xs px-2 py-1 rounded-md ${product.current_stock > 0 ? 'bg-neutral-100' : 'bg-red-50 text-red-600'}`}>
                    {product.current_stock > 0 ? `متاح: ${product.current_stock}` : 'نفذ'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cart Sidebar */}
      <div className="w-[400px] bg-white border-r border-neutral-200 flex flex-col shadow-[-4px_0_24px_rgba(0,0,0,0.02)] z-10">
        <div className="p-6 border-b border-neutral-100 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-bold text-neutral-800">سلة المشتريات</h2>
            <div className="flex gap-2">
              <button onClick={holdCurrentCart} disabled={cart.length === 0} className="p-2 bg-neutral-100 text-neutral-600 hover:bg-neutral-200 disabled:opacity-50 rounded-lg" title="تعليق الفاتورة">
                <PauseCircle className="w-5 h-5" />
              </button>
              <button onClick={() => { if(window.confirm('إلغاء الفاتورة؟ (F4)')) setCart([]); }} disabled={cart.length === 0} className="p-2 bg-red-50 text-red-500 hover:bg-red-100 disabled:opacity-50 rounded-lg" title="إلغاء الفاتورة (F4)">
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <select 
              value={selectedCustomerId} 
              onChange={e => setSelectedCustomerId(e.target.value)}
              className="flex-1 p-2 border rounded-xl bg-neutral-50 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">(بدون عميل محدد)</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name} - {c.phone}</option>
              ))}
            </select>
            <button onClick={() => setShowAddCustomer(true)} className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100" title="إضافة عميل جديد">
              <UserPlus className="w-5 h-5" />
            </button>
          </div>
          {showAddCustomer && (
            <form onSubmit={handleAddCustomer} className="bg-neutral-50 p-3 rounded-xl border border-neutral-200 text-sm space-y-2">
              <input required placeholder="الاسم" value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} className="w-full p-2 border rounded-lg outline-none focus:border-blue-500" />
              <input required placeholder="الموبايل" value={newCustomer.phone} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} className="w-full p-2 border rounded-lg outline-none focus:border-blue-500" />
              <input placeholder="العنوان" value={newCustomer.address} onChange={e => setNewCustomer({...newCustomer, address: e.target.value})} className="w-full p-2 border rounded-lg outline-none focus:border-blue-500" />
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowAddCustomer(false)} className="flex-1 p-2 text-neutral-600 bg-white border rounded-lg">إلغاء</button>
                <button type="submit" className="flex-1 p-2 bg-blue-600 text-white rounded-lg">حفظ العميل</button>
              </div>
            </form>
          )}
        </div>
        
        <div className="flex-1 overflow-auto p-4 space-y-3">
          {cart.map(item => (
            <div key={item.product_id} className="bg-neutral-50 border border-neutral-100 p-3 rounded-xl flex gap-4 items-center">
              <div className="flex-1">
                <div className="font-medium text-neutral-800">{item.name}</div>
                <div className="text-blue-600 font-semibold mt-1">{item.line_total} ج</div>
              </div>
              <div className="flex items-center gap-3 bg-white border border-neutral-200 rounded-lg p-1">
                <button onClick={() => updateQty(item.product_id, 1)} className="p-1 hover:bg-neutral-100 rounded-md text-neutral-600"><Plus className="w-4 h-4" /></button>
                <span className="font-medium min-w-[1.5rem] text-center">{item.qty}</span>
                <button onClick={() => updateQty(item.product_id, -1)} className="p-1 hover:bg-neutral-100 rounded-md text-neutral-600"><Minus className="w-4 h-4" /></button>
              </div>
              <button onClick={() => removeItem(item.product_id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-5 h-5" /></button>
            </div>
          ))}
          {cart.length === 0 && (
            <div className="text-center text-neutral-400 mt-12">
              <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-20" />
              السلة فارغة
            </div>
          )}
        </div>

        <div className="p-6 bg-neutral-50 border-t border-neutral-200">
          <div className="flex justify-between items-center mb-6">
            <span className="text-neutral-500 text-lg">الإجمالي</span>
            <span className="text-3xl font-bold text-neutral-900">{total} ج.م</span>
          </div>
          
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button onClick={() => setType('instore')} className={`py-2.5 rounded-xl font-medium border transition-colors ${type === 'instore' ? 'bg-neutral-800 text-white border-neutral-800' : 'bg-white border-neutral-200 text-neutral-600'}`}>داخلي</button>
            <button onClick={() => setType('delivery')} className={`py-2.5 rounded-xl font-medium border transition-colors ${type === 'delivery' ? 'bg-neutral-800 text-white border-neutral-800' : 'bg-white border-neutral-200 text-neutral-600'}`}>توصيل</button>
          </div>
          
          <button
            disabled={cart.length === 0 || isCheckingOut}
            onClick={handleCheckout}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-300 disabled:cursor-not-allowed text-white text-lg font-bold rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2"
          >
            {isCheckingOut ? 'جاري الحفظ...' : <>دفع وإصدار الفاتورة <span className="bg-white/20 text-sm px-2 py-0.5 rounded ml-2">F1</span></>}
          </button>
        </div>
      </div>
    </div>
  );
}
