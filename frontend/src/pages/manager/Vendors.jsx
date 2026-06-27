import { useState, useEffect } from 'react';
import api from '../../api/client';
import toast from 'react-hot-toast';
import { Users, Plus, Pencil, Trash2, X, Zap, Star, Settings, DollarSign } from 'lucide-react';

const TRADES = ['Plumbing', 'Electrical', 'HVAC', 'Appliance Repair', 'Carpentry', 'Painting', 'Roofing', 'General Maintenance', 'Pest Control', 'Locksmith', 'Flooring'];

export default function ManagerVendors() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | 'new' | vendor object
  const [form, setForm] = useState({ name: '', trade: '', phone: '', email: '', address: '', isPreferred: true, autoDispatch: false, rating: '', costThreshold: '', paymentInfo: '' });

  // Payment settings
  const [settings, setSettings] = useState({ venmoHandle: '', zelleInfo: '', vendorCostThreshold: 500 });
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    load();
    api.get('/payments/manager-settings').then((r) => setSettings(r.data)).catch(() => {});
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/vendors');
      setVendors(res.data);
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings(e) {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await api.patch('/payments/manager-settings', {
        venmoHandle: settings.venmoHandle,
        zelleInfo: settings.zelleInfo,
        vendorCostThreshold: settings.vendorCostThreshold,
      });
      toast.success('Payment settings saved!');
    } catch { toast.error('Failed to save'); } finally { setSavingSettings(false); }
  }

  function openNew() {
    setForm({ name: '', trade: '', phone: '', email: '', address: '', isPreferred: true, autoDispatch: false, rating: '', costThreshold: '', paymentInfo: '' });
    setEditing('new');
  }

  function openEdit(v) {
    setForm({ name: v.name, trade: v.trade, phone: v.phone, email: v.email || '', address: v.address || '', isPreferred: v.isPreferred, autoDispatch: v.autoDispatch, rating: v.rating || '', costThreshold: v.costThreshold || '', paymentInfo: v.paymentInfo || '' });
    setEditing(v);
  }

  async function save(e) {
    e.preventDefault();
    const data = {
      ...form,
      rating: form.rating ? Number(form.rating) : undefined,
      costThreshold: form.costThreshold ? Number(form.costThreshold) : undefined,
    };
    if (editing === 'new') {
      await api.post('/vendors', data);
      toast.success('Vendor added!');
    } else {
      await api.put(`/vendors/${editing.id}`, data);
      toast.success('Vendor updated!');
    }
    setEditing(null);
    load();
  }

  async function remove(id) {
    if (!confirm('Delete this vendor?')) return;
    await api.delete(`/vendors/${id}`);
    toast.success('Vendor removed');
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Preferred Vendors</h1>
        <button onClick={openNew} className="btn-primary">
          <Plus size={16} /> Add Vendor
        </button>
      </div>

      <div className="bg-brand-50 border border-brand-200 rounded-2xl p-4 text-sm text-brand-800">
        <p className="font-semibold mb-1">Auto-Dispatch</p>
        <p>Enable "Auto-Dispatch" on a vendor to have PropFlow automatically send them maintenance jobs when an AI-classified photo matches their trade. You can review all dispatches in the Maintenance tab.</p>
      </div>

      {/* Payment Settings */}
      <form onSubmit={saveSettings} className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Settings size={16} className="text-gray-500" />
          <h2 className="font-semibold">Payment Settings</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Venmo Handle <span className="text-gray-400">(for tenant Venmo payments)</span></label>
            <div className="flex items-center border rounded-xl overflow-hidden">
              <span className="px-3 py-2 text-sm text-gray-400 bg-gray-50 border-r">@</span>
              <input className="flex-1 px-3 py-2 text-sm focus:outline-none" placeholder="yourhandle" value={settings.venmoHandle || ''} onChange={(e) => setSettings((s) => ({ ...s, venmoHandle: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Zelle Info <span className="text-gray-400">(phone or email for Zelle)</span></label>
            <input className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none" placeholder="555-000-0000 or email@bank.com" value={settings.zelleInfo || ''} onChange={(e) => setSettings((s) => ({ ...s, zelleInfo: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Default Vendor Cost Threshold <span className="text-gray-400">(alert me when job exceeds)</span></label>
            <div className="flex items-center border rounded-xl overflow-hidden">
              <span className="px-3 py-2 text-sm text-gray-400 bg-gray-50 border-r">$</span>
              <input type="number" min="0" className="flex-1 px-3 py-2 text-sm focus:outline-none" placeholder="500" value={settings.vendorCostThreshold || ''} onChange={(e) => setSettings((s) => ({ ...s, vendorCostThreshold: e.target.value }))} />
            </div>
            <p className="text-xs text-gray-400 mt-1">You'll get a notification when any job exceeds this amount.</p>
          </div>
        </div>

        <button type="submit" disabled={savingSettings} className="btn-primary disabled:opacity-60">
          <DollarSign size={14} /> {savingSettings ? 'Saving...' : 'Save Payment Settings'}
        </button>
      </form>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-slate-200 rounded-2xl animate-pulse" />)}
        </div>
      ) : vendors.length === 0 ? (
        <div className="text-center py-16 card border-dashed border-2 border-slate-200">
          <Users className="mx-auto text-slate-300 mb-3" size={40} />
          <p className="text-slate-500">No vendors yet. Add your preferred contractors.</p>
          <button onClick={openNew} className="btn-primary mt-4">Add Vendor</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {vendors.map((v) => (
            <div key={v.id} className="card p-5 hover:shadow-card-hover transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900">{v.name}</h3>
                    {v.autoDispatch && (
                      <span className="badge-green flex items-center gap-1">
                        <Zap size={10} /> Auto
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-brand-600 font-medium mt-0.5">{v.trade}</p>
                  <p className="text-sm text-gray-600 mt-1">{v.phone}</p>
                  {v.email && <p className="text-xs text-gray-500">{v.email}</p>}
                  {v.rating && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-amber-600">
                      <Star size={11} /> {v.rating}/5
                    </div>
                  )}
                  {v.paymentInfo && <p className="text-xs text-gray-500 mt-1">💳 {v.paymentInfo}</p>}
                  {v.costThreshold && <p className="text-xs text-amber-600 mt-0.5">⚠️ Alert at ${v.costThreshold}</p>}
                  <p className="text-xs text-gray-400 mt-1">{v._count?.maintenanceRequests ?? 0} jobs completed</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(v)} className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors"><Pencil size={14} /></button>
                  <button onClick={() => remove(v.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit modal */}
      {editing !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="font-bold text-lg">{editing === 'new' ? 'Add Vendor' : 'Edit Vendor'}</h2>
              <button onClick={() => setEditing(null)} className="p-1 text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={save} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Company Name</label>
                <input required className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ABC Plumbing LLC" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Trade</label>
                <select required className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.trade} onChange={(e) => setForm({ ...form, trade: e.target.value })}>
                  <option value="">Select trade</option>
                  {TRADES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                  <input required className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+15551234567" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Rating (1-5)</label>
                  <input type="number" min={1} max={5} step={0.1} className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })} placeholder="4.5" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email (optional)</label>
                <input type="email" className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">How to pay this vendor <span className="text-gray-400">(shown in maintenance job)</span></label>
                <input className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.paymentInfo} onChange={(e) => setForm({ ...form, paymentInfo: e.target.value })} placeholder='e.g. "Zelle: 555-1234" or "Check to ABC Plumbing LLC"' />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Cost threshold override <span className="text-gray-400">(leave blank to use your default ${settings.vendorCostThreshold || 500})</span></label>
                <div className="flex items-center border rounded-xl overflow-hidden">
                  <span className="px-3 py-2 text-sm text-gray-400 bg-gray-50 border-r">$</span>
                  <input type="number" min="0" className="flex-1 px-3 py-2 text-sm focus:outline-none" placeholder={settings.vendorCostThreshold || 500} value={form.costThreshold} onChange={(e) => setForm({ ...form, costThreshold: e.target.value })} />
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div>
                  <p className="text-sm font-medium">Auto-Dispatch</p>
                  <p className="text-xs text-gray-500">Automatically assign this vendor when AI detects their trade</p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, autoDispatch: !f.autoDispatch }))}
                  className={`w-11 h-6 rounded-full transition-colors relative ${form.autoDispatch ? 'bg-brand-500' : 'bg-slate-300'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${form.autoDispatch ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditing(null)} className="flex-1 py-2.5 border rounded-xl text-sm font-medium">Cancel</button>
                <button type="submit" className="btn-primary flex-1 py-2.5">{editing === 'new' ? 'Add Vendor' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
