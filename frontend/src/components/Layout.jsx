import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageErrorBoundary from './PageErrorBoundary';
import {
  ArrowLeft,
  Award,
  BellRing,
  BookOpen,
  Box,
  Briefcase,
  CircleHelp,
  DollarSign,
  FileMinus,
  FileText,
  Hammer,
  Home,
  Languages,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ReceiptText,
  Settings,
  ShieldAlert,
  ShoppingCart,
  Truck,
  Users,
  WalletCards,
  X,
  Layers,
  Wrench,
} from 'lucide-react';

const routeTitles = [
  { match: (path) => path === '/', title: 'Welcome to Alight Furniture' },
  { match: (path) => path.startsWith('/customers') || path.startsWith('/suppliers'), title: 'Manage Credit' },
  { match: (path) => path.startsWith('/expenses') || path.startsWith('/purchases'), title: 'Cash Book' },
  { match: (path) => path.startsWith('/products'), title: 'Stock Book' },
  { match: (path) => path.startsWith('/billing') || path.startsWith('/invoices'), title: 'Invoice Book' },
  { match: (path) => path.startsWith('/orders'), title: 'Customer Orders' },
  { match: (path) => path.startsWith('/quotations'), title: 'Quotations' },
  { match: (path) => path.startsWith('/deliveries'), title: 'Deliveries' },
  { match: (path) => path.startsWith('/carpenters'), title: 'Carpenter Ledger' },
  { match: (path) => path.startsWith('/reports'), title: 'Reports' },
  { match: (path) => path.startsWith('/settings'), title: 'Settings' },
  { match: (path) => path.startsWith('/custom-orders'), title: 'Custom Manufacture Orders' },
  { match: (path) => path.startsWith('/materials-stock'), title: 'Materials Stock Book' },
  { match: () => true, title: 'Shopbook' },
];

const bottomTabs = [
  { path: '/', label: 'Home', icon: Home, roles: ['ADMIN', 'CASHIER', 'SALESPERSON', 'DELIVERY_STAFF'] },
  { path: '/customers', label: 'Credit Book', icon: WalletCards, roles: ['ADMIN', 'CASHIER', 'SALESPERSON'] },
  { path: '/expenses', label: 'Cash Book', icon: BookOpen, roles: ['ADMIN', 'CASHIER'] },
  { path: '/products', label: 'Stock Book', icon: Box, roles: ['ADMIN', 'CASHIER', 'SALESPERSON'] },
  { path: '/invoices', label: 'Invoice Book', icon: ReceiptText, roles: ['ADMIN', 'CASHIER'] },
];

const mobileModuleLinks = [
  { path: '/billing', label: 'New Invoice (POS)', icon: ShoppingCart, roles: ['ADMIN', 'CASHIER'] },
  { path: '/orders', label: 'Customer Orders', icon: Award, roles: ['ADMIN', 'CASHIER', 'SALESPERSON'] },
  { path: '/quotations', label: 'Quotations', icon: FileMinus, roles: ['ADMIN', 'CASHIER', 'SALESPERSON'] },
  { path: '/deliveries', label: 'Deliveries', icon: Truck, roles: ['ADMIN', 'CASHIER', 'DELIVERY_STAFF'] },
  { path: '/suppliers', label: 'Supplier Ledgers', icon: Briefcase, roles: ['ADMIN'] },
  { path: '/purchases', label: 'Inventory Purchases', icon: DollarSign, roles: ['ADMIN'] },
  { path: '/carpenters', label: 'Carpenter Ledger', icon: Hammer, roles: ['ADMIN', 'CASHIER'] },
  { path: '/reports', label: 'Reports & Profit', icon: FileText, roles: ['ADMIN'] },
  { path: '/settings', label: 'System Settings', icon: Settings, roles: ['ADMIN'] },
];

