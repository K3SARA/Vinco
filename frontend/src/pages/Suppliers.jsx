import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import useDebouncedValue from '../hooks/useDebouncedValue';
import { 
  Briefcase, Users, Plus, Search, Edit, Trash2, X, FileText, 
  Receipt, Landmark
} from 'lucide-react';

export default function Suppliers() {
  const { user } = useAuth();
  
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState(localStorage.getItem('vinco_lang') || 'en');

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebouncedValue(searchTerm);

  // Modals state
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [ledgerModalOpen, setLedgerModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [ledgerHistory, setLedgerHistory] = useState([]);

  // Errors/Success alert
  const [alertMsg, setAlertMsg] = useState({ type: '', text: '' });

  // Supplier Form state
  const [suppForm, setSuppForm] = useState({
    id: '',
    name: '',
    phone: '',
    address: '',
    email: '',
    openingBalance: 0,
    notes: '',
    status: 'Active'
  });

  // Payment Form state
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentMethod: 'Cash',
    referenceNumber: '',
    notes: '',
    date: new Date().toISOString().split('T')[0]
  });

  // Adjustment Form state
  const [adjustForm, setAdjustForm] = useState({
    amount: '',
    type: 'CREDIT',
    description: '',
    date: new Date().toISOString().split('T')[0]
  });

  const translate = (en, si) => (lang === 'en' ? en : si);

  useEffect(() => {
    const handleLangChange = () => setLang(localStorage.getItem('vinco_lang') || 'en');
    window.addEventListener('languageChange', handleLangChange);
    return () => window.removeEventListener('languageChange', handleLangChange);
  }, []);

  const loadSuppliers = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/suppliers?search=${encodeURIComponent(debouncedSearchTerm)}`);
      setSuppliers(res.data);
    } catch (error) {
      console.error(error);
      showAlert('error', 'Failed to load suppliers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSuppliers();
  }, [debouncedSearchTerm]);

  function showAlert(type, text) {
    setAlertMsg({ type, text });
    setTimeout(() => setAlertMsg({ type: '', text: '' }), 5000);
  }

  const handleOpenAdd = () => {
    setSelectedSupplier(null);
    setSuppForm({
      id: '',
      name: '',
      phone: '',
      address: '',
      email: '',
      openingBalance: 0,
      notes: '',
      status: 'Active'
    });
    setSupplierModalOpen(true);
  };

  const handleOpenEdit = (s) => {
    setSelectedSupplier(s);
    setSuppForm({
      id: s.id,
      name: s.name,
      phone: s.phone,
      address: s.address || '',
      email: s.email || '',
      openingBalance: s.openingBalance,
      notes: s.notes || '',
      status: s.status
    });
    setSupplierModalOpen(true);
  };

  const handleSupplierSubmit = async (e) => {
    e.preventDefault();
    if (!suppForm.name || !suppForm.phone) {
      showAlert('error', 'Name and Phone are required.');
      return;
    }

    try {
      if (selectedSupplier) {
        await api.put(`/suppliers/${selectedSupplier.id}`, suppForm);
        showAlert('success', 'Supplier record updated successfully.');
      } else {
        await api.post('/suppliers', suppForm);
        showAlert('success', 'Supplier profile registered successfully.');
      }
      setSupplierModalOpen(false);
      loadSuppliers();
    } catch (err) {
      showAlert('error', err.response?.data?.error || 'Supplier submission failed.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this supplier? / මෙම සැපයුම්කරු ගිණුම ඉවත් කිරීමට අවශ්‍ය බව සහතිකද?')) return;
    try {
      await api.delete(`/suppliers/${id}`);
      showAlert('success', 'Supplier deleted.');
      loadSuppliers();
    } catch (err) {
      showAlert('error', err.response?.data?.error || 'Supplier is linked to purchase orders and cannot be deleted.');
    }
  };

  const handleViewLedger = async (supplier) => {
    try {
      const res = await api.get(`/suppliers/${supplier.id}/ledger`);
      setLedgerHistory(res.data);
      setSelectedSupplier(supplier);
      setLedgerModalOpen(true);
    } catch {
      showAlert('error', 'Failed to retrieve supplier ledger logs.');
    }
  };

  const handleOpenPayment = (supplier) => {
    setSelectedSupplier(supplier);
    setPaymentForm({
      amount: '',
      paymentMethod: 'Cash',
      referenceNumber: '',
      notes: '',
      date: new Date().toISOString().split('T')[0]
    });
    setPaymentModalOpen(true);
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(paymentForm.amount);
    if (isNaN(amt) || amt <= 0) {
      showAlert('error', 'Disbursement amount must be greater than zero.');
      return;
    }

    try {
      await api.post(`/suppliers/${selectedSupplier.id}/payment`, paymentForm);
      showAlert('success', 'Payment disbursement logged in supplier ledger.');
      setPaymentModalOpen(false);
      loadSuppliers();
    } catch (err) {
      showAlert('error', err.response?.data?.error || 'Failed to post supplier payment.');
    }
  };

  const handleOpenAdjust = (supplier) => {
    setSelectedSupplier(supplier);
    setAdjustForm({
      amount: '',
      type: 'CREDIT',
      description: '',
      date: new Date().toISOString().split('T')[0]
    });
    setAdjustModalOpen(true);
  };

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(adjustForm.amount);
    if (isNaN(amt) || amt <= 0) {
      showAlert('error', 'Adjustment amount must be greater than zero.');
      return;
    }
    if (!adjustForm.description.trim()) {
      showAlert('error', 'Reason is required.');
      return;
    }

    try {
      await api.post(`/suppliers/${selectedSupplier.id}/adjustment`, adjustForm);
      showAlert('success', 'Supplier ledger adjustment posted successfully.');
      setAdjustModalOpen(false);
      loadSuppliers();
    } catch (err) {
      showAlert('error', err.response?.data?.error || 'Failed to post adjustment.');
    }
  };

  const money = (value) =>
    `Rs. ${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const supplierHolds = suppliers.reduce((sum, s) => sum + Math.max(-Number(s.currentBalance || 0), 0), 0);
  const totalToPay = suppliers.reduce((sum, s) => sum + Math.max(Number(s.currentBalance || 0), 0), 0);

  return (
    <div className="credit-book-page space-y-4">
      <section className="credit-book-panel">
        <div className="credit-book-top credit-section-card">
          <div>
            <p className="credit-book-eyebrow">Credit Book</p>
            <h2 className="credit-book-title">
              <Briefcase size={22} />
              Suppliers
            </h2>
          </div>

          <button type="button" onClick={handleOpenAdd} className="credit-primary-action">
            <Plus size={16} />
            Add Supplier
          </button>
        </div>

        <div className="credit-section-card tabs-card">
          <nav className="credit-book-tabs" aria-label="Credit book pages">
            <Link to="/customers">
              <Users size={18} />
              Customers
            </Link>
            <Link to="/suppliers" className="active">
              <Briefcase size={18} />
              Suppliers
            </Link>
          </nav>
        </div>

        {alertMsg.text && (
          <div className={`credit-alert ${alertMsg.type === 'success' ? 'success' : 'error'}`}>
            {alertMsg.text}
          </div>
        )}

        <div className="credit-section-card">
          <div className="credit-section-heading">
            <span>Overview</span>
            <small>{suppliers.length} supplier account{suppliers.length === 1 ? '' : 's'}</small>
          </div>

          <div className="credit-summary-grid">
            <div className="credit-summary-card hold">
              <span>Supplier Holds</span>
              <strong>{money(supplierHolds)}</strong>
            </div>
            <div className="credit-summary-card pay">
              <span>To Pay</span>
              <strong>{money(totalToPay)}</strong>
            </div>
          </div>
        </div>

        <div className="credit-section-card compact">
          <div className="credit-section-heading">
            <span>Find Accounts</span>
            <small>Suppliers</small>
          </div>

          <div className="credit-controls single">
            <label className="credit-search-box">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search name, phone or address"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="credit-list-section">
          <div className="credit-section-heading">
            <span>Supplier Accounts</span>
            <small>{suppliers.length ? `${suppliers.length} shown` : 'No records'}</small>
          </div>

          <div className="credit-cards-panel">
          {loading ? (
            <div className="credit-empty-card">
              <FileText size={44} />
              <strong>Loading suppliers...</strong>
            </div>
          ) : suppliers.length === 0 ? (
            <div className="credit-empty-card">
              <FileText size={54} />
              <strong>No supplier added</strong>
              <span>Tap the button below and enter the first supplier transaction.</span>
              <button type="button" onClick={handleOpenAdd} className="credit-primary-action wide">
                <Plus size={16} />
                Add Supplier
              </button>
            </div>
          ) : (
            <div className="credit-card-grid">
              {suppliers.map((s) => {
                const balance = Number(s.currentBalance || 0);
                const hasPayable = balance > 0;

                return (
                  <article key={s.id} className={`credit-account-card ${hasPayable ? 'supplier-payable' : balance < 0 ? 'advance' : ''}`}>
                    <div className="credit-account-head">
                      <div>
                        <h3>{s.name}</h3>
                        <p>{s.phone || 'No phone number'}</p>
                      </div>
                      <span className={`credit-status ${s.status === 'Active' ? 'active' : 'inactive'}`}>
                        {s.status}
                      </span>
                    </div>

                    <div className="credit-detail-grid">
                      <div>
                        <span>Address</span>
                        <strong>{s.address || '-'}</strong>
                      </div>
                      <div>
                        <span>Balance</span>
                        <strong className={hasPayable ? 'text-amber-700' : balance < 0 ? 'text-green-650' : 'text-stone-600'}>
                          {money(balance)}
                        </strong>
                      </div>
                    </div>

                    <div className="credit-action-row">
                      <button type="button" onClick={() => handleViewLedger(s)}>
                        <FileText size={13} />
                        Ledger
                      </button>
                      <button type="button" onClick={() => handleOpenPayment(s)}>
                        <Receipt size={13} />
                        Payment
                      </button>
                      <button type="button" onClick={() => handleOpenAdjust(s)} aria-label={`Adjust ${s.name}`}>
                        <Landmark size={13} />
                      </button>
                      <button type="button" onClick={() => handleOpenEdit(s)} aria-label={`Edit ${s.name}`}>
                        <Edit size={13} />
                      </button>
                      {user?.role === 'ADMIN' && (
                        <button type="button" onClick={() => handleDelete(s.id)} aria-label={`Delete ${s.name}`} className="danger">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          </div>
        </div>
      </section>
      {/* HEADER SECTION */}
      <div className="hidden flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-stone-850 flex items-center gap-2">
            <Briefcase size={22} className="text-wood-650" />
            {translate("Supplier Accounts & Procurement Ledgers", "සැපයුම්කරුවන්ගේ ලෙජර")}
          </h2>
          <p className="text-xs text-stone-400 font-semibold mt-1">
            {translate("Track purchase credits (payables balance), log vendor payments made, and audit supplier ledgers.", "මිලදීගැනීම් ණය වාර්තා තබාගැනීම, සැපයුම්කරුවන්ට ගෙවූ මුදල් ගැලපීම සහ ගිණුම් විගණනය.")}
          </p>
        </div>

        <div>
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 rounded-lg bg-wood-600 px-4 py-2 text-xs font-bold text-white hover:bg-wood-700 shadow-md"
          >
            <Plus size={15} />
            {translate("Register Supplier", "නව සැපයුම්කරුවෙකු ලියාපදිංචි කරන්න")}
          </button>
        </div>
      </div>

      {/* ALERT */}
      {alertMsg.text && (
        <div className={`hidden p-4 rounded-lg border text-sm font-semibold ${
          alertMsg.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {alertMsg.text}
        </div>
      )}

      {/* SEARCH */}
      <div className="hidden bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-stone-400">
            <Search size={16} />
          </span>
          <input
            type="text"
            placeholder={translate("Search Supplier by name, phone or address...", "සැපයුම්කරුගේ නම, දුරකථනය අනුව සොයන්න...")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-stone-200 pl-9 pr-3 py-2 text-xs bg-stone-50 text-stone-850 focus:outline-none"
          />
        </div>
      </div>

      {/* SUPPLIERS TABLE */}
      <div className="hidden rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-stone-50 text-stone-400 font-bold uppercase tracking-wider border-b border-stone-150">
                <th className="p-3.5">Supplier Name</th>
                <th className="p-3.5">Phone</th>
                <th className="p-3.5">Address</th>
                <th className="p-3.5 text-right">Payable Balance (Rs.)</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-center">Actions / Ledger Payments</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 font-medium">
              {suppliers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-stone-400 font-bold">No suppliers found.</td>
                </tr>
              ) : (
                suppliers.map((s) => {
                  const hasDebt = s.currentBalance > 0;
                  return (
                    <tr key={s.id} className="hover:bg-stone-50">
                      <td className="p-3.5 font-bold text-stone-850">{s.name}</td>
                      <td className="p-3.5 text-stone-500 font-semibold">{s.phone}</td>
                      <td className="p-3.5 text-stone-500 max-w-xs truncate">{s.address || '-'}</td>
                      <td className="p-3.5 text-right font-black">
                        <span className={hasDebt ? 'text-red-650' : 'text-stone-500'}>
                          Rs. {s.currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          s.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-150 text-stone-700'
                        }`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleViewLedger(s)}
                            title="Audit Ledger"
                            className="p-1 rounded-lg border border-stone-200 text-stone-500 hover:text-wood-650 hover:bg-stone-100 transition-colors flex items-center gap-1 font-bold text-[10px] px-2"
                          >
                            <FileText size={13} />
                            Ledger
                          </button>

                          <button
                            onClick={() => handleOpenPayment(s)}
                            title="Log Disbursed Payment"
                            className="p-1 rounded-lg border border-wood-200 text-wood-600 hover:text-white hover:bg-wood-600 transition-all flex items-center gap-1 font-bold text-[10px] px-2 shadow-sm"
                          >
                            <Receipt size={13} />
                            Payment Made
                          </button>

                          <button
                            onClick={() => handleOpenAdjust(s)}
                            title="Ledger Correction"
                            className="p-1 rounded-lg border border-stone-250 text-stone-600 hover:bg-stone-150 transition-colors"
                          >
                            <Landmark size={13} />
                          </button>
                          
                          <button
                            onClick={() => handleOpenEdit(s)}
                            className="p-1 rounded-lg border border-stone-200 text-stone-500 hover:text-stone-850 hover:bg-stone-100 transition-colors"
                          >
                            <Edit size={13} />
                          </button>
                          
                          {user?.role === 'ADMIN' && (
                            <button
                              onClick={() => handleDelete(s.id)}
                              className="p-1 rounded-lg border border-stone-200 text-stone-500 hover:text-red-650 hover:bg-red-50 transition-colors"
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

      {/* ==========================================
         SUPPLIER FORM MODAL (ADD & EDIT)
         ========================================== */}
      {supplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h3 className="text-base font-bold text-stone-850 flex items-center gap-1.5">
                <Briefcase size={18} className="text-wood-650" />
                {selectedSupplier ? translate("Modify Supplier Profile", "සැපයුම්කරුගේ විස්තර වෙනස් කිරීම") : translate("Register New Supplier", "නව සැපයුම්කරුවෙකු ලියාපදිංචි කිරීම")}
              </h3>
              <button onClick={() => setSupplierModalOpen(false)} className="text-stone-400 hover:text-stone-800">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSupplierSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs font-semibold">
                <div>
                  <label className="block text-stone-600">Company / Supplier Name *</label>
                  <input
                    type="text"
                    required
                    value={suppForm.name}
                    onChange={(e) => setSuppForm({ ...suppForm, name: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 bg-stone-50 text-stone-800 focus:outline-none focus:border-wood-500"
                    placeholder="e.g. Timber Land Pvt Ltd"
                  />
                </div>

                <div>
                  <label className="block text-stone-600">Phone Number *</label>
                  <input
                    type="text"
                    required
                    value={suppForm.phone}
                    onChange={(e) => setSuppForm({ ...suppForm, phone: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 bg-stone-50 text-stone-800 focus:outline-none focus:border-wood-500"
                    placeholder="e.g. 0112345678"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-stone-600">Office Address</label>
                  <input
                    type="text"
                    value={suppForm.address}
                    onChange={(e) => setSuppForm({ ...suppForm, address: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 bg-stone-50 text-stone-800 focus:outline-none focus:border-wood-500"
                  />
                </div>

                <div>
                  <label className="block text-stone-600">Email Address</label>
                  <input
                    type="email"
                    value={suppForm.email}
                    onChange={(e) => setSuppForm({ ...suppForm, email: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 bg-stone-50 text-stone-800 focus:outline-none"
                  />
                </div>

                {!selectedSupplier && (
                  <div>
                    <label className="block text-stone-600">Opening Balance (Owed amount) (Rs.)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={suppForm.openingBalance}
                      onChange={(e) => setSuppForm({ ...suppForm, openingBalance: parseFloat(e.target.value) || 0 })}
                      className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 bg-stone-50 text-stone-800 text-right font-bold"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-600">Special Notes</label>
                <textarea
                  rows="2"
                  value={suppForm.notes}
                  onChange={(e) => setSuppForm({ ...suppForm, notes: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 bg-stone-50 text-stone-800"
                  placeholder="Primary wood supplier details / delivery notes..."
                ></textarea>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setSupplierModalOpen(false)}
                  className="rounded-lg border border-stone-200 px-4 py-2.5 text-xs font-bold text-stone-600 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-wood-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-wood-750 shadow-md"
                >
                  Save / සුරකින්න
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
         SUPPLIER LEDGER VIEWER MODAL
         ========================================== */}
      {ledgerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl rounded-xl bg-white p-6 shadow-2xl border border-stone-200 animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div>
                <h3 className="text-base font-bold text-stone-850 flex items-center gap-1.5">
                  <FileText size={18} className="text-wood-650" />
                  Ledger Statement for Supplier: {selectedSupplier?.name}
                </h3>
              </div>
              <button onClick={() => setLedgerModalOpen(false)} className="text-stone-400 hover:text-stone-800">
                <X size={20} />
              </button>
            </div>

            <div className="mt-4 p-4 rounded-lg bg-stone-50 border border-stone-200/50 flex justify-between items-center text-xs font-bold">
              <span className="text-stone-500">PAYABLE LIABILITIES BALANCE / ගෙවිය යුතු ශේෂය</span>
              <span className="text-base font-black text-red-650">
                Rs. {selectedSupplier?.currentBalance?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="mt-4 ledger-card-list">
              {ledgerHistory.length === 0 ? (
                <div className="ledger-empty-card">No logs found in this supplier ledger yet.</div>
              ) : (
                ledgerHistory.map((item) => (
                  <article key={item.id} className="ledger-card supplier">
                    <div className="ledger-card-main">
                      <div>
                        <strong>{item.referenceNo || item.transactionType}</strong>
                        <span>{new Date(item.date).toLocaleString()}</span>
                      </div>
                      <span className="ledger-type">{item.transactionType}</span>
                    </div>
                    <p>{item.description}</p>
                    <div className="ledger-amount-grid">
                      <div className="credit">
                        <span>Paid</span>
                        <strong>{item.debit > 0 ? `- ${money(item.debit)}` : '-'}</strong>
                      </div>
                      <div className="debit">
                        <span>Purchase</span>
                        <strong>{item.credit > 0 ? `+ ${money(item.credit)}` : '-'}</strong>
                      </div>
                      <div>
                        <span>Balance After</span>
                        <strong>{money(item.balanceAfter)}</strong>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>

            <div className="hidden mt-4 overflow-y-auto max-h-80 pr-1 border border-stone-150 rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-stone-100 text-stone-400 font-bold uppercase border-b border-stone-200">
                    <th className="p-3">Date / Time</th>
                    <th className="p-3">Reference / Type</th>
                    <th className="p-3">Description</th>
                    <th className="p-3 text-right">Debit (Disbursed) (-)</th>
                    <th className="p-3 text-right">Credit (Purchase) (+)</th>
                    <th className="p-3 text-right">Balance After</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-semibold text-stone-700">
                  {ledgerHistory.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-stone-400 font-bold">No logs found in this supplier ledger yet.</td>
                    </tr>
                  ) : (
                    ledgerHistory.map((item) => (
                      <tr key={item.id} className="hover:bg-stone-50">
                        <td className="p-3 text-stone-400">{new Date(item.date).toLocaleString()}</td>
                        <td className="p-3">
                          <span className="font-bold">{item.referenceNo}</span>
                          <p className="text-[9px] font-medium text-stone-400 uppercase">{item.transactionType}</p>
                        </td>
                        <td className="p-3 text-stone-600 max-w-xs">{item.description}</td>
                        <td className="p-3 text-right text-green-650 font-bold">{item.debit > 0 ? `- Rs. ${item.debit.toLocaleString()}` : '-'}</td>
                        <td className="p-3 text-right text-red-650 font-bold">{item.credit > 0 ? `+ Rs. ${item.credit.toLocaleString()}` : '-'}</td>
                        <td className="p-3 text-right font-black text-stone-850">Rs. {item.balanceAfter.toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
         PAYMENT MADE MODAL (VENDORS DISBURSEMENT)
         ========================================== */}
      {paymentModalOpen && selectedSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h3 className="text-base font-bold text-stone-850 flex items-center gap-1.5">
                <Receipt size={18} className="text-wood-655" />
                Log Payment Made to Vendor
              </h3>
              <button onClick={() => setPaymentModalOpen(false)} className="text-stone-400 hover:text-stone-800">
                <X size={20} />
              </button>
            </div>

            <div className="mt-3 py-2 px-3 rounded bg-red-50 text-[11px] font-bold text-red-750 flex justify-between items-center">
              <span>Outstanding Payable Liabilities:</span>
              <span>Rs. {selectedSupplier?.currentBalance?.toLocaleString()}</span>
            </div>

            <form onSubmit={handlePaymentSubmit} className="mt-4 space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-stone-600">Disbursed Amount (Rs.) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  className="mt-1.5 block w-full rounded-lg border border-stone-200 px-3 py-2 text-stone-900 font-black text-base"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-stone-600">Disbursed Method *</label>
                <select
                  value={paymentForm.paymentMethod}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 bg-stone-50 text-stone-850 font-bold"
                >
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                  <option value="Bank Transfer">Bank Transfer (direct transaction)</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>

              <div>
                <label className="block text-stone-600">Reference / Bank Voucher / Cheque No.</label>
                <input
                  type="text"
                  value={paymentForm.referenceNumber}
                  onChange={(e) => setPaymentForm({ ...paymentForm, referenceNumber: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-1.5 bg-stone-50 text-stone-800"
                  placeholder="e.g. Bank slip or cheque code"
                />
              </div>

              <div>
                <label className="block text-stone-600">Disbursement Date</label>
                <input
                  type="date"
                  value={paymentForm.date}
                  onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-1.5 bg-stone-50 text-stone-800 font-bold"
                />
              </div>

              <div>
                <label className="block text-stone-600">Notes / Receipts description</label>
                <input
                  type="text"
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-1.5 bg-stone-50 text-stone-800"
                  placeholder="e.g. Settlements of Timber invoice #088"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setPaymentModalOpen(false)}
                  className="rounded-lg border border-stone-200 px-4 py-2.5 text-xs font-bold text-stone-600 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-wood-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-wood-750 shadow-md"
                >
                  Log Disbursement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
         MANUAL LEDGER ADJUSTMENT MODAL
         ========================================== */}
      {adjustModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h3 className="text-base font-bold text-stone-850 flex items-center gap-1.5">
                <Landmark size={18} className="text-wood-650" />
                Supplier Ledger Adjustment
              </h3>
              <button onClick={() => setAdjustModalOpen(false)} className="text-stone-400 hover:text-stone-800">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} className="mt-4 space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-stone-600">Adjustment Type *</label>
                <select
                  value={adjustForm.type}
                  onChange={(e) => setAdjustForm({ ...adjustForm, type: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 bg-stone-50 text-stone-850 font-bold"
                >
                  <option value="CREDIT">CREDIT (බැර) - Payable liabilities INCREASES (+)</option>
                  <option value="DEBIT">DEBIT (හර) - Payable liabilities DECREASES (-)</option>
                </select>
              </div>

              <div>
                <label className="block text-stone-600">Adjustment Amount (Rs.) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={adjustForm.amount}
                  onChange={(e) => setAdjustForm({ ...adjustForm, amount: e.target.value })}
                  className="mt-1.5 block w-full rounded-lg border border-stone-200 px-3 py-2 text-stone-900 font-extrabold"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-stone-600">Explanation / Reason *</label>
                <input
                  type="text"
                  required
                  value={adjustForm.description}
                  onChange={(e) => setAdjustForm({ ...adjustForm, description: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-1.5 bg-stone-50 text-stone-800"
                  placeholder="e.g. Correcting initial manual entry value"
                />
              </div>

              <div>
                <label className="block text-stone-650">Adjustment Date</label>
                <input
                  type="date"
                  value={adjustForm.date}
                  onChange={(e) => setAdjustForm({ ...adjustForm, date: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-1.5 bg-stone-50 text-stone-800"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setAdjustModalOpen(false)}
                  className="rounded-lg border border-stone-200 px-4 py-2.5 text-xs font-bold text-stone-600 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-wood-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-wood-750 shadow-md"
                >
                  Post Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
