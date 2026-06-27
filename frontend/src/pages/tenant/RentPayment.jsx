import { useState, useEffect, useCallback } from 'react';
import { maybeRequestReview } from '../../hooks/useAppReview';
import { usePlaidLink } from 'react-plaid-link';
import api from '../../api/client';
import toast from 'react-hot-toast';
import {
  Building, Camera, Shield, Lock, Eye, AlertCircle, Plus, Trash2,
  CheckCircle, RefreshCw, Smartphone, Zap, CreditCard, ToggleLeft, ToggleRight,
} from 'lucide-react';

const TABS = [
  { id: 'bank', label: 'Bank Transfer', icon: Building, desc: 'Free ACH via Plaid' },
  { id: 'manual', label: 'Enter Routing #', icon: CreditCard, desc: 'Type routing + account' },
  { id: 'apple', label: 'Apple Pay', icon: Smartphone, desc: 'Pay with Face ID' },
  { id: 'venmo', label: 'Venmo / Zelle', icon: Zap, desc: 'Instant transfer' },
  { id: 'check', label: 'Check', icon: Camera, desc: 'Photo deposit' },
];

export default function TenantRentPayment() {
  const [tab, setTab] = useState('bank');
  const [lease, setLease] = useState(null);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [linkToken, setLinkToken] = useState(null);
  const [paying, setPaying] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [instantPayInfo, setInstantPayInfo] = useState(null);

  // Manual ACH state
  const [manualRouting, setManualRouting] = useState('');
  const [manualAccount, setManualAccount] = useState('');
  const [manualConfirm, setManualConfirm] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualBank, setManualBank] = useState('');
  const [savingManual, setSavingManual] = useState(false);

  // Venmo/Zelle state
  const [venmoMethod, setVenmoMethod] = useState('VENMO');
  const [venmoConfId, setVenmoConfId] = useState('');
  const [venmoScreenshot, setVenmoScreenshot] = useState(null);
  const [submittingVenmo, setSubmittingVenmo] = useState(false);
  const [venmoSent, setVenmoSent] = useState(false);

  // Check state
  const [checkFront, setCheckFront] = useState(null);
  const [checkBack, setCheckBack] = useState(null);
  const [checkFrontPreview, setCheckFrontPreview] = useState(null);
  const [checkBackPreview, setCheckBackPreview] = useState(null);
  const [submittingCheck, setSubmittingCheck] = useState(false);
  const [checkResult, setCheckResult] = useState(null);
  const [checkAmountOverride, setCheckAmountOverride] = useState('');

  useEffect(() => {
    api.get('/dashboard/tenant').then((r) => {
      setLease(r.data.lease);
      setBankAccounts(r.data.bankAccounts || []);
      if (r.data.bankAccounts?.length > 0) {
        const def = r.data.bankAccounts.find((a) => a.isDefault) || r.data.bankAccounts[0];
        setSelectedAccount(def?.id || '');
      }
    });
    api.post('/payments/plaid/link-token').then((r) => setLinkToken(r.data.linkToken)).catch(() => {});
    api.get('/payments/instant-pay-info').then((r) => setInstantPayInfo(r.data)).catch(() => {});
  }, []);

  // Plaid
  const onPlaidSuccess = useCallback(async (publicToken, metadata) => {
    try {
      const res = await api.post('/payments/plaid/exchange', { publicToken, metadata });
      toast.success(`${res.data.bankAccount.institutionName} account linked!`);
      const acct = { ...res.data.bankAccount, autopay: false };
      setBankAccounts((prev) => [...prev, acct]);
      setSelectedAccount(res.data.bankAccount.id);
    } catch { toast.error('Failed to link account'); }
  }, []);

  const { open: openPlaid, ready: plaidReady } = usePlaidLink({ token: linkToken, onSuccess: onPlaidSuccess });

  async function removeAccount(id) {
    if (!confirm('Remove this bank account?')) return;
    await api.delete(`/payments/bank-accounts/${id}`);
    setBankAccounts((prev) => prev.filter((a) => a.id !== id));
    if (selectedAccount === id) setSelectedAccount('');
    toast.success('Account removed');
  }

  async function toggleAutopay(account) {
    const newState = !account.autopay;
    try {
      await api.patch(`/payments/bank-accounts/${account.id}/autopay`, { enabled: newState });
      setBankAccounts((prev) => prev.map((a) => a.id === account.id ? { ...a, autopay: newState } : { ...a, autopay: false }));
      toast.success(newState ? `Autopay enabled — ${account.institutionName} will be charged on the ${dueOrdinal(lease?.rentDueDay || 1)} each month` : 'Autopay disabled');
    } catch { toast.error('Failed to update autopay'); }
  }

  async function payACH() {
    if (!selectedAccount) return toast.error('Select a bank account');
    setPaying(true);
    try {
      const amount = payAmount ? Number(payAmount) : lease.rentAmount;
      await api.post('/payments/ach', { bankAccountId: selectedAccount, amount });
      toast.success('Payment initiated! Processing in 1-3 business days.');
      setPayAmount('');
      maybeRequestReview('ach-payment');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Payment failed');
    } finally {
      setPaying(false);
    }
  }

  async function saveManualBank() {
    if (!manualRouting || !manualAccount || !manualName) return toast.error('Fill in all required fields');
    if (manualAccount !== manualConfirm) return toast.error('Account numbers do not match');
    setSavingManual(true);
    try {
      const res = await api.post('/payments/bank-accounts/manual', {
        routingNumber: manualRouting,
        accountNumber: manualAccount,
        accountName: manualName,
        institutionName: manualBank,
      });
      toast.success('Bank account saved!');
      setBankAccounts((prev) => [...prev, { ...res.data.bankAccount, autopay: false }]);
      setSelectedAccount(res.data.bankAccount.id);
      setTab('bank');
      setManualRouting(''); setManualAccount(''); setManualConfirm(''); setManualName(''); setManualBank('');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to save account');
    } finally {
      setSavingManual(false);
    }
  }

  async function submitVenmo() {
    setSubmittingVenmo(true);
    try {
      const fd = new FormData();
      fd.append('method', venmoMethod);
      fd.append('amount', payAmount || lease.rentAmount);
      if (venmoConfId) fd.append('confirmationId', venmoConfId);
      if (venmoScreenshot) fd.append('screenshot', venmoScreenshot);
      await api.post('/payments/venmo-confirm', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setVenmoSent(true);
      toast.success('Payment submitted! Your manager will verify and confirm.');
    } catch { toast.error('Submission failed'); } finally {
      setSubmittingVenmo(false);
    }
  }

  function handleFileSelect(side, file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      if (side === 'front') { setCheckFront(file); setCheckFrontPreview(e.target.result); }
      else { setCheckBack(file); setCheckBackPreview(e.target.result); }
    };
    reader.readAsDataURL(file);
  }

  async function submitCheck() {
    if (!checkFront || !checkBack) return toast.error('Upload both front and back of the check');
    setSubmittingCheck(true);
    try {
      const fd = new FormData();
      fd.append('front', checkFront);
      fd.append('back', checkBack);
      if (checkAmountOverride) fd.append('notes', `Amount override: $${checkAmountOverride}`);
      const res = await api.post('/payments/check', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setCheckResult(res.data.checkData);
      toast.success('Check submitted! Your landlord will confirm receipt.');
    } finally {
      setSubmittingCheck(false);
    }
  }

  const dueOrdinal = (n) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  if (!lease) return <div className="text-center py-16 text-gray-500">No active lease found.</div>;

  const rentDueDay = lease.rentDueDay || 1;
  const activeAutopayAccount = bankAccounts.find((a) => a.autopay);

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold">Pay Rent</h2>

      {/* Amount card */}
      <div className="bg-brand-gradient rounded-2xl p-5 text-white">
        <p className="text-indigo-200 text-sm">Amount Due</p>
        <p className="text-3xl font-bold mt-1">${lease.rentAmount.toLocaleString()}</p>
        <div className="flex items-center justify-between mt-1">
          <p className="text-indigo-200 text-xs">Due on the {dueOrdinal(rentDueDay)} of each month</p>
          {activeAutopayAccount && (
            <span className="bg-green-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
              <RefreshCw size={10} /> Autopay ON
            </span>
          )}
        </div>
      </div>

      {/* Autopay banner if enabled */}
      {activeAutopayAccount && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-3 text-sm">
          <CheckCircle size={18} className="text-green-600 flex-shrink-0" />
          <p className="text-green-700">Autopay active — <strong>{activeAutopayAccount.institutionName} ••••{activeAutopayAccount.accountMask}</strong> will be charged on the {dueOrdinal(rentDueDay)} each month.</p>
        </div>
      )}

      {/* Payment method tabs */}
      <div className="overflow-x-auto pb-1">
        <div className="flex gap-2 min-w-max">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex flex-col items-center px-4 py-3 rounded-xl border-2 transition-all min-w-[90px] ${tab === t.id ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-100 bg-white text-gray-500 hover:border-gray-200'}`}
              >
                <Icon size={18} className="mb-1" />
                <span className="text-xs font-semibold text-center leading-tight">{t.label}</span>
                <span className="text-[10px] text-center leading-tight opacity-70 mt-0.5">{t.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Bank Transfer (Plaid) ── */}
      {tab === 'bank' && (
        <div className="space-y-4">
          <TrustBar />
          <div className="bg-white rounded-2xl border p-5 space-y-4">
            <p className="font-semibold text-sm">Linked Bank Accounts</p>
            {bankAccounts.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No bank accounts linked yet.</p>
            ) : (
              <div className="space-y-2">
                {bankAccounts.map((account) => (
                  <div key={account.id} className={`rounded-xl border-2 p-3 transition-colors ${selectedAccount === account.id ? 'border-brand-500 bg-brand-50' : 'border-gray-100'}`}>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="radio" className="hidden" name="account" value={account.id} checked={selectedAccount === account.id} onChange={() => setSelectedAccount(account.id)} />
                      <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center text-sm font-bold text-gray-700 flex-shrink-0">
                        {account.institutionName?.[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{account.institutionName}</p>
                        <p className="text-xs text-gray-500">{account.accountName} ····{account.accountMask} {account.manualEntry ? '(manual entry)' : ''}</p>
                      </div>
                      <button type="button" onClick={(e) => { e.preventDefault(); removeAccount(account.id); }} className="text-gray-300 hover:text-red-400 p-1">
                        <Trash2 size={14} />
                      </button>
                    </label>
                    {selectedAccount === account.id && (
                      <button
                        type="button"
                        onClick={() => toggleAutopay(account)}
                        className="mt-2 ml-12 flex items-center gap-2 text-xs font-medium text-gray-600 hover:text-brand-600"
                      >
                        {account.autopay
                          ? <><ToggleRight size={18} className="text-brand-500" /> Autopay ON — tap to disable</>
                          : <><ToggleLeft size={18} className="text-gray-400" /> Enable Autopay (charge on {dueOrdinal(rentDueDay)})</>}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => openPlaid()}
              disabled={!plaidReady || !linkToken}
              className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-brand-300 hover:text-brand-600 transition-colors disabled:opacity-40"
            >
              <Plus size={16} /> Link Bank via Plaid (instant verification)
            </button>
          </div>

          <AmountInput payAmount={payAmount} setPayAmount={setPayAmount} lease={lease} />

          <button onClick={payACH} disabled={!selectedAccount || paying} className="w-full py-4 bg-brand-600 text-white font-bold rounded-2xl text-lg disabled:opacity-50 hover:bg-brand-700 transition-colors">
            {paying ? 'Processing...' : `Pay $${payAmount || lease.rentAmount.toLocaleString()} via Bank Transfer`}
          </button>
          <p className="text-xs text-center text-gray-400">ACH transfers process in 1-3 business days. No fees.</p>
        </div>
      )}

      {/* ── Manual Routing + Account ── */}
      {tab === 'manual' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800">
            <p className="font-semibold mb-1">Where to find your routing and account numbers</p>
            <p>They're on the bottom of a check or in your bank's mobile app under "Account details." Routing number is 9 digits.</p>
          </div>
          <div className="bg-white rounded-2xl border p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Bank Name <span className="text-gray-400">(optional)</span></label>
              <input className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="e.g. Chase, Wells Fargo" value={manualBank} onChange={(e) => setManualBank(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Account Name *</label>
              <input className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="e.g. Checking, Savings" value={manualName} onChange={(e) => setManualName(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Routing Number * <span className="text-gray-400">(9 digits)</span></label>
              <input
                className="w-full px-3 py-2 border rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="021000021"
                maxLength={9}
                value={manualRouting}
                onChange={(e) => setManualRouting(e.target.value.replace(/\D/g, ''))}
              />
              {manualRouting && manualRouting.length !== 9 && <p className="text-xs text-red-500 mt-1">Must be exactly 9 digits</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Account Number *</label>
              <input
                className="w-full px-3 py-2 border rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Enter account number"
                type="password"
                value={manualAccount}
                onChange={(e) => setManualAccount(e.target.value.replace(/\D/g, ''))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Confirm Account Number *</label>
              <input
                className={`w-full px-3 py-2 border rounded-xl text-sm font-mono focus:outline-none focus:ring-2 ${manualConfirm && manualAccount !== manualConfirm ? 'border-red-400 focus:ring-red-400' : 'focus:ring-brand-500'}`}
                placeholder="Re-enter account number"
                value={manualConfirm}
                onChange={(e) => setManualConfirm(e.target.value.replace(/\D/g, ''))}
              />
              {manualConfirm && manualAccount !== manualConfirm && <p className="text-xs text-red-500 mt-1">Account numbers do not match</p>}
            </div>
          </div>
          <button
            onClick={saveManualBank}
            disabled={savingManual || !manualRouting || !manualAccount || !manualName || manualAccount !== manualConfirm || manualRouting.length !== 9}
            className="w-full py-4 bg-brand-600 text-white font-bold rounded-2xl disabled:opacity-50 hover:bg-brand-700 transition-colors"
          >
            {savingManual ? 'Saving...' : 'Save & Pay via Bank Transfer'}
          </button>
          <p className="text-xs text-center text-gray-400">Your account details are encrypted and stored securely. We never share them.</p>
        </div>
      )}

      {/* ── Apple Pay / Card ── */}
      {tab === 'apple' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border p-6 text-center space-y-4">
            <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center mx-auto">
              <Smartphone size={28} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-lg">Apple Pay</p>
              <p className="text-sm text-gray-500 mt-1">Pay instantly with Face ID or Touch ID — no card number entry needed</p>
            </div>
            <AmountInput payAmount={payAmount} setPayAmount={setPayAmount} lease={lease} />
            <ApplePayButton amount={Number(payAmount) || lease.rentAmount} lease={lease} onSuccess={() => toast.success('Payment complete!')} />
            <p className="text-xs text-gray-400">Also supports Google Pay and standard card payments. Processed securely by Stripe.</p>
          </div>
        </div>
      )}

      {/* ── Venmo / Zelle ── */}
      {tab === 'venmo' && (
        <div className="space-y-4">
          {venmoSent ? (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center space-y-3">
              <CheckCircle size={32} className="text-green-500 mx-auto" />
              <p className="font-bold text-green-800">Payment Submitted!</p>
              <p className="text-sm text-green-700">Your manager has been notified and will verify your payment. Once confirmed it will appear in your payment history.</p>
              <button onClick={() => setVenmoSent(false)} className="text-sm text-green-700 underline">Submit another</button>
            </div>
          ) : (
            <>
              {/* Method toggle */}
              <div className="flex rounded-xl bg-gray-100 p-1">
                {['VENMO', 'ZELLE'].map((m) => (
                  <button key={m} onClick={() => setVenmoMethod(m)} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${venmoMethod === m ? 'bg-white shadow' : 'text-gray-500'}`}>
                    {m === 'VENMO' ? '💜 Venmo' : '🟡 Zelle'}
                  </button>
                ))}
              </div>

              {/* Manager info */}
              {instantPayInfo && (venmoMethod === 'VENMO' ? instantPayInfo.venmoHandle : instantPayInfo.zelleInfo) ? (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-center">
                  <p className="text-sm text-slate-500 font-medium mb-1">Send payment to</p>
                  <p className="text-xl font-bold text-slate-900">
                    {venmoMethod === 'VENMO' ? `@${instantPayInfo.venmoHandle}` : instantPayInfo.zelleInfo}
                  </p>
                  <p className="text-xs text-slate-500 mt-2">
                    Send exactly <strong>${Number(payAmount) || lease.rentAmount}</strong> with your unit number in the note
                  </p>
                </div>
              ) : (
                <div className="bg-gray-50 border border-dashed border-gray-200 rounded-2xl p-5 text-center">
                  <p className="text-sm text-gray-500">Your property manager hasn't set up {venmoMethod === 'VENMO' ? 'Venmo' : 'Zelle'} yet.</p>
                  <p className="text-xs text-gray-400 mt-1">Contact them directly or use Bank Transfer.</p>
                </div>
              )}

              <AmountInput payAmount={payAmount} setPayAmount={setPayAmount} lease={lease} />

              <div className="bg-white rounded-2xl border p-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Confirmation ID / Transaction # <span className="text-gray-400">(optional but recommended)</span></label>
                  <input
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="e.g. 1234567890"
                    value={venmoConfId}
                    onChange={(e) => setVenmoConfId(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Screenshot of confirmation <span className="text-gray-400">(optional)</span></label>
                  <label className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${venmoScreenshot ? 'border-brand-300 bg-brand-50' : 'border-gray-200 hover:border-brand-300'}`}>
                    <Camera size={16} className="text-gray-400" />
                    <span className="text-sm text-gray-500">{venmoScreenshot ? venmoScreenshot.name : 'Upload screenshot'}</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => setVenmoScreenshot(e.target.files?.[0])} />
                  </label>
                </div>
              </div>

              <button
                onClick={submitVenmo}
                disabled={submittingVenmo || (!instantPayInfo?.venmoHandle && !instantPayInfo?.zelleInfo)}
                className="w-full py-4 bg-brand-600 text-white font-bold rounded-2xl disabled:opacity-50 hover:bg-brand-700 transition-colors"
              >
                {submittingVenmo ? 'Submitting...' : `I've Sent $${Number(payAmount) || lease.rentAmount} via ${venmoMethod === 'VENMO' ? 'Venmo' : 'Zelle'}`}
              </button>
              <p className="text-xs text-center text-gray-400">After you tap this, your manager will be notified to verify the payment in their bank app.</p>
            </>
          )}
        </div>
      )}

      {/* ── Check Deposit ── */}
      {tab === 'check' && (
        <div className="space-y-4">
          {checkResult ? (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle size={20} />
                <p className="font-bold">Check Submitted Successfully!</p>
              </div>
              <div className="text-sm text-green-800 space-y-1">
                <p>Amount: <strong>${checkResult.amount?.toLocaleString()}</strong></p>
                {checkResult.payer && <p>Payer: {checkResult.payer}</p>}
                {checkResult.checkNumber && <p>Check #: {checkResult.checkNumber}</p>}
              </div>
              <button onClick={() => { setCheckResult(null); setCheckFront(null); setCheckBack(null); setCheckFrontPreview(null); setCheckBackPreview(null); setCheckAmountOverride(''); }} className="text-sm text-green-700 underline">Submit another</button>
            </div>
          ) : (
            <>
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
                <p className="text-sm font-semibold text-amber-800">How to deposit a check</p>
                <ol className="text-xs text-amber-700 space-y-1 list-decimal list-inside">
                  <li>Make check payable to your landlord/property manager</li>
                  <li>Write your unit number in the memo line</li>
                  <li>Sign the back of the check (endorse it)</li>
                  <li>Take clear, flat photos of front and back in good lighting</li>
                </ol>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <CheckUpload side="Front" preview={checkFrontPreview} onSelect={(f) => handleFileSelect('front', f)} label="Check Front" />
                <CheckUpload side="Back" preview={checkBackPreview} onSelect={(f) => handleFileSelect('back', f)} label="Endorsed Back" />
              </div>

              <div className="bg-white rounded-2xl border p-4">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Amount on Check <span className="text-gray-400 font-normal">(override if AI misreads)</span>
                </label>
                <div className="flex items-center border rounded-xl overflow-hidden">
                  <span className="px-3 py-2 text-sm text-gray-400 bg-gray-50 border-r">$</span>
                  <input type="number" min="1" step="0.01" placeholder={lease.rentAmount.toLocaleString()} className="flex-1 px-3 py-2 text-sm focus:outline-none" value={checkAmountOverride} onChange={(e) => setCheckAmountOverride(e.target.value)} />
                </div>
                <p className="text-xs text-gray-400 mt-1">Our AI reads the amount automatically. Only fill this if needed.</p>
              </div>

              {(!checkFront || !checkBack) && (
                <div className="flex items-center gap-2 text-xs text-gray-400 px-1">
                  <AlertCircle size={12} />
                  <span>Both front and back photos are required</span>
                </div>
              )}

              <button onClick={submitCheck} disabled={!checkFront || !checkBack || submittingCheck} className="w-full py-4 bg-brand-600 text-white font-bold rounded-2xl disabled:opacity-50 hover:bg-brand-700 transition-colors">
                {submittingCheck ? 'Reading check with AI...' : 'Submit Check Payment'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──

function TrustBar() {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-semibold text-slate-500">Secured by Plaid</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <TrustPill icon={<Lock size={12} />} text="256-bit encryption" />
        <TrustPill icon={<Shield size={12} />} text="Bank-grade security" />
        <TrustPill icon={<Eye size={12} />} text="We never store credentials" />
      </div>
      <p className="text-xs text-slate-500 mt-2.5">Your bank login is entered directly with Plaid — PropFlow never sees your username or password.</p>
    </div>
  );
}

function TrustPill({ icon, text }) {
  return (
    <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2 py-1.5">
      <span className="text-slate-400">{icon}</span>
      <span className="text-xs text-slate-600 font-medium leading-tight">{text}</span>
    </div>
  );
}

function AmountInput({ payAmount, setPayAmount, lease }) {
  return (
    <div className="bg-white rounded-2xl border p-4">
      <label className="block text-xs font-medium text-gray-700 mb-1">Payment Amount</label>
      <div className="flex items-center border rounded-xl overflow-hidden">
        <span className="px-3 py-2 text-sm text-gray-400 bg-gray-50 border-r">$</span>
        <input type="number" min="1" step="0.01" placeholder={lease.rentAmount.toLocaleString()} className="flex-1 px-3 py-2 text-sm focus:outline-none" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
      </div>
      <p className="text-xs text-gray-400 mt-1">Leave blank to pay full rent of ${lease.rentAmount.toLocaleString()}</p>
    </div>
  );
}

function ApplePayButton({ amount, lease, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [clientSecret, setClientSecret] = useState(null);
  const [error, setError] = useState(null);

  async function initStripe() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/payments/stripe/create-intent', { amount });
      setClientSecret(res.data.clientSecret);

      // Use Stripe Payment Request API for Apple Pay
      const { loadStripe } = await import('@stripe/stripe-js');
      const stripe = await loadStripe(res.data.publishableKey || import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');
      if (!stripe) { setError('Stripe not configured'); return; }

      const paymentRequest = stripe.paymentRequest({
        country: 'US',
        currency: 'usd',
        total: { label: 'Monthly Rent', amount: Math.round(amount * 100) },
        requestPayerName: true,
        requestPayerEmail: false,
      });

      const canMake = await paymentRequest.canMakePayment();
      if (!canMake) {
        setError('Apple Pay is not available on this device/browser. Please use a different payment method.');
        setLoading(false);
        return;
      }

      paymentRequest.on('paymentmethod', async (ev) => {
        const { error: confirmError } = await stripe.confirmCardPayment(res.data.clientSecret, {
          payment_method: ev.paymentMethod.id,
        }, { handleActions: false });

        if (confirmError) {
          ev.complete('fail');
          setError(confirmError.message);
        } else {
          ev.complete('success');
          await api.post('/payments/stripe/confirm', { intentId: confirmError?.payment_intent?.id, amount });
          onSuccess();
        }
      });

      paymentRequest.show();
    } catch (e) {
      setError(e.response?.data?.error || 'Payment setup failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-xs text-red-500 text-center">{error}</p>}
      <button
        onClick={initStripe}
        disabled={loading}
        className="w-full py-4 bg-black text-white font-bold rounded-2xl text-lg disabled:opacity-50 hover:bg-gray-900 transition-colors flex items-center justify-center gap-3"
      >
        {loading ? <RefreshCw size={20} className="animate-spin" /> : <Smartphone size={20} />}
        {loading ? 'Setting up...' : ' Pay'}
      </button>
    </div>
  );
}

function CheckUpload({ side, preview, onSelect, label }) {
  return (
    <label className="cursor-pointer">
      <p className="text-xs font-medium text-gray-700 mb-1">{label}</p>
      <div className={`aspect-video rounded-xl border-2 overflow-hidden flex items-center justify-center transition-colors ${preview ? 'border-brand-300' : 'border-dashed border-gray-200 hover:border-brand-300'}`}>
        {preview ? <img src={preview} alt={side} className="w-full h-full object-cover" /> : (
          <div className="flex flex-col items-center gap-1 text-gray-400 p-4 text-center">
            <Camera size={24} />
            <span className="text-xs">Tap to upload {side}</span>
          </div>
        )}
      </div>
      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onSelect(e.target.files?.[0])} />
    </label>
  );
}
