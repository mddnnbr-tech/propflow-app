import { useState } from 'react';
import { Building2, Home, Users, CheckCircle, ArrowRight, Clock, DollarSign, Wrench, AlertCircle } from 'lucide-react';
import api from '../api/client';
import toast from 'react-hot-toast';

const STEPS = [
  { id: 'welcome' },
  { id: 'what-we-handle' },
  { id: 'property', icon: Building2, color: 'bg-brand-600', title: 'Add Your First Property', subtitle: 'Enter the address and we\'ll set everything up.', cta: 'Add Property' },
  { id: 'unit', icon: Home, color: 'bg-brand-600', title: 'Add a Unit', subtitle: 'At least one unit is required to invite a tenant.', cta: 'Add Unit' },
  { id: 'tenant', icon: Users, color: 'bg-brand-600', title: 'Invite Your First Tenant', subtitle: "We'll send them a welcome email with login instructions.", cta: 'Send Invite' },
  { id: 'done' },
];

const TIME_SAVINGS = [
  'Rent reminders sent automatically before the due date',
  'Late fees assessed after grace period — no manual tracking',
  'Maintenance vendors dispatched and followed up for you',
  'Lease renewals triggered and signed via DocuSign',
  'Tenant notifications sent for every status update',
];

const AUTOMATED = [
  'Rent reminders (3 days before + day of)',
  'Late fee assessment after grace period',
  'Maintenance vendor dispatch + status updates',
  'Tenant notifications for every job update',
  'Lease renewal offers with e-signature via DocuSign',
  'Overdue rent alerts to you and your tenant',
  'Autopay processing when tenant opts in',
];

const STILL_YOU = [
  'Tenant screening and selection',
  'In-person property showings',
  'Approving large repair costs (you set the threshold)',
  'Eviction filings (requires a licensed attorney)',
  'Final lease terms and rent pricing decisions',
];

