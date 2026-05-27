import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Truck, Search, Eye, Edit2, CheckCircle, X, ShieldAlert } from 'lucide-react';

export default function Deliveries() {
  const { user } = useAuth();
  
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState(localStorage.getItem('alight_lang') || 'en');

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals state
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState(null);

  // Form states for status update
  const [newStatus, setNewStatus] = useState('Pending');
  const [driverNotes, setDriverNotes] = useState('');

  // Alert Msg
  const [alertMsg, setAlertMsg] = useState({ type: '', text: '' });

  const translate = (en, si) => (lang === 'en' ? en : si);

  useEffect(() => {
    const handleLangChange = () => setLang(localStorage.getItem('alight_lang') || 'en');
    window.addEventListener('languageChange', handleLangChange);
    return () => window.removeEventListener('languageChange', handleLangChange);
  }, []);

  const loadDeliveries = async () => {
    setLoading(true);
    try {
      const query = `?search=${searchTerm}&deliveryStatus=${statusFilter}`;
      const res = await api.get(`/deliveries${query}`);
      setDeliveries(res.data);
    } catch (err) {
      console.error(err);
      showAlert('error', 'Failed to retrieve delivery records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeliveries();
  }, [searchTerm, statusFilter]);

  const showAlert = (type, text) => {
    setAlertMsg({ type, text });
    setTimeout(() => setAlertMsg({ type: '', text: '' }), 5000);
  };

  const handleOpenStatusModal = (deliv) => {
    setSelectedDelivery(deliv);
    setNewStatus(deliv.deliveryStatus);
    setDriverNotes(deliv.notes || '');
    setStatusModalOpen(true);
  };

  const handleUpdateStatusSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/deliveries/${selectedDelivery.id}/status`, {
        deliveryStatus: newStatus,
        notes: driverNotes
      });
      showAlert('success', 'Delivery status updated successfully.');
      setStatusModalOpen(false);
      loadDeliveries();
    } catch (err) {
      showAlert('error', err.response?.data?.error || 'Failed to update status.');
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-stone-850 flex items-center gap-2">
            <Truck size={22} className="text-wood-650" />
            {translate("Delivery Scheduling & Dispatch Tracking", "බෙදාහැරීම් සොයාබැලීම")}
          </h2>
          <p className="text-xs text-stone-400 font-semibold mt-1">
            {translate("Track customer delivery dates, manage transit logs, assign transport vehicles, and update driver notes.", "ඇණවුම් ප්‍රවාහනය කිරීම් පාලනය, රියදුරු සටහන් සහ ප්‍රවාහන තත්ත්වය යාවත්කාලීන කිරීම.")}
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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
        <div className="relative md:col-span-2">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-stone-400">
            <Search size={16} />
          </span>
          <input
            type="text"
            placeholder={translate("Search customer name, vehicle number, driver...", "පාරිභෝගිකයා, වාහන අංකය, රියදුරු නම අනුව සොයන්න...")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-stone-200 pl-9 pr-3 py-2 text-xs bg-stone-50 text-stone-850"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-stone-200 px-3 py-2 text-xs bg-stone-50 text-stone-700 font-semibold"
        >
          <option value="">{translate("All Dispatches Status", "සියලුම තත්ත්වයන්")}</option>
          <option value="Pending">Pending (ප්‍රමාදිත)</option>
          <option value="Scheduled">Scheduled</option>
          <option value="Out For Delivery">Out For Delivery</option>
          <option value="Delivered">Delivered (ලැබී ඇත)</option>
          <option value="Failed">Failed (නොලැබුණි)</option>
        </select>
      </div>

      {/* TABLE */}
      <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-stone-50 text-stone-400 font-bold uppercase border-b border-stone-150">
                <th className="p-3.5">Invoice / Order No</th>
                <th className="p-3.5">Delivery Date</th>
                <th className="p-3.5">Customer Name</th>
                <th className="p-3.5">Shipping Address</th>
                <th className="p-3.5">Driver & Vehicle</th>
                <th className="p-3.5">Driver Notes</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-center">Update</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 font-medium text-stone-700">
              {deliveries.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-stone-400 font-bold">No deliveries found.</td>
                </tr>
              ) : (
                deliveries.map((d) => {
                  const statusColors = {
                    Pending: 'bg-amber-100 text-amber-850',
                    Scheduled: 'bg-blue-100 text-blue-800',
                    'Out For Delivery': 'bg-blue-100 text-blue-800',
                    Delivered: 'bg-emerald-100 text-emerald-800',
                    Failed: 'bg-red-100 text-red-800'
                  };
                  return (
                    <tr key={d.id} className="hover:bg-stone-50">
                      <td className="p-3.5 font-bold text-stone-850">{d.invoice?.invoiceNumber || d.order?.orderNumber || 'N/A'}</td>
                      <td className="p-3.5 font-bold text-stone-900">{new Date(d.deliveryDate).toLocaleDateString()}</td>
                      <td className="p-3.5 font-bold text-stone-850">{d.customerName}</td>
                      <td className="p-3.5 text-stone-500 max-w-xs truncate">{d.address}</td>
                      <td className="p-3.5 text-stone-600">
                        <p className="font-bold">{d.driverName || 'Unassigned'}</p>
                        <p className="text-[10px] text-stone-450">{d.vehicleNumber || 'No vehicle'}</p>
                      </td>
                      <td className="p-3.5 text-stone-550 italic max-w-xs truncate">{d.notes || '-'}</td>
                      <td className="p-3.5">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${statusColors[d.deliveryStatus] || 'bg-stone-100 text-stone-800'}`}>
                          {d.deliveryStatus}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <div className="flex justify-center">
                          <button
                            onClick={() => handleOpenStatusModal(d)}
                            className="p-1 rounded border border-stone-250 hover:bg-stone-100 text-stone-600 transition-colors flex items-center gap-1 text-[10px] px-2 font-bold"
                          >
                            <Edit2 size={12} />
                            Status
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
         STATUS UPDATE MODAL
         ========================================== */}
      {statusModalOpen && selectedDelivery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl border border-stone-200 animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h3 className="text-base font-bold text-stone-850 flex items-center gap-1.5">
                <Truck size={18} className="text-wood-650" />
                Update Dispatch Status
              </h3>
              <button onClick={() => setStatusModalOpen(false)} className="text-stone-400 hover:text-stone-800">
                <X size={20} />
              </button>
            </div>

            <div className="mt-3 p-3 bg-stone-50 border border-stone-150 rounded text-xs font-semibold text-stone-600 space-y-1">
              <p>Customer: <span className="font-bold text-stone-850">{selectedDelivery.customerName}</span></p>
              <p>Address: <span className="text-stone-700">{selectedDelivery.address}</span></p>
              <p>Driver: <span className="text-stone-700">{selectedDelivery.driverName} ({selectedDelivery.vehicleNumber})</span></p>
            </div>

            <form onSubmit={handleUpdateStatusSubmit} className="mt-4 space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-stone-500">Dispatch Status *</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 bg-stone-50 text-stone-850 font-bold"
                >
                  <option value="Pending">Pending (ප්‍රමාදිත)</option>
                  <option value="Scheduled">Scheduled</option>
                  <option value="Out For Delivery">Out For Delivery</option>
                  <option value="Delivered">Delivered (ලැබී ඇත)</option>
                  <option value="Failed">Failed (නොලැබුණි)</option>
                </select>
              </div>

              <div>
                <label className="block text-stone-500">Driver Log / Staff Notes</label>
                <textarea
                  rows="3"
                  value={driverNotes}
                  onChange={(e) => setDriverNotes(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 bg-stone-50 text-stone-800"
                  placeholder="e.g. Delivered to customer. Cash collection paid. / Address locked door..."
                ></textarea>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setStatusModalOpen(false)}
                  className="rounded-lg border border-stone-200 px-4 py-2.5 text-xs font-bold text-stone-600 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-wood-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-wood-750 shadow-md"
                >
                  Save Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
