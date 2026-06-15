import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import useDebouncedValue from '../hooks/useDebouncedValue';
import { ArrowDown, ArrowUp, DollarSign, FileSearch, Plus, Search, Edit2, Trash2, X, CheckCircle } from 'lucide-react';

export default function Expenses() {
  const { user } = useAuth();
  
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState(localStorage.getItem('vinco_lang') || 'en');

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebouncedValue(searchTerm);
  const [categoryFilter, setCategoryFilter] = useState('');

  // Modals state
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);

  // Form state
  const [expForm, setExpForm] = useState({
    expenseType: 'Rent',
    amount: '',
    paidTo: '',
    paymentMethod: 'Cash',
    description: '',
    date: new Date().toISOString().split('T')[0]
  });

  // Alert Msg
  const [alertMsg, setAlertMsg] = useState({ type: '', text: '' });

  const translate = (en, si) => (lang === 'en' ? en : si);

  function showAlert(type, text) {
    setAlertMsg({ type, text });
    setTimeout(() => setAlertMsg({ type: '', text: '' }), 5000);
  }

  useEffect(() => {
    const handleLangChange = () => setLang(localStorage.getItem('vinco_lang') || 'en');
    window.addEventListener('languageChange', handleLangChange);
    return () => window.removeEventListener('languageChange', handleLangChange);
  }, []);

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const query = `?search=${encodeURIComponent(debouncedSearchTerm)}&expenseType=${encodeURIComponent(categoryFilter)}`;
      const res = await api.get(`/expenses${query}`);
      setExpenses(Array.isArray(res.data) ? res.data : (res.data.expenses || []));
    } catch (err) {
      console.error(err);
      showAlert('error', 'Failed to retrieve expenses records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, [debouncedSearchTerm, categoryFilter]);

  const handleOpenAdd = () => {
    setSelectedExpense(null);
    setExpForm({
      expenseType: 'Rent',
      amount: '',
      paidTo: '',
      paymentMethod: 'Cash',
      description: '',
      date: new Date().toISOString().split('T')[0]
    });
    setExpenseModalOpen(true);
  };

  const handleExpenseSubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(expForm.amount);
    if (isNaN(amt) || amt <= 0) {
      showAlert('error', 'Expense amount must be greater than zero.');
      return;
    }
    if (!expForm.description.trim()) {
      showAlert('error', 'Description is required.');
      return;
    }
    if (!expForm.paidTo.trim()) {
      showAlert('error', 'Paid to is required.');
      return;
    }

    try {
      await api.post('/expenses', expForm);
      showAlert('success', 'Expense log recorded successfully.');
      setExpenseModalOpen(false);
      loadExpenses();
    } catch (err) {
      showAlert('error', err.response?.data?.error || 'Failed to record expense.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this expense record? / මෙම වියදම් ලේඛනය ඉවත් කිරීමට අවශ්‍ය බව සහතිකද?')) return;
    try {
      await api.delete(`/expenses/${id}`);
      showAlert('success', 'Expense record deleted.');
      loadExpenses();
    } catch (err) {
      showAlert('error', err.response?.data?.error || 'Deletion failed.');
    }
  };

  const totalExpenseAmount = expenses.reduce((acc, exp) => acc + Number(exp.amount || 0), 0);
  const todayLabel = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });

  const emptyCashBook =
    !loading &&
    expenses.length === 0 &&
    !searchTerm &&
    !categoryFilter &&
    !alertMsg.text &&
    !expenseModalOpen;

  if (emptyCashBook) {
    return (
      <div className="book-screen">
        <div className="book-body cash-empty">
          <section className="soft-card cash-balance-card">
            <button type="button" className="cash-period-button">
              This week's balance
              <span>⌄</span>
            </button>
            <strong>Rs. 0</strong>
          </section>

          <button type="button" className="soft-card report-button">
            <FileSearch size={35} />
            View Reports
          </button>

          <section className="cash-day-card">
            <div className="cash-day-grid">
              <span>{todayLabel}</span>
              <span>In (Rs.)</span>
              <span>Out (Rs.)</span>
            </div>
            <div className="cash-day-grid strong">
              <strong>0 transactions</strong>
              <b className="in">0</b>
              <b className="out">0</b>
            </div>
          </section>

          <div className="empty-copy cash-copy">
            <FileSearch size={90} className="empty-illustration" />
            <p>Let's make this week's entries</p>
          </div>

          <div className="cash-actions">
            <div className="cash-action-copy">
              <span>Add money you receive (Income)</span>
              <span className="empty-arrow">↓</span>
            </div>
            <div className="cash-action-copy">
              <span>Add money you paid (Expense)</span>
              <span className="empty-arrow">↓</span>
            </div>
            <Link to="/billing" className="cash-button cash-in">
              <ArrowUp size={33} />
              Cash In
            </Link>
            <button className="cash-button cash-out" type="button" onClick={handleOpenAdd}>
              <ArrowDown size={33} />
              Cash Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-stone-850 flex items-center gap-2">
            <DollarSign size={22} className="text-wood-650" />
            {translate("Miscellaneous Shop Expenses Tracker", "හදිසි සහ මෙහෙයුම් වියදම් ලොගය")}
          </h2>
          <p className="text-xs text-stone-400 font-semibold mt-1">
            {translate("Record rent, electricity bills, employee salary advances, transportation costs, and other administrative expenses.", "කුලී, විදුලි බිල්පත්, ප්‍රවාහන ගාස්තු සහ වෙනත් බාහිර වියදම් වාර්තා කිරීම.")}
          </p>
        </div>
        <div>
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 rounded-lg bg-wood-600 px-4 py-2 text-xs font-bold text-white hover:bg-wood-700 shadow-md"
          >
            <Plus size={15} />
            {translate("Log Expense", "වියදමක් සටහන් කරන්න")}
          </button>
        </div>
      </div>

      {/* ALERT */}
      {alertMsg.text && (
        <div className={`p-4 rounded-lg border text-sm font-semibold ${
          alertMsg.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {alertMsg.text}
        </div>
      )}

      {/* SEARCH AND FILTERS */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4 bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
        <div className="relative md:col-span-2">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-stone-400">
            <Search size={16} />
          </span>
          <input
            type="text"
            placeholder={translate("Search description notes...", "සටහන් විස්තර අනුව සොයන්න...")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-stone-200 pl-9 pr-3 py-2 text-xs bg-stone-50 text-stone-850"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-stone-200 px-3 py-2 text-xs bg-stone-50 text-stone-700 font-semibold"
        >
          <option value="">{translate("All Categories", "සියලුම කාණ්ඩයන්")}</option>
          <option value="Rent">Rent (කුලිය)</option>
          <option value="Electricity">Electricity (විදුලිය)</option>
          <option value="Water">Water (ජලය)</option>
          <option value="Salary">Salary (වැටුප්)</option>
          <option value="Transport">Transport (ප්‍රවාහනය)</option>
          <option value="Custom Made Furniture Wood">Custom wood raw materials (අමුද්‍රව්‍ය)</option>
          <option value="Other">Other (වෙනත්)</option>
        </select>

        <div className="bg-stone-50 p-2.5 rounded-lg border border-stone-200 flex justify-between items-center text-xs font-bold text-stone-600">
          <span>Filtered Total:</span>
          <span className="text-sm font-black text-red-650">Rs. {totalExpenseAmount.toLocaleString()}</span>
        </div>
      </div>

      {/* TABLE */}
      <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-stone-50 text-stone-400 font-bold uppercase border-b border-stone-150">
                <th className="p-3.5">Date</th>
                <th className="p-3.5">Category</th>
                <th className="p-3.5">Description / Reason</th>
                <th className="p-3.5 text-right">Expense Amount (Rs.)</th>
                <th className="p-3.5 text-center">Delete</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 font-medium text-stone-700">
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-stone-400 font-bold">No expenses found.</td>
                </tr>
              ) : (
                expenses.map((e) => (
                  <tr key={e.id} className="hover:bg-stone-50">
                    <td className="p-3.5 font-bold text-stone-850">{new Date(e.date).toLocaleDateString()}</td>
                    <td className="p-3.5">
                      <span className="inline-flex rounded bg-stone-100 px-2 py-0.5 text-[10px] font-bold uppercase text-stone-750">
                        {e.expenseType}
                      </span>
                    </td>
                    <td className="p-3.5 text-stone-550 max-w-md truncate">
                      <span className="font-bold text-stone-700">{e.description}</span>
                      <span className="block text-[10px] text-stone-400">Paid to: {e.paidTo} | {e.paymentMethod}</span>
                    </td>
                    <td className="p-3.5 text-right font-black text-red-750">Rs. {Number(e.amount || 0).toLocaleString()}</td>
                    <td className="p-3.5 text-center">
                      {user?.role === 'ADMIN' && (
                        <button
                          onClick={() => handleDelete(e.id)}
                          className="p-1 rounded border border-stone-200 text-stone-400 hover:text-red-650 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ==========================================
         EXPENSE FORM MODAL
         ========================================== */}
      {expenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h3 className="text-base font-bold text-stone-850 flex items-center gap-1.5">
                <DollarSign size={18} className="text-wood-650" />
                Log Miscellaneous Shop Expense
              </h3>
              <button onClick={() => setExpenseModalOpen(false)} className="text-stone-400 hover:text-stone-800">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleExpenseSubmit} className="mt-4 space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-stone-650">Expense Category *</label>
                <select
                  value={expForm.expenseType}
                  onChange={(e) => setExpForm({ ...expForm, expenseType: e.target.value })}
                  className="mt-1.5 block w-full rounded-lg border border-stone-200 px-3 py-2 bg-stone-50 text-stone-850 font-bold"
                >
                  <option value="Rent">Rent</option>
                  <option value="Electricity">Electricity</option>
                  <option value="Water">Water</option>
                  <option value="Salary">Salary</option>
                  <option value="Transport">Transport</option>
                  <option value="Custom Made Furniture Wood">Custom wood raw materials</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-stone-600">Expense Amount (Rs.) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={expForm.amount}
                  onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })}
                  className="mt-1.5 block w-full rounded-lg border border-stone-200 px-3 py-2 text-stone-900 font-extrabold text-base"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-stone-600">Paid To *</label>
                <input
                  type="text"
                  required
                  value={expForm.paidTo}
                  onChange={(e) => setExpForm({ ...expForm, paidTo: e.target.value })}
                  className="mt-1.5 block w-full rounded-lg border border-stone-200 px-3 py-2 bg-stone-50 text-stone-800"
                  placeholder="e.g. CEB, Landlord, Driver, Staff member"
                />
              </div>

              <div>
                <label className="block text-stone-600">Payment Method *</label>
                <select
                  required
                  value={expForm.paymentMethod}
                  onChange={(e) => setExpForm({ ...expForm, paymentMethod: e.target.value })}
                  className="mt-1.5 block w-full rounded-lg border border-stone-200 px-3 py-2 bg-stone-50 text-stone-850 font-bold"
                >
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Online">Online</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-stone-605">Expense Date</label>
                <input
                  type="date"
                  value={expForm.date}
                  onChange={(e) => setExpForm({ ...expForm, date: e.target.value })}
                  className="mt-1.5 block w-full rounded-lg border border-stone-200 px-3 py-2 bg-stone-50 text-stone-850 font-bold"
                />
              </div>

              <div>
                <label className="block text-stone-600">Description / Reason *</label>
                <input
                  type="text"
                  required
                  value={expForm.description}
                  onChange={(e) => setExpForm({ ...expForm, description: e.target.value })}
                  className="mt-1.5 block w-full rounded-lg border border-stone-200 px-3 py-2 bg-stone-50 text-stone-800"
                  placeholder="e.g. Paid showroom electricity bill for April"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setExpenseModalOpen(false)}
                  className="rounded-lg border border-stone-200 px-4 py-2.5 text-xs font-bold text-stone-600 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-wood-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-wood-750 shadow-md"
                >
                  Log Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
