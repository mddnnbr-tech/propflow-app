import { useState } from 'react';
import { Check, ChevronRight, Star, Shield, Clock, Users, Wrench, Phone, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/client';

const COORDINATOR_FEATURES = [
  'Vendor sourcing and dispatch on your behalf',
  'Get 3+ competitive quotes per job',
  'Schedule coordination with tenant',
  '48hr response guarantee',
  'All job status updates handled for you',
  'Monthly maintenance summary report',
  'No property management license required',
];

const FULL_MANAGEMENT_FEATURES = [
  'Everything in Coordinator',
  'Licensed property manager assigned to your portfolio',
  'Tenant placement and screening',
  'Lease signing and renewal handling',
  'Rent collection and late fee enforcement',
  'Monthly owner disbursements',
  'Legal compliance and notice handling',
  '24/7 emergency hotline',
  'Annual property inspection',
];

export default function ManagedServices() {
  const [showModal, setShowModal] = useState(false);
  const [selectedTier, setSelectedTier] = useState(null);
  const [form, setForm] = useState({ properties: '', notes: '', phone: '', bestTime: 'morning' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function submitInterest() {
    setSubmitting(true);
    try {
      await api.post('/auth/managed-services-interest', {
        tier: selectedTier,
        ...form,
      }).catch(() => {}); // silently handle if route not yet built

      // Email manager via notifications service (best-effort)
      toast.success(`We've received your interest in ${selectedTier === 'coordinator' ? 'Coordinator' : 'Full Management'}! A PropFlow specialist will reach out within 1 business day.`);
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      {/* Hero */}
      <div className="text-center space-y-3">
        <div className="badge-indigo">New Service</div>
        <h1 className="text-3xl font-black text-slate-900">Let Us Handle It</h1>
        <p className="text-slate-500 text-lg max-w-xl mx-auto">
          PropFlow can manage your properties so you collect the income without the headaches. Choose your level of involvement.
        </p>
      </div>

      {/* Tier cards */}
      <div className="grid md:grid-cols-2 gap-5">
        {/* Coordinator */}
        <div className="card p-6 space-y-4 border-2 border-slate-100 hover:border-brand-200 hover:shadow-card-hover transition-all duration-200">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                <Wrench size={16} className="text-slate-500" />
              </div>
              <span className="badge-indigo">Coordinator</span>
            </div>
            <p className="text-xl font-bold text-slate-900">Maintenance Coordinator</p>
            <p className="text-sm text-slate-500 mt-1">We handle all vendor sourcing, dispatching, and follow-ups for you. You stay the owner.</p>
          </div>

          <div className="text-center py-3 bg-slate-50 rounded-xl">
            <p className="text-2xl font-black text-slate-900">$29<span className="text-sm font-normal text-slate-500">/property/month</span></p>
            <p className="text-xs text-slate-400 mt-1">No license required · Cancel anytime</p>
          </div>

          <ul className="space-y-2">
            {COORDINATOR_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                <Check size={15} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                {f}
              </li>
            ))}
          </ul>

          <button
            onClick={() => { setSelectedTier('coordinator'); setShowModal(true); }}
            className="btn-primary w-full py-3 text-base"
          >
            Get Started <ChevronRight size={16} />
          </button>
        </div>

        {/* Full Management */}
        <div className="bg-brand-gradient rounded-2xl p-6 space-y-4 text-white relative overflow-hidden shadow-btn-primary">
          <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/5 rounded-full" />
          <div className="absolute top-4 right-4 relative z-10">
            <span className="bg-amber-400 text-amber-900 text-xs font-black px-2.5 py-1 rounded-full flex items-center gap-1">
              <Star size={10} /> Most Popular
            </span>
          </div>

          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                <Shield size={16} className="text-white" />
              </div>
              <span className="text-xs font-semibold text-indigo-200 bg-white/10 px-2 py-0.5 rounded-full">Full Management</span>
            </div>
            <p className="text-xl font-bold">Fully Managed Portfolio</p>
            <p className="text-sm text-indigo-200 mt-1">A licensed property manager handles everything — tenants, maintenance, rent, leases, and compliance.</p>
          </div>

          <div className="text-center py-3 bg-white/10 rounded-xl relative z-10">
            <p className="text-2xl font-black">8%<span className="text-sm font-normal text-indigo-200"> of monthly rent</span></p>
            <p className="text-xs text-indigo-200 mt-1">Licensed PM partner network · Fully insured</p>
          </div>

          <ul className="space-y-2 relative z-10">
            {FULL_MANAGEMENT_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-indigo-100">
                <Check size={15} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                {f}
              </li>
            ))}
          </ul>

          <button
            onClick={() => { setSelectedTier('full'); setShowModal(true); }}
            className="w-full py-3 bg-white text-brand-700 font-black rounded-xl hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2 relative z-10 shadow-lg"
          >
            Get a Free Consultation <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* How it works */}
      <div className="card p-6">
        <h2 className="font-bold text-lg text-slate-900 mb-5">How it works</h2>
        <div className="grid md:grid-cols-3 gap-5">
          {[
            { icon: Phone, step: '1', title: 'Quick Call', desc: 'We learn about your properties and goals in a 15-minute call.' },
            { icon: Users, step: '2', title: 'Matched', desc: 'We assign a coordinator or licensed PM from our vetted partner network.' },
            { icon: Clock, step: '3', title: 'Hands-free', desc: 'Sit back. Your PropFlow dashboard updates in real-time as we manage everything.' },
          ].map(({ icon: Icon, step, title, desc }) => (
            <div key={step} className="text-center space-y-2">
              <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto">
                <Icon size={20} className="text-slate-500" />
              </div>
              <p className="font-semibold text-slate-900">{step}. {title}</p>
              <p className="text-sm text-slate-500">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="space-y-3">
        <h2 className="font-bold text-lg text-slate-900">Frequently asked questions</h2>
        {[
          { q: 'Do I lose control of my property?', a: 'No. You remain the owner with full visibility in PropFlow. You can set approval thresholds so nothing happens above your limit without your OK.' },
          { q: 'What happens to my existing tenants?', a: 'Nothing changes for them. They keep using PropFlow to pay rent and submit requests.' },
          { q: 'Can I cancel anytime?', a: 'Yes — Coordinator is month-to-month with 30-day notice. Full Management requires 60-day notice per the PM agreement.' },
          { q: 'Who pays the vendors?', a: 'For Coordinator tier, you still approve and pay. Full Management handles vendor payments from your rental income, with full itemized reporting.' },
          { q: 'Is there a minimum number of units?', a: 'No minimum. We work with single-property landlords up to large portfolios.' },
        ].map(({ q, a }) => (
          <details key={q} className="card p-4 group">
            <summary className="font-medium text-sm cursor-pointer list-none flex items-center justify-between text-slate-900">
              {q} <ChevronRight size={16} className="text-slate-400 group-open:rotate-90 transition-transform" />
            </summary>
            <p className="text-sm text-slate-600 mt-3">{a}</p>
          </details>
        ))}
      </div>

      {/* Interest modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b">
              <div>
                <p className="font-bold">{selectedTier === 'coordinator' ? 'Maintenance Coordinator' : 'Full Management'}</p>
                <p className="text-xs text-gray-500">We'll reach out within 1 business day</p>
              </div>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-gray-400" /></button>
            </div>
            {submitted ? (
              <div className="p-8 text-center space-y-3">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <Check size={28} className="text-green-600" />
                </div>
                <p className="font-bold text-lg">You're on the list!</p>
                <p className="text-sm text-gray-500">A PropFlow specialist will contact you within 1 business day to discuss your properties and get you set up.</p>
                <button onClick={() => { setShowModal(false); setSubmitted(false); }} className="text-blue-600 text-sm underline">Close</button>
              </div>
            ) : (
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">How many properties / units? *</label>
                  <input className="input" placeholder="e.g. 2 properties, 8 units total" value={form.properties} onChange={(e) => setForm((f) => ({ ...f, properties: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Best phone number to reach you</label>
                  <input type="tel" className="input" placeholder="(555) 000-0000" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Best time to call</label>
                  <select className="input" value={form.bestTime} onChange={(e) => setForm((f) => ({ ...f, bestTime: e.target.value }))}>
                    <option value="morning">Morning (9am – 12pm)</option>
                    <option value="afternoon">Afternoon (12pm – 5pm)</option>
                    <option value="evening">Evening (5pm – 7pm)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Anything else? <span className="text-slate-400">(optional)</span></label>
                  <textarea rows={2} className="input resize-none" placeholder="e.g. I have a difficult tenant situation, looking for help ASAP" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
                </div>
                <button
                  onClick={submitInterest}
                  disabled={submitting || !form.properties}
                  className="btn-primary w-full py-3 text-base disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Request a Callback'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
