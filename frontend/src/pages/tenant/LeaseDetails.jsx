import { useState, useEffect } from 'react';
import api from '../../api/client';
import { format, differenceInDays } from 'date-fns';
import { FileText, Calendar, DollarSign, Home, AlertCircle, CheckCircle } from 'lucide-react';

export default function TenantLeaseDetails() {
  const [lease, setLease] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/leases/my').then((r) => setLease(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="space-y-4 animate-pulse">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-200 rounded-2xl" />)}</div>;
  if (!lease) return <div className="text-center py-16 text-gray-500">No lease found. Contact your property manager.</div>;

  const daysLeft = differenceInDays(new Date(lease.endDate), new Date());
  const progress = Math.max(0, Math.min(100, (1 - daysLeft / differenceInDays(new Date(lease.endDate), new Date(lease.startDate))) * 100));

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold">My Lease</h2>

      {/* Property card */}
      <div className="bg-white rounded-2xl border p-5 flex items-start gap-4">
        <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <Home className="text-slate-500" size={22} />
        </div>
        <div>
          <p className="font-bold text-lg">{lease.unit.property.name}</p>
          <p className="text-gray-600">Unit {lease.unit.unitNumber}</p>
          <p className="text-sm text-gray-500">{lease.unit.property.address}, {lease.unit.property.city}, {lease.unit.property.state}</p>
        </div>
      </div>

      {/* Expiry warning */}
      {daysLeft <= 60 && daysLeft > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle className="text-yellow-600 flex-shrink-0 mt-0.5" size={18} />
          <div>
            <p className="font-semibold text-yellow-800 text-sm">Lease Expiring in {daysLeft} Days</p>
            <p className="text-yellow-700 text-xs mt-0.5">Check your email for a renewal agreement from your landlord, or contact them to discuss renewal terms.</p>
          </div>
        </div>
      )}

      {daysLeft <= 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={18} />
          <div>
            <p className="font-semibold text-red-800 text-sm">Lease Has Expired</p>
            <p className="text-red-700 text-xs mt-0.5">Please contact your property manager immediately to renew or make other arrangements.</p>
          </div>
        </div>
      )}

      {/* Lease progress */}
      <div className="bg-white rounded-2xl border p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold text-sm">Lease Term</p>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${lease.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
            {lease.status.replace('_', ' ')}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
          <span>{format(new Date(lease.startDate), 'MMM d, yyyy')}</span>
          <span>{daysLeft > 0 ? `${daysLeft} days left` : 'Expired'}</span>
          <span>{format(new Date(lease.endDate), 'MMM d, yyyy')}</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div className="bg-brand-600 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Key details */}
      <div className="bg-white rounded-2xl border divide-y">
        <LeaseRow icon={<DollarSign size={16} className="text-slate-400" />} label="Monthly Rent" value={`$${lease.rentAmount.toLocaleString()}`} />
        <LeaseRow icon={<DollarSign size={16} className="text-slate-400" />} label="Security Deposit" value={`$${lease.depositAmount.toLocaleString()}`} />
        <LeaseRow icon={<Calendar size={16} className="text-slate-400" />} label="Lease Start" value={format(new Date(lease.startDate), 'MMMM d, yyyy')} />
        <LeaseRow icon={<Calendar size={16} className="text-slate-400" />} label="Lease End" value={format(new Date(lease.endDate), 'MMMM d, yyyy')} />
        <LeaseRow icon={<CheckCircle size={16} className="text-slate-400" />} label="Auto-Renew" value={lease.autoRenew ? 'Enabled' : 'Disabled'} />
      </div>

      {/* AI-extracted terms */}
      {lease.terms && (
        <div className="bg-white rounded-2xl border p-5">
          <p className="font-semibold text-sm mb-3 flex items-center gap-2">
            <FileText size={16} className="text-slate-400" /> AI-Extracted Lease Terms
          </p>
          <div className="space-y-2 text-sm">
            {lease.terms.lateFee && (
              <p className="text-gray-700">Late Fee: <strong>${lease.terms.lateFee}</strong> after {lease.terms.lateFeeGraceDays || 5} day grace period</p>
            )}
            {lease.terms.utilitiesIncluded?.length > 0 && (
              <p className="text-gray-700">Utilities Included: <strong>{lease.terms.utilitiesIncluded.join(', ')}</strong></p>
            )}
            {lease.terms.petPolicy && (
              <p className="text-gray-700">Pet Policy: {lease.terms.petPolicy}</p>
            )}
            {lease.terms.keyTerms?.map((term, i) => (
              <p key={i} className="text-gray-600 text-xs p-2 bg-gray-50 rounded-lg">• {term}</p>
            ))}
          </div>
        </div>
      )}

      {/* Lease document */}
      {lease.documentUrl && (
        <a href={lease.documentUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 bg-white rounded-2xl border hover:border-blue-300 transition-colors">
          <FileText className="text-slate-400" size={20} />
          <div>
            <p className="font-medium text-sm">View Lease Document</p>
            <p className="text-xs text-gray-500">Opens in new tab</p>
          </div>
        </a>
      )}
    </div>
  );
}

function LeaseRow({ icon, label, value }) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5">
      <div className="flex items-center gap-2 text-gray-600 text-sm">
        {icon} {label}
      </div>
      <p className="font-semibold text-sm text-gray-900">{value}</p>
    </div>
  );
}
