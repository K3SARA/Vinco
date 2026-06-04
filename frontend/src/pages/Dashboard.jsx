import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { canAccess, ROLE_GROUPS } from '../utils/roles';
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  BarChart3,
  BookOpen,
  Briefcase,
  CreditCard,
  FileText,
  Hammer,
  Package,
  ReceiptText,
  RefreshCw,
  ShoppingCart,
  Truck,
  Users,
  WalletCards,
} from 'lucide-react';

const emptyStats = {
  todaySales: 0,
  todayCashReceived: 0,
  todayCardBankReceived: 0,
  pendingOrdersCount: 0,
  pendingDeliveriesCount: 0,
  pendingCustomerPayments: 0,
  lowStockCount: 0,
  totalStockValue: 0,
  monthlySales: 0,
  monthlyProfitLoss: 0,
  monthlyCarpenterPayments: 0,
  monthlyCarpenterCredits: 0,
  monthlyCarpenterNetExpense: 0,
  totalReceivables: 0,
  totalPayables: 0,
};

const formatMoney = (value) =>
  `Rs. ${Number(value || 0).toLocaleString('en-US', {
    maximumFractionDigits: 2,
  })}`;

const formatNumber = (value) => Number(value || 0).toLocaleString('en-US');

const getTone = (id) => {
  const sales = ['Today Sales', 'Cash Received', 'Card / Bank', 'Pending Orders', '/billing', '/invoices', '/orders'];
  const stock = ['Low Stock', 'Pending Deliveries', '/products', '/deliveries'];
  const finance = ['Receivables', 'Supplier Payables', 'Monthly Profit', '/customers', '/suppliers', '/expenses', '/carpenters', '/reports'];
  
  if (sales.includes(id)) return 'blue';
  if (stock.includes(id)) return 'amber';
  if (finance.includes(id)) return 'green';
  return 'stone';
};

const metricToneClasses = {
  blue: 'border-blue-100/80 bg-gradient-to-br from-blue-50/70 to-blue-50/40 text-blue-700 shadow-xs rounded-xl',
  green: 'border-emerald-100/80 bg-gradient-to-br from-emerald-50/70 to-emerald-50/40 text-emerald-700 shadow-xs rounded-xl',
  amber: 'border-amber-100/80 bg-gradient-to-br from-amber-50/70 to-amber-50/40 text-amber-700 shadow-xs rounded-xl',
  red: 'border-red-100/80 bg-gradient-to-br from-red-50/70 to-red-50/40 text-red-700 shadow-xs rounded-xl',
  stone: 'border-stone-100/80 bg-white text-stone-800 shadow-xs rounded-xl',
};

const moduleToneClasses = {
  blue: 'border-blue-100/80 bg-gradient-to-br from-blue-50/70 to-blue-50/40 text-blue-700 hover:border-blue-200 shadow-xs rounded-xl',
  green: 'border-emerald-100/80 bg-gradient-to-br from-emerald-50/70 to-emerald-50/40 text-emerald-700 hover:border-emerald-200 shadow-xs rounded-xl',
  amber: 'border-amber-100/80 bg-gradient-to-br from-amber-50/70 to-amber-50/40 text-amber-700 hover:border-amber-200 shadow-xs rounded-xl',
  red: 'border-red-100/80 bg-gradient-to-br from-red-50/70 to-red-50/40 text-red-700 hover:border-red-200 shadow-xs rounded-xl',
  violet: 'border-violet-100/80 bg-gradient-to-br from-violet-50/70 to-violet-50/40 text-violet-700 hover:border-violet-200 shadow-xs rounded-xl',
  cyan: 'border-cyan-100/80 bg-gradient-to-br from-cyan-50/70 to-cyan-50/40 text-cyan-700 hover:border-cyan-200 shadow-xs rounded-xl',
  stone: 'border-stone-100/80 bg-white text-stone-800 hover:border-stone-200 shadow-xs rounded-xl',
};

