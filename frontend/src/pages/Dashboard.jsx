import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { 
  DollarSign, ShoppingCart, Users, Truck, AlertTriangle, 
  TrendingUp, Calendar, ArrowRight, Activity, Plus, Receipt
} from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [pendingDeliveries, setPendingDeliveries] = useState([]);
  const [overdueInstallments, setOverdueInstallments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState(localStorage.getItem('alight_lang') || 'en');

  // Translation helper
  const translate = (en, si) => (lang === 'en' ? en : si);

  useEffect(() => {
    const handleLangChange = () => {
      setLang(localStorage.getItem('alight_lang') || 'en');
    };
    window.addEventListener('languageChange', handleLangChange);
    return () => window.removeEventListener('languageChange', handleLangChange);
  }, []);

  useEffect(() => {
    async function fetchDashboardData() {
      setLoading(true);
      try {
        const statsRes = await api.get('/dashboard');
        setStats(statsRes.data);

        // Fetch low stock items
        const stockRes = await api.get('/products?lowStock=true');
        setLowStockProducts(stockRes.data.slice(0, 5));

        // Fetch pending deliveries
        const deliveryRes = await api.get('/deliveries?deliveryStatus=Pending');
        setPendingDeliveries(deliveryRes.data.slice(0, 5));

        // Fetch overdue installments
        const overdueRes = await api.get('/payments/overdue');
        setOverdueInstallments(overdueRes.data.slice(0, 5));

      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-wood-300 border-t-wood-650"></div>
      </div>
    );
  }

  const statCards = [
    {
      title: translate("Today's Sales", "අද දින විකුණුම්"),
      value: `Rs. ${stats?.todaySales?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '0.00'}`,
      icon: TrendingUp,
      color: 'bg-green-500 text-white',
      roles: ['ADMIN', 'CASHIER'],
    },
    {
      title: translate("Cash Received (Today)", "අද ලැබුණු මුදල් (මුදලින්)"),
      value: `Rs. ${stats?.todayCashReceived?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '0.00'}`,
      icon: DollarSign,
      color: 'bg-wood-550 text-white',
      roles: ['ADMIN', 'CASHIER'],
    },
    {
      title: translate("Card/Bank Received (Today)", "අද ලැබුණු මුදල් (කාඩ්/බැංකු)"),
      value: `Rs. ${stats?.todayCardBankReceived?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '0.00'}`,
      icon: Receipt,
      color: 'bg-blue-500 text-white',
      roles: ['ADMIN', 'CASHIER'],
    },
    {
      title: translate("Outstanding Receivables", "පාරිභෝගිකයින්ගෙන් ලැබීමට ඇති මුදල්"),
      value: `Rs. ${stats?.pendingCustomerPayments?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '0.00'}`,
      icon: Users,
      color: 'bg-orange-500 text-white',
      roles: ['ADMIN', 'CASHIER'],
    },
    {
      title: translate("Pending Orders", "ක්‍රියාත්මක වන ඇණවුම්"),
      value: stats?.pendingOrdersCount || 0,
      icon: ShoppingCart,
      color: 'bg-indigo-500 text-white',
      roles: ['ADMIN', 'CASHIER'],
    },
    {
      title: translate("Pending Deliveries", "බෙදාහැරීමට ඇති ඇණවුම්"),
      value: stats?.pendingDeliveriesCount || 0,
      icon: Truck,
      color: 'bg-amber-500 text-white',
      roles: ['ADMIN', 'CASHIER'],
    },
    {
      title: translate("Low Stock Items", "අඩු තොග අනතුරු ඇඟවීම්"),
      value: stats?.lowStockCount || 0,
      icon: AlertTriangle,
      color: stats?.lowStockCount > 0 ? 'bg-red-500 text-white animate-pulse' : 'bg-stone-500 text-white',
      roles: ['ADMIN', 'CASHIER'],
    },
    {
      title: translate("Total Stock Value", "මුළු තොගයේ වටිනාකම"),
      value: `Rs. ${stats?.totalStockValue?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '0.00'}`,
      icon: DollarSign,
      color: 'bg-stone-700 text-white',
      roles: ['ADMIN'],
    },
    {
      title: translate("Monthly Profit/Loss", "මාසික ලාභ / අලාභය"),
      value: `Rs. ${stats?.monthlyProfitLoss?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '0.00'}`,
      icon: TrendingUp,
      color: stats?.monthlyProfitLoss >= 0 ? 'bg-forest-650 text-white' : 'bg-red-600 text-white',
      roles: ['ADMIN'],
    }
  ];

  const allowedCards = statCards.filter(card => user && card.roles.includes(card.role || user.role));

  return (
    <div className="space-y-8">
      {/* WELCOME BANNER */}
      <div className="relative overflow-hidden rounded-2xl bg-stone-900 px-8 py-8 text-white shadow-lg" style={{ backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.85), rgba(0,0,0,0.4)), url('/banner.png')`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="relative z-10 space-y-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-wood-600 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
            <Activity size={12} /> Live POS Client
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">
            {translate("Alight Furniture & Timbers", "ඇලයිට් ෆර්නිචර් සහ ටිම්බර්ස්")}
          </h2>
          <p className="max-w-xl text-stone-300 text-sm">
            {translate(
              "Welcome to the management dashboard. You can create invoices, manage reservation orders, check ledger debts, track dispatches, and audit product stocks from this interface.",
              "කළමනාකරණ පද්ධතිය වෙත සාදරයෙන් පිළිගනිමු. මෙමඟින් බිල්පත් සෑදීම, ඇණවුම් පාලනය, ගිණුම් වාර්තා, බෙදාහැරීම් සහ නිෂ්පාදන තොග කළමනාකරණය කළ හැක."
            )}
          </p>
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Link
          to="/billing"
          className="flex flex-col items-center justify-center p-4 rounded-xl bg-white border border-stone-200 hover:border-wood-500 shadow-sm hover:shadow-md transition-all text-center group"
        >
          <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-wood-50 text-wood-600 group-hover:bg-wood-600 group-hover:text-white transition-colors mb-2">
            <Plus size={20} />
          </div>
          <span className="text-xs font-bold text-stone-700">{translate("New Invoice", "නව බිල්පතක්")}</span>
        </Link>

        <Link
          to="/orders"
          className="flex flex-col items-center justify-center p-4 rounded-xl bg-white border border-stone-200 hover:border-wood-500 shadow-sm hover:shadow-md transition-all text-center group"
        >
          <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-650 group-hover:text-white transition-colors mb-2">
            <Plus size={20} />
          </div>
          <span className="text-xs font-bold text-stone-700">{translate("Create Order", "නව ඇණවුමක්")}</span>
        </Link>

        <Link
          to="/customers"
          className="flex flex-col items-center justify-center p-4 rounded-xl bg-white border border-stone-200 hover:border-wood-500 shadow-sm hover:shadow-md transition-all text-center group"
        >
          <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-forest-50 text-forest-600 group-hover:bg-forest-600 group-hover:text-white transition-colors mb-2">
            <Users size={20} />
          </div>
          <span className="text-xs font-bold text-stone-700">{translate("Customer Ledger", "පාරිභෝගික ගිණුම්")}</span>
        </Link>

        <Link
          to="/products"
          className="flex flex-col items-center justify-center p-4 rounded-xl bg-white border border-stone-200 hover:border-wood-500 shadow-sm hover:shadow-md transition-all text-center group"
        >
          <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors mb-2">
            <AlertTriangle size={20} />
          </div>
          <span className="text-xs font-bold text-stone-700">{translate("Check Stock Alerts", "තොග අනතුරු ඇඟවීම්")}</span>
        </Link>
      </div>

      {/* STATS GRID */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {allowedCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div key={idx} className="glass-card rounded-xl p-6 flex items-center justify-between">
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">{card.title}</span>
                <p className="text-2xl font-black text-stone-800">{card.value}</p>
              </div>
              <div className={`h-12 w-12 flex items-center justify-center rounded-xl ${card.color}`}>
                <Icon size={24} />
              </div>
            </div>
          );
        })}
      </div>

      {/* DETAILED LOGS GRID */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* LOW STOCK ITEMS WARNING PANEL */}
        <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-stone-100">
            <h3 className="font-extrabold text-stone-800 text-sm uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="text-red-500 animate-bounce" size={18} />
              {translate("Critical Low Stock Alerts", "තීරණාත්මක අඩු තොග මට්ටම්")}
            </h3>
            <Link to="/products" className="text-xs font-bold text-wood-650 hover:underline flex items-center gap-1">
              {translate("View All", "සියල්ල බලන්න")} <ArrowRight size={14} />
            </Link>
          </div>
          <div className="mt-4 divide-y divide-stone-100">
            {lowStockProducts.length === 0 ? (
              <p className="py-4 text-center text-xs text-stone-400 font-medium">
                {translate("All products are fully stocked / සියලුම නිෂ්පාදන සතුටුදායක තොග මට්ටමක පවතී.", "All products are fully stocked")}
              </p>
            ) : (
              lowStockProducts.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-3">
                  <div>
                    <h4 className="text-sm font-bold text-stone-800">{p.name}</h4>
                    <span className="text-xs text-stone-400 font-semibold">SKU: {p.code} | {p.category?.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-bold text-red-600">
                      {p.stockQty} Qty
                    </span>
                    <p className="text-[10px] text-stone-400 font-medium mt-1">Alert limit: {p.minStockAlert}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* PENDING DELIVERIES */}
        <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-stone-100">
            <h3 className="font-extrabold text-stone-800 text-sm uppercase tracking-wider flex items-center gap-2">
              <Truck className="text-amber-500" size={18} />
              {translate("Upcoming Dispatches / Deliveries", "ඉදිරි බෙදාහැරීම්")}
            </h3>
            <Link to="/deliveries" className="text-xs font-bold text-wood-650 hover:underline flex items-center gap-1">
              {translate("View All", "සියල්ල බලන්න")} <ArrowRight size={14} />
            </Link>
          </div>
          <div className="mt-4 divide-y divide-stone-100">
            {pendingDeliveries.length === 0 ? (
              <p className="py-4 text-center text-xs text-stone-400 font-medium">
                {translate("No pending deliveries scheduled / බෙදාහැරීමට නියමිත ඇණවුම් කිසිවක් නැත.", "No pending deliveries scheduled")}
              </p>
            ) : (
              pendingDeliveries.map((d) => (
                <div key={d.id} className="flex items-center justify-between py-3">
                  <div>
                    <h4 className="text-sm font-bold text-stone-800">{d.customerName}</h4>
                    <p className="text-xs text-stone-400 font-semibold truncate max-w-xs">{d.address}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-stone-700 block">
                      {new Date(d.deliveryDate).toLocaleDateString()}
                    </span>
                    <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 mt-1 uppercase">
                      {d.deliveryStatus}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* OVERDUE INSTALLMENTS */}
        <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between pb-4 border-b border-stone-100">
            <h3 className="font-extrabold text-stone-850 text-sm uppercase tracking-wider flex items-center gap-2">
              <Calendar className="text-red-500" size={18} />
              {translate("Overdue Installments & Outstanding Customer Debts", "පසුගිය වාරික සහ ගෙවීම් පැහැරහැරීම්")}
            </h3>
            <Link to="/customers" className="text-xs font-bold text-wood-650 hover:underline flex items-center gap-1">
              {translate("View Ledgers", "ලෙජර බලන්න")} <ArrowRight size={14} />
            </Link>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-stone-50 text-stone-400 font-bold uppercase tracking-wider border-b border-stone-150">
                  <th className="p-3">{translate("Customer Name", "පාරිභෝගික නම")}</th>
                  <th className="p-3">{translate("Invoice / Order No", "බිල්පත් / ඇණවුම් අංකය")}</th>
                  <th className="p-3 text-right">{translate("Installment Amount", "වාරික මුදල")}</th>
                  <th className="p-3">{translate("Due Date", "ගෙවිය යුතු දිනය")}</th>
                  <th className="p-3">{translate("Status", "තත්ත්වය")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-medium">
                {overdueInstallments.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-4 text-center text-stone-400 font-medium">
                      {translate("No overdue installments found / හිඟ වාරික කිසිවක් හමු නොවීය.", "No overdue installments found")}
                    </td>
                  </tr>
                ) : (
                  overdueInstallments.map((inst) => (
                    <tr key={inst.id} className="hover:bg-stone-50">
                      <td className="p-3 font-bold text-stone-800">{inst.customer?.name}</td>
                      <td className="p-3 text-stone-500 font-semibold">{inst.invoice?.invoiceNumber || inst.order?.orderNumber || 'N/A'}</td>
                      <td className="p-3 text-right font-black text-red-600">Rs. {inst.installmentAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      <td className="p-3 text-stone-400">{new Date(inst.dueDate).toLocaleDateString()}</td>
                      <td className="p-3">
                        <span className="inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-[10px] font-bold text-red-750 uppercase">
                          {inst.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
