import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';
import api from '../api/client';
import {
  Building2, LayoutDashboard, FileText, Wrench, Users, DollarSign,
  Bell, LogOut, Menu, X, Headphones, ChevronRight,
} from 'lucide-react';
import NotificationPanel from './NotificationPanel';
import ManagerOnboarding from './ManagerOnboarding';
import SupportChat from './SupportChat';

const navItems = [
  { to: '/manager',                  label: 'Dashboard',        icon: LayoutDashboard, end: true },
  { to: '/manager/properties',       label: 'Properties',       icon: Building2 },
  { to: '/manager/leases',           label: 'Leases',           icon: FileText },
  { to: '/manager/maintenance',      label: 'Maintenance',      icon: Wrench },
  { to: '/manager/vendors',          label: 'Vendors',          icon: Users },
  { to: '/manager/finances',         label: 'Finances',         icon: DollarSign },
  { to: '/manager/managed-services', label: 'Managed Services', icon: Headphones },
];

export default function ManagerLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem('manager_onboarded'));

  const unreadCount = notifications.filter((n) => !n.read).length;
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
    localStorage.setItem('manager_onboarded', '1');
    setShowOnboarding(false);
  }
  function handleLogout() { logout(); navigate('/login'); }

  return (
    <div className="flex h-screen bg-surface overflow-hidden">
      {showOnboarding && <ManagerOnboarding onComplete={handleOnboardingComplete} />}
      {showNotifications && (
        <NotificationPanel
          notifications={notifications}
          onClose={() => setShowNotifications(false)}
          onMarkRead={handleMarkRead}
          onMarkAllRead={handleMarkAllRead}
        />
      )}

      {/* ── Sidebar ── */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-60 bg-sidebar-gradient flex flex-col
        transform transition-transform duration-300 ease-in-out
        md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Brand */}
        <div className="px-5 py-6 flex items-center gap-3">
          <div className="w-9 h-9 bg-brand-gradient rounded-xl flex items-center justify-center shadow-lg shadow-brand-900/40 flex-shrink-0">
            <Building2 size={18} className="text-white" />
          </div>
          <div>
            <p className="font-black text-white text-sm tracking-tight leading-none">PropFlow</p>
            <p className="text-slate-500 text-[10px] mt-0.5 font-medium">Manager Portal</p>
          </div>
        </div>

        {/* Divider */}
        <div className="mx-5 h-px bg-white/5 mb-3" />

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={17} className={isActive ? 'text-brand-400' : 'text-slate-500 group-hover:text-slate-300'} />
                  <span className="flex-1">{label}</span>
                  {isActive && <ChevronRight size={13} className="text-brand-400 opacity-60" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Divider */}
        <div className="mx-5 h-px bg-white/5 mt-3 mb-3" />

        {/* User card */}
        <div className="px-3 pb-5">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors group">
            <div className="w-8 h-8 bg-brand-gradient rounded-full flex items-center justify-center text-xs font-black text-white flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate leading-none">{user?.firstName} {user?.lastName}</p>
              <p className="text-xs text-slate-500 truncate mt-0.5">{user?.email}</p>
            </div>
            <button onClick={handleLogout} title="Sign out" className="text-slate-500 hover:text-red-400 transition-colors p-1 flex-shrink-0">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col md:ml-60 overflow-hidden">

        {/* Top bar */}
        <header className="bg-white border-b border-slate-100 px-5 py-3.5 flex items-center justify-between flex-shrink-0 shadow-[0_1px_0_rgba(0,0,0,0.04)]">
          <button className="md:hidden text-slate-500 hover:text-slate-700 p-1" onClick={() => setSidebarOpen(true)}>
            <Menu size={22} />
          </button>
          <div className="flex-1" />
          <button
            onClick={() => setShowNotifications(true)}
            className="relative p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <Bell size={19} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center leading-none">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>

      <SupportChat userRole="MANAGER" />
    </div>
  );
}
