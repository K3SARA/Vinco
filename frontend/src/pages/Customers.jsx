import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import useDebouncedValue from '../hooks/useDebouncedValue';
import { 
  Briefcase, Users, Plus, Search, Edit, Trash2, Receipt,
  X, FileText, Landmark
} from 'lucide-react';

export default function Customers() {
  const { user } = useAuth();
  
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState(localStorage.getItem('vinco_lang') || 'en');

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebouncedValue(searchTerm);
  const [statusFilter, setStatusFilter] = useState('');

  // Modals state
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [ledgerModalOpen, setLedgerModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [ledgerHistory, setLedgerHistory] = useState([]);

  // Errors/Success alert
  const [alertMsg, setAlertMsg] = useState({ type: '', text: '' });

  // Customer Form state
  const [custForm, setCustForm] = useState({
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
    type: 'DEBIT',
    description: '',
    date: new Date().toISOString().split('T')[0]
  });

  // Translation helper
  const translate = (en, si) => (lang === 'en' ? en : si);

  useEffect(() => {
    const handleLangChange = () => setLang(localStorage.getItem('vinco_lang') || 'en');
    window.addEventListener('languageChange', handleLangChange);
    return () => window.removeEventListener('languageChange', handleLangChange);
  }, []);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/customers?search=${encodeURIComponent(debouncedSearchTerm)}&status=${statusFilter}`);
      setCustomers(res.data);
    } catch (error) {
      console.error(error);
      showAlert('error', 'Failed to load customers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCustomers();
  }, [debouncedSearchTerm, statusFilter]);

  function showAlert(type, text) {
    setAlertMsg({ type, text });
    setTimeout(() => setAlertMsg({ type: '', text: '' }), 5000);
  }

  const handleOpenAdd = () => {
    setSelectedCustomer(null);
    setCustForm({
      id: '',
      name: '',
      phone: '',
      address: '',
      email: '',
      openingBalance: 0,
      notes: '',
      status: 'Active'
    });
    setCustomerModalOpen(true);
  };

  const handleOpenEdit = (c) => {
    setSelectedCustomer(c);
    setCustForm({
      id: c.id,
      name: c.name,
      phone: c.phone,
      address: c.address || '',
      email: c.email || '',
      openingBalance: c.openingBalance,
      notes: c.notes || '',
      status: c.status
    });
    setCustomerModalOpen(true);
  };

  const handleCustomerSubmit = async (e) => {
    e.preventDefault();
    if (!custForm.name || !custForm.phone) {
      showAlert('error', 'Name and Phone Number are required.');
      return;
    }

    try {
      if (selectedCustomer) {
        await api.put(`/customers/${selectedCustomer.id}`, custForm);
        showAlert('success', 'Customer record updated.');
      } else {
        await api.post('/customers', custForm);
        showAlert('success', 'Customer created successfully.');
      }
      setCustomerModalOpen(false);
      loadCustomers();
    } catch (err) {
      showAlert('error', err.response?.data?.error || 'Failed to submit customer.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this customer? / මෙම පාරිභෝගික ගිණුම ඉවත් කිරීමට අවශ්‍ය බව සහතිකද?')) return;
    try {
      await api.delete(`/customers/${id}`);
      showAlert('success', 'Customer deleted.');
      loadCustomers();
    } catch (err) {
      showAlert('error', err.response?.data?.error || 'Customer is linked to active transactions and cannot be deleted.');
    }
  };

  // ==========================================
  // LEDGER AUDITING
  // ==========================================
  const handleViewLedger = async (customer) => {
    try {
      const res = await api.get(`/customers/${customer.id}/ledger`);
      setLedgerHistory(res.data);
      setSelectedCustomer(customer);
      setLedgerModalOpen(true);
    } catch {
      showAlert('error', 'Failed to retrieve ledger statements.');
    }
  };

  // ==========================================
  // PAYMENT LOGS
  // ==========================================
  const handleOpenPayment = (customer) => {
    setSelectedCustomer(customer);
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
      showAlert('error', 'Payment amount must be greater than zero.');
      return;
    }

    try {
      await api.post(`/customers/${selectedCustomer.id}/payment`, paymentForm);
      showAlert('success', 'Payment received and logged in customer ledger.');
      setPaymentModalOpen(false);
      loadCustomers();
    } catch (err) {
      showAlert('error', err.response?.data?.error || 'Failed to record payment.');
    }
  };

  // ==========================================
  // DEBIT/CREDIT ADJUSTMENTS
  // ==========================================
  const handleOpenAdjust = (customer) => {
    setSelectedCustomer(customer);
    setAdjustForm({
      amount: '',
      type: 'DEBIT',
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
      showAlert('error', 'An adjustment explanation is required.');
      return;
    }

    try {
      await api.post(`/customers/${selectedCustomer.id}/adjustment`, adjustForm);
      showAlert('success', 'Ledger adjustment posted successfully.');
      setAdjustModalOpen(false);
      loadCustomers();
    } catch (err) {
      showAlert('error', err.response?.data?.error || 'Failed to post adjustment.');
    }
  };

  const money = (value) =>
    `Rs. ${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const totalToCollect = customers.reduce((sum, c) => sum + Math.max(Number(c.currentBalance || 0), 0), 0);
  const totalToPay = customers.reduce((sum, c) => sum + Math.max(-Number(c.currentBalance || 0), 0), 0);

  if (loading && customers.length < 0) {
    return (
      <div className="book-screen">
        <div className="book-body credit-empty">
          <div className="credit-tabs">
            <button type="button" className="active">👥 Customers</button>
            <button type="button">🚚 Suppliers</button>
          </div>

          <div className="summary-grid">
            <div className="summary-card red">
              Total to Collect
              <strong>Rs. 0</strong>
            </div>
            <div className="summary-card green">
              Total to Pay
              <strong>Rs. 0</strong>
            </div>
          </div>

          <div className="credit-search">
            <Search size={34} />
            <span>Search by Customer Name / Number</span>
          </div>

          <div className="empty-copy">
            <FileText size={96} className="empty-illustration" />
            <p className="!mt-8 !text-[30px] !font-black">No customer added</p>
          </div>

          <div className="empty-cta-area">
            <div>
              Tap the button below and enter the first
              <br />
              transaction.
              <span className="empty-arrow">↓</span>
            </div>
            <button className="primary-book-button" type="button" onClick={handleOpenAdd}>
              Add Customer
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="credit-book-page space-y-4">
      <section className="credit-book-panel">
        <div className="credit-book-top credit-section-card">
          <div>
            <p className="credit-book-eyebrow">Credit Book</p>
            <h2 className="credit-book-title">
              <Users size={22} />
              Customers
            </h2>
          </div>

          <button type="button" onClick={handleOpenAdd} className="credit-primary-action">
            <Plus size={16} />
            Add Customer
          </button>
        </div>

        <div className="credit-section-card tabs-card">
          <nav className="credit-book-tabs" aria-label="Credit book pages">
            <Link to="/customers" className="active">
              <Users size={18} />
              Customers
            </Link>
            <Link to="/suppliers">
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
            <small>{customers.length} customer account{customers.length === 1 ? '' : 's'}</small>
          </div>

          <div className="credit-summary-grid">
            <div className="credit-summary-card collect">
              <span>Total to Collect</span>
              <strong>{money(totalToCollect)}</strong>
            </div>
            <div className="credit-summary-card pay">
              <span>Total to Pay</span>
              <strong>{money(totalToPay)}</strong>
            </div>
          </div>
        </div>

        <div className="credit-section-card compact">
          <div className="credit-section-heading">
            <span>Find Accounts</span>
            <small>{statusFilter || 'All statuses'}</small>
          </div>

          <div className="credit-controls">
            <label className="credit-search-box">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search name, phone or address"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </label>

            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div className="credit-list-section">
          <div className="credit-section-heading">
            <span>Customer Accounts</span>
            <small>{customers.length ? `${customers.length} shown` : 'No records'}</small>
          </div>

          <div className="credit-cards-panel">
          {loading ? (
            <div className="credit-empty-card">
              <FileText size={44} />
              <strong>Loading customers...</strong>
            </div>
          ) : customers.length === 0 ? (
            <div className="credit-empty-card">
              <FileText size={54} />
              <strong>No customer added</strong>
              <span>Tap the button below and enter the first transaction.</span>
              <button type="button" onClick={handleOpenAdd} className="credit-primary-action wide">
                <Plus size={16} />
                Add Customer
              </button>
            </div>
          ) : (
            <div className="credit-card-grid">
              {customers.map((c) => {
                const balance = Number(c.currentBalance || 0);
                const hasDebt = balance > 0;
                const isCashCustomer = c.name.toLowerCase() === 'cash customer';

                return (
                  <article key={c.id} className={`credit-account-card ${hasDebt ? 'debt' : balance < 0 ? 'advance' : ''}`}>
                    <div className="credit-account-head">
                      <div>
                        <h3>{c.name}</h3>
                        <p>{c.phone || 'No phone number'}</p>
                      </div>
                      <span className={`credit-status ${c.status === 'Active' ? 'active' : 'inactive'}`}>
                        {c.status}
                      </span>
                    </div>

                    <div className="credit-detail-grid">
                      <div>
                        <span>Address</span>
                        <strong>{c.address || '-'}</strong>
                      </div>
                      <div>
                        <span>Balance</span>
                        <strong className={hasDebt ? 'text-red-650' : balance < 0 ? 'text-green-650' : 'text-stone-600'}>
                          {money(balance)}
                        </strong>
                      </div>
                    </div>

                    <div className="credit-action-row">
                      <button type="button" onClick={() => handleViewLedger(c)}>
                        <FileText size={13} />
                        Ledger
                      </button>

                      {!isCashCustomer && (
                        <button type="button" onClick={() => handleOpenPayment(c)}>
                          <Receipt size={13} />
                          Payment
                        </button>
                      )}

                      {!isCashCustomer && (user?.role === 'ADMIN' || user?.role === 'CASHIER') && (
                        <button type="button" onClick={() => handleOpenAdjust(c)} aria-label={`Adjust ${c.name}`}>
                          <Landmark size={13} />
                        </button>
                      )}

                      <button type="button" onClick={() => handleOpenEdit(c)} aria-label={`Edit ${c.name}`}>
                        <Edit size={13} />
                      </button>

                      {user?.role === 'ADMIN' && !isCashCustomer && (
                        <button type="button" onClick={() => handleDelete(c.id)} aria-label={`Delete ${c.name}`} className="danger">
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
            <Users size={22} className="text-wood-600" />
            {translate("Customer Ledgers & Receivables", "පාරිභෝගික ගිණුම් සහ ලැබීම්")}
          </h2>
          <p className="text-xs text-stone-400 font-semibold mt-1">
            {translate("Track customer outstanding debts (receivable balance), collect advances/installments, and audit customer ledgers.", "හිඟ වාරික ලබාගැනීම, වාරික පාලනය සහ පාරිභෝගික ගිණුම් විස්තර විගණනය.")}
          </p>
        </div>

        <div>
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 rounded-lg bg-wood-600 px-4 py-2 text-xs font-bold text-white hover:bg-wood-700 shadow-md transition-all"
          >
            <Plus size={15} />
            {translate("Register Customer", "නව පාරිභෝගිකයෙකු ලියාපදිංචි කරන්න")}
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

      {/* SEARCH AND FILTERS */}
      <div className="hidden grid-cols-1 gap-4 md:grid-cols-3 bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
        {/* Search */}
        <div className="relative md:col-span-2">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-stone-400">
            <Search size={16} />
          </span>
          <input
            type="text"
            placeholder={translate("Search Customer Name, Phone number, Address...", "නම, දුරකථන අංකය, ලිපිනය අනුව සොයන්න...")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-stone-200 pl-9 pr-3 py-2 text-xs bg-stone-50 text-stone-800 placeholder-stone-400 focus:outline-none focus:border-wood-500 focus:bg-white transition-all"
          />
        </div>

        {/* Status Select */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-stone-200 px-3 py-2 text-xs bg-stone-50 text-stone-700 focus:outline-none focus:border-wood-500 focus:bg-white transition-all font-semibold"
        >
          <option value="">{translate("All Statuses", "සියලුම තත්ත්වයන්")}</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>

      {/* CUSTOMERS TABLE */}
      <div className="hidden rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-stone-50 text-stone-400 font-bold uppercase tracking-wider border-b border-stone-150">
                <th className="p-3.5">{translate("Customer Name", "පාරිභෝගික නම")}</th>
                <th className="p-3.5">{translate("Phone Number", "දුරකථනය")}</th>
                <th className="p-3.5">{translate("Address", "ලිපිනය")}</th>
                <th className="p-3.5 text-right">{translate("Receivable Balance", "ලැබීමට ඇති මුදල")}</th>
                <th className="p-3.5">{translate("Status", "තත්ත්වය")}</th>
                <th className="p-3.5 text-center">{translate("Actions / Ledger Collections", "ක්‍රියාමාර්ග සහ ලැබීම්")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 font-medium">
              {customers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-stone-400 font-bold">
                    {translate("No registered customers found.", "පාරිභෝගිකයින් කිසිවක් හමු නොවීය.")}
                  </td>
                </tr>
              ) : (
                customers.map((c) => {
                  const hasDebt = c.currentBalance > 0;
                  const isCashCustomer = c.name.toLowerCase() === 'cash customer';
                  return (
                    <tr key={c.id} className="hover:bg-stone-50">
                      <td className="p-3.5 font-bold text-stone-850">{c.name}</td>
                      <td className="p-3.5 text-stone-500 font-semibold">{c.phone}</td>
                      <td className="p-3.5 text-stone-500 max-w-xs truncate">{c.address || '-'}</td>
                      <td className="p-3.5 text-right font-black">
                        <span className={hasDebt ? 'text-red-650' : c.currentBalance < 0 ? 'text-green-650' : 'text-stone-500'}>
                          Rs. {c.currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          c.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-150 text-stone-700'
                        }`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleViewLedger(c)}
                            title="Audit Ledger"
                            className="p-1 rounded-lg border border-stone-200 text-stone-500 hover:text-wood-650 hover:bg-stone-100 transition-colors flex items-center gap-1 font-bold text-[10px] px-2"
                          >
                            <FileText size={13} />
                            {translate("Ledger", "ලෙජරය")}
                          </button>

                          {!isCashCustomer && (
                            <>
                              <button
                                onClick={() => handleOpenPayment(c)}
                                title="Collect Payment"
                                className="p-1 rounded-lg border border-wood-200 text-wood-600 hover:text-white hover:bg-wood-600 transition-all flex items-center gap-1 font-bold text-[10px] px-2 shadow-sm"
                              >
                                <Receipt size={13} />
                                {translate("Payment", "ලැබීම්")}
                              </button>

                              {(user?.role === 'ADMIN' || user?.role === 'CASHIER') && (
                                <button
                                  onClick={() => handleOpenAdjust(c)}
                                  title="Manual Adjustment"
                                  className="p-1 rounded-lg border border-stone-250 text-stone-600 hover:text-stone-850 hover:bg-stone-150 transition-colors"
                                >
                                  <Landmark size={13} />
                                </button>
                              )}
                            </>
                          )}
                          
                          <button
                            onClick={() => handleOpenEdit(c)}
                            className="p-1 rounded-lg border border-stone-200 text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition-colors"
                          >
                            <Edit size={13} />
                          </button>
                          
                          {user?.role === 'ADMIN' && !isCashCustomer && (
                            <button
                              onClick={() => handleDelete(c.id)}
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
         CUSTOMER FORM MODAL (ADD & EDIT)
         ========================================== */}
      {customerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h3 className="text-base font-bold text-stone-850 flex items-center gap-1.5">
                <Users size={18} className="text-wood-650" />
                {selectedCustomer ? translate("Modify Customer Profile", "පාරිභෝගික ගිණුම සංස්කරණය") : translate("Register New Customer", "නව පාරිභෝගිකයෙකු ඇතුළත් කිරීම")}
              </h3>
              <button onClick={() => setCustomerModalOpen(false)} className="text-stone-400 hover:text-stone-800">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCustomerSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-stone-600">Full Name / සම්පූර්ණ නම *</label>
                  <input
                    type="text"
                    required
                    value={custForm.name}
                    onChange={(e) => setCustForm({ ...custForm, name: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-stone-50 text-stone-800 focus:outline-none focus:border-wood-500"
                    placeholder="e.g. Navin Rodrigo"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-600">Phone Number / දුරකථන අංකය *</label>
                  <input
                    type="text"
                    required
                    value={custForm.phone}
                    onChange={(e) => setCustForm({ ...custForm, phone: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-stone-50 text-stone-800 focus:outline-none focus:border-wood-500"
                    placeholder="e.g. 0771234567"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-stone-600">Address / ලිපිනය</label>
                  <input
                    type="text"
                    value={custForm.address}
                    onChange={(e) => setCustForm({ ...custForm, address: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-stone-50 text-stone-800 focus:outline-none focus:border-wood-500"
                    placeholder="e.g. Colombo Road, Negombo"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-600">Email Address</label>
                  <input
                    type="email"
                    value={custForm.email}
                    onChange={(e) => setCustForm({ ...custForm, email: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-stone-50 text-stone-800 focus:outline-none focus:border-wood-500"
                    placeholder="e.g. name@domain.com"
                  />
                </div>

                {!selectedCustomer && (
                  <div>
                    <label className="block text-xs font-bold text-stone-600">Opening Balance / ආරම්භක ශේෂය (Rs.)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={custForm.openingBalance}
                      onChange={(e) => setCustForm({ ...custForm, openingBalance: parseFloat(e.target.value) || 0 })}
                      className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-stone-50 text-stone-800 focus:outline-none focus:border-wood-500"
                      placeholder="Outstanding debt if any"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-stone-600">Status / ක්‍රියාකාරීත්වය</label>
                  <select
                    value={custForm.status}
                    onChange={(e) => setCustForm({ ...custForm, status: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-stone-50 text-stone-800 focus:outline-none focus:border-wood-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-600">Special Notes / සටහන්</label>
                <textarea
                  rows="2"
                  value={custForm.notes}
                  onChange={(e) => setCustForm({ ...custForm, notes: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-stone-50 text-stone-800 focus:outline-none focus:border-wood-500"
                  placeholder="Loyal customer / Installment buyer details..."
                ></textarea>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setCustomerModalOpen(false)}
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
         CUSTOMER LEDGER VIEWER MODAL
         ========================================== */}
      {ledgerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl rounded-xl bg-white p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div>
                <h3 className="text-base font-bold text-stone-850 flex items-center gap-1.5">
                  <FileText size={18} className="text-wood-650" />
                  {translate("Ledger Statement for ", "ගිණුම් විස්තරය: ")} {selectedCustomer?.name}
                </h3>
                <span className="text-[10px] text-stone-400 font-semibold">{translate("Phone: ", "දුරකථන: ")} {selectedCustomer?.phone}</span>
              </div>
              <button onClick={() => setLedgerModalOpen(false)} className="text-stone-400 hover:text-stone-800">
                <X size={20} />
              </button>
            </div>

            {/* Balances bar */}
            <div className="mt-4 p-4 rounded-lg bg-stone-50 border border-stone-200/50 flex justify-between items-center text-xs font-bold">
              <span className="text-stone-500">{translate("RECEIVABLE BALANCE / ලැබීමට ඇති මුළු මුදල", "ලැබීමට ඇති මුළු මුදල")}</span>
              <span className={`text-base font-black ${selectedCustomer?.currentBalance > 0 ? 'text-red-650' : 'text-green-650'}`}>
                Rs. {selectedCustomer?.currentBalance?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>

            {/* Ledger Transactions */}
            <div className="mt-4 ledger-card-list">
              {ledgerHistory.length === 0 ? (
                <div className="ledger-empty-card">No transactions logged in this ledger yet.</div>
              ) : (
                ledgerHistory.map((item) => (
                  <article key={item.id} className="ledger-card">
                    <div className="ledger-card-main">
                      <div>
                        <strong>{item.referenceNo || item.transactionType}</strong>
                        <span>{new Date(item.date).toLocaleString()}</span>
                      </div>
                      <span className="ledger-type">{item.transactionType}</span>
                    </div>
                    <p>{item.description}</p>
                    <div className="ledger-amount-grid">
                      <div className="debit">
                        <span>Debit</span>
                        <strong>{item.debit > 0 ? `+ ${money(item.debit)}` : '-'}</strong>
                      </div>
                      <div className="credit">
                        <span>Credit</span>
                        <strong>{item.credit > 0 ? `- ${money(item.credit)}` : '-'}</strong>
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
                    <th className="p-3">{translate("Date / Time", "දිනය සහ වේලාව")}</th>
                    <th className="p-3">{translate("Reference / Type", "යොමුව / වර්ගය")}</th>
                    <th className="p-3">{translate("Description", "විස්තරය")}</th>
                    <th className="p-3 text-right">{translate("Debit (Sale) (+)", "හර (+)")}</th>
                    <th className="p-3 text-right">{translate("Credit (Pay) (-)", "බැර (-)")}</th>
                    <th className="p-3 text-right">{translate("Balance After", "ශේෂය")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-semibold">
                  {ledgerHistory.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-stone-400 font-bold">No transactions logged in this ledger yet.</td>
                    </tr>
                  ) : (
                    ledgerHistory.map((item) => (
                      <tr key={item.id} className="hover:bg-stone-50">
                        <td className="p-3 text-stone-400">{new Date(item.date).toLocaleString()}</td>
                        <td className="p-3 text-stone-600">
                          <span className="font-bold">{item.referenceNo}</span>
                          <p className="text-[10px] font-medium text-stone-400 uppercase">{item.transactionType}</p>
                        </td>
                        <td className="p-3 text-stone-600 max-w-xs">{item.description}</td>
                        <td className="p-3 text-right text-red-650 font-bold">{item.debit > 0 ? `+ Rs. ${item.debit.toLocaleString()}` : '-'}</td>
                        <td className="p-3 text-right text-green-650 font-bold">{item.credit > 0 ? `- Rs. ${item.credit.toLocaleString()}` : '-'}</td>
                        <td className="p-3 text-right font-black text-stone-800">Rs. {item.balanceAfter.toLocaleString()}</td>
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
         PAYMENT COLLECTION MODAL
         ========================================== */}
      {paymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h3 className="text-base font-bold text-stone-850 flex items-center gap-1.5">
                <Receipt size={18} className="text-wood-650" />
                {translate("Collect Payment / මුදල් ලැබීම", "පාරිභෝගික ගෙවීම් ලබාගැනීම")}
              </h3>
              <button onClick={() => setPaymentModalOpen(false)} className="text-stone-400 hover:text-stone-800">
                <X size={20} />
              </button>
            </div>

            <div className="mt-3 py-2 px-3 rounded bg-red-50 text-[11px] font-bold text-red-750 flex justify-between items-center">
              <span>{translate("Outstanding Balance:", "දැනට පවතින හිඟ මුදල:")}</span>
              <span>Rs. {selectedCustomer?.currentBalance?.toLocaleString()}</span>
            </div>

            <form onSubmit={handlePaymentSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-600">Payment Amount / ලැබුණු මුදල (Rs.) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2.5 text-xs bg-stone-50 text-stone-800 focus:outline-none focus:border-wood-500 font-extrabold text-base"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-600">Payment Method / ලැබුණු ක්‍රමය *</label>
                <select
                  value={paymentForm.paymentMethod}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-stone-50 text-stone-850 focus:outline-none focus:border-wood-500 font-bold"
                >
                  <option value="Cash">Cash (මුදල්)</option>
                  <option value="Card">Card (කාඩ්පත්)</option>
                  <option value="Bank Transfer">Bank Transfer (බැංකු ප්‍රේෂණ)</option>
                  <option value="Cheque">Cheque (චෙක්පත්)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-600">Reference No. (Cheque/Slip/Bank details)</label>
                <input
                  type="text"
                  value={paymentForm.referenceNumber}
                  onChange={(e) => setPaymentForm({ ...paymentForm, referenceNumber: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-stone-50 text-stone-800 focus:outline-none focus:border-wood-500"
                  placeholder="e.g. TXN-998822 / Cheque No"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-600">Receipt Date / දිනය</label>
                <input
                  type="date"
                  value={paymentForm.date}
                  onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-stone-50 text-stone-800 focus:outline-none focus:border-wood-500 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-600">Notes / සටහන්</label>
                <input
                  type="text"
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-stone-50 text-stone-800 focus:outline-none focus:border-wood-500"
                  placeholder="e.g. Paid installment 2"
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
                  Post Payment / ලැබීම් ඇතුළත් කරන්න
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
                {translate("Post Ledger Adjustment", "මතක සටහන් ගැලපුම")}
              </h3>
              <button onClick={() => setAdjustModalOpen(false)} className="text-stone-400 hover:text-stone-800">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-600">Adjustment Type / ගැලපුම් වර්ගය *</label>
                <select
                  value={adjustForm.type}
                  onChange={(e) => setAdjustForm({ ...adjustForm, type: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-stone-50 text-stone-850 focus:outline-none focus:border-wood-500 font-bold"
                >
                  <option value="DEBIT">DEBIT (හර) - Owed amount INCREASES (+)</option>
                  <option value="CREDIT">CREDIT (බැර) - Owed amount DECREASES (-)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-600">Adjustment Amount / ගැලපුම් මුදල (Rs.) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={adjustForm.amount}
                  onChange={(e) => setAdjustForm({ ...adjustForm, amount: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-stone-50 text-stone-800 focus:outline-none focus:border-wood-500 font-extrabold"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-600">Explanation / හේතුව *</label>
                <input
                  type="text"
                  required
                  value={adjustForm.description}
                  onChange={(e) => setAdjustForm({ ...adjustForm, description: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-stone-50 text-stone-800 focus:outline-none focus:border-wood-500"
                  placeholder="e.g. Correcting double entry on invoice #1002"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-600">Adjustment Date</label>
                <input
                  type="date"
                  value={adjustForm.date}
                  onChange={(e) => setAdjustForm({ ...adjustForm, date: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-stone-50 text-stone-800 focus:outline-none focus:border-wood-500"
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
