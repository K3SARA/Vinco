import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import useDebouncedValue from '../hooks/useDebouncedValue';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  CheckCircle,
  Edit2,
  FileText,
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
const emptyLedger = {
  entries: [],
  totalPaid: 0,
  totalCredit: 0,
  netBalance: 0,
  openingBalance: 0,
  closingBalance: 0,
  accountBalance: 0,
};

const getAccountSummary = (carpenter) => ({
  ...emptyAccountSummary,
  ...(carpenter?.accountSummary || {}),
});

const isCreditTransaction = (transaction) => transaction?.transactionType === 'CREDIT';

const getMonthRange = () => {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    from: firstDay.toISOString().split('T')[0],
    to: today(),
  };
};

const getBalanceLabel = (balance) => {
  if (balance > 0) return 'Advance balance';
  if (balance < 0) return 'Credit balance';
  return 'Balanced';
};

export default function Carpenters() {
  const { user } = useAuth();
  const [carpenters, setCarpenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebouncedValue(searchTerm);
  const [alertMsg, setAlertMsg] = useState({ type: '', text: '' });

  const [carpenterModalOpen, setCarpenterModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedCarpenter, setSelectedCarpenter] = useState(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerFilters, setLedgerFilters] = useState({ from: '', to: '' });
  const [ledger, setLedger] = useState(emptyLedger);

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

  function showAlert(type, text) {
    setAlertMsg({ type, text });
    setTimeout(() => setAlertMsg({ type: '', text: '' }), 5000);
  }

  const loadCarpenters = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/carpenters?search=${encodeURIComponent(debouncedSearchTerm)}`);
      setCarpenters(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      showAlert('error', 'Failed to load carpenter payment records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCarpenters();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchTerm]);

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

  const loadLedger = async (carpenter = selectedCarpenter, filters = ledgerFilters) => {
    if (!carpenter) return;

    setLedgerLoading(true);

    try {
      const params = new URLSearchParams();
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      const query = params.toString() ? `?${params.toString()}` : '';
      const res = await api.get(`/carpenters/${carpenter.id}/ledger${query}`);

      setLedger({
        entries: res.data.entries || [],
        totalPaid: Number(res.data.totalPaid || 0),
        totalCredit: Number(res.data.totalCredit || 0),
        netBalance: Number(res.data.netBalance || 0),
        openingBalance: Number(res.data.openingBalance || 0),
        closingBalance: Number(res.data.closingBalance || 0),
        accountBalance: Number(res.data.accountBalance || 0),
      });
    } catch (err) {
      showAlert('error', err.response?.data?.error || 'Failed to load carpenter ledger.');
    } finally {
      setLedgerLoading(false);
    }
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
      if (historyModalOpen) {
        loadLedger(selectedCarpenter, ledgerFilters);
      }
    } catch (err) {
      showAlert('error', err.response?.data?.error || 'Failed to record carpenter transaction.');
    }
  };

  const openLedger = async (carpenter) => {
    const filters = { from: '', to: '' };
    setSelectedCarpenter(carpenter);
    setLedger(emptyLedger);
    setLedgerFilters(filters);
    setHistoryModalOpen(true);
    loadLedger(carpenter, filters);
  };

  const applyLedgerPreset = (preset) => {
    if (!selectedCarpenter) return;

    const filters = preset === 'today'
      ? { from: today(), to: today() }
      : preset === 'month'
        ? getMonthRange()
        : { from: '', to: '' };

    setLedgerFilters(filters);
    loadLedger(selectedCarpenter, filters);
  };

  const applyLedgerFilters = () => {
    loadLedger(selectedCarpenter, ledgerFilters);
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
        loadLedger(selectedCarpenter, ledgerFilters);
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
                            onClick={() => openLedger(carpenter)}
                            className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2 py-1 text-[10px] font-bold text-stone-600 hover:bg-stone-100"
                          >
                            <FileText size={13} />
                            Ledger
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
        <div className="carpenter-ledger-overlay">
          <div className="carpenter-ledger-sheet">
            <div className="carpenter-ledger-handle" />

            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wide text-stone-400">Carpenter Ledger</p>
                <h3 className="mt-1 flex items-center gap-2 text-lg font-black text-stone-850">
                  <FileText size={19} className="text-wood-650" />
                  {selectedCarpenter.name}
                </h3>
                <p className="mt-1 text-[11px] font-bold text-stone-400">
                  {ledger.entries.length} ledger entries
                </p>
              </div>
              <button type="button" onClick={() => setHistoryModalOpen(false)} className="carpenter-ledger-close">
                <X size={20} />
              </button>
            </div>

            <div className="carpenter-ledger-balance">
              <span>Current account</span>
              <strong className={ledger.accountBalance >= 0 ? 'text-wood-800' : 'text-emerald-800'}>
                {formatCurrency(Math.abs(ledger.accountBalance))}
              </strong>
              <small>{getBalanceLabel(ledger.accountBalance)}</small>
            </div>

            <div className="carpenter-ledger-summary">
              <div>
                <span>Opening</span>
                <strong>{formatCurrency(Math.abs(ledger.openingBalance))}</strong>
              </div>
              <div>
                <span>Paid</span>
                <strong className="text-wood-800">{formatCurrency(ledger.totalPaid)}</strong>
              </div>
              <div>
                <span>Credit</span>
                <strong className="text-emerald-800">{formatCurrency(ledger.totalCredit)}</strong>
              </div>
              <div>
                <span>Closing</span>
                <strong>{formatCurrency(Math.abs(ledger.closingBalance))}</strong>
              </div>
            </div>

            <div className="carpenter-ledger-actions">
              <button type="button" onClick={() => openPayment(selectedCarpenter, 'PAYMENT')} className="pay">
                <ArrowUpRight size={16} />
                Pay
              </button>
              <button type="button" onClick={() => openPayment(selectedCarpenter, 'CREDIT')} className="credit">
                <ArrowDownLeft size={16} />
                Credit
              </button>
            </div>

            <div className="carpenter-ledger-filters">
              <div className="carpenter-ledger-presets">
                <button type="button" onClick={() => applyLedgerPreset('today')}>Today</button>
                <button type="button" onClick={() => applyLedgerPreset('month')}>Month</button>
                <button type="button" onClick={() => applyLedgerPreset('all')}>All</button>
              </div>
              <div className="carpenter-ledger-date-row">
                <label>
                  <CalendarDays size={13} />
                  <input
                    type="date"
                    value={ledgerFilters.from}
                    onChange={(event) => setLedgerFilters({ ...ledgerFilters, from: event.target.value })}
                  />
                </label>
                <label>
                  <CalendarDays size={13} />
                  <input
                    type="date"
                    value={ledgerFilters.to}
                    onChange={(event) => setLedgerFilters({ ...ledgerFilters, to: event.target.value })}
                  />
                </label>
                <button type="button" onClick={applyLedgerFilters}>Apply</button>
              </div>
            </div>

            <div className="ledger-card-list carpenter-ledger-list">
              {ledgerLoading ? (
                <div className="ledger-empty-card">Loading carpenter ledger...</div>
              ) : ledger.entries.length === 0 ? (
                <div className="ledger-empty-card">No ledger entries for this period.</div>
              ) : (
                ledger.entries.map((entry) => (
                  <article key={entry.id} className="ledger-card carpenter">
                    <div className="ledger-card-main">
                      <div>
                        <strong>{entry.referenceNo}</strong>
                        <span>{new Date(entry.date).toLocaleString()}</span>
                      </div>
                      <span className="ledger-type">{isCreditTransaction(entry) ? 'Credit' : 'Payment'}</span>
                    </div>
                    <p>{entry.description}</p>
                    <div className="ledger-amount-grid">
                      <div className="debit">
                        <span>Paid</span>
                        <strong>{entry.paid > 0 ? `+ ${formatCurrency(entry.paid)}` : '-'}</strong>
                      </div>
                      <div className="credit">
                        <span>Credit</span>
                        <strong>{entry.credit > 0 ? `- ${formatCurrency(entry.credit)}` : '-'}</strong>
                      </div>
                      <div>
                        <span>Balance</span>
                        <strong>{formatCurrency(Math.abs(entry.balanceAfter))}</strong>
                      </div>
                    </div>
                    {user?.role === 'ADMIN' && (
                      <button type="button" onClick={() => deletePayment(entry.id)} className="carpenter-ledger-delete">
                        <Trash2 size={13} />
                        Delete
                      </button>
                    )}
                  </article>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