function MetricTile({ label, value, icon: Icon, tone = 'stone' }) {
  return (
    <article className={`rounded-xl border p-5 sm:p-6 shadow-xs ${metricToneClasses[tone] || metricToneClasses.stone}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wide opacity-70 truncate">{label}</p>
          <strong className="mt-2 block break-words text-lg sm:text-2xl md:text-3xl font-black leading-tight text-stone-950">
            {value}
          </strong>
        </div>
        <div className="flex h-10 w-10 sm:h-12 sm:w-12 flex-none items-center justify-center rounded-xl bg-white/90 border border-stone-100/50 shadow-xs">
          <Icon size={20} className="sm:w-[24px] sm:h-[24px]" />
        </div>
      </div>
    </article>
  );
}

function ModuleLink({ item }) {
  const Icon = item.icon;

  return (
    <Link
      to={item.path}
      className={`group flex items-center justify-between rounded-xl border p-5 sm:p-6 shadow-xs transition-all ${moduleToneClasses[item.tone] || moduleToneClasses.stone}`}
    >
      <div className="flex items-center gap-4 min-w-0">
        <div className="flex h-10 w-10 sm:h-12 sm:w-12 flex-none items-center justify-center rounded-xl bg-white/90 border border-stone-100/50 shadow-xs">
          <Icon size={20} className="sm:w-[24px] sm:h-[24px]" strokeWidth={2.4} />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm sm:text-base font-black leading-tight text-stone-950 truncate">{item.label}</h3>
          <p className="mt-1 text-[11px] sm:text-xs font-bold opacity-75">{item.metric}</p>
        </div>
      </div>
      <ArrowRight size={18} className="opacity-55 transition-transform group-hover:translate-x-0.5 flex-none" />
    </Link>
  );
}

function LoadingTile() {
  return (
    <article className="rounded-xl border border-stone-100 bg-white p-5 sm:p-6 shadow-xs">
      <div className="h-3 w-16 sm:h-3 sm:w-24 animate-pulse rounded bg-stone-200" />
      <div className="mt-3.5 h-7 w-24 sm:h-9 sm:w-36 animate-pulse rounded bg-stone-200" />
    </article>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(emptyStats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await api.get('/dashboard', { cache: false });
      setStats({ ...emptyStats, ...(response.data || {}) });
    } catch (err) {
      console.error('Dashboard load failed:', err);
      setError(err.response?.data?.error || 'Failed to load live dashboard data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialDashboard() {
      try {
        const response = await api.get('/dashboard', { cache: false });
        if (cancelled) return;
        setStats({ ...emptyStats, ...(response.data || {}) });
        setError('');
      } catch (err) {
        if (cancelled) return;
        console.error('Dashboard load failed:', err);
        setError(err.response?.data?.error || 'Failed to load live dashboard data.');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadInitialDashboard();
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleMetrics = useMemo(() => {
    const metrics = [
      {
        label: 'Today Sales',
        value: formatMoney(stats.todaySales),
        icon: ReceiptText,
        tone: 'green',
        caption: 'Non-cancelled invoices for today',
        roles: ROLE_GROUPS.CASH_DESK,
      },
      {
        label: 'Cash Received',
        value: formatMoney(stats.todayCashReceived),
        icon: Banknote,
        tone: 'green',
        caption: 'Cash payments logged today',
        roles: ROLE_GROUPS.CASH_DESK,
      },
      {
        label: 'Card / Bank',
        value: formatMoney(stats.todayCardBankReceived),
        icon: CreditCard,
        tone: 'blue',
        caption: 'Non-cash payments logged today',
        roles: ROLE_GROUPS.CASH_DESK,
      },
      {
        label: 'Receivables',
        value: formatMoney(stats.totalReceivables),
        icon: WalletCards,
        tone: 'red',
        caption: `${formatMoney(stats.pendingCustomerPayments)} pending on invoices`,
        roles: ROLE_GROUPS.SALES_DESK,
      },
      {
        label: 'Pending Orders',
        value: formatNumber(stats.pendingOrdersCount),
        icon: ShoppingCart,
        tone: 'amber',
        caption: 'Orders not completed or cancelled',
        roles: ROLE_GROUPS.SALES_DESK,
      },
      {
        label: 'Pending Deliveries',
        value: formatNumber(stats.pendingDeliveriesCount),
        icon: Truck,
        tone: 'blue',
        caption: 'Delivery jobs still in progress',
        roles: ROLE_GROUPS.DELIVERY_DESK,
      },
      {
        label: 'Low Stock',
        value: formatNumber(stats.lowStockCount),
        icon: AlertTriangle,
        tone: stats.lowStockCount > 0 ? 'red' : 'green',
        caption: canAccess(user, ROLE_GROUPS.ADMIN_ONLY)
          ? `${formatMoney(stats.totalStockValue)} current stock value`
          : 'Products at or below alert level',
        roles: ROLE_GROUPS.SALES_DESK,
      },
      {
        label: 'Monthly Profit',
        value: formatMoney(stats.monthlyProfitLoss),
        icon: BarChart3,
        tone: stats.monthlyProfitLoss < 0 ? 'red' : 'green',
        caption: `${formatMoney(stats.monthlySales)} monthly sales`,
        roles: ROLE_GROUPS.ADMIN_ONLY,
      },
      {
        label: 'Supplier Payables',
        value: formatMoney(stats.totalPayables),
        icon: Briefcase,
        tone: 'amber',
        caption: 'Outstanding supplier balances',
        roles: ROLE_GROUPS.ADMIN_ONLY,
      },
    ];

    return metrics
      .filter((metric) => canAccess(user, metric.roles))
      .map((m) => ({ ...m, tone: getTone(m.label) }));
  }, [stats, user]);

  const visibleModules = useMemo(() => {
    const modules = [
      {
        path: '/billing',
        label: 'New Invoice',
        description: 'Create a POS bill',
        metric: formatMoney(stats.todaySales),
        icon: ShoppingCart,
        tone: 'green',
        roles: ROLE_GROUPS.CASH_DESK,
      },
      {
        path: '/invoices',
        label: 'Invoice Book',
        description: 'Payments, print and audit',
        metric: `${formatMoney(stats.pendingCustomerPayments)} pending`,
        icon: FileText,
        tone: 'blue',
        roles: ROLE_GROUPS.CASH_DESK,
      },
      {
        path: '/customers',
        label: 'Customer Ledgers',
        description: 'Balances and collections',
        metric: formatMoney(stats.totalReceivables),
        icon: Users,
        tone: 'red',
        roles: ROLE_GROUPS.SALES_DESK,
      },
      {
        path: '/products',
        label: 'Stock Book',
        description: 'Products and low stock',
        metric: `${formatNumber(stats.lowStockCount)} low stock`,
        icon: Package,
        tone: stats.lowStockCount > 0 ? 'red' : 'amber',
        roles: ROLE_GROUPS.SALES_DESK,
      },
      {
        path: '/orders',
        label: 'Customer Orders',
        description: 'Reservations and conversion',
        metric: `${formatNumber(stats.pendingOrdersCount)} pending`,
        icon: BookOpen,
        tone: 'amber',
        roles: ROLE_GROUPS.SALES_DESK,
      },
      {
        path: '/deliveries',
        label: 'Deliveries',
        description: 'Dispatch and status updates',
        metric: `${formatNumber(stats.pendingDeliveriesCount)} active`,
        icon: Truck,
        tone: 'cyan',
        roles: ROLE_GROUPS.DELIVERY_DESK,
      },
      {
        path: '/suppliers',
        label: 'Supplier Ledgers',
        description: 'Payables and supplier payments',
        metric: formatMoney(stats.totalPayables),
        icon: Briefcase,
        tone: 'violet',
        roles: ROLE_GROUPS.ADMIN_ONLY,
      },
      {
        path: '/expenses',
        label: 'Shop Expenses',
        description: 'Overheads and carpenter costs',
        metric: `${formatMoney(stats.monthlyCarpenterNetExpense)} carpenter net`,
        icon: Banknote,
        tone: 'stone',
        roles: ROLE_GROUPS.CASH_DESK,
      },
      {
        path: '/carpenters',
        label: 'Carpenter Ledger',
        description: 'Worker payments and history',
        metric: `${formatMoney(stats.monthlyCarpenterNetExpense)} net this month`,
        icon: Hammer,
        tone: 'amber',
        roles: ROLE_GROUPS.CASH_DESK,
      },
      {
        path: '/reports',
        label: 'Reports',
        description: 'Sales, stock and profit',
        metric: formatMoney(stats.monthlyProfitLoss),
        icon: BarChart3,
        tone: 'green',
        roles: ROLE_GROUPS.ADMIN_ONLY,
      },
    ];

    return modules
      .filter((module) => canAccess(user, module.roles))
      .map((m) => ({ ...m, tone: getTone(m.path) }));
  }, [stats, user]);

  const allowedTabs = useMemo(() => {
    const rawTabs = [
      {
        id: 'all',
        label: 'Overview',
        shortLabel: 'Overview',
        icon: BarChart3,
        metrics: [],
        modules: [],
      },
      {
        id: 'sales',
        label: 'Sales & POS',
        shortLabel: 'Sales',
        icon: ShoppingCart,
        metrics: ['Today Sales', 'Cash Received', 'Card / Bank', 'Pending Orders'],
        modules: ['/billing', '/invoices', '/orders'],
      },
      {
        id: 'stock',
        label: 'Stock & Deliveries',
        shortLabel: 'Stock',
        icon: Package,
        metrics: ['Low Stock', 'Pending Deliveries'],
        modules: ['/products', '/deliveries'],
      },
      {
        id: 'finance',
        label: 'Accounts & Finance',
        shortLabel: 'Accounts',
        icon: WalletCards,
        metrics: ['Receivables', 'Supplier Payables', 'Monthly Profit'],
        modules: ['/customers', '/suppliers', '/expenses', '/carpenters', '/reports'],
      },
    ];

    return rawTabs.filter((tab) => {
      if (tab.id === 'all') return true;
      const hasMetric = visibleMetrics.some((m) => tab.metrics.includes(m.label));
      const hasModule = visibleModules.some((m) => tab.modules.includes(m.path));
      return hasMetric || hasModule;
    });
  }, [visibleMetrics, visibleModules]);

  const [activeTabId, setActiveTabId] = useState('all');

  useEffect(() => {
    const isMobile = window.innerWidth < 640;
    if (isMobile) {
      setActiveTabId('sales');
    } else {
      setActiveTabId('all');
    }
  }, []);

  useEffect(() => {
    if (allowedTabs.length > 0 && !allowedTabs.some((t) => t.id === activeTabId)) {
      setActiveTabId(allowedTabs[0].id);
    }
  }, [allowedTabs, activeTabId]);

  const currentTab = allowedTabs.find((t) => t.id === activeTabId);

  const displayedMetrics = useMemo(() => {
    if (!currentTab) return [];
    if (currentTab.id === 'all') return visibleMetrics;
    return visibleMetrics.filter((m) => currentTab.metrics.includes(m.label));
  }, [currentTab, visibleMetrics]);

  const displayedModules = useMemo(() => {
    if (!currentTab) return [];
    if (currentTab.id === 'all') return visibleModules;
    return visibleModules.filter((m) => currentTab.modules.includes(m.path));
  }, [currentTab, visibleModules]);

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-[#f6f7fb] p-3 sm:p-5">
      <div className="mx-auto flex w-full max-w-none flex-col gap-7 sm:gap-9 animate-fade-in">
        <header className="flex flex-col gap-3 rounded-lg border border-stone-100 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">Live Dashboard</p>
            <h1 className="mt-1 text-2xl font-black tracking-normal text-stone-950 sm:text-3xl">
              Alight Furniture Overview
            </h1>
            <p className="mt-1 text-sm font-semibold text-stone-500">
              Current sales, balances, stock alerts, and delivery workload.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadDashboard()}
            disabled={loading}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-stone-950 px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </header>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        {/* Tab switcher */}
        <div className="flex border border-stone-200 bg-white p-1 rounded-xl shadow-sm gap-1">
          {allowedTabs.map((tab) => {
            const TabIcon = tab.icon;
            const isActive = tab.id === activeTabId;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTabId(tab.id)}
                className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-2 px-1.5 sm:py-3 sm:px-3 rounded-lg text-[10px] sm:text-sm font-black transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
                } ${tab.id === 'all' ? 'hidden sm:flex' : 'flex'}`}
              >
                <TabIcon size={15} className="sm:w-[17px] sm:h-[17px]" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
              </button>
            );
          })}
        </div>

        {/* Metrics Grid */}
        <div className="flex flex-col gap-2">
          <h2 className="text-[11px] font-black uppercase tracking-wider text-stone-400 px-1">
            {currentTab?.id === 'all' ? 'Key Metrics' : `${currentTab?.label} Stats`}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {loading
              ? Array.from({ length: currentTab?.id === 'all' ? 6 : Math.max(2, displayedMetrics.length) }).map((_, index) => <LoadingTile key={index} />)
              : displayedMetrics.map((metric) => <MetricTile key={metric.label} {...metric} />)}
          </div>
          {!loading && displayedMetrics.length === 0 && (
            <p className="text-sm font-medium text-stone-500 py-4 text-center bg-white rounded-lg border border-stone-100">
              No metrics available for this section.
            </p>
          )}
        </div>

        {/* Modules Grid */}
        <div className="flex flex-col gap-2">
          <h2 className="text-[11px] font-black uppercase tracking-wider text-stone-400 px-1">
            {currentTab?.id === 'all' ? 'Quick Actions' : `${currentTab?.label} Actions`}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {displayedModules.map((item) => (
              <ModuleLink key={item.path} item={item} />
            ))}
          </div>
          {displayedModules.length === 0 && (
            <p className="text-sm font-medium text-stone-500 py-4 text-center bg-white rounded-lg border border-stone-100">
              No actions available for this section.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
