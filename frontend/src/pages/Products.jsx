import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  Package, Plus, Search, Edit, Trash2, ArrowUpDown, Filter,
  History, ArrowUpRight, ArrowDownLeft, X, AlertTriangle, Layers
} from 'lucide-react';

export default function Products() {
  const { user } = useAuth();
  
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState(localStorage.getItem('alight_lang') || 'en');

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [lowStockFilter, setLowStockFilter] = useState(false);

  // Modals state
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [movementsHistory, setMovementsHistory] = useState([]);

  // Errors/Success alert
  const [alertMsg, setAlertMsg] = useState({ type: '', text: '' });

  // Product Form state
  const [prodForm, setProdForm] = useState({
    id: '',
    code: '',
    name: '',
    categoryId: '',
    material: '',
    size: '',
    color: '',
    brand: '',
    supplier: '',
    costPrice: 0,
    sellingPrice: 0,
    stockQty: 0,
    minStockAlert: 5,
    warrantyPeriod: 'No Warranty',
    description: '',
    status: 'Active',
    manualStockAdjustReason: ''
  });

  // Category Form state
  const [catName, setCatName] = useState('');
  const [editingCategory, setEditingCategory] = useState(null);

  // Translation helper
  const translate = (en, si) => (lang === 'en' ? en : si);

  useEffect(() => {
    const handleLangChange = () => setLang(localStorage.getItem('alight_lang') || 'en');
    window.addEventListener('languageChange', handleLangChange);
    return () => window.removeEventListener('languageChange', handleLangChange);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const catRes = await api.get('/categories');
      setCategories(catRes.data);

      const prodQuery = `?search=${searchTerm}&categoryId=${selectedCategory}&lowStock=${lowStockFilter}`;
      const prodRes = await api.get(`/products${prodQuery}`);
      setProducts(prodRes.data);
    } catch (error) {
      console.error(error);
      showAlert('error', 'Failed to load records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [searchTerm, selectedCategory, lowStockFilter]);

  const showAlert = (type, text) => {
    setAlertMsg({ type, text });
    setTimeout(() => setAlertMsg({ type: '', text: '' }), 5000);
  };

  // ==========================================
  // CATEGORIES LOGIC
  // ==========================================
  const handleCreateOrUpdateCategory = async (e) => {
    e.preventDefault();
    if (!catName.trim()) return;

    try {
      if (editingCategory) {
        await api.put(`/categories/${editingCategory.id}`, { name: catName });
        showAlert('success', 'Category updated successfully.');
      } else {
        await api.post('/categories', { name: catName });
        showAlert('success', 'Category created successfully.');
      }
      setCatName('');
      setEditingCategory(null);
      loadData();
    } catch (err) {
      showAlert('error', err.response?.data?.error || 'Category action failed.');
    }
  };

  const handleEditCategory = (cat) => {
    setEditingCategory(cat);
    setCatName(cat.name);
  };

  const handleDeleteCategory = async (id) => {
    if (!window.confirm('Are you sure you want to delete this category? / මෙම ප්‍රවර්ගය ඉවත් කිරීමට අවශ්‍ය බව සහතිකද?')) return;
    try {
      await api.delete(`/categories/${id}`);
      showAlert('success', 'Category deleted.');
      loadData();
    } catch (err) {
      showAlert('error', err.response?.data?.error || 'Cannot delete category containing products.');
    }
  };

  // ==========================================
  // PRODUCTS LOGIC
  // ==========================================
  const handleOpenAddProduct = () => {
    setSelectedProduct(null);
    setProdForm({
      id: '',
      code: '',
      name: '',
      categoryId: categories[0]?.id || '',
      material: '',
      size: '',
      color: '',
      brand: '',
      supplier: '',
      costPrice: 0,
      sellingPrice: 0,
      stockQty: 0,
      minStockAlert: 5,
      warrantyPeriod: 'No Warranty',
      description: '',
      status: 'Active',
      manualStockAdjustReason: ''
    });
    setProductModalOpen(true);
  };

  const handleOpenEditProduct = (p) => {
    setSelectedProduct(p);
    setProdForm({
      id: p.id,
      code: p.code,
      name: p.name,
      categoryId: p.categoryId,
      material: p.material || '',
      size: p.size || '',
      color: p.color || '',
      brand: p.brand || '',
      supplier: p.supplier || '',
      costPrice: p.costPrice,
      sellingPrice: p.sellingPrice,
      stockQty: p.stockQty,
      minStockAlert: p.minStockAlert,
      warrantyPeriod: p.warrantyPeriod || 'No Warranty',
      description: p.description || '',
      status: p.status,
      manualStockAdjustReason: ''
    });
    setProductModalOpen(true);
  };

  const handleProductSubmit = async (e) => {
    e.preventDefault();
    if (!prodForm.name || !prodForm.code || !prodForm.categoryId) {
      showAlert('error', 'Name, SKU Code, and Category are required.');
      return;
    }

    try {
      if (selectedProduct) {
        // Enforce manual stock adjust reason if stock changed
        if (parseFloat(prodForm.stockQty) !== selectedProduct.stockQty && !prodForm.manualStockAdjustReason.trim()) {
          showAlert('error', 'A reason is required to perform manual stock adjustments.');
          return;
        }
        await api.put(`/products/${selectedProduct.id}`, prodForm);
        showAlert('success', 'Product updated successfully.');
      } else {
        await api.post('/products', prodForm);
        showAlert('success', 'Product added successfully.');
      }
      setProductModalOpen(false);
      loadData();
    } catch (err) {
      showAlert('error', err.response?.data?.error || 'Product submission failed.');
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product? / මෙම භාණ්ඩය ඉවත් කිරීමට අවශ්‍ය බව සහතිකද?')) return;
    try {
      await api.delete(`/products/${id}`);
      showAlert('success', 'Product deleted.');
      loadData();
    } catch (err) {
      showAlert('error', err.response?.data?.error || 'Product is already linked to transactions and cannot be deleted.');
    }
  };

  const handleViewHistory = async (product) => {
    try {
      const res = await api.get(`/products/${product.id}`);
      setMovementsHistory(res.data.movements || []);
      setSelectedProduct(product);
      setHistoryModalOpen(true);
    } catch (err) {
      showAlert('error', 'Failed to retrieve stock movement history.');
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-stone-850 flex items-center gap-2">
            <Package size={22} className="text-wood-600" />
            {translate("Furniture Products & Timber Stock", "නිෂ්පාදන සහ තොග කළමනාකරණය")}
          </h2>
          <p className="text-xs text-stone-400 font-semibold mt-1">
            {translate("Configure furniture categories, manage SKUs, track inventory limits, and view audit trails.", "ප්‍රවර්ග සැකසීම, භාණ්ඩ ලියාපදිංචිය සහ තොග වාර්තා මෙහෙයවීම.")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCategoryModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2 text-xs font-bold text-stone-700 hover:bg-stone-100 transition-all shadow-sm"
          >
            <Layers size={15} />
            {translate("Categories Settings", "ප්‍රවර්ග සැකසුම්")}
          </button>
          
          {(user?.role === 'ADMIN' || user?.role === 'CASHIER' || user?.role === 'SALESPERSON') && (
            <button
              onClick={handleOpenAddProduct}
              className="inline-flex items-center gap-1.5 rounded-lg bg-wood-600 px-4 py-2 text-xs font-bold text-white hover:bg-wood-700 shadow-md transition-all"
            >
              <Plus size={15} />
              {translate("Add Product", "නව භාණ්ඩයක් ඇතුළත් කරන්න")}
            </button>
          )}
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
        {/* Search Input */}
        <div className="relative md:col-span-2">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-stone-400">
            <Search size={16} />
          </span>
          <input
            type="text"
            placeholder={translate("Search SKU, Name, Material, Color...", "කේතය, නම, ලී වර්ගය, වර්ණය අනුව සොයන්න...")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-stone-200 pl-9 pr-3 py-2 text-xs bg-stone-50 text-stone-800 placeholder-stone-400 focus:outline-none focus:border-wood-500 focus:bg-white transition-all"
          />
        </div>

        {/* Category Select */}
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="rounded-lg border border-stone-200 px-3 py-2 text-xs bg-stone-50 text-stone-700 focus:outline-none focus:border-wood-500 focus:bg-white transition-all font-semibold"
        >
          <option value="">{translate("All Categories", "සියලුම ප්‍රවර්ගයන්")}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {/* Low Stock Toggle */}
        <button
          onClick={() => setLowStockFilter(!lowStockFilter)}
          className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition-all shadow-sm ${
            lowStockFilter 
              ? 'bg-red-50 border-red-200 text-red-700' 
              : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
          }`}
        >
          <AlertTriangle size={15} />
          {translate("Low Stock Only", "අඩු තොග පමණි")}
        </button>
      </div>

      {/* SPREADSHEET TABLE */}
      <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-stone-50 text-stone-400 font-bold uppercase tracking-wider border-b border-stone-150">
                <th className="p-3.5">SKU / {translate("Code", "කේතය")}</th>
                <th className="p-3.5">{translate("Product Name", "භාණ්ඩයේ නම")}</th>
                <th className="p-3.5">{translate("Category", "ප්‍රවර්ගය")}</th>
                <th className="p-3.5">{translate("Material", "ලී වර්ගය")}</th>
                <th className="p-3.5 text-right">{translate("Cost Price", "මිලදීගත් මිල")}</th>
                <th className="p-3.5 text-right">{translate("Selling Price", "විකුණුම් මිල")}</th>
                <th className="p-3.5 text-center">{translate("Stock Qty", "තොගය")}</th>
                <th className="p-3.5">{translate("Status", "තත්ත්වය")}</th>
                <th className="p-3.5 text-center">{translate("Actions", "ක්‍රියාමාර්ග")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 font-medium">
              {products.length === 0 ? (
                <tr>
                  <td colSpan="9" className="p-8 text-center text-stone-400 font-bold">
                    {translate("No furniture items found.", "භාණ්ඩ කිසිවක් හමු නොවීය.")}
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const isLow = p.stockQty <= p.minStockAlert;
                  return (
                    <tr key={p.id} className={`hover:bg-stone-50 ${isLow ? 'bg-red-50/20' : ''}`}>
                      <td className="p-3.5 font-bold text-stone-850">{p.code}</td>
                      <td className="p-3.5">
                        <div className="font-bold text-stone-800">{p.name}</div>
                        {p.size && <div className="text-[10px] text-stone-400 font-semibold">Size: {p.size} {p.color && `| Color: ${p.color}`}</div>}
                      </td>
                      <td className="p-3.5 text-stone-500 font-semibold">{p.category?.name}</td>
                      <td className="p-3.5 text-stone-500">{p.material || '-'}</td>
                      <td className="p-3.5 text-right font-semibold text-stone-600">Rs. {p.costPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      <td className="p-3.5 text-right font-black text-stone-800">Rs. {p.sellingPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      <td className="p-3.5 text-center">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          isLow ? 'bg-red-150 text-red-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {p.stockQty} Qty
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          p.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-150 text-stone-700'
                        }`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleViewHistory(p)}
                            title="Audit Stock History"
                            className="p-1 rounded-lg border border-stone-200 text-stone-500 hover:text-wood-650 hover:bg-stone-100 transition-colors"
                          >
                            <History size={14} />
                          </button>
                          
                          <button
                            onClick={() => handleOpenEditProduct(p)}
                            className="p-1 rounded-lg border border-stone-200 text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition-colors"
                          >
                            <Edit size={14} />
                          </button>
                          
                          {user?.role === 'ADMIN' && (
                            <button
                              onClick={() => handleDeleteProduct(p.id)}
                              className="p-1 rounded-lg border border-stone-200 text-stone-500 hover:text-red-600 hover:bg-red-50 transition-colors"
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
         CATEGORY MANAGEMENT MODAL
         ========================================== */}
      {categoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 no-print">
          <div className="w-full max-w-md rounded-xl bg-white p-5 sm:p-6 shadow-2xl border border-stone-200 flex flex-col max-h-[90dvh] my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h3 className="text-base font-bold text-stone-850 flex items-center gap-1.5">
                <Layers size={18} className="text-wood-600" />
                {translate("Furniture Categories", "ප්‍රවර්ගයන් සැකසීම")}
              </h3>
              <button onClick={() => { setCategoryModalOpen(false); setEditingCategory(null); setCatName(''); }} className="text-stone-400 hover:text-stone-800">
                <X size={20} />
              </button>
            </div>

            {/* Category Form */}
            <form onSubmit={handleCreateOrUpdateCategory} className="mt-4 flex gap-2">
              <input
                type="text"
                placeholder="Category Name / ප්‍රවර්ගයේ නම"
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                className="flex-1 rounded-lg border border-stone-250 px-3 py-2 text-xs bg-stone-50 text-stone-800 focus:outline-none focus:border-wood-500"
              />
              <button
                type="submit"
                className="rounded-lg bg-wood-600 px-4 py-2 text-xs font-bold text-white hover:bg-wood-700 shadow-sm"
              >
                {editingCategory ? 'Update' : 'Add'}
              </button>
            </form>

            {/* Category List */}
            <div className="mt-4 max-h-48 overflow-y-auto space-y-1.5 divide-y divide-stone-100 pr-1">
              {categories.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-2 text-xs font-semibold">
                  <span className="text-stone-700">{c.name} <span className="text-[10px] text-stone-400 font-medium">({c._count?.products || 0} products)</span></span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleEditCategory(c)}
                      className="text-stone-500 hover:text-stone-900"
                    >
                      <Edit size={13} />
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(c.id)}
                      className="text-stone-500 hover:text-red-650"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
         PRODUCT FORM MODAL (ADD & EDIT)
         ========================================== */}
      {productModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 no-print">
          <div className="w-full max-w-2xl rounded-xl bg-white p-5 sm:p-6 shadow-2xl border border-stone-200 flex flex-col max-h-[90dvh] my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 flex-none">
              <h3 className="text-base font-bold text-stone-850 flex items-center gap-1.5">
                <Package size={18} className="text-wood-650" />
                {selectedProduct ? translate("Modify Furniture Product", "භාණ්ඩයේ විස්තර යාවත්කාලීන කරන්න") : translate("Add New Furniture SKU", "නව භාණ්ඩයක් ලියාපදිංචි කිරීම")}
              </h3>
              <button onClick={() => setProductModalOpen(false)} className="text-stone-400 hover:text-stone-800 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleProductSubmit} className="mt-4 space-y-4 overflow-y-auto flex-1 pr-1.5 -mr-1.5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* SKU Code */}
                <div>
                  <label className="block text-xs font-bold text-stone-600">Product SKU *</label>
                  <input
                    type="text"
                    required
                    value={prodForm.code}
                    onChange={(e) => setProdForm({ ...prodForm, code: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-stone-50 text-stone-800 focus:outline-none focus:border-wood-500"
                    placeholder="e.g. SF-TEAK-3S"
                  />
                </div>

                {/* Name */}
                <div>
                  <label className="block text-xs font-bold text-stone-600">Furniture Name *</label>
                  <input
                    type="text"
                    required
                    value={prodForm.name}
                    onChange={(e) => setProdForm({ ...prodForm, name: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-stone-50 text-stone-800 focus:outline-none focus:border-wood-500"
                    placeholder="e.g. 3-Seater Teak Sofa"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs font-bold text-stone-600">Category *</label>
                  <select
                    value={prodForm.categoryId}
                    onChange={(e) => setProdForm({ ...prodForm, categoryId: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-stone-50 text-stone-800 focus:outline-none focus:border-wood-500"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Material */}
                <div>
                  <label className="block text-xs font-bold text-stone-600">Timber / Material</label>
                  <input
                    type="text"
                    value={prodForm.material}
                    onChange={(e) => setProdForm({ ...prodForm, material: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-stone-50 text-stone-800 focus:outline-none focus:border-wood-500"
                    placeholder="e.g. Teak / Mahogany / Fabric"
                  />
                </div>

                {/* Size */}
                <div>
                  <label className="block text-xs font-bold text-stone-600">Dimensions / Size</label>
                  <input
                    type="text"
                    value={prodForm.size}
                    onChange={(e) => setProdForm({ ...prodForm, size: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-stone-50 text-stone-800 focus:outline-none focus:border-wood-500"
                    placeholder="e.g. 6' x 4' / Standard"
                  />
                </div>

                {/* Color */}
                <div>
                  <label className="block text-xs font-bold text-stone-600">Finish / Color</label>
                  <input
                    type="text"
                    value={prodForm.color}
                    onChange={(e) => setProdForm({ ...prodForm, color: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-stone-50 text-stone-800 focus:outline-none focus:border-wood-500"
                    placeholder="e.g. Mahogany Polish / Brown"
                  />
                </div>

                {/* Cost Price */}
                <div>
                  <label className="block text-xs font-bold text-stone-600">Cost Price (Rs.) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={prodForm.costPrice}
                    onChange={(e) => setProdForm({ ...prodForm, costPrice: parseFloat(e.target.value) || 0 })}
                    className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-stone-50 text-stone-800 focus:outline-none focus:border-wood-500"
                  />
                </div>

                {/* Selling Price */}
                <div>
                  <label className="block text-xs font-bold text-stone-600">Selling Price (Rs.) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={prodForm.sellingPrice}
                    onChange={(e) => setProdForm({ ...prodForm, sellingPrice: parseFloat(e.target.value) || 0 })}
                    className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-stone-50 text-stone-800 focus:outline-none focus:border-wood-500"
                  />
                </div>

                {/* Stock Qty */}
                <div>
                  <label className="block text-xs font-bold text-stone-600">Inventory Stock Qty *</label>
                  <input
                    type="number"
                    required
                    value={prodForm.stockQty}
                    onChange={(e) => setProdForm({ ...prodForm, stockQty: parseFloat(e.target.value) || 0 })}
                    className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-stone-50 text-stone-800 focus:outline-none focus:border-wood-500"
                  />
                </div>

                {/* Min Stock Alert */}
                <div>
                  <label className="block text-xs font-bold text-stone-600">Min Stock Alert Limit *</label>
                  <input
                    type="number"
                    required
                    value={prodForm.minStockAlert}
                    onChange={(e) => setProdForm({ ...prodForm, minStockAlert: parseFloat(e.target.value) || 5 })}
                    className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-stone-50 text-stone-800 focus:outline-none focus:border-wood-500"
                  />
                </div>

                {/* Warranty */}
                <div>
                  <label className="block text-xs font-bold text-stone-600">Warranty Period</label>
                  <select
                    value={prodForm.warrantyPeriod}
                    onChange={(e) => setProdForm({ ...prodForm, warrantyPeriod: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-stone-50 text-stone-800 focus:outline-none focus:border-wood-500"
                  >
                    <option value="No Warranty">No Warranty</option>
                    <option value="6 Months">6 Months</option>
                    <option value="12 Months">12 Months (1 Year)</option>
                    <option value="2 Years">2 Years</option>
                    <option value="5 Years">5 Years</option>
                    <option value="10 Years">10 Years</option>
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs font-bold text-stone-600">Status *</label>
                  <select
                    value={prodForm.status}
                    onChange={(e) => setProdForm({ ...prodForm, status: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-stone-50 text-stone-800 focus:outline-none focus:border-wood-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* MANUAL ADJUSTMENT AUDIT REASON (Required only if editing and stock differs) */}
              {selectedProduct && parseFloat(prodForm.stockQty) !== selectedProduct.stockQty && (
                <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 space-y-2">
                  <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wide flex items-center gap-1.5">
                    <AlertTriangle size={15} />
                    Audit Log Required
                  </h4>
                  <p className="text-[10px] text-amber-700 font-medium">
                    You adjusted the physical stock count from {selectedProduct.stockQty} to {prodForm.stockQty}. Please state the reason for this manual correction.
                  </p>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Physical inventory count correction / Damaged frame discarded"
                    value={prodForm.manualStockAdjustReason}
                    onChange={(e) => setProdForm({ ...prodForm, manualStockAdjustReason: e.target.value })}
                    className="w-full rounded-lg border border-amber-300 px-3 py-2 text-xs bg-white text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-stone-600">Description</label>
                <textarea
                  rows="2"
                  value={prodForm.description}
                  onChange={(e) => setProdForm({ ...prodForm, description: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-stone-50 text-stone-800 focus:outline-none focus:border-wood-500"
                  placeholder="e.g. Handcrafted, high quality polyurethane finish..."
                ></textarea>
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-2.5 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setProductModalOpen(false)}
                  className="rounded-lg border border-stone-200 px-4 py-2.5 text-xs font-bold text-stone-600 hover:bg-stone-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-wood-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-wood-750 shadow-md transition-colors"
                >
                  Save / සුරකින්න
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
         STOCK MOVEMENT HISTORY MODAL
         ========================================== */}
      {historyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 no-print">
          <div className="w-full max-w-2xl rounded-xl bg-white p-5 sm:p-6 shadow-2xl border border-stone-200 flex flex-col max-h-[90dvh] my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 flex-none">
              <h3 className="text-base font-bold text-stone-850 flex items-center gap-1.5">
                <History size={18} className="text-wood-650" />
                {translate("Stock Movements Trail / ", "තොග වෙනස්වීම් ඉතිහාසය: ")} {selectedProduct?.name}
              </h3>
              <button onClick={() => setHistoryModalOpen(false)} className="text-stone-400 hover:text-stone-800 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <div className="mt-4 overflow-y-auto flex-1 pr-1.5 -mr-1.5 space-y-2">
              {movementsHistory.length === 0 ? (
                <p className="text-center py-8 text-xs text-stone-400 font-medium">No stock movements found for this product.</p>
              ) : (
                <div className="divide-y divide-stone-100">
                  {movementsHistory.map((m) => {
                    const isIn = m.quantityIn > 0;
                    return (
                      <div key={m.id} className="py-3 flex items-start justify-between text-xs font-semibold">
                        <div className="flex gap-2.5 items-start">
                          <div className={`mt-0.5 rounded-lg p-1.5 ${
                            isIn ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                          }`}>
                            {isIn ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                          </div>
                          <div>
                            <p className="text-stone-800 font-bold">{m.description || m.movementType.replace('_', ' ')}</p>
                            <span className="text-[10px] text-stone-400 font-semibold uppercase tracking-wide">
                              Ref: {m.referenceType} | {new Date(m.date).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`font-black text-sm ${isIn ? 'text-green-650' : 'text-red-650'}`}>
                            {isIn ? `+${m.quantityIn}` : `-${m.quantityOut}`}
                          </span>
                          <p className="text-[10px] text-stone-400 mt-0.5 font-medium">Balance After: {m.balanceAfter}</p>
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
