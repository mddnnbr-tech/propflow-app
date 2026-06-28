import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { format, differenceInDays } from 'date-fns';
import { CreditCard, Wrench, FileText, Bell, CheckCircle, AlertCircle, ArrowRight, Zap } from 'lucide-react';

export default function TenantHome() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/dashboard/tenant').then((r) => setData(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-52 bg-slate-200 rounded-3xl" />
      <div className="grid grid-cols-3 gap-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-slate-200 rounded-2xl" />)}</div>
      <div className="h-32 bg-slate-200 rounded-2xl" />
    </div>
  );

  const { lease, notifications, openMaintenance } = data || {};
  const daysUntilEnd = lease ? differenceInDays(new Date(lease.endDate), new Date()) : null;
  const lastPayment = lease?.payments?.[0];
  const isOverdue = lastPayment && lastPayment.status !== 'COMPLETED' && new Date(lastPayment.dueDate) < new Date();

  return (
    <div className="space-y-4">

      {/* ── Rent hero card ── */}
      {lease ? (
        <div className="relative overflow-hidden rounded-3xl bg-brand-gradient p-6 text-white shadow-[0_8px_32px_rgba(79,70,229,.35)]">
          {/* Decorative circles */}
          <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/5 rounded-full" />
          <div className="absolute -bottom-12 -right-4 w-52 h-52 bg-white/5 rounded-full" />

          <div className="relative z-10">
            <p className="text-indigo-200 text-xs font-semibold">{lease.unit.property.name} · Unit {lease.unit.unitNumber}</p>
            <p className="text-indigo-300 text-[11px] mt-0.5">{lease.unit.property.address}</p>

            <div className="mt-5 flex items-baseline gap-1">
              <span className="text-5xl font-black tracking-tight">${lease.rentAmount.toLocaleString()}</span>
              <span className="text-indigo-300 text-base">/mo</span>
            </div>

            {isOverdue ? (
              <div className="mt-3 flex items-center gap-2 bg-red-500/25 border border-red-400/30 px-3 py-2 rounded-xl text-sm">
                <AlertCircle size={14} className="flex-shrink-0" />
                <span className="font-semibold">Rent is overdue — pay now to avoid a late fee</span>
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-2 text-indigo-300 text-sm">
                <Zap size={13} />
                <span>Due on the {lease.rentDueDay || 1}st of each month</span>
              </div>
            )}

            <button
              onClick={() => navigate('/tenant/pay')}
              className="w-full mt-5 bg-white text-brand-700 font-black py-3.5 rounded-2xl hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2 text-sm shadow-lg"
            >
              Pay Rent <ArrowRight size={15} />
            </button>
          </div>
        </div>
      ) : (
        <div className="card p-6 text-center">
          <p className="text-slate-500 text-sm">No active lease found. Contact your property manager.</p>
        </div>
      )}

      {/* ── Quick actions ── */}
      <div className="grid grid-cols-3 gap-3">
        <QuickAction icon={<CreditCard size={20} />} label="Pay Rent"    onClick={() => navigate('/tenant/pay')}         badge={isOverdue ? '!' : null} />
        <QuickAction icon={<Wrench size={20} />}     label="Maintenance" onClick={() => navigate('/tenant/maintenance')} badge={openMaintenance > 0 ? openMaintenance : null} />
        <QuickAction icon={<FileText size={20} />}   label="My Lease"    onClick={() => navigate('/tenant/lease')} />
      </div>

      {/* ── Lease expiry warning ── */}
      {daysUntilEnd !== null && daysUntilEnd <= 60 && daysUntilEnd > 0 && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200/70 rounded-2xl">
          <AlertCircle className="text-amber-500 flex-shrink-0 mt-0.5" size={17} />
          <div>
            <p className="font-bold text-amber-800 text-sm">Lease Expiring Soon</p>
            <p className="text-amber-700 text-xs mt-0.5">
              Your lease expires {format(new Date(lease.endDate), 'MMMM d, yyyy')} ({daysUntilEnd} days). Check your email for renewal options.
            </p>
          </div>
        </div>
      )}

      {/* ── Recent payments ── */}
      {lease?.payments?.length > 0 && (
        <div className="card p-4">
          <p className="font-bold text-sm text-slate-900 mb-3">Recent Payments</p>
          <div className="space-y-1">
            {lease.payments.slice(0, 4).map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2 px-1">
                <div className="flex items-center gap-2.5">
                  {p.status === 'COMPLETED'
                    ? <CheckCircle size={14} className="text-emerald-500" />
                    : <AlertCircle size={14} className="text-amber-400" />}
                  <span className="text-sm text-slate-600">{format(new Date(p.dueDate), 'MMMM yyyy')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">${p.amount.toLocaleString()}</span>
                  <span className={p.status === 'COMPLETED' ? 'badge-green' : 'badge-amber'}>
                    {p.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Unread notifications ── */}
      {notifications?.filter((n) => !n.read).length > 0 && (
        <div className="card p-4">
          <p className="font-bold text-sm text-slate-900 mb-3 flex items-center gap-2">
            <Bell size={14} className="text-slate-400" /> Updates
          </p>
          <div className="space-y-1">
            {notifications.filter((n) => !n.read).slice(0, 3).map((n) => (
              <div key={n.id} className="py-2.5 px-1 border-b border-slate-50 last:border-0">
                <p className="font-semibold text-slate-800 text-sm">{n.title}</p>
                <p className="text-slate-500 text-xs mt-0.5">{n.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function QuickAction({ icon, label, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      className="relative flex flex-col items-center justify-center gap-2 py-4 px-2 bg-white border border-slate-100 rounded-2xl hover:border-slate-200 hover:shadow-card-hover transition-all duration-150"
    >
      {badge && (
        <span className="absolute top-2 right-2 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">
          {badge}
        </span>
      )}
      <span className="text-slate-500">{icon}</span>
      <span className="text-xs font-semibold text-slate-600">{label}</span>
    </button>
  );
}
