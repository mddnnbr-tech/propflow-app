import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
import SupportChat from '../components/SupportChat';

const SELLING_POINTS = [
  'Automated rent collection & late fee enforcement',
  'Tenants pay rent in seconds from their phone',
  'Maintenance dispatched automatically to vendors',
  'Tenants submit maintenance requests with a photo in seconds',
  'Automated progress notifications — you choose how you stay informed',
  'DocuSign lease renewals with one click',
  'Manage all your properties in one place, on the go',
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
    <div className="min-h-screen flex bg-black">

      {/* ── Left panel (desktop only) ── */}
      <div className="hidden lg:flex w-[52%] flex-col justify-between p-14 bg-black border-r border-neutral-900">

        {/* Wordmark */}
        <span className="text-white font-black text-2xl tracking-tight">PropFlow</span>

        {/* Hero content */}
        <div>
          <div className="space-y-5 mb-12">
            <h2 className="text-3xl font-semibold text-white leading-snug">
              Get your time back.
            </h2>
            <h2 className="text-3xl font-semibold text-white leading-snug">
              Automate your property management busy work.
            </h2>
            <h2 className="text-3xl font-semibold text-white leading-snug">
              Easy transition into light-touch management.
            </h2>
          </div>

          <div className="space-y-3">
            {SELLING_POINTS.map((point) => (
              <p key={point} className="text-neutral-400 text-base">{point}</p>
            ))}
          </div>
        </div>

        <p className="text-neutral-600 text-sm">
          © {new Date().getFullYear()} PropFlow
        </p>
      </div>

      {/* ── Right panel (form) ── */}
      <div className="flex-1 flex items-center justify-center p-6 bg-white overflow-y-auto">
        <div className="w-full max-w-sm animate-fade-up">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center mb-10">
            <span className="text-2xl font-black text-black">PropFlow</span>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-black">
              {mode === 'login' ? 'Welcome back' : 'Get started free'}
            </h1>
            <p className="text-neutral-500 mt-1 text-sm">
              {mode === 'login' ? 'Sign in to your account' : 'Create your account in 2 minutes'}
            </p>
          </div>

          {/* Mode toggle */}
          <div className="flex bg-black rounded-xl p-1 mb-6">
            {[['login', 'Sign In'], ['register', 'Create Account']].map(([m, label]) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  mode === m ? 'bg-white text-black shadow-sm' : 'text-neutral-500 hover:text-neutral-300'
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
                  className={`py-3 px-3 rounded-xl border text-sm font-semibold transition-all duration-150 ${
                    role === r
                      ? 'border-black bg-black text-white'
                      : 'border-neutral-200 text-neutral-500 hover:border-neutral-400 bg-white'
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
                  <label className="block text-xs font-semibold text-neutral-500 mb-1.5">First Name</label>
                  <input name="firstName" value={form.firstName} onChange={update} required className="w-full bg-black text-white rounded-xl px-4 py-3 text-sm placeholder-neutral-600 outline-none focus:ring-2 focus:ring-black/30" placeholder="Michael" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 mb-1.5">Last Name</label>
                  <input name="lastName" value={form.lastName} onChange={update} required className="w-full bg-black text-white rounded-xl px-4 py-3 text-sm placeholder-neutral-600 outline-none focus:ring-2 focus:ring-black/30" placeholder="Baker" />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-neutral-500 mb-1.5">Email address</label>
              <input type="email" name="email" value={form.email} onChange={update} required className="w-full bg-black text-white rounded-xl px-4 py-3 text-sm placeholder-neutral-600 outline-none focus:ring-2 focus:ring-black/30" placeholder="you@example.com" />
            </div>

            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-neutral-500 mb-1.5">Phone <span className="font-normal text-neutral-400">(optional)</span></label>
                <input type="tel" name="phone" value={form.phone} onChange={update} className="w-full bg-black text-white rounded-xl px-4 py-3 text-sm placeholder-neutral-600 outline-none focus:ring-2 focus:ring-black/30" placeholder="+1 (555) 000-0000" />
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-neutral-500">Password</label>
                {mode === 'login' && (
                  <button type="button" className="text-xs text-neutral-400 hover:text-black transition-colors">Forgot password?</button>
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
                  className="w-full bg-black text-white rounded-xl px-4 py-3 pr-10 text-sm placeholder-neutral-600 outline-none focus:ring-2 focus:ring-black/30"
                  placeholder={mode === 'register' ? 'Min. 8 characters' : '••••••••'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="w-full bg-black text-white font-bold py-3 rounded-xl text-base mt-2 hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2">
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  Please wait…
                </>
              ) : (
                <>
                  {mode === 'login' ? 'Sign In' : 'Create Account'}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-neutral-400 text-xs mt-8">
            Need help?{' '}
            <a href={`mailto:${import.meta.env.VITE_SUPPORT_EMAIL || 'support@propflow.app'}`} className="text-neutral-600 hover:text-black transition-colors">
              support@propflow.app
            </a>
          </p>
        </div>
      </div>

      <SupportChat />
    </div>
  );
}
