import { useEffect, useRef } from 'react';
import { X, Bell, CheckCheck, Wrench, FileText, DollarSign, Info } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import api from '../api/client';

const TYPE_ICONS = {
  maintenance: { Icon: Wrench, bg: 'bg-orange-100', color: 'text-orange-600' },
  lease: { Icon: FileText, bg: 'bg-blue-100', color: 'text-blue-600' },
  payment: { Icon: DollarSign, bg: 'bg-green-100', color: 'text-green-600' },
  default: { Icon: Info, bg: 'bg-gray-100', color: 'text-gray-600' },
};

export default function NotificationPanel({ notifications, onClose, onMarkRead, onMarkAllRead }) {
  const panelRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  async function markOne(id) {
    try { await api.put(`/notifications/${id}/read`); } catch {}
    onMarkRead(id);
  }

  const unread = notifications.filter((n) => !n.read);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div ref={panelRef} className="relative w-full max-w-sm bg-white shadow-2xl flex flex-col h-full animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b bg-white sticky top-0">
          <div className="flex items-center gap-2">
            <Bell size={18} className="text-blue-600" />
            <span className="font-bold text-gray-900">Notifications</span>
            {unread.length > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{unread.length}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unread.length > 0 && (
              <button onClick={onMarkAllRead} className="flex items-center gap-1 text-xs text-blue-600 font-semibold hover:text-blue-800 transition-colors">
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center px-6">
              <Bell size={36} className="text-gray-200 mb-3" />
              <p className="font-semibold text-gray-500">All caught up!</p>
              <p className="text-sm text-gray-400 mt-1">No notifications yet. We'll let you know when something needs attention.</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((n) => {
                const { Icon, bg, color } = TYPE_ICONS[n.type] || TYPE_ICONS.default;
                return (
                  <div
                    key={n.id}
                    onClick={() => !n.read && markOne(n.id)}
                    className={`flex gap-3 px-5 py-4 cursor-pointer transition-colors hover:bg-gray-50 ${!n.read ? 'bg-blue-50/50' : ''}`}
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${bg}`}>
                      <Icon size={15} className={color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm font-semibold leading-tight ${!n.read ? 'text-gray-900' : 'text-gray-700'}`}>{n.title}</p>
                        {!n.read && <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1" />}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 leading-snug">{n.message}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
