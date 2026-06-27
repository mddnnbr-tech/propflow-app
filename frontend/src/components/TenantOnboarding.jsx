import { useState } from 'react';
import { Home, CreditCard, Bell, CheckCircle, ArrowRight, Phone } from 'lucide-react';

const STEPS = [
  {
    icon: Home,
    color: 'bg-brand-600',
    title: 'Welcome to PropFlow',
    subtitle: 'Your new home, managed simply.',
    body: 'Submit repair requests with a photo, pay rent, and sign documents — all in one place. No more phone tag with your landlord.',
    cta: "Let's Go",
  },
  {
    icon: Phone,
    color: 'bg-brand-600',
    title: 'Add Your Phone Number',
    subtitle: "We'll text you important updates about repairs and rent.",
    body: null,
    cta: 'Continue',
    form: 'phone',
  },
  {
    icon: CreditCard,
    color: 'bg-brand-600',
    title: 'Set Up Rent Payments',
    subtitle: 'Link a bank account for easy, on-time payments every month.',
    body: "You'll connect your bank securely through Plaid. It takes about 60 seconds and your credentials are never stored by PropFlow.",
    cta: 'Set Up Later',
    altCta: 'Connect Bank Now',
    altAction: 'bank',
  },
  {
    icon: Bell,
    color: 'bg-brand-600',
    title: 'Stay in the Loop',
    subtitle: 'Choose how you want to be notified.',
    body: null,
    cta: 'Done',
    form: 'notifications',
  },
  {
    icon: CheckCircle,
    color: 'bg-brand-600',
    title: "You're All Set!",
    subtitle: "You're ready to use PropFlow.",
    body: 'Need something fixed? Tap "Maintenance" and snap a photo — your property manager is notified automatically.',
    cta: 'Go to My Home',
  },
];

export default function TenantOnboarding({ onComplete, onConnectBank }) {
  const [step, setStep] = useState(0);
  const [phone, setPhone] = useState('');
  const [notifPref, setNotifPref] = useState({ email: true, sms: false });

  const current = STEPS[step];
  const Icon = current.icon;

  function handleNext() {
    if (step === STEPS.length - 1) { onComplete({ phone, notifPref }); return; }
    setStep((s) => s + 1);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-900 to-blue-900 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 pt-5 pb-1">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${i === step ? 'w-6 bg-brand-600' : i < step ? 'w-1.5 bg-brand-300' : 'w-1.5 bg-slate-200'}`} />
          ))}
        </div>

        <div className="px-7 pb-8 pt-5">
          <div className={`w-14 h-14 ${current.color} rounded-2xl flex items-center justify-center mb-5`}>
            <Icon size={26} className="text-white" />
          </div>

          <h2 className="text-2xl font-black text-gray-900 mb-1">{current.title}</h2>
          <p className="text-gray-500 text-sm mb-5">{current.subtitle}</p>

          {current.body && (
            <div className="bg-slate-50 rounded-2xl p-4 mb-6">
              <p className="text-sm text-slate-700 leading-relaxed">{current.body}</p>
            </div>
          )}

          {/* Phone form */}
          {current.form === 'phone' && (
            <div className="mb-6">
              <div className="flex items-center border-2 border-gray-200 rounded-xl overflow-hidden focus-within:border-brand-500 transition-colors">
                <span className="px-4 text-gray-500 text-sm font-medium border-r py-3">+1</span>
                <input
                  type="tel"
                  className="flex-1 px-4 py-3 text-sm focus:outline-none"
                  placeholder="(555) 000-0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <p className="text-xs text-gray-400 mt-2">Standard message rates may apply. You can change this in Settings.</p>
            </div>
          )}

          {/* Notification prefs */}
          {current.form === 'notifications' && (
            <div className="space-y-3 mb-6">
              {[
                { key: 'email', label: 'Email notifications', desc: 'Rent reminders, repair updates, lease renewals' },
                { key: 'sms', label: 'Text message (SMS)', desc: 'Urgent updates and same-day alerts' },
              ].map(({ key, label, desc }) => (
                <label key={key} className={`flex items-center justify-between p-4 rounded-2xl border-2 cursor-pointer transition-colors ${notifPref[key] ? 'border-brand-500 bg-brand-50' : 'border-gray-200'}`}>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${notifPref[key] ? 'border-brand-600 bg-brand-600' : 'border-gray-300'}`}>
                    {notifPref[key] && <div className="w-2 h-2 bg-white rounded-full" />}
                  </div>
                  <input type="checkbox" className="sr-only" checked={notifPref[key]} onChange={() => setNotifPref({ ...notifPref, [key]: !notifPref[key] })} />
                </label>
              ))}
            </div>
          )}

          {/* Bank step with two CTAs */}
          {current.altAction === 'bank' && (
            <div className="flex flex-col gap-2 mt-2">
              <button
                onClick={() => { onConnectBank?.(); setStep((s) => s + 1); }}
                className="w-full py-3 bg-brand-600 text-white font-bold rounded-xl hover:bg-brand-700 transition-colors"
              >
                {current.altCta}
              </button>
              <button
                onClick={handleNext}
                className="w-full py-3 border rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50"
              >
                {current.cta}
              </button>
            </div>
          )}

          {/* Standard CTA */}
          {!current.altAction && (
            <button
              onClick={handleNext}
              className="w-full py-3 bg-brand-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-brand-700 transition-colors"
            >
              {current.cta} {step < STEPS.length - 1 && <ArrowRight size={16} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
