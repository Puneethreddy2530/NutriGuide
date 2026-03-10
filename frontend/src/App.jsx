import React, { useState, useEffect, useRef, createContext, useContext } from 'react'
import { BrowserRouter, Routes, Route, NavLink, useLocation, Navigate, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import {
  LayoutDashboard, Users, Utensils, CheckCircle2, Bot,
  FileBarChart2, ShieldCheck, Menu, ChevronLeft, ChevronDown, LogOut,
  Camera, Network, AlertTriangle, MessageSquare,
  FlaskConical, BookMarked, BarChart3, Cpu, Waypoints,
} from 'lucide-react'
import Dashboard from './pages/Dashboard.jsx'
import PatientDetail from './pages/PatientDetail.jsx'
import MealPlan from './pages/MealPlan.jsx'
import Compliance from './pages/Compliance.jsx'
import DietitianAI from './pages/DietitianAI.jsx'
import Reports from './pages/Reports.jsx'
import AuditTrail from './pages/PQCStatus.jsx'
import NurseView from './pages/NurseView.jsx'
import AuthPage from './pages/AuthPage.jsx'
import TrayVisionPage   from './pages/TrayVisionPage.jsx'
import FoodDrugPage     from './pages/FoodDrugPage.jsx'
import RestrictionsPage from './pages/RestrictionsPage.jsx'
import SignedRAGPage    from './pages/SignedRAGPage.jsx'
import KitchenPage      from './pages/KitchenPage.jsx'
import WhatsAppPage     from './pages/WhatsAppPage.jsx'
import WellnessPage     from './pages/WellnessPage.jsx'
import AIModelsPage     from './pages/AIModelsPage.jsx'
import SemanticGraphPage from './pages/SemanticGraphPage.jsx'
import LandingPage      from './components/LandingPage.jsx'

gsap.registerPlugin(useGSAP)

// ── Landing page wrapper (needs useNavigate, must render inside BrowserRouter) ──
function LandingPageWrapper() {
  const navigate = useNavigate()
  return <LandingPage onEnterApp={() => navigate('/auth')} />
}

// ── Auth Context ──────────────────────────────────────────────────────────────
export const AuthContext = createContext({ token: null, user: null, logout: () => {} })

// ── Language Context ──────────────────────────────────────────────────────────
export const LangContext = createContext({ lang: 'english', setLang: () => {} })

const LANGS = [
  { key: 'english',  label: 'EN', name: 'English'   },
  { key: 'hindi',    label: 'HI', name: 'हिन्दी'     },
  { key: 'marathi',  label: 'MR', name: 'मराठी'     },
  { key: 'telugu',   label: 'TE', name: 'తెలుగు'    },
  { key: 'tamil',    label: 'TA', name: 'தமிழ்'     },
  { key: 'kannada',  label: 'KN', name: 'ಕನ್ನಡ'     },
  { key: 'bengali',  label: 'BN', name: 'বাংলা'     },
  { key: 'gujarati', label: 'GU', name: 'ગુજરાતી'   },
  { key: 'punjabi',  label: 'PA', name: 'ਪੰਜਾਬੀ'    },
]

// ── Nav items with Lucide icons ─────────────────────────────────────────────
const NAV = [
  { path: '/',           icon: LayoutDashboard, labels: {
    english: 'Command Center', hindi: 'कमांड सेंटर', marathi: 'कमांड केंद्र',
    telugu: 'కమాండ్ సెంటర్', tamil: 'கட்டளை மையம்', kannada: 'ಕಮಾಂಡ್ ಸೆಂಟರ್',
    bengali: 'কমান্ড সেন্টার', gujarati: 'કમાન્ડ સેન્ટર', punjabi: 'ਕਮਾਂਡ ਸੈਂਟਰ' } },
  { path: '/patients',   icon: Users, labels: {
    english: 'Patients', hindi: 'मरीज़', marathi: 'रुग्ण',
    telugu: 'రోగులు', tamil: 'நோயாளிகள்', kannada: 'ರೋಗಿಗಳು',
    bengali: 'রোগী', gujarati: 'દર્દીઓ', punjabi: 'ਮਰੀਜ਼' } },
  { path: '/meal-plan',  icon: Utensils, labels: {
    english: 'Meal Plans', hindi: 'भोजन योजना', marathi: 'जेवण योजना',
    telugu: 'భోజన ప్రణాళిక', tamil: 'உணவு திட்டம்', kannada: 'ಊಟದ ಯೋಜನೆ',
    bengali: 'খাবার পরিকল্পনা', gujarati: 'ભોજન યોજના', punjabi: 'ਭੋਜਨ ਯੋਜਨਾ' } },
  { path: '/compliance', icon: CheckCircle2, labels: {
    english: 'Compliance', hindi: 'अनुपालन', marathi: 'अनुपालन',
    telugu: 'సమ్మతి', tamil: 'இணக்கம்', kannada: 'ಅನುಸರಣೆ',
    bengali: 'সম্মতি', gujarati: 'અનુપાલન', punjabi: 'ਪਾਲਣਾ' } },
  { path: '/ai',         icon: Bot, labels: {
    english: 'Dietitian AI', hindi: 'आहार AI', marathi: 'आहार AI',
    telugu: 'డైటిషియన్ AI', tamil: 'உணவியல் AI', kannada: 'ಆಹಾರ AI',
    bengali: 'ডায়েটিশিয়ান AI', gujarati: 'ડાઇટિશિયન AI', punjabi: 'ਡਾਇਟੀਸ਼ੀਅਨ AI' } },
  { path: '/reports',    icon: FileBarChart2, labels: {
    english: 'Reports', hindi: 'रिपोर्ट', marathi: 'अहवाल',
    telugu: 'నివేదికలు', tamil: 'அறிக்கைகள்', kannada: 'ವರದಿಗಳು',
    bengali: 'প্রতিবেদন', gujarati: 'અહેવાલ', punjabi: 'ਰਿਪੋਰਟਾਂ' } },
  { path: '/pqc',        icon: ShieldCheck, labels: {
    english: 'PQC Security', hindi: 'PQC सुरक्षा', marathi: 'PQC सुरक्षा',
    telugu: 'PQC భద్రత', tamil: 'PQC பாதுகாப்பு', kannada: 'PQC ಭದ್ರತೆ',
    bengali: 'PQC নিরাপত্তা', gujarati: 'PQC સુરક્ષા', punjabi: 'PQC ਸੁਰੱਖਿਆ' } },
  // ── New pages ────────────────────────────────────────────────────────────────
  { path: '/tray',        icon: Camera,        labels: { english: 'Tray Vision',       hindi: 'ट्रे विज़न',         marathi: 'ट्रे व्हिजन',          telugu: 'ట్రే విజన్',         tamil: 'தட்டு பார்வை',         kannada: 'ಟ್ರೇ ವಿಷನ್',      bengali: 'ট্রে ভিশন',          gujarati: 'ट्रे विजन',          punjabi: 'ਟ੍ਰੇ ਵਿਜ਼ਨ' } },
  { path: '/food-drug',   icon: Network,       labels: { english: 'Food-Drug Graph',   hindi: 'फूड-ड्रग ग्राफ',     marathi: 'फूड-ड्रग आलेख',        telugu: 'ఫుడ్-డ్రగ్ గ్రాఫ్',  tamil: 'உணவு-மருந்து வரைபடம்', kannada: 'ಆಹಾರ-ಔಷಧ ಗ್ರಾಫ್',  bengali: 'ফুড-ড্রাগ গ্রাফ',   gujarati: 'फूड-ड्रग ग्राफ',    punjabi: 'ਫੂਡ-ਡਰੱਗ ਗ੍ਰਾਫ' } },
  { path: '/restrictions', icon: AlertTriangle, labels: { english: 'Restrictions',    hindi: 'प्रतिबंध',           marathi: 'निर्बंध',               telugu: 'నిషేధాలు',           tamil: 'கட்டுப்பாடுகள்',       kannada: 'ನಿರ್ಬಂಧಗಳು',      bengali: 'বিধিনিষেধ',         gujarati: 'प्रतिबंध',          punjabi: 'ਪਾਬੰਦੀਆਂ' } },
  { path: '/signed-rag',  icon: BookMarked,    labels: { english: 'Signed RAG',        hindi: 'साइन्ड RAG',         marathi: 'साइन्ड RAG',            telugu: 'సైన్ RAG',           tamil: 'கையெழுத்திட்ட RAG',   kannada: 'ಸೈನ್ RAG',          bengali: 'সাইনড RAG',         gujarati: 'साइन्ड RAG',        punjabi: 'ਸਾਈਨਡ RAG' } },
  { path: '/kitchen',     icon: FlaskConical,  labels: { english: 'Kitchen Analytics', hindi: 'रसोई विश्लेषण',     marathi: 'स्वयंपाकघर विश्लेषण', telugu: 'వంటగది విశ్లేషణ',    tamil: 'சமையலறை பகுப்பாய்வு', kannada: 'ಅಡಿಗೆ ವಿಶ್ಲೇಷಣೆ',  bengali: 'রান্নাঘর বিশ্লেষণ', gujarati: 'रसोई विश्लेषण',    punjabi: 'ਰਸੋਈ ਵਿਸ਼ਲੇਸ਼ਣ' } },
  { path: '/whatsapp',    icon: MessageSquare, labels: { english: 'WhatsApp Bot',      hindi: 'WhatsApp बॉट',       marathi: 'WhatsApp बॉट',          telugu: 'WhatsApp బాట్',      tamil: 'WhatsApp போட்',        kannada: 'WhatsApp ಬಾಟ್',     bengali: 'WhatsApp বট',       gujarati: 'WhatsApp बॉट',      punjabi: 'WhatsApp ਬੋਟ' } },
  { path: '/wellness',    icon: BarChart3,     labels: { english: 'Wellness Report',   hindi: 'वेलनेस रिपोर्ट',   marathi: 'वेलनेस अहवाल',         telugu: 'వెల్నెస్ నివేదిక',  tamil: 'நலன் அறிக்கை',        kannada: 'ಕ್ಷೇಮ ವರದಿ',       bengali: 'ওয়েলনেস রিপোর্ট',  gujarati: 'वेलनेस रिपोर्ट',  punjabi: 'ਵੈਲਨੈੱਸ ਰਿਪੋਰਟ' } },
  { path: '/ai-models',   icon: Cpu,           labels: { english: 'AI Models',         hindi: 'AI मॉडल',            marathi: 'AI मॉडेल',              telugu: 'AI మోడల్స్',        tamil: 'AI மாதிரிகள்',        kannada: 'AI ಮಾದರಿಗಳು',      bengali: 'AI মডেল',          gujarati: 'AI मॉडल',          punjabi: 'AI ਮਾਡਲ' } },
  { path: '/semantic',    icon: Waypoints,     labels: { english: 'Semantic Graph',    hindi: 'Semantic Graph',     marathi: 'Semantic Graph',        telugu: 'Semantic Graph',     tamil: 'Semantic Graph',       kannada: 'Semantic Graph',    bengali: 'Semantic Graph',    gujarati: 'Semantic Graph',    punjabi: 'Semantic Graph' } },
]

// ── Nav sections (for sectioned sidebar rendering) ────────────────────────────
const NAV_SECTIONS = [
  {
    label: 'Clinical',
    items: NAV.filter(n => ['/', '/patients', '/meal-plan', '/compliance', '/tray'].includes(n.path)),
  },
  {
    label: 'Intelligence',
    items: NAV.filter(n => ['/ai', '/food-drug', '/restrictions', '/signed-rag', '/semantic'].includes(n.path)),
  },
  {
    label: 'Operations',
    items: NAV.filter(n => ['/kitchen', '/whatsapp'].includes(n.path)),
  },
  {
    label: 'Reports',
    items: NAV.filter(n => ['/reports', '/wellness', '/pqc', '/ai-models'].includes(n.path)),
  },
]

// ── Error Boundary ─────────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(err, info) { console.error('[NutriGuide] Page error:', err, info) }
  render() {
    if (this.state.error) return (
      <div style={{ padding: 64, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16, filter: 'drop-shadow(0 0 12px rgba(244,63,94,0.6))' }}>⚠</div>
        <div style={{ fontFamily: 'var(--font-head)', fontSize: 20, fontWeight: 800, marginBottom: 10, color: 'var(--text)' }}>
          Page Crash
        </div>
        <div style={{ color: 'var(--text3)', fontSize: 12, fontFamily: 'var(--font-mono)', marginBottom: 24,
          background: 'var(--bg2)', padding: '12px 20px', borderRadius: 'var(--radius)', display: 'inline-block',
          maxWidth: 500, border: '1px solid var(--border2)' }}>
          {this.state.error.message}
        </div>
        <div>
          <button className="btn btn-primary" onClick={() => this.setState({ error: null })}>↺ Try Again</button>
        </div>
      </div>
    )
    return this.props.children
  }
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({ alerts, expanded, toggleExpand, lang, setLang }) {
  const loc = useLocation()
  const [showLangMenu, setShowLangMenu] = useState(false)
  const sidebarRef = useRef(null)
  const currentLang = LANGS.find(l => l.key === lang) || LANGS[0]

  // GSAP liquid hover on nav items
  useGSAP(() => {
    const items = sidebarRef.current?.querySelectorAll('.sb-item')
    if (!items) return
    items.forEach(item => {
      item.addEventListener('mouseenter', () => {
        gsap.to(item, { scale: 1.03, x: 2, duration: 0.3, ease: 'power3.out' })
        gsap.to(item.querySelector('.sb-icon'), { color: 'var(--accent)', duration: 0.2 })
      })
      item.addEventListener('mouseleave', () => {
        gsap.to(item, { scale: 1, x: 0, duration: 0.25, ease: 'power3.inOut' })
      })
    })
  }, { scope: sidebarRef, dependencies: [expanded] })

  // GSAP stagger entrance
  useGSAP(() => {
    if (!sidebarRef.current) return
    gsap.from(sidebarRef.current.querySelectorAll('.sb-item'), {
      opacity: 0, x: -16, stagger: 0.05, duration: 0.5,
      ease: 'power3.out', delay: 0.1,
    })
  }, { scope: sidebarRef })

  useEffect(() => {
    if (!showLangMenu) return
    const close = () => setShowLangMenu(false)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [showLangMenu])

  return (
    <aside ref={sidebarRef} style={{
      width: expanded ? 248 : 64,
      minHeight: '100vh',
      background: 'rgba(255,255,255,0.82)',
      borderRight: '1px solid var(--border)',
      boxShadow: '4px 0 24px rgba(0,0,0,0.06)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      display: 'flex', flexDirection: 'column',
      alignItems: expanded ? 'stretch' : 'center',
      position: 'fixed', left: 0, top: 0, zIndex: 100,
      paddingBottom: 14,
      transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      overflow: 'hidden',
    }}>
      <style>{`
        .sb-item { will-change: transform; }
        .sb-item.active-link .sb-icon { color: var(--accent) !important; }
        .lang-opt:hover { background: var(--accent-soft) !important; color: var(--accent) !important; }
        .sb-hamburger:hover { background: rgba(0,0,0,0.04) !important; }
        .sb-logo-pulse { animation: glow-pulse 3s ease-in-out infinite; }
      `}</style>

      {/* Top: hamburger + logo */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: expanded ? '16px 12px 10px' : '16px 0 10px',
        gap: 10, flexShrink: 0,
        justifyContent: expanded ? 'flex-start' : 'center',
        borderBottom: '1px solid var(--border)',
        marginBottom: 8,
      }}>
        <button className="sb-hamburger" onClick={toggleExpand}
          style={{
            width: 36, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer',
            background: 'transparent', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 16, color: 'var(--text3)',
            transition: 'all 0.2s', flexShrink: 0,
          }}>
          {expanded ? <ChevronLeft size={16} /> : <Menu size={16} />}
        </button>
        {expanded && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src="/Final.jpg" alt="NutriGuide" style={{
              width: 28, height: 28, borderRadius: '50%', objectFit: 'cover',
              boxShadow: '0 0 16px rgba(8,145,178,0.35)',
              border: '1px solid var(--border-accent)',
            }} />
            <div className="sb-logo-pulse" style={{
              fontFamily: 'var(--font-head)', fontSize: 15, fontWeight: 700,
              color: 'var(--accent)', letterSpacing: '0.12em', whiteSpace: 'nowrap',
              textShadow: '0 0 20px rgba(8,145,178,0.35)',
              textTransform: 'uppercase',
            }}>NutriGuide</div>
          </div>
        )}
      </div>

      {/* Nav items — sectioned */}
      <nav style={{
        display: 'flex', flexDirection: 'column', gap: 2, flex: 1,
        padding: expanded ? '0 8px' : '0',
        alignItems: expanded ? 'stretch' : 'center',
        overflowY: 'auto',
      }}>
        {NAV_SECTIONS.map(section => (
          <div key={section.label}>
            {/* Section header — only visible when expanded */}
            {expanded && (
              <div style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
                textTransform: 'uppercase', color: 'var(--text3)',
                padding: '10px 12px 4px',
                fontFamily: 'var(--font-mono)',
                opacity: 0.55,
              }}>
                {section.label}
              </div>
            )}
            {/* Divider line when collapsed */}
            {!expanded && (
              <div style={{
                width: 24, height: 1,
                background: 'var(--border)',
                margin: '6px auto',
                opacity: 0.5,
              }} />
            )}
            {section.items.map(({ path, icon: IconComp, labels }) => {
              const active = path === '/' ? loc.pathname === '/' : loc.pathname.startsWith(path)
              const label = labels[lang] || labels.english
              return (
                <NavLink key={path} to={path} style={{ textDecoration: 'none' }}>
                  <div className={`sb-item${active ? ' active-link' : ''}`}
                    title={expanded ? undefined : label}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: expanded ? '8px 12px' : '8px 0',
                      width: expanded ? '100%' : 42, height: 38,
                      justifyContent: expanded ? 'flex-start' : 'center',
                      background: active
                        ? 'linear-gradient(135deg, var(--accent-soft), rgba(8,145,178,0.03))'
                        : 'transparent',
                      borderRadius: 9,
                      border: active ? '1px solid var(--border-accent)' : '1px solid transparent',
                      boxShadow: active ? 'var(--shadow-glow)' : 'none',
                      cursor: 'pointer', position: 'relative',
                    }}>
                    <span className="sb-icon" style={{
                      flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: active ? 'var(--accent)' : 'var(--text3)',
                      transition: 'color 0.2s', width: 20,
                    }}>
                      <IconComp size={16} strokeWidth={1.8} />
                    </span>
                    {expanded && (
                      <span style={{
                        fontSize: 12, fontWeight: active ? 600 : 400,
                        color: active ? 'var(--text)' : 'var(--text2)',
                        whiteSpace: 'nowrap', overflow: 'hidden',
                        fontFamily: 'var(--font-body)',
                        transition: 'color 0.2s',
                      }}>{label}</span>
                    )}
                    {path === '/' && alerts > 0 && (
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: 'var(--danger)',
                        boxShadow: '0 0 8px rgba(244,63,94,0.8)',
                        flexShrink: 0, marginLeft: expanded ? 'auto' : 0,
                        position: expanded ? 'relative' : 'absolute',
                        top: expanded ? 0 : 6, right: expanded ? 0 : 5,
                      }}/>
                    )}
                  </div>
                </NavLink>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Language picker */}
      <div style={{
        padding: expanded ? '8px 8px 4px' : '8px 0 4px',
        borderTop: '1px solid var(--border)',
        position: 'relative',
        display: 'flex', justifyContent: expanded ? 'flex-start' : 'center',
      }} onClick={e => e.stopPropagation()}>
        <button onClick={() => setShowLangMenu(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: expanded ? '7px 12px' : '7px 0',
            width: expanded ? '100%' : 42, height: 34,
            justifyContent: expanded ? 'flex-start' : 'center',
            background: showLangMenu ? 'var(--accent-soft)' : 'transparent',
            border: 'none', borderRadius: 8, cursor: 'pointer',
            transition: 'all 0.15s',
          }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
            color: 'var(--accent)', flexShrink: 0, minWidth: 18, textAlign: 'center',
          }}>{currentLang.label}</span>
          {expanded && <>
            <span style={{ fontSize: 12, color: 'var(--text2)', whiteSpace: 'nowrap', fontFamily: 'var(--font-body)' }}>
              {currentLang.name}
            </span>
            <ChevronDown size={12} style={{ marginLeft: 'auto', color: 'var(--text-muted)' }} />
          </>}
        </button>

        {showLangMenu && (
          <div style={{
            position: 'absolute', bottom: '100%',
            left: expanded ? 8 : 56, minWidth: 175,
            background: 'var(--bg1)',
            border: '1px solid var(--border2)',
            borderRadius: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.10), 0 1px 3px rgba(0,0,0,0.06)',
            zIndex: 9999, padding: 6,
            backdropFilter: 'blur(20px)',
          }}>
            {LANGS.map(l => (
              <button key={l.key} className="lang-opt"
                onClick={() => { setLang(l.key); setShowLangMenu(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '7px 10px', borderRadius: 7,
                  border: 'none', cursor: 'pointer', fontSize: 12, textAlign: 'left',
                  background: lang === l.key ? 'var(--accent-soft)' : 'transparent',
                  color: lang === l.key ? 'var(--accent)' : 'var(--text2)',
                  fontWeight: lang === l.key ? 700 : 400, transition: 'all 0.12s',
                  fontFamily: 'var(--font-body)',
                }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 10,
                  color: 'var(--accent)', minWidth: 22 }}>{l.label}</span>
                <span>{l.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Logout button */}
      <div style={{ padding: expanded ? '0 8px' : '0', display: 'flex', justifyContent: expanded ? 'flex-start' : 'center' }}>
        <LogoutButton expanded={expanded} />
      </div>

      {/* System status dot */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0,
        padding: expanded ? '6px 20px 0' : '6px 0 0',
        justifyContent: expanded ? 'flex-start' : 'center',
      }}>
        <div className="status-dot-green" title="Backend Online" />
        {expanded && <span style={{
          fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--font-mono)',
        }}>System Online</span>}
      </div>
    </aside>
  )
}

// ── Logout Button ────────────────────────────────────────────────────────────
function LogoutButton({ expanded }) {
  const { logout, user } = useContext(AuthContext)
  if (!logout) return null
  return (
    <button
      onClick={logout}
      title={expanded ? undefined : 'Sign out'}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: expanded ? '7px 12px' : '7px 0',
        width: expanded ? '100%' : 42, height: 34,
        justifyContent: expanded ? 'flex-start' : 'center',
        background: 'transparent', border: 'none', borderRadius: 8,
        cursor: 'pointer', transition: 'all 0.15s', color: 'var(--text3)',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(244,63,94,0.07)'; e.currentTarget.style.color = 'var(--danger)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text3)' }}
    >
      <LogOut size={15} style={{ flexShrink: 0 }} />
      {expanded && (
        <span style={{ fontSize: 11.5, fontFamily: 'var(--font-body)', whiteSpace: 'nowrap' }}>
          {user?.name ? `Sign out (${user.name})` : 'Sign out'}
        </span>
      )}
    </button>
  )
}