const desktopMenuItems = [
  {
    path: '/',
    label: 'Dashboard',
    siLabel: 'පාලන පැනලය',
    icon: LayoutDashboard,
    roles: ['ADMIN', 'CASHIER', 'SALESPERSON', 'DELIVERY_STAFF'],
  },
  {
    path: '/billing',
    label: 'New Invoice (POS)',
    siLabel: 'නව බිල්පත (POS)',
    icon: ShoppingCart,
    roles: ['ADMIN', 'CASHIER'],
  },
  {
    path: '/invoices',
    label: 'Invoices List',
    siLabel: 'බිල්පත් ලැයිස්තුව',
    icon: FileText,
    roles: ['ADMIN', 'CASHIER'],
  },
  {
    path: '/quotations',
    label: 'Quotations',
    siLabel: 'මිල ගණන් කැඳවීම්',
    icon: FileMinus,
    roles: ['ADMIN', 'CASHIER', 'SALESPERSON'],
  },
  {
    path: '/custom-orders',
    label: 'Custom Orders',
    siLabel: 'අභිමත ඇණවුම්',
    icon: Wrench,
    roles: ['ADMIN', 'CASHIER', 'SALESPERSON'],
    badge: 'NEW',
  },
  {
    path: '/orders',
    label: 'Customer Orders',
    siLabel: 'පාරිභෝගික ඇණවුම්',
    icon: Award,
    roles: ['ADMIN', 'CASHIER', 'SALESPERSON'],
  },
  {
    path: '/deliveries',
    label: 'Delivery Tracking',
    siLabel: 'බෙදාහැරීම් සොයාබැලීම',
    icon: Truck,
    roles: ['ADMIN', 'CASHIER', 'SALESPERSON', 'DELIVERY_STAFF'],
  },
  {
    path: '/products',
    label: 'Products Stock',
    siLabel: 'නිෂ්පාදන සහ තොග',
    icon: Package,
    roles: ['ADMIN', 'CASHIER', 'SALESPERSON'],
  },
  {
    path: '/materials-stock',
    label: 'Materials Stock',
    siLabel: 'අමුද්‍රව්‍ය තොගය',
    icon: Layers,
    roles: ['ADMIN', 'CASHIER', 'SALESPERSON'],
  },
  {
    path: '/customers',
    label: 'Customer Ledgers',
    siLabel: 'පාරිභෝගික ලෙජරය',
    icon: Users,
    roles: ['ADMIN', 'CASHIER', 'SALESPERSON'],
  },
  {
    path: '/suppliers',
    label: 'Supplier Ledgers',
    siLabel: 'සැපයුම්කරුවන්ගේ ලෙජර',
    icon: Briefcase,
    roles: ['ADMIN'],
  },
  {
    path: '/purchases',
    label: 'Inventory Purchases',
    siLabel: 'තොග මිලදීගැනීම්',
    icon: DollarSign,
    roles: ['ADMIN'],
  },
  {
    path: '/expenses',
    label: 'Shop Expenses',
    siLabel: 'ව්‍යාපාරික වියදම්',
    icon: ShieldAlert,
    roles: ['ADMIN', 'CASHIER'],
  },
  {
    path: '/carpenters',
    label: 'Carpenter Payments',
    siLabel: 'Carpenter Payments',
    icon: Hammer,
    roles: ['ADMIN', 'CASHIER'],
  },
  {
    path: '/reports',
    label: 'Reports & Profit',
    siLabel: 'වාර්තා සහ ලාභය',
    icon: FileText,
    roles: ['ADMIN'],
  },
  {
    path: '/settings',
    label: 'System Settings',
    siLabel: 'පද්ධති සැකසුම්',
    icon: Settings,
    roles: ['ADMIN'],
  },
];

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : true
  );

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const handleChange = (event) => setIsDesktop(event.matches);

    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  return isDesktop;
}

function PageOutlet({ resetKey }) {
  return (
    <PageErrorBoundary resetKey={resetKey}>
      <Outlet />
    </PageErrorBoundary>
  );
}

function useClearNumericInputsOnFocus() {
  useEffect(() => {
    const clearInputValue = (input) => {
      const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      if (valueSetter) {
        valueSetter.call(input, '');
      } else {
        input.value = '';
      }
    };

    const handleFocus = (event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement)) return;
      if (input.disabled || input.readOnly || input.dataset.clearOnFocus === 'false') return;

      const inputType = input.type.toLowerCase();
      const inputMode = input.inputMode.toLowerCase();
      const isNumericField = inputType === 'number' || inputMode === 'decimal' || inputMode === 'numeric';

      if (!isNumericField || input.value === '') return;
      clearInputValue(input);
    };

    document.addEventListener('focusin', handleFocus);
    return () => document.removeEventListener('focusin', handleFocus);
  }, []);
}

