import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, ShoppingCart, Package, Users, FileText, 
  Settings, LogOut, Menu, X, FileMinus, Award, Truck, DollarSign,
  Briefcase, ShieldAlert, Languages, Hammer
} from 'lucide-react';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [lang, setLang] = useState(localStorage.getItem('alight_lang') || 'en');

  const toggleLanguage = () => {
    const nextLang = lang === 'en' ? 'si' : 'en';
    setLang(nextLang);
    localStorage.setItem('alight_lang', nextLang);
    // Emit a custom event so other components can listen to language change
    window.dispatchEvent(new Event('languageChange'));
  };

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const translate = (en, si) => (lang === 'en' ? en : si);

  const menuItems = [
    { 
      path: '/', 
      label: 'Dashboard', 
      siLabel: 'පාලන පැනලය', 
      icon: LayoutDashboard, 
      roles: ['ADMIN', 'CASHIER'] 
    },
    { 
      path: '/billing', 
      label: 'New Invoice (POS)', 
      siLabel: 'නව බිල්පත (POS)', 
      icon: ShoppingCart, 
      roles: ['ADMIN', 'CASHIER'] 
    },
    { 
      path: '/invoices', 
      label: 'Invoices List', 
      siLabel: 'බිල්පත් ලැයිස්තුව', 
      icon: FileText, 
      roles: ['ADMIN', 'CASHIER'] 
    },
    { 
      path: '/quotations', 
      label: 'Quotations', 
      siLabel: 'මිල ගණන් කැඳවීම්', 
      icon: FileMinus, 
      roles: ['ADMIN', 'CASHIER', 'SALESPERSON'] 
    },
    { 
      path: '/orders', 
      label: 'Customer Orders', 
      siLabel: 'පාරිභෝගික ඇණවුම්', 
      icon: Award, 
      roles: ['ADMIN', 'CASHIER', 'SALESPERSON'] 
    },
    { 
      path: '/deliveries', 
      label: 'Delivery Tracking', 
      siLabel: 'බෙදාහැරීම් සොයාබැලීම', 
      icon: Truck, 
      roles: ['ADMIN', 'CASHIER', 'DELIVERY_STAFF'] 
    },
    { 
      path: '/products', 
      label: 'Products Stock', 
      siLabel: 'නිෂ්පාදන සහ තොග', 
      icon: Package, 
      roles: ['ADMIN', 'CASHIER', 'SALESPERSON'] 
    },
    { 
      path: '/customers', 
      label: 'Customer Ledgers', 
      siLabel: 'පාරිභෝගික ලෙජරය', 
      icon: Users, 
      roles: ['ADMIN', 'CASHIER', 'SALESPERSON'] 
    },
    { 
      path: '/suppliers', 
      label: 'Supplier Ledgers', 
      siLabel: 'සැපයුම්කරුවන්ගේ ලෙජර', 
      icon: Briefcase, 
      roles: ['ADMIN'] 
    },
    { 
      path: '/purchases', 
      label: 'Inventory Purchases', 
      siLabel: 'තොග මිලදීගැනීම්', 
      icon: DollarSign, 
      roles: ['ADMIN'] 
    },
    { 
      path: '/expenses', 
      label: 'Shop Expenses', 
      siLabel: 'ව්‍යාපාරික වියදම්', 
      icon: ShieldAlert, 
      roles: ['ADMIN', 'CASHIER'] 
    },
    {
      path: '/carpenters',
      label: 'Carpenter Payments',
      siLabel: 'Carpenter Payments',
      icon: Hammer,
      roles: ['ADMIN', 'CASHIER']
    },
    { 
      path: '/reports', 
      label: 'Reports & Profit', 
      siLabel: 'වාර්තා සහ ලාභය', 
      icon: FileText, 
      roles: ['ADMIN'] 
    },
    { 
      path: '/settings', 
      label: 'System Settings', 
      siLabel: 'පද්ධති සැකසුම්', 
      icon: Settings, 
      roles: ['ADMIN'] 
    },
  ];

  const allowedMenuItems = menuItems.filter(item => user && item.roles.includes(user.role));

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div id="app-layout" className="flex h-screen w-screen overflow-hidden bg-stone-100">
      {/* SIDEBAR */}
      <aside 
        className={`no-print fixed inset-y-0 left-0 z-30 flex flex-col bg-stone-900 text-stone-100 transition-all duration-300 ${
          sidebarOpen ? 'w-64' : 'w-0 lg:w-20'
        } overflow-hidden`}
      >
        {/* LOGO */}
        <div className="flex h-16 items-center justify-between px-4 bg-stone-950 border-b border-stone-800">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-wood-650 font-bold text-white shadow-md">
              A
            </div>
            {sidebarOpen && (
              <div className="flex flex-col">
                <span className="font-bold tracking-tight text-sm text-wood-100 leading-none">ALIGHT</span>
                <span className="text-[10px] text-stone-400 font-semibold uppercase tracking-wider">Furniture & Timbers</span>
              </div>
            )}
          </div>
          <button 
            className="lg:hidden text-stone-400 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        {/* NAVIGATION LINKS */}
        <nav className="flex-1 space-y-1 px-2 py-4 overflow-y-auto">
          {allowedMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive 
                    ? 'bg-wood-700 text-white shadow-md shadow-wood-950/40' 
                    : 'text-stone-300 hover:bg-stone-800 hover:text-white'
                }`}
              >
                <Icon size={20} className={isActive ? 'text-white' : 'text-stone-400'} />
                {sidebarOpen && <span>{translate(item.label, item.siLabel)}</span>}
              </Link>
            );
          })}
        </nav>

        {/* LOGOUT / PROFILE SECTION */}
        <div className="p-3 bg-stone-950 border-t border-stone-800 flex flex-col gap-2">
          {sidebarOpen && user && (
            <div className="px-2 py-1.5 flex flex-col">
              <span className="text-sm font-semibold text-stone-100 leading-none">{user.name}</span>
              <span className="text-[11px] text-wood-400 font-medium capitalize mt-1">{user.role.replace('_', ' ')}</span>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-red-400 hover:bg-red-950/30 hover:text-red-300 transition-colors"
          >
            <LogOut size={20} className="shrink-0" />
            {sidebarOpen && <span>{translate('Logout', 'පද්ධතියෙන් ඉවත් වන්න')}</span>}
          </button>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <div className={`flex flex-1 flex-col overflow-hidden transition-all duration-300 ${sidebarOpen ? 'lg:pl-64' : 'lg:pl-20'}`}>
        {/* TOP BAR */}
        <header className="no-print flex h-16 items-center justify-between px-6 bg-white border-b border-stone-200 shadow-sm z-25">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-stone-600 hover:text-stone-900 rounded-lg p-1.5 hover:bg-stone-100 transition-colors"
            >
              <Menu size={22} />
            </button>
            <h1 className="text-lg font-bold text-stone-850 hidden sm:block">
              {translate('Alight Furniture & Timbers Management System', 'ඇලයිට් ෆර්නිචර් සහ ටිම්බර්ස් කළමනාකරණ පද්ධතිය')}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Bilingual toggle button */}
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 text-xs font-semibold text-stone-700 bg-stone-50 hover:bg-stone-100 hover:border-stone-300 transition-all shadow-sm"
              title="Change Language / භාෂාව වෙනස් කරන්න"
            >
              <Languages size={14} className="text-wood-650" />
              <span>{lang === 'en' ? 'සිංහල (SI)' : 'English (EN)'}</span>
            </button>

            {/* User welcome badge */}
            {user && (
              <div className="hidden md:flex flex-col items-end leading-none">
                <span className="text-xs text-stone-400 font-medium">{translate('Welcome', 'ආයුබෝවන්')}</span>
                <span className="text-sm font-bold text-stone-800 mt-0.5">{user.name}</span>
              </div>
            )}
          </div>
        </header>

        {/* WORKSPACE CONTENT VIEWPORT */}
        <main className="flex-1 overflow-y-auto bg-stone-100 p-6">
          <div className="mx-auto max-w-7xl animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
