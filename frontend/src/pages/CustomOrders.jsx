import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Wrench, Plus, Search, Edit, Trash2, ArrowLeft,
  Calendar, Hammer, DollarSign, Layers, Clock, CheckCircle,
  FileText, AlertTriangle, MessageSquare, ChevronRight, X, Eye, Upload
} from 'lucide-react';

const STAGES = ['Order placed', 'Quoted', 'Confirmed', 'In production', 'Ready', 'Delivered'];

export default function CustomOrders() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [lang, setLang] = useState(localStorage.getItem('vinco_lang') || 'en');

  // View state: 'list' | 'create' | 'detail' | 'edit'
  const [view, setView] = useState('list');
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [carpenters, setCarpenters] = useState([]);
  const [materialsStock, setMaterialsStock] = useState([]);
  
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [alertMsg, setAlertMsg] = useState({ type: '', text: '' });

  // List filters
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState('');

  // Modals / Dialogs
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [stageWarnings, setStageWarnings] = useState([]);
  const [pendingStageChange, setPendingStageChange] = useState(null);
  const [showReversalModal, setShowReversalModal] = useState(false);
  const [pendingReversalStage, setPendingReversalStage] = useState(null);

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');

  // Tabs inside detail view
  const [activeTab, setActiveTab] = useState('specs');

  // Customer search inside form
  const [custSearchTerm, setCustSearchTerm] = useState('');
  const [showCustDropdown, setShowCustDropdown] = useState(false);

  // Form State
  const [form, setForm] = useState({
    customer_id: '',
    order_date: new Date().toISOString().split('T')[0],
    furniture_title: '',
    dim_length_cm: '',
    dim_width_cm: '',
    dim_height_cm: '',
    timber_type: '',
    timber_grade: 'Grade A',
    finish: 'Melamine',
    additional_materials: '',
    material_line_items: [],
    est_days: '',
    daily_rate: '',
    quote_price: '',
    assigned_carpenter_id: '',
    notes: '',
  });
  
  const [designFile, setDesignFile] = useState(null);
  const [designFilePreview, setDesignFilePreview] = useState('');
  const fileInputRef = useRef(null);

  // Translate helper
  const translate = (en, si) => (lang === 'en' ? en : si);

  useEffect(() => {
    const handleLangChange = () => setLang(localStorage.getItem('vinco_lang') || 'en');
    window.addEventListener('languageChange', handleLangChange);
    return () => window.removeEventListener('languageChange', handleLangChange);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ordersRes, custRes, carpRes, matRes] = await Promise.all([
        api.get(`/custom-orders?search=${searchTerm}&stage=${stageFilter}`),
        api.get('/customers?status=Active'),
        api.get('/carpenters'),
        api.get('/materials-stock'),
      ]);
      setOrders(ordersRes.data);
      setCustomers(custRes.data);
      setCarpenters(carpRes.data);
      setMaterialsStock(matRes.data);
    } catch (err) {
      console.error(err);
      showAlert('error', 'Failed to retrieve custom orders data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [searchTerm, stageFilter]);

  const showAlert = (type, text) => {
    setAlertMsg({ type, text });
    setTimeout(() => setAlertMsg({ type: '', text: '' }), 6000);
  };

  const getDesignReferenceUrl = (filePath) => {
    if (!filePath) return '';
    const host = api.defaults.baseURL.replace('/api', '');
    return `${host}${filePath}`;
  };

  // Stage styles map
  const getStageStyle = (stg) => {
    switch (stg) {
      case 'Order placed':
        return 'bg-stone-100 text-stone-600 border-stone-200';
      case 'Quoted':
        return 'bg-stone-200 text-stone-700 border-stone-300';
      case 'Confirmed':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'In production':
        return 'bg-[#B34A1A]/10 text-[#B34A1A] border-[#B34A1A]/20';
      case 'Ready':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'Delivered':
        return 'bg-stone-800 text-stone-100 border-stone-900';
      default:
        return 'bg-stone-100 text-stone-600 border-stone-200';
    }
  };

  // Add material row in costing tab
  const addMaterialRow = () => {
    const defaultMat = materialsStock[0];
    setForm((prev) => ({
      ...prev,
      material_line_items: [
        ...prev.material_line_items,
        {
          material_id: defaultMat?.material_id || '',
          material_name: defaultMat?.material_name || '',
          qty: 1,
          cost_per_sqft: defaultMat?.cost_per_sqft || 0,
        },
      ],
    }));
  };

  const removeMaterialRow = (idx) => {
    setForm((prev) => {
      const copy = [...prev.material_line_items];
      copy.splice(idx, 1);
      return { ...prev, material_line_items: copy };
    });
  };

  const handleMaterialChange = (idx, field, val) => {
    setForm((prev) => {
      const copy = [...prev.material_line_items];
      const row = { ...copy[idx] };

      if (field === 'material_id') {
        const selected = materialsStock.find((m) => m.material_id === val);
        row.material_id = val;
        row.material_name = selected ? selected.material_name : '';
        row.cost_per_sqft = selected ? selected.cost_per_sqft : 0;
      } else if (field === 'qty') {
        row.qty = parseFloat(val) || 0;
      } else if (field === 'cost_per_sqft') {
        row.cost_per_sqft = parseFloat(val) || 0;
      }

      copy[idx] = row;
      return { ...prev, material_line_items: copy };
    });
  };

  // Image handlers
  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showAlert('error', 'Only images are allowed as design references.');
      return;
    }
    setDesignFile(file);
    setDesignFilePreview(URL.createObjectURL(file));
  };

  const clearImage = () => {
    setDesignFile(null);
    setDesignFilePreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Create & Edit triggers
  const handleOpenCreate = () => {
    setForm({
      customer_id: '',
      order_date: new Date().toISOString().split('T')[0],
      furniture_title: '',
      dim_length_cm: '',
      dim_width_cm: '',
      dim_height_cm: '',
      timber_type: '',
      timber_grade: 'Grade A',
      finish: 'Melamine',
      additional_materials: '',
      material_line_items: [],
      est_days: '',
      daily_rate: '',
      quote_price: '',
      assigned_carpenter_id: '',
      notes: '',
    });
    setDesignFile(null);
    setDesignFilePreview('');
    setCustSearchTerm('');
    setView('create');
  };

  const handleOpenEdit = (order) => {
    setForm({
      customer_id: order.customer_id,
      order_date: new Date(order.order_date).toISOString().split('T')[0],
      furniture_title: order.furniture_title,
      dim_length_cm: order.dim_length_cm || '',
      dim_width_cm: order.dim_width_cm || '',
      dim_height_cm: order.dim_height_cm || '',
      timber_type: order.timber_type || '',
      timber_grade: order.timber_grade || 'Grade A',
      finish: order.finish || 'Melamine',
      additional_materials: order.additional_materials || '',
      material_line_items: order.material_line_items || [],
      est_days: order.est_days || '',
      daily_rate: order.daily_rate || '',
      quote_price: order.quote_price || '',
      assigned_carpenter_id: order.assigned_carpenter_id || '',
      notes: '',
    });
    setDesignFile(null);
    setDesignFilePreview(order.design_reference_file ? getDesignReferenceUrl(order.design_reference_file) : '');
    setCustSearchTerm(order.customer?.name || '');
    setSelectedOrder(order);
    setView('edit');
  };

  const handleOpenDetail = async (orderId) => {
    setLoading(true);
    try {
      const res = await api.get(`/custom-orders/${orderId}`);
      setSelectedOrder(res.data);
      setView('detail');
      setActiveTab('specs');
    } catch (err) {
      console.error(err);
      showAlert('error', 'Failed to retrieve order details.');
    } finally {
      setLoading(false);
    }
  };

  // Submit Order Form
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.customer_id) {
      showAlert('error', 'Please select a registered customer.');
      return;
    }
    if (!form.furniture_title.trim()) {
      showAlert('error', 'Please provide a furniture title.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = new FormData();
      Object.keys(form).forEach((key) => {
        if (key === 'material_line_items') {
          payload.append(key, JSON.stringify(form[key]));
        } else {
          payload.append(key, form[key]);
        }
      });
      if (designFile) {
        payload.append('designFile', designFile);
      }

      if (view === 'edit') {
        const res = await api.put(`/custom-orders/${selectedOrder.id}`, payload);
        showAlert('success', 'Custom order updated successfully.');
        handleOpenDetail(selectedOrder.id);
      } else {
        const res = await api.post('/custom-orders', payload);
        showAlert('success', 'Custom order draft created.');
        setView('list');
        loadData();
      }
    } catch (err) {
      console.error(err);
      showAlert('error', err.response?.data?.error || 'Failed to submit order.');
    } finally {
      setIsSaving(false);
    }
  };

  // Lifecycle Stage updates (handles Warnings/Reversals)
  const handleStageTransition = async (stage, force = false, restore = false) => {
    try {
      const res = await api.post(`/custom-orders/${selectedOrder.id}/stage`, {
        stage,
        forceStageChange: force,
        restoreStock: restore,
      });

      if (res.data.status === 'warning') {
        setStageWarnings(res.data.warnings);
        setPendingStageChange(stage);
        setShowWarningModal(true);
      } else {
        showAlert('success', `Stage updated to "${stage}" successfully.`);
        setShowWarningModal(false);
        setShowReversalModal(false);
        handleOpenDetail(selectedOrder.id);
      }
    } catch (err) {
      console.error(err);
      showAlert('error', err.response?.data?.error || 'Stage change failed.');
    }
  };

  // Trigger stage change (checking if we are reverting)
  const triggerStageChange = (newStage) => {
    const oldStage = selectedOrder.stage;
    if (oldStage === newStage) return;

    const isReverting = ['Confirmed', 'In production', 'Ready', 'Delivered'].includes(oldStage) &&
                       ['Order placed', 'Quoted'].includes(newStage);

    if (isReverting) {
      setPendingReversalStage(newStage);
      setShowReversalModal(true);
    } else {
      handleStageTransition(newStage);
    }
  };

  // Add carpenter payment
  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      showAlert('error', 'Please enter a valid payment amount.');
      return;
    }
    if (!selectedOrder.assigned_carpenter_id) {
      showAlert('error', 'No carpenter is assigned to this order.');
      return;
    }

    try {
      await api.post(`/carpenters/${selectedOrder.assigned_carpenter_id}/payments`, {
        amount: parseFloat(paymentForm.amount),
        date: paymentForm.date,
        notes: paymentForm.notes,
        transactionType: 'PAYMENT',
        customOrderNumber: selectedOrder.order_number,
      });

      showAlert('success', 'Carpenter payment recorded successfully.');
      setPaymentModalOpen(false);
      setPaymentForm({
        amount: '',
        date: new Date().toISOString().split('T')[0],
        notes: '',
      });
      handleOpenDetail(selectedOrder.id);
    } catch (err) {
      console.error(err);
      showAlert('error', err.response?.data?.error || 'Failed to submit payment.');
    }
  };

  // Add note manually
  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;

    try {
      await api.post(`/custom-orders/${selectedOrder.id}/notes`, { note: newNoteText });
      showAlert('success', 'Note added.');
      setNewNoteText('');
      setNoteModalOpen(false);
      handleOpenDetail(selectedOrder.id);
    } catch (err) {
      console.error(err);
      showAlert('error', 'Failed to add note.');
    }
  };

  const handleDeleteOrder = async (id) => {
    if (!window.confirm('Delete this custom order? This is permanent.')) return;
    try {
      await api.delete(`/custom-orders/${id}`);
      showAlert('success', 'Order deleted.');
      setView('list');
      loadData();
    } catch (err) {
      showAlert('error', 'Failed to delete order.');
    }
  };

  // Convert custom order to invoice
  const handleConvertToInvoice = () => {
    if (!selectedOrder) return;
    
    // We navigate to /billing, passing the state
    navigate('/billing', {
      state: {
        prefillCustomer: selectedOrder.customer,
        customOrderItem: {
          productId: 'CUSTOM-FURNITURE',
          productCode: selectedOrder.order_number,
          productName: `Custom Furniture: ${selectedOrder.furniture_title}`,
          quantity: 1,
          unitPrice: selectedOrder.quote_price || 0,
          discount: 0,
          notes: `Based on Custom Order: ${selectedOrder.order_number}`,
        }
      }
    });
  };

  // Calculations for Job Costing
  const matCost = form.material_line_items.reduce((sum, item) => sum + (item.qty * item.cost_per_sqft), 0);
  const labCost = (parseFloat(form.est_days) || 0) * (parseFloat(form.daily_rate) || 0);
  const totalEstimatedCost = matCost + labCost;
  const quotePriceVal = parseFloat(form.quote_price) || 0;
  const estimatedProfit = quotePriceVal - totalEstimatedCost;

  // Filter customers for dropdown selection in form
  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(custSearchTerm.toLowerCase()) ||
    c.phone.includes(custSearchTerm)
  );

  // Metrics for dashboard cards
  const totalOrdersCount = orders.length;
  const inProdCount = orders.filter((o) => o.stage === 'In production').length;
  const readyCount = orders.filter((o) => o.stage === 'Ready').length;
  const pendingQuoteCount = orders.filter((o) => o.stage === 'Order placed').length;

  return (
    <div className="space-y-6">
      
      {/* ==========================================
         1. LIST VIEW
         ========================================== */}
      {view === 'list' && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
            <div>
              <h2 className="text-xl font-bold text-stone-850 flex items-center gap-2">
                <Wrench size={22} className="text-[#B34A1A]" />
                {translate("Custom Manufacture Orders", "අභිමත භාණ්ඩ ඇණවුම් කළමනාකරණය")}
              </h2>
              <p className="text-xs text-stone-400 font-semibold mt-1">
                {translate(
                  "Track custom furniture commissions, compute timber/board square footage costs, assign carpenters, and manage stage progress.",
                  "අභිමත ඇණවුම් ලියාපදිංචිය, අමුද්‍රව්‍ය පිරිවැය ගණනය, වඩු කාර්මිකයන් පැවරීම සහ නිෂ්පාදන මට්ටම් මෙහෙයවීම."
                )}
              </p>
            </div>

            <div>
              <button
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#B34A1A] px-4 py-2 text-xs font-bold text-white hover:bg-[#9a3f16] shadow-md transition-all cursor-pointer"
              >
                <Plus size={15} />
                {translate("New Custom Order", "නව ඇණවුමක් එක් කරන්න")}
              </button>
            </div>
          </div>

          {/* Metric cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm flex flex-col justify-between">
              <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wide">{translate("Total Orders", "මුළු ඇණවුම් සංඛ්‍යාව")}</span>
              <span className="text-2xl font-black text-stone-800 mt-2">{totalOrdersCount}</span>
            </div>
            <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm flex flex-col justify-between">
              <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wide">{translate("In Production", "නිෂ්පාදනයේ පවතී")}</span>
              <span className="text-2xl font-black text-[#B34A1A] mt-2">{inProdCount}</span>
            </div>
            <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm flex flex-col justify-between">
              <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wide">{translate("Ready", "බෙදාහැරීමට සූදානම්")}</span>
              <span className="text-2xl font-black text-green-700 mt-2">{readyCount}</span>
            </div>
            <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm flex flex-col justify-between">
              <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wide">{translate("Pending Quote", "මිල කැඳවීම් අපේක්ෂිත")}</span>
              <span className="text-2xl font-black text-stone-500 mt-2">{pendingQuoteCount}</span>
            </div>
          </div>

          {/* Alert Msg */}
          {alertMsg.text && (
            <div className={`p-4 rounded-lg border text-sm font-semibold ${
              alertMsg.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
            }`}>
              {alertMsg.text}
            </div>
          )}

          {/* Search/Filter Bar */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
            <div className="relative md:col-span-2">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-stone-400">
                <Search size={16} />
              </span>
              <input
                type="text"
                placeholder={translate("Search order number, customer name, or furniture item...", "ඇණවුම් අංකය, පාරිභෝගිකයා හෝ භාණ්ඩයේ නම අනුව සොයන්න...")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg border border-stone-200 pl-9 pr-3 py-2 text-xs bg-stone-50 text-stone-800 focus:outline-none focus:border-stone-400 focus:bg-white transition-all"
              />
            </div>

            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="rounded-lg border border-stone-200 px-3 py-2 text-xs bg-stone-50 text-stone-700 focus:outline-none focus:border-stone-400 focus:bg-white font-semibold transition-all"
            >
              <option value="">{translate("All Production Stages", "සියලුම නිෂ්පාදන මට්ටම්")}</option>
              {STAGES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Custom Orders Spreadsheet Table */}
          <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-stone-50 text-stone-400 font-bold uppercase tracking-wider border-b border-stone-150">
                    <th className="p-3.5">{translate("Order #", "ඇණවුම් අංකය")}</th>
                    <th className="p-3.5">{translate("Customer Name", "පාරිභෝගික නම")}</th>
                    <th className="p-3.5">{translate("Description", "විස්තරය")}</th>
                    <th className="p-3.5">{translate("Assigned Carpenter", "පැවරූ වඩු කාර්මිකයා")}</th>
                    <th className="p-3.5">{translate("Est. Delivery Date", "ඇස්තමේන්තුගත බෙදාහැරීමේ දිනය")}</th>
                    <th className="p-3.5 text-center">{translate("Stage", "තත්ත්වය")}</th>
                    <th className="p-3.5 text-right">{translate("Quote Price", "මිල කැඳවීම")}</th>
                    <th className="p-3.5 text-center">{translate("Actions", "ක්‍රියාමාර්ග")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-medium">
                  {loading ? (
                    <tr>
                      <td colSpan="8" className="p-8 text-center text-stone-400 font-bold">
                        {translate("Loading custom orders...", "ඇණවුම් පූරණය වෙමින් පවතී...")}
                      </td>
                    </tr>
                  ) : orders.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="p-8 text-center text-stone-400 font-bold">
                        {translate("No custom manufacture orders found.", "අභිමත ඇණවුම් කිසිවක් හමු නොවීය.")}
                      </td>
                    </tr>
                  ) : (
                    orders.map((o) => (
                      <tr key={o.id} className="hover:bg-stone-50">
                        <td className="p-3.5 font-bold text-stone-850">{o.order_number}</td>
                        <td className="p-3.5">
                          <div className="font-bold text-stone-800">{o.customer?.name}</div>
                          <div className="text-[10px] text-stone-400 font-semibold">{o.customer?.phone}</div>
                        </td>
                        <td className="p-3.5 text-stone-700">{o.furniture_title}</td>
                        <td className="p-3.5 text-stone-600 font-semibold">{o.assigned_carpenter?.name || '-'}</td>
                        <td className="p-3.5 text-stone-500">
                          {o.order_date ? new Date(new Date(o.order_date).getTime() + (o.est_days || 0) * 24 * 60 * 60 * 1000).toLocaleDateString() : '-'}
                        </td>
                        <td className="p-3.5 text-center">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${getStageStyle(o.stage)}`}>
                            {o.stage}
                          </span>
                        </td>
                        <td className="p-3.5 text-right font-black text-stone-800">
                          {o.quote_price ? `Rs. ${o.quote_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '-'}
                        </td>
                        <td className="p-3.5">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleOpenDetail(o.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-stone-200 text-xs font-bold text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
                            >
                              <Eye size={13} />
                              {translate("Detail", "විස්තර")}
                            </button>

                            <button
                              onClick={() => handleOpenEdit(o)}
                              className="p-1.5 rounded-lg border border-stone-200 text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition-colors cursor-pointer"
                            >
                              <Edit size={14} />
                            </button>

                            {user?.role === 'ADMIN' && (
                              <button
                                onClick={() => handleDeleteOrder(o.id)}
                                className="p-1.5 rounded-lg border border-stone-200 text-stone-500 hover:text-red-650 hover:bg-red-50 transition-colors cursor-pointer"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
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
         2. FORM VIEW (CREATE & EDIT)
         ========================================== */}
      {(view === 'create' || view === 'edit') && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-6 space-y-6 animate-fade-in">
          
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-stone-150">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (view === 'edit') {
                    setView('detail');
                  } else {
                    setView('list');
                  }
                }}
                className="p-1.5 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 cursor-pointer"
              >
                <ArrowLeft size={16} />
              </button>
              <div>
                <h3 className="text-base font-black text-stone-850">
                  {view === 'edit'
                    ? `${translate("Edit Custom Order details / ", "ඇණවුම් සංස්කරණය: ")} ${selectedOrder?.order_number}`
                    : translate("New Custom Order Commission", "නව අභිමත ඇණවුමක් ලියාපදිංචි කිරීම")}
                </h3>
                <p className="text-[10px] text-stone-400 font-semibold">
                  {translate("Create order request, dimensions, timber specs, carpenter logs.", "භාණ්ඩයේ ප්‍රමාණයන්, අමුද්‍රව්‍ය ලැයිස්තුව, මිල ගණන් සහ පැවරූ කාර්මිකයා ඇතුළත් කරන්න.")}
                </p>
              </div>
            </div>
            
            {view === 'create' && (
              <span className="px-3 py-1.5 rounded bg-amber-50 border border-amber-200 text-[10px] uppercase font-bold text-amber-700">
                Drafting order
              </span>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Primary Details Row */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              
              {/* Customer search selection */}
              <div className="relative">
                <label className="block text-xs font-bold text-stone-600">Select Customer *</label>
                <input
                  type="text"
                  required
                  placeholder="Type name or phone number"
                  value={custSearchTerm}
                  onChange={(e) => {
                    setCustSearchTerm(e.target.value);
                    setShowCustDropdown(true);
                  }}
                  onFocus={() => setShowCustDropdown(true)}
                  className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-stone-50 text-stone-850 placeholder-stone-400 focus:outline-none focus:border-[#B34A1A]"
                />

                {showCustDropdown && (
                  <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-lg border border-stone-200 bg-white shadow-lg z-30 divide-y divide-stone-100">
                    {filteredCustomers.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => {
                          setForm({ ...form, customer_id: c.id });
                          setCustSearchTerm(c.name);
                          setShowCustDropdown(false);
                        }}
                        className="p-2.5 text-xs font-semibold hover:bg-stone-50 cursor-pointer flex justify-between items-center"
                      >
                        <span className="text-stone-850">{c.name} ({c.phone})</span>
                        <span className="text-[10px] text-stone-400 font-medium">Balance: Rs. {c.currentBalance.toLocaleString()}</span>
                      </div>
                    ))}
                    {filteredCustomers.length === 0 && (
                      <div className="p-3 text-center text-xs text-stone-400 font-bold">No active customer found.</div>
                    )}
                  </div>
                )}
              </div>

              {/* Order Date */}
              <div>
                <label className="block text-xs font-bold text-stone-600">Commission Date *</label>
                <input
                  type="date"
                  required
                  value={form.order_date}
                  onChange={(e) => setForm({ ...form, order_date: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-stone-50 text-stone-800 focus:outline-none focus:border-[#B34A1A]"
                />
                {form.order_date && form.est_days && (
                  <span className="text-[10px] text-stone-400 font-semibold mt-1 block">
                    Est. Delivery Date: {new Date(new Date(form.order_date).getTime() + (parseFloat(form.est_days) || 0) * 24 * 60 * 60 * 1000).toLocaleDateString()}
                  </span>
                )}
              </div>

              {/* Furniture Title */}
              <div>
                <label className="block text-xs font-bold text-stone-600">Furniture Title/Type *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Teak Dining Table 6-Seater"
                  value={form.furniture_title}
                  onChange={(e) => setForm({ ...form, furniture_title: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-stone-50 text-stone-850 focus:outline-none focus:border-[#B34A1A]"
                />
              </div>
            </div>

            {/* Inner Specifications & Dimension Fields */}
            <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/50 space-y-4">
              <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
                <Layers size={15} className="text-[#B34A1A]" />
                Dimensions & Design Specifications
              </h4>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {/* Dim L */}
                <div>
                  <label className="block text-xs font-bold text-stone-600">Length (cm)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Length in cm"
                    value={form.dim_length_cm}
                    onChange={(e) => setForm({ ...form, dim_length_cm: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-white text-stone-800 focus:outline-none focus:border-[#B34A1A]"
                  />
                </div>
                {/* Dim W */}
                <div>
                  <label className="block text-xs font-bold text-stone-600">Width (cm)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Width in cm"
                    value={form.dim_width_cm}
                    onChange={(e) => setForm({ ...form, dim_width_cm: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-white text-stone-800 focus:outline-none focus:border-[#B34A1A]"
                  />
                </div>
                {/* Dim H */}
                <div>
                  <label className="block text-xs font-bold text-stone-600">Height (cm)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Height in cm"
                    value={form.dim_height_cm}
                    onChange={(e) => setForm({ ...form, dim_height_cm: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-white text-stone-800 focus:outline-none focus:border-[#B34A1A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {/* Timber Type */}
                <div>
                  <label className="block text-xs font-bold text-stone-600">Timber Material</label>
                  <input
                    type="text"
                    placeholder="e.g. Teak, Mahogany, Nadun"
                    value={form.timber_type}
                    onChange={(e) => setForm({ ...form, timber_type: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-white text-stone-800 focus:outline-none focus:border-[#B34A1A]"
                  />
                </div>

                {/* Timber Grade */}
                <div>
                  <label className="block text-xs font-bold text-stone-600">Timber Grade</label>
                  <select
                    value={form.timber_grade}
                    onChange={(e) => setForm({ ...form, timber_grade: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-white text-stone-800 focus:outline-none focus:border-[#B34A1A]"
                  >
                    <option value="Grade A">Grade A (Heartwood, high durability)</option>
                    <option value="Grade B">Grade B (Medium grain, standard)</option>
                    <option value="Grade C">Grade C (Sapwood present, economy)</option>
                  </select>
                </div>

                {/* Finish type */}
                <div>
                  <label className="block text-xs font-bold text-stone-600">Finishing Polish</label>
                  <select
                    value={form.finish}
                    onChange={(e) => setForm({ ...form, finish: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-white text-stone-800 focus:outline-none focus:border-[#B34A1A]"
                  >
                    <option value="Melamine">Melamine Finish</option>
                    <option value="Polyurethane">Polyurethane (PU) Coat</option>
                    <option value="Wax">Wax / Oil Rubbed</option>
                    <option value="Unpolished">Unpolished (Raw/Sanded)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Additional materials */}
                <div>
                  <label className="block text-xs font-bold text-stone-600">Additional Material Notes (cushions, fabrics, hinges)</label>
                  <textarea
                    rows="2"
                    placeholder="Specify accessories, upholstery details..."
                    value={form.additional_materials}
                    onChange={(e) => setForm({ ...form, additional_materials: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-white text-stone-800 focus:outline-none focus:border-[#B34A1A]"
                  ></textarea>
                </div>

                {/* Design File reference */}
                <div>
                  <label className="block text-xs font-bold text-stone-600">Design Blueprint / Reference Sketch</label>
                  <div className="mt-1 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-2 rounded-lg border border-stone-250 bg-white px-3 py-2 text-xs font-bold text-stone-700 hover:bg-stone-50 shadow-sm cursor-pointer"
                    >
                      <Upload size={14} />
                      Choose Image
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/*"
                      onChange={handleImageChange}
                    />
                    
                    {designFilePreview && (
                      <div className="relative flex items-center gap-2 p-1.5 border border-stone-200 rounded-lg bg-white">
                        <img src={designFilePreview} alt="Preview" className="h-9 w-9 object-cover rounded" />
                        <button
                          type="button"
                          onClick={clearImage}
                          className="text-stone-400 hover:text-red-650 cursor-pointer"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Material lines assignment (Job Costing) */}
            <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/50 space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers size={15} className="text-[#B34A1A]" />
                  Material Deductions & Job Costing (Sq Ft)
                </h4>
                <button
                  type="button"
                  onClick={addMaterialRow}
                  className="inline-flex items-center gap-1 rounded border border-[#B34A1A] text-[#B34A1A] px-2.5 py-1 text-xs font-bold hover:bg-[#B34A1A]/5 cursor-pointer"
                >
                  <Plus size={13} />
                  Add Material
                </button>
              </div>

              {form.material_line_items.length === 0 ? (
                <p className="text-xs text-stone-450 italic">No raw materials specified for this build yet. Add items to track automatic stock deductions.</p>
              ) : (
                <div className="space-y-2">
                  {form.material_line_items.map((item, idx) => {
                    const selectedMat = materialsStock.find((m) => m.material_id === item.material_id);
                    const availableStock = selectedMat ? selectedMat.current_stock_sqft : 0;
                    return (
                      <div key={idx} className="grid grid-cols-1 gap-2 sm:grid-cols-4 items-end bg-white p-3 rounded-lg border border-stone-150 shadow-xs">
                        <div>
                          <label className="block text-[10px] font-bold text-stone-400 uppercase">Material Item</label>
                          <select
                            value={item.material_id}
                            onChange={(e) => handleMaterialChange(idx, 'material_id', e.target.value)}
                            className="mt-1 block w-full rounded border border-stone-200 p-1.5 text-xs text-stone-700 focus:outline-none"
                          >
                            {materialsStock.map((m) => (
                              <option key={m.material_id} value={m.material_id}>{m.material_name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-stone-400 uppercase">
                            Required Qty (sq ft) <span className="text-stone-300">| Avail: {availableStock}</span>
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            required
                            value={item.qty}
                            onChange={(e) => handleMaterialChange(idx, 'qty', e.target.value)}
                            className="mt-1 block w-full rounded border border-stone-200 p-1.5 text-xs text-stone-800 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-stone-400 uppercase">Cost Per sq ft (Rs.)</label>
                          <input
                            type="number"
                            step="0.01"
                            required
                            value={item.cost_per_sqft}
                            onChange={(e) => handleMaterialChange(idx, 'cost_per_sqft', e.target.value)}
                            className="mt-1 block w-full rounded border border-stone-200 p-1.5 text-xs text-stone-800 focus:outline-none"
                          />
                        </div>
                        <div className="flex justify-between items-center">
                          <div className="text-right">
                            <span className="text-[10px] font-semibold text-stone-400 uppercase">Subtotal</span>
                            <p className="text-xs font-bold text-stone-800">Rs. {(item.qty * item.cost_per_sqft).toLocaleString()}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeMaterialRow(idx)}
                            className="text-stone-400 hover:text-red-650 cursor-pointer"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  <div className="text-right text-xs font-bold text-stone-700 pr-2 pt-1">
                    Materials Cost Total: <span className="text-stone-900 font-black">Rs. {matCost.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Carpenter Labour costing & assignment */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/50 space-y-4">
                <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Hammer size={15} className="text-[#B34A1A]" />
                  Labour & Carpenter Workload
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-600">Estimated Days</label>
                    <input
                      type="number"
                      placeholder="e.g. 5"
                      value={form.est_days}
                      onChange={(e) => setForm({ ...form, est_days: e.target.value })}
                      className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-white text-stone-850 focus:outline-none focus:border-[#B34A1A]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-600">Daily Carpenter Rate (Rs.)</label>
                    <input
                      type="number"
                      placeholder="e.g. 2500"
                      value={form.daily_rate}
                      onChange={(e) => setForm({ ...form, daily_rate: e.target.value })}
                      className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-white text-stone-850 focus:outline-none focus:border-[#B34A1A]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-600">Assign Carpenter</label>
                  <select
                    value={form.assigned_carpenter_id}
                    onChange={(e) => setForm({ ...form, assigned_carpenter_id: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-white text-stone-700 focus:outline-none focus:border-[#B34A1A]"
                  >
                    <option value="">{translate("-- Unassigned --", "-- පත් නොකරන ලද --")}</option>
                    {carpenters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} (Active Workload: {c.activeWorkload || 0} active orders)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* pricing & costing summaries */}
              <div className="p-4 rounded-xl border border-[#B34A1A]/20 bg-[#B34A1A]/5 space-y-4">
                <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign size={15} className="text-[#B34A1A]" />
                  Quotation Pricing & Profit Calculator
                </h4>

                <div>
                  <label className="block text-xs font-bold text-[#B34A1A]">{translate("Quoted Price to Customer (Rs.) *", "පාරිභෝගිකයාට ලබාදුන් මිල (රු.) *")}</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 75000"
                    value={form.quote_price}
                    onChange={(e) => setForm({ ...form, quote_price: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-[#B34A1A]/30 px-3 py-2.5 text-xs bg-white text-stone-850 font-bold focus:outline-none focus:ring-1 focus:ring-[#B34A1A]"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold mt-2">
                  <div className="p-2 bg-white rounded border border-stone-150">
                    <span className="text-[9px] text-stone-400 uppercase">Est. Cost</span>
                    <p className="text-stone-800 font-extrabold mt-1">Rs. {totalEstimatedCost.toLocaleString()}</p>
                  </div>
                  <div className="p-2 bg-white rounded border border-stone-150">
                    <span className="text-[9px] text-stone-400 uppercase">Quote Price</span>
                    <p className="text-stone-800 font-extrabold mt-1">Rs. {quotePriceVal.toLocaleString()}</p>
                  </div>
                  <div className={`p-2 rounded border ${estimatedProfit >= 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                    <span className="text-[9px] uppercase">Est. Profit</span>
                    <p className="font-extrabold mt-1">Rs. {estimatedProfit.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>

            {view === 'create' && (
              <div>
                <label className="block text-xs font-bold text-stone-600">Initial Custom Order Note (Description, requirements)</label>
                <input
                  type="text"
                  placeholder="e.g. Needs a walnut finish instead of melamine, extra handles included."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-stone-50 text-stone-850 focus:outline-none focus:border-[#B34A1A]"
                />
              </div>
            )}

            {/* Buttons */}
            <div className="flex justify-end gap-2.5 pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={() => {
                  if (view === 'edit') {
                    setView('detail');
                  } else {
                    setView('list');
                  }
                }}
                className="rounded-lg border border-stone-200 px-4 py-2.5 text-xs font-bold text-stone-600 hover:bg-stone-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-lg bg-[#B34A1A] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#9a3f16] shadow-md transition-colors cursor-pointer"
              >
                {isSaving ? 'Saving...' : 'Save Draft Order'}
              </button>
            </div>

          </form>
        </div>
      )}

      {/* ==========================================
         3. ORDER DETAIL VIEW
         ========================================== */}
      {view === 'detail' && selectedOrder && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Top Actions Nav */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setView('list')}
                className="p-1.5 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 cursor-pointer"
              >
                <ArrowLeft size={16} />
              </button>
              <div>
                <span className="text-[10px] uppercase font-bold text-stone-400">Custom Commission Order</span>
                <h3 className="text-lg font-black text-stone-850 flex items-center gap-2">
                  {selectedOrder.order_number}
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${getStageStyle(selectedOrder.stage)}`}>
                    {selectedOrder.stage}
                  </span>
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleOpenEdit(selectedOrder)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2 text-xs font-bold text-stone-700 hover:bg-stone-100 transition-all shadow-sm cursor-pointer"
              >
                <Edit size={14} />
                Modify Details
              </button>
              
              {selectedOrder.stage === 'Delivered' && (
                <button
                  onClick={handleConvertToInvoice}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-xs font-bold text-white hover:bg-green-700 shadow-md transition-all cursor-pointer"
                >
                  <CheckCircle size={14} />
                  Convert to POS Invoice
                </button>
              )}
            </div>
          </div>

          {/* Alert Msg */}
          {alertMsg.text && (
            <div className={`p-4 rounded-lg border text-sm font-semibold ${
              alertMsg.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
            }`}>
              {alertMsg.text}
            </div>
          )}

          {/* 6-Stage Progress Tracker */}
          <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
            <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-4">Production Lifecycle Tracker</h4>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              {STAGES.map((stg, idx) => {
                const isCurrent = selectedOrder.stage === stg;
                const isPast = STAGES.indexOf(selectedOrder.stage) >= idx;
                return (
                  <React.Fragment key={stg}>
                    <button
                      onClick={() => triggerStageChange(stg)}
                      className={`flex-1 text-left p-3 rounded-lg border transition-all text-xs font-bold cursor-pointer ${
                        isCurrent
                          ? 'border-[#B34A1A] bg-[#B34A1A]/5 text-[#B34A1A] shadow-xs'
                          : isPast
                          ? 'border-stone-300 bg-stone-50 text-stone-800'
                          : 'border-stone-150 bg-stone-50/50 text-stone-400 hover:border-stone-250 hover:bg-stone-50'
                      }`}
                    >
                      <span className="text-[10px] text-stone-400 uppercase font-semibold block mb-0.5">Stage {idx + 1}</span>
                      <span className="flex items-center gap-1">
                        {isPast && !isCurrent ? <CheckCircle size={13} className="text-green-650" /> : null}
                        {stg}
                      </span>
                    </button>
                    {idx < STAGES.length - 1 && (
                      <ChevronRight size={16} className="hidden sm:block text-stone-300 shrink-0" />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Main Detail Content & Tabs Split */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            
            {/* Left Hand side info summary cards */}
            <div className="space-y-4 lg:col-span-1">
              {/* Customer summary */}
              <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm space-y-3">
                <span className="text-[10px] uppercase font-bold text-stone-400">Customer contact</span>
                <div>
                  <h4 className="text-sm font-black text-stone-850">{selectedOrder.customer?.name}</h4>
                  <p className="text-xs font-medium text-stone-500 mt-0.5">{selectedOrder.customer?.phone}</p>
                  <p className="text-xs text-stone-400 mt-1">{selectedOrder.customer?.address || 'No Address registered'}</p>
                </div>
                <div className="pt-2 border-t border-stone-100 flex justify-between items-center text-xs">
                  <span className="font-semibold text-stone-500">Ledger balance:</span>
                  <span className={`font-black ${selectedOrder.customer?.currentBalance > 0 ? 'text-red-650' : 'text-stone-700'}`}>
                    Rs. {selectedOrder.customer?.currentBalance?.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Design reference visual snapshot */}
              <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm space-y-3">
                <span className="text-[10px] uppercase font-bold text-stone-400">Design reference</span>
                {selectedOrder.design_reference_file ? (
                  <div className="space-y-2">
                    <img
                      src={getDesignReferenceUrl(selectedOrder.design_reference_file)}
                      alt="Design Reference"
                      className="w-full max-h-56 object-contain rounded-lg border border-stone-150 bg-stone-50"
                    />
                    <a
                      href={getDesignReferenceUrl(selectedOrder.design_reference_file)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-stone-250 py-2 text-xs font-bold text-stone-700 hover:bg-stone-50"
                    >
                      <Eye size={13} />
                      Open Full Image
                    </a>
                  </div>
                ) : (
                  <p className="text-xs text-stone-450 italic">No reference sketch uploaded for this build.</p>
                )}
              </div>
            </div>

            {/* Right Hand Side Details Tabbed Container */}
            <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden lg:col-span-2">
              
              {/* Tabs list */}
              <div className="flex border-b border-stone-200 bg-stone-50">
                <button
                  onClick={() => setActiveTab('specs')}
                  className={`px-5 py-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                    activeTab === 'specs'
                      ? 'border-[#B34A1A] text-[#B34A1A] bg-white'
                      : 'border-transparent text-stone-500 hover:text-stone-800'
                  }`}
                >
                  Specifications
                </button>
                <button
                  onClick={() => setActiveTab('costing')}
                  className={`px-5 py-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                    activeTab === 'costing'
                      ? 'border-[#B34A1A] text-[#B34A1A] bg-white'
                      : 'border-transparent text-stone-500 hover:text-stone-800'
                  }`}
                >
                  Job Costing
                </button>
                <button
                  onClick={() => setActiveTab('carpenter')}
                  className={`px-5 py-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                    activeTab === 'carpenter'
                      ? 'border-[#B34A1A] text-[#B34A1A] bg-white'
                      : 'border-transparent text-stone-500 hover:text-stone-800'
                  }`}
                >
                  Carpenter & Payments
                </button>
                <button
                  onClick={() => setActiveTab('activity')}
                  className={`px-5 py-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                    activeTab === 'activity'
                      ? 'border-[#B34A1A] text-[#B34A1A] bg-white'
                      : 'border-transparent text-stone-500 hover:text-stone-800'
                  }`}
                >
                  Activity Log
                </button>
              </div>

              {/* Tab Content Box */}
              <div className="p-6">
                
                {/* 1. Specs Tab */}
                {activeTab === 'specs' && (
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider">{selectedOrder.furniture_title}</h4>
                    
                    <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-stone-700">
                      <div className="space-y-2">
                        <p><span className="text-stone-400">Timber Material:</span> {selectedOrder.timber_type || '-'}</p>
                        <p><span className="text-stone-400">Timber Grade:</span> {selectedOrder.timber_grade || '-'}</p>
                        <p><span className="text-stone-400">Polishing Finish:</span> {selectedOrder.finish || '-'}</p>
                      </div>
                      <div className="space-y-2">
                        <p><span className="text-stone-400">Dimensions:</span> {selectedOrder.dim_length_cm ? `${selectedOrder.dim_length_cm}W x ${selectedOrder.dim_width_cm}D x ${selectedOrder.dim_height_cm}H cm` : '-'}</p>
                        <p><span className="text-stone-400">Commission Date:</span> {new Date(selectedOrder.order_date).toLocaleDateString()}</p>
                        <p>
                          <span className="text-stone-400">Est. Delivery Date:</span>{' '}
                          {selectedOrder.order_date && selectedOrder.est_days
                            ? new Date(new Date(selectedOrder.order_date).getTime() + (selectedOrder.est_days || 0) * 24 * 60 * 60 * 1000).toLocaleDateString()
                            : '-'}
                        </p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-stone-100">
                      <span className="text-[10px] uppercase font-bold text-stone-400">Upholstery & Accessory notes</span>
                      <p className="text-xs text-stone-700 mt-1 font-semibold whitespace-pre-wrap">{selectedOrder.additional_materials || 'No additional notes provided.'}</p>
                    </div>
                  </div>
                )}

                {/* 2. Job Costing Tab */}
                {activeTab === 'costing' && (
                  <div className="space-y-6">
                    {/* Materials lines list */}
                    <div className="space-y-2.5">
                      <span className="text-[10px] uppercase font-bold text-stone-400">Material Cost Breakdown</span>
                      {selectedOrder.material_line_items?.length === 0 ? (
                        <p className="text-xs text-stone-450 italic">No materials specified.</p>
                      ) : (
                        <div className="border border-stone-150 rounded-lg overflow-hidden">
                          <table className="w-full text-xs text-left border-collapse">
                            <thead>
                              <tr className="bg-stone-50 font-bold border-b border-stone-150 text-stone-500">
                                <th className="p-2.5">Material Planks / Boards</th>
                                <th className="p-2.5 text-center">Required Qty</th>
                                <th className="p-2.5 text-right">Cost per sq ft</th>
                                <th className="p-2.5 text-right">Total Cost</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100 font-semibold text-stone-700">
                              {selectedOrder.material_line_items.map((item, idx) => (
                                <tr key={idx}>
                                  <td className="p-2.5">{item.material_name}</td>
                                  <td className="p-2.5 text-center">{item.qty} sq ft</td>
                                  <td className="p-2.5 text-right">Rs. {item.cost_per_sqft?.toLocaleString()}</td>
                                  <td className="p-2.5 text-right font-bold text-stone-850">Rs. {(item.qty * item.cost_per_sqft)?.toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Costing Summary cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      
                      {/* Labour details */}
                      <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/50 space-y-2">
                        <span className="text-[10px] uppercase font-bold text-stone-400">Estimated Carpenter Wages</span>
                        <div className="text-xs font-semibold space-y-1.5 text-stone-700">
                          <p>Estimated Work Time: {selectedOrder.est_days || 0} days</p>
                          <p>Daily Pay Rate: Rs. {selectedOrder.daily_rate?.toLocaleString() || 0}</p>
                          <p className="text-stone-900 font-bold border-t border-stone-200 pt-1.5">
                            Total Labour Cost: Rs. {((selectedOrder.est_days || 0) * (selectedOrder.daily_rate || 0)).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {/* Pricing overview */}
                      <div className="p-4 rounded-xl border border-[#B34A1A]/20 bg-[#B34A1A]/5 space-y-2.5">
                        <span className="text-[10px] uppercase font-bold text-[#B34A1A]">Financial Summary</span>
                        
                        <div className="text-xs font-semibold space-y-1 text-stone-700">
                          <div className="flex justify-between">
                            <span>Total Cost:</span>
                            <span className="font-extrabold text-stone-850">
                              Rs. {(
                                selectedOrder.material_line_items?.reduce((sum, item) => sum + (item.qty * item.cost_per_sqft), 0) +
                                (selectedOrder.est_days || 0) * (selectedOrder.daily_rate || 0)
                              ).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Quoted Price:</span>
                            <span className="font-extrabold text-[#B34A1A]">Rs. {selectedOrder.quote_price?.toLocaleString() || 0}</span>
                          </div>
                          <div className="flex justify-between border-t border-dashed border-stone-200 pt-1.5 font-bold">
                            <span>Estimated Profit:</span>
                            <span className={
                              (selectedOrder.quote_price || 0) - (
                                selectedOrder.material_line_items?.reduce((sum, item) => sum + (item.qty * item.cost_per_sqft), 0) +
                                (selectedOrder.est_days || 0) * (selectedOrder.daily_rate || 0)
                              ) >= 0 ? 'text-green-700 font-extrabold' : 'text-red-750 font-extrabold'
                            }>
                              Rs. {(
                                (selectedOrder.quote_price || 0) - (
                                  selectedOrder.material_line_items?.reduce((sum, item) => sum + (item.qty * item.cost_per_sqft), 0) +
                                  (selectedOrder.est_days || 0) * (selectedOrder.daily_rate || 0)
                                )
                              ).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                )}

                {/* 3. Carpenter & Payments Tab */}
                {activeTab === 'carpenter' && (
                  <div className="space-y-6">
                    {/* Carpenter Details */}
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-stone-400">Assigned Carpenter Detail</span>
                        <h4 className="text-sm font-black text-stone-850 mt-0.5">{selectedOrder.assigned_carpenter?.name || 'Unassigned / පත්කර නැත'}</h4>
                        {selectedOrder.assigned_carpenter && (
                          <p className="text-xs text-stone-400 font-semibold mt-1">
                            Default Daily Rate: Rs. {selectedOrder.assigned_carpenter.defaultDailyPayment?.toLocaleString()}
                          </p>
                        )}
                      </div>

                      {selectedOrder.assigned_carpenter_id && (
                        <button
                          onClick={() => setPaymentModalOpen(true)}
                          className="inline-flex items-center gap-1 bg-[#B34A1A] text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-[#9a3f16] shadow-sm cursor-pointer"
                        >
                          <Plus size={13} />
                          Log Carpenter Payment
                        </button>
                      )}
                    </div>

                    {/* Labor estimation vs actual paid */}
                    {selectedOrder.assigned_carpenter_id && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="p-3 bg-stone-50 rounded-lg border border-stone-200">
                          <span className="text-[9px] uppercase font-bold text-stone-400">Est. Labour Cost</span>
                          <p className="text-sm font-black text-stone-850 mt-1">
                            Rs. {((selectedOrder.est_days || 0) * (selectedOrder.daily_rate || 0)).toLocaleString()}
                          </p>
                        </div>
                        <div className="p-3 bg-stone-50 rounded-lg border border-stone-200">
                          <span className="text-[9px] uppercase font-bold text-stone-400">Wages Paid (Actual)</span>
                          <p className="text-sm font-black text-green-700 mt-1">
                            Rs. {selectedOrder.actual_labor_payments?.toLocaleString() || 0}
                          </p>
                        </div>
                        <div className="p-3 bg-stone-50 rounded-lg border border-stone-200">
                          <span className="text-[9px] uppercase font-bold text-stone-400">Wages Balance</span>
                          <p className="text-sm font-black text-stone-850 mt-1">
                            Rs. {(
                              ((selectedOrder.est_days || 0) * (selectedOrder.daily_rate || 0)) -
                              (selectedOrder.actual_labor_payments || 0)
                            ).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Carpenter payment lists */}
                    <div className="space-y-2">
                      <span className="text-[10px] uppercase font-bold text-stone-400">Payments Log (linked to {selectedOrder.order_number})</span>
                      {!selectedOrder.carpenter_payments || selectedOrder.carpenter_payments.length === 0 ? (
                        <p className="text-xs text-stone-450 italic">No carpenter payment transactions logged against this order number.</p>
                      ) : (
                        <div className="border border-stone-150 rounded-lg overflow-hidden">
                          <table className="w-full text-xs text-left border-collapse">
                            <thead>
                              <tr className="bg-stone-50 font-bold border-b border-stone-150 text-stone-500">
                                <th className="p-2.5">Date</th>
                                <th className="p-2.5">Transaction Type</th>
                                <th className="p-2.5">Notes</th>
                                <th className="p-2.5 text-right">Amount</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100 font-semibold text-stone-700">
                              {selectedOrder.carpenter_payments.map((p) => (
                                <tr key={p.id}>
                                  <td className="p-2.5">{new Date(p.date).toLocaleDateString()}</td>
                                  <td className="p-2.5">
                                    <span className={`inline-flex rounded px-2 py-0.5 text-[9px] font-bold ${
                                      p.transactionType === 'CREDIT' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                                    }`}>
                                      {p.transactionType}
                                    </span>
                                  </td>
                                  <td className="p-2.5 text-stone-500">{p.notes || '-'}</td>
                                  <td className="p-2.5 text-right font-black text-stone-850">Rs. {p.amount.toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 4. Activity Log Tab */}
                {activeTab === 'activity' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] uppercase font-bold text-stone-400">Commission History Trail</span>
                      <button
                        onClick={() => setNoteModalOpen(true)}
                        className="inline-flex items-center gap-1 border border-stone-250 px-2.5 py-1.5 rounded-lg text-xs font-bold hover:bg-stone-50 cursor-pointer"
                      >
                        <MessageSquare size={13} />
                        Add Manual Note
                      </button>
                    </div>

                    <div className="relative border-l border-stone-200 pl-4 space-y-5 py-2">
                      {selectedOrder.activity_log && Array.isArray(selectedOrder.activity_log) ? (
                        [...selectedOrder.activity_log].reverse().map((log, idx) => (
                          <div key={idx} className="relative text-xs">
                            <span className="absolute -left-[21px] top-1 flex h-2.5 w-2.5 rounded-full bg-[#B34A1A]" />
                            <div className="font-bold text-stone-800">{log.event || log.stage}</div>
                            <span className="text-[10px] text-stone-400 font-semibold block mt-0.5">
                              Logged by {log.user || 'Admin'} | {new Date(log.timestamp).toLocaleString()}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-stone-450 italic">No activity log entries found.</p>
                      )}
                    </div>
                  </div>
                )}

              </div>
            </div>

          </div>
        </div>
      )}

      {/* ==========================================
         STOCK SHORTAGE WARNING MODAL
         ========================================== */}
      {showWarningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 no-print animate-fade-in">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl border border-stone-200 flex flex-col max-h-[90dvh] my-auto">
            <div className="flex items-center gap-2.5 pb-3 border-b border-stone-100 flex-none text-amber-700">
              <AlertTriangle size={24} />
              <h3 className="text-base font-black">Stock Shortage Alert!</h3>
            </div>

            <div className="mt-4 flex-1 overflow-y-auto text-xs font-semibold text-stone-700 space-y-4">
              <p>
                Confirming this order to the Confirmed stage will auto-deduct raw materials from the Materials Stock ledger. 
                However, there is insufficient inventory for the following items:
              </p>

              <div className="border border-amber-200 bg-amber-50/50 rounded-lg overflow-hidden divide-y divide-amber-100">
                {stageWarnings.map((w) => (
                  <div key={w.material_id} className="p-3 flex justify-between items-center">
                    <div>
                      <p className="font-bold text-stone-900">{w.material_name}</p>
                      <span className="text-[10px] text-stone-400">Material ID: {w.material_id.substring(0, 8)}...</span>
                    </div>
                    <div className="text-right">
                      <p className="text-stone-500">Required: <span className="font-bold">{w.required} sq ft</span></p>
                      <p className="text-red-750 font-bold">Available: {w.available} sq ft</p>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-[10px] text-stone-400">
                Would you like to abort and top-up the materials stock first, or bypass this check and force confirmation anyway? 
                (Forcing will result in a negative stock balance in the raw ledger).
              </p>
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-stone-100 mt-4">
              <button
                type="button"
                onClick={() => setShowWarningModal(false)}
                className="rounded-lg border border-stone-250 px-4 py-2.5 text-xs font-bold text-stone-600 hover:bg-stone-50 cursor-pointer"
              >
                Abort & Cancel
              </button>
              <button
                type="button"
                onClick={() => handleStageTransition(pendingStageChange, true)}
                className="rounded-lg bg-[#B34A1A] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#9a3f16] shadow-md cursor-pointer"
              >
                Bypass & Force Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
         STOCK REVERSAL MODAL (WHEN STAGE REVERTS)
         ========================================== */}
      {showReversalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 no-print animate-fade-in">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl border border-stone-200 flex flex-col max-h-[90dvh] my-auto">
            <div className="flex items-center gap-2.5 pb-3 border-b border-stone-100 flex-none text-blue-700">
              <Layers size={24} />
              <h3 className="text-base font-black">Stock Reversal Option</h3>
            </div>

            <div className="mt-4 flex-1 overflow-y-auto text-xs font-semibold text-stone-700 space-y-3">
              <p>
                You are reverting this order from its confirmed/production stage back to a draft stage ("{pendingReversalStage}").
              </p>
              <p>
                Would you like to restore the deducted materials stock back into your raw timber and boards inventory?
              </p>
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-stone-100 mt-4">
              <button
                type="button"
                onClick={() => handleStageTransition(pendingReversalStage, false, false)}
                className="rounded-lg border border-stone-250 px-4 py-2.5 text-xs font-bold text-stone-600 hover:bg-stone-50 cursor-pointer"
              >
                Keep Deducted (No Reversal)
              </button>
              <button
                type="button"
                onClick={() => handleStageTransition(pendingReversalStage, false, true)}
                className="rounded-lg bg-[#B34A1A] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#9a3f16] shadow-md cursor-pointer"
              >
                Yes, Restore Stock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
         LOG CARPENTER PAYMENT MODAL
         ========================================== */}
      {paymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 no-print animate-fade-in">
          <div className="w-full max-w-md rounded-xl bg-white p-5 sm:p-6 shadow-2xl border border-stone-200 flex flex-col max-h-[90dvh] my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 flex-none">
              <h3 className="text-base font-bold text-stone-850 flex items-center gap-1.5">
                <Hammer size={18} className="text-[#B34A1A]" />
                Log Payment for {selectedOrder?.assigned_carpenter?.name}
              </h3>
              <button onClick={() => setPaymentModalOpen(false)} className="text-stone-400 hover:text-stone-800 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-600">Payment Amount (Rs.) *</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 5000"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-white text-stone-800 focus:outline-none focus:border-[#B34A1A]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-600">Payment Date *</label>
                <input
                  type="date"
                  required
                  value={paymentForm.date}
                  onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-white text-stone-800 focus:outline-none focus:border-[#B34A1A]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-600">Notes / Remarks</label>
                <input
                  type="text"
                  placeholder="e.g. Advance paid for dining table"
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-white text-stone-800 focus:outline-none focus:border-[#B34A1A]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setPaymentModalOpen(false)}
                  className="rounded-lg border border-stone-200 px-4 py-2 text-xs font-bold text-stone-600 hover:bg-stone-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#B34A1A] px-5 py-2 text-xs font-bold text-white hover:bg-[#9a3f16] shadow-md cursor-pointer"
                >
                  Submit Payment Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
         ADD MANUAL NOTE MODAL
         ========================================== */}
      {noteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 no-print animate-fade-in">
          <div className="w-full max-w-md rounded-xl bg-white p-5 sm:p-6 shadow-2xl border border-stone-200 flex flex-col max-h-[90dvh] my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 flex-none">
              <h3 className="text-base font-bold text-stone-850 flex items-center gap-1.5">
                <MessageSquare size={18} className="text-[#B34A1A]" />
                Add Manual Note / Requirement
              </h3>
              <button onClick={() => setNoteModalOpen(false)} className="text-stone-400 hover:text-stone-800 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddNote} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-600">Note Content *</label>
                <textarea
                  required
                  rows="3"
                  placeholder="Type notes or additional requirements..."
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-white text-stone-800 focus:outline-none focus:border-[#B34A1A]"
                ></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setNoteModalOpen(false)}
                  className="rounded-lg border border-stone-200 px-4 py-2 text-xs font-bold text-stone-600 hover:bg-stone-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#B34A1A] px-5 py-2 text-xs font-bold text-white hover:bg-[#9a3f16] shadow-md cursor-pointer"
                >
                  Save Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
