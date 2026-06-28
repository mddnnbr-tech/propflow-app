import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Building2, Eye, EyeOff, Check, ArrowRight } from 'lucide-react';
import SupportChat from '../components/SupportChat';

const FEATURES = [
  'Automated rent collection & late fee enforcement',
  'Maintenance dispatch — photo to vendor in minutes',
  'DocuSign lease renewals with one click',
  'Manage all your properties in one place, on the go',
  'Real-time tenant & vendor communication',
];

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [role, setRole] = useState('TENANT');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '', phone: '' });

  function update(e) { setForm((f) => ({ ...f, [e.target.name]: e.target.value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      let user;
      if (mode === 'login') {
        user = await login(form.email, form.password);
      } else {
        user = await register({ ...form, role });
      }
      toast.success(mode === 'login' ? 'Welcome back!' : 'Account created!');
      navigate(user.role === 'MANAGER' ? '/manager' : '/tenant', { replace: true });
    } catch {
      // handled by axios interceptor
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">

      {/* ── Left panel (desktop only) ── */}
      <div className="hidden lg:flex w-[52%] bg-hero-gradient flex-col justify-between p-12 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-10 h-10 bg-brand-gradient rounded-xl flex items-center justify-center shadow-lg shadow-brand-900/40">
            <Building2 size={20} className="text-white" />
          </div>
          <span className="text-white font-black text-xl tracking-tight">PropFlow</span>
        </div>

        {/* Hero content */}
        <div className="space-y-8 relative z-10">
          <div>
            <h2 className="text-5xl font-black text-white leading-tight">
              Get your time back.<br />
              <span className="text-gradient">Run less. Own more.</span>
            </h2>
            <p className="text-slate-400 text-lg mt-4 leading-relaxed max-w-md">
              Automate your property management busy work and make the easy transition into light-touch management — without needing to be tech-savvy.
            </p>
          </div>

          {/* Feature list */}
          <div className="space-y-3">
            {FEATURES.map((f) => (
              <div key={f} className="flex items-center gap-3">
                <Check size={14} className="text-emerald-400 flex-shrink-0" />
                <span className="text-slate-300 text-sm">{f}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-slate-600 text-xs relative z-10">
          © {new Date().getFullYear()} PropFlow. All rights reserved.
        </p>
      </div>

      {/* ── Right panel (form) ── */}
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-50 overflow-y-auto">
        <div className="w-full max-w-sm animate-fade-up">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-10">
            <div className="w-10 h-10 bg-brand-gradient rounded-xl flex items-center justify-center">
              <Building2 size={20} className="text-white" />
            </div>
            <span className="text-2xl font-black text-slate-900">PropFlow</span>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-2xl font-black text-slate-900">
              {mode === 'login' ? 'Welcome back' : 'Get started free'}
            </h1>
            <p className="text-slate-500 mt-1 text-sm">
              {mode === 'login' ? 'Sign in to your dashboard' : 'Create your account in 2 minutes'}
            </p>
          </div>

          {/* Mode toggle */}
          <div className="flex bg-slate-200/70 rounded-xl p-1 mb-6">
            {[['login', 'Sign In'], ['register', 'Create Account']].map(([m, label]) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  mode === m ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Role picker */}
          {mode === 'register' && (
            <div className="grid grid-cols-2 gap-2 mb-5">
              {[['TENANT', 'Tenant / Renter'], ['MANAGER', 'Property Manager']].map(([r, label]) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`py-3 px-3 rounded-xl border-2 text-sm font-semibold transition-all duration-150 ${
                    role === r
                      ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-glow'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300 bg-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">First Name</label>
                  <input name="firstName" value={form.firstName} onChange={update} required className="input" placeholder="Michael" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Last Name</label>
                  <input name="lastName" value={form.lastName} onChange={update} required className="input" placeholder="Baker" />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email address</label>
              <input type="email" name="email" value={form.email} onChange={update} required className="input" placeholder="you@example.com" />
            </div>

            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Phone <span className="font-normal text-slate-400">(optional)</span></label>
                <input type="tel" name="phone" value={form.phone} onChange={update} className="input" placeholder="+1 (555) 000-0000" />
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-600">Password</label>
                {mode === 'login' && (
                  <button type="button" className="text-xs text-brand-600 hover:text-brand-700 font-medium">Forgot password?</button>
                )}
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={form.password}
                  onChange={update}
                  required
                  minLength={8}
                  className="input pr-10"
                  placeholder={mode === 'register' ? 'Min. 8 characters' : '••••••••'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base mt-2">
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Please wait…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  {mode === 'login' ? 'Sign In' : 'Create Account'}
                  <ArrowRight size={16} />
                </span>
              )}
            </button>
          </form>

          <p className="text-center text-slate-400 text-xs mt-8">
            Need help?{' '}
            <a href={`mailto:${import.meta.env.VITE_SUPPORT_EMAIL || 'support@propflow.app'}`} className="text-brand-600 hover:text-brand-700 font-medium">
              {import.meta.env.VITE_SUPPORT_EMAIL || 'support@propflow.app'}
            </a>
          </p>
        </div>
      </div>

      <SupportChat />
    </div>
  );
}
