import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import InvoiceA4Print from '../components/InvoiceA4Print';
import { 
  ShoppingCart, Plus, Trash2, Search, User, Truck, Calendar,
  CreditCard, Percent, FileText, CheckCircle, X, Printer, UserPlus, Home
} from 'lucide-react';

export default function Billing() {
  const { user } = useAuth();
  const location = useLocation();
  
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [materials, setMaterials] = useState([]);
  
  // Search query states
  const [prodSearch, setProdSearch] = useState('');
  const [custSearch, setCustSearch] = useState('');
  const [showProdResults, setShowProdResults] = useState(false);
  const [showCustResults, setShowCustResults] = useState(false);

  // Active Billing State
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [cartItems, setCartItems] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [deliveryCharge, setDeliveryCharge] = useState(0);
  const [installationCharge, setInstallationCharge] = useState(0);
  const [otherCharge, setOtherCharge] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [salesperson, setSalesperson] = useState(user?.name || '');
  const [notes, setNotes] = useState('');
  const [furnitureImage, setFurnitureImage] = useState(null);
  const [furnitureImagePreview, setFurnitureImagePreview] = useState('');
  const furnitureImageInputRef = useRef(null);

  // Delivery toggles
  const [createDelivery, setCreateDelivery] = useState(false);
  const [driverName, setDriverName] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('Standard Time');

  // Installment toggles
  const [enableInstallments, setEnableInstallments] = useState(false);
  const [installmentCount, setInstallmentCount] = useState(3);
  const [installmentsList, setInstallmentsList] = useState([]);

  // Modals / Success States
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [materialModalOpen, setMaterialModalOpen] = useState(false);
  const [successInvoice, setSuccessInvoice] = useState(null);
  const [printDetails, setPrintDetails] = useState(null);
  const [printFormat, setPrintFormat] = useState('a4'); // 'a4' or 'thermal'
  const [alertError, setAlertError] = useState('');
  const [loading, setLoading] = useState(false);

  // New Customer Form state
  const [newCust, setNewCust] = useState({
    name: '',
    phone: '',
    address: '',
    openingBalance: 0
  });
  const [materialForm, setMaterialForm] = useState({ name: '', image: null, preview: '' });
  const materialImageInputRef = useRef(null);
  const [warrantyEditor, setWarrantyEditor] = useState(null);
  const [warrantyYears, setWarrantyYears] = useState('');
  const [priceEditor, setPriceEditor] = useState(null);
  const [priceValue, setPriceValue] = useState('');

  useEffect(() => {
    return () => {
      if (furnitureImagePreview) {
        URL.revokeObjectURL(furnitureImagePreview);
      }
      if (materialForm.preview) {
        URL.revokeObjectURL(materialForm.preview);
      }
    };
  }, [furnitureImagePreview, materialForm.preview]);

  // Fetch initial autocomplete databases
  useEffect(() => {
    async function loadData() {
      try {
        const prodRes = await api.get('/products?status=Active');
        setProducts(prodRes.data);
        const custRes = await api.get('/customers?status=Active');
        setCustomers(custRes.data);
        const matRes = await api.get('/materials');
        setMaterials(matRes.data);
      } catch (err) {
        console.error(err);
      }
    }
    loadData();
  }, []);

  // Handle pre-filled state from custom order conversion
  useEffect(() => {
    if (location.state?.prefillCustomer) {
      setSelectedCustomer(location.state.prefillCustomer);
      setCustSearch(location.state.prefillCustomer.name);
    }
    if (location.state?.customOrderItem) {
      const item = location.state.customOrderItem;
      setCartItems([
        {
          productId: item.productId,
          productCode: item.productCode,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
          materialId: '',
          materialName: '',
          materialImage: '',
          warrantyPeriod: 'No Warranty',
          stockQty: 999999,
          notes: item.notes || '',
        }
      ]);
    }
  }, [location.state]);

  // Calculate cart totals
  const subtotal = Number(cartItems.reduce((acc, item) => acc + (item.quantity * item.unitPrice - item.discount), 0).toFixed(2));
  const grandTotal = Number((subtotal - discount + parseFloat(deliveryCharge || 0) + parseFloat(installationCharge || 0) + parseFloat(otherCharge || 0)).toFixed(2));
  const balanceAmount = Number((grandTotal - paidAmount).toFixed(2));

  // Recalculate installments when grandTotal / paidAmount / installmentCount / enableInstallments changes
  useEffect(() => {
    if (!enableInstallments || balanceAmount <= 0) {
      setInstallmentsList([]);
      return;
    }

    const list = [];
    const baseAmt = Number((balanceAmount / installmentCount).toFixed(2));
    let accumulated = 0;
    const today = new Date();
    
    for (let i = 1; i <= installmentCount; i++) {
      const dueDate = new Date(today.getFullYear(), today.getMonth() + i, today.getDate());
      let instAmt = baseAmt;
      
      if (i === installmentCount) {
        // Last installment absorbs the rounding difference
        instAmt = Number((balanceAmount - accumulated).toFixed(2));
      } else {
        accumulated = Number((accumulated + baseAmt).toFixed(2));
      }
      
      list.push({
        installmentAmount: instAmt,
        dueDate: dueDate.toISOString().split('T')[0]
      });
    }
    setInstallmentsList(list);
  }, [enableInstallments, balanceAmount, installmentCount]);

  // Autocomplete Lookups
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(prodSearch.toLowerCase()) ||
    p.code.toLowerCase().includes(prodSearch.toLowerCase())
  );

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(custSearch.toLowerCase()) ||
    c.phone.includes(custSearch)
  );

  // Cart operations
  const addToCart = (prod) => {
    const existing = cartItems.find(item => item.productId === prod.id);
    if (existing) {
      if (existing.quantity >= prod.stockQty && user?.role !== 'ADMIN') {
        alert(`Insufficient stock. Available: ${prod.stockQty}`);
        return;
      }
      setCartItems(cartItems.map(item => 
        item.productId === prod.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      if (prod.stockQty < 1 && user?.role !== 'ADMIN') {
        alert('Product out of stock.');
        return;
      }
      setCartItems([...cartItems, {
        productId: prod.id,
        productCode: prod.code,
        productName: prod.name,
        quantity: 1,
        unitPrice: prod.sellingPrice,
        discount: 0,
        materialName: prod.material || '',
        materialImage: '',
        warrantyPeriod: prod.warrantyPeriod || 'No Warranty',
        stockQty: prod.stockQty
      }]);
    }
    setProdSearch('');
    setShowProdResults(false);
  };

  const updateItemQty = (prodId, val) => {
    const qty = parseFloat(val) || 0;
    const item = cartItems.find(it => it.productId === prodId);
    if (qty > item.stockQty && user?.role !== 'ADMIN') {
      alert(`Insufficient stock. Max available: ${item.stockQty}`);
      return;
    }
    setCartItems(cartItems.map(it => 
      it.productId === prodId ? { ...it, quantity: qty } : it
    ));
  };

  const updateItemDiscount = (prodId, val) => {
    const disc = parseFloat(val) || 0;
    setCartItems(cartItems.map(it => 
      it.productId === prodId ? { ...it, discount: disc } : it
    ));
  };

  const updateItemPrice = (prodId, val) => {
    const price = parseFloat(val) || 0;
    setCartItems(cartItems.map(it =>
      it.productId === prodId ? { ...it, unitPrice: price } : it
    ));
  };

  const updateItemWarranty = (prodId, years) => {
    const parsedYears = parseFloat(years);
    const warrantyPeriod = parsedYears > 0
      ? `${parsedYears} ${parsedYears === 1 ? 'Year' : 'Years'}`
      : 'No Warranty';

    setCartItems(cartItems.map(it =>
      it.productId === prodId ? { ...it, warrantyPeriod } : it
    ));
  };

  const getWarrantyYears = (warrantyPeriod) => {
    const text = String(warrantyPeriod || '');
    if (/month/i.test(text)) {
      const months = parseFloat(text);
      return months ? String(Number((months / 12).toFixed(2))) : '';
    }

    const years = parseFloat(text);
    return years ? String(years) : '';
  };

  const openWarrantyEditor = (item) => {
    setWarrantyEditor(item);
    setWarrantyYears(getWarrantyYears(item.warrantyPeriod));
  };

  const saveWarrantyEditor = () => {
    if (!warrantyEditor) return;
    updateItemWarranty(warrantyEditor.productId, warrantyYears);
    setWarrantyEditor(null);
    setWarrantyYears('');
  };

  const openPriceEditor = (item) => {
    setPriceEditor(item);
    setPriceValue(String(item.unitPrice || ''));
  };

  const savePriceEditor = () => {
    if (!priceEditor) return;
    updateItemPrice(priceEditor.productId, priceValue);
    setPriceEditor(null);
    setPriceValue('');
  };

  const updateItemMaterial = (prodId, materialId) => {
    const selected = materials.find((mat) => mat.id === materialId);
    setCartItems(cartItems.map((it) => (
      it.productId === prodId
        ? {
            ...it,
            materialId: selected?.id || '',
            materialName: selected?.name || '',
            materialImage: selected?.image || '',
          }
        : it
    )));
  };

  const removeItem = (prodId) => {
    setCartItems(cartItems.filter(it => it.productId !== prodId));
  };

  // Quick register customer
  const handleQuickCustomer = async (e) => {
    e.preventDefault();
    if (!newCust.name || !newCust.phone) {
      alert('Name and Phone are required.');
      return;
    }
    try {
      const res = await api.post('/customers', newCust);
      // Add new customer to autocomplete database
      setCustomers([...customers, res.data]);
      setSelectedCustomer(res.data);
      setCustSearch(res.data.name);
      setCustomerModalOpen(false);
      setNewCust({ name: '', phone: '', address: '', openingBalance: 0 });
    } catch (err) {
      alert(err.response?.data?.error || 'Registration failed.');
    }
  };

  const handleMaterialImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setAlertError('Please upload an image file for the material sample.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAlertError('Material sample image must be smaller than 5MB.');
      return;
    }
    if (materialForm.preview) {
      URL.revokeObjectURL(materialForm.preview);
    }
    setMaterialForm({ ...materialForm, image: file, preview: URL.createObjectURL(file) });
  };

  const resetMaterialForm = () => {
    if (materialForm.preview) {
      URL.revokeObjectURL(materialForm.preview);
    }
    setMaterialForm({ name: '', image: null, preview: '' });
    if (materialImageInputRef.current) {
      materialImageInputRef.current.value = '';
    }
  };

  const handleCreateMaterial = async (e) => {
    e.preventDefault();
    if (!materialForm.name.trim()) {
      setAlertError('Material name is required.');
      return;
    }
    try {
      const payload = new FormData();
      payload.append('name', materialForm.name.trim());
      if (materialForm.image) {
        payload.append('materialImage', materialForm.image);
      }
      const res = await api.post('/materials', payload);
      setMaterials((prev) => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)));
      resetMaterialForm();
      setMaterialModalOpen(false);
    } catch (err) {
      setAlertError(err.response?.data?.error || 'Failed to add material.');
    }
  };

  // Submit billing
  const handleCheckout = async () => {
    if (!selectedCustomer) {
      setAlertError('Select a customer first.');
      return;
    }
    if (cartItems.length === 0) {
      setAlertError('Add at least one item.');
      return;
    }
    if (balanceAmount > 0 && selectedCustomer.name.toLowerCase() === 'cash customer') {
      setAlertError('Credit bills need a registered customer.');
      return;
    }

    setLoading(true);
    setAlertError('');
    try {
      const payload = new FormData();
      payload.append('customerId', selectedCustomer.id);
      payload.append('date', new Date().toISOString());
      payload.append('salesperson', salesperson);
      payload.append('items', JSON.stringify(cartItems));
      payload.append('discount', discount);
      payload.append('deliveryCharge', deliveryCharge);
      payload.append('installationCharge', installationCharge);
      payload.append('otherCharge', otherCharge);
      payload.append('paidAmount', paidAmount);
      payload.append('paymentMethod', paymentMethod);
      payload.append('notes', notes);
      payload.append('createDelivery', String(createDelivery));
      payload.append('driverName', driverName);
      payload.append('vehicleNumber', vehicleNumber);
      payload.append('deliveryDate', deliveryDate);
      payload.append('deliveryTime', deliveryTime);
      payload.append('installmentsList', JSON.stringify(installmentsList));
      if (furnitureImage) {
        payload.append('furnitureImage', furnitureImage);
      }

      const res = await api.post('/invoices', payload);
      setSuccessInvoice(res.data);

      // Fetch printing layouts
      const printRes = await api.get(`/invoices/${res.data.id}/print`);
      setPrintDetails(printRes.data);
    } catch (err) {
      setAlertError(err.response?.data?.error || 'Checkout transaction failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleFurnitureImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setAlertError('Please upload an image file for the furniture photo.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAlertError('Furniture image must be smaller than 5MB.');
      return;
    }
    if (furnitureImagePreview) {
      URL.revokeObjectURL(furnitureImagePreview);
    }
    setAlertError('');
    setFurnitureImage(file);
    setFurnitureImagePreview(URL.createObjectURL(file));
  };

  const clearFurnitureImage = () => {
    if (furnitureImagePreview) {
      URL.revokeObjectURL(furnitureImagePreview);
    }
    setFurnitureImage(null);
    setFurnitureImagePreview('');
    if (furnitureImageInputRef.current) {
      furnitureImageInputRef.current.value = '';
    }
  };

  // Print execution helper
  const handlePrint = (format) => {
    setPrintFormat(format);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  const handleReset = () => {
    setCartItems([]);
    setSelectedCustomer(null);
    setCustSearch('');
    setDiscount(0);
    setDeliveryCharge(0);
    setInstallationCharge(0);
    setOtherCharge(0);
    setPaidAmount(0);
    setPaymentMethod('Cash');
    setNotes('');
    clearFurnitureImage();
    setCreateDelivery(false);
    setEnableInstallments(false);
    setSuccessInvoice(null);
    setPrintDetails(null);
  };

  return (
    <div className="billing-native-page space-y-4">
      <div className="billing-native-header">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to="/"
            aria-label="Go to dashboard"
            className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-stone-950 text-white shadow-md transition-all active:scale-95"
          >
            <Home size={20} strokeWidth={2.6} />
          </Link>
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-blue-600">Invoice Header</p>
            <h2 className="truncate text-2xl font-black text-stone-950">New Bill</h2>
          </div>
        </div>
        <div className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700">
          POS
        </div>
      </div>

      {/* SUCCESS POPUP WITH DUAL PRINT */}
      {successInvoice && printDetails && (
        <div className="rounded-xl border border-green-200 bg-white p-8 shadow-xl text-center space-y-6 max-w-xl mx-auto animate-fade-in z-45 relative">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-green-600">
            <CheckCircle size={36} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-stone-850">
              Bill generated
            </h3>
            <p className="text-xs font-semibold text-stone-400 mt-1">Invoice Number: {successInvoice.invoiceNumber}</p>
          </div>

          <div className="p-4 rounded-lg bg-stone-50 border border-stone-200 flex flex-col gap-2.5">
            <span className="text-xs text-stone-500 font-bold uppercase tracking-wider">Print layout</span>
            <div className="grid grid-cols-2 gap-3 mt-1">
              <button
                onClick={() => handlePrint('a4')}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-stone-900 px-4 py-3 text-xs font-bold text-white hover:bg-stone-800 transition-colors shadow-md"
              >
                <Printer size={15} /> A4 Invoice
              </button>
              <button
                onClick={() => handlePrint('thermal')}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-wood-600 px-4 py-3 text-xs font-bold text-white hover:bg-wood-700 transition-colors shadow-md"
              >
                <Printer size={15} /> 80mm Receipt
              </button>
            </div>
          </div>

          <div className="flex gap-3 justify-center pt-2">
            <button
              onClick={handleReset}
              className="rounded-lg border border-stone-200 px-5 py-2.5 text-xs font-bold text-stone-600 hover:bg-stone-100 transition-colors"
            >
              New bill
            </button>
          </div>
        </div>
      )}

      {/* DUAL PRINT TEMPLATES CONTAINER (Invisible on screen, only visible in media print) */}
      <div id="print-section" className={`hidden ${printFormat === 'thermal' ? 'print-thermal' : 'print-a4'}`}>
        {printDetails && (
          printFormat === 'a4' ? (
            /* A4 INVOICE LAYOUT */
            <>
            <InvoiceA4Print printDetails={printDetails} />
            <div className="hidden p-8 bg-white text-stone-900 font-sans text-xs">
              <div className="flex justify-between items-start border-b-2 border-wood-700 pb-4">
                <div className="flex items-center gap-3">
                  <img src="/logo.png" alt="Logo" className="h-14 w-auto" />
                  <div>
                    <h1 className="text-2xl font-black tracking-tight text-wood-950 font-display">
                      {printDetails.business?.shopName || 'Alight Furniture'}
                    </h1>
                    <p className="text-[10px] text-stone-500 font-semibold tracking-wide uppercase">Furniture & Quality Timbers</p>
                  </div>
                </div>
                <div className="text-right leading-relaxed">
                  <p className="font-bold">{printDetails.business?.address}</p>
                  <p>Phone: {printDetails.business?.phone1} {printDetails.business?.phone2 && `| ${printDetails.business?.phone2}`}</p>
                  <p>Email: {printDetails.business?.email} | Web: {printDetails.business?.website}</p>
                </div>
              </div>

              {/* Invoice details */}
              <div className="grid grid-cols-2 gap-4 py-4 border-b border-stone-150">
                <div>
                  <h3 className="font-bold text-stone-400 uppercase tracking-wider mb-1">Customer</h3>
                  <p className="font-bold text-sm text-stone-900">{printDetails.invoice?.customer?.name}</p>
                  <p>{printDetails.invoice?.customer?.address}</p>
                  <p>Phone: {printDetails.invoice?.customer?.phone}</p>
                </div>
                <div className="text-right">
                  <h3 className="font-bold text-stone-400 uppercase tracking-wider mb-1">Invoice Info</h3>
                  <p className="font-bold text-sm text-wood-700">{printDetails.invoice?.invoiceNumber}</p>
                  <p>Date: {new Date(printDetails.invoice?.date).toLocaleDateString()}</p>
                  <p>Salesperson: {printDetails.invoice?.salesperson}</p>
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full text-left border-collapse mt-4">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 font-bold uppercase tracking-wider">
                    <th className="p-2.5">SKU / Code</th>
                    <th className="p-2.5">Product Name</th>
                    <th className="p-2.5 text-right">Unit Price</th>
                    <th className="p-2.5 text-center">Qty</th>
                    <th className="p-2.5 text-right">Discount</th>
                    <th className="p-2.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-medium text-stone-800">
                  {printDetails.invoice?.items?.map((item) => (
                    <tr key={item.id}>
                      <td className="p-2.5 font-bold">{item.productCode}</td>
                      <td className="p-2.5">{item.productName}</td>
                      <td className="p-2.5 text-right">Rs. {item.unitPrice.toLocaleString()}</td>
                      <td className="p-2.5 text-center">{item.quantity}</td>
                      <td className="p-2.5 text-right">- Rs. {item.discount.toLocaleString()}</td>
                      <td className="p-2.5 text-right font-bold">Rs. {item.lineTotal.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Calculations Block */}
              <div className="grid grid-cols-2 gap-4 mt-6">
                <div>
                  {printDetails.invoice?.installments?.length > 0 && (
                    <div className="border border-stone-200 rounded-lg p-3">
                      <h4 className="font-bold text-stone-500 uppercase tracking-wider mb-1.5">Installment Schedule</h4>
                      <div className="divide-y divide-stone-100">
                        {printDetails.invoice.installments.map((inst, idx) => (
                          <div key={inst.id} className="py-1.5 flex justify-between text-[11px] font-semibold text-stone-600">
                            <span>Installment {idx + 1} ({new Date(inst.dueDate).toLocaleDateString()})</span>
                            <span className="font-bold">Rs. {inst.installmentAmount.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="text-right space-y-1.5 text-stone-700 font-semibold pr-2">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>Rs. {printDetails.invoice?.subtotal.toLocaleString()}</span>
                  </div>
                  {printDetails.invoice?.discount > 0 && (
                    <div className="flex justify-between text-green-700">
                      <span>Discount:</span>
                      <span>- Rs. {printDetails.invoice?.discount.toLocaleString()}</span>
                    </div>
                  )}
                  {printDetails.invoice?.deliveryCharge > 0 && (
                    <div className="flex justify-between">
                      <span>Delivery Charge:</span>
                      <span>Rs. {printDetails.invoice?.deliveryCharge.toLocaleString()}</span>
                    </div>
                  )}
                  {printDetails.invoice?.installationCharge > 0 && (
                    <div className="flex justify-between">
                      <span>Installation Charge:</span>
                      <span>Rs. {printDetails.invoice?.installationCharge.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t-2 border-stone-200 pt-1.5 text-base font-black text-stone-900">
                    <span>Grand Total:</span>
                    <span>Rs. {printDetails.invoice?.grandTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-green-700">
                    <span>Amount Paid ({printDetails.invoice?.paymentMethod}):</span>
                    <span>Rs. {printDetails.invoice?.paidAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-t border-dashed border-stone-300 pt-1 text-sm font-black text-red-750">
                    <span>Balance Due:</span>
                    <span>Rs. {printDetails.invoice?.balanceAmount.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Warranties */}
              <div className="mt-8 border-t border-stone-200 pt-4 text-[10px] text-stone-400 font-medium text-center space-y-1">
                <p>Warranties cover manufacturing faults only. Physical damage is not covered under warranty terms.</p>
                <p className="font-bold text-stone-500 mt-2">{printDetails.business?.receiptFooterText}</p>
              </div>
            </div>
            </>
          ) : (
            /* 80MM THERMAL RECEIPT LAYOUT */
            <div className="thermal-width p-2 bg-white text-black font-mono text-[10px] leading-relaxed">
              <div className="text-center space-y-1 border-b border-stone-300 pb-2">
                <h1 className="text-sm font-black uppercase tracking-tight">{printDetails.business?.shopName}</h1>
                <p className="text-[9px]">{printDetails.business?.address}</p>
                <p className="text-[9px]">TEL: {printDetails.business?.phone1} {printDetails.business?.phone2 && `/ ${printDetails.business?.phone2}`}</p>
              </div>

              <div className="py-2 border-b border-stone-300 space-y-0.5 text-[9px] font-semibold">
                <p>INV: {printDetails.invoice?.invoiceNumber}</p>
                <p>DATE: {new Date(printDetails.invoice?.date).toLocaleString()}</p>
                <p>CUST: {printDetails.invoice?.customer?.name}</p>
                <p>PHONE: {printDetails.invoice?.customer?.phone}</p>
              </div>

              {/* Compact items list */}
              <div className="py-2 border-b border-dashed border-stone-300">
                <table className="w-full text-left text-[9px]">
                  <thead>
                    <tr className="border-b border-stone-300 font-bold uppercase">
                      <th>Item</th>
                      <th className="text-center">Qty</th>
                      <th className="text-right">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printDetails.invoice?.items?.map((item) => (
                      <React.Fragment key={item.id}>
                        <tr>
                          <td>{item.productName.substring(0, 18)}</td>
                          <td className="text-center">{item.quantity}</td>
                          <td className="text-right">Rs. {item.lineTotal.toLocaleString()}</td>
                        </tr>
                        {item.materialName && (
                          <tr>
                            <td colSpan="3" className="text-[8px]">Material: {item.materialName}</td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Calculations compact */}
              <div className="py-2 text-[9px] space-y-1 font-bold">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>Rs. {printDetails.invoice?.subtotal.toLocaleString()}</span>
                </div>
                {printDetails.invoice?.discount > 0 && (
                  <div className="flex justify-between">
                    <span>Discount:</span>
                    <span>-Rs. {printDetails.invoice?.discount.toLocaleString()}</span>
                  </div>
                )}
                {printDetails.invoice?.deliveryCharge > 0 && (
                  <div className="flex justify-between">
                    <span>Delivery:</span>
                    <span>Rs. {printDetails.invoice?.deliveryCharge.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-stone-300 pt-1 text-xs font-black">
                  <span>TOTAL:</span>
                  <span>Rs. {printDetails.invoice?.grandTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>PAID ({printDetails.invoice?.paymentMethod}):</span>
                  <span>Rs. {printDetails.invoice?.paidAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs font-black border-t border-dashed border-stone-300 pt-1">
                  <span>DUE:</span>
                  <span>Rs. {printDetails.invoice?.balanceAmount.toLocaleString()}</span>
                </div>
              </div>

              <div className="text-center text-[8px] font-medium pt-3 border-t border-stone-300 mt-2 space-y-1">
                <p>Thank you. Come Again!</p>
                <p>Alight Furniture POS Client System</p>
              </div>
            </div>
          )
        )}
      </div>

      {/* CORE BILLING INTERFACE FORM (Hidden if success invoice is open) */}
      {!successInvoice && (
        <div className="billing-native-grid grid grid-cols-1 gap-4 lg:grid-cols-3">
          
          {/* CART ITEMS LIST & CUSTOMER LOOKUP */}
          <div className="space-y-4 lg:col-span-2">
            
            {/* SELECT CUSTOMER SECTION */}
            <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-stone-850 text-xs uppercase tracking-wide flex items-center gap-1.5">
                  <User size={16} className="text-wood-650" />
                  Customer
                </h3>
                <button
                  onClick={() => setCustomerModalOpen(true)}
                  aria-label="Add customer"
                  title="Add customer"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-700 transition-all active:scale-95"
                >
                  <UserPlus size={17} />
                </button>
              </div>

              <div className="relative">
                <input
                  type="text"
                  placeholder="Search customer"
                  value={custSearch}
                  onChange={(e) => { setCustSearch(e.target.value); setShowCustResults(true); }}
                  onFocus={() => setShowCustResults(true)}
                  className="w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-stone-50 text-stone-850 placeholder-stone-400 focus:outline-none focus:border-wood-500 font-bold"
                />

                {/* Autocomplete list */}
                {showCustResults && custSearch && (
                  <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-lg border border-stone-200 bg-white shadow-lg z-30 divide-y divide-stone-100">
                    {filteredCustomers.map(c => (
                      <div
                        key={c.id}
                        onClick={() => {
                          setSelectedCustomer(c);
                          setCustSearch(c.name);
                          setShowCustResults(false);
                        }}
                        className="p-2.5 text-xs font-semibold hover:bg-stone-50 cursor-pointer flex justify-between items-center"
                      >
                        <span className="text-stone-800">{c.name} ({c.phone})</span>
                        <span className="text-[10px] text-stone-400 font-medium">Balance: Rs. {c.currentBalance.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedCustomer && (
                <div className="p-3.5 rounded-lg bg-stone-50 border border-stone-200 flex justify-between items-center text-xs font-bold">
                  <div>
                    <p className="text-stone-850 font-black">{selectedCustomer.name}</p>
                    <p className="text-[10px] text-stone-400 font-medium mt-0.5">{selectedCustomer.phone} | {selectedCustomer.address || 'No Address'}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-stone-400 uppercase">Receivable Balance</span>
                    <p className={`text-sm font-black ${selectedCustomer.currentBalance > 0 ? 'text-red-650' : 'text-stone-600'}`}>
                      Rs. {selectedCustomer.currentBalance.toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* CART AND PRODUCTS SELECTOR */}
            <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-stone-850 text-xs uppercase tracking-wide flex items-center gap-1.5">
                  <ShoppingCart size={16} className="text-wood-650" />
                  Items
                </h3>
                <button
                  type="button"
                  onClick={() => setMaterialModalOpen(true)}
                  aria-label="Add material"
                  title="Add material"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-wood-50 text-wood-650 transition-all active:scale-95"
                >
                  <Plus size={17} />
                </button>
              </div>

              {/* Product Lookup */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-stone-400">
                  <Search size={16} />
                </div>
                <input
                  type="text"
                  placeholder="Search item"
                  value={prodSearch}
                  onChange={(e) => { setProdSearch(e.target.value); setShowProdResults(true); }}
                  onFocus={() => setShowProdResults(true)}
                  className="w-full rounded-lg border border-stone-200 pl-9 pr-3 py-2 text-xs bg-stone-50 text-stone-800 focus:outline-none focus:border-wood-500"
                />

                {/* Autocomplete list */}
                {showProdResults && prodSearch && (
                  <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-lg border border-stone-200 bg-white shadow-lg z-30 divide-y divide-stone-100">
                    {filteredProducts.map(p => (
                      <div
                        key={p.id}
                        onClick={() => addToCart(p)}
                        className="p-2.5 text-xs font-semibold hover:bg-stone-50 cursor-pointer flex justify-between items-center"
                      >
                        <div>
                          <span className="text-stone-800 font-bold">{p.name}</span>
                          <span className="text-[10px] text-stone-400 font-medium block">SKU: {p.code} | {p.material}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-stone-800 font-black">Rs. {p.sellingPrice.toLocaleString()}</span>
                          <span className="text-[10px] text-stone-400 font-medium block">Stock: {p.stockQty} qty</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Cart Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-stone-200 text-stone-400 font-bold uppercase tracking-wider">
                      <th className="pb-2">SKU</th>
                      <th className="pb-2">Product Name</th>
                      <th className="pb-2">Material</th>
                      <th className="pb-2 text-right">Price</th>
                      <th className="pb-2 text-center" style={{ width: '80px' }}>Qty</th>
                      <th className="pb-2 text-right" style={{ width: '100px' }}>Line Discount</th>
                      <th className="pb-2 text-right">Total</th>
                      <th className="pb-2 text-center">Delete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 font-semibold text-stone-700">
                    {cartItems.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="p-8 text-center text-stone-400 font-bold">
                          Basket is empty. Search products above to add.
                        </td>
                      </tr>
                    ) : (
                      cartItems.map((item) => (
                        <tr key={item.productId}>
                          <td className="py-2.5 font-bold text-stone-850">{item.productCode}</td>
                          <td className="py-2.5">
                            <p>{item.productName}</p>
                            <button
                              type="button"
                              onClick={() => openWarrantyEditor(item)}
                              className="mt-1 rounded-full bg-blue-50 px-2 py-1 text-[9px] font-black uppercase text-blue-700 transition-all active:scale-95"
                            >
                              Warranty: {item.warrantyPeriod}
                            </button>
                          </td>
                          <td className="py-2.5 min-w-36">
                            <div className="flex items-center gap-2">
                              {item.materialImage && (
                                <img
                                  src={`${import.meta.env.DEV ? 'http://localhost:5000' : ''}${item.materialImage}`}
                                  alt={item.materialName}
                                  className="h-8 w-8 rounded border border-stone-200 object-cover bg-white"
                                />
                              )}
                              <select
                                value={item.materialId || ''}
                                onChange={(e) => updateItemMaterial(item.productId, e.target.value)}
                                className="w-32 rounded border border-stone-200 p-1 text-[10px] font-bold text-stone-700"
                              >
                                <option value="">{item.materialName || 'Select material'}</option>
                                {materials.map((mat) => (
                                  <option key={mat.id} value={mat.id}>{mat.name}</option>
                                ))}
                              </select>
                            </div>
                          </td>
                          <td className="py-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => openPriceEditor(item)}
                              className="rounded-full bg-stone-100 px-2.5 py-1.5 text-xs font-black text-stone-900 transition-all active:scale-95"
                            >
                              Rs. {item.unitPrice.toLocaleString()}
                            </button>
                          </td>
                          <td className="py-2.5 text-center">
                            <label className="cart-mini-field">
                              <span>Qty</span>
                              <input
                                type="number"
                                required
                                value={item.quantity}
                                aria-label={`${item.productName} quantity`}
                                placeholder="Qty"
                                inputMode="decimal"
                                onChange={(e) => updateItemQty(item.productId, e.target.value)}
                              />
                            </label>
                          </td>
                          <td className="py-2.5 text-right text-green-700">
                            <label className="cart-mini-field discount">
                              <span>Disc</span>
                              <input
                                type="number"
                                value={item.discount}
                                aria-label={`${item.productName} line discount`}
                                placeholder="Disc"
                                inputMode="decimal"
                                onChange={(e) => updateItemDiscount(item.productId, e.target.value)}
                              />
                            </label>
                          </td>
                          <td className="py-2.5 text-right font-black text-stone-900">
                            Rs. {(item.quantity * item.unitPrice - item.discount).toLocaleString()}
                          </td>
                          <td className="py-2.5 text-center">
                            <button
                              onClick={() => removeItem(item.productId)}
                              className="text-stone-400 hover:text-red-650"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* DYNAMIC DISPATCH AND INSTALLMENTS PANELS */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              
              {/* DELIVERY CONFIGURATION */}
              <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createDelivery}
                    onChange={(e) => setCreateDelivery(e.target.checked)}
                    className="h-4.5 w-4.5 rounded border-stone-300 text-wood-600 focus:ring-wood-500"
                  />
                  <h3 className="font-extrabold text-stone-850 text-xs uppercase tracking-wide flex items-center gap-1.5">
                    <Truck size={16} />
                    Delivery
                  </h3>
                </label>

                {createDelivery && (
                  <div className="space-y-3.5 pt-2 border-t border-stone-100 animate-fade-in text-xs font-semibold">
                    <div>
                      <label className="block text-stone-500">Driver Name</label>
                      <input
                        type="text"
                        value={driverName}
                        onChange={(e) => setDriverName(e.target.value)}
                        className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-1.5 bg-stone-50 text-stone-800"
                        placeholder="Driver / Transport person name"
                      />
                    </div>
                    <div>
                      <label className="block text-stone-500">Vehicle Number</label>
                      <input
                        type="text"
                        value={vehicleNumber}
                        onChange={(e) => setVehicleNumber(e.target.value)}
                        className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-1.5 bg-stone-50 text-stone-800"
                        placeholder="e.g. WP LC-8090"
                      />
                    </div>
                    <div>
                      <label className="block text-stone-500">Expected Delivery Date *</label>
                      <input
                        type="date"
                        required
                        value={deliveryDate}
                        onChange={(e) => setDeliveryDate(e.target.value)}
                        className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-1.5 bg-stone-50 text-stone-850 font-bold"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* INSTALLMENTS CONFIGURATION */}
              <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableInstallments}
                    onChange={(e) => setEnableInstallments(e.target.checked)}
                    className="h-4.5 w-4.5 rounded border-stone-300 text-wood-600 focus:ring-wood-500"
                  />
                  <h3 className="font-extrabold text-stone-850 text-xs uppercase tracking-wide flex items-center gap-1.5">
                    <Calendar size={16} />
                    Installments
                  </h3>
                </label>

                {enableInstallments && balanceAmount > 0 && (
                  <div className="space-y-3.5 pt-2 border-t border-stone-100 animate-fade-in text-xs font-semibold">
                    <div>
                      <label className="block text-stone-500">Installment Count (Months)</label>
                      <select
                        value={installmentCount}
                        onChange={(e) => setInstallmentCount(parseInt(e.target.value))}
                        className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-1.5 bg-stone-50 text-stone-850 font-bold"
                      >
                        <option value="2">2 Installments</option>
                        <option value="3">3 Installments</option>
                        <option value="6">6 Installments</option>
                        <option value="12">12 Installments</option>
                      </select>
                    </div>

                    <div className="max-h-28 overflow-y-auto space-y-1.5 border border-stone-150 p-2 rounded-lg bg-stone-50">
                      {installmentsList.map((inst, idx) => (
                        <div key={idx} className="flex justify-between items-center text-[10px]">
                          <span>Month {idx + 1} ({inst.dueDate})</span>
                          <span className="font-bold text-stone-800">Rs. {inst.installmentAmount.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

            </div>

          </div>

          {/* CHECKOUT CALCULATOR PANEL */}
          <div className="space-y-4">
            
            <div className="rounded-2xl border border-stone-250 bg-white p-4 shadow-md space-y-3">
              <h3 className="font-extrabold text-stone-850 text-xs uppercase tracking-wide flex items-center gap-1.5 border-b border-stone-100 pb-2.5">
                <CreditCard size={16} className="text-wood-650" />
                Pay
              </h3>

              {alertError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg">
                  {alertError}
                </div>
              )}

              {/* Input Charges */}
              <div className="space-y-3.5 text-xs font-semibold text-stone-600">
                
                {/* Invoice level discount */}
                <div>
                  <label className="flex justify-between">
                    <span>Discount</span>
                    <Percent size={14} className="text-stone-400" />
                  </label>
                  <input
                    type="number"
                    value={discount}
                    onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                    className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-1.5 bg-stone-50 text-stone-800 text-right font-bold"
                  />
                </div>

                {/* Delivery Charge */}
                <div>
                  <label>Delivery Charge (Rs.)</label>
                  <input
                    type="number"
                    value={deliveryCharge}
                    onChange={(e) => setDeliveryCharge(parseFloat(e.target.value) || 0)}
                    className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-1.5 bg-stone-50 text-stone-800 text-right font-bold"
                  />
                </div>

                {/* Installation Charge */}
                <div>
                  <label>Installation Charge (Rs.)</label>
                  <input
                    type="number"
                    value={installationCharge}
                    onChange={(e) => setInstallationCharge(parseFloat(e.target.value) || 0)}
                    className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-1.5 bg-stone-50 text-stone-800 text-right font-bold"
                  />
                </div>

                {/* Other Charge */}
                <div>
                  <label>Other Miscellaneous (Rs.)</label>
                  <input
                    type="number"
                    value={otherCharge}
                    onChange={(e) => setOtherCharge(parseFloat(e.target.value) || 0)}
                    className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-1.5 bg-stone-50 text-stone-800 text-right font-bold"
                  />
                </div>
              </div>

              {/* Total calculations display */}
              <div className="border-t border-stone-150 pt-4 space-y-2.5 text-xs font-semibold text-stone-600">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-bold text-stone-800">Rs. {subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-t-2 border-stone-200 pt-2 text-sm font-black text-stone-900 bg-stone-50 p-2 rounded-lg">
                  <span>Grand Total:</span>
                  <span>Rs. {grandTotal.toLocaleString()}</span>
                </div>

                {/* Paid Amount */}
                <div className="pt-2">
                  <label className="block text-[10px] text-stone-500 font-extrabold uppercase">Paid now</label>
                  <input
                    type="number"
                    step="0.01"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                    className="mt-1.5 block w-full rounded-lg border-2 border-wood-200 px-3 py-2 text-stone-900 text-right font-black text-base focus:border-wood-550 focus:outline-none bg-stone-50/50"
                  />
                </div>

                {/* Balance Amount */}
                <div className="flex justify-between items-center pt-2 text-xs font-extrabold text-red-750 p-1">
                  <span>Balance</span>
                  <span>Rs. {balanceAmount.toLocaleString()}</span>
                </div>

                {/* Payment Method */}
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

                {/* Salesperson */}
                <div>
                  <label className="block text-stone-500">Salesperson Name</label>
                  <input
                    type="text"
                    value={salesperson}
                    onChange={(e) => setSalesperson(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-1.5 bg-stone-50 text-stone-800"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-stone-500">Notes</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-1.5 bg-stone-50 text-stone-800"
                    placeholder="Warranties or discount notes..."
                  />
                </div>

                {/* Furniture Image */}
                <div className="border-t border-stone-150 pt-3">
                  <label className="block text-[10px] text-stone-500 font-extrabold uppercase">
                    Furniture Photo for This Bill
                  </label>
                  <div className="mt-1.5 rounded-lg border border-dashed border-stone-300 bg-stone-50 p-3">
                    {furnitureImagePreview ? (
                      <div className="space-y-2">
                        <img
                          src={furnitureImagePreview}
                          alt="Selected furniture"
                          className="h-36 w-full rounded-md object-cover border border-stone-200 bg-white"
                        />
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-[10px] font-bold text-stone-600">
                            {furnitureImage?.name}
                          </span>
                          <button
                            type="button"
                            onClick={clearFurnitureImage}
                            className="rounded-md border border-red-200 px-2 py-1 text-[10px] font-bold text-red-650 hover:bg-red-50"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className="flex cursor-pointer flex-col items-center justify-center gap-1 py-4 text-center">
                        <FileText size={20} className="text-wood-650" />
                        <span className="text-xs font-black text-stone-800">Upload furniture image</span>
                        <span className="text-[10px] font-semibold text-stone-400">JPG, PNG, or WEBP up to 5MB</span>
                        <input
                          ref={furnitureImageInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleFurnitureImageChange}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>

              {/* Checkout Button */}
              <button
                onClick={handleCheckout}
                disabled={loading}
                className="w-full rounded-lg bg-wood-600 hover:bg-wood-700 text-white font-bold text-sm py-3 transition-colors shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 mt-4"
              >
                <CheckCircle size={16} />
                {loading ? 'Processing POS Transaction...' : 'Complete & Generate Invoice'}
              </button>

            </div>

          </div>

        </div>
      )}

      {warrantyEditor && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-4 backdrop-blur-sm sm:items-center">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              saveWarrantyEditor();
            }}
            className="w-full max-w-sm rounded-[28px] border border-stone-200 bg-white p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-blue-600">Warranty</p>
                <h3 className="mt-1 text-lg font-black text-stone-950">{warrantyEditor.productName}</h3>
              </div>
              <button
                type="button"
                onClick={() => setWarrantyEditor(null)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-100 text-stone-600 transition-all active:scale-95"
                aria-label="Close warranty editor"
              >
                <X size={18} />
              </button>
            </div>

            <label className="mt-5 block text-xs font-black uppercase tracking-wide text-stone-500">
              Years
              <input
                value={warrantyYears}
                onChange={(event) => setWarrantyYears(event.target.value)}
                inputMode="decimal"
                type="number"
                min="0"
                step="0.5"
                placeholder="Years"
                className="mt-2 block w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-right text-2xl font-black text-stone-950 outline-none focus:border-blue-500"
              />
            </label>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  updateItemWarranty(warrantyEditor.productId, 0);
                  setWarrantyEditor(null);
                  setWarrantyYears('');
                }}
                className="min-h-[52px] rounded-2xl border border-stone-200 bg-white text-sm font-black text-stone-600 transition-all active:scale-95"
              >
                No Warranty
              </button>
              <button
                type="submit"
                className="min-h-[52px] rounded-2xl bg-blue-600 text-sm font-black text-white transition-all active:scale-95"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      )}

      {priceEditor && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-4 backdrop-blur-sm sm:items-center">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              savePriceEditor();
            }}
            className="w-full max-w-sm rounded-[28px] border border-stone-200 bg-white p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-600">Price</p>
                <h3 className="mt-1 text-lg font-black text-stone-950">{priceEditor.productName}</h3>
              </div>
              <button
                type="button"
                onClick={() => setPriceEditor(null)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-100 text-stone-600 transition-all active:scale-95"
                aria-label="Close price editor"
              >
                <X size={18} />
              </button>
            </div>

            <label className="mt-5 block text-xs font-black uppercase tracking-wide text-stone-500">
              Unit price
              <input
                value={priceValue}
                onChange={(event) => setPriceValue(event.target.value)}
                inputMode="decimal"
                type="number"
                min="0"
                step="0.01"
                placeholder="Price"
                className="mt-2 block w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-right text-2xl font-black text-stone-950 outline-none focus:border-emerald-500"
              />
            </label>

            <button
              type="submit"
              className="mt-5 min-h-[52px] w-full rounded-2xl bg-emerald-600 text-sm font-black text-white transition-all active:scale-95"
            >
              Save Price
            </button>
          </form>
        </div>
      )}

      {/* ==========================================
         QUICK REGISTER CUSTOMER MODAL
         ========================================== */}
      {customerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h3 className="text-base font-bold text-stone-850 flex items-center gap-1.5">
                <UserPlus size={18} className="text-wood-650" />
                Register New Customer
              </h3>
              <button onClick={() => setCustomerModalOpen(false)} className="text-stone-400 hover:text-stone-800">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleQuickCustomer} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-600">Full Name *</label>
                <input
                  type="text"
                  required
                  value={newCust.name}
                  onChange={(e) => setNewCust({ ...newCust, name: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-stone-50 text-stone-800"
                  placeholder="e.g. Navin Rodrigo"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-600">Phone Number *</label>
                <input
                  type="text"
                  required
                  value={newCust.phone}
                  onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-stone-50 text-stone-800"
                  placeholder="e.g. 0771234567"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-600">Address</label>
                <input
                  type="text"
                  value={newCust.address}
                  onChange={(e) => setNewCust({ ...newCust, address: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-stone-50 text-stone-800"
                  placeholder="e.g. Colombo Road, Negombo"
                />
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
                  className="rounded-lg bg-wood-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-wood-700"
                >
                  Register
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {materialModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h3 className="text-base font-bold text-stone-850 flex items-center gap-1.5">
                <Plus size={18} className="text-wood-650" />
                Add Material
              </h3>
              <button
                onClick={() => {
                  resetMaterialForm();
                  setMaterialModalOpen(false);
                }}
                className="text-stone-400 hover:text-stone-800"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateMaterial} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-600">Material Name *</label>
                <input
                  type="text"
                  required
                  value={materialForm.name}
                  onChange={(e) => setMaterialForm({ ...materialForm, name: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-stone-50 text-stone-800"
                  placeholder="e.g. Teak Wood, Grey Fabric, Black Leather"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-600">Sample Image</label>
                <div className="mt-1 rounded-lg border border-dashed border-stone-300 bg-stone-50 p-3">
                  {materialForm.preview ? (
                    <div className="flex items-center gap-3">
                      <img
                        src={materialForm.preview}
                        alt="Material sample"
                        className="h-20 w-20 rounded-md border border-stone-200 object-cover bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (materialForm.preview) URL.revokeObjectURL(materialForm.preview);
                          setMaterialForm({ ...materialForm, image: null, preview: '' });
                          if (materialImageInputRef.current) materialImageInputRef.current.value = '';
                        }}
                        className="rounded-md border border-red-200 px-3 py-2 text-xs font-bold text-red-650 hover:bg-red-50"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <label className="flex cursor-pointer flex-col items-center justify-center gap-1 py-5 text-center">
                      <span className="text-xs font-black text-stone-800">Upload square sample</span>
                      <span className="text-[10px] font-semibold text-stone-400">JPG, PNG, or WEBP up to 5MB</span>
                      <input
                        ref={materialImageInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleMaterialImageChange}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => {
                    resetMaterialForm();
                    setMaterialModalOpen(false);
                  }}
                  className="rounded-lg border border-stone-200 px-4 py-2.5 text-xs font-bold text-stone-600 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-wood-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-wood-700"
                >
                  Save Material
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
