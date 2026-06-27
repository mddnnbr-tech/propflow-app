import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { format, formatDistanceToNow } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  Building2, DollarSign, AlertCircle, Wrench, TrendingUp,
  RefreshCw, Send, CheckCircle, Home, Calendar, ArrowUpRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import RentRoll from '../../components/RentRoll';

const COLORS = { COMPLETED: '#16a34a', PENDING: '#eab308', PROCESSING: '#3b82f6', FAILED: '#ef4444' };
const PIE_COLORS = ['#16a34a', '#eab308', '#3b82f6', '#ef4444'];

function fmt(n) { return `$${(n || 0).toLocaleString()}`; }

export default function ManagerDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState({});
  const navigate = useNavigate();

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/dashboard/manager');
      setData(res.data);
    } finally {
      setLoading(false);
    }
  }

  async function sendRenewal(leaseId) {
    setSending((s) => ({ ...s, [leaseId]: true }));
    try {
      await api.post(`/leases/${leaseId}/send-renewal`, {
        newEndDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      });
      toast.success('Renewal sent via DocuSign!');
      load();
    } finally {
      setSending((s) => ({ ...s, [leaseId]: false }));
    }
  }

  if (loading) return <Skeleton />;
  if (!data) return null;

  const { stats, cashflowByMonth, paymentStatusCounts, expiringLeases, pastDuePayments, notifications, properties } = data;

  const pieData = Object.entries(paymentStatusCounts || {})
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Portfolio Overview</h1>
          <p className="text-sm text-slate-500 mt-0.5">{stats.totalProperties} {stats.totalProperties === 1 ? 'property' : 'properties'} · {stats.totalUnits} units total</p>
        </div>
        <button onClick={load} className="btn-ghost">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Building2 size={20} />}
          label="Occupancy"
          value={`${stats.occupancyRate}%`}
          sub={`${stats.occupiedUnits} of ${stats.totalUnits} units`}
        />
        <StatCard
          icon={<DollarSign size={20} />}
          label="Past Due"
          value={fmt(stats.pastDueTotal)}
          sub={`${stats.pastDueCount} ${stats.pastDueCount === 1 ? 'tenant' : 'tenants'}`}
          onClick={() => navigate('/manager/finances')}
        />
        <StatCard
          icon={<TrendingUp size={20} />}
          label="Collected (MTD)"
          value={fmt(stats.collectedThisMonth)}
          sub={`${fmt(stats.annualCollected)} this year`}
          onClick={() => navigate('/manager/finances')}
        />
        <StatCard
          icon={<Wrench size={20} />}
          label="Open Repairs"
          value={stats.openMaintenance}
          sub="Needs attention"
          onClick={() => navigate('/manager/maintenance')}
        />
      </div>

      {/* Annual summary strip */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-brand-gradient rounded-2xl p-5 text-white shadow-btn-primary">
          <p className="text-indigo-200 text-xs font-semibold uppercase tracking-wider">Annual Revenue (12 mo)</p>
          <p className="text-3xl font-black mt-1">{fmt(stats.annualCollected)}</p>
          <p className="text-indigo-300 text-xs mt-1">{fmt(stats.annualDue)} billed total</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Late Fee Income</p>
          <p className="stat-number">{fmt(stats.annualLateFees)}</p>
          <p className="text-slate-400 text-xs mt-1">Past 12 months</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Collection Rate</p>
          <p className="stat-number">
            {stats.annualDue > 0 ? Math.round((stats.annualCollected / stats.annualDue) * 100) : 100}%
          </p>
          <p className="text-slate-400 text-xs mt-1">Rent collected vs. billed</p>
        </div>
      </div>

      {/* Cashflow chart */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-bold text-slate-900">Monthly Cashflow</h2>
            <p className="text-xs text-slate-500 mt-0.5">Rent collected over the last 12 months</p>
          </div>
          <span className="badge-gray">12 Months</span>
        </div>
        {cashflowByMonth?.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={cashflowByMonth} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(val, name) => [fmt(val), name === 'collected' ? 'Collected' : name === 'due' ? 'Due' : 'Late Fees']}
                contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
              />
              <Bar dataKey="collected" fill="#6366f1" radius={[4, 4, 0, 0]} name="collected" />
              <Bar dataKey="lateFees" fill="#c7d2fe" radius={[4, 4, 0, 0]} name="lateFees" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">
            No payment data yet — cashflow will appear here once tenants start paying
          </div>
        )}
      </div>

      {/* Properties + payment status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Per-property breakdown */}
        <div className="lg:col-span-2 card p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold text-slate-900">Properties</h2>
            <button onClick={() => navigate('/manager/properties')} className="text-sm text-brand-600 hover:text-brand-700 flex items-center gap-1 font-medium">
              Manage <ArrowUpRight size={12} />
            </button>
          </div>
          {properties?.length === 0 ? (
            <div className="text-center py-8">
              <Home className="mx-auto text-slate-300 mb-3" size={36} />
              <p className="text-sm text-slate-500">No properties yet</p>
              <button onClick={() => navigate('/manager/properties')} className="mt-3 text-sm font-semibold text-brand-600 hover:text-brand-700">
                Add your first property →
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              {properties.map((p) => (
                <PropertyRow key={p.id} property={p} />
              ))}
            </div>
          )}
        </div>

        {/* Payment status pie */}
        <div className="card p-6">
          <h2 className="font-bold text-slate-900 mb-5">Payment Status</h2>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                    {pieData.map((entry, i) => (
                      <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val, name) => [val, name]} contentStyle={{ borderRadius: 10 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {pieData.map((entry, i) => (
                  <div key={entry.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-slate-600 text-xs">{entry.name}</span>
                    </div>
                    <span className="font-semibold text-slate-900 text-xs">{entry.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-slate-400 text-sm text-center">
              Payment data will appear here
            </div>
          )}
        </div>
      </div>

      {/* Expiring leases + past due */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-amber-500" />
              <h2 className="font-bold text-slate-900">Upcoming Renewals</h2>
            </div>
            <button onClick={() => navigate('/manager/leases')} className="text-sm text-brand-600 hover:text-brand-700 font-medium">View all</button>
          </div>
          {expiringLeases.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="mx-auto text-emerald-400 mb-2" size={28} />
              <p className="text-sm text-slate-500">No leases expiring in 60 days</p>
            </div>
          ) : (
            <div className="space-y-3">
              {expiringLeases.map((lease) => {
                const daysLeft = Math.ceil((new Date(lease.endDate) - new Date()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={lease.id} className={`p-3 rounded-xl border ${daysLeft <= 30 ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{lease.tenant.firstName} {lease.tenant.lastName}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{lease.unit.property.name} · Unit {lease.unit.unitNumber}</p>
                        <p className={`text-xs mt-1 font-medium ${daysLeft <= 30 ? 'text-red-600' : 'text-amber-600'}`}>
                          {daysLeft <= 0 ? 'Expired' : `Expires in ${daysLeft} days`} — {format(new Date(lease.endDate), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <button
                        onClick={() => sendRenewal(lease.id)}
                        disabled={sending[lease.id] || !!lease.renewalSentAt}
                        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {lease.renewalSentAt ? <><CheckCircle size={11} /> Sent</> : sending[lease.id] ? 'Sending...' : <><Send size={11} /> Renew</>}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-red-500" />
              <h2 className="font-bold text-slate-900">Past Due Rent</h2>
            </div>
            <button onClick={() => navigate('/manager/finances')} className="text-sm text-brand-600 hover:text-brand-700 font-medium">View all</button>
          </div>
          {pastDuePayments.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="mx-auto text-emerald-400 mb-2" size={28} />
              <p className="text-sm text-slate-500">All rent is current</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pastDuePayments.slice(0, 5).map((p) => {
                const daysLate = Math.floor((new Date() - new Date(p.dueDate)) / (1000 * 60 * 60 * 24));
                return (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-red-50 border border-red-100 rounded-xl">
                    <div>
                      <p className="font-semibold text-sm">{p.tenant.firstName} {p.tenant.lastName}</p>
                      <p className="text-xs text-slate-500">{p.lease.unit.property.name} · {format(new Date(p.dueDate), 'MMM d')}</p>
                      <p className="text-xs text-red-500 mt-0.5">{daysLate} {daysLate === 1 ? 'day' : 'days'} late</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-red-600">${p.amount.toLocaleString()}</p>
                    </div>
                  </div>
                );
              })}
              {pastDuePayments.length > 5 && (
                <p className="text-xs text-center text-slate-400">+{pastDuePayments.length - 5} more past due</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Rent Roll */}
      <RentRoll />

      {/* Recent activity */}
      {notifications?.length > 0 && (
        <div className="card p-6">
          <h2 className="font-bold text-slate-900 mb-4">Recent Activity</h2>
          <div className="space-y-2">
            {notifications.slice(0, 6).map((n) => (
              <div key={n.id} className={`flex items-start gap-3 p-3 rounded-xl ${n.read ? 'bg-slate-50' : 'bg-brand-50 border border-brand-100'}`}>
                <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${n.read ? 'bg-slate-300' : 'bg-brand-500'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">{n.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">{n.message}</p>
                </div>
                <span className="text-xs text-slate-400 flex-shrink-0 whitespace-nowrap">{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PropertyRow({ property }) {
  const pct = property.occupancyRate;
  const barColor = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-400' : 'bg-red-500';
  return (
    <div className="table-row rounded-xl">
      <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
        <Home size={16} className="text-slate-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate text-slate-900">{property.name}</p>
        <p className="text-xs text-slate-500 truncate">{property.city}, {property.state}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-xs font-semibold text-slate-600">{property.occupiedUnits}/{property.totalUnits} occupied</p>
        <div className="w-24 h-1.5 bg-slate-100 rounded-full mt-1.5">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="text-right flex-shrink-0 w-20">
        <p className="text-xs text-slate-400">Rent/mo</p>
        <p className="text-sm font-bold text-slate-800">${(property.monthlyRentPotential || 0).toLocaleString()}</p>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`stat-card ${onClick ? 'cursor-pointer hover:shadow-card-hover transition-shadow' : ''}`}
    >
      <div className="inline-flex p-2.5 rounded-xl bg-slate-100 text-slate-500 mb-3">{icon}</div>
      <p className="stat-number">{value}</p>
      <p className="stat-label mt-1">{label}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-gray-200 rounded-lg" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-gray-200 rounded-2xl" />)}
      </div>
      <div className="h-72 bg-gray-200 rounded-2xl" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-64 bg-gray-200 rounded-2xl" />
        <div className="h-64 bg-gray-200 rounded-2xl" />
      </div>
    </div>
  );
}
