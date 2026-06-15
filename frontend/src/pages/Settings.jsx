import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  Settings as SettingsIcon, Building, Shield, Database, Save, 
  UserPlus, Trash2, Edit2, Key, CheckCircle, ShieldAlert
} from 'lucide-react';

export default function Settings() {
  const { user } = useAuth();
  
  const [bizInfo, setBizInfo] = useState(null);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState(localStorage.getItem('vinco_lang') || 'en');

  // Form states
  const [bizForm, setBizForm] = useState({
    shopName: '',
    address: '',
    phone1: '',
    phone2: '',
    email: '',
    website: '',
    receiptFooterText: ''
  });

  const [userForm, setUserForm] = useState({
    name: '',
    username: '',
    password: '',
    role: 'CASHIER'
  });

  // Alert State
  const [alertMsg, setAlertMsg] = useState({ type: '', text: '' });

  const translate = (en, si) => (lang === 'en' ? en : si);

  useEffect(() => {
    const handleLangChange = () => setLang(localStorage.getItem('vinco_lang') || 'en');
    window.addEventListener('languageChange', handleLangChange);
    return () => window.removeEventListener('languageChange', handleLangChange);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const bizRes = await api.get('/settings/business');
      if (bizRes.data) {
        setBizInfo(bizRes.data);
        setBizForm({
          shopName: bizRes.data.shopName || '',
          address: bizRes.data.address || '',
          phone1: bizRes.data.phone1 || '',
          phone2: bizRes.data.phone2 || '',
          email: bizRes.data.email || '',
          website: bizRes.data.website || '',
          receiptFooterText: bizRes.data.receiptFooterText || ''
        });
      }

      if (user?.role === 'ADMIN') {
        const usersRes = await api.get('/users');
        setUsers(usersRes.data);

        const [invoicesRes, productsRes, customersRes, suppliersRes] = await Promise.all([
          api.get('/invoices'),
          api.get('/products'),
          api.get('/customers'),
          api.get('/suppliers'),
        ]);
        setStats({
          totalInvoices: Array.isArray(invoicesRes.data) ? invoicesRes.data.length : 0,
          totalProducts: Array.isArray(productsRes.data) ? productsRes.data.length : 0,
          totalCustomers: Array.isArray(customersRes.data) ? customersRes.data.length : 0,
          totalSuppliers: Array.isArray(suppliersRes.data) ? suppliersRes.data.length : 0,
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  function showAlert(type, text) {
    setAlertMsg({ type, text });
    setTimeout(() => setAlertMsg({ type: '', text: '' }), 5000);
  }

  const handleBizSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.put('/settings/business', bizForm);
      setBizInfo(res.data);
      showAlert('success', 'Business settings details updated successfully.');
    } catch (err) {
      showAlert('error', err.response?.data?.error || 'Failed to update settings.');
    }
  };

  const handleUserCreate = async (e) => {
    e.preventDefault();
    if (!userForm.name || !userForm.username || !userForm.password) {
      showAlert('error', 'All user fields are required.');
      return;
    }

    try {
      await api.post('/users', userForm);
      showAlert('success', `User account '${userForm.username}' registered successfully.`);
      setUserForm({ name: '', username: '', password: '', role: 'CASHIER' });
      // Reload user list
      const usersRes = await api.get('/users');
      setUsers(usersRes.data);
    } catch (err) {
      showAlert('error', err.response?.data?.error || 'User registration failed.');
    }
  };

  const handleUserDelete = async (id) => {
    if (id === user.id) {
      showAlert('error', 'You cannot delete your own active profile session.');
      return;
    }
    if (!window.confirm('Delete this user login account permanently?')) return;

    try {
      await api.delete(`/users/${id}`);
      showAlert('success', 'User account deleted.');
      const usersRes = await api.get('/users');
      setUsers(usersRes.data);
    } catch (err) {
      showAlert('error', err.response?.data?.error || 'Failed to delete user.');
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <span className="text-xs font-bold text-stone-400">Loading configurations and server info...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-stone-850 flex items-center gap-2">
            <SettingsIcon size={22} className="text-wood-655" />
            {translate("Showroom Profiles & Administrative Settings", "සැකසුම් සහ පරිශීලක පාලක පැනලය")}
          </h2>
          <p className="text-xs text-stone-400 font-semibold mt-1">
            {translate("Customize printable invoice templates, manage cashier login accounts, and view database storage details.", "මුද්‍රිත බිල්පත් ශීර්ෂය වෙනස් කිරීම සහ මුදල් අයකැමි ගිණුම් කළමනාකරණය.")}
          </p>
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        
        {/* BUSINESS INFO PREFERENCES */}
        <div className="lg:col-span-2 space-y-6">
          
          <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm space-y-4">
            <h3 className="font-extrabold text-stone-850 text-xs uppercase tracking-wide flex items-center gap-1.5 border-b border-stone-100 pb-3">
              <Building size={17} className="text-wood-655" />
              Showroom Shop Metadata (Invoice Headers)
            </h3>

            <form onSubmit={handleBizSubmit} className="space-y-4 text-xs font-semibold text-stone-600">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label>Business / Shop Name *</label>
                  <input
                    type="text"
                    required
                    value={bizForm.shopName}
                    onChange={(e) => setBizForm({ ...bizForm, shopName: e.target.value })}
                    className="mt-1.5 block w-full rounded-lg border border-stone-205 px-3 py-2 bg-stone-50 text-stone-850 font-bold"
                  />
                </div>

                <div>
                  <label>Showroom Address *</label>
                  <input
                    type="text"
                    required
                    value={bizForm.address}
                    onChange={(e) => setBizForm({ ...bizForm, address: e.target.value })}
                    className="mt-1.5 block w-full rounded-lg border border-stone-205 px-3 py-2 bg-stone-50 text-stone-850"
                  />
                </div>

                <div>
                  <label>Phone Line 1 *</label>
                  <input
                    type="text"
                    required
                    value={bizForm.phone1}
                    onChange={(e) => setBizForm({ ...bizForm, phone1: e.target.value })}
                    className="mt-1.5 block w-full rounded-lg border border-stone-205 px-3 py-2 bg-stone-50 text-stone-850 font-bold"
                  />
                </div>

                <div>
                  <label>Phone Line 2 (Optional)</label>
                  <input
                    type="text"
                    value={bizForm.phone2}
                    onChange={(e) => setBizForm({ ...bizForm, phone2: e.target.value })}
                    className="mt-1.5 block w-full rounded-lg border border-stone-205 px-3 py-2 bg-stone-50 text-stone-850"
                  />
                </div>

                <div>
                  <label>Email Address</label>
                  <input
                    type="email"
                    value={bizForm.email}
                    onChange={(e) => setBizForm({ ...bizForm, email: e.target.value })}
                    className="mt-1.5 block w-full rounded-lg border border-stone-205 px-3 py-2 bg-stone-50 text-stone-850"
                  />
                </div>

                <div>
                  <label>Website Address</label>
                  <input
                    type="text"
                    value={bizForm.website}
                    onChange={(e) => setBizForm({ ...bizForm, website: e.target.value })}
                    className="mt-1.5 block w-full rounded-lg border border-stone-205 px-3 py-2 bg-stone-50 text-stone-850"
                  />
                </div>
              </div>

              <div>
                <label>Print Receipt Footer Warranty Disclaimer Message *</label>
                <textarea
                  rows="3"
                  required
                  value={bizForm.receiptFooterText}
                  onChange={(e) => setBizForm({ ...bizForm, receiptFooterText: e.target.value })}
                  className="mt-1.5 block w-full rounded-lg border border-stone-205 px-3 py-2 bg-stone-50 text-stone-800"
                ></textarea>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-wood-600 hover:bg-wood-700 px-5 py-2.5 text-xs font-bold text-white shadow-md transition-colors"
                >
                  <Save size={15} />
                  Save Business Info
                </button>
              </div>
            </form>
          </div>

          {/* SYSTEM STATS CARD */}
          {user?.role === 'ADMIN' && stats && (
            <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm space-y-4">
              <h3 className="font-extrabold text-stone-850 text-xs uppercase tracking-wide flex items-center gap-1.5 border-b border-stone-100 pb-3">
                <Database size={17} className="text-wood-655" />
                SQLite Local Storage Stats
              </h3>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-center">
                <div className="p-3 bg-stone-50 border border-stone-150 rounded-lg">
                  <span className="text-[10px] text-stone-400 block uppercase font-bold">Total Invoices</span>
                  <span className="text-sm font-black text-stone-850 mt-1 block">{stats.totalInvoices}</span>
                </div>
                <div className="p-3 bg-stone-50 border border-stone-150 rounded-lg">
                  <span className="text-[10px] text-stone-400 block uppercase font-bold">Total Products</span>
                  <span className="text-sm font-black text-stone-850 mt-1 block">{stats.totalProducts}</span>
                </div>
                <div className="p-3 bg-stone-50 border border-stone-150 rounded-lg">
                  <span className="text-[10px] text-stone-400 block uppercase font-bold">Total Customers</span>
                  <span className="text-sm font-black text-stone-850 mt-1 block">{stats.totalCustomers}</span>
                </div>
                <div className="p-3 bg-stone-50 border border-stone-150 rounded-lg">
                  <span className="text-[10px] text-stone-400 block uppercase font-bold">Total Suppliers</span>
                  <span className="text-sm font-black text-stone-850 mt-1 block">{stats.totalSuppliers}</span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* CASHIERS LOGIN REGISTRY */}
        <div className="space-y-6">
          {user?.role === 'ADMIN' ? (
            <div className="bg-white p-6 rounded-xl border border-stone-250 shadow-md space-y-4">
              <h3 className="font-extrabold text-stone-850 text-xs uppercase tracking-wide flex items-center gap-1.5 border-b border-stone-100 pb-3">
                <Shield size={17} className="text-wood-655" />
                User Profiles & Cashiers Login Registry
              </h3>

              {/* User List */}
              <div className="divide-y divide-stone-100 max-h-48 overflow-y-auto">
                {users.map((u) => (
                  <div key={u.id} className="py-2.5 flex justify-between items-center text-xs font-semibold">
                    <div>
                      <p className="text-stone-850 font-bold">{u.name}</p>
                      <p className="text-[10px] text-stone-400 font-medium">@{u.username} | Role: {u.role}</p>
                    </div>
                    {u.id !== user.id && (
                      <button
                        onClick={() => handleUserDelete(u.id)}
                        className="p-1 text-stone-450 hover:text-red-650 transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Register User Form */}
              <form onSubmit={handleUserCreate} className="space-y-3.5 border-t border-stone-100 pt-4 text-xs font-semibold text-stone-600">
                <span className="block text-[10px] uppercase text-stone-450 font-bold tracking-wider">Register new system profile</span>
                
                <div>
                  <label>Staff Full Name *</label>
                  <input
                    type="text"
                    required
                    value={userForm.name}
                    onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-1.5 bg-stone-50 text-stone-850"
                    placeholder="e.g. Ruwan Silva"
                  />
                </div>

                <div>
                  <label>Username (Unique login code) *</label>
                  <input
                    type="text"
                    required
                    value={userForm.username}
                    onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-1.5 bg-stone-50 text-stone-850"
                    placeholder="e.g. ruwan"
                  />
                </div>

                <div>
                  <label>Login Password *</label>
                  <input
                    type="password"
                    required
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-1.5 bg-stone-50 text-stone-850"
                  />
                </div>

                <div>
                  <label>System Role *</label>
                  <select
                    value={userForm.role}
                    onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 bg-stone-50 text-stone-850 font-bold"
                  >
                    <option value="CASHIER">CASHIER (මුදල් අයකැමි)</option>
                    <option value="SALESPERSON">SALESPERSON (විකුණුම්)</option>
                    <option value="DELIVERY_STAFF">DELIVERY STAFF (බෙදාහැරීම්)</option>
                    <option value="ADMIN">ADMINISTRATOR (පරිපාලක)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs py-2.5 transition-colors shadow-sm"
                >
                  <UserPlus size={15} />
                  Add User Account
                </button>
              </form>
            </div>
          ) : (
            <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm text-center py-8">
              <ShieldAlert size={36} className="mx-auto text-stone-400 mb-3" />
              <p className="text-xs font-bold text-stone-600">Access Denied</p>
              <p className="text-[10px] text-stone-400 font-semibold mt-1">
                You must login as Administrator to manage user credentials.
              </p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
