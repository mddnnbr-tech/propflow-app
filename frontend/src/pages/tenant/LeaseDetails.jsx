import { useState, useEffect } from 'react';
import api from '../../api/client';
import { format, differenceInDays } from 'date-fns';
import { AlertCircle } from 'lucide-react';

export default function TenantLeaseDetails() {
  const [lease, setLease] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/leases/my').then((r) => setLease(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-slate-100 rounded-2xl" />)}
    </div>
  );
  if (!lease) return (
    <div className="text-center py-16 text-slate-400">
      <p className="text-sm">No lease on file. Contact your property manager.</p>
    </div>
  );

  const daysLeft = differenceInDays(new Date(lease.endDate), new Date());
  const totalDays = differenceInDays(new Date(lease.endDate), new Date(lease.startDate));
  const progress = Math.max(0, Math.min(100, (1 - daysLeft / totalDays) * 100));
  const initial = lease.unit.property.name?.[0]?.toUpperCase() || 'P';

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-900">My Lease</h2>

      {/* Property card — letter avatar, no icon box */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-brand-gradient flex items-center justify-center flex-shrink-0 shadow-btn-primary">
          <span className="text-white font-black text-xl leading-none">{initial}</span>
        </div>
        <div>
          <p className="font-bold text-slate-900">{lease.unit.property.name}</p>
          <p className="text-sm text-slate-500">Unit {lease.unit.unitNumber}</p>
          <p className="text-xs text-slate-400 mt-0.5">{lease.unit.property.address}, {lease.unit.property.city}, {lease.unit.property.state}</p>
        </div>
      </div>

      {/* Expiry alerts */}
      {daysLeft <= 60 && daysLeft > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle className="text-amber-500 flex-shrink-0 mt-0.5" size={16} />
          <div>
            <p className="font-semibold text-amber-800 text-sm">Lease expires in {daysLeft} days</p>
            <p className="text-amber-700 text-xs mt-0.5">Check your email for a renewal offer, or contact your landlord.</p>
          </div>
        </div>
      )}
      {daysLeft <= 0 && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={16} />
          <div>
            <p className="font-semibold text-red-800 text-sm">Lease has expired</p>
            <p className="text-red-700 text-xs mt-0.5">Contact your property manager immediately.</p>
          </div>
        </div>
      )}

      {/* Lease term card — solid status pill, clean progress */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="font-semibold text-sm text-slate-900">Lease Term</p>
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
            lease.status === 'ACTIVE'
              ? 'bg-emerald-500 text-white'
              : lease.status === 'PENDING'
              ? 'bg-amber-400 text-white'
              : 'bg-slate-400 text-white'
          }`}>
            {lease.status}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
          <span>{format(new Date(lease.startDate), 'MMM d, yyyy')}</span>
          <span className="font-medium text-slate-600">{daysLeft > 0 ? `${daysLeft} days left` : 'Expired'}</span>
          <span>{format(new Date(lease.endDate), 'MMM d, yyyy')}</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-1.5">
          <div className="bg-brand-600 h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Key details — clean rows, no icon boxes */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <LeaseRow label="Monthly Rent" value={`$${lease.rentAmount.toLocaleString()}`} highlight />
        <LeaseRow label="Security Deposit" value={`$${lease.depositAmount.toLocaleString()}`} />
        <LeaseRow label="Lease Start" value={format(new Date(lease.startDate), 'MMMM d, yyyy')} />
        <LeaseRow label="Lease End" value={format(new Date(lease.endDate), 'MMMM d, yyyy')} />
        <LeaseRow label="Auto-Renew" value={lease.autoRenew ? 'Enabled' : 'Disabled'} last />
      </div>

      {/* AI-extracted terms */}
      {lease.terms && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Extracted Lease Terms</p>
          {lease.terms.lateFee && (
            <p className="text-sm text-slate-700">
              Late fee: <span className="font-semibold">${lease.terms.lateFee}</span>
              {lease.terms.lateFeeGraceDays ? ` after ${lease.terms.lateFeeGraceDays}-day grace period` : ''}
            </p>
          )}
          {lease.terms.utilitiesIncluded?.length > 0 && (
            <p className="text-sm text-slate-700">
              Utilities included: <span className="font-semibold">{lease.terms.utilitiesIncluded.join(', ')}</span>
            </p>
          )}
          {lease.terms.petPolicy && (
            <p className="text-sm text-slate-700">Pets: {lease.terms.petPolicy}</p>
          )}
          {lease.terms.keyTerms?.map((term, i) => (
            <p key={i} className="text-xs text-slate-500 pl-3 border-l-2 border-slate-100">{term}</p>
          ))}
        </div>
      )}

      {/* Lease document */}
      {lease.documentUrl && (
        <a
          href={lease.documentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 hover:border-brand-200 transition-colors group"
        >
          <div>
            <p className="font-medium text-sm text-slate-900">View Lease Document</p>
            <p className="text-xs text-slate-400 mt-0.5">Opens in new tab</p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center group-hover:bg-brand-50 transition-colors">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2.5 7H11.5M11.5 7L8 3.5M11.5 7L8 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 group-hover:text-brand-600"/>
            </svg>
          </div>
        </a>
      )}
    </div>
  );
}

function LeaseRow({ label, value, highlight, last }) {
  return (
    <div className={`flex items-center justify-between px-5 py-3.5 ${!last ? 'border-b border-slate-50' : ''}`}>
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`text-sm font-semibold ${highlight ? 'text-slate-900 text-base' : 'text-slate-900'}`}>{value}</p>
    </div>
  );
}
