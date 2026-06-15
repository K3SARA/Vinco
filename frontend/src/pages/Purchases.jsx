import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import useDebouncedValue from '../hooks/useDebouncedValue';
import { 
  DollarSign, Plus, Search, Edit, Trash2, X, Eye, 
  ShoppingCart, HelpCircle, CheckCircle
} from 'lucide-react';

export default function Purchases() {
  const { user } = useAuth();
  
  const [purchases, setPurchases] = useState([]);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState(localStorage.getItem('vinco_lang') || 'en');

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebouncedValue(searchTerm);

  // Modals state
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);

  // Search Autocomplete
  const [prodSearch, setProdSearch] = useState('');
  const [suppSearch, setSuppSearch] = useState('');
  const [showProdResults, setShowProdResults] = useState(false);
  const [showSuppResults, setShowSuppResults] = useState(false);

  // Form state
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [purchaseItems, setPurchaseItems] = useState([]);
  const [paidAmount, setPaidAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');

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

  const loadPurchases = async () => {
    setLoading(true);
    try {
      const pRes = await api.get(`/purchases?search=${encodeURIComponent(debouncedSearchTerm)}`);
      setPurchases(pRes.data);
    } catch (err) {
      console.error(err);
      showAlert('error', 'Failed to retrieve purchase logs.');
    }
  };

  const loadLookups = async () => {
    try {
      const prodRes = await api.get('/products?status=Active');
      setProducts(prodRes.data);
      const suppRes = await api.get('/suppliers?status=Active');
      setSuppliers(suppRes.data);
    } catch (err) {
      console.error(err);
      showAlert('error', 'Failed to retrieve purchase logs.');
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [pRes, prodRes, suppRes] = await Promise.all([
        api.get(`/purchases?search=${encodeURIComponent(debouncedSearchTerm)}`),
        api.get('/products?status=Active'),
        api.get('/suppliers?status=Active'),
      ]);
      setPurchases(pRes.data);
      setProducts(prodRes.data);
      setSuppliers(suppRes.data);
    } catch (err) {
      console.error(err);
      showAlert('error', 'Failed to retrieve purchase logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLookups();
  }, []);

  useEffect(() => {
    loadPurchases();
  }, [debouncedSearchTerm]);

  const handleOpenAdd = () => {
    setSelectedSupplier(null);
    setSuppSearch('');
    setProdSearch('');
    setPurchaseItems([]);
    setPaidAmount(0);
    setPaymentMethod('Cash');
    setReferenceNumber('');
    setNotes('');
    setPurchaseModalOpen(true);
  };

  const addToPurchase = (prod) => {
    const existing = purchaseItems.find(item => item.productId === prod.id);
    if (existing) {
      setPurchaseItems(purchaseItems.map(item => 
        item.productId === prod.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setPurchaseItems([...purchaseItems, {
        productId: prod.id,
        productCode: prod.code,
        productName: prod.name,
        quantity: 1,
        unitCost: prod.costPrice
      }]);
    }
    setProdSearch('');
    setShowProdResults(false);
  };

  const updateItemQty = (prodId, val) => {
    const qty = parseFloat(val) || 0;
    setPurchaseItems(purchaseItems.map(it => 
      it.productId === prodId ? { ...it, quantity: qty } : it
    ));
  };

  const updateItemCost = (prodId, val) => {
    const cost = parseFloat(val) || 0;
    setPurchaseItems(purchaseItems.map(it => 
      it.productId === prodId ? { ...it, unitCost: cost } : it
    ));
  };

  const removeItem = (prodId) => {
    setPurchaseItems(purchaseItems.filter(it => it.productId !== prodId));
  };

  const subtotal = purchaseItems.reduce((acc, it) => acc + (it.quantity * it.unitCost), 0);
  const grandTotal = subtotal;

  const handlePurchaseSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSupplier) {
      showAlert('error', 'Supplier selection is required.');
      return;
    }
    if (purchaseItems.length === 0) {
      showAlert('error', 'Basket is empty.');
      return;
    }

    try {
      const payload = {
        supplierId: selectedSupplier.id,
        notes,
        paidAmount,
        paymentMethod,
        referenceNumber,
        items: purchaseItems
      };
      await api.post('/purchases', payload);
      showAlert('success', 'Purchase order logged. Product stocks replenished.');
      setPurchaseModalOpen(false);
      loadData();
    } catch (err) {
      showAlert('error', err.response?.data?.error || 'Failed to submit purchase.');
    }
  };

  const handleOpenDetails = async (purchase) => {
    try {
      const res = await api.get(`/purchases/${purchase.id}`);
      setSelectedPurchase(res.data);
      setDetailsModalOpen(true);
    } catch (err) {
      showAlert('error', 'Failed to retrieve purchase details.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this purchase record? / මෙම මිලදීගැනීමේ ලේඛනය ඉවත් කිරීමට අවශ්‍ය බව සහතිකද?')) return;
    try {
      await api.delete(`/purchases/${id}`);
      showAlert('success', 'Purchase record deleted.');
      loadData();
    } catch (err) {
      showAlert('error', err.response?.data?.error || 'Deletion failed.');
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(prodSearch.toLowerCase()) ||
    p.code.toLowerCase().includes(prodSearch.toLowerCase())
  );

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(suppSearch.toLowerCase()) ||
    s.phone.includes(suppSearch)
  );

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-stone-850 flex items-center gap-2">
            <ShoppingCart size={22} className="text-wood-650" />
            {translate("Inventory Procurement Purchases", "තොග මිලදීගැනීම් ලේඛනය")}
          </h2>
          <p className="text-xs text-stone-400 font-semibold mt-1">
            {translate("Log incoming supplier timber/accessory inventory shipments, adjust average costs, and update supplier credit accounts.", "පිටතින් තොග ඇණවුම් ලැබීම සටහන් කිරීම සහ සැපයුම්කරුගේ ණය ගිණුම යාවත්කාලීන කිරීම.")}
          </p>
        </div>
        <div>
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 rounded-lg bg-wood-600 px-4 py-2 text-xs font-bold text-white hover:bg-wood-700 shadow-md"
          >
            <Plus size={15} />
            {translate("Log Purchase", "මිලදීගැනීමක් සටහන් කරන්න")}
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

      {/* SEARCH */}
      <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-stone-400">
            <Search size={16} />
          </span>
          <input
            type="text"
            placeholder={translate("Search purchase code or supplier name...", "ලැබීම් කේතය හෝ සැපයුම්කරු අනුව සොයන්න...")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-stone-200 pl-9 pr-3 py-2 text-xs bg-stone-50 text-stone-850"
          />
        </div>
      </div>

      {/* TABLE */}
      <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-stone-50 text-stone-400 font-bold uppercase border-b border-stone-150">
                <th className="p-3.5">Purchase No</th>
                <th className="p-3.5">Date</th>
                <th className="p-3.5">Supplier Name</th>
                <th className="p-3.5 text-right">Grand Total (Rs.)</th>
                <th className="p-3.5 text-right">Amount Paid</th>
                <th className="p-3.5 text-right">Outstanding Credit</th>
                <th className="p-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 font-medium text-stone-700">
              {purchases.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-stone-400 font-bold">No purchases found.</td>
                </tr>
              ) : (
                purchases.map((p) => {
                  const balance = p.grandTotal - p.paidAmount;
                  return (
                    <tr key={p.id} className="hover:bg-stone-50">
                      <td className="p-3.5 font-bold text-stone-850">{p.purchaseNumber}</td>
                      <td className="p-3.5 text-stone-450">{new Date(p.date).toLocaleDateString()}</td>
                      <td className="p-3.5 font-bold text-stone-850">{p.supplier?.name}</td>
                      <td className="p-3.5 text-right font-semibold">Rs. {p.grandTotal.toLocaleString()}</td>
                      <td className="p-3.5 text-right text-green-700 font-semibold">Rs. {p.paidAmount.toLocaleString()}</td>
                      <td className="p-3.5 text-right font-black text-stone-900">Rs. {balance.toLocaleString()}</td>
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleOpenDetails(p)}
                            className="p-1 rounded border border-stone-250 hover:bg-stone-100 text-stone-655 transition-colors flex items-center gap-1 text-[10px] px-2 font-bold"
                          >
                            <Eye size={13} />
                            View
                          </button>
                          
                          {user?.role === 'ADMIN' && (
                            <button
                              onClick={() => handleDelete(p.id)}
                              className="p-1 rounded border border-stone-200 text-stone-400 hover:text-red-650 hover:bg-red-50 transition-colors"
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
         PURCHASE LOG MODAL
         ========================================== */}
      {purchaseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl border border-stone-200 my-8 animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h3 className="text-base font-bold text-stone-850 flex items-center gap-1.5">
                <ShoppingCart size={18} className="text-wood-650" />
                Log Incoming Inventory Purchase
              </h3>
              <button onClick={() => setPurchaseModalOpen(false)} className="text-stone-400 hover:text-stone-800">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handlePurchaseSubmit} className="mt-4 space-y-4">
              {/* Autocomplete Supplier Lookup */}
              <div>
                <label className="block text-xs font-bold text-stone-600">Select Supplier *</label>
                <input
                  type="text"
                  placeholder="Type supplier name or phone..."
                  value={suppSearch}
                  onChange={(e) => { setSuppSearch(e.target.value); setShowSuppResults(true); }}
                  onFocus={() => setShowSuppResults(true)}
                  className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-stone-50 text-stone-800"
                />
                {showSuppResults && suppSearch && (
                  <div className="absolute max-h-36 overflow-y-auto rounded-lg border border-stone-200 bg-white shadow-lg z-30 divide-y divide-stone-100 w-96">
                    {filteredSuppliers.map(s => (
                      <div
                        key={s.id}
                        onClick={() => {
                          setSelectedSupplier(s);
                          setSuppSearch(s.name);
                          setShowSuppResults(false);
                        }}
                        className="p-2 text-xs hover:bg-stone-50 cursor-pointer"
                      >
                        {s.name} ({s.phone})
                      </div>
                    ))}
                  </div>
                )}
                {selectedSupplier && (
                  <div className="mt-1 text-[10px] text-green-700 font-bold bg-green-50 px-2.5 py-1 rounded">
                    Selected Supplier: {selectedSupplier.name} ({selectedSupplier.phone})
                  </div>
                )}
              </div>

              {/* Autocomplete Product Lookup */}
              <div>
                <label className="block text-xs font-bold text-stone-600">Add Inventory Product *</label>
                <input
                  type="text"
                  placeholder="Search products by SKU code or Name to insert..."
                  value={prodSearch}
                  onChange={(e) => { setProdSearch(e.target.value); setShowProdResults(true); }}
                  onFocus={() => setShowProdResults(true)}
                  className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-stone-50 text-stone-800"
                />
                {showProdResults && prodSearch && (
                  <div className="absolute max-h-36 overflow-y-auto rounded-lg border border-stone-200 bg-white shadow-lg z-30 divide-y divide-stone-100 w-96">
                    {filteredProducts.map(p => (
                      <div
                        key={p.id}
                        onClick={() => addToPurchase(p)}
                        className="p-2 text-xs hover:bg-stone-50 cursor-pointer"
                      >
                        {p.name} (SKU: {p.code}) - Cost: Rs. {p.costPrice}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Basket list */}
              <div className="border border-stone-150 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-200 text-stone-400 font-bold uppercase">
                      <th className="p-2">SKU</th>
                      <th className="p-2">Product Name</th>
                      <th className="p-2 text-right">Cost Price (Rs.)</th>
                      <th className="p-2 text-center" style={{ width: '80px' }}>Qty</th>
                      <th className="p-2 text-right">Total</th>
                      <th className="p-2 text-center">X</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 font-semibold text-stone-700">
                    {purchaseItems.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="p-4 text-center text-stone-400 font-bold">Basket is empty.</td>
                      </tr>
                    ) : (
                      purchaseItems.map((item) => (
                        <tr key={item.productId}>
                          <td className="p-2 font-bold">{item.productCode}</td>
                          <td className="p-2">{item.productName}</td>
                          <td className="p-2 text-right">
                            <input
                              type="number"
                              required
                              value={item.unitCost}
                              onChange={(e) => updateItemCost(item.productId, e.target.value)}
                              className="w-20 rounded border border-stone-200 p-0.5 text-right font-bold text-xs"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <input
                              type="number"
                              required
                              value={item.quantity}
                              onChange={(e) => updateItemQty(item.productId, e.target.value)}
                              className="w-12 rounded border border-stone-200 p-0.5 text-center font-bold"
                            />
                          </td>
                          <td className="p-2 text-right font-black text-stone-900">
                            Rs. {(item.quantity * item.unitCost).toLocaleString()}
                          </td>
                          <td className="p-2 text-center">
                            <button onClick={() => removeItem(item.productId)} className="text-stone-400 hover:text-red-650">
                              <X size={15} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Payments & Summary fields */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 text-xs font-semibold">
                <div>
                  <label className="block text-stone-500">Paid Amount (Disbursed now) (Rs.)</label>
                  <input
                    type="number"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                    className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-1.5 bg-stone-50 text-stone-900 text-right font-extrabold"
                  />
                </div>

                <div>
                  <label className="block text-stone-500">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 bg-stone-50 text-stone-850 font-bold"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Card">Card</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-stone-500">Reference No. (cheque/bank slip)</label>
                  <input
                    type="text"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-1.5 bg-stone-50 text-stone-800"
                    placeholder="TXN details"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center text-xs font-bold bg-stone-50 p-3 rounded-lg border border-stone-200/50">
                <span>Subtotal: Rs. {subtotal.toLocaleString()}</span>
                <span className="text-sm font-black text-wood-700">Estimated Total: Rs. {grandTotal.toLocaleString()}</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-600">Special Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-1.5 bg-stone-50 text-stone-850"
                  placeholder="e.g. Logs for teak imports"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setPurchaseModalOpen(false)}
                  className="rounded-lg border border-stone-200 px-4 py-2.5 text-xs font-bold text-stone-600 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-wood-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-wood-700 shadow-md"
                >
                  Log Purchase Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
         PURCHASE DETAIL MODAL
         ========================================== */}
      {detailsModalOpen && selectedPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl border border-stone-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div>
                <h3 className="text-base font-bold text-stone-850 flex items-center gap-1.5">
                  <ShoppingCart size={18} className="text-wood-650" />
                  Purchase Order Details: {selectedPurchase.purchaseNumber}
                </h3>
              </div>
              <button onClick={() => setDetailsModalOpen(false)} className="text-stone-400 hover:text-stone-800">
                <X size={20} />
              </button>
            </div>

            {/* Meta details */}
            <div className="grid grid-cols-2 gap-4 mt-4 text-xs font-semibold text-stone-600 border-b border-stone-100 pb-4">
              <div>
                <p className="text-stone-400 uppercase text-[10px] mb-0.5 font-bold">Supplier Profile</p>
                <p className="text-stone-950 font-bold">{selectedPurchase.supplier?.name}</p>
                <p>{selectedPurchase.supplier?.phone} | {selectedPurchase.supplier?.address}</p>
              </div>
              <div className="text-right">
                <p className="text-stone-400 uppercase text-[10px] mb-0.5">Procurement Details</p>
                <p>Date: {new Date(selectedPurchase.date).toLocaleString()}</p>
              </div>
            </div>

            {/* Items Table */}
            <div className="mt-4 overflow-y-auto max-h-48 border border-stone-150 rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-stone-50 text-stone-400 font-bold uppercase border-b border-stone-200">
                    <th className="p-3">SKU</th>
                    <th className="p-3">Product Name</th>
                    <th className="p-3 text-right">Cost Price</th>
                    <th className="p-3 text-center">Qty</th>
                    <th className="p-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-semibold text-stone-700">
                  {selectedPurchase.items?.map((item) => (
                    <tr key={item.id}>
                      <td className="p-3 font-bold">{item.productCode}</td>
                      <td className="p-3">{item.productName}</td>
                      <td className="p-3 text-right">Rs. {item.unitCost.toLocaleString()}</td>
                      <td className="p-3 text-center">{item.quantity}</td>
                      <td className="p-3 text-right font-black text-stone-900">Rs. {item.lineTotal.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pricing Summary */}
            <div className="text-right space-y-1.5 text-xs font-semibold text-stone-600 mt-4 pr-1">
              <div className="flex justify-between border-b border-stone-200 pb-1.5">
                <span>Grand Total:</span>
                <span className="font-black text-stone-900">Rs. {selectedPurchase.grandTotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-green-700">
                <span>Amount Paid:</span>
                <span>Rs. {selectedPurchase.paidAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-t border-dashed border-stone-300 pt-1 text-xs font-black text-red-750">
                <span>Owed Liabilities Balance:</span>
                <span>Rs. {(selectedPurchase.grandTotal - selectedPurchase.paidAmount).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
