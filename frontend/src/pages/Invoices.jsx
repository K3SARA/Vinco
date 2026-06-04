import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import InvoiceA4Print from '../components/InvoiceA4Print';
import useDebouncedValue from '../hooks/useDebouncedValue';
import { 
  BookOpen, FileText, Search, Printer, Eye, Trash2, ShieldAlert,
  ArrowUpDown, X, Receipt, CheckCircle, Award, Play
} from 'lucide-react';

export default function Invoices() {
  const { user } = useAuth();
  
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState(localStorage.getItem('alight_lang') || 'en');

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebouncedValue(searchTerm);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals state
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [printDetails, setPrintDetails] = useState(null);
  const [printFormat, setPrintFormat] = useState('a4');

  // Payment Form state
  const [payAmt, setPayAmt] = useState('');
  const [payMethod, setPayMethod] = useState('Cash');
  const [payNotes, setPayNotes] = useState('');

  // Success alert state
  const [alertMsg, setAlertMsg] = useState({ type: '', text: '' });

  const translate = (en, si) => (lang === 'en' ? en : si);

  function showAlert(type, text) {
    setAlertMsg({ type, text });
    setTimeout(() => setAlertMsg({ type: '', text: '' }), 5050);
  }

  useEffect(() => {
    const handleLangChange = () => setLang(localStorage.getItem('alight_lang') || 'en');
    window.addEventListener('languageChange', handleLangChange);
    return () => window.removeEventListener('languageChange', handleLangChange);
  }, []);

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const query = `?search=${encodeURIComponent(debouncedSearchTerm)}&startDate=${startDate}&endDate=${endDate}`;
      const res = await api.get(`/invoices${query}`);
      setInvoices(res.data);
    } catch (err) {
      console.error(err);
      showAlert('error', 'Failed to retrieve invoice logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, [debouncedSearchTerm, startDate, endDate]);

  const handleOpenDetails = async (invoice) => {
    try {
      const res = await api.get(`/invoices/${invoice.id}`);
      setSelectedInvoice(res.data);
      
      const printRes = await api.get(`/invoices/${invoice.id}/print`);
      setPrintDetails(printRes.data);

      setInvoiceModalOpen(true);
    } catch (err) {
      showAlert('error', 'Failed to load invoice details.');
    }
  };

  const handleCancelInvoice = async (invoiceId) => {
    if (!window.confirm('WARNING: Cancelling this invoice will permanently reverse all ledger entries, restore product stock quantities, and flag this bill as "CANCELLED". Are you sure? / මෙම බිල්පත අවලංගු කිරීමට අවශ්‍ය බව සහතිකද?')) return;

    try {
      await api.post(`/invoices/${invoiceId}/cancel`);
      showAlert('success', 'Invoice cancelled and database state restored successfully.');
      setInvoiceModalOpen(false);
      loadInvoices();
    } catch (err) {
      showAlert('error', err.response?.data?.error || 'Cancellation transaction failed.');
    }
  };

  const handleOpenPayment = (inv) => {
    setSelectedInvoice(inv);
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
      await api.post(`/invoices/${selectedInvoice.id}/payment`, {
        amount: amt,
        paymentMethod: payMethod,
        notes: payNotes
      });
      showAlert('success', 'Invoice payment logged.');
      setPaymentModalOpen(false);
      loadInvoices();
    } catch (err) {
      showAlert('error', err.response?.data?.error || 'Failed to post payment.');
    }
  };

  const executePrint = (format) => {
    setPrintFormat(format);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  const emptyInvoiceBook =
    !loading &&
    invoices.length === 0 &&
    !searchTerm &&
    !startDate &&
    !endDate &&
    !alertMsg.text &&
    !invoiceModalOpen &&
    !paymentModalOpen;

  if (emptyInvoiceBook) {
    return (
      <div className="book-screen">
        <div className="book-banner orange-solid">
          Let's get started with your first invoice! 🌌
        </div>

        <div className="book-body">
          <section className="tutorial-card">
            <div className="flex items-start gap-5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#fff1cc] text-[#f6aa23]">
                <Award size={30} />
              </div>
              <div>
                <h2 className="text-[28px] font-black leading-none text-[#202020]">Tap to Watch & Learn</h2>
                <p className="mt-3 text-[24px] font-semibold leading-none text-[#657181]">Watch this video & create your first invoice.</p>
              </div>
            </div>
            <div className="video-thumb">
              <img src="/banner.png" alt="Invoice tutorial" />
              <div className="play-button">
                <Play size={38} fill="currentColor" strokeWidth={0} />
              </div>
            </div>
          </section>

          <section className="guide-card">
            <div className="flex items-center gap-5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#cbf3df] text-[#19ad67]">
                <BookOpen size={30} />
              </div>
              <div className="min-w-0">
                <h2 className="text-[28px] font-black leading-none text-[#202020]">Step-by-step guide with images</h2>
                <p className="mt-3 text-[24px] font-semibold leading-none text-[#657181]">Follow screenshots to learn easily</p>
              </div>
            </div>
            <Link to="/reports" className="mx-auto mt-6 flex h-[70px] w-[252px] items-center justify-center gap-6 rounded-[18px] border-2 border-[#ade8c9] bg-white text-[27px] font-bold text-[#19ad67] no-underline">
              Learn Now
              <span className="text-4xl leading-none">›</span>
            </Link>
          </section>

          <div className="empty-copy">
            <div className="empty-cta-area">
              Add your first transaction
              <br />
              by tapping
              <span className="empty-arrow">↓</span>
            </div>
          </div>

          <div className="space-y-5">
            <Link to="/billing" className="primary-book-button">
              Add New Invoice
            </Link>
            <div className="safe-text">
              <CheckCircle size={28} fill="currentColor" strokeWidth={0} />
              100% safe & secure
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-stone-850 flex items-center gap-2">
            <FileText size={22} className="text-wood-650" />
            {translate("Invoices & POS Records History", "බිල්පත් ලේඛන ඉතිහාසය")}
          </h2>
          <p className="text-xs text-stone-400 font-semibold mt-1">
            {translate("Search historical billing statements, print dual-format receipts, audit transactions, and record payments.", "මුද්‍රණය කිරීම්, හිඟ මුදල් පියවීම් සහ බිල්පත් අවලංගු කිරීම් ඇතුළු ගනුදෙනු විගණනය.")}
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

      {/* SEARCH AND FILTERS */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4 bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
        <div className="relative md:col-span-2">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-stone-400">
            <Search size={16} />
          </span>
          <input
            type="text"
            placeholder={translate("Search Invoice number, Customer Name, Phone number...", "බිල්පත් අංකය, පාරිභෝගික නම, දුරකථනය අනුව සොයන්න...")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-stone-200 pl-9 pr-3 py-2 text-xs bg-stone-50 text-stone-800 placeholder-stone-400 focus:outline-none focus:border-wood-500 focus:bg-white transition-all"
          />
        </div>

        <div>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-stone-50 text-stone-700 focus:outline-none focus:border-wood-500"
            title="Start Date"
          />
        </div>

        <div>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-xs bg-stone-50 text-stone-700 focus:outline-none focus:border-wood-500"
            title="End Date"
          />
        </div>
      </div>

      {/* INVOICES TABLE */}
      <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-stone-50 text-stone-400 font-bold uppercase tracking-wider border-b border-stone-150">
                <th className="p-3.5">Invoice No</th>
                <th className="p-3.5">Date</th>
                <th className="p-3.5">Customer Name</th>
                <th className="p-3.5 text-right">Grand Total</th>
                <th className="p-3.5 text-right">Paid Amount</th>
                <th className="p-3.5 text-right">Balance Due</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 font-medium">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-stone-400 font-bold">No invoices found for selected criteria.</td>
                </tr>
              ) : (
                invoices.map((inv) => {
                  const isCancelled = inv.paymentStatus === 'CANCELLED';
                  const isPaid = inv.balanceAmount <= 0;
                  return (
                    <tr key={inv.id} className={`hover:bg-stone-50 ${isCancelled ? 'bg-red-50/10' : ''}`}>
                      <td className="p-3.5 font-bold text-stone-850">{inv.invoiceNumber}</td>
                      <td className="p-3.5 text-stone-400">{new Date(inv.date).toLocaleDateString()}</td>
                      <td className="p-3.5 font-bold text-stone-800">{inv.customer?.name}</td>
                      <td className="p-3.5 text-right font-semibold text-stone-700">Rs. {inv.grandTotal.toLocaleString()}</td>
                      <td className="p-3.5 text-right font-semibold text-green-600">Rs. {inv.paidAmount.toLocaleString()}</td>
                      <td className="p-3.5 text-right font-black">
                        <span className={inv.balanceAmount > 0 && !isCancelled ? 'text-red-650' : 'text-stone-500'}>
                          Rs. {inv.balanceAmount.toLocaleString()}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                          isCancelled 
                            ? 'bg-red-100 text-red-800' 
                            : isPaid 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : 'bg-orange-100 text-orange-850'
                        }`}>
                          {inv.paymentStatus}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleOpenDetails(inv)}
                            className="p-1 rounded bg-stone-50 border border-stone-200 hover:bg-stone-100 text-stone-600 transition-colors flex items-center gap-1 text-[10px] px-2 font-bold"
                          >
                            <Eye size={13} />
                            {translate("View", "විස්තර")}
                          </button>

                          {inv.balanceAmount > 0 && !isCancelled && (
                            <button
                              onClick={() => handleOpenPayment(inv)}
                              className="p-1 rounded bg-wood-50 border border-wood-200 hover:bg-wood-600 hover:text-white text-wood-650 transition-all flex items-center gap-1 text-[10px] px-2 font-bold"
                            >
                              <Receipt size={13} />
                              {translate("Pay", "ගෙවීම්")}
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

      {/* DUAL MEDIA PRINT CONTAINER */}
      <div id="print-section" className={`hidden ${printFormat === 'thermal' ? 'print-thermal' : 'print-a4'}`}>
        {printDetails && (
          printFormat === 'a4' ? (
            /* A4 INVOICE LAYOUT */
            <>
            <InvoiceA4Print printDetails={printDetails} />
            <div className="hidden p-8 bg-white text-stone-900 font-sans text-xs">
              {/* Branding Letterhead Header Banner */}
              <div className="text-center border-b-2 border-stone-400 pb-3">
                <img src="/invoice_header.png" alt="Alight Furniture Banner" className="w-full max-h-24 object-contain mx-auto mb-2" />
                <h2 className="font-extrabold text-sm text-stone-800 leading-tight">
                  {printDetails.business?.shopName || 'Alight Furniture & Timber (Pvt) Ltd'}
                </h2>
                <p className="text-[10px] text-stone-700 font-bold tracking-wide mt-0.5">
                  {printDetails.business?.address || '360/1 Kolonnawa Road, Gothatuwa'} &nbsp;|&nbsp; 
                  {printDetails.business?.phone1 || '0757553555'}{printDetails.business?.phone2 ? ` / ${printDetails.business?.phone2}` : ' / 0777307292'} &nbsp;|&nbsp; 
                  Reg No: {printDetails.business?.taxNumber || 'PV00321054'}
                </p>
              </div>

              {/* TAX INVOICE Header Bar */}
              <div className="flex justify-between items-center bg-[#3b8fa6] text-white px-4 py-2.5 rounded-md font-bold mt-4 shadow-sm">
                <span className="text-sm font-extrabold tracking-wide uppercase">TAX INVOICE</span>
                <span className="text-sm font-extrabold">{printDetails.invoice?.invoiceNumber}</span>
              </div>
              <p className="text-[9px] text-stone-400 text-center font-bold mt-1.5 mb-4">
                Furniture & Timber Sales Invoice
              </p>

              {/* Customer / Invoice Info row */}
              <div className="grid grid-cols-2 gap-6">
                {/* Bill To */}
                <div className="border border-stone-200 rounded-lg p-4 bg-stone-50/20">
                  <h4 className="font-extrabold text-[#3b8fa6] uppercase tracking-wider mb-2.5 text-[10px]">
                    Bill To / <span className="font-bold">පාරිභෝගිකයා</span>
                  </h4>
                  <p className="font-bold text-sm text-stone-900 mb-1">{printDetails.invoice?.customer?.name}</p>
                  <p className="text-stone-750 font-semibold mb-0.5">{printDetails.invoice?.customer?.address}</p>
                  <p className="text-stone-750 font-semibold">{translate("Phone: ", "දුරකථන: ")} {printDetails.invoice?.customer?.phone}</p>
                </div>

                {/* Invoice Details */}
                <div className="border border-stone-200 rounded-lg p-4 bg-stone-50/20">
                  <h4 className="font-extrabold text-[#3b8fa6] uppercase tracking-wider mb-2.5 text-[10px]">
                    Invoice Details / <span className="font-bold">තොරතුරු</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-y-1.5 text-[11px] font-semibold text-stone-700">
                    <span className="text-stone-400 font-bold">Invoice No</span>
                    <span className="font-bold text-stone-900 text-right">{printDetails.invoice?.invoiceNumber}</span>
                    
                    <span className="text-stone-400 font-bold">Date</span>
                    <span className="font-bold text-stone-900 text-right">
                      {new Date(printDetails.invoice?.date).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </span>
                    
                    <span className="text-stone-400 font-bold">Salesperson</span>
                    <span className="font-bold text-stone-900 text-right">{printDetails.invoice?.salesperson || 'System Admin'}</span>
                    
                    <span className="text-stone-400 font-bold">Status</span>
                    <span className={`font-bold text-right ${
                      printDetails.invoice?.paymentStatus === 'PAID' 
                        ? 'text-emerald-700 font-extrabold' 
                        : printDetails.invoice?.paymentStatus === 'PARTIAL' 
                          ? 'text-red-600 font-extrabold' 
                          : printDetails.invoice?.paymentStatus === 'CREDIT' 
                            ? 'text-red-750 font-extrabold' 
                            : 'text-stone-700 font-extrabold'
                    }`}>
                      {printDetails.invoice?.paymentStatus === 'PAID' 
                        ? 'Fully Paid' 
                        : printDetails.invoice?.paymentStatus === 'PARTIAL' 
                          ? 'Partially Paid' 
                          : printDetails.invoice?.paymentStatus === 'CREDIT' 
                            ? 'Credit Sale' 
                            : printDetails.invoice?.paymentStatus === 'CANCELLED' 
                              ? 'Cancelled' 
                              : printDetails.invoice?.paymentStatus}
                    </span>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full text-left border-collapse mt-6 border border-stone-300">
                <thead>
                  <tr className="bg-[#3b8fa6] border-b border-stone-300 text-white font-extrabold uppercase tracking-wider text-[9px]">
                    <th className="p-2 border-r border-[#348096] w-24">SKU / CODE</th>
                    <th className="p-2 border-r border-[#348096]">PRODUCT DESCRIPTION</th>
                    <th className="p-2 text-right border-r border-[#348096] w-28">UNIT PRICE</th>
                    <th className="p-2 text-center border-r border-[#348096] w-12">QTY</th>
                    <th className="p-2 text-right border-r border-[#348096] w-24">DISCOUNT</th>
                    <th className="p-2 text-right w-28">LINE TOTAL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-250 font-semibold text-stone-800 text-[11px]">
                  {printDetails.invoice?.items?.map((item) => (
                    <tr key={item.id} className="border-b border-stone-200">
                      <td className="p-2 border-r border-stone-200 font-bold text-stone-600">{item.productCode}</td>
                      <td className="p-2 border-r border-stone-200">
                        <div className="font-bold text-stone-900">{item.productName}</div>
                        {item.warrantyPeriod && item.warrantyPeriod !== 'No Warranty' && (
                          <div className="text-[9px] text-stone-500 font-normal mt-0.5">Warranty: {item.warrantyPeriod}</div>
                        )}
                      </td>
                      <td className="p-2 text-right border-r border-stone-200">Rs. {item.unitPrice.toLocaleString()}</td>
                      <td className="p-2 text-center border-r border-stone-200 font-black">{item.quantity}</td>
                      <td className="p-2 text-right border-r border-stone-200 text-green-700 font-bold">
                        {item.discount > 0 ? `- Rs. ${item.discount.toLocaleString()}` : 'Rs. 0'}
                      </td>
                      <td className="p-2 text-right font-black text-stone-900">Rs. {item.lineTotal.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[9px] text-stone-400 text-center italic mt-2">
                Item warranty and delivery details can be referenced using the original invoice number above.
              </p>

              {/* Calculations Block */}
              <div className="grid grid-cols-2 gap-6 mt-6">
                {/* Left Card: Payment Summary */}
                <div className="border border-stone-200 rounded-lg p-4 bg-stone-50/20 self-start">
                  <h4 className="font-extrabold text-[#3b8fa6] uppercase tracking-wider mb-2.5 text-[10px]">Payment Summary</h4>
                  <p className="font-bold text-stone-900 mb-1 text-sm">
                    {printDetails.invoice?.paymentMethod} received: Rs. {printDetails.invoice?.paidAmount.toLocaleString()}
                  </p>
                  {printDetails.invoice?.balanceAmount > 0 ? (
                    <>
                      <p className="font-bold text-red-600 mb-2.5 text-sm">
                        Outstanding balance: Rs. {printDetails.invoice?.balanceAmount.toLocaleString()}
                      </p>
                      <p className="text-[9px] text-stone-500 font-normal leading-relaxed">
                        Settle the remaining balance according to the agreed payment terms.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-bold text-emerald-700 mb-2.5 text-sm">
                        Outstanding balance: Rs. 0
                      </p>
                      <p className="text-[9px] text-stone-500 font-normal leading-relaxed">
                        This invoice is fully settled. Thank you for your business!
                      </p>
                    </>
                  )}

                  {/* Installments (if any) */}
                  {printDetails.invoice?.installments?.length > 0 && (
                    <div className="border-t border-stone-200 mt-3 pt-3">
                      <h5 className="font-extrabold text-[#3b8fa6] uppercase tracking-wider mb-1.5 text-[9px]">Installment Plan</h5>
                      <div className="divide-y divide-stone-200 text-[10px] text-stone-700 font-bold">
                        {printDetails.invoice.installments.map((inst, idx) => (
                          <div key={inst.id} className="py-1 flex justify-between">
                            <span>Installment {idx + 1} ({new Date(inst.dueDate).toLocaleDateString()})</span>
                            <span>Rs. {inst.installmentAmount.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right totals table */}
                <div className="text-right space-y-1.5 text-stone-800 font-bold pr-2 self-start">
                  <div className="flex justify-between text-[11px] text-stone-500 font-bold">
                    <span>Subtotal</span>
                    <span>Rs. {printDetails.invoice?.subtotal.toLocaleString()}</span>
                  </div>
                  {printDetails.invoice?.discount > 0 && (
                    <div className="flex justify-between text-green-700 text-[11px] font-bold">
                      <span>Discount</span>
                      <span>- Rs. {printDetails.invoice?.discount.toLocaleString()}</span>
                    </div>
                  )}
                  {printDetails.invoice?.deliveryCharge > 0 && (
                    <div className="flex justify-between text-[11px] text-stone-500 font-bold">
                      <span>Delivery Charge</span>
                      <span>Rs. {printDetails.invoice?.deliveryCharge.toLocaleString()}</span>
                    </div>
                  )}
                  {printDetails.invoice?.installationCharge > 0 && (
                    <div className="flex justify-between text-[11px] text-stone-500 font-bold">
                      <span>Installation Charge</span>
                      <span>Rs. {printDetails.invoice?.installationCharge.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t-2 border-stone-400 pt-1.5 text-sm font-black text-stone-950">
                    <span>Grand Total</span>
                    <span>Rs. {printDetails.invoice?.grandTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-stone-700 text-[11px] font-bold">
                    <span>Amount Paid ({printDetails.invoice?.paymentMethod})</span>
                    <span>Rs. {printDetails.invoice?.paidAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-t border-dashed border-stone-400 pt-1 text-xs font-black text-red-650">
                    <span>Balance Due</span>
                    <span>Rs. {printDetails.invoice?.balanceAmount.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* TERMS & WARRANTY Box */}
              <div className="mt-8 border border-stone-250 rounded-lg p-4 bg-stone-50/20">
                <h4 className="font-extrabold text-[#3b8fa6] uppercase tracking-wider mb-1.5 text-[10px]">Terms & Warranty</h4>
                <p className="text-[9.5px] text-stone-500 font-medium leading-relaxed">
                  Warranties cover manufacturing faults only. Physical damage is not covered under warranty terms. Goods once sold are not refundable. Warranty is valid only with the original invoice.
                </p>
              </div>

              {/* Signatures */}
              <div className="flex justify-between items-end mt-16 px-4 text-[9px] font-bold text-stone-500">
                <div className="w-48 border-t border-stone-400 pt-1.5 text-center">
                  Authorized Signature
                </div>
                <div className="w-48 border-t border-stone-400 pt-1.5 text-center">
                  Customer Signature
                </div>
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

      {/* ==========================================
         INVOICE DETAIL MODAL
         ========================================== */}
      {invoiceModalOpen && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-3xl rounded-xl bg-white p-6 shadow-2xl border border-stone-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 animate-fade-in">
              <div>
                <h3 className="text-base font-bold text-stone-850 flex items-center gap-1.5">
                  <FileText size={18} className="text-wood-650" />
                  Invoice Details: {selectedInvoice.invoiceNumber}
                </h3>
                <span className="text-[10px] text-stone-400 font-semibold">Logged by Salesperson: {selectedInvoice.salesperson}</span>
              </div>
              <button onClick={() => setInvoiceModalOpen(false)} className="text-stone-400 hover:text-stone-800">
                <X size={20} />
              </button>
            </div>

            {/* Print Selection Layout Trigger */}
            <div className="mt-4 p-4 rounded-lg bg-stone-50 border border-stone-200 flex justify-between items-center gap-4">
              <span className="text-xs text-stone-500 font-bold uppercase tracking-wider">Print / මුද්‍රණය කිරීම්:</span>
              <div className="flex gap-2">
                <button
                  onClick={() => executePrint('a4')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-stone-800 transition-colors shadow-sm"
                >
                  <Printer size={13} /> A4 Invoice
                </button>
                <button
                  onClick={() => executePrint('thermal')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-wood-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-wood-750 transition-colors shadow-sm"
                >
                  <Printer size={13} /> 80mm POS Slip
                </button>
              </div>
            </div>

            {/* Meta fields */}
            <div className="grid grid-cols-2 gap-4 mt-4 text-xs font-semibold text-stone-600 border-b border-stone-100 pb-4">
              <div>
                <p className="text-stone-400 uppercase text-[10px] mb-0.5">Bill To</p>
                <p className="text-stone-950 font-bold">{selectedInvoice.customer?.name}</p>
                <p>{selectedInvoice.customer?.phone} | {selectedInvoice.customer?.address}</p>
              </div>
              <div className="text-right">
                <p className="text-stone-400 uppercase text-[10px] mb-0.5">Receipt Info</p>
                <p>{translate("Date: ", "දිනය: ")} {new Date(selectedInvoice.date).toLocaleString()}</p>
                <p>{translate("Status: ", "තත්ත්වය: ")} <span className="font-bold text-wood-700">{selectedInvoice.paymentStatus}</span></p>
              </div>
            </div>

            {/* Cart Table list */}
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
                  {selectedInvoice.items?.map((item) => (
                    <tr key={item.id}>
                      <td className="p-3 font-bold">{item.productCode}</td>
                      <td className="p-3">
                        <p>{item.productName}</p>
                        <p className="text-[9px] text-stone-400 font-medium">Warranty: {item.warrantyPeriod}</p>
                      </td>
                      <td className="p-3 text-right">Rs. {item.unitPrice.toLocaleString()}</td>
                      <td className="p-3 text-center">{item.quantity}</td>
                      <td className="p-3 text-right text-green-700">- Rs. {item.discount.toLocaleString()}</td>
                      <td className="p-3 text-right font-black text-stone-900">Rs. {item.lineTotal.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Financial Details summary block */}
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div>
                {/* Installment list if any */}
                {selectedInvoice.installments?.length > 0 && (
                  <div className="border border-stone-150 rounded-lg p-3 bg-stone-50">
                    <h4 className="font-bold text-[10px] uppercase text-stone-450 mb-1.5 tracking-wider">Installments schedule</h4>
                    <div className="divide-y divide-stone-100 text-[10px]">
                      {selectedInvoice.installments.map((inst, idx) => (
                        <div key={inst.id} className="py-1 flex justify-between font-semibold">
                          <span className={inst.status === 'Paid' ? 'text-green-750' : 'text-stone-500'}>
                            Month {idx + 1} ({new Date(inst.dueDate).toLocaleDateString()}) - {inst.status}
                          </span>
                          <span className="font-black text-stone-850">Rs. {inst.installmentAmount.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="text-right space-y-1.5 text-xs font-semibold text-stone-600 pl-4 pr-1">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>Rs. {selectedInvoice.subtotal.toLocaleString()}</span>
                </div>
                {selectedInvoice.discount > 0 && (
                  <div className="flex justify-between text-green-700">
                    <span>Discount:</span>
                    <span>- Rs. {selectedInvoice.discount.toLocaleString()}</span>
                  </div>
                )}
                {selectedInvoice.deliveryCharge > 0 && (
                  <div className="flex justify-between">
                    <span>Delivery Charge:</span>
                    <span>Rs. {selectedInvoice.deliveryCharge.toLocaleString()}</span>
                  </div>
                )}
                {selectedInvoice.installationCharge > 0 && (
                  <div className="flex justify-between">
                    <span>Installation Charge:</span>
                    <span>Rs. {selectedInvoice.installationCharge.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between border-t-2 border-stone-200 pt-1.5 text-sm font-black text-stone-900">
                  <span>Grand Total:</span>
                  <span>Rs. {selectedInvoice.grandTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-green-700">
                  <span>Amount Paid:</span>
                  <span>Rs. {selectedInvoice.paidAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-t border-dashed border-stone-300 pt-1 text-xs font-black text-red-750">
                  <span>Outstanding Due:</span>
                  <span>Rs. {selectedInvoice.balanceAmount.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Cancel Button (Admin only) */}
            {user?.role === 'ADMIN' && selectedInvoice.paymentStatus !== 'CANCELLED' && (
              <div className="mt-6 p-4 rounded-lg bg-red-50 border border-red-200 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <ShieldAlert size={20} className="text-red-650" />
                  <div className="text-[10px] text-red-700 font-medium">
                    <p className="font-bold">Administrative Controls / විගණන පාලනයන්</p>
                    <p>Cancelling this invoice will trigger an atomic reversal. Stocks will be replenished.</p>
                  </div>
                </div>
                <button
                  onClick={() => handleCancelInvoice(selectedInvoice.id)}
                  className="rounded-lg bg-red-650 hover:bg-red-800 px-4 py-2 text-xs font-bold text-white shadow-md transition-colors"
                >
                  Cancel Invoice / අවලංගු කරන්න
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==========================================
         INVOICE PAYMENT MODAL
         ========================================== */}
      {paymentModalOpen && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl border border-stone-200 animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h3 className="text-base font-bold text-stone-850 flex items-center gap-1.5">
                <Receipt size={18} className="text-wood-650" />
                Invoice Installment Payment / හිඟ මුදල් පියවීම
              </h3>
              <button onClick={() => setPaymentModalOpen(false)} className="text-stone-400 hover:text-stone-800">
                <X size={20} />
              </button>
            </div>

            <div className="mt-3 p-3.5 rounded-lg bg-stone-50 border border-stone-150 text-xs font-bold text-stone-600 space-y-1">
              <div className="flex justify-between">
                <span>Invoice:</span>
                <span className="text-stone-900">{selectedInvoice.invoiceNumber}</span>
              </div>
              <div className="flex justify-between text-red-750">
                <span>Outstanding Balance:</span>
                <span>Rs. {selectedInvoice.balanceAmount.toLocaleString()}</span>
              </div>
            </div>

            <form onSubmit={handlePostPayment} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-600">Payment Amount / පියවන මුදල (Rs.) *</label>
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
                <label className="block text-xs font-bold text-stone-600">Payment Method / ගෙවීම් ක්‍රමය *</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 bg-stone-50 text-stone-850 font-bold"
                >
                  <option value="Cash">Cash (මුදල්)</option>
                  <option value="Card">Card (කාඩ්පත්)</option>
                  <option value="Bank Transfer">Bank Transfer (බැංකු ප්‍රේෂණ)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-600">Payment Notes / සටහන්</label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-1.5 bg-stone-50 text-stone-800"
                  placeholder="e.g. Paid 3rd installment"
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

    </div>
  );
}
