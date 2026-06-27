import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { format } from 'date-fns';
import { CheckCircle, AlertCircle, Clock, Home, DollarSign, Send, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

const STATUS = {
  PAID:     { label: 'Paid',     color: 'bg-green-100 text-green-700',  dot: 'bg-green-500' },
  PENDING:  { label: 'Pending',  color: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' },
  OVERDUE:  { label: 'Overdue',  color: 'bg-red-100 text-red-700',      dot: 'bg-red-500' },
  UPCOMING: { label: 'Due Soon', color: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-400' },
  VACANT:   { label: 'Vacant',   color: 'bg-gray-100 text-gray-500',    dot: 'bg-gray-300' },
};

export default function RentRoll() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState({});
  const navigate = useNavigate();

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/dashboard/rent-roll');
      setData(res.data);
    } finally {
      setLoading(false);
    }
  }

  async function markPaid(leaseId, tenantName) {
    setSending((s) => ({ ...s, [leaseId]: true }));
    try {
      // Get the most recent payment for this lease to mark paid, or create one
      const res = await api.post(`/payments/manual-paid`, { leaseId });
      toast.success(`${tenantName} marked as paid`);
      load();
    } catch (err) {
      toast.error('Could not mark as paid');
    } finally {
      setSending((s) => ({ ...s, [leaseId]: false }));
    }
  }

  async function sendReminder(row) {
    setSending((s) => ({ ...s, [`rem_${row.leaseId}`]: true }));
    try {
      await api.post(`/payments/send-reminder`, { leaseId: row.leaseId });
      toast.success(`Reminder sent to ${row.tenant?.firstName}`);
    } catch {
      toast.error('Could not send reminder');
    } finally {
      setSending((s) => ({ ...s, [`rem_${row.leaseId}`]: false }));
    }
  }

  if (loading) return (
    <div className="space-y-2 animate-pulse">
      {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-gray-200 rounded-xl" />)}
    </div>
  );

  if (!data) return null;

  const { rows, summary, month } = data;

  return (
    <div className="bg-white rounded-2xl border">
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b">
        <div>
          <h2 className="font-bold text-gray-900">Rent Roll</h2>
          <p className="text-xs text-gray-500 mt-0.5">{month} · {summary.total} units</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-2 text-xs">
            <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full font-medium">{summary.paid} paid</span>
            {summary.overdue > 0 && <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full font-medium">{summary.overdue} overdue</span>}
            {summary.pending > 0 && <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full font-medium">{summary.pending} pending</span>}
          </div>
          <button onClick={load} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Collection progress */}
      <div className="px-5 py-3 border-b bg-gray-50">
        <div className="flex items-center justify-between text-xs text-gray-600 mb-1.5">
          <span className="font-medium">Collection Progress</span>
          <span className="font-bold text-gray-900">
            ${summary.totalCollected.toLocaleString()} <span className="text-gray-400 font-normal">/ ${summary.totalExpected.toLocaleString()}</span>
          </span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all duration-500"
            style={{ width: summary.totalExpected > 0 ? `${Math.min(100, (summary.totalCollected / summary.totalExpected) * 100)}%` : '0%' }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1">
          {summary.totalExpected > 0 ? Math.round((summary.totalCollected / summary.totalExpected) * 100) : 0}% collected this month
        </p>
      </div>

      {/* Rows */}
      <div className="divide-y">
        {rows.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <Home size={32} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No units yet</p>
          </div>
        ) : (
          rows.map((row, i) => {
            const st = STATUS[row.status] || STATUS.VACANT;
            return (
              <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                {/* Status dot */}
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${st.dot}`} />

                {/* Unit info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900 truncate">
                      {row.tenant ? `${row.tenant.firstName} ${row.tenant.lastName}` : `Unit ${row.unitNumber}`}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.color}`}>{st.label}</span>
                    {row.status === 'OVERDUE' && row.daysLate > 0 && (
                      <span className="text-xs text-red-500 font-medium">{row.daysLate}d late</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    {row.propertyName} · Unit {row.unitNumber}
                    {row.dueDate && row.status !== 'VACANT' && ` · Due ${format(new Date(row.dueDate), 'MMM d')}`}
                  </p>
                </div>

                {/* Amount */}
                <div className="text-right flex-shrink-0">
                  <p className={`text-sm font-bold ${row.status === 'PAID' ? 'text-green-600' : row.status === 'OVERDUE' ? 'text-red-600' : 'text-gray-900'}`}>
                    ${(row.rentAmount || 0).toLocaleString()}
                  </p>
                  {row.lateFee && row.status === 'OVERDUE' && row.daysLate > (row.graceDays || 5) && (
                    <p className="text-xs text-red-400">+${row.lateFee} fee</p>
                  )}
                </div>

                {/* Action */}
                {row.status === 'OVERDUE' && row.leaseId && (
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => sendReminder(row)}
                      disabled={sending[`rem_${row.leaseId}`]}
                      title="Send payment reminder"
                      className="p-1.5 text-orange-500 hover:bg-orange-50 rounded-lg transition-colors disabled:opacity-40"
                    >
                      <Send size={13} />
                    </button>
                    <button
                      onClick={() => markPaid(row.leaseId, `${row.tenant?.firstName} ${row.tenant?.lastName}`)}
                      disabled={sending[row.leaseId]}
                      title="Mark as paid manually"
                      className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-40"
                    >
                      <CheckCircle size={13} />
                    </button>
                  </div>
                )}
                {row.status === 'PENDING' && row.leaseId && (
                  <button
                    onClick={() => markPaid(row.leaseId, `${row.tenant?.firstName} ${row.tenant?.lastName}`)}
                    disabled={sending[row.leaseId]}
                    title="Confirm payment received"
                    className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-40 flex-shrink-0"
                  >
                    <CheckCircle size={13} />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="p-4 border-t">
        <button onClick={() => navigate('/manager/finances')} className="text-xs text-blue-600 hover:underline">
          View full payment history →
        </button>
      </div>
    </div>
  );
}