// ── Animated page wrapper ─────────────────────────────────────────────────────
function PageTransition({ children }) {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        style={{ minHeight: '100%' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

// ── Layout ─────────────────────────────────────────────────────────────────────
function Layout({ children, alerts, expanded, toggleExpand, lang, setLang }) {
  return (
    <div style={{ display: 'flex' }}>
      <Sidebar alerts={alerts} expanded={expanded} toggleExpand={toggleExpand} lang={lang} setLang={setLang} />
      <main style={{
        marginLeft: expanded ? 248 : 64, flex: 1, minHeight: '100vh',
        padding: '32px 36px',
        transition: 'margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}>
        {children}
      </main>
    </div>
  )
}

// ── App root ───────────────────────────────────────────────────────────────────
export default function App() {
  const [alerts, setAlerts]     = useState(0)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [expanded, setExpanded] = useState(false)
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem('nutriguide_lang') || 'english' } catch { return 'english' }
  })
  const [token, setToken] = useState(() => {
    try { return localStorage.getItem('nutriguide_token') || null } catch { return null }
  })
  const [user, setUser] = useState(() => {
    try { const u = localStorage.getItem('nutriguide_user'); return u ? JSON.parse(u) : null } catch { return null }
  })

  function handleAuth(tok, usr) {
    try {
      localStorage.setItem('nutriguide_token', tok)
      localStorage.setItem('nutriguide_user', JSON.stringify(usr))
    } catch {}
    setToken(tok)
    setUser(usr)
  }

  function logout() {
    try { localStorage.removeItem('nutriguide_token'); localStorage.removeItem('nutriguide_user') } catch {}
    setToken(null)
    setUser(null)
  }

  useEffect(() => {
    try { localStorage.setItem('nutriguide_lang', lang) } catch {}
  }, [lang])

  useEffect(() => {
    const on  = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  useEffect(() => {
    if (!token) return
    const poll = () =>
      fetch('/api/v1/dashboard').then(r => r.json()).then(d => setAlerts(d.alerts_active || 0)).catch(() => {})
    poll()
    const iv = setInterval(poll, 30000)
    return () => clearInterval(iv)
  }, [token])

  return (
    <AuthContext.Provider value={{ token, user, logout }}>
      <LangContext.Provider value={{ lang, setLang }}>
        <BrowserRouter>
          {/* Offline banner */}
          <AnimatePresence>
            {!isOnline && (
              <motion.div
                initial={{ y: -40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -40, opacity: 0 }}
                style={{
                  position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
                  background: 'rgba(245,158,11,0.15)',
                  backdropFilter: 'blur(16px)',
                  borderBottom: '1px solid rgba(245,158,11,0.3)',
                  color: 'var(--warning)', textAlign: 'center',
                  padding: '7px 16px', fontSize: 12, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  fontFamily: 'var(--font-mono)',
                }}>
                ⚠ Network offline — showing cached data. Clinical decisions may be outdated.
              </motion.div>
            )}
          </AnimatePresence>

          <Routes>
            {/* Landing page — redirect to dashboard if already logged in */}
            <Route path="/landing" element={
              token ? <Navigate to="/" replace /> : <LandingPageWrapper />
            } />

            {/* Auth page — redirect to dashboard if already logged in */}}
            <Route path="/auth" element={
              token ? <Navigate to="/" replace /> : <AuthPage onAuth={handleAuth} />
            } />

            {/* Nurse mobile view — no sidebar, token not required */}
            <Route path="/nurse/:patient_id" element={<NurseView />} />

            {/* All other routes — require token */}
            <Route path="*" element={
              !token ? <Navigate to="/landing" replace /> : (
                <Layout alerts={alerts} expanded={expanded} toggleExpand={() => setExpanded(v => !v)}
                  lang={lang} setLang={setLang}>
                  <ErrorBoundary>
                    <PageTransition>
                      <Routes>
                        <Route path="/"             element={<Dashboard />} />
                        <Route path="/patients"     element={<PatientDetail />} />
                        <Route path="/patients/:id" element={<PatientDetail />} />
                        <Route path="/meal-plan"    element={<MealPlan />} />
                        <Route path="/compliance"   element={<Compliance />} />
                        <Route path="/ai"           element={<DietitianAI />} />
                        <Route path="/reports"      element={<Reports />} />
                        <Route path="/pqc"          element={<AuditTrail />} />
                        <Route path="/tray"         element={<TrayVisionPage />} />
                        <Route path="/food-drug"    element={<FoodDrugPage />} />
                        <Route path="/restrictions" element={<RestrictionsPage />} />
                        <Route path="/signed-rag"   element={<SignedRAGPage />} />
                        <Route path="/kitchen"      element={<KitchenPage />} />
                        <Route path="/whatsapp"     element={<WhatsAppPage />} />
                        <Route path="/wellness"     element={<WellnessPage />} />
                        <Route path="/ai-models"    element={<AIModelsPage />} />
                        <Route path="/semantic"     element={<SemanticGraphPage />} />
                      </Routes>
                    </PageTransition>
                  </ErrorBoundary>
                </Layout>
              )
            } />
          </Routes>
        </BrowserRouter>
      </LangContext.Provider>
    </AuthContext.Provider>
  )
}


// ── Language Context (consumed by any component that needs localisation) ─────
