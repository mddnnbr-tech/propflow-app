import { useState, useEffect } from 'react';
import api from '../../api/client';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import {
  DollarSign, CheckCircle, Clock, XCircle, Plus, X, TrendingUp,
  TrendingDown, Home, Sparkles, ChevronDown, ChevronUp, Pencil, Trash2,
} from 'lucide-react';

function fmt(n) { return `$${(n || 0).toLocaleString()}`; }
function fmtPct(n) { return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`; }

const EXPENSE_CATEGORIES = [
  { key: 'MORTGAGE',         label: 'Mortgage',         color: '#3b82f6', emoji: '🏠' },
  { key: 'INSURANCE',        label: 'Insurance',         color: '#8b5cf6', emoji: '🛡️' },
  { key: 'PROPERTY_TAX',     label: 'Property Tax',      color: '#f59e0b', emoji: '📋' },
  { key: 'REPAIR',           label: 'Repairs',           color: '#ef4444', emoji: '🔧' },
  { key: 'CAPEX',            label: 'Capital Expense',   color: '#dc2626', emoji: '🏗️' },
  { key: 'MANAGEMENT_FEE',   label: 'Mgmt Fee',          color: '#6366f1', emoji: '💼' },
  { key: 'UTILITIES',        label: 'Utilities',         color: '#06b6d4', emoji: '⚡' },
  { key: 'HOA',              label: 'HOA',               color: '#10b981', emoji: '🏘️' },
  { key: 'LANDSCAPING',      label: 'Landscaping',       color: '#84cc16', emoji: '🌿' },
  { key: 'ADVERTISING',      label: 'Advertising',       color: '#f97316', emoji: '📣' },
  { key: 'LEGAL_ACCOUNTING', label: 'Legal / CPA',       color: '#64748b', emoji: '⚖️' },
  { key: 'OTHER',            label: 'Other',             color: '#94a3b8', emoji: '📦' },
];

const CAT_MAP = Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c.key, c]));

const STATUS_ICONS = {
  COMPLETED: <CheckCircle size={13} className="text-green-500" />,
  PROCESSING: <Clock size={13} className="text-blue-400" />,
  PENDING:    <Clock size={13} className="text-yellow-500" />,
  FAILED:     <XCircle size={13} className="text-red-500" />,
};
const METHOD_LABELS = { ACH: 'Bank Transfer', CHECK: 'Check', CARD: 'Card', MANUAL: 'Manual' };

export default function ManagerFinances() {
  const [tab, setTab] = useState('pnl');          // 'pnl' | 'expenses' | 'payments'
  const [view, setView] = useState('monthly');     // 'monthly' | 'annual'
  const [pnl, setPnl] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [payments, setPayments] = useState([]);
  const [properties, setProperties] = useState([]);
  const [filterPropId, setFilterPropId] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [equityProp, setEquityProp] = useState(null);
  const [researching, setResearching] = useState({});

  useEffect(() => { loadAll(); }, [view, filterPropId]);

  async function loadAll() {
    setLoading(true);
    try {
      const [pnlRes, expRes, payRes, propRes] = await Promise.all([
        api.get(`/expenses/profitability?view=${view}${filterPropId ? `&propertyId=${filterPropId}` : ''}`),
        api.get(`/expenses${filterPropId ? `?propertyId=${filterPropId}` : ''}`),
        api.get('/payments'),
        api.get('/properties'),
      ]);
      setPnl(pnlRes.data);
      setExpenses(expRes.data);
      setPayments(payRes.data);
      setProperties(propRes.data);
    } finally {
      setLoading(false);
    }
  }

  async function deleteExpense(id) {
    if (!confirm('Delete this expense?')) return;
    await api.delete(`/expenses/${id}`);
    toast.success('Expense deleted');
    loadAll();
  }

  async function researchValue(prop) {
    setResearching((r) => ({ ...r, [prop.id]: true }));
    try {
      const res = await api.post(`/expenses/research-value/${prop.id}`);
      toast.success(`Market value researched: ${fmt(res.data.estimatedValue)}`);
      loadAll();
      setEquityProp((prev) => prev?.id === prop.id ? { ...prev, ...res.data } : prev);
    } catch (err) {
      toast.error('Research failed — try again or enter manually');
    } finally {
      setResearching((r) => ({ ...r, [prop.id]: false }));
    }
  }

  const pieData = pnl
    ? Object.entries(pnl.categoryTotals || {})
        .filter(([, v]) => v > 0)
        .map(([k, v]) => ({ name: CAT_MAP[k]?.label || k, value: v, color: CAT_MAP[k]?.color || '#94a3b8' }))
    : [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Finances</h1>
          <p className="text-xs text-slate-500 mt-0.5">Income, expenses, and profitability</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="input w-auto" value={filterPropId} onChange={(e) => setFilterPropId(e.target.value)}>
            <option value="">All Properties</option>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button onClick={() => setShowAddExpense(true)} className="btn-primary">
            <Plus size={15} /> Add Expense
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {[['pnl', 'P&L Overview'], ['expenses', 'Expenses'], ['payments', 'Rent Payments']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === key ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? <LoadingSkeleton /> : (
        <>
          {/* P&L TAB */}
          {tab === 'pnl' && pnl && (
            <div className="space-y-5">
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-4">
                <SummaryCard label="Total Income" value={fmt(pnl.totals.income)} icon={<TrendingUp size={18} />} />
                <SummaryCard label="Total Expenses" value={fmt(pnl.totals.expenses)} icon={<TrendingDown size={18} />} />
                <SummaryCard
                  label="Net Profit"
                  value={fmt(pnl.totals.profit)}
                  icon={<DollarSign size={18} />}
                  sub={pnl.totals.income > 0 ? `${Math.round((pnl.totals.profit / pnl.totals.income) * 100)}% margin` : null}
                />
              </div>

              {/* View toggle + chart */}
              <div className="card p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-bold text-slate-900">Income vs. Expenses</h2>
                  <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
                    <button onClick={() => setView('monthly')} className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${view === 'monthly' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>Monthly</button>
                    <button onClick={() => setView('annual')} className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${view === 'annual' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>Annual</button>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={pnl.chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(val, name) => [fmt(val), name === 'income' ? 'Rent Income' : name === 'expenses' ? 'Expenses' : 'Late Fees']}
                      contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }}
                    />
                    <Bar dataKey="income" fill="#16a34a" radius={[4, 4, 0, 0]} name="income" stackId="a" />
                    <Bar dataKey="lateFees" fill="#f59e0b" radius={[0, 0, 0, 0]} name="lateFees" stackId="a" />
                    <Bar dataKey="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} name="expenses" />
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex gap-4 justify-center mt-3">
                  <Legend color="#16a34a" label="Rent Income" />
                  <Legend color="#f59e0b" label="Late Fees" />
                  <Legend color="#ef4444" label="Expenses" />
                </div>
              </div>

              {/* Expense breakdown + equity */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Category pie */}
                <div className="card p-5">
                  <h2 className="font-bold text-slate-900 mb-4">Expense Breakdown</h2>
                  {pieData.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={160}>
                        <PieChart>
                          <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                            {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                          </Pie>
                          <Tooltip formatter={(v) => fmt(v)} contentStyle={{ borderRadius: 10 }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-1.5 mt-3">
                        {pieData.slice(0, 6).map((entry) => (
                          <div key={entry.name} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: entry.color }} />
                              <span className="text-gray-600 text-xs">{entry.name}</span>
                            </div>
                            <span className="font-semibold text-gray-900 text-xs">{fmt(entry.value)}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No expenses logged yet</div>
                  )}
                </div>

                {/* Property equity panel */}
                <div className="card p-5 space-y-4">
                  <h2 className="font-bold text-slate-900">Property Equity & ROI</h2>
                  {properties.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">No properties</div>
                  ) : (
                    <div className="space-y-3">
                      {properties.map((prop) => (
                        <PropertyEquityCard
                          key={prop.id}
                          prop={prop}
                          onResearch={() => researchValue(prop)}
                          researching={!!researching[prop.id]}
                          onUpdate={loadAll}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Per-period profit table */}
              <div className="card overflow-hidden">
                <div className="p-5 border-b border-slate-100">
                  <h2 className="font-bold text-slate-900">Period Breakdown</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                        <th className="text-left px-5 py-3">Period</th>
                        <th className="text-right px-4 py-3">Income</th>
                        <th className="text-right px-4 py-3">Expenses</th>
                        <th className="text-right px-5 py-3">Net Profit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pnl.chartData.map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-5 py-3 font-medium text-slate-900">{row.period}</td>
                          <td className="px-4 py-3 text-right text-emerald-600 font-medium">{fmt(row.income + row.lateFees)}</td>
                          <td className="px-4 py-3 text-right text-red-500 font-medium">{fmt(row.expenses)}</td>
                          <td className={`px-5 py-3 text-right font-bold ${row.profit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{fmt(row.profit)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 font-bold text-sm">
                        <td className="px-5 py-3 text-slate-900">Total</td>
                        <td className="px-4 py-3 text-right text-emerald-700">{fmt(pnl.totals.income)}</td>
                        <td className="px-4 py-3 text-right text-red-600">{fmt(pnl.totals.expenses)}</td>
                        <td className={`px-5 py-3 text-right ${pnl.totals.profit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{fmt(pnl.totals.profit)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* EXPENSES TAB */}
          {tab === 'expenses' && (
            <div className="space-y-4">
              {expenses.length === 0 ? (
                <div className="card text-center py-16">
                  <DollarSign className="mx-auto text-slate-300 mb-2" size={36} />
                  <p className="text-slate-500 text-sm">No expenses logged yet</p>
                  <button onClick={() => setShowAddExpense(true)} className="mt-3 text-sm font-semibold text-brand-600 hover:text-brand-700">Log your first expense →</button>
                </div>
              ) : (
                <div className="card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                        <th className="text-left px-5 py-3">Category</th>
                        <th className="text-left px-4 py-3">Property</th>
                        <th className="text-left px-4 py-3">Description</th>
                        <th className="text-left px-4 py-3">Date</th>
                        <th className="text-right px-5 py-3">Amount</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {expenses.map((e) => {
                        const cat = CAT_MAP[e.category];
                        return (
                          <tr key={e.id} className="hover:bg-slate-50">
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2">
                                <span className="text-base">{cat?.emoji}</span>
                                <span className="font-medium text-slate-900">{cat?.label || e.category}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-500">{e.property?.name || '—'}</td>
                            <td className="px-4 py-3 text-slate-500 truncate max-w-xs">{e.description || '—'}</td>
                            <td className="px-4 py-3 text-slate-500">{format(new Date(e.date), 'MMM d, yyyy')}</td>
                            <td className="px-5 py-3 text-right font-bold text-red-600">{fmt(e.amount)}</td>
                            <td className="px-4 py-3">
                              <button onClick={() => deleteExpense(e.id)} className="text-slate-300 hover:text-red-400 p-1 transition-colors">
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* PAYMENTS TAB */}
          {tab === 'payments' && (
            <div className="card overflow-hidden">
              {payments.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-sm">No payments yet</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                      <th className="text-left px-5 py-3">Tenant</th>
                      <th className="text-left px-4 py-3">Property</th>
                      <th className="text-left px-4 py-3">Method</th>
                      <th className="text-left px-4 py-3">Date</th>
                      <th className="text-left px-4 py-3">Status</th>
                      <th className="text-right px-5 py-3">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payments.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3 font-medium text-slate-900">{p.tenant.firstName} {p.tenant.lastName}</td>
                        <td className="px-4 py-3 text-slate-500">{p.lease?.unit?.property?.name || '—'}</td>
                        <td className="px-4 py-3 text-slate-500">{METHOD_LABELS[p.method] || p.method}</td>
                        <td className="px-4 py-3 text-slate-500">{format(new Date(p.dueDate), 'MMM d, yyyy')}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {STATUS_ICONS[p.status]}
                            <span className="text-xs text-slate-600">{p.status}</span>
                          </div>
                        </td>
                        <td className={`px-5 py-3 text-right font-bold ${p.status === 'COMPLETED' ? 'text-emerald-600' : 'text-slate-700'}`}>{fmt(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}

      {/* Add Expense Modal */}
      {showAddExpense && (
        <AddExpenseModal
          properties={properties}
          onClose={() => setShowAddExpense(false)}
          onSaved={() => { setShowAddExpense(false); loadAll(); }}
        />
      )}
    </div>
  );
}

// ─── Add Expense Modal ────────────────────────────────────────────────────────
function AddExpenseModal({ properties, onClose, onSaved }) {
  const [step, setStep] = useState('category'); // 'category' | 'details'
  const [form, setForm] = useState({ category: '', propertyId: '', amount: '', date: new Date().toISOString().split('T')[0], description: '', isRecurring: false });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.category || !form.amount || !form.date) return toast.error('Fill required fields');
    setSaving(true);
    try {
      await api.post('/expenses', form);
      toast.success('Expense logged!');
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  const inp = 'w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-gray-900">Log Expense</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        {step === 'category' ? (
          <div className="p-5">
            <p className="text-sm text-gray-500 mb-4">What type of expense?</p>
            <div className="grid grid-cols-3 gap-2">
              {EXPENSE_CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => { setForm((f) => ({ ...f, category: cat.key })); setStep('details'); }}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 border-gray-100 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                >
                  <span className="text-2xl">{cat.emoji}</span>
                  <span className="text-xs font-medium text-gray-700 text-center leading-tight">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {/* Selected category chip */}
            <div className="flex items-center gap-2">
              <button onClick={() => setStep('category')} className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border hover:bg-gray-50">
                <span className="text-base">{CAT_MAP[form.category]?.emoji}</span>
                <span>{CAT_MAP[form.category]?.label}</span>
                <span className="text-gray-400 text-xs">change</span>
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Amount *</label>
              <div className="flex items-center border rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
                <span className="px-3 py-2 text-sm text-gray-400 bg-gray-50 border-r">$</span>
                <input
                  type="number" min="0" step="0.01" required autoFocus
                  className="flex-1 px-3 py-2 text-sm focus:outline-none"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Date *</label>
              <input type="date" className={inp} value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Property (optional)</label>
              <select className={inp} value={form.propertyId} onChange={(e) => setForm((f) => ({ ...f, propertyId: e.target.value }))}>
                <option value="">All Properties / Portfolio-wide</option>
                {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Description (optional)</label>
              <input className={inp} placeholder="e.g. Plumber visit — Unit 2A" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <div
                onClick={() => setForm((f) => ({ ...f, isRecurring: !f.isRecurring }))}
                className={`w-10 h-5 rounded-full transition-colors flex items-center ${form.isRecurring ? 'bg-brand-500' : 'bg-slate-200'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform mx-0.5 ${form.isRecurring ? 'translate-x-5' : 'translate-x-0'}`} />
              </div>
              <span className="text-sm text-gray-700">Recurring monthly expense</span>
            </label>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setStep('category')} className="flex-1 py-2.5 border rounded-xl text-sm font-medium text-gray-700">Back</button>
              <button onClick={save} disabled={saving || !form.amount} className="btn-primary flex-1 py-2.5 disabled:opacity-60">
                {saving ? 'Saving…' : 'Log Expense'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Property Equity Card ─────────────────────────────────────────────────────
function PropertyEquityCard({ prop, onResearch, researching, onUpdate }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ acquisitionCost: prop.acquisitionCost || '', acquisitionDate: prop.acquisitionDate ? prop.acquisitionDate.split('T')[0] : '', currentValue: prop.currentValue || '' });
  const [saving, setSaving] = useState(false);

  const appreciation = prop.acquisitionCost && prop.currentValue
    ? prop.currentValue - prop.acquisitionCost
    : null;
  const appreciationPct = prop.acquisitionCost && appreciation !== null
    ? (appreciation / prop.acquisitionCost) * 100
    : null;

  async function saveEquity() {
    setSaving(true);
    try {
      await api.put(`/expenses/property-equity/${prop.id}`, {
        acquisitionCost: form.acquisitionCost || null,
        acquisitionDate: form.acquisitionDate || null,
        currentValue: form.currentValue || null,
      });
      toast.success('Saved!');
      setEditing(false);
      onUpdate();
    } finally {
      setSaving(false);
    }
  }

  const inp = 'w-full px-2.5 py-1.5 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="border rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Home size={14} className="text-blue-500" />
          <span className="text-sm font-semibold text-gray-900">{prop.name}</span>
        </div>
        <div className="flex items-center gap-3">
          {prop.currentValue && (
            <span className="text-sm font-bold text-gray-900">{fmt(prop.currentValue)}</span>
          )}
          {appreciationPct !== null && (
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${appreciationPct >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
              {fmtPct(appreciationPct)}
            </span>
          )}
          {expanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t px-4 py-3 bg-gray-50 space-y-3">
          {editing ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Purchase Price ($)</label>
                  <input type="number" className={inp} placeholder="e.g. 320000" value={form.acquisitionCost} onChange={(e) => setForm((f) => ({ ...f, acquisitionCost: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Purchase Date</label>
                  <input type="date" className={inp} value={form.acquisitionDate} onChange={(e) => setForm((f) => ({ ...f, acquisitionDate: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Current Value ($) — override AI</label>
                <input type="number" className={inp} placeholder="Leave blank to use AI research" value={form.currentValue} onChange={(e) => setForm((f) => ({ ...f, currentValue: e.target.value }))} />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditing(false)} className="flex-1 py-1.5 border rounded-lg text-xs font-medium">Cancel</button>
                <button onClick={saveEquity} disabled={saving} className="flex-1 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold disabled:opacity-60">
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-gray-400">Purchased</p>
                  <p className="font-semibold text-gray-900">{prop.acquisitionCost ? fmt(prop.acquisitionCost) : '—'}</p>
                  {prop.acquisitionDate && <p className="text-gray-400">{format(new Date(prop.acquisitionDate), 'MMM d, yyyy')}</p>}
                </div>
                <div>
                  <p className="text-gray-400">
                    Current Value
                    {prop.currentValueSource && <span className="ml-1 px-1 py-0.5 rounded bg-gray-200 text-gray-500 text-[10px]">{prop.currentValueSource === 'AI_RESEARCH' ? 'AI' : 'Manual'}</span>}
                  </p>
                  <p className="font-semibold text-gray-900">{prop.currentValue ? fmt(prop.currentValue) : '—'}</p>
                  {prop.currentValueUpdatedAt && <p className="text-gray-400">as of {format(new Date(prop.currentValueUpdatedAt), 'MMM d')}</p>}
                </div>
                {appreciation !== null && (
                  <div className="col-span-2">
                    <p className="text-gray-400">Total Appreciation</p>
                    <p className={`font-bold ${appreciation >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {appreciation >= 0 ? '+' : ''}{fmt(appreciation)} ({fmtPct(appreciationPct)})
                    </p>
                  </div>
                )}
              </div>
              {prop.currentValueNotes && (
                <p className="text-xs text-gray-500 italic border-t pt-2">{prop.currentValueNotes}</p>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={onResearch}
                  disabled={researching}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-purple-50 border border-purple-200 text-purple-700 rounded-lg text-xs font-semibold hover:bg-purple-100 disabled:opacity-60 transition-colors"
                >
                  {researching ? (
                    <><div className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" /> Researching…</>
                  ) : (
                    <><Sparkles size={11} /> AI Research Value</>
                  )}
                </button>
                <button onClick={() => setEditing(true)} className="px-3 py-1.5 border rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100">
                  <Pencil size={11} />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function SummaryCard({ label, value, icon, sub }) {
  return (
    <div className="stat-card">
      <div className="inline-flex p-2.5 rounded-xl bg-slate-100 text-slate-500 mb-3">{icon}</div>
      <p className="stat-number">{value}</p>
      <p className="stat-label mt-1">{label}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function Legend({ color, label }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-500">
      <span className="w-3 h-3 rounded-sm" style={{ background: color }} />
      {label}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-3 gap-4">{[...Array(3)].map((_, i) => <div key={i} className="h-28 bg-gray-200 rounded-2xl" />)}</div>
      <div className="h-72 bg-gray-200 rounded-2xl" />
    </div>
  );
}
