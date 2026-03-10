import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShieldCheck, User, Lock, Mail, Eye, EyeOff, Stethoscope, UserCheck, ChevronRight } from 'lucide-react'
import { authLogin, authRegister } from '../api/client.js'

const ROLES = [
  { key: 'nurse',      label: 'Nurse',      icon: '⊕', desc: 'Bedside care & compliance logging' },
  { key: 'dietitian',  label: 'Dietitian',  icon: '◎', desc: 'Meal planning & dietary oversight' },
  { key: 'admin',      label: 'Admin',       icon: '◈', desc: 'Full system access & user management' },
]

function FieldGroup({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{
        display: 'block', marginBottom: 6,
        fontSize: 11, fontWeight: 600, color: 'var(--text2)',
        letterSpacing: '0.06em', textTransform: 'uppercase',
        fontFamily: 'var(--font-mono)',
      }}>{label}</label>
      {children}
    </div>
  )
}

function InputWithIcon({ icon: Icon, type = 'text', value, onChange, placeholder, autoComplete, rightSlot }) {
  return (
    <div style={{ position: 'relative' }}>
      <Icon size={14} style={{
        position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
        color: 'var(--text3)', pointerEvents: 'none',
      }} />
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="input"
        style={{ paddingLeft: 36, paddingRight: rightSlot ? 40 : 14 }}
      />
      {rightSlot && (
        <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}>
          {rightSlot}
        </div>
      )}
    </div>
  )
}

