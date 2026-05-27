import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  FileMinus, Plus, Search, Edit, Trash2, X, ShoppingCart, 
  Award, Eye, Printer, CheckCircle
} from 'lucide-react';

export default function Quotations() {
  const { user } = useAuth();
  
  const [quotations, setQuotations] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState(localStorage.getItem('alight_lang') || 'en');

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [quotationModalOpen, setQuotationModalOpen] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState(null);
  
  // Search Autocomplete
  const [prodSearch, setProdSearch] = useState('');
  const [custSearch, setCustSearch] = useState('');
  const [showProdResults, setShowProdResults] = useState(false);
  const [showCustResults, setShowCustResults] = useState(false);

  // Form state
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [quoteItems, setQuoteItems] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState('');

  // Alert Msg
  const [alertMsg, setAlertMsg] = useState({ type: '', text: '' });

  const translate = (en, si) => (lang === 'en' ? en : si);

  useEffect(() => {
    const handleLangChange = () => setLang(localStorage.getItem('alight_lang') || 'en');
    window.addEventListener('languageChange', handleLangChange);
    return () => window.removeEventListener('languageChange', handleLangChange);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const qRes = await api.get(`/quotations?search=${searchTerm}`);
      setQuotations(qRes.data);
      const prodRes = await api.get('/products?status=Active');
      setProducts(prodRes.data);
      const custRes = await api.get('/customers?status=Active');
      setCustomers(custRes.data);
    } catch (err) {
      console.error(err);
      showAlert('error', 'Failed to retrieve data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [searchTerm]);

  const showAlert = (type, text) => {
    setAlertMsg({ type, text });
    setTimeout(() => setAlertMsg({ type: '', text: '' }), 5000);
  };

  const handleOpenAdd = () => {
    setSelectedQuotation(null);
    setSelectedCustomer(null);
    setCustSearch('');
    setProdSearch('');
    setQuoteItems([]);
    setDiscount(0);
    // Default valid until 14 days from now
    const twoWeeks = new Date();
    twoWeeks.setDate(twoWeeks.getDate() + 14);
    setValidUntil(twoWeeks.toISOString().split('T')[0]);
    setNotes('');
    setQuotationModalOpen(true);
  };

  // Cart operations
  const addToQuote = (prod) => {
    const existing = quoteItems.find(item => item.productId === prod.id);
    if (existing) {
      setQuoteItems(quoteItems.map(item => 
        item.productId === prod.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setQuoteItems([...quoteItems, {
        productId: prod.id,
        productCode: prod.code,
        productName: prod.name,
        quantity: 1,
        unitPrice: prod.sellingPrice,
        discount: 0
      }]);
    }
    setProdSearch('');
    setShowProdResults(false);
  };

  const updateItemQty = (prodId, val) => {
    const qty = parseFloat(val) || 0;
    setQuoteItems(quoteItems.map(it => 
      it.productId === prodId ? { ...it, quantity: qty } : it
    ));
  };

  const updateItemDiscount = (prodId, val) => {
    const disc = parseFloat(val) || 0;
    setQuoteItems(quoteItems.map(it => 
      it.productId === prodId ? { ...it, discount: disc } : it
    ));
  };

  const removeItem = (prodId) => {
    setQuoteItems(quoteItems.filter(it => it.productId !== prodId));
  };

  // Totals
  const subtotal = quoteItems.reduce((acc, it) => acc + (it.quantity * it.unitPrice - it.discount), 0);
  const grandTotal = subtotal - discount;

  const handleQuoteSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCustomer) {
      showAlert('error', 'Customer selection is required.');
      return;
    }
    if (quoteItems.length === 0) {
      showAlert('error', 'Basket is empty.');
      return;
    }

    try {
      const payload = {
        customerId: selectedCustomer.id,
        validUntil,
        notes,
        discount,
        items: quoteItems
      };
      await api.post('/quotations', payload);
      showAlert('success', 'Quotation created successfully.');
      setQuotationModalOpen(false);
      loadData();
    } catch (err) {
      showAlert('error', err.response?.data?.error || 'Failed to create quotation.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this quotation?')) return;
    try {
      await api.delete(`/quotations/${id}`);
      showAlert('success', 'Quotation deleted.');
      loadData();
    } catch (err) {
      showAlert('error', err.response?.data?.error || 'Deletion failed.');
    }
  };

  // Convert Quotation to Invoice / Order
  const handleConvertToInvoice = async (id) => {
    if (!window.confirm('Do you want to convert this quotation into a live POS invoice? This will commit stocks and generate ledger balances.')) return;
    try {
      await api.post(`/quotations/${id}/convert-to-invoice`);
      showAlert('success', 'Converted to POS Invoice successfully!');
      loadData();
    } catch (err) {
      showAlert('error', err.response?.data?.error || 'Conversion failed.');
    }
  };

  const handleConvertToOrder = async (id) => {
    if (!window.confirm('Do you want to convert this quotation into a pending customer reservation order?')) return;
    try {
      await api.post(`/quotations/${id}/convert-to-order`);
      showAlert('success', 'Converted to Customer Order successfully!');
      loadData();
    } catch (err) {
      showAlert('error', err.response?.data?.error || 'Conversion failed.');
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-stone-850 flex items-center gap-2">
            <FileMinus size={22} className="text-wood-650" />
            {translate("Customer Quotations & Estimates", "මිල ගණන් කැඳවීම්")}
          </h2>
          <p className="text-xs text-stone-400 font-semibold mt-1">
            {translate("Prepare price estimates for furniture products and convert them directly to invoices or reservation orders.", "මිල ගණන් කැඳවීම් සකස් කිරීම සහ ඒවා ඇණවුම් හෝ බිල්පත් බවට පරිවර්තනය කිරීම.")}
          </p>
        </div>
        <div>
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 rounded-lg bg-wood-600 px-4 py-2 text-xs font-bold text-white hover:bg-wood-700 shadow-md"
          >
            <Plus size={15} />
            {translate("New Quotation", "නව මිල ගණන් කැඳවීමක්")}
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
            placeholder={translate("Search quotation number or customer name...", "මිල ගණන් අංකය හෝ පාරිභෝගිකයා අනුව සොයන්න...")}
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
                <th className="p-3.5">Quotation No</th>
                <th className="p-3.5">Date</th>
                <th className="p-3.5">Customer Name</th>
                <th className="p-3.5 text-right">Grand Total</th>
                <th className="p-3.5">Valid Until</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-center">Convert / Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 font-medium text-stone-700">
              {quotations.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-stone-400 font-bold">No quotations found.</td>
                </tr>
              ) : (
                quotations.map((q) => {
                  const isExpired = new Date(q.validUntil) < new Date() && q.status === 'Pending';
                  return (
                    <tr key={q.id} className="hover:bg-stone-50">
                      <td className="p-3.5 font-bold text-stone-850">{q.quotationNumber}</td>
                      <td className="p-3.5 text-stone-450">{new Date(q.date).toLocaleDateString()}</td>
                      <td className="p-3.5 font-bold text-stone-850">{q.customer?.name}</td>
                      <td className="p-3.5 text-right font-black">Rs. {q.totalAmount.toLocaleString()}</td>
                      <td className="p-3.5 text-stone-500">{new Date(q.validUntil).toLocaleDateString()}</td>
                      <td className="p-3.5">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                          isExpired 
                            ? 'bg-red-100 text-red-800' 
                            : q.status === 'Converted' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-orange-100 text-orange-850'
                        }`}>
                          {isExpired ? 'Expired' : q.status}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center justify-center gap-2">
                          {q.status === 'Pending' && !isExpired && (
                            <>
                              <button
                                onClick={() => handleConvertToInvoice(q.id)}
                                className="p-1 rounded border border-wood-200 text-wood-650 hover:bg-wood-600 hover:text-white transition-all flex items-center gap-1 text-[10px] px-2 font-bold shadow-sm"
                              >
                                <ShoppingCart size={12} />
                                POS Invoice
                              </button>
                              
                              <button
                                onClick={() => handleConvertToOrder(q.id)}
                                className="p-1 rounded border border-stone-250 text-stone-600 hover:bg-stone-850 hover:text-white transition-all flex items-center gap-1 text-[10px] px-2 font-bold shadow-sm"
                              >
                                <Award size={12} />
                                Order
                              </button>
                            </>
                          )}

                          <button
                            onClick={() => handleDelete(q.id)}
                            className="p-1 rounded border border-stone-200 text-stone-400 hover:text-red-650 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
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
         QUOTATION CREATE MODAL
         ========================================== */}
      {quotationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl border border-stone-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h3 className="text-base font-bold text-stone-850 flex items-center gap-1.5">
                <FileMinus size={18} className="text-wood-650" />
                Create Pricing Quotation
              </h3>
              <button onClick={() => setQuotationModalOpen(false)} className="text-stone-400 hover:text-stone-800">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleQuoteSubmit} className="mt-4 space-y-4">
              {/* Autocomplete Customer Lookup */}
              <div>
                <label className="block text-xs font-bold text-stone-600">Select Customer *</label>
                <input
                  type="text"
                  placeholder="Type customer name or phone..."
                  value={custSearch}
                  onChange={(e) => { setCustSearch(e.target.value); setShowCustResults(true); }}
                  onFocus={() => setShowCustResults(true)}
                  className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-stone-50 text-stone-800"
                />
                {showCustResults && custSearch && (
                  <div className="absolute max-h-36 overflow-y-auto rounded-lg border border-stone-200 bg-white shadow-lg z-30 divide-y divide-stone-100 w-96">
                    {filteredCustomers.map(c => (
                      <div
                        key={c.id}
                        onClick={() => {
                          setSelectedCustomer(c);
                          setCustSearch(c.name);
                          setShowCustResults(false);
                        }}
                        className="p-2 text-xs hover:bg-stone-50 cursor-pointer"
                      >
                        {c.name} ({c.phone})
                      </div>
                    ))}
                  </div>
                )}
                {selectedCustomer && (
                  <div className="mt-1 text-[10px] text-green-700 font-bold bg-green-50 px-2.5 py-1 rounded">
                    Selected Customer: {selectedCustomer.name} ({selectedCustomer.phone})
                  </div>
                )}
              </div>

              {/* Autocomplete Product Lookup */}
              <div>
                <label className="block text-xs font-bold text-stone-600">Add Furniture Item *</label>
                <input
                  type="text"
                  placeholder="Search products by code or name to insert..."
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
                        onClick={() => addToQuote(p)}
                        className="p-2 text-xs hover:bg-stone-50 cursor-pointer"
                      >
                        {p.name} (SKU: {p.code}) - Rs. {p.sellingPrice}
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
                      <th className="p-2 text-right">Price</th>
                      <th className="p-2 text-center" style={{ width: '80px' }}>Qty</th>
                      <th className="p-2 text-right" style={{ width: '100px' }}>Discount</th>
                      <th className="p-2 text-right">Total</th>
                      <th className="p-2 text-center">X</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 font-semibold text-stone-700">
                    {quoteItems.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="p-4 text-center text-stone-400 font-bold">Basket is empty.</td>
                      </tr>
                    ) : (
                      quoteItems.map((item) => (
                        <tr key={item.productId}>
                          <td className="p-2 font-bold">{item.productCode}</td>
                          <td className="p-2">{item.productName}</td>
                          <td className="p-2 text-right">Rs. {item.unitPrice}</td>
                          <td className="p-2 text-center">
                            <input
                              type="number"
                              required
                              value={item.quantity}
                              onChange={(e) => updateItemQty(item.productId, e.target.value)}
                              className="w-12 rounded border border-stone-200 p-0.5 text-center font-bold"
                            />
                          </td>
                          <td className="p-2 text-right">
                            <input
                              type="number"
                              value={item.discount}
                              onChange={(e) => updateItemDiscount(item.productId, e.target.value)}
                              className="w-16 rounded border border-stone-200 p-0.5 text-right text-green-700"
                            />
                          </td>
                          <td className="p-2 text-right font-black text-stone-900">
                            Rs. {(item.quantity * item.unitPrice - item.discount).toLocaleString()}
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

              {/* Summary fields */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs font-semibold">
                <div>
                  <label className="block text-stone-500">Valid Until *</label>
                  <input
                    type="date"
                    required
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-1.5 bg-stone-50 text-stone-850 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-stone-500">Invoice Discount (Rs.)</label>
                  <input
                    type="number"
                    value={discount}
                    onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                    className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-1.5 bg-stone-50 text-stone-800 text-right font-bold"
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
                  placeholder="Validity terms or price notes..."
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setQuotationModalOpen(false)}
                  className="rounded-lg border border-stone-200 px-4 py-2.5 text-xs font-bold text-stone-600 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-wood-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-wood-700 shadow-md"
                >
                  Create Quotation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
