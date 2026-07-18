import { useState, useEffect } from 'react';
import api from '../../api/client';
import toast from 'react-hot-toast';
import { format, differenceInDays } from 'date-fns';
import { FileText, Upload, Send, Plus, X, CheckCircle, AlertCircle, Clock, Settings, Check } from 'lucide-react';
import DropZone from '../../components/DropZone';

const STATUS_STYLES = {
  ACTIVE: 'bg-green-100 text-green-700',
  EXPIRING_SOON: 'bg-yellow-100 text-yellow-700',
  EXPIRED: 'bg-red-100 text-red-700',
  RENEWED: 'bg-blue-100 text-blue-700',
  TERMINATED: 'bg-gray-100 text-gray-600',
};

const ORDINAL = (n) => {
  const s = ['th','st','nd','rd'];
  const v = n % 100;
  return n + (s[(v-20)%10] || s[v] || s[0]);
};

const TEMPLATE_CATEGORIES = {
  lease: 'Leases',
  renewal: 'Renewals',
  addendum: 'Addendums',
  inspection: 'Inspections',
  vendor: 'Vendor Agreements',
};

export default function ManagerLeases() {
  const [leases, setLeases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [uploadingFor, setUploadingFor] = useState(null);
  const [aiDraft, setAiDraft] = useState(null); // fields to confirm
  const [sendingRenewal, setSendingRenewal] = useState(null);
  const [scheduleEdit, setScheduleEdit] = useState(null); // lease id being edited
  const [scheduleForm, setScheduleForm] = useState({});
  const [savingSchedule, setSavingSchedule] = useState(false);

  // Template library
  const [templates, setTemplates] = useState([]);
  const [showLibrary, setShowLibrary] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [templateForm, setTemplateForm] = useState({ name: '', category: 'lease', description: '', content: '' });
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [signatureFor, setSignatureFor] = useState(null); // lease being sent for signature
  const [signatureTemplateId, setSignatureTemplateId] = useState('');
  const [sendingSignature, setSendingSignature] = useState(false);

  useEffect(() => { load(); loadTemplates(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/leases');
      setLeases(res.data);
    } finally {
      setLoading(false);
    }
  }

  async function loadTemplates() {
    try {
      const res = await api.get('/templates');
      setTemplates(res.data);
    } catch { /* templates are non-critical */ }
  }

  async function previewFull(tpl) {
    try {
      const res = await api.get(`/templates/${tpl.id}`);
      setPreviewTemplate(res.data);
    } catch { toast.error('Could not load template'); }
  }

  async function saveTemplate() {
    if (!templateForm.name || !templateForm.content) return toast.error('Name and document text are required');
    setSavingTemplate(true);
    try {
      await api.post('/templates', templateForm);
      toast.success('Template saved to your library!');
      setShowNewTemplate(false);
      setTemplateForm({ name: '', category: 'lease', description: '', content: '' });
      loadTemplates();
    } catch { toast.error('Could not save template'); } finally { setSavingTemplate(false); }
  }

  async function deleteTemplate(id) {
    if (!confirm('Delete this template from your library?')) return;
    await api.delete(`/templates/${id}`);
    toast.success('Template deleted');
    loadTemplates();
  }

  async function sendForSignature() {
    if (!signatureTemplateId) return toast.error('Pick a template to send');
    setSendingSignature(true);
    try {
      await api.post(`/leases/${signatureFor.id}/send-for-signature`, { templateId: signatureTemplateId });
      toast.success('Sent! The tenant will get a DocuSign email to review and sign.');
      setSignatureFor(null);
      setSignatureTemplateId('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not send for signature', { duration: 8000 });
    } finally {
      setSendingSignature(false);
    }
  }

  async function uploadDocument(leaseId, file) {
    setUploadingFor(leaseId);
    try {
      const fd = new FormData();
      fd.append('document', file);
      const res = await api.post(`/leases/${leaseId}/upload-document`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data.aiExtracted) {
        // Show confirmation dialog instead of auto-applying
        setAiDraft({ leaseId, fields: res.data.aiExtracted, accepted: {} });
      }
      toast.success('Lease analyzed — review extracted fields below');
      load();
    } finally {
      setUploadingFor(null);
    }
  }

  async function applyAiDraft() {
    if (!aiDraft) return;
    const { leaseId, fields, accepted } = aiDraft;
    const payload = {};
    // Only include fields the manager accepted (or all if accepted is empty = accepted all)
    const allKeys = Object.keys(fields).filter(k => fields[k] != null);
    for (const k of allKeys) {
      if (accepted[k] !== false) payload[k] = fields[k]; // false = rejected, undefined/true = accepted
    }
    try {
      await api.put(`/leases/${leaseId}`, payload);
      toast.success('Extracted fields applied!');
      setAiDraft(null);
      load();
    } catch {
      toast.error('Failed to apply fields');
    }
  }

  async function sendRenewal(lease) {
    setSendingRenewal(lease.id);
    const newEnd = new Date(lease.endDate);
    newEnd.setFullYear(newEnd.getFullYear() + 1);
    try {
      await api.post(`/leases/${lease.id}/send-renewal`, {
        newEndDate: newEnd.toISOString(),
        newRentAmount: lease.rentAmount,
      });
      toast.success('Renewal sent via DocuSign!');
      load();
    } finally {
      setSendingRenewal(null);
    }
  }

  function openScheduleEdit(lease) {
    setScheduleEdit(lease.id);
    setScheduleForm({
      rentDueDay: lease.rentDueDay ?? 1,
      lateFeeGraceDays: lease.lateFeeGraceDays ?? 5,
      lateFee: lease.lateFee ?? '',
    });
  }

  async function saveSchedule(leaseId) {
    setSavingSchedule(true);
    try {
      await api.put(`/leases/${leaseId}`, {
        rentDueDay: Number(scheduleForm.rentDueDay),
        lateFeeGraceDays: Number(scheduleForm.lateFeeGraceDays),
        lateFee: scheduleForm.lateFee !== '' ? Number(scheduleForm.lateFee) : null,
      });
      toast.success('Rent schedule saved!');
      setScheduleEdit(null);
      load();
      // Update selected if open
      if (selected?.id === leaseId) {
        setSelected((s) => s ? { ...s, rentDueDay: Number(scheduleForm.rentDueDay), lateFeeGraceDays: Number(scheduleForm.lateFeeGraceDays), lateFee: scheduleForm.lateFee !== '' ? Number(scheduleForm.lateFee) : null } : s);
      }
    } finally {
      setSavingSchedule(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Leases</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowLibrary((v) => !v)} className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50">
            <FileText size={16} /> Template Library
          </button>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700">
            <Plus size={16} /> New Lease
          </button>
        </div>
      </div>

      {/* Template Library */}
      {showLibrary && (
        <div className="bg-white rounded-2xl border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Document Template Library</h2>
              <p className="text-xs text-gray-500 mt-0.5">Ready-to-use legal documents. Rent, late fees, and dates fill in automatically from the lease when you send one for signature.</p>
            </div>
            <button onClick={() => setShowNewTemplate(true)} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50">
              <Plus size={13} /> Add Your Own
            </button>
          </div>
          {Object.entries(TEMPLATE_CATEGORIES).map(([cat, label]) => {
            const catTemplates = templates.filter((t) => t.category === cat);
            if (catTemplates.length === 0) return null;
            return (
              <div key={cat}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{label}</p>
                <div className="grid md:grid-cols-2 gap-2">
                  {catTemplates.map((t) => (
                    <div key={t.id} className="border rounded-xl p-3 flex items-start justify-between gap-2 hover:border-blue-300 transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                          {t.name}
                          {t.isSystem && <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full font-medium">PropFlow</span>}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => previewFull(t)} className="text-xs text-blue-600 hover:underline">Preview</button>
                        {!t.isSystem && (
                          <button onClick={() => deleteTemplate(t.id)} className="text-gray-300 hover:text-red-500 ml-1"><X size={13} /></button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-gray-200 rounded-2xl animate-pulse" />)}</div>
      ) : leases.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed">
          <FileText className="mx-auto text-gray-300 mb-3" size={40} />
          <p className="text-gray-500">No leases yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {leases.map((lease) => {
            const daysLeft = differenceInDays(new Date(lease.endDate), new Date());
            const isExpiringSoon = daysLeft <= 60 && daysLeft > 0;
            const isEditing = scheduleEdit === lease.id;
            return (
              <div key={lease.id} className="bg-white rounded-2xl border overflow-hidden">
                <div className="p-5 hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => setSelected(lease)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                        <FileText size={18} className="text-blue-600" />
                      </div>
                      <div>
                        <p className="font-semibold">{lease.tenant.firstName} {lease.tenant.lastName}</p>
                        <p className="text-sm text-gray-500">{lease.unit.property.name} · Unit {lease.unit.unitNumber} · ${lease.rentAmount.toLocaleString()}/mo</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[lease.status]}`}>{lease.status.replace('_', ' ')}</span>
                      {isExpiringSoon && (
                        <span className="text-xs text-orange-600 flex items-center gap-1">
                          <Clock size={10} /> {daysLeft}d left
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-3 text-xs text-gray-500">
                    <span>Start: {format(new Date(lease.startDate), 'MMM d, yyyy')}</span>
                    <span>End: {format(new Date(lease.endDate), 'MMM d, yyyy')}</span>
                    <span>Due: {ORDINAL(lease.rentDueDay || 1)} · {lease.lateFeeGraceDays ?? 5}d grace</span>
                  </div>
                </div>

                {/* Rent schedule editor — inline */}
                <div className="border-t px-5 py-3 bg-gray-50 flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                  {isEditing ? (
                    <div className="flex-1 flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <label className="text-xs font-medium text-gray-600">Due day</label>
                        <select
                          className="px-2 py-1 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={scheduleForm.rentDueDay}
                          onChange={(e) => setScheduleForm((f) => ({ ...f, rentDueDay: e.target.value }))}
                        >
                          {[1,5,10,15,20,25,28].map(d => <option key={d} value={d}>{ORDINAL(d)}</option>)}
                        </select>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <label className="text-xs font-medium text-gray-600">Grace period</label>
                        <select
                          className="px-2 py-1 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={scheduleForm.lateFeeGraceDays}
                          onChange={(e) => setScheduleForm((f) => ({ ...f, lateFeeGraceDays: e.target.value }))}
                        >
                          {[0,1,2,3,5,7,10,14].map(d => <option key={d} value={d}>{d} days</option>)}
                        </select>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <label className="text-xs font-medium text-gray-600">Late fee ($)</label>
                        <input
                          type="number" min="0" step="0.01"
                          placeholder="None"
                          className="w-20 px-2 py-1 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={scheduleForm.lateFee}
                          onChange={(e) => setScheduleForm((f) => ({ ...f, lateFee: e.target.value }))}
                        />
                      </div>
                      <div className="flex gap-2 ml-auto">
                        <button onClick={() => setScheduleEdit(null)} className="px-3 py-1 text-xs border rounded-lg text-gray-600 hover:bg-gray-100">Cancel</button>
                        <button onClick={() => saveSchedule(lease.id)} disabled={savingSchedule} className="px-3 py-1 text-xs bg-blue-600 text-white rounded-lg font-semibold disabled:opacity-60 hover:bg-blue-700">
                          {savingSchedule ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span className="text-xs text-gray-500">
                        Rent due: <strong>{ORDINAL(lease.rentDueDay || 1)}</strong> · Grace: <strong>{lease.lateFeeGraceDays ?? 5} days</strong>
                        {lease.lateFee ? ` · Late fee: $${lease.lateFee}` : ' · No late fee'}
                      </span>
                      <button
                        onClick={() => { setSignatureFor(lease); setSignatureTemplateId(''); }}
                        className="ml-auto flex items-center gap-1 text-xs text-blue-600 hover:underline"
                      >
                        <Send size={11} /> Send for signature
                      </button>
                      <button
                        onClick={() => openScheduleEdit(lease)}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                      >
                        <Settings size={11} /> Edit schedule
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lease detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="font-bold text-lg">Lease Details</h2>
              <button onClick={() => setSelected(null)} className="p-1 text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <InfoRow label="Tenant" value={`${selected.tenant.firstName} ${selected.tenant.lastName}`} />
                <InfoRow label="Email" value={selected.tenant.email} />
                <InfoRow label="Unit" value={`${selected.unit.unitNumber} — ${selected.unit.property.name}`} />
                <InfoRow label="Monthly Rent" value={`$${selected.rentAmount.toLocaleString()}`} />
                <InfoRow label="Start" value={format(new Date(selected.startDate), 'MMM d, yyyy')} />
                <InfoRow label="End" value={format(new Date(selected.endDate), 'MMM d, yyyy')} />
                <InfoRow label="Deposit" value={`$${selected.depositAmount.toLocaleString()}`} />
                <InfoRow label="Rent Due" value={ORDINAL(selected.rentDueDay || 1) + ' of month'} />
                <InfoRow label="Grace Period" value={`${selected.lateFeeGraceDays ?? 5} days`} />
                <InfoRow label="Late Fee" value={selected.lateFee ? `$${selected.lateFee}` : 'None'} />
              </div>

              {/* Upload document */}
              <div>
                <p className="text-sm font-semibold mb-2">Lease Document</p>
                {selected.documentUrl ? (
                  <a href={selected.documentUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                    <FileText size={14} /> View uploaded lease
                  </a>
                ) : (
                  <DropZone
                    accept=".pdf,.jpg,.jpeg,.png"
                    label="Drop lease document here to analyze"
                    uploading={uploadingFor === selected.id}
                    uploaded={false}
                    onFile={(file) => uploadDocument(selected.id, file)}
                  />
                )}
              </div>

              {/* Send renewal */}
              <div className="flex gap-3">
                <button
                  onClick={() => sendRenewal(selected)}
                  disabled={!!sendingRenewal || !!selected.renewalSentAt}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold disabled:opacity-60 hover:bg-blue-700"
                >
                  {selected.renewalSentAt ? <><CheckCircle size={14} /> Renewal Sent</> : sendingRenewal === selected.id ? 'Sending...' : <><Send size={14} /> Send Renewal (DocuSign)</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Extraction Confirmation Dialog */}
      {aiDraft && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <div>
                <h2 className="font-bold text-gray-900">We Found These Lease Terms</h2>
                <p className="text-xs text-gray-500 mt-0.5">Uncheck any fields you don't want to apply</p>
              </div>
              <button onClick={() => setAiDraft(null)} className="p-1 text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-2">
              {Object.entries(aiDraft.fields)
                .filter(([, v]) => v != null && v !== '' && !Array.isArray(v))
                .map(([key, value]) => {
                  const isRejected = aiDraft.accepted[key] === false;
                  const label = {
                    rentAmount: 'Monthly Rent',
                    depositAmount: 'Security Deposit',
                    startDate: 'Lease Start',
                    endDate: 'Lease End',
                    rentDueDay: 'Rent Due Day',
                    lateFee: 'Late Fee',
                    lateFeeGraceDays: 'Grace Period (days)',
                    petPolicy: 'Pet Policy',
                    utilitiesIncluded: 'Utilities Included',
                    landlordName: 'Landlord Name',
                    propertyAddress: 'Property Address',
                  }[key] || key;

                  let displayVal = value;
                  if (key === 'startDate' || key === 'endDate') {
                    try { displayVal = format(new Date(value), 'MMM d, yyyy'); } catch {}
                  }
                  if (key === 'rentDueDay') displayVal = ORDINAL(value) + ' of month';
                  if (key === 'rentAmount' || key === 'depositAmount' || key === 'lateFee') displayVal = '$' + Number(value).toLocaleString();
                  if (key === 'lateFeeGraceDays') displayVal = value + ' days';

                  return (
                    <div
                      key={key}
                      onClick={() => setAiDraft((d) => ({ ...d, accepted: { ...d.accepted, [key]: isRejected ? undefined : false } }))}
                      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-colors ${isRejected ? 'bg-gray-50 border-gray-200 opacity-50' : 'bg-blue-50 border-blue-100 hover:border-blue-300'}`}
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isRejected ? 'border-gray-300' : 'border-blue-500 bg-blue-500'}`}>
                        {!isRejected && <Check size={12} className="text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-500">{label}</p>
                        <p className="text-sm font-semibold text-gray-900 truncate">{String(displayVal)}</p>
                      </div>
                    </div>
                  );
                })
              }
            </div>
            <div className="flex gap-3 p-5 border-t">
              <button onClick={() => setAiDraft(null)} className="flex-1 py-2.5 border rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">Discard</button>
              <button onClick={applyAiDraft} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700">
                Apply Selected Fields
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreate && <CreateLeaseModal templates={templates} onClose={() => setShowCreate(false)} onSave={() => { setShowCreate(false); load(); }} />}

      {/* Template preview modal */}
      {previewTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setPreviewTemplate(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b flex-shrink-0">
              <div>
                <h2 className="font-bold">{previewTemplate.name}</h2>
                <p className="text-xs text-gray-500">{previewTemplate.description}</p>
              </div>
              <button onClick={() => setPreviewTemplate(null)} className="p-1 text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="overflow-y-auto p-5">
              <pre className="text-xs text-gray-800 whitespace-pre-wrap font-mono bg-gray-50 border rounded-xl p-4">{previewTemplate.content}</pre>
            </div>
            <div className="p-4 border-t text-xs text-gray-500 flex-shrink-0">
              Fields like rent, dates, and late fees fill in automatically from the lease when you send this for signature.
            </div>
          </div>
        </div>
      )}

      {/* New custom template modal */}
      {showNewTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowNewTemplate(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b flex-shrink-0">
              <h2 className="font-bold">Add Your Own Template</h2>
              <button onClick={() => setShowNewTemplate(false)} className="p-1 text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="overflow-y-auto p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Template Name</label>
                  <input className="w-full px-3 py-2 border rounded-xl text-sm" placeholder="e.g. My Louisiana Lease" value={templateForm.name} onChange={(e) => setTemplateForm((f) => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                  <select className="w-full px-3 py-2 border rounded-xl text-sm" value={templateForm.category} onChange={(e) => setTemplateForm((f) => ({ ...f, category: e.target.value }))}>
                    {Object.entries(TEMPLATE_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Short Description</label>
                <input className="w-full px-3 py-2 border rounded-xl text-sm" placeholder="What is this document for?" value={templateForm.description} onChange={(e) => setTemplateForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Document Text</label>
                <textarea rows={12} className="w-full px-3 py-2 border rounded-xl text-xs font-mono" placeholder={'Paste your lease or agreement text here.\n\nUse placeholders that fill automatically:\n{{TENANT_NAME}} {{PROPERTY_ADDRESS}} {{UNIT_NUMBER}} {{START_DATE}} {{END_DATE}} {{RENT_AMOUNT}} {{DEPOSIT_AMOUNT}} {{LATE_FEE}} {{LATE_FEE_GRACE_DAYS}} {{LANDLORD_NAME}} {{STATE}}'} value={templateForm.content} onChange={(e) => setTemplateForm((f) => ({ ...f, content: e.target.value }))} />
                <p className="text-xs text-gray-400 mt-1">Placeholders like {'{{RENT_AMOUNT}}'} and {'{{TENANT_NAME}}'} fill in automatically from each lease.</p>
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2 flex-shrink-0">
              <button onClick={() => setShowNewTemplate(false)} className="px-4 py-2 border rounded-xl text-sm text-gray-600">Cancel</button>
              <button onClick={saveTemplate} disabled={savingTemplate} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 hover:bg-blue-700">
                {savingTemplate ? 'Saving…' : 'Save Template'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send for signature modal */}
      {signatureFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setSignatureFor(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b">
              <div>
                <h2 className="font-bold">Send for Signature</h2>
                <p className="text-xs text-gray-500">{signatureFor.tenant.firstName} {signatureFor.tenant.lastName} · Unit {signatureFor.unit.unitNumber}</p>
              </div>
              <button onClick={() => setSignatureFor(null)} className="p-1 text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Document</label>
                <select className="w-full px-3 py-2 border rounded-xl text-sm" value={signatureTemplateId} onChange={(e) => setSignatureTemplateId(e.target.value)}>
                  <option value="">Choose a template…</option>
                  {templates.map((t) => <option key={t.id} value={t.id}>{t.name}{t.isSystem ? '' : ' (yours)'}</option>)}
                </select>
                <p className="text-xs text-gray-400 mt-1">Rent, dates, and fees fill in from this lease. The tenant gets a DocuSign email to review and sign.</p>
              </div>
              <button onClick={sendForSignature} disabled={sendingSignature || !signatureTemplateId} className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 hover:bg-blue-700 flex items-center justify-center gap-2">
                <Send size={14} /> {sendingSignature ? 'Sending…' : 'Send via DocuSign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="font-medium text-gray-900">{value}</p>
    </div>
  );
}

function CreateLeaseModal({ templates = [], onClose, onSave }) {
  const [form, setForm] = useState({
    unitId: '', startDate: '', endDate: '',
    rentAmount: '', depositAmount: '', rentDueDay: '1',
    lateFeeGraceDays: '5', lateFee: '', autoRenew: false, templateId: '',
  });
  const [tenant, setTenant] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/properties').then((r) => setProperties(r.data));
  }, []);

  const allUnits = properties.flatMap((p) => p.units.filter((u) => u.status !== 'OCCUPIED').map((u) => ({ ...u, propertyName: p.name })));

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      // Invite (or find) the tenant by email — sends them a welcome email with login
      const inviteRes = await api.post('/auth/invite-tenant', { ...tenant, unitId: form.unitId });
      const tenantId = inviteRes.data.tenant.id;
      if (inviteRes.data.emailSent === false) {
        toast.error('Tenant added, but the invite email could not be sent — share their login manually.', { duration: 8000 });
      }

      await api.post('/leases', {
        ...form,
        tenantId,
        templateId: form.templateId || undefined,
        rentAmount: Number(form.rentAmount),
        depositAmount: Number(form.depositAmount || 0),
        rentDueDay: Number(form.rentDueDay),
        lateFeeGraceDays: Number(form.lateFeeGraceDays),
        lateFee: form.lateFee ? Number(form.lateFee) : null,
      });
      toast.success('Lease created!');
      onSave();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not create lease');
    } finally {
      setLoading(false);
    }
  }

  const inp = 'w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="font-bold text-lg">Create Lease</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Unit</label>
            <select required className={inp} value={form.unitId} onChange={(e) => setForm({ ...form, unitId: e.target.value })}>
              <option value="">Select a vacant unit</option>
              {allUnits.map((u) => <option key={u.id} value={u.id}>{u.propertyName} — Unit {u.unitNumber} (${u.rentAmount}/mo)</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Lease Template <span className="text-gray-400">(optional)</span></label>
            <select className={inp} value={form.templateId} onChange={(e) => setForm({ ...form, templateId: e.target.value })}>
              <option value="">No template — I'll upload my own lease</option>
              {templates.filter((t) => t.category === 'lease').map((t) => <option key={t.id} value={t.id}>{t.name}{t.isSystem ? '' : ' (yours)'}</option>)}
            </select>
            <p className="text-xs text-gray-400 mt-1">Pick a template to send it for signature via DocuSign after creating the lease.</p>
          </div>
          {/* Tenant info — invited automatically with a welcome email */}
          <div className="p-4 bg-gray-50 rounded-xl space-y-3">
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Tenant</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">First Name</label>
                <input className={inp} required placeholder="Jamie" value={tenant.firstName} onChange={(e) => setTenant({ ...tenant, firstName: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Last Name</label>
                <input className={inp} required placeholder="Smith" value={tenant.lastName} onChange={(e) => setTenant({ ...tenant, lastName: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
              <input type="email" className={inp} required placeholder="tenant@email.com" value={tenant.email} onChange={(e) => setTenant({ ...tenant, email: e.target.value })} />
              <p className="text-xs text-gray-400 mt-1">They'll get a welcome email with their login and a link to the tenant portal.</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Phone <span className="text-gray-400">(optional)</span></label>
              <input type="tel" className={inp} placeholder="(555) 000-0000" value={tenant.phone} onChange={(e) => setTenant({ ...tenant, phone: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
              <input type="date" required className={inp} value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
              <input type="date" required className={inp} value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Monthly Rent ($)</label>
              <input type="number" min={0} required className={inp} value={form.rentAmount} onChange={(e) => setForm({ ...form, rentAmount: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Security Deposit ($)</label>
              <input type="number" min={0} className={inp} value={form.depositAmount} onChange={(e) => setForm({ ...form, depositAmount: e.target.value })} />
            </div>
          </div>

          {/* Rent Schedule */}
          <div className="p-4 bg-gray-50 rounded-xl space-y-3">
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Rent Schedule</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Rent Due Day</label>
                <select className={inp} value={form.rentDueDay} onChange={(e) => setForm({ ...form, rentDueDay: e.target.value })}>
                  {[1,5,10,15,20,25,28].map(d => <option key={d} value={d}>{ORDINAL(d)} of month</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Grace Period</label>
                <select className={inp} value={form.lateFeeGraceDays} onChange={(e) => setForm({ ...form, lateFeeGraceDays: e.target.value })}>
                  {[0,1,2,3,5,7,10,14].map(d => <option key={d} value={d}>{d} days</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Late Fee ($) — optional</label>
              <input type="number" min={0} step="0.01" placeholder="e.g. 75" className={inp} value={form.lateFee} onChange={(e) => setForm({ ...form, lateFee: e.target.value })} />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border rounded-xl text-sm font-medium">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold disabled:opacity-60">{loading ? 'Creating...' : 'Create Lease'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