export default function AuthPage({ onAuth }) {
  const [tab, setTab] = useState('login')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  // Login fields
  const [loginUsername, setLoginUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // Register fields
  const [regName, setRegName] = useState('')
  const [regUsername, setRegUsername] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regRole, setRegRole] = useState('nurse')

  async function handleLogin(e) {
    e.preventDefault()
    setError(null); setLoading(true)
    try {
      const data = await authLogin(loginUsername, loginPassword)
      localStorage.setItem('nutriguide_token', data.access_token)
      localStorage.setItem('nutriguide_user', JSON.stringify(data.user))
      onAuth(data.access_token, data.user)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister(e) {
    e.preventDefault()
    setError(null)
    if (regPassword.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true)
    try {
      const data = await authRegister({
        name: regName, username: regUsername, email: regEmail || undefined,
        password: regPassword, role: regRole,
      })
      localStorage.setItem('nutriguide_token', data.access_token)
      localStorage.setItem('nutriguide_user', JSON.stringify(data.user))
      onAuth(data.access_token, data.user)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const PwToggle = (
    <button type="button" onClick={() => setShowPw(v => !v)}
      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', display: 'flex', padding: 0 }}>
      {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
    </button>
  )

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      fontFamily: 'var(--font-body)',
    }}>
      {/* Ambient glow behind card */}
      <div style={{
        position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)',
        width: 600, height: 400,
        background: 'radial-gradient(ellipse, rgba(8,145,178,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        style={{ width: '100%', maxWidth: 480, position: 'relative' }}
      >
        {/* Brand header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ marginBottom: 14 }}>
            <img src="/Final.jpg" alt="NutriGuide" style={{
              width: 64, height: 64, borderRadius: 16, objectFit: 'cover',
              boxShadow: '0 0 32px rgba(8,145,178,0.25)',
              border: '1px solid var(--border-accent)',
            }} />
          </div>
          <div style={{
            fontFamily: 'var(--font-head)', fontSize: 28, fontWeight: 900,
            color: 'var(--accent)', letterSpacing: '-0.04em',
            textShadow: '0 0 24px rgba(8,145,178,0.30)',
          }}>NutriGuide</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
            Clinical Nutrition Care Agent
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {[['▣', 'G. Kathir Memorial'], ['◈', 'JWT Secured'], ['⊕', 'Clinical Grade']].map(([icon, text]) => (
              <span key={text} style={{
                fontSize: 10, padding: '3px 10px', borderRadius: 20,
                background: 'var(--accent-soft)', color: 'var(--accent)',
                border: '1px solid var(--border-accent)', fontFamily: 'var(--font-mono)',
                letterSpacing: '0.04em',
              }}>{icon} {text}</span>
            ))}
          </div>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: 28, boxShadow: '0 8px 48px rgba(0,0,0,0.10)' }}>
          {/* Tab switcher */}
          <div style={{
            display: 'flex', gap: 4, background: 'var(--bg2)',
            padding: 4, borderRadius: 10, marginBottom: 24,
          }}>
            {[['login', 'Sign In'], ['register', 'Create Account']].map(([t, l]) => (
              <button key={t}
                onClick={() => { setTab(t); setError(null) }}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: 8, border: 'none',
                  fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.2s',
                  background: tab === t ? 'var(--bg1)' : 'transparent',
                  color: tab === t ? 'var(--accent)' : 'var(--text3)',
                  boxShadow: tab === t ? 'var(--shadow-card)' : 'none',
                }}>
                {l}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {tab === 'login' ? (
              <motion.form key="login"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.22 }}
                onSubmit={handleLogin}
              >
                <FieldGroup label="Username">
                  <InputWithIcon
                    icon={User}
                    value={loginUsername}
                    onChange={e => setLoginUsername(e.target.value)}
                    placeholder="Your username"
                    autoComplete="username"
                  />
                </FieldGroup>

                <FieldGroup label="Password">
                  <InputWithIcon
                    icon={Lock}
                    type={showPw ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    placeholder="Your password"
                    autoComplete="current-password"
                    rightSlot={PwToggle}
                  />
                </FieldGroup>

                {error && <ErrorBanner msg={error} />}

                <button type="submit" className="btn btn-primary"
                  disabled={loading || !loginUsername || !loginPassword}
                  style={{ width: '100%', justifyContent: 'center', marginTop: 8, padding: '11px 0', fontSize: 13.5 }}>
                  {loading ? <Spinner /> : <><ShieldCheck size={15} /> Sign In to NutriGuide</>}
                </button>

                <DemoHint />
              </motion.form>
            ) : (
              <motion.form key="register"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.22 }}
                onSubmit={handleRegister}
              >
                <FieldGroup label="Full Name">
                  <InputWithIcon
                    icon={UserCheck}
                    value={regName}
                    onChange={e => setRegName(e.target.value)}
                    placeholder="Dr. / Nurse full name"
                    autoComplete="name"
                  />
                </FieldGroup>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 11, fontWeight: 600, color: 'var(--text2)', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Username</label>
                    <InputWithIcon
                      icon={User}
                      value={regUsername}
                      onChange={e => setRegUsername(e.target.value)}
                      placeholder="username"
                      autoComplete="username"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 11, fontWeight: 600, color: 'var(--text2)', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Email <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(optional)</span></label>
                    <InputWithIcon
                      icon={Mail}
                      type="email"
                      value={regEmail}
                      onChange={e => setRegEmail(e.target.value)}
                      placeholder="email@hospital.in"
                      autoComplete="email"
                    />
                  </div>
                </div>

                <FieldGroup label="Password">
                  <InputWithIcon
                    icon={Lock}
                    type={showPw ? 'text' : 'password'}
                    value={regPassword}
                    onChange={e => setRegPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    autoComplete="new-password"
                    rightSlot={PwToggle}
                  />
                </FieldGroup>

                {/* Role Picker */}
                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: 'block', marginBottom: 8, fontSize: 11, fontWeight: 600, color: 'var(--text2)', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Role</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {ROLES.map(r => (
                      <button key={r.key} type="button"
                        onClick={() => setRegRole(r.key)}
                        style={{
                          flex: 1, padding: '9px 6px', borderRadius: 10, border: 'none',
                          cursor: 'pointer', transition: 'all 0.18s', textAlign: 'center',
                          background: regRole === r.key ? 'var(--accent-soft)' : 'var(--bg2)',
                          boxShadow: regRole === r.key ? '0 0 0 1.5px var(--accent)' : '0 0 0 1px var(--border)',
                          outline: 'none',
                        }}>
                        <div style={{ fontSize: 16, marginBottom: 3 }}>{r.icon}</div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: regRole === r.key ? 'var(--accent)' : 'var(--text2)', fontFamily: 'var(--font-mono)' }}>{r.label.toUpperCase()}</div>
                      </button>
                    ))}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
                    ◈ {ROLES.find(r => r.key === regRole)?.desc}
                  </div>
                </div>

                {error && <ErrorBanner msg={error} />}

                <button type="submit" className="btn btn-primary"
                  disabled={loading || !regName || !regUsername || !regPassword}
                  style={{ width: '100%', justifyContent: 'center', marginTop: 4, padding: '11px 0', fontSize: 13.5 }}>
                  {loading ? <Spinner /> : <><ChevronRight size={15} /> Create Account</>}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        {/* Footer note */}
        <div style={{ textAlign: 'center', marginTop: 18, fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
          NutriGuide · Glitchcon 2.0 · G. Kathir Memorial Hospital · Clinical data is demo-only
        </div>
      </motion.div>
    </div>
  )
}

function ErrorBanner({ msg }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
      style={{
        background: 'var(--danger-soft)', border: '1px solid rgba(220,38,38,0.2)',
        borderRadius: 8, padding: '9px 13px', marginBottom: 12,
        fontSize: 12, color: 'var(--danger)', lineHeight: 1.5,
        fontFamily: 'var(--font-mono)',
      }}
    >
      ⚠ {msg}
    </motion.div>
  )
}

function DemoHint() {
  return (
    <div style={{
      marginTop: 14, padding: '10px 13px',
      background: 'var(--accent-soft)', border: '1px solid var(--border-accent)',
      borderRadius: 8,
      display: 'flex', alignItems: 'flex-start', gap: 8,
    }}>
      <Stethoscope size={13} color="var(--accent)" style={{ marginTop: 1, flexShrink: 0 }} />
      <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.6, fontFamily: 'var(--font-mono)' }}>
        <strong style={{ color: 'var(--accent)' }}>Demo credentials:</strong><br />
        Username: <code style={{ background: 'var(--bg2)', padding: '0 4px', borderRadius: 4 }}>admin</code> &nbsp;
        Password: <code style={{ background: 'var(--bg2)', padding: '0 4px', borderRadius: 4 }}>admin123</code>
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <div style={{
      width: 15, height: 15, borderRadius: '50%',
      border: '2px solid rgba(255,255,255,0.3)',
      borderTopColor: '#fff',
      animation: 'spin 0.7s linear infinite',
    }} />
  )
}