function DesktopShell({ lang, toggleLanguage }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const allowedMenuItems = desktopMenuItems.filter((item) => user && item.roles.includes(user.role));
  const translate = (en, si) => (lang === 'en' ? en : si);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div id="app-layout" className="flex h-screen w-screen overflow-hidden bg-stone-100">
      <aside
        className={`no-print fixed inset-y-0 left-0 z-30 flex flex-col overflow-hidden bg-stone-900 text-stone-100 transition-all duration-300 ${
          sidebarOpen ? 'w-64' : 'w-20'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-stone-800 bg-stone-950 px-4">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-wood-650 font-bold text-white shadow-md">
              A
            </div>
            {sidebarOpen && (
              <div className="flex flex-col">
                <span className="text-sm font-bold leading-none tracking-tight text-wood-100">ALIGHT</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Furniture & Timbers</span>
              </div>
            )}
          </div>
          <button className="text-stone-400 hover:text-white lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
          {allowedMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-wood-700 text-white shadow-md shadow-wood-950/40'
                    : 'text-stone-300 hover:bg-stone-800 hover:text-white'
                }`}
              >
                <Icon size={20} className={isActive ? 'text-white' : 'text-stone-400'} />
                {sidebarOpen && (
                  <div className="flex flex-1 items-center justify-between">
                    <span>{translate(item.label, item.siLabel)}</span>
                    {item.badge && (
                      <span className="rounded bg-[#B34A1A] px-1.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider animate-pulse">
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex flex-col gap-2 border-t border-stone-800 bg-stone-950 p-3">
          {sidebarOpen && user && (
            <div className="flex flex-col px-2 py-1.5">
              <span className="text-sm font-semibold leading-none text-stone-100">{user.name}</span>
              <span className="mt-1 text-[11px] font-medium capitalize text-wood-400">{user.role.replace('_', ' ')}</span>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-950/30 hover:text-red-300"
          >
            <LogOut size={20} className="shrink-0" />
            {sidebarOpen && <span>{translate('Logout', 'පද්ධතියෙන් ඉවත් වන්න')}</span>}
          </button>
        </div>
      </aside>

      <div className={`flex flex-1 flex-col overflow-hidden transition-all duration-300 ${sidebarOpen ? 'pl-64' : 'pl-20'}`}>
        <header className="no-print z-25 flex h-16 items-center justify-between border-b border-stone-200 bg-white px-6 shadow-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen((open) => !open)}
              className="rounded-lg p-1.5 text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900"
            >
              <Menu size={22} />
            </button>
            <h1 className="hidden text-lg font-bold text-stone-850 sm:block">
              {translate('Alight Furniture & Timbers Management System', 'ඇලයිට් ෆර්නිචර් සහ ටිම්බර්ස් කළමනාකරණ පද්ධතිය')}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-sm transition-all hover:border-stone-300 hover:bg-stone-100"
              title="Change Language / භාෂාව වෙනස් කරන්න"
            >
              <Languages size={14} className="text-wood-650" />
              <span>{lang === 'en' ? 'සිංහල (SI)' : 'English (EN)'}</span>
            </button>

            {user && (
              <div className="hidden flex-col items-end leading-none md:flex">
                <span className="text-xs font-medium text-stone-400">{translate('Welcome', 'ආයුබෝවන්')}</span>
                <span className="mt-0.5 text-sm font-bold text-stone-800">{user.name}</span>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-stone-100 p-4 lg:p-6">
          <div className="desktop-app-page min-h-full w-full animate-fade-in">
            <PageOutlet resetKey={location.pathname} />
          </div>
        </main>
      </div>
    </div>
  );
}

function MobileShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const title = routeTitles.find((item) => item.match(location.pathname))?.title || 'Shopbook';
  const allowedTabs = bottomTabs.filter((tab) => !user || tab.roles.includes(user.role));
  const allowedModules = mobileModuleLinks.filter((item) => !user || item.roles.includes(user.role));
  const activeTab = (tabPath) => {
    if (tabPath === '/') return location.pathname === '/';
    if (tabPath === '/invoices') return location.pathname.startsWith('/invoices') || location.pathname.startsWith('/billing');
    return location.pathname.startsWith(tabPath);
  };
  const canGoBack = !allowedTabs.some((tab) => activeTab(tab.path));

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div id="app-layout" className="shopbook-shell h-[100dvh] w-screen overflow-hidden bg-white text-[#101828]">
      <header className="shopbook-header no-print">
        <div className="shopbook-title-row">
          <div className="flex min-w-0 items-center gap-4">
            {canGoBack ? (
              <button className="icon-button -ml-1" onClick={() => navigate(-1)} aria-label="Go back">
                <ArrowLeft size={30} strokeWidth={2.8} />
              </button>
            ) : (
              <button className="icon-button profile-button -ml-1" type="button" onClick={() => setSidebarOpen(true)} aria-label="Menu">
                <Menu size={20} strokeWidth={2.4} />
              </button>
            )}
            <h1 className="truncate text-[28px] font-black leading-none tracking-normal text-[#101828] sm:text-[34px]">
              {title}
            </h1>
          </div>

          {location.pathname.startsWith('/invoices') || location.pathname.startsWith('/billing') ? (
            <button className="help-button" type="button">
              <CircleHelp size={25} strokeWidth={2.6} />
              <span>Help</span>
            </button>
          ) : location.pathname.startsWith('/customers') ? (
            <button className="reminder-button" type="button">
              <BellRing size={26} strokeWidth={2.4} />
              <span>Reminders</span>
            </button>
          ) : null}
        </div>
      </header>

      {/* Sidebar Drawer overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex justify-start no-print">
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs transition-opacity duration-300"
            onClick={() => setSidebarOpen(false)}
          />

          {/* Drawer container */}
          <div className="relative flex w-full max-w-xs flex-col bg-white h-full shadow-2xl animate-slide-in-left">
            {/* Header */}
            <div className="flex h-16 items-center justify-between border-b border-stone-150 px-4 bg-stone-50">
              <span className="text-base font-black tracking-normal text-stone-900">Alight Navigation</span>
              <button
                onClick={() => setSidebarOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 shadow-sm cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Profile Section */}
            {user && (
              <div className="flex flex-col border-b border-stone-150 bg-stone-50/50 p-4">
                <span className="text-sm font-black text-stone-900 leading-none">{user.name}</span>
                <span className="mt-1 text-[11px] font-bold capitalize text-blue-600">{user.role.replace('_', ' ')}</span>
              </div>
            )}

            {/* Links List */}
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {allowedModules.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-black transition-all duration-150 ${
                      isActive
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-stone-700 hover:bg-stone-50 hover:text-stone-900'
                    }`}
                  >
                    <Icon size={18} className={isActive ? 'text-blue-700' : 'text-stone-400'} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Footer (Logout) */}
            <div className="border-t border-stone-150 bg-stone-50 p-3">
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-black text-red-700 transition-colors hover:bg-red-100 cursor-pointer"
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      <main className={`shopbook-content route-${location.pathname.replace(/^\/?/, '').replaceAll('/', '-') || 'home'}`}>
        <div className="shopbook-page">
          <PageOutlet resetKey={location.pathname} />
        </div>
      </main>

      <nav className="shopbook-tabs no-print" aria-label="Primary navigation">
        {allowedTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab(tab.path);
          return (
            <Link key={tab.path} to={tab.path} className={`shopbook-tab ${isActive ? 'active' : ''}`}>
              <Icon size={28} strokeWidth={isActive ? 2.7 : 2.3} />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export default function Layout() {
  const [lang, setLang] = useState(localStorage.getItem('alight_lang') || 'en');
  const isDesktop = useIsDesktop();
  useClearNumericInputsOnFocus();

  const toggleLanguage = () => {
    const nextLang = lang === 'en' ? 'si' : 'en';
    setLang(nextLang);
    localStorage.setItem('alight_lang', nextLang);
    window.dispatchEvent(new Event('languageChange'));
  };

  return isDesktop ? (
    <DesktopShell lang={lang} toggleLanguage={toggleLanguage} />
  ) : (
    <MobileShell />
  );
}
