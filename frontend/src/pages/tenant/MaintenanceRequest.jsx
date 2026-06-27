import { useState, useEffect } from 'react';
import api from '../../api/client';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { Camera, Wrench, Plus, X, CheckCircle, Zap, Clock, AlertTriangle } from 'lucide-react';
import StatusTracker from '../../components/StatusTracker';

const STATUS_COLORS = {
  OPEN: 'bg-orange-100 text-orange-700',
  DISPATCHED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-600',
};

export default function TenantMaintenance() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/maintenance/my');
      setRequests(res.data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Maintenance</h2>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold">
          <Plus size={16} /> Request
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-gray-200 rounded-2xl animate-pulse" />)}</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed">
          <Wrench className="mx-auto text-gray-300 mb-3" size={36} />
          <p className="text-gray-500 text-sm">No maintenance requests yet</p>
          <button onClick={() => setShowForm(true)} className="mt-3 px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold">Submit a Request</button>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <div key={req.id} className="bg-white rounded-2xl border p-4 cursor-pointer hover:border-blue-200 transition-colors" onClick={() => setSelected(req)}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[req.status]}`}>{req.status.replace('_', ' ')}</span>
                    {req.aiTrade && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">{req.aiTrade}</span>}
                  </div>
                  <p className="font-medium text-sm line-clamp-2">{req.description}</p>
                  <p className="text-xs text-gray-400 mt-1">{format(new Date(req.createdAt), 'MMM d, yyyy')}</p>
                  {req.vendor && <p className="text-xs text-blue-600 mt-1">Vendor: {req.vendor.name}</p>}
                </div>
                {req.photoUrls?.[0] && (
                  <img src={req.photoUrls[0]} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && <SubmitRequestModal onClose={() => setShowForm(false)} onSave={() => { setShowForm(false); load(); }} />}

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-bold">Request Details</h2>
              <button onClick={() => setSelected(null)} className="p-1 text-gray-400"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <StatusTracker
                status={selected.status}
                vendor={selected.vendor}
                dispatchedAt={selected.dispatchedAt}
                completedAt={selected.completedAt}
              />

              <div className="flex gap-2 flex-wrap">
                {selected.priority !== 'NORMAL' && (
                  <span className="text-xs px-2 py-1 rounded-full bg-orange-100 text-orange-700 font-medium">{selected.priority}</span>
                )}
              </div>

              <div>
                <p className="text-xs text-gray-500">Description</p>
                <p className="text-sm font-medium mt-0.5">{selected.description}</p>
              </div>

              {selected.aiTrade && (
                <div className="p-3 bg-purple-50 rounded-xl">
                  <p className="text-xs text-purple-700 font-semibold">AI Classification</p>
                  <p className="text-sm text-purple-900 font-bold mt-0.5">{selected.aiTrade}</p>
                  {selected.aiSummary && <p className="text-xs text-purple-700 mt-1">{selected.aiSummary}</p>}
                </div>
              )}

              {selected.vendor && (
                <div className="p-3 bg-blue-50 rounded-xl">
                  <p className="text-xs text-blue-700 font-semibold">Assigned Vendor</p>
                  <p className="text-sm text-blue-900 font-bold mt-0.5">{selected.vendor.name}</p>
                  <p className="text-xs text-blue-700">{selected.vendor.trade} · {selected.vendor.phone}</p>
                </div>
              )}

              {selected.photoUrls?.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-2">Photos</p>
                  <div className="flex gap-2 overflow-x-auto">
                    {selected.photoUrls.map((url, i) => (
                      <img key={i} src={url} alt="" className="h-28 w-auto rounded-xl object-cover flex-shrink-0" />
                    ))}
                  </div>
                </div>
              )}

              {selected.dispatchedAt && (
                <p className="text-xs text-gray-500">Dispatched: {format(new Date(selected.dispatchedAt), 'MMM d, yyyy h:mm a')}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SubmitRequestModal({ onClose, onSave }) {
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('NORMAL');
  const [photos, setPhotos] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [aiPreview, setAiPreview] = useState(null);

  function handlePhotos(files) {
    const newFiles = Array.from(files).slice(0, 5 - photos.length);
    setPhotos((prev) => [...prev, ...newFiles]);
    newFiles.forEach((f) => {
      const reader = new FileReader();
      reader.onload = (e) => setPreviews((prev) => [...prev, e.target.result]);
      reader.readAsDataURL(f);
    });
  }

  async function submit(e) {
    e.preventDefault();
    if (!description.trim()) return toast.error('Please describe the issue');
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('description', description);
      fd.append('priority', priority);
      photos.forEach((p) => fd.append('photos', p));
      const res = await api.post('/maintenance', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (res.data.aiResult) setAiPreview(res.data.aiResult);
      if (!res.data.aiResult) {
        toast.success('Request submitted!');
        onSave();
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (aiPreview) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
          <div className="p-6 space-y-4">
            <div className="text-center">
              <CheckCircle className="mx-auto text-green-500 mb-3" size={44} />
              <h2 className="font-bold text-xl">Request Submitted!</h2>
            </div>
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl text-center">
              <p className="text-xs text-purple-600 font-medium uppercase tracking-wider">AI Detected</p>
              <p className="text-2xl font-bold text-purple-800 mt-1">{aiPreview.trade}</p>
              <p className="text-sm text-purple-700 mt-1">{aiPreview.summary}</p>
              {aiPreview.priority !== 'NORMAL' && (
                <span className={`inline-block mt-2 text-xs px-3 py-1 rounded-full font-bold ${aiPreview.priority === 'EMERGENCY' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                  {aiPreview.priority === 'EMERGENCY' ? '⚡ Emergency' : '⚠️ High Priority'}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 text-center">Your property manager has been notified. A vendor will be dispatched shortly.</p>
            <button onClick={onSave} className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl">Done</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-lg">Submit Maintenance Request</h2>
          <button onClick={onClose} className="p-1 text-gray-400"><X size={20} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          {/* Photo upload */}
          <div>
            <label className="block text-sm font-semibold mb-2">Photos (Recommended)</label>
            <p className="text-xs text-gray-500 mb-3">Take a photo — our AI will identify the issue and route the right contractor automatically.</p>
            <div className="flex gap-2 flex-wrap">
              {previews.map((p, i) => (
                <div key={i} className="relative">
                  <img src={p} alt="" className="w-20 h-20 rounded-xl object-cover" />
                  <button type="button" onClick={() => { setPhotos((ps) => ps.filter((_, j) => j !== i)); setPreviews((ps) => ps.filter((_, j) => j !== i)); }} className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center">×</button>
                </div>
              ))}
              {photos.length < 5 && (
                <label className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 hover:border-blue-300 flex flex-col items-center justify-center gap-1 cursor-pointer text-gray-400 hover:text-blue-500 transition-colors">
                  <Camera size={22} />
                  <span className="text-xs">Add Photo</span>
                  <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => handlePhotos(e.target.files)} />
                </label>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Describe the Issue</label>
            <textarea
              required
              rows={3}
              className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="e.g., Kitchen faucet is leaking under the sink. Water pooling in cabinet."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Priority</label>
            <div className="grid grid-cols-2 gap-2">
              {[['NORMAL', 'Normal', ''], ['HIGH', 'High', 'text-orange-500'], ['EMERGENCY', 'Emergency', 'text-red-600']].map(([val, label, color]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setPriority(val)}
                  className={`py-2 rounded-xl border-2 text-sm font-semibold transition-colors ${priority === val ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-100 text-gray-600'} ${color}`}
                >
                  {val === 'EMERGENCY' && '⚡ '}{label}
                </button>
              ))}
            </div>
          </div>

          {priority === 'EMERGENCY' && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              For life-threatening emergencies (gas leak, fire, flood), call 911 first. Use Emergency priority for urgent issues like no heat or active water leaks.
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-3 border rounded-xl text-sm font-medium">Cancel</button>
            <button type="submit" disabled={submitting} className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold disabled:opacity-60">
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
