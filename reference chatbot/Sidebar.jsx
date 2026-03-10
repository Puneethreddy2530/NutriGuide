import { cloneElement, isValidElement } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, ScanLine, Bug, TrendingUp, Bot, CloudSun,
  Sprout, RotateCcw, FlaskConical, Calculator, Map, BarChart3,
  MessageSquare, FileText, Shield, LogOut, X, BookMarked, Globe, Truck, Satellite
} from 'lucide-react'
import { useApp } from '../../contexts/AppContext'
import { useT, LANGUAGES } from '../../i18n'

function buildNavGroups(t) {
  return [
    {
      label: t('grp_main'),
      items: [
        { to: '/',           icon: LayoutDashboard, label: t('nav_dashboard') },
        { to: '/disease',    icon: ScanLine,         label: t('nav_disease') },
        { to: '/pest',       icon: Bug,              label: t('nav_pest') },
      ],
    },
    {
      label: t('grp_market_weather'),
      items: [
        { to: '/market',     icon: TrendingUp,  label: t('nav_market') },
        { to: '/chatbot',    icon: Bot,         label: t('nav_chatbot') },
        { to: '/weather',    icon: CloudSun,    label: t('nav_weather') },
      ],
    },
    {
      label: t('grp_farm'),
      items: [
        { to: '/crop',            icon: Sprout,       label: t('nav_crop_advisor') },
        { to: '/crop-cycle',      icon: RotateCcw,    label: t('nav_crop_cycle') },
        { to: '/fertilizer',      icon: FlaskConical, label: t('nav_fertilizer') },
        { to: '/expense',         icon: Calculator,   label: t('nav_expense') },
        { to: '/soil-passport',   icon: BookMarked,   label: t('nav_soil') },
      ],
    },
    {
      label: t('grp_intelligence'),
      items: [
        { to: '/analytics',    icon: BarChart3,     label: t('nav_analytics') },
        { to: '/outbreak-map', icon: Map,           label: t('nav_outbreak') },
        { to: '/logistics',    icon: Truck,         label: 'Fleet Optimizer',   badge: 'QUANTUM' },
        { to: '/satellite',    icon: Satellite,     label: 'Satellite Oracle',  badge: 'NEW' },
        { to: '/schemes',      icon: FileText,      label: t('nav_schemes') },
        { to: '/complaints',   icon: MessageSquare, label: t('nav_complaints') },
        { to: '/admin',        icon: Shield,        label: t('nav_admin') },
      ],
    },
  ]
}

/* Animated leaf SVG logo mark */
function AnimatedLeaf() {
  return (
    <motion.svg
      width="20" height="20" viewBox="0 0 24 24" fill="none"
      animate={{ scale: [1, 1.14, 1], rotate: [0, 5, -4, 0] }}
      transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
    >
      <path
        d="M12 22C12 22 3 16 3 9a9 9 0 0 1 18 0c0 7-9 13-9 13Z"
        fill="rgba(34,197,94,0.18)" stroke="#22C55E" strokeWidth="1.5" strokeLinejoin="round"
      />
      <path d="M12 22V9" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" />
    </motion.svg>
  )
}

