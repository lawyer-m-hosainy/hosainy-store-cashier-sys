import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Package, ShoppingCart, Wallet, Users, Truck, FileText, ClipboardCheck, Banknote, LogOut, Settings } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useEffect } from 'react';
import { getUser, removeToken } from '../lib/api';
import NotificationBell from './NotificationBell';

const navItems = [
  { name: 'الرئيسية', path: '/', icon: LayoutDashboard, reqRole: 'owner' },
  { name: 'الكاشير', path: '/pos', icon: ShoppingCart },
  { name: 'المنتجات والمخزون', path: '/products', icon: Package, reqRole: 'owner' },
  { name: 'الموردين', path: '/suppliers', icon: Truck, reqRole: 'owner' },
  { name: 'المشتريات', path: '/purchases', icon: ShoppingCart, reqRole: 'owner' },
  { name: 'العملاء', path: '/customers', icon: Users },
  { name: 'المصروفات', path: '/expenses', icon: Banknote, reqRole: 'owner' },
  { name: 'جرد المخزون', path: '/inventory', icon: ClipboardCheck, reqRole: 'owner' },
  { name: 'تقفيلة الخزينة', path: '/cash', icon: Wallet },
  { name: 'التقارير', path: '/reports', icon: FileText, reqRole: 'owner' },
  { name: 'المستخدمين', path: '/users', icon: Users, reqRole: 'owner' },
  { name: 'سجل النشاطات', path: '/audit', icon: FileText, reqRole: 'owner' },
  { name: 'الإعدادات', path: '/settings', icon: Settings, reqRole: 'owner' },
];

export default function Layout() {
  const { fetchActiveSession, activeCashSession } = useStore();
  const user = getUser();

  useEffect(() => {
    fetchActiveSession();
  }, [fetchActiveSession]);

  const handleLogout = () => {
    removeToken();
    window.location.href = '/login';
  };

  return (
    <div className="flex h-screen bg-neutral-100 text-neutral-900 font-sans" dir="rtl">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-l border-neutral-200 flex flex-col shadow-sm">
        <div className="p-6 border-b border-neutral-200 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">H</div>
          <h1 className="text-xl font-bold text-neutral-800 tracking-wide">Hosainy Store</h1>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.filter(i => !i.reqRole || i.reqRole === user?.role).map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              <span>{item.name}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-neutral-200">
          <div className="flex items-center justify-between mb-4">
             <div className="flex items-center gap-2 text-sm text-neutral-600">
               <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center">
                 <Users className="w-4 h-4" />
               </div>
               <div>
                 <p className="font-bold">{user?.name}</p>
                 <p className="text-xs text-neutral-400">{user?.role === 'owner' ? 'مدير عام' : 'موظف'}</p>
               </div>
             </div>
             <button onClick={handleLogout} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors">
               <LogOut className="w-5 h-5" />
             </button>
          </div>
          <div className="text-sm text-neutral-500 mb-2">حالة الخزينة</div>
          <div
            className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-between ${
              activeCashSession ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}
          >
            <span>{activeCashSession ? 'الخزينة مفتوحة' : 'الخزينة مغلقة'}</span>
            <div className={`w-2 h-2 rounded-full ${activeCashSession ? 'bg-green-500' : 'bg-red-500'}`}></div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto flex flex-col">
        {user?.role === 'owner' && (
          <div className="flex items-center justify-end px-6 py-3 border-b border-neutral-200 bg-white">
            <NotificationBell />
          </div>
        )}
        <div className="flex-1">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
