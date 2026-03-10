import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { User, Lock, Phone, KeyRound, Eye, EyeOff, Loader2, CheckCircle2, Wheat, ShieldCheck } from 'lucide-react'
import { authApi } from '../api/client'
import { useApp } from '../contexts/AppContext'

const STATES = [
  'Maharashtra','Punjab','Haryana','Uttar Pradesh','Madhya Pradesh','Rajasthan',
  'Gujarat','Karnataka','Andhra Pradesh','Telangana','Bihar','West Bengal',
  'Tamil Nadu','Odisha','other'
]

export default function Login() {
  const { state, dispatch } = useApp()
  const navigate = useNavigate()

  // Already logged in → straight to home
  if (state.authToken && state.farmer) return <Navigate to="/" replace />

  const [tab, setTab] = useState('login')
  const [form, setForm] = useState({ name: '', phone: '', username: '', password: '', district: '', state: '', language: 'hi' })
  const [otpPhone, setOtpPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [demoOtp, setDemoOtp] = useState(null)
  const [showPw, setShowPw] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  function handleAuth(res) {
    dispatch({ type: 'SET_TOKEN', payload: res.access_token || res.token })
    dispatch({ type: 'SET_FARMER', payload: res.farmer || res.user })
    navigate('/', { replace: true })
  }

  async function submitLogin(e) {
    e.preventDefault(); setLoading(true); setError(null)
    try { handleAuth(await authApi.login(form.username, form.password)) }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function submitRegister(e) {
    e.preventDefault(); setLoading(true); setError(null)
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); setLoading(false); return }
    try {
      handleAuth(await authApi.register({
        name: form.name, phone: form.phone, username: form.username,
        password: form.password, state: form.state, district: form.district,
        language: form.language,
      }))
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function requestOtp(e) {
    e.preventDefault(); setLoading(true); setError(null)
    try {
      const res = await authApi.requestOtp(otpPhone)
      setOtpSent(true)
      if (res.demo_otp) setDemoOtp(res.demo_otp)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function verifyOtp(e) {
    e.preventDefault(); setLoading(true); setError(null)
    try { handleAuth(await authApi.verifyOtp(otpPhone, otp)) }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4 py-10">
      {/* Brand header */}
      <div className="mb-8 text-center">
        <div className="text-5xl mb-3">🌾</div>
        <h1 className="font-display text-2xl font-bold text-text-1">AgriSahayak</h1>
        <p className="text-text-3 text-sm mt-1">AI-Powered Smart Farming Assistant</p>
        <div className="flex justify-center gap-2 mt-3">
          {[['🌱','Free'], ['🤖','AI Powered'], ['📱','Multi-language']].map(([e, l]) => (
            <span key={l} className="text-xs bg-surface-2 text-text-3 px-2.5 py-1 rounded-full border border-border">{e} {l}</span>
          ))}
        </div>
      </div>

      {/* Card */}
      <div className="card p-6 w-full max-w-md">
        {/* Tab switcher */}
        <div className="flex gap-1 bg-surface-2 p-1 rounded-lg mb-5" role="tablist" aria-label="Login method">
          {[['login','Sign In'], ['register','Register'], ['otp','OTP Login']].map(([t, l]) => (
            <button key={t} role="tab" aria-selected={tab === t} aria-controls={`tab-panel-${t}`} id={`tab-btn-${t}`}
              onClick={() => { setTab(t); setError(null) }}
              className={`flex-1 py-2 rounded-md text-xs font-medium transition-colors ${tab === t ? 'bg-primary text-black' : 'text-text-3 hover:text-text-2'}`}>
              {l}
            </button>
          ))}
        </div>

        {/* ── Sign In ── */}
        {tab === 'login' && (
          <form id="tab-panel-login" role="tabpanel" aria-labelledby="tab-btn-login" onSubmit={submitLogin} className="space-y-4">
            <div>
              <label className="label" htmlFor="login-username">Username</label>
              <div className="relative">
                <User size={14} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3" />
                <input id="login-username" className="input w-full pl-9" required value={form.username} onChange={set('username')}
                  placeholder="Your username" autoComplete="username" />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="login-password">Password</label>
              <div className="relative">
                <Lock size={14} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3" />
                <input id="login-password" className="input w-full pl-9 pr-10" required type={showPw ? 'text' : 'password'}
                  value={form.password} onChange={set('password')} placeholder="Password" autoComplete="current-password"
                  aria-describedby={error ? 'login-error' : undefined} />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-text-3"
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPw(s => !s)}>
                  {showPw ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
                </button>
              </div>
            </div>
            {error && <p id="login-error" role="alert" className="text-red-400 text-sm">{error}</p>}
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? <Loader2 size={15} className="animate-spin" /> : <><ShieldCheck size={15} /> Sign In</>}
            </button>
          </form>
        )}

        {/* ── Register ── */}
        {tab === 'register' && (
          <form id="tab-panel-register" role="tabpanel" aria-labelledby="tab-btn-register" onSubmit={submitRegister} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="reg-name">Full Name</label>
                <input id="reg-name" className="input w-full" required value={form.name} onChange={set('name')} placeholder="Your full name" />
              </div>
              <div>
                <label className="label" htmlFor="reg-phone">Mobile Number</label>
                <input id="reg-phone" className="input w-full" required type="tel" pattern="[6-9][0-9]{9}"
                  value={form.phone} onChange={set('phone')} placeholder="10-digit mobile" />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="reg-username">Username</label>
              <div className="relative">
                <User size={14} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3" />
                <input id="reg-username" className="input w-full pl-9" required minLength={4} value={form.username}
                  onChange={set('username')} placeholder="Choose a username (min 4 chars)" autoComplete="username" />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="reg-password">Password</label>
              <div className="relative">
                <Lock size={14} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3" />
                <input id="reg-password" className="input w-full pl-9 pr-10" required type={showPw ? 'text' : 'password'}
                  minLength={6} value={form.password} onChange={set('password')}
                  placeholder="Min 6 characters" autoComplete="new-password" />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-text-3"
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPw(s => !s)}>
                  {showPw ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="reg-district">District</label>
                <input id="reg-district" className="input w-full" required value={form.district} onChange={set('district')} placeholder="Your district" />
              </div>
              <div>
                <label className="label" htmlFor="reg-state">State</label>
                <select id="reg-state" className="input w-full" required value={form.state} onChange={set('state')}>
                  <option value="">Select state</option>
                  {STATES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="label" htmlFor="reg-language">Preferred Language</label>
              <select id="reg-language" className="input w-full" value={form.language} onChange={set('language')}>
                <option value="hi">हिंदी (Hindi)</option>
                <option value="en">English</option>
                <option value="mr">मराठी (Marathi)</option>
                <option value="te">తెలుగు (Telugu)</option>
                <option value="ta">தமிழ் (Tamil)</option>
                <option value="kn">ಕನ್ನಡ (Kannada)</option>
              </select>
            </div>
            {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? <Loader2 size={15} className="animate-spin" /> : <><Wheat size={15} /> Create Account</>}
            </button>
          </form>
        )}

        {/* ── OTP Login ── */}
        {tab === 'otp' && (
          <div id="tab-panel-otp" role="tabpanel" aria-labelledby="tab-btn-otp" className="space-y-4">
            {!otpSent ? (
              <form onSubmit={requestOtp} className="space-y-4">
                <div>
                  <label className="label" htmlFor="otp-phone">Mobile Number</label>
                  <div className="relative">
                    <Phone size={14} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3" />
                    <input id="otp-phone" className="input w-full pl-9" required type="tel" pattern="[6-9][0-9]{9}"
                      value={otpPhone} onChange={e => setOtpPhone(e.target.value)} placeholder="10-digit mobile number" />
                  </div>
                </div>
                {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
                <button type="submit" className="btn-primary w-full" disabled={loading}>
                  {loading ? <Loader2 size={15} className="animate-spin" /> : <><Phone size={15} /> Send OTP</>}
                </button>
              </form>
            ) : (
              <form onSubmit={verifyOtp} className="space-y-4">
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-center">
                  <p className="text-text-2 text-sm">OTP sent to ****{otpPhone.slice(-4)}</p>
                  {demoOtp && <p className="text-primary font-bold text-lg mt-1">Demo OTP: {demoOtp}</p>}
                </div>
                <div>
                  <label className="label" htmlFor="otp-code">Enter OTP</label>
                  <div className="relative">
                    <KeyRound size={14} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3" />
                    <input id="otp-code" className="input w-full pl-9 text-center text-xl tracking-widest" required
                      type="text" maxLength={6} value={otp} aria-label="Enter 6-digit OTP"
                      onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000" autoFocus />
                  </div>
                </div>
                {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
                <div className="flex gap-2">
                  <button type="button" className="btn-secondary flex-1"
                    onClick={() => { setOtpSent(false); setOtp(''); setDemoOtp(null); setError(null) }}>
                    Change Number
                  </button>
                  <button type="submit" className="btn-primary flex-1" disabled={loading || otp.length < 4}>
                    {loading ? <Loader2 size={15} className="animate-spin" /> : <><CheckCircle2 size={15} /> Verify</>}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
