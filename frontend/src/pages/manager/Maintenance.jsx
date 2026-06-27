import { useState, useEffect } from 'react';
import api from '../../api/client';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { Wrench, X, AlertTriangle, Zap, CheckCircle, DollarSign, CreditCard } from 'lucide-react';

const STATUS_COLORS = {
  OPEN: 'badge-red',
  DISPATCHED: 'badge-blue',
  IN_PROGRESS: 'badge-amber',
  COMPLETED: 'badge-green',
  CANCELLED: 'badge-gray',
};
const PRIORITY_COLORS = {
  LOW: 'text-slate-400',
  NORMAL: 'text-brand-500',
  HIGH: 'text-amber-500',
  EMERGENCY: 'text-red-600',
};

export default function ManagerMaintenance() {
  const [requests, setRequests] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('');
  const [dispatching, setDispatching] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState('');

  // Completion state
  const [completingId, setCompletingId] = useState(null);
  const [completionCost, setCompletionCost] = useState('');
  const [completionNotes, setCompletionNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Vendor pay state
  const [payingVendor, setPayingVendor] = useState(false);
  const [vendorPayAmount, setVendorPayAmount] = useState('');
  const [vendorPayMethod, setVendorPayMethod] = useState('');
  const [vendorPayNotes, setVendorPayNotes] = useState('');

  useEffect(() => { load(); }, [filter]);
  useEffect(() => { api.get('/vendors').then((r) => setVendors(r.data)).catch(() => {}); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/maintenance' + (filter ? `?status=${filter}` : ''));
      setRequests(res.data);
    } finally {
      setLoading(false);
    }
  }

  async function dispatch() {
    if (!selectedVendor) return toast.error('Select a vendor');
    setDispatching(true);
    try {
      await api.post(`/maintenance/${selected.id}/dispatch`, { vendorId: selectedVendor });
      toast.success('Vendor dispatched! They will receive an email + SMS.');
      setSelected(null);
      load();
    } finally {
      setDispatching(false);
    }
  }

  async function updateStatus(id, status) {
    if (status === 'COMPLETED') {
      setCompletingId(id);
      setCompletionCost('');
      setCompletionNotes('');
      return;
    }
    await api.put(`/maintenance/${id}`, { status });
    toast.success('Status updated');
    setSelected(null);
    load();
  }

  async function confirmComplete() {
    setSaving(true);
    try {
      await api.put(`/maintenance/${completingId}`, {
        status: 'COMPLETED',
        cost: completionCost || undefined,
        managerNotes: completionNotes || undefined,
      });
      toast.success('Marked complete!');
      setCompletingId(null);
      setSelected(null);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function payVendor() {
    if (!selected) return;
    setPayingVendor(true);
    try {
      await api.post(`/maintenance/${selected.id}/pay-vendor`, {
        amount: vendorPayAmount || selected.cost,
        paymentMethod: vendorPayMethod,
        notes: vendorPayNotes,
      });
      toast.success('Vendor marked as paid! They will receive a payment confirmation email.');
      setSelected((prev) => ({ ...prev, vendorPaid: true, vendorPaidAmount: parseFloat(vendorPayAmount || selected.cost) }));
      load();
      setVendorPayAmount(''); setVendorPayMethod(''); setVendorPayNotes('');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed');
    } finally {
      setPayingVendor(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Maintenance Queue</h1>
        <select className="input w-auto" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {['OPEN', 'DISPATCHED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-slate-200 rounded-2xl animate-pulse" />)}</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16 card border-dashed border-2 border-slate-200">
          <CheckCircle className="mx-auto text-emerald-300 mb-3" size={40} />
          <p className="text-slate-500">No maintenance requests {filter ? `with status ${filter}` : ''}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <div key={req.id} className="card p-4 hover:shadow-card-hover cursor-pointer transition-all duration-150" onClick={() => { setSelected(req); setSelectedVendor(''); setVendorPayAmount(''); setVendorPayMethod(''); setVendorPayNotes(''); }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 ${PRIORITY_COLORS[req.priority]}`}>
                    {req.priority === 'EMERGENCY' ? <Zap size={18} /> : req.priority === 'HIGH' ? <AlertTriangle size={18} /> : <Wrench size={18} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm text-slate-900">{req.aiTrade || req.aiCategory || 'General Maintenance'}</p>
                      <span className={STATUS_COLORS[req.status]}>{req.status.replace('_', ' ')}</span>
                      {req.cost && <span className="badge-gray">${req.cost}</span>}
                      {req.vendorPaid && <span className="badge-green">Vendor Paid</span>}
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5 line-clamp-1">{req.description}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {req.unit.property.name} · Unit {req.unit.unitNumber} · {req.tenant.firstName} {req.tenant.lastName} · {format(new Date(req.createdAt), 'MMM d')}
                    </p>
                  </div>
                </div>
                {req.photoUrls?.length > 0 && (
                  <img src={req.photoUrls[0]} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                )}
              </div>
              {req.vendor && <div className="mt-2 pt-2 border-t border-slate-100 text-xs text-brand-600 font-medium">Dispatched: {req.vendor.name}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Completion cost modal */}
      {completingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-bold text-lg">Mark as Complete</h3>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Final Cost <span className="text-gray-400">(optional)</span></label>
              <div className="flex items-center border rounded-xl overflow-hidden">
                <span className="px-3 py-2 text-sm text-gray-400 bg-gray-50 border-r">$</span>
                <input type="number" min="0" step="0.01" placeholder="0.00" className="flex-1 px-3 py-2 text-sm focus:outline-none" value={completionCost} onChange={(e) => setCompletionCost(e.target.value)} autoFocus />
              </div>
              <p className="text-xs text-gray-400 mt-1">This feeds into your P&L and triggers a cost-threshold alert if over your limit.</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Manager Notes <span className="text-gray-400">(optional)</span></label>
              <textarea rows={2} className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="e.g. Replaced toilet flapper, issue resolved" value={completionNotes} onChange={(e) => setCompletionNotes(e.target.value)} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setCompletingId(null)} className="flex-1 py-2 border rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={confirmComplete} disabled={saving} className="flex-1 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold disabled:opacity-60 hover:bg-green-700">
                {saving ? 'Saving...' : 'Confirm Complete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="font-bold text-lg">Maintenance Request</h2>
              <button onClick={() => setSelected(null)} className="p-1 text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-5">
              <div className="flex gap-2 flex-wrap">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[selected.status]}`}>{selected.status}</span>
                <span className={`text-xs px-2 py-1 rounded-full font-medium bg-gray-100 ${PRIORITY_COLORS[selected.priority]}`}>{selected.priority}</span>
                {selected.aiTrade && <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-medium">{selected.aiTrade}</span>}
                {selected.cost && <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-medium flex items-center gap-1"><DollarSign size={10} />${selected.cost} final cost</span>}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-gray-500">Tenant</p><p className="font-medium">{selected.tenant.firstName} {selected.tenant.lastName}</p></div>
                <div><p className="text-xs text-gray-500">Phone</p><p className="font-medium">{selected.tenant.phone || '—'}</p></div>
                <div className="col-span-2"><p className="text-xs text-gray-500">Unit</p><p className="font-medium">{selected.unit.property.name} · {selected.unit.unitNumber} · {selected.unit.property.address}</p></div>
                <div className="col-span-2"><p className="text-xs text-gray-500">Description</p><p className="font-medium">{selected.description}</p></div>
                {selected.managerNotes && <div className="col-span-2"><p className="text-xs text-gray-500">Notes</p><p className="font-medium">{selected.managerNotes}</p></div>}
                {selected.aiSummary && <div className="col-span-2"><p className="text-xs text-gray-500">AI Analysis</p><p className="text-sm text-brand-800 bg-brand-50 p-3 rounded-xl border border-brand-100">{selected.aiSummary}</p></div>}
              </div>

              {selected.photoUrls?.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-2">Photos</p>
                  <div className="flex gap-2 overflow-x-auto">
                    {selected.photoUrls.map((url, i) => <img key={i} src={url} alt="" className="h-32 w-auto rounded-xl object-cover flex-shrink-0" />)}
                  </div>
                </div>
              )}

              {selected.vendor && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm">
                  <p className="font-semibold text-blue-800">Dispatched Vendor</p>
                  <p className="text-blue-700">{selected.vendor.name} · {selected.vendor.phone}</p>
                  {selected.vendor.paymentInfo && <p className="text-xs text-blue-600 mt-1">Payment: {selected.vendor.paymentInfo}</p>}
                </div>
              )}

              {/* Dispatch vendor */}
              {!selected.vendor && selected.status === 'OPEN' && (
                <div>
                  <p className="text-sm font-semibold mb-2">Dispatch Vendor</p>
                  <div className="flex gap-2">
                    <select className="input flex-1" value={selectedVendor} onChange={(e) => setSelectedVendor(e.target.value)}>
                      <option value="">Select vendor</option>
                      {vendors.filter((v) => !selected.aiTrade || v.trade.toLowerCase().includes(selected.aiTrade.toLowerCase().split(' ')[0])).map((v) => (
                        <option key={v.id} value={v.id}>{v.name} ({v.trade}){v.costThreshold ? ` — threshold $${v.costThreshold}` : ''}</option>
                      ))}
                      {vendors.filter((v) => selected.aiTrade && !v.trade.toLowerCase().includes(selected.aiTrade.toLowerCase().split(' ')[0])).length > 0 && (
                        <optgroup label="Other vendors">
                          {vendors.filter((v) => selected.aiTrade && !v.trade.toLowerCase().includes(selected.aiTrade.toLowerCase().split(' ')[0])).map((v) => (
                            <option key={v.id} value={v.id}>{v.name} ({v.trade})</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    <button onClick={dispatch} disabled={dispatching || !selectedVendor} className="btn-primary disabled:opacity-60">
                      {dispatching ? '...' : 'Dispatch'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">Vendor will receive email + SMS instantly. You'll be notified when job is complete.</p>
                </div>
              )}

              {/* Status controls */}
              {selected.status !== 'COMPLETED' && selected.status !== 'CANCELLED' && (
                <div>
                  <p className="text-sm font-semibold mb-2">Update Status</p>
                  <div className="flex gap-2 flex-wrap">
                    {['IN_PROGRESS', 'COMPLETED', 'CANCELLED'].filter((s) => s !== selected.status).map((s) => (
                      <button key={s} onClick={() => updateStatus(selected.id, s)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${STATUS_COLORS[s]}`}>
                        {s === 'COMPLETED' ? '✓ Mark Complete + Enter Cost' : s.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Vendor payment section — show when completed and vendor assigned */}
              {selected.status === 'COMPLETED' && selected.vendor && (
                <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                  {selected.vendorPaid ? (
                    <div className="flex items-center gap-2 text-green-700">
                      <CheckCircle size={18} />
                      <div>
                        <p className="font-semibold text-sm">Vendor Paid</p>
                        <p className="text-xs text-gray-500">${selected.vendorPaidAmount?.toLocaleString()} via {selected.vendorPaymentMethod || 'manual'} — {selected.vendorPaidAt ? format(new Date(selected.vendorPaidAt), 'MMM d, yyyy') : ''}</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm font-semibold flex items-center gap-2"><CreditCard size={16} /> Pay Vendor</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Amount</label>
                          <div className="flex items-center border rounded-xl overflow-hidden">
                            <span className="px-2 py-2 text-xs text-gray-400 bg-gray-50 border-r">$</span>
                            <input type="number" min="0" step="0.01" placeholder={selected.cost || '0.00'} className="flex-1 px-2 py-2 text-sm focus:outline-none" value={vendorPayAmount} onChange={(e) => setVendorPayAmount(e.target.value)} />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Method</label>
                          <input type="text" className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none" placeholder={selected.vendor.paymentInfo || 'Zelle, Check, etc.'} value={vendorPayMethod} onChange={(e) => setVendorPayMethod(e.target.value)} />
                        </div>
                      </div>
                      <input type="text" className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none" placeholder="Notes (optional)" value={vendorPayNotes} onChange={(e) => setVendorPayNotes(e.target.value)} />
                      <button onClick={payVendor} disabled={payingVendor} className="w-full py-2 bg-green-600 text-white rounded-xl text-sm font-semibold disabled:opacity-60 hover:bg-green-700">
                        {payingVendor ? 'Saving...' : `Mark Vendor Paid${vendorPayAmount ? ` — $${vendorPayAmount}` : selected.cost ? ` — $${selected.cost}` : ''}`}
                      </button>
                      <p className="text-xs text-gray-400">Vendor will receive a payment confirmation email.</p>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
