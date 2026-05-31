import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  CheckCircle,
  Edit2,
  Hammer,
  Plus,
  Receipt,
  Search,
  Trash2,
  X,
} from 'lucide-react';

const today = () => new Date().toISOString().split('T')[0];
const formatCurrency = (amount) => `Rs. ${Number(amount || 0).toLocaleString()}`;
const emptyAccountSummary = { totalPaid: 0, totalCredit: 0, netBalance: 0 };

const getAccountSummary = (carpenter) => ({
  ...emptyAccountSummary,
  ...(carpenter?.accountSummary || {}),
});

const isCreditTransaction = (transaction) => transaction?.transactionType === 'CREDIT';

export default function Carpenters() {
  const { user } = useAuth();
  const [carpenters, setCarpenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [alertMsg, setAlertMsg] = useState({ type: '', text: '' });

  const [carpenterModalOpen, setCarpenterModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedCarpenter, setSelectedCarpenter] = useState(null);
  const [history, setHistory] = useState({ payments: [], totalPaid: 0, totalCredit: 0, netBalance: 0 });

  const [carpenterForm, setCarpenterForm] = useState({
    name: '',
    defaultDailyPayment: '',
    active: true,
  });
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    date: today(),
    transactionType: 'PAYMENT',
    notes: '',
  });

  const totalDefaultPayments = useMemo(
    () => carpenters
      .filter((carpenter) => carpenter.active)
      .reduce((sum, carpenter) => sum + Number(carpenter.defaultDailyPayment || 0), 0),
    [carpenters]
  );

  const totalNetBalance = useMemo(
    () => carpenters.reduce((sum, carpenter) => sum + Number(getAccountSummary(carpenter).netBalance || 0), 0),
    [carpenters]
  );

  const showAlert = (type, text) => {
    setAlertMsg({ type, text });
    setTimeout(() => setAlertMsg({ type: '', text: '' }), 5000);
  };

  const loadCarpenters = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/carpenters?search=${encodeURIComponent(searchTerm)}`);
      setCarpenters(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      showAlert('error', 'Failed to load carpenter payment records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCarpenters();
  }, [searchTerm]);

  const openAddCarpenter = () => {
    setSelectedCarpenter(null);
    setCarpenterForm({ name: '', defaultDailyPayment: '', active: true });
    setCarpenterModalOpen(true);
  };

  const openEditCarpenter = (carpenter) => {
    setSelectedCarpenter(carpenter);
    setCarpenterForm({
      name: carpenter.name,
      defaultDailyPayment: carpenter.defaultDailyPayment || '',
      active: carpenter.active,
    });
    setCarpenterModalOpen(true);
  };

  const submitCarpenter = async (event) => {
    event.preventDefault();
    const amount = parseFloat(carpenterForm.defaultDailyPayment || 0);

    if (!carpenterForm.name.trim()) {
      showAlert('error', 'Carpenter name is required.');
      return;
    }
    if (isNaN(amount) || amount < 0) {
      showAlert('error', 'Default daily payment must be zero or greater.');
      return;
    }

    try {
      if (selectedCarpenter) {
        await api.put(`/carpenters/${selectedCarpenter.id}`, carpenterForm);
        showAlert('success', 'Carpenter details updated.');
      } else {
        await api.post('/carpenters', carpenterForm);
        showAlert('success', 'Carpenter added successfully.');
      }
      setCarpenterModalOpen(false);
      loadCarpenters();
    } catch (err) {
      showAlert('error', err.response?.data?.error || 'Failed to save carpenter.');
    }
  };

  const openPayment = (carpenter, transactionType = 'PAYMENT') => {
    setSelectedCarpenter(carpenter);
    setPaymentForm({
      amount: transactionType === 'PAYMENT' ? carpenter.defaultDailyPayment || '' : '',
      date: today(),
      transactionType,
      notes: '',
    });
    setPaymentModalOpen(true);
  };

  const submitPayment = async (event) => {
    event.preventDefault();
    const amount = parseFloat(paymentForm.amount);

    if (!selectedCarpenter) return;
    if (isNaN(amount) || amount <= 0) {
      showAlert('error', 'Transaction amount must be greater than zero.');
      return;
    }

    try {
      await api.post(`/carpenters/${selectedCarpenter.id}/payments`, paymentForm);
      showAlert('success', paymentForm.transactionType === 'CREDIT' ? 'Carpenter credit recorded.' : 'Carpenter payment recorded.');
      setPaymentModalOpen(false);
      loadCarpenters();
    } catch (err) {
      showAlert('error', err.response?.data?.error || 'Failed to record carpenter transaction.');
    }
  };

  const openHistory = async (carpenter) => {
    setSelectedCarpenter(carpenter);
    setHistory({ payments: [], totalPaid: 0, totalCredit: 0, netBalance: 0 });
    setHistoryModalOpen(true);

    try {
      const res = await api.get(`/carpenters/${carpenter.id}/payments`);
      setHistory({
        payments: res.data.payments || [],
        totalPaid: Number(res.data.totalPaid || 0),
        totalCredit: Number(res.data.totalCredit || 0),
        netBalance: Number(res.data.netBalance || 0),
      });
    } catch (err) {
      showAlert('error', err.response?.data?.error || 'Failed to load carpenter history.');
    }
  };

  const deleteCarpenter = async (carpenter) => {
    if (!window.confirm(`Delete or deactivate ${carpenter.name}?`)) return;

    try {
      const res = await api.delete(`/carpenters/${carpenter.id}`);
      showAlert('success', res.data.message || 'Carpenter removed.');
      loadCarpenters();
    } catch (err) {
      showAlert('error', err.response?.data?.error || 'Failed to remove carpenter.');
    }
  };

  const deletePayment = async (paymentId) => {
    if (!window.confirm('Delete this carpenter transaction record?')) return;

    try {
      await api.delete(`/carpenter-payments/${paymentId}`);
      showAlert('success', 'Carpenter transaction deleted.');
      if (selectedCarpenter) {
        openHistory(selectedCarpenter);
      }
      loadCarpenters();
    } catch (err) {
      showAlert('error', err.response?.data?.error || 'Failed to delete payment.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-stone-850 flex items-center gap-2">
            <Hammer size={22} className="text-wood-650" />
            Carpenter Daily Payments
          </h2>
          <p className="text-xs text-stone-400 font-semibold mt-1">
            Maintain worker names, daily advances, received credits, and each carpenter's account history.
          </p>
        </div>
        <button
          onClick={openAddCarpenter}
          className="inline-flex items-center gap-1.5 rounded-lg bg-wood-600 px-4 py-2 text-xs font-bold text-white hover:bg-wood-700 shadow-md"
        >
          <Plus size={15} />
          Add Carpenter
        </button>
      </div>

      {alertMsg.text && (
        <div className={`p-4 rounded-lg border text-sm font-semibold ${
          alertMsg.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {alertMsg.type === 'success' && <CheckCircle size={16} className="inline mr-1" />}
          {alertMsg.text}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4 bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
        <div className="relative md:col-span-2">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-stone-400">
            <Search size={16} />
          </span>
          <input
            type="text"
            placeholder="Search carpenter name..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="w-full rounded-lg border border-stone-200 pl-9 pr-3 py-2 text-xs bg-stone-50 text-stone-850"
          />
        </div>
        <div className="bg-stone-50 p-2.5 rounded-lg border border-stone-200 flex justify-between items-center text-xs font-bold text-stone-600">
          <span>Active Daily Total:</span>
          <span className="text-sm font-black text-wood-700">{formatCurrency(totalDefaultPayments)}</span>
        </div>
        <div className="bg-stone-50 p-2.5 rounded-lg border border-stone-200 flex justify-between items-center text-xs font-bold text-stone-600">
          <span>Net Account:</span>
          <span className={`text-sm font-black ${totalNetBalance >= 0 ? 'text-wood-700' : 'text-emerald-700'}`}>
            {formatCurrency(Math.abs(totalNetBalance))}
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-stone-50 text-stone-400 font-bold uppercase border-b border-stone-150">
                <th className="p-3.5">Carpenter</th>
                <th className="p-3.5 text-right">Daily Payment</th>
                <th className="p-3.5 text-right">Account Balance</th>
                <th className="p-3.5">Last Transaction</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 font-medium text-stone-700">
              {loading ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-stone-400 font-bold">Loading carpenters...</td>
                </tr>
              ) : carpenters.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-stone-400 font-bold">No carpenters added yet.</td>
                </tr>
              ) : (
                carpenters.map((carpenter) => {
                  const lastPayment = carpenter.payments?.[0];
                  const summary = getAccountSummary(carpenter);
                  const balanceLabel = summary.netBalance > 0 ? 'Advance' : summary.netBalance < 0 ? 'Credit' : 'Balanced';
                  return (
                    <tr key={carpenter.id} className="hover:bg-stone-50">
                      <td className="p-3.5">
                        <span className="font-black text-stone-850">{carpenter.name}</span>
                        <span className="block text-[10px] text-stone-400">{carpenter._count?.payments || 0} transaction records</span>
                      </td>
                      <td className="p-3.5 text-right font-black text-stone-850">
                        {formatCurrency(carpenter.defaultDailyPayment)}
                      </td>
                      <td className="p-3.5 text-right">
                        <span className={`font-black ${summary.netBalance >= 0 ? 'text-wood-700' : 'text-emerald-700'}`}>
                          {formatCurrency(Math.abs(summary.netBalance))}
                        </span>
                        <span className="block text-[10px] text-stone-400">{balanceLabel}</span>
                      </td>
                      <td className="p-3.5 text-stone-500">
                        {lastPayment ? (
                          <>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              isCreditTransaction(lastPayment) ? 'bg-emerald-100 text-emerald-800' : 'bg-wood-100 text-wood-800'
                            }`}>
                              {isCreditTransaction(lastPayment) ? 'Credit' : 'Payment'}
                            </span>
                            <span className="ml-2 font-bold text-stone-700">{formatCurrency(lastPayment.amount)}</span>
                            <span className="block text-[10px] text-stone-400">{new Date(lastPayment.date).toLocaleDateString()}</span>
                          </>
                        ) : (
                          <span className="text-stone-350">No transaction yet</span>
                        )}
                      </td>
                      <td className="p-3.5 text-center">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          carpenter.active ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-150 text-stone-700'
                        }`}>
                          {carpenter.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openPayment(carpenter, 'PAYMENT')}
                            className="inline-flex items-center gap-1 rounded-lg border border-wood-200 px-2 py-1 text-[10px] font-bold text-wood-700 hover:bg-wood-600 hover:text-white"
                          >
                            <ArrowUpRight size={13} />
                            Pay
                          </button>
                          <button
                            onClick={() => openPayment(carpenter, 'CREDIT')}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-2 py-1 text-[10px] font-bold text-emerald-700 hover:bg-emerald-600 hover:text-white"
                          >
                            <ArrowDownLeft size={13} />
                            Credit
                          </button>
                          <button
                            onClick={() => openHistory(carpenter)}
                            className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2 py-1 text-[10px] font-bold text-stone-600 hover:bg-stone-100"
                          >
                            <CalendarDays size={13} />
                            Report
                          </button>
                          <button
                            onClick={() => openEditCarpenter(carpenter)}
                            className="p-1 rounded border border-stone-200 text-stone-500 hover:text-stone-850 hover:bg-stone-100"
                          >
                            <Edit2 size={13} />
                          </button>
                          {user?.role === 'ADMIN' && (
                            <button
                              onClick={() => deleteCarpenter(carpenter)}
                              className="p-1 rounded border border-stone-200 text-stone-400 hover:text-red-650 hover:bg-red-50"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {carpenterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h3 className="text-base font-bold text-stone-850 flex items-center gap-1.5">
                <Hammer size={18} className="text-wood-650" />
                {selectedCarpenter ? 'Edit Carpenter' : 'Add Carpenter'}
              </h3>
              <button onClick={() => setCarpenterModalOpen(false)} className="text-stone-400 hover:text-stone-800">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={submitCarpenter} className="mt-4 space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-stone-650">Carpenter Name *</label>
                <input
                  type="text"
                  value={carpenterForm.name}
                  onChange={(event) => setCarpenterForm({ ...carpenterForm, name: event.target.value })}
                  className="mt-1.5 block w-full rounded-lg border border-stone-200 px-3 py-2 bg-stone-50 text-stone-850"
                  placeholder="Worker name"
                />
              </div>
              <div>
                <label className="block text-stone-650">Default Daily Payment (Rs.)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={carpenterForm.defaultDailyPayment}
                  onChange={(event) => setCarpenterForm({ ...carpenterForm, defaultDailyPayment: event.target.value })}
                  className="mt-1.5 block w-full rounded-lg border border-stone-200 px-3 py-2 bg-stone-50 text-stone-850"
                  placeholder="0.00"
                />
              </div>
              {selectedCarpenter && (
                <label className="flex items-center gap-2 text-stone-650">
                  <input
                    type="checkbox"
                    checked={carpenterForm.active}
                    onChange={(event) => setCarpenterForm({ ...carpenterForm, active: event.target.checked })}
                    className="rounded border-stone-300"
                  />
                  Active carpenter
                </label>
              )}
              <button
                type="submit"
                className="w-full rounded-lg bg-wood-600 py-2.5 text-xs font-bold text-white hover:bg-wood-700 shadow-md"
              >
                Save Carpenter
              </button>
            </form>
          </div>
        </div>
      )}

      {paymentModalOpen && selectedCarpenter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h3 className="text-base font-bold text-stone-850 flex items-center gap-1.5">
                <Receipt size={18} className="text-wood-650" />
                {paymentForm.transactionType === 'CREDIT' ? 'Credit' : 'Pay'} {selectedCarpenter.name}
              </h3>
              <button onClick={() => setPaymentModalOpen(false)} className="text-stone-400 hover:text-stone-800">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={submitPayment} className="mt-4 space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-stone-650">Transaction Type *</label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentForm({
                      ...paymentForm,
                      transactionType: 'PAYMENT',
                      amount: paymentForm.amount || selectedCarpenter.defaultDailyPayment || '',
                    })}
                    className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 font-bold ${
                      paymentForm.transactionType === 'PAYMENT'
                        ? 'border-wood-600 bg-wood-600 text-white'
                        : 'border-stone-200 bg-stone-50 text-stone-650 hover:bg-stone-100'
                    }`}
                  >
                    <ArrowUpRight size={14} />
                    Pay / Advance
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentForm({ ...paymentForm, transactionType: 'CREDIT' })}
                    className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 font-bold ${
                      paymentForm.transactionType === 'CREDIT'
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-stone-200 bg-stone-50 text-stone-650 hover:bg-stone-100'
                    }`}
                  >
                    <ArrowDownLeft size={14} />
                    Received / Credit
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-stone-650">
                  {paymentForm.transactionType === 'CREDIT' ? 'Received / Credit Amount (Rs.) *' : 'Payment / Advance Amount (Rs.) *'}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={paymentForm.amount}
                  onChange={(event) => setPaymentForm({ ...paymentForm, amount: event.target.value })}
                  className="mt-1.5 block w-full rounded-lg border border-stone-200 px-3 py-2 bg-stone-50 text-stone-850"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-stone-650">Transaction Date *</label>
                <input
                  type="date"
                  value={paymentForm.date}
                  onChange={(event) => setPaymentForm({ ...paymentForm, date: event.target.value })}
                  className="mt-1.5 block w-full rounded-lg border border-stone-200 px-3 py-2 bg-stone-50 text-stone-850"
                />
              </div>
              <div>
                <label className="block text-stone-650">Notes</label>
                <textarea
                  value={paymentForm.notes}
                  onChange={(event) => setPaymentForm({ ...paymentForm, notes: event.target.value })}
                  className="mt-1.5 block w-full rounded-lg border border-stone-200 px-3 py-2 bg-stone-50 text-stone-850"
                  rows="3"
                  placeholder="Work details or payment note"
                />
              </div>
              <button
                type="submit"
                className={`w-full rounded-lg py-2.5 text-xs font-bold text-white shadow-md ${
                  paymentForm.transactionType === 'CREDIT' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-wood-600 hover:bg-wood-700'
                }`}
              >
                {paymentForm.transactionType === 'CREDIT' ? 'Record Credit' : 'Record Payment'}
              </button>
            </form>
          </div>
        </div>
      )}

      {historyModalOpen && selectedCarpenter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl rounded-xl bg-white p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div>
                <h3 className="text-base font-bold text-stone-850 flex items-center gap-1.5">
                  <CalendarDays size={18} className="text-wood-650" />
                  {selectedCarpenter.name} Account Report
                </h3>
              </div>
              <button onClick={() => setHistoryModalOpen(false)} className="text-stone-400 hover:text-stone-800">
                <X size={20} />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-wood-100 bg-wood-50 p-3">
                <p className="text-[10px] font-bold uppercase text-wood-700">Paid / Advances</p>
                <p className="mt-1 text-lg font-black text-wood-800">{formatCurrency(history.totalPaid)}</p>
              </div>
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3">
                <p className="text-[10px] font-bold uppercase text-emerald-700">Received / Credits</p>
                <p className="mt-1 text-lg font-black text-emerald-800">{formatCurrency(history.totalCredit)}</p>
              </div>
              <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                <p className="text-[10px] font-bold uppercase text-stone-500">Net Account Balance</p>
                <p className={`mt-1 text-lg font-black ${history.netBalance >= 0 ? 'text-wood-800' : 'text-emerald-800'}`}>
                  {formatCurrency(Math.abs(history.netBalance))}
                </p>
                <p className="text-[10px] font-bold text-stone-400">
                  {history.netBalance > 0 ? 'Advance balance' : history.netBalance < 0 ? 'Credit balance' : 'Balanced'}
                </p>
              </div>
            </div>

            <div className="mt-4 overflow-y-auto max-h-96 border border-stone-150 rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-stone-100 text-stone-400 font-bold uppercase border-b border-stone-200">
                    <th className="p-3">Date</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Details</th>
                    <th className="p-3 text-right">Paid / Advance</th>
                    <th className="p-3 text-right">Received / Credit</th>
                    {user?.role === 'ADMIN' && <th className="p-3 text-center">Delete</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-semibold">
                  {history.payments.length === 0 ? (
                    <tr>
                      <td colSpan={user?.role === 'ADMIN' ? 6 : 5} className="p-8 text-center text-stone-400 font-bold">
                        No transactions recorded for this carpenter yet.
                      </td>
                    </tr>
                  ) : (
                    history.payments.map((payment) => (
                      <tr key={payment.id} className="hover:bg-stone-50">
                        <td className="p-3 text-stone-600 font-bold">{new Date(payment.date).toLocaleDateString()}</td>
                        <td className="p-3">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            isCreditTransaction(payment) ? 'bg-emerald-100 text-emerald-800' : 'bg-wood-100 text-wood-800'
                          }`}>
                            {isCreditTransaction(payment) ? 'Credit' : 'Payment'}
                          </span>
                        </td>
                        <td className="p-3 text-stone-600 max-w-md">{payment.notes || '-'}</td>
                        <td className="p-3 text-right font-black text-wood-700">
                          {isCreditTransaction(payment) ? '-' : formatCurrency(payment.amount)}
                        </td>
                        <td className="p-3 text-right font-black text-emerald-700">
                          {isCreditTransaction(payment) ? formatCurrency(payment.amount) : '-'}
                        </td>
                        {user?.role === 'ADMIN' && (
                          <td className="p-3 text-center">
                            <button
                              onClick={() => deletePayment(payment.id)}
                              className="p-1 rounded border border-stone-200 text-stone-400 hover:text-red-650 hover:bg-red-50"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
