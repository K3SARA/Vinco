import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  FileText, TrendingUp, TrendingDown, DollarSign, Calendar, 
  Award, BarChart3, PieChart, Landmark
} from 'lucide-react';

export default function Reports() {
  const { user } = useAuth();
  
  const [reportsData, setReportsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState(localStorage.getItem('alight_lang') || 'en');

  // Date range filters
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const translate = (en, si) => (lang === 'en' ? en : si);

  useEffect(() => {
    const handleLangChange = () => setLang(localStorage.getItem('alight_lang') || 'en');
    window.addEventListener('languageChange', handleLangChange);
    return () => window.removeEventListener('languageChange', handleLangChange);
  }, []);

  const loadReports = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/reports/summary?startDate=${startDate}&endDate=${endDate}`);
      setReportsData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [startDate, endDate]);

  if (loading || !reportsData) {
    return (
      <div className="flex h-64 items-center justify-center">
        <span className="text-xs font-bold text-stone-400">Computing ledger statements, analyzing analytics...</span>
      </div>
    );
  }

  const {
    revenue,
    costOfGoodsSold,
    operatingExpenses,
    grossProfit,
    netProfit,
    receivablesCollected,
    totalOutstandingReceivables,
    totalOutstandingPayables,
    salesByMethod,
    topSellingProducts
  } = reportsData;

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-stone-850 flex items-center gap-2">
            <BarChart3 size={22} className="text-wood-650" />
            {translate("Business Analytics & Profitability Reports", "කාර්ය සාධන සහ ලාභ අලාභ වාර්තා")}
          </h2>
          <p className="text-xs text-stone-400 font-semibold mt-1">
            {translate("Detailed financial statement auditing, product margins analysis, receivables, and operating overheads logs.", "පිරිවැය, ලැබීම්, මෙහෙයුම් වියදම් සහ ශුද්ධ ලාභය ගණනය කිරීම්.")}
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg border border-stone-200 px-3 py-1.5 bg-stone-50 text-stone-700"
          />
          <span className="text-stone-400">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-lg border border-stone-200 px-3 py-1.5 bg-stone-50 text-stone-700"
          />
        </div>
      </div>

      {/* KPI STAT CARDS */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* REVENUE */}
        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm">
          <div className="flex justify-between items-center text-stone-400">
            <span className="text-xs font-bold uppercase tracking-wider">Gross Revenue</span>
            <TrendingUp size={20} className="text-emerald-500" />
          </div>
          <p className="text-xl font-black text-stone-850 mt-2.5">
            Rs. {revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-stone-400 font-medium">Invoiced sales within range</span>
        </div>

        {/* COST OF GOODS SOLD */}
        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm">
          <div className="flex justify-between items-center text-stone-400">
            <span className="text-xs font-bold uppercase tracking-wider">Cost of Goods Sold (COGS)</span>
            <TrendingDown size={20} className="text-red-500" />
          </div>
          <p className="text-xl font-black text-stone-850 mt-2.5">
            Rs. {costOfGoodsSold.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-stone-400 font-medium">Purchase cost of sold stock</span>
        </div>

        {/* EXPENSES */}
        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm">
          <div className="flex justify-between items-center text-stone-400">
            <span className="text-xs font-bold uppercase tracking-wider">Operating Expenses</span>
            <DollarSign size={20} className="text-red-400" />
          </div>
          <p className="text-xl font-black text-stone-850 mt-2.5">
            Rs. {operatingExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-stone-400 font-medium">Shop overheads and bills</span>
        </div>

        {/* NET PROFIT */}
        <div className={`p-5 rounded-xl border shadow-sm ${
          netProfit >= 0 ? 'bg-emerald-50/30 border-emerald-100' : 'bg-red-50/30 border-red-100'
        }`}>
          <div className="flex justify-between items-center text-stone-400">
            <span className="text-xs font-bold uppercase tracking-wider">Net Profit</span>
            <TrendingUp size={20} className={netProfit >= 0 ? 'text-emerald-650' : 'text-red-650'} />
          </div>
          <p className={`text-xl font-black mt-2.5 ${netProfit >= 0 ? 'text-emerald-700' : 'text-red-750'}`}>
            Rs. {netProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-stone-400 font-medium">Revenue - COGS - Expenses</span>
        </div>
      </div>

      {/* CORE FINANCIAL STATEMENT AND CHARTS */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        
        {/* PROFIT AND LOSS STATEMENT SHEET */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-stone-200 shadow-sm space-y-4">
          <h3 className="font-extrabold text-stone-850 text-xs uppercase tracking-wide flex items-center gap-1.5 border-b border-stone-100 pb-3">
            <FileText size={16} className="text-wood-655" />
            Financial Statement Summary
          </h3>

          <div className="divide-y divide-stone-100 text-xs font-semibold text-stone-600">
            <div className="py-2.5 flex justify-between">
              <span>Gross Sales Revenue (A):</span>
              <span className="text-stone-850 font-bold">Rs. {revenue.toLocaleString()}</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span>Less: Cost of Goods Sold (B):</span>
              <span className="text-red-600">Rs. {costOfGoodsSold.toLocaleString()}</span>
            </div>
            <div className="py-2.5 flex justify-between bg-stone-50/50 px-2 rounded font-extrabold text-stone-850">
              <span>Gross Profit (C = A - B):</span>
              <span>Rs. {grossProfit.toLocaleString()}</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span>Less: Operating Expenses (D):</span>
              <span className="text-red-600">Rs. {operatingExpenses.toLocaleString()}</span>
            </div>
            <div className="py-3 flex justify-between border-t-2 border-stone-200 bg-stone-100 px-2.5 rounded-lg text-sm font-black text-stone-900">
              <span>Net Profit (E = C - D):</span>
              <span className={netProfit >= 0 ? 'text-emerald-750' : 'text-red-750'}>
                Rs. {netProfit.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-stone-100 text-xs font-semibold">
            <div className="p-3 bg-stone-50 border border-stone-150 rounded-lg">
              <span className="text-[10px] text-stone-450 block uppercase font-bold">Outstanding Receivables</span>
              <span className="text-sm font-black text-red-650 mt-1 block">Rs. {totalOutstandingReceivables.toLocaleString()}</span>
              <span className="text-[9px] text-stone-400 font-medium">Customer credit books</span>
            </div>
            <div className="p-3 bg-stone-50 border border-stone-150 rounded-lg">
              <span className="text-[10px] text-stone-450 block uppercase font-bold">Outstanding Payables</span>
              <span className="text-sm font-black text-red-650 mt-1 block">Rs. {totalOutstandingPayables.toLocaleString()}</span>
              <span className="text-[9px] text-stone-400 font-medium">Timber supplier liabilities</span>
            </div>
          </div>
        </div>

        {/* PAYMENT METHODS & HIGHLIGHTS */}
        <div className="space-y-6">
          
          <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm space-y-4">
            <h3 className="font-extrabold text-stone-850 text-xs uppercase tracking-wide flex items-center gap-1.5">
              <PieChart size={16} className="text-wood-655" />
              Cash Flow Breakdown
            </h3>

            <div className="space-y-2.5 text-xs font-semibold text-stone-600">
              {salesByMethod.map((item) => (
                <div key={item.paymentMethod} className="flex justify-between items-center p-2 bg-stone-50 border border-stone-150/40 rounded">
                  <span>{item.paymentMethod}</span>
                  <span className="font-bold text-stone-850">Rs. {item._sum.paidAmount?.toLocaleString() || 0}</span>
                </div>
              ))}
              {salesByMethod.length === 0 && (
                <span className="text-stone-400 block text-center font-bold">No payments logged in range.</span>
              )}
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm space-y-4">
            <h3 className="font-extrabold text-stone-850 text-xs uppercase tracking-wide flex items-center gap-1.5">
              <Award size={16} className="text-wood-655" />
              Top Selling Furniture
            </h3>

            <div className="space-y-2 text-xs font-semibold text-stone-600">
              {topSellingProducts.map((p, idx) => (
                <div key={idx} className="flex justify-between items-center">
                  <div>
                    <p className="text-stone-800 font-bold">{p.productName}</p>
                    <span className="text-[9px] text-stone-400 font-medium">SKU: {p.productCode}</span>
                  </div>
                  <span className="font-black text-stone-850 bg-stone-100 px-2 py-0.5 rounded">{p.qtySold} sold</span>
                </div>
              ))}
              {topSellingProducts.length === 0 && (
                <span className="text-stone-400 block text-center font-bold">No items sold.</span>
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