export default function ManagerOnboarding({ onComplete }) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [createdPropertyId, setCreatedPropertyId] = useState(null);
  const [createdUnitId, setCreatedUnitId] = useState(null);

  const [property, setProperty] = useState({ name: '', address: '', city: '', state: '', zip: '' });
  const [unit, setUnit] = useState({ unitNumber: '', bedrooms: '', bathrooms: '', rentAmount: '' });
  const [tenant, setTenant] = useState({ firstName: '', lastName: '', email: '', phone: '' });

  const current = STEPS[step];
  const totalFormSteps = STEPS.length;

  async function handleNext() {
    if (current.id === 'property') {
      if (!property.name || !property.address) return toast.error('Property name and address are required');
      setSaving(true);
      try {
        const res = await api.post('/properties', property);
        setCreatedPropertyId(res.data.id);
        setStep((s) => s + 1);
      } catch { toast.error('Could not save property'); } finally { setSaving(false); }
      return;
    }
    if (current.id === 'unit') {
      if (!unit.unitNumber || !unit.rentAmount) return toast.error('Unit number and rent amount are required');
      setSaving(true);
      try {
        const res = await api.post('/properties/' + createdPropertyId + '/units', {
          unitNumber: unit.unitNumber,
          bedrooms: parseInt(unit.bedrooms) || 1,
          bathrooms: parseFloat(unit.bathrooms) || 1,
          rentAmount: parseFloat(unit.rentAmount),
        });
        setCreatedUnitId(res.data.id);
        setStep((s) => s + 1);
      } catch { toast.error('Could not save unit'); } finally { setSaving(false); }
      return;
    }
    if (current.id === 'tenant') {
      if (!tenant.firstName || !tenant.email) return toast.error('First name and email are required');
      setSaving(true);
      try {
        await api.post('/auth/invite-tenant', { ...tenant, unitId: createdUnitId });
        toast.success('Invite sent to ' + tenant.email);
        setStep((s) => s + 1);
      } catch { toast.error('Could not send invite — you can do this later from Properties'); } finally { setSaving(false); }
      return;
    }
    if (current.id === 'done') { onComplete(); return; }
    setStep((s) => s + 1);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-900 to-blue-900 p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md my-auto overflow-hidden">
        {/* Progress bar */}
        <div className="flex gap-1 p-4">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-500 ${i <= step ? 'bg-brand-600' : 'bg-gray-200'}`} />
          ))}
        </div>

        <div className="px-8 pb-8 pt-2">

          {/* ── Step 0: Welcome ── */}
          {current.id === 'welcome' && (
            <div className="space-y-5">
              <div className="w-14 h-14 bg-brand-600 rounded-2xl flex items-center justify-center">
                <Clock size={26} className="text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-gray-900">Welcome to PropFlow</h2>
                <p className="text-gray-500 text-sm mt-1">Property management on autopilot. Setup takes 3 minutes.</p>
              </div>

              {/* Automation list */}
              <div className="bg-slate-50 rounded-2xl p-4 space-y-2.5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">What PropFlow handles for you</p>
                {TIME_SAVINGS.map((label) => (
                  <div key={label} className="flex items-start gap-2.5">
                    <CheckCircle size={15} className="text-brand-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-slate-700">{label}</span>
                  </div>
                ))}
              </div>

              <button onClick={handleNext} className="w-full py-3 bg-brand-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-brand-700">
                Get Started <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* ── Step 1: What we handle vs what's yours ── */}
          {current.id === 'what-we-handle' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-black text-gray-900">What's automated vs. what's yours</h2>
                <p className="text-gray-500 text-sm mt-1">PropFlow handles the routine work. You make the decisions that matter.</p>
              </div>

              <div className="space-y-3">
                <div className="bg-slate-50 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Wrench size={14} className="text-brand-600" />
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">PropFlow handles automatically</p>
                  </div>
                  {AUTOMATED.map((item) => (
                    <div key={item} className="flex items-start gap-2 text-sm text-slate-700">
                      <CheckCircle size={14} className="text-brand-600 flex-shrink-0 mt-0.5" />
                      {item}
                    </div>
                  ))}
                </div>

                <div className="border border-slate-200 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle size={14} className="text-slate-400" />
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">You still handle these</p>
                  </div>
                  {STILL_YOU.map((item) => (
                    <div key={item} className="flex items-start gap-2 text-sm text-slate-600">
                      <div className="w-1.5 h-1.5 bg-slate-300 rounded-full flex-shrink-0 mt-1.5" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep((s) => s - 1)} className="px-5 py-3 border rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">Back</button>
                <button onClick={handleNext} className="flex-1 py-3 bg-brand-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-brand-700">
                  Got it, let's set up <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ── Steps 2–4: Property / Unit / Tenant forms ── */}
          {['property', 'unit', 'tenant'].includes(current.id) && (
            <div className="space-y-5">
              <div className={`w-14 h-14 ${current.color} rounded-2xl flex items-center justify-center`}>
                <current.icon size={26} className="text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-gray-900">{current.title}</h2>
                <p className="text-gray-500 text-sm mt-1">{current.subtitle}</p>
              </div>

              {current.id === 'property' && (
                <div className="space-y-3">
                  <input className="w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="Property name (e.g., Oak Street Apartments)" value={property.name} onChange={(e) => setProperty({ ...property, name: e.target.value })} />
                  <input className="w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="Street address" value={property.address} onChange={(e) => setProperty({ ...property, address: e.target.value })} />
                  <div className="grid grid-cols-3 gap-2">
                    <input className="col-span-2 px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="City" value={property.city} onChange={(e) => setProperty({ ...property, city: e.target.value })} />
                    <input className="px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="State" value={property.state} onChange={(e) => setProperty({ ...property, state: e.target.value })} />
                  </div>
                  <input className="w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="ZIP code" value={property.zip} onChange={(e) => setProperty({ ...property, zip: e.target.value })} />
                </div>
              )}

              {current.id === 'unit' && (
                <div className="space-y-3">
                  <input className="w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="Unit number (e.g., 1A, 101)" value={unit.unitNumber} onChange={(e) => setUnit({ ...unit, unitNumber: e.target.value })} />
                  <div className="grid grid-cols-2 gap-2">
                    <input type="number" className="px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="Bedrooms" value={unit.bedrooms} onChange={(e) => setUnit({ ...unit, bedrooms: e.target.value })} />
                    <input type="number" className="px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="Bathrooms" value={unit.bathrooms} onChange={(e) => setUnit({ ...unit, bathrooms: e.target.value })} />
                  </div>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                    <input type="number" className="w-full pl-8 pr-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="Monthly rent" value={unit.rentAmount} onChange={(e) => setUnit({ ...unit, rentAmount: e.target.value })} />
                  </div>
                </div>
              )}

              {current.id === 'tenant' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <input className="px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="First name" value={tenant.firstName} onChange={(e) => setTenant({ ...tenant, firstName: e.target.value })} />
                    <input className="px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="Last name" value={tenant.lastName} onChange={(e) => setTenant({ ...tenant, lastName: e.target.value })} />
                  </div>
                  <input type="email" className="w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="Tenant email address" value={tenant.email} onChange={(e) => setTenant({ ...tenant, email: e.target.value })} />
                  <input type="tel" className="w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="Phone number (optional)" value={tenant.phone} onChange={(e) => setTenant({ ...tenant, phone: e.target.value })} />
                  <p className="text-xs text-gray-400">They'll get a welcome email with a temporary password and a quick-start guide.</p>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setStep((s) => s - 1)} className="px-5 py-3 border rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">Back</button>
                {current.id === 'tenant' && (
                  <button onClick={onComplete} className="px-5 py-3 border rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50">Skip</button>
                )}
                <button onClick={handleNext} disabled={saving} className="flex-1 py-3 bg-brand-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-brand-700 disabled:opacity-60">
                  {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <>{current.cta} <ArrowRight size={16} /></>}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 5: Done ── */}
          {current.id === 'done' && (
            <div className="space-y-5 text-center">
              <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto">
                <CheckCircle size={30} className="text-brand-600" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-gray-900">You're all set!</h2>
                <p className="text-gray-500 text-sm mt-1">PropFlow is now managing the routine so you don't have to.</p>
              </div>

              <div className="bg-gray-50 rounded-2xl p-4 space-y-2 text-left">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Quick reminders</p>
                <div className="flex items-start gap-2 text-sm text-gray-700"><DollarSign size={14} className="text-blue-500 flex-shrink-0 mt-0.5" /> Add your Venmo / Zelle handle in Vendors → Payment Settings so tenants can pay you</div>
                <div className="flex items-start gap-2 text-sm text-gray-700"><Wrench size={14} className="text-blue-500 flex-shrink-0 mt-0.5" /> Add your preferred vendors so we can auto-dispatch maintenance jobs</div>
                <div className="flex items-start gap-2 text-sm text-gray-700"><Building2 size={14} className="text-blue-500 flex-shrink-0 mt-0.5" /> Upload your lease documents in the Leases tab to enable AI-powered renewals</div>
              </div>

              <button onClick={handleNext} className="w-full py-3 bg-brand-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-brand-700">
                Go to Dashboard <ArrowRight size={16} />
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
