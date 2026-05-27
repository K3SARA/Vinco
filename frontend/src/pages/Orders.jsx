import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  Award, Plus, Search, Edit, Trash2, X, ShoppingCart, 
  Eye, Receipt, CheckCircle, ShieldAlert
} from 'lucide-react';

export default function Orders() {
  const { user } = useAuth();
  
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState(localStorage.getItem('alight_lang') || 'en');

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  
  // Search Autocomplete
  const [prodSearch, setProdSearch] = useState('');
  const [custSearch, setCustSearch] = useState('');
  const [showProdResults, setShowProdResults] = useState(false);
  const [showCustResults, setShowCustResults] = useState(false);

  // Form state
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [orderItems, setOrderItems] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [notes, setNotes] = useState('');
  const [reserveStock, setReserveStock] = useState(true);

  // Payment Form state
  const [payAmt, setPayAmt] = useState('');
  const [payMethod, setPayMethod] = useState('Cash');
  const [payNotes, setPayNotes] = useState('');

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
      const oRes = await api.get(`/orders?search=${searchTerm}`);
      setOrders(oRes.data);
      const prodRes = await api.get('/products?status=Active');
      setProducts(prodRes.data);
      const custRes = await api.get('/customers?status=Active');
      setCustomers(custRes.data);
    } catch (err) {
      console.error(err);
      showAlert('error', 'Failed to retrieve order records.');
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
    setSelectedCustomer(null);
    setCustSearch('');
    setProdSearch('');
    setOrderItems([]);
    setDiscount(0);
    setPaidAmount(0);
    setPaymentMethod('Cash');
    setNotes('');
    setReserveStock(true);
    setOrderModalOpen(true);
  };

  // Cart operations
  const addToOrder = (prod) => {
    const existing = orderItems.find(item => item.productId === prod.id);
    if (existing) {
      setOrderItems(orderItems.map(item => 
        item.productId === prod.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setOrderItems([...orderItems, {
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
    setOrderItems(orderItems.map(it => 
      it.productId === prodId ? { ...it, quantity: qty } : it
    ));
  };

  const updateItemDiscount = (prodId, val) => {
    const disc = parseFloat(val) || 0;
    setOrderItems(orderItems.map(it => 
      it.productId === prodId ? { ...it, discount: disc } : it
    ));
  };

  const removeItem = (prodId) => {
    setOrderItems(orderItems.filter(it => it.productId !== prodId));
  };

  // Totals
  const subtotal = orderItems.reduce((acc, it) => acc + (it.quantity * it.unitPrice - it.discount), 0);
  const grandTotal = subtotal - discount;

  const handleOrderSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCustomer) {
      showAlert('error', 'Customer selection is required.');
      return;
    }
    if (orderItems.length === 0) {
      showAlert('error', 'Basket is empty.');
      return;
    }

    try {
      const payload = {
        customerId: selectedCustomer.id,
        notes,
        discount,
        paidAmount,
        paymentMethod,
        reserveStock,
        items: orderItems
      };
      await api.post('/orders', payload);
      showAlert('success', 'Customer order registered successfully.');
      setOrderModalOpen(false);
      loadData();
    } catch (err) {
      showAlert('error', err.response?.data?.error || 'Failed to create order.');
    }
  };

  const handleOpenDetails = async (order) => {
    try {
      const res = await api.get(`/orders/${order.id}`);
      setSelectedOrder(res.data);
      setDetailsModalOpen(true);
    } catch (err) {
      showAlert('error', 'Failed to retrieve order details.');
    }
  };

  const handleCancelOrder = async (orderId) => {
    if (!window.confirm('WARNING: Cancelling this order will release reserved inventory stock and refund the customer balance. Are you sure?')) return;
    try {
      await api.post(`/orders/${orderId}/cancel`);
      showAlert('success', 'Order cancelled and inventory released.');
      setDetailsModalOpen(false);
      loadData();
    } catch (err) {
      showAlert('error', err.response?.data?.error || 'Failed to cancel order.');
    }
  };

  const handleConvertToInvoice = async (orderId) => {
    if (!window.confirm('Do you want to convert this reservation order into a final sales invoice? This will commit stocks and log final customer ledger balances.')) return;
    try {
      await api.post(`/orders/${orderId}/convert-to-invoice`);
      showAlert('success', 'Order converted to Sales Invoice successfully.');
      setDetailsModalOpen(false);
      loadData();
    } catch (err) {
      showAlert('error', err.response?.data?.error || 'Failed to convert order to invoice.');
    }
  };

  const handleOpenPayment = (order) => {
    setSelectedOrder(order);
    setPayAmt('');
    setPayMethod('Cash');
    setPayNotes('');
    setPaymentModalOpen(true);
  };

  const handlePostPayment = async (e) => {
    e.preventDefault();
    const amt = parseFloat(payAmt);
    if (isNaN(amt) || amt <= 0) {
      showAlert('error', 'Payment amount must be greater than zero.');
      return;
    }

    try {
      await api.post(`/orders/${selectedOrder.id}/payment`, {
        amount: amt,
        paymentMethod: payMethod,
        notes: payNotes
      });
      showAlert('success', 'Order advance payment logged successfully.');
      setPaymentModalOpen(false);
      loadData();
    } catch (err) {
      showAlert('error', err.response?.data?.error || 'Failed to post order payment.');
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(prodSearch.toLowerCase()) ||
    p.code.toLowerCase().includes(prodSearch.toLowerCase())
  );

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(custSearch.toLowerCase()) ||
    c.phone.includes(custSearch)
  );

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-stone-850 flex items-center gap-2">
            <Award size={22} className="text-wood-650" />
            {translate("Customer Custom Orders & Reservations", "පාරිභෝගික ඇණවුම් සහ වෙන්කිරීම්")}
          </h2>
          <p className="text-xs text-stone-400 font-semibold mt-1">
            {translate("Manage custom furniture orders, track advance deposits, toggle inventory reservation lock, and convert to invoice.", "පාරිභෝගිකයින්ගේ ඇණවුම් බාරගැනීම, අත්තිකාරම් මුදල් වාර්තා තැබීම සහ බිල්පත් බවට හැරවීම.")}
          </p>
        </div>
        <div>
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 rounded-lg bg-wood-600 px-4 py-2 text-xs font-bold text-white hover:bg-wood-700 shadow-md"
          >
            <Plus size={15} />
            {translate("New Order", "නව ඇණවුමක් බාරගන්න")}
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
            placeholder={translate("Search order number or customer name...", "ඇණවුම් අංකය හෝ පාරිභෝගිකයා අනුව සොයන්න...")}
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
                <th className="p-3.5">Order No</th>
                <th className="p-3.5">Date</th>
                <th className="p-3.5">Customer Name</th>
                <th className="p-3.5 text-right">Grand Total</th>
                <th className="p-3.5 text-right">Advance Paid</th>
                <th className="p-3.5 text-right">Balance Due</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 font-medium text-stone-700">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-stone-400 font-bold">No orders found.</td>
                </tr>
              ) : (
                orders.map((o) => {
                  const isCancelled = o.status === 'Cancelled';
                  const isConverted = o.status === 'Converted';
                  const balance = o.grandTotal - o.paidAmount;
                  return (
                    <tr key={o.id} className={`hover:bg-stone-50 ${isCancelled ? 'bg-red-50/10' : ''}`}>
                      <td className="p-3.5 font-bold text-stone-850">{o.orderNumber}</td>
                      <td className="p-3.5 text-stone-450">{new Date(o.date).toLocaleDateString()}</td>
                      <td className="p-3.5 font-bold text-stone-850">{o.customer?.name}</td>
                      <td className="p-3.5 text-right font-semibold">Rs. {o.grandTotal.toLocaleString()}</td>
                      <td className="p-3.5 text-right text-green-700">Rs. {o.paidAmount.toLocaleString()}</td>
                      <td className="p-3.5 text-right font-black text-stone-900">Rs. {balance.toLocaleString()}</td>
                      <td className="p-3.5">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                          isCancelled 
                            ? 'bg-red-100 text-red-800' 
                            : isConverted 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-orange-100 text-orange-850'
                        }`}>
                          {o.status}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleOpenDetails(o)}
                            className="p-1 rounded border border-stone-250 hover:bg-stone-100 text-stone-600 transition-colors flex items-center gap-1 text-[10px] px-2 font-bold"
                          >
                            <Eye size={13} />
                            {translate("View", "විස්තර")}
                          </button>

                          {o.status === 'Pending' && (
                            <button
                              onClick={() => handleOpenPayment(o)}
                              className="p-1 rounded bg-wood-555 border border-wood-200 hover:bg-wood-600 hover:text-white text-wood-650 transition-all flex items-center gap-1 text-[10px] px-2 font-bold shadow-sm"
                            >
                              <Receipt size={13} />
                              {translate("Deposit", "අත්තිකාරම්")}
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
         ORDER CREATE MODAL
         ========================================== */}
      {orderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl border border-stone-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h3 className="text-base font-bold text-stone-850 flex items-center gap-1.5">
                <Award size={18} className="text-wood-650" />
                Book Customer Reservation Order
              </h3>
              <button onClick={() => setOrderModalOpen(false)} className="text-stone-400 hover:text-stone-800">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleOrderSubmit} className="mt-4 space-y-4">
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
                        onClick={() => addToOrder(p)}
                        className="p-2 text-xs hover:bg-stone-50 cursor-pointer"
                      >
                        {p.name} (SKU: {p.code}) - Rs. {p.sellingPrice} | Stock: {p.stockQty}
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
                    {orderItems.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="p-4 text-center text-stone-400 font-bold">Basket is empty.</td>
                      </tr>
                    ) : (
                      orderItems.map((item) => (
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

              {/* Stock Reservation Option */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="reserve-stock"
                  checked={reserveStock}
                  onChange={(e) => setReserveStock(e.target.checked)}
                  className="h-4.5 w-4.5 rounded border-stone-300 text-wood-655 focus:ring-wood-500"
                />
                <label htmlFor="reserve-stock" className="text-xs font-bold text-stone-700 cursor-pointer">
                  Reserve stock quantities immediately / අදාළ තොග ප්‍රමාණය වෙන්කර තබන්න
                </label>
              </div>

              {/* Payments & Summary fields */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 text-xs font-semibold">
                <div>
                  <label className="block text-stone-500">Invoice Discount (Rs.)</label>
                  <input
                    type="number"
                    value={discount}
                    onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                    className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-1.5 bg-stone-50 text-stone-850 text-right font-bold"
                  />
                </div>

                <div>
                  <label className="block text-stone-500">Advance Deposit Paid (Rs.)</label>
                  <input
                    type="number"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                    className="mt-1 block w-full rounded-lg border border-stone-205 px-3 py-1.5 bg-stone-50 text-stone-900 text-right font-extrabold"
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
                  placeholder="Expected completion date or custom measurements..."
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setOrderModalOpen(false)}
                  className="rounded-lg border border-stone-200 px-4 py-2.5 text-xs font-bold text-stone-600 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-wood-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-wood-700 shadow-md"
                >
                  Create Reservation Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
         ORDER DETAIL & ACTIONS MODAL
         ========================================== */}
      {detailsModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl border border-stone-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div>
                <h3 className="text-base font-bold text-stone-850 flex items-center gap-1.5">
                  <Award size={18} className="text-wood-650" />
                  Order Reservation Details: {selectedOrder.orderNumber}
                </h3>
                <span className="text-[10px] text-stone-400 font-semibold">Reserve Stock Lock: {selectedOrder.reserveStock ? 'YES' : 'NO'}</span>
              </div>
              <button onClick={() => setDetailsModalOpen(false)} className="text-stone-400 hover:text-stone-800">
                <X size={20} />
              </button>
            </div>

            {/* Actions for Pending Orders */}
            {selectedOrder.status === 'Pending' && (
              <div className="mt-4 p-4 rounded-lg bg-stone-50 border border-stone-200 flex justify-between items-center gap-4">
                <span className="text-xs text-stone-500 font-bold uppercase tracking-wider">Order Conversion / බිල්පත් බවට පරිවර්තනය:</span>
                <button
                  onClick={() => handleConvertToInvoice(selectedOrder.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-wood-600 px-4 py-2 text-xs font-bold text-white hover:bg-wood-700 transition-colors shadow-md"
                >
                  <ShoppingCart size={13} />
                  Convert to Final POS Invoice
                </button>
              </div>
            )}

            {/* Meta details */}
            <div className="grid grid-cols-2 gap-4 mt-4 text-xs font-semibold text-stone-600 border-b border-stone-100 pb-4">
              <div>
                <p className="text-stone-400 uppercase text-[10px] mb-0.5">Bill To</p>
                <p className="text-stone-950 font-bold">{selectedOrder.customer?.name}</p>
                <p>{selectedOrder.customer?.phone} | {selectedOrder.customer?.address}</p>
              </div>
              <div className="text-right">
                <p className="text-stone-400 uppercase text-[10px] mb-0.5">Order Info</p>
                <p>Date: {new Date(selectedOrder.date).toLocaleString()}</p>
                <p>Status: <span className="font-bold text-wood-700">{selectedOrder.status}</span></p>
              </div>
            </div>

            {/* Items Table */}
            <div className="mt-4 overflow-y-auto max-h-48 border border-stone-150 rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-stone-50 text-stone-400 font-bold uppercase border-b border-stone-200">
                    <th className="p-3">SKU</th>
                    <th className="p-3">Product Name</th>
                    <th className="p-3 text-right">Price</th>
                    <th className="p-3 text-center">Qty</th>
                    <th className="p-3 text-right">Discount</th>
                    <th className="p-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-semibold text-stone-700">
                  {selectedOrder.items?.map((item) => (
                    <tr key={item.id}>
                      <td className="p-3 font-bold">{item.productCode}</td>
                      <td className="p-3">{item.productName}</td>
                      <td className="p-3 text-right">Rs. {item.unitPrice.toLocaleString()}</td>
                      <td className="p-3 text-center">{item.quantity}</td>
                      <td className="p-3 text-right text-green-700">- Rs. {item.discount.toLocaleString()}</td>
                      <td className="p-3 text-right font-black text-stone-900">Rs. {item.lineTotal.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pricing Summary */}
            <div className="text-right space-y-1.5 text-xs font-semibold text-stone-600 mt-4 pr-1">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>Rs. {selectedOrder.subtotal.toLocaleString()}</span>
              </div>
              {selectedOrder.discount > 0 && (
                <div className="flex justify-between text-green-700">
                  <span>Discount:</span>
                  <span>- Rs. {selectedOrder.discount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between border-t-2 border-stone-200 pt-1.5 text-sm font-black text-stone-900 bg-stone-50 p-2 rounded-lg">
                <span>Grand Total:</span>
                <span>Rs. {selectedOrder.grandTotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-green-700">
                <span>Advance Paid:</span>
                <span>Rs. {selectedOrder.paidAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-t border-dashed border-stone-300 pt-1 text-xs font-black text-red-750">
                <span>Outstanding Balance:</span>
                <span>Rs. {(selectedOrder.grandTotal - selectedOrder.paidAmount).toLocaleString()}</span>
              </div>
            </div>

            {/* Cancel Button (Admin only) */}
            {user?.role === 'ADMIN' && selectedOrder.status === 'Pending' && (
              <div className="mt-6 p-4 rounded-lg bg-red-50 border border-red-200 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <ShieldAlert size={20} className="text-red-650" />
                  <div className="text-[10px] text-red-700 font-medium">
                    <p className="font-bold">Administrative Controls / විගණන පාලනයන්</p>
                    <p>Cancelling this order releases all reserved stocks and restores the customer ledger.</p>
                  </div>
                </div>
                <button
                  onClick={() => handleCancelOrder(selectedOrder.id)}
                  className="rounded-lg bg-red-650 hover:bg-red-800 px-4 py-2 text-xs font-bold text-white shadow-md transition-colors"
                >
                  Cancel Order
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==========================================
         ORDER PAYMENT RECEIPT MODAL
         ========================================== */}
      {paymentModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h3 className="text-base font-bold text-stone-850 flex items-center gap-1.5">
                <Receipt size={18} className="text-wood-650" />
                Collect Advance Deposit Payment
              </h3>
              <button onClick={() => setPaymentModalOpen(false)} className="text-stone-400 hover:text-stone-800">
                <X size={20} />
              </button>
            </div>

            <div className="mt-3 p-3.5 rounded-lg bg-stone-50 border border-stone-150 text-xs font-bold text-stone-600 space-y-1">
              <div className="flex justify-between">
                <span>Order No:</span>
                <span className="text-stone-900">{selectedOrder.orderNumber}</span>
              </div>
              <div className="flex justify-between text-red-750">
                <span>Outstanding Balance:</span>
                <span>Rs. {(selectedOrder.grandTotal - selectedOrder.paidAmount).toLocaleString()}</span>
              </div>
            </div>

            <form onSubmit={handlePostPayment} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-600">Deposit Amount (Rs.) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={payAmt}
                  onChange={(e) => setPayAmt(e.target.value)}
                  className="mt-1.5 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-stone-50 text-stone-900 font-black text-base"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-600">Payment Method *</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 bg-stone-50 text-stone-850 font-bold"
                >
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-600">Notes / Receipts description</label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-1.5 bg-stone-50 text-stone-800"
                  placeholder="e.g. Paid additional advance deposit"
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
                  Post Deposit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
