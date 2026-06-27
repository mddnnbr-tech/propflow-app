import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Home, CreditCard, Wrench, FileText, LogOut, Bell } from 'lucide-react';
import { useState, useEffect } from 'react';
import api from '../api/client';
import NotificationPanel from './NotificationPanel';
import TenantOnboarding from './TenantOnboarding';
import SupportChat from './SupportChat';

const navItems = [
  { to: '/tenant',              label: 'Home',        icon: Home,       end: true },
  { to: '/tenant/pay',          label: 'Pay Rent',    icon: CreditCard },
  { to: '/tenant/maintenance',  label: 'Maintenance', icon: Wrench },
  { to: '/tenant/lease',        label: 'My Lease',    icon: FileText },
];

export default function TenantLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem('tenant_onboarded'));

  const unread = notifications.filter((n) => !n.read).length;
  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`;

  useEffect(() => {
    api.get('/notifications').then((res) => setNotifications(res.data)).catch(() => {});
  }, []);

  function handleMarkRead(id) {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  }
  async function handleMarkAllRead() {
    try { await api.put('/notifications/read-all'); } catch {}
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }
  function handleOnboardingComplete() {
    localStorage.setItem('tenant_onboarded', '1');
    setShowOnboarding(false);
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {showOnboarding && <TenantOnboarding onComplete={handleOnboardingComplete} />}
      {showNotifications && (
        <NotificationPanel
          notifications={notifications}
          onClose={() => setShowNotifications(false)}
          onMarkRead={handleMarkRead}
          onMarkAllRead={handleMarkAllRead}
        />
      )}

      {/* Header */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-10 shadow-[0_1px_0_rgba(0,0,0,0.04)]">
        <div className="max-w-lg mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-brand-gradient rounded-full flex items-center justify-center text-xs font-black text-white">
              {initials}
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-medium leading-none">Welcome back</p>
              <p className="font-bold text-slate-900 text-sm leading-tight mt-0.5">{user?.firstName} {user?.lastName}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setShowNotifications(true)} className="relative p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">
              <Bell size={19} />
              {unread > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">
                  {unread}
                </span>
              )}
            </button>
            <button onClick={() => { logout(); navigate('/login'); }} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-5">
        <Outlet />
      </main>

      <SupportChat userRole="TENANT" />

      {/* Bottom nav */}
      <nav className="bg-white border-t border-slate-100 sticky bottom-0 shadow-[0_-1px_0_rgba(0,0,0,0.04)]">
        <div className="max-w-lg mx-auto flex">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center py-3 gap-1 text-[11px] font-semibold transition-colors ${
                  isActive ? 'text-brand-600' : 'text-slate-400 hover:text-slate-600'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`p-1.5 rounded-xl transition-colors ${isActive ? 'bg-brand-50' : ''}`}>
                    <Icon size={19} />
                  </div>
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