/* Single nav item with accent bar + hover gradient */
function NavItem({ to, icon, label, badge, onNavigate }) {
  return (
    <li>
      <NavLink
        to={to}
        end={to === '/'}
        onClick={onNavigate}
        className="group relative flex items-center gap-2.5 px-2.5 py-[7px] rounded text-sm font-medium overflow-hidden"
      >
        {({ isActive }) => (
          <>
            {/* Hover gradient — always mounted, opacity-driven */}
            <span
              className="absolute inset-0 rounded pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              style={{ background: 'linear-gradient(90deg, rgba(34,197,94,0.09) 0%, transparent 80%)' }}
            />

            {/* Active background pill */}
            {isActive && (
              <motion.span
                layoutId="nav-active-bg"
                className="absolute inset-0 rounded pointer-events-none"
                style={{ background: 'linear-gradient(90deg, rgba(34,197,94,0.13) 0%, transparent 85%)' }}
                transition={{ type: 'spring', stiffness: 380, damping: 36 }}
              />
            )}

            {/* Left accent bar */}
            <AnimatePresence>
              {isActive && (
                <motion.span
                  layoutId="nav-accent"
                  className="absolute left-0 top-[6px] bottom-[6px] w-[3px] rounded-full bg-primary"
                  initial={{ scaleY: 0, opacity: 0 }}
                  animate={{ scaleY: 1, opacity: 1 }}
                  exit={{ scaleY: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                />
              )}
            </AnimatePresence>

            <motion.span
              whileHover={{ scale: 1.12, rotate: 5 }}
              transition={{ duration: 0.18, type: 'spring', stiffness: 400, damping: 20 }}
              className="relative shrink-0 flex items-center"
            >
              {isValidElement(icon)
                ? cloneElement(icon, {
                    className: [
                      'transition-colors duration-150',
                      isActive ? 'text-primary' : 'text-text-3 group-hover:text-text-2',
                    ].join(' '),
                  })
                : (() => {
                    const Icon = icon
                    return (
                      <Icon
                        size={15}
                        className={[
                          'transition-colors duration-150',
                          isActive ? 'text-primary' : 'text-text-3 group-hover:text-text-2',
                        ].join(' ')}
                      />
                    )
                  })()}
            </motion.span>
            <span
              className={[
                'relative transition-colors duration-150',
                isActive ? 'text-primary font-semibold' : 'text-text-2 group-hover:text-text-1',
              ].join(' ')}
            >
              {label}
            </span>
            {badge && (
              <span
                className="ml-auto text-[9px] font-semibold px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(139,92,246,0.18)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.3)' }}
              >
                {badge}
              </span>
            )}
          </>
        )}
      </NavLink>
    </li>
  )
}

export default function Sidebar() {
  const { state, dispatch } = useApp()
  const navigate = useNavigate()
  const t = useT()
  const navGroups = buildNavGroups(t)

  const closeNav = () => dispatch({ type: 'CLOSE_SIDEBAR' })

  function logout() {
    dispatch({ type: 'LOGOUT' })
    navigate('/profile')
  }

  return (
    <>
      {/* Mobile overlay */}
      {state.sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={closeNav} />
      )}

      <aside
        aria-label="Site navigation"
        className={[
          'fixed top-0 left-0 h-full z-40 flex flex-col',
          'w-[220px] bg-[#0A1510]',
          'transition-transform duration-300 ease-expo-out',
          state.sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        ].join(' ')}
        style={{ boxShadow: '1px 0 0 rgba(34,197,94,0.15)' }}
      >
        {/* Logo */}
        <div
          className="flex items-center justify-between h-14 px-4 shrink-0"
          style={{ borderBottom: '1px solid rgba(34,197,94,0.08)' }}
        >
          <NavLink to="/" className="flex items-center gap-2.5" onClick={closeNav}>
            <AnimatedLeaf />
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '0.975rem', color: '#E8F0EA', letterSpacing: '-0.01em' }}>
              AgriSahayak
            </span>
          </NavLink>
          <button className="btn-icon lg:hidden" onClick={closeNav} aria-label="Close navigation menu">
            <X size={16} />
          </button>
        </div>

        {/* Language picker */}
        <div className="px-3 pt-2.5 pb-2 shrink-0" style={{ borderBottom: '1px solid rgba(34,197,94,0.06)' }}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Globe size={11} className="text-text-3" aria-hidden="true" />
            <span className="text-text-3 text-[10px] font-medium uppercase tracking-wide">{t('language')}</span>
          </div>
          <select
            id="sidebar-language-picker"
            aria-label="Select display language"
            value={state.language}
            onChange={e => {
              dispatch({ type: 'SET_LANGUAGE', payload: e.target.value })
              localStorage.setItem('appLanguage', e.target.value)
            }}
            className="w-full text-xs rounded-md px-2 py-1.5 bg-surface-2 border border-border text-text-1 focus:outline-none focus:border-primary transition-colors cursor-pointer"
          >
            {LANGUAGES.map(l => (
              <option key={l.code} value={l.code}>{l.native}</option>
            ))}
          </select>
        </div>

        {/* Nav */}
        <nav aria-label="Main navigation" className="flex-1 overflow-y-auto py-3 px-2 space-y-5">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="section-title px-2 mb-1">{group.label}</p>
              <ul className="space-y-0.5">
                {group.items.map(({ to, path, icon, label, badge }) => (
                  <NavItem
                    key={to || path}
                    to={to || path}
                    icon={icon}
                    label={label}
                    badge={badge}
                    onNavigate={closeNav}
                  />
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-2 py-3 shrink-0 space-y-1" style={{ borderTop: '1px solid rgba(34,197,94,0.08)' }}>
          <NavLink
            to="/profile"
            onClick={closeNav}
            className={({ isActive }) =>
              [
                'flex items-center gap-2.5 px-2.5 py-2 rounded text-sm font-medium transition-all duration-150',
                isActive ? 'bg-primary/10 text-primary' : 'text-text-2 hover:bg-surface-2 hover:text-text-1',
              ].join(' ')
            }
          >
            <div className="w-6 h-6 rounded-sm bg-surface-3 flex items-center justify-center text-xs font-bold text-primary shrink-0">
              {state.farmer?.name?.charAt(0)?.toUpperCase() || 'F'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-text-1 text-xs font-medium truncate">{state.farmer?.name || 'Guest Farmer'}</p>
              <p className="text-text-3 text-xs truncate">{state.farmer?.phone || 'Not logged in'}</p>
            </div>
          </NavLink>

          {state.farmer && (
            <button
              onClick={logout}
              aria-label="Log out of AgriSahayak"
              className="flex items-center gap-2.5 px-2.5 py-2 rounded text-sm text-text-2 hover:bg-red-500/10 hover:text-red-400 transition-all duration-150 w-full"
            >
              <LogOut size={14} aria-hidden="true" />
              <span>{t('logout')}</span>
            </button>
          )}

          {!state.isOnline && (
            <div className="px-2.5 py-1.5 rounded bg-amber-500/10 text-amber-400 text-xs flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              {t('offline')}
            </div>
          )}

          {/* System Status */}
          <div
            className="mx-0.5 mt-1 px-2.5 py-2 rounded"
            style={{ background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.08)' }}
          >
            <div className="flex items-center gap-2">
              <span className="relative flex w-2 h-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              <span className="text-xs text-text-3">
                System&nbsp;<span className="text-primary font-medium">{t('system_online')}</span>
              </span>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
