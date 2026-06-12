import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Package, Plus, Search, Edit, Trash2, History,
  ArrowUpRight, ArrowDownLeft, X, AlertTriangle, Layers
} from 'lucide-react';

export default function MaterialsStock() {
  const { user } = useAuth();
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState(localStorage.getItem('alight_lang') || 'en');

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [lowStockFilter, setLowStockFilter] = useState(false);

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);

  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [alertMsg, setAlertMsg] = useState({ type: '', text: '' });

  // Forms
  const [form, setForm] = useState({
    material_name: '',
    material_type: 'Timber',
    current_stock_sqft: 0,
    low_stock_threshold_sqft: 0,
    cost_per_sqft: 0,
  });

  const [adjustForm, setAdjustForm] = useState({
    quantity_change: 0,
    reason: '',
  });

  // Translation helper
  const translate = (en, si) => (lang === 'en' ? en : si);

  useEffect(() => {
    const handleLangChange = () => setLang(localStorage.getItem('alight_lang') || 'en');
    window.addEventListener('languageChange', handleLangChange);
    return () => window.removeEventListener('languageChange', handleLangChange);
  }, []);

  const loadMaterials = async () => {
    setLoading(true);
    try {
      const typeQuery = selectedType ? `&type=${selectedType}` : '';
      const res = await api.get(`/materials-stock?search=${searchTerm}${typeQuery}`);
      let data = res.data;
      if (lowStockFilter) {
        data = data.filter(m => m.current_stock_sqft <= m.low_stock_threshold_sqft);
      }
      setMaterials(data);
    } catch (error) {
      console.error(error);
      showAlert('error', 'Failed to load materials stock records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMaterials();
  }, [searchTerm, selectedType, lowStockFilter]);

  const showAlert = (type, text) => {
    setAlertMsg({ type, text });
    setTimeout(() => setAlertMsg({ type: '', text: '' }), 5000);
  };

  const handleOpenAdd = () => {
    setSelectedMaterial(null);
    setForm({
      material_name: '',
      material_type: 'Timber',
      current_stock_sqft: 0,
      low_stock_threshold_sqft: 10,
      cost_per_sqft: 0,
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (m) => {
    setSelectedMaterial(m);
    setForm({
      material_name: m.material_name,
      material_type: m.material_type,
      current_stock_sqft: m.current_stock_sqft,
      low_stock_threshold_sqft: m.low_stock_threshold_sqft,
      cost_per_sqft: m.cost_per_sqft,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.material_name.trim()) {
      showAlert('error', 'Material name is required.');
      return;
    }

    try {
      if (selectedMaterial) {
        await api.put(`/materials-stock/${selectedMaterial.material_id}`, form);
        showAlert('success', 'Material updated successfully.');
      } else {
        await api.post('/materials-stock', form);
        showAlert('success', 'Material added successfully.');
      }
      setModalOpen(false);
      loadMaterials();
    } catch (err) {
      showAlert('error', err.response?.data?.error || 'Submission failed.');
    }
  };

  const handleOpenAdjust = (m) => {
    setSelectedMaterial(m);
    setAdjustForm({
      quantity_change: '',
      reason: '',
    });
    setAdjustModalOpen(true);
  };

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    const val = parseFloat(adjustForm.quantity_change);
    if (isNaN(val) || val === 0) {
      showAlert('error', 'Please enter a valid, non-zero quantity change.');
      return;
    }
    if (!adjustForm.reason.trim()) {
      showAlert('error', 'Adjustment reason is required.');
      return;
    }

    try {
      await api.post(`/materials-stock/${selectedMaterial.material_id}/adjust`, adjustForm);
      showAlert('success', 'Stock adjusted successfully.');
      setAdjustModalOpen(false);
      loadMaterials();
    } catch (err) {
      showAlert('error', err.response?.data?.error || 'Adjustment failed.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(translate(
      'Are you sure you want to delete this material record? / මෙම අමුද්‍රව්‍ය විස්තරය ඉවත් කිරීමට අවශ්‍ය බව සහතිකද?',
      'Are you sure you want to delete this material record? / මෙම අමුද්‍රව්‍ය විස්තරය ඉවත් කිරීමට අවශ්‍ය බව සහතිකද?'
    ))) return;

    try {
      await api.delete(`/materials-stock/${id}`);
      showAlert('success', 'Material deleted.');
      loadMaterials();
    } catch (err) {
      showAlert('error', err.response?.data?.error || 'Deletion failed.');
    }
  };

  const handleOpenHistory = (m) => {
    setSelectedMaterial(m);
    setHistoryModalOpen(true);
  };

  // Metrics calculation
  const totalItems = materials.length;
  const lowStockItems = materials.filter(m => m.current_stock_sqft <= m.low_stock_threshold_sqft).length;
  const totalStockTimber = materials.filter(m => m.material_type === 'Timber').reduce((sum, m) => sum + m.current_stock_sqft, 0);
  const totalStockBoard = materials.filter(m => m.material_type === 'Board').reduce((sum, m) => sum + m.current_stock_sqft, 0);

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-stone-850 flex items-center gap-2">
            <Layers size={22} className="text-[#B34A1A]" />
            {translate("Materials Stock Module (Raw Timber & Boards)", "අමුද්‍රව්‍ය තොග කළමනාකරණය (තද ලී සහ ලෑලි)")}
          </h2>
          <p className="text-xs text-stone-400 font-semibold mt-1">
            {translate(
              "Track raw timber planks and board stock in square feet (sq ft), adjust levels, and handle shortage thresholds.",
              "වර්ග අඩි වලින් (sq ft) අමුද්‍රව්‍ය තොග ලියාපදිංචිය, අඩු තොග මට්ටම් සහ විගණනය මෙහෙයවීම."
            )}
          </p>
        </div>

        <div>
          {(user?.role === 'ADMIN' || user?.role === 'CASHIER') && (
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#B34A1A] px-4 py-2 text-xs font-bold text-white hover:bg-[#9a3f16] shadow-md transition-all cursor-pointer"
            >
              <Plus size={15} />
              {translate("Add Material", "නව අමුද්‍රව්‍යයක් ඇතුළත් කරන්න")}
            </button>
          )}
        </div>
      </div>

      {/* METRIC SUMMARY CARDS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wide">{translate("Total Material Items", "මුළු අමුද්‍රව්‍ය වර්ග")}</span>
          <span className="text-2xl font-black text-stone-800 mt-2">{totalItems}</span>
        </div>
        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wide">{translate("Low Stock Items", "අඩු තොග අයිතමයන්")}</span>
          <span className={`text-2xl font-black mt-2 ${lowStockItems > 0 ? 'text-red-650' : 'text-stone-800'}`}>{lowStockItems}</span>
        </div>
        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wide">{translate("Total Timber Stock", "මුළු තද ලී තොගය")}</span>
          <span className="text-2xl font-black text-[#B34A1A] mt-2">{totalStockTimber.toFixed(2)} <span className="text-xs font-semibold text-stone-500">sq ft</span></span>
        </div>
        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wide">{translate("Total Board Stock", "මුළු ලෑලි තොගය")}</span>
          <span className="text-2xl font-black text-indigo-600 mt-2">{totalStockBoard.toFixed(2)} <span className="text-xs font-semibold text-stone-500">sq ft</span></span>
        </div>
      </div>

      {/* ALERT MESSAGE */}
      {alertMsg.text && (
        <div className={`p-4 rounded-lg border text-sm font-semibold ${
          alertMsg.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {alertMsg.text}
        </div>
      )}

      {/* SEARCH AND FILTERS */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4 bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
        {/* Search */}
        <div className="relative md:col-span-2">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-stone-400">
            <Search size={16} />
          </span>
          <input
            type="text"
            placeholder={translate("Search raw timber name, code or specifications...", "අමුද්‍රව්‍යයේ නම අනුව සොයන්න...")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-stone-200 pl-9 pr-3 py-2 text-xs bg-stone-50 text-stone-800 placeholder-stone-400 focus:outline-none focus:border-stone-400 focus:bg-white transition-all"
          />
        </div>

        {/* Type Filter */}
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="rounded-lg border border-stone-200 px-3 py-2 text-xs bg-stone-50 text-stone-700 focus:outline-none focus:border-stone-400 focus:bg-white transition-all font-semibold"
        >
          <option value="">{translate("All Types (Timber/Board)", "සියලුම වර්ග")}</option>
          <option value="Timber">Timber</option>
          <option value="Board">Board</option>
        </select>

        {/* Low Stock Filter */}
        <button
          onClick={() => setLowStockFilter(!lowStockFilter)}
          className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition-all shadow-sm cursor-pointer ${
            lowStockFilter
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
          }`}
        >
          <AlertTriangle size={15} />
          {translate("Low Stock Only", "අඩු තොග පමණි")}
        </button>
      </div>

      {/* MATERIALS SPREADSHEET TABLE */}
      <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-stone-50 text-stone-400 font-bold uppercase tracking-wider border-b border-stone-150">
                <th className="p-3.5">{translate("Material Name", "අමුද්‍රව්‍යයේ නම")}</th>
                <th className="p-3.5">{translate("Type", "වර්ගය")}</th>
                <th className="p-3.5 text-right">{translate("Cost per sq ft", "වර්ග අඩියක පිරිවැය")}</th>
                <th className="p-3.5 text-center">{translate("Current Stock", "පවතින තොගය")}</th>
                <th className="p-3.5 text-center">{translate("Threshold Limit", "අඩුම තොග සීමාව")}</th>
                <th className="p-3.5">{translate("Last Updated", "අවසන් වරට යාවත්කාලීන කළේ")}</th>
                <th className="p-3.5 text-center">{translate("Actions", "ක්‍රියාමාර්ග")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-stone-400 font-bold">
                    {translate("Loading material stock...", "අමුද්‍රව්‍ය තොග පූරණය වෙමින් පවතී...")}
                  </td>
                </tr>
              ) : materials.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-stone-400 font-bold">
                    {translate("No raw material stock records found.", "අමුද්‍රව්‍ය තොග වාර්තා කිසිවක් හමු නොවීය.")}
                  </td>
                </tr>
              ) : (
                materials.map((m) => {
                  const isLow = m.current_stock_sqft <= m.low_stock_threshold_sqft;
                  return (
                    <tr key={m.material_id} className={`hover:bg-stone-50 ${isLow ? 'bg-red-50/25' : ''}`}>
                      <td className="p-3.5 font-bold text-stone-800">{m.material_name}</td>
                      <td className="p-3.5">
                        <span className={`inline-flex rounded px-2.5 py-0.5 text-[10px] font-bold ${
                          m.material_type === 'Timber' ? 'bg-[#B34A1A]/10 text-[#B34A1A]' : 'bg-indigo-50 text-indigo-750'
                        }`}>
                          {m.material_type}
                        </span>
                      </td>
                      <td className="p-3.5 text-right font-semibold text-stone-700">
                        Rs. {m.cost_per_sqft.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3.5 text-center">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          isLow ? 'bg-red-100 text-red-800' : 'bg-green-50 text-green-700'
                        }`}>
                          {m.current_stock_sqft} sq ft
                        </span>
                      </td>
                      <td className="p-3.5 text-center text-stone-500 font-semibold">{m.low_stock_threshold_sqft} sq ft</td>
                      <td className="p-3.5 text-stone-450">{new Date(m.updatedAt).toLocaleDateString()}</td>
                      <td className="p-3.5">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleOpenAdjust(m)}
                            title="Adjust Inventory Count"
                            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-stone-200 text-xs font-bold text-[#B34A1A] hover:bg-[#B34A1A]/5 transition-colors cursor-pointer"
                          >
                            <ArrowUpRight size={13} />
                            {translate("Adjust", "වෙනස් කරන්න")}
                          </button>

                          <button
                            onClick={() => handleOpenHistory(m)}
                            title="Audit Stock History"
                            className="p-1.5 rounded-lg border border-stone-200 text-stone-500 hover:text-stone-850 hover:bg-stone-100 transition-colors cursor-pointer"
                          >
                            <History size={14} />
                          </button>

                          <button
                            onClick={() => handleOpenEdit(m)}
                            className="p-1.5 rounded-lg border border-stone-200 text-stone-500 hover:text-stone-850 hover:bg-stone-100 transition-colors cursor-pointer"
                          >
                            <Edit size={14} />
                          </button>

                          {user?.role === 'ADMIN' && (
                            <button
                              onClick={() => handleDelete(m.material_id)}
                              className="p-1.5 rounded-lg border border-stone-200 text-stone-500 hover:text-red-650 hover:bg-red-50 transition-colors cursor-pointer"
                            >
                              <Trash2 size={14} />
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
         MATERIAL FORM MODAL (ADD & EDIT)
         ========================================== */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 no-print animate-fade-in">
          <div className="w-full max-w-md rounded-xl bg-white p-5 sm:p-6 shadow-2xl border border-stone-200 flex flex-col max-h-[90dvh] my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 flex-none">
              <h3 className="text-base font-bold text-stone-850 flex items-center gap-1.5">
                <Layers size={18} className="text-[#B34A1A]" />
                {selectedMaterial ? translate("Modify Material stock info", "අමුද්‍රව්‍ය විස්තර යාවත්කාලීන කරන්න") : translate("Add New Raw Material", "නව අමුද්‍රව්‍යයක් ලියාපදිංචි කිරීම")}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-stone-400 hover:text-stone-800 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-600">{translate("Material Name *", "අමුද්‍රව්‍යයේ නම *")}</label>
                <input
                  type="text"
                  required
                  value={form.material_name}
                  onChange={(e) => setForm({ ...form, material_name: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-stone-50 text-stone-800 focus:outline-none focus:border-[#B34A1A]"
                  placeholder="e.g. 1-inch Teak Plank / Mahogany Board 4x8"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-600">{translate("Material Type *", "අමුද්‍රව්‍ය වර්ගය *")}</label>
                <select
                  value={form.material_type}
                  onChange={(e) => setForm({ ...form, material_type: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-stone-50 text-stone-800 focus:outline-none focus:border-[#B34A1A]"
                >
                  <option value="Timber">Timber (raw wood planks)</option>
                  <option value="Board">Board (plywoods/mdf/melamine)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-600">{translate("Cost per sq ft (Rs.)", "වර්ග අඩියක පිරිවැය")}</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={form.cost_per_sqft}
                    onChange={(e) => setForm({ ...form, cost_per_sqft: parseFloat(e.target.value) || 0 })}
                    className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-stone-50 text-stone-800 focus:outline-none focus:border-[#B34A1A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-600">{translate("Low Stock Threshold (sq ft)", "අඩුම තොග සීමාව")}</label>
                  <input
                    type="number"
                    required
                    value={form.low_stock_threshold_sqft}
                    onChange={(e) => setForm({ ...form, low_stock_threshold_sqft: parseFloat(e.target.value) || 0 })}
                    className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-stone-50 text-stone-800 focus:outline-none focus:border-[#B34A1A]"
                  />
                </div>
              </div>

              {!selectedMaterial && (
                <div>
                  <label className="block text-xs font-bold text-stone-600">{translate("Initial Stock Quantity (sq ft)", "ආරම්භක තොග ප්‍රමාණය (වර්ග අඩි)")}</label>
                  <input
                    type="number"
                    step="0.1"
                    value={form.current_stock_sqft}
                    onChange={(e) => setForm({ ...form, current_stock_sqft: parseFloat(e.target.value) || 0 })}
                    className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-stone-50 text-stone-800 focus:outline-none focus:border-[#B34A1A]"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-stone-200 px-4 py-2 text-xs font-bold text-stone-600 hover:bg-stone-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#B34A1A] px-5 py-2 text-xs font-bold text-white hover:bg-[#9a3f16] shadow-md cursor-pointer"
                >
                  Save / සුරකින්න
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
         STOCK ADJUSTMENT MODAL
         ========================================== */}
      {adjustModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 no-print animate-fade-in">
          <div className="w-full max-w-md rounded-xl bg-white p-5 sm:p-6 shadow-2xl border border-stone-200 flex flex-col max-h-[90dvh] my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 flex-none">
              <h3 className="text-base font-bold text-stone-850 flex items-center gap-1.5">
                <ArrowUpRight size={18} className="text-[#B34A1A]" />
                {translate("Manual Inventory Adjustment / ", "භාණ්ඩ තොගය අතින් සකස් කිරීම: ")} {selectedMaterial?.material_name}
              </h3>
              <button onClick={() => setAdjustModalOpen(false)} className="text-stone-400 hover:text-stone-800 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} className="mt-4 space-y-4">
              <div className="p-3 bg-stone-50 rounded-lg border border-stone-200">
                <span className="text-[10px] uppercase font-bold text-stone-400">{translate("Current Stock Level", "දැනට පවතින තොගය")}</span>
                <p className="text-sm font-black text-stone-800 mt-1">{selectedMaterial?.current_stock_sqft} sq ft</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-600">
                  {translate("Quantity Change (sq ft) *", "වෙනස් වන ප්‍රමාණය (වර්ග අඩි) *")}
                </label>
                <input
                  type="number"
                  step="0.1"
                  required
                  placeholder="e.g. +50 to increase or -15 to deduct stock"
                  value={adjustForm.quantity_change}
                  onChange={(e) => setAdjustForm({ ...adjustForm, quantity_change: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-white text-stone-800 focus:outline-none focus:border-[#B34A1A]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-600">
                  {translate("Adjustment Reason Note *", "සකස් කිරීමට හේතුව *")}
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Received new shipment / Discarded damp boards"
                  value={adjustForm.reason}
                  onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-white text-stone-800 focus:outline-none focus:border-[#B34A1A]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setAdjustModalOpen(false)}
                  className="rounded-lg border border-stone-200 px-4 py-2 text-xs font-bold text-stone-600 hover:bg-stone-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#B34A1A] px-5 py-2 text-xs font-bold text-white hover:bg-[#9a3f16] shadow-md cursor-pointer"
                >
                  Confirm Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
         STOCK HISTORY AUDIT TRAIL MODAL
         ========================================== */}
      {historyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 no-print animate-fade-in">
          <div className="w-full max-w-2xl rounded-xl bg-white p-5 sm:p-6 shadow-2xl border border-stone-200 flex flex-col max-h-[90dvh] my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 flex-none">
              <h3 className="text-base font-bold text-stone-850 flex items-center gap-1.5">
                <History size={18} className="text-[#B34A1A]" />
                {translate("Material Ledger History / ", "අමුද්‍රව්‍ය ලෙජර ඉතිහාසය: ")} {selectedMaterial?.material_name}
              </h3>
              <button onClick={() => setHistoryModalOpen(false)} className="text-stone-400 hover:text-stone-800 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <div className="mt-4 overflow-y-auto flex-1 pr-1.5 -mr-1.5 space-y-2">
              {!selectedMaterial?.stock_history || selectedMaterial.stock_history.length === 0 ? (
                <p className="text-center py-8 text-xs text-stone-400 font-medium">No stock log entries recorded for this material.</p>
              ) : (
                <div className="divide-y divide-stone-100">
                  {[...selectedMaterial.stock_history].reverse().map((h, idx) => {
                    const isIncrease = h.change > 0;
                    return (
                      <div key={idx} className="py-3 flex items-start justify-between text-xs font-semibold">
                        <div className="flex gap-2.5 items-start">
                          <div className={`mt-0.5 rounded-lg p-1.5 ${
                            isIncrease ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                          }`}>
                            {isIncrease ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}
                          </div>
                          <div>
                            <p className="text-stone-850 font-bold">{h.reference || 'Manual Change'}</p>
                            <span className="text-[10px] text-stone-400 font-semibold uppercase tracking-wide">
                              Type: {h.type} | {new Date(h.date).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`font-black text-sm ${isIncrease ? 'text-green-700' : 'text-red-700'}`}>
                            {isIncrease ? `+${h.change}` : `${h.change}`} sq ft
                          </span>
                          <p className="text-[10px] text-stone-400 mt-0.5 font-medium">Balance: {h.balance} sq ft</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
