import { ReactNode, useEffect, useRef, useState } from 'react'
import { NavLink, useNavigate, useLocation, Link } from 'react-router-dom'
import { Home, GraduationCap, Shield, Settings, Calendar, Bell, ChevronLeft, CalendarCheck, X, LogOut, Star, Search, Heart } from 'lucide-react'
import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'
import { subscribeToPush, updateAppBadge } from '../lib/pushNotifications'

const isSupervisor = (roles?: string[]) =>
  !!roles?.some(r => r === 'SUPERVISOR' || r === 'SUPERVISOR_CANDIDATE')

interface Notif {
  id: string
  type: string
  title: string
  link: string
  createdAt: string
}

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [pendingCount, setPendingCount] = useState(0)
  const [eventsNotifCount, setEventsNotifCount] = useState(0)
  const [notifs, setNotifs] = useState<Notif[]>([])
  const [showNotifs, setShowNotifs] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)

  const isDashboard = location.pathname === '/dashboard'

  const EVENT_NOTIF_TYPES = new Set([
    'NEW_EVENT', 'EVENT_REMINDER', 'EVENT_RECORDING_AVAILABLE',
    'EVENT_REGISTRATION_CONFIRMED', 'EVENT_PAYMENT_DETAILS_SENT',
    'EVENT_REGISTRATION_REJECTED',
  ])

  const fetchNotifs = () => {
    if (user) {
      api.get('/notifications').then(res => {
        const data: Notif[] = res.data
        setNotifs(data)
        setEventsNotifCount(data.filter(n => EVENT_NOTIF_TYPES.has(n.type)).length)
      }).catch(() => {})
    }
  }

  useEffect(() => {
    if (isSupervisor(user?.roles)) {
      Promise.all([
        api.get('/supervisions/pending'),
        api.get('/skills-groups/pending'),
      ]).then(([supRes, sgRes]) => {
        setPendingCount(supRes.data.length + sgRes.data.length)
      }).catch(() => {})
    }
    fetchNotifs()
    if (user) subscribeToPush().catch(() => {})

    const interval = setInterval(fetchNotifs, 30_000)
    return () => clearInterval(interval)
  }, [user])

  useEffect(() => {
    updateAppBadge(notifs.length)
  }, [notifs.length])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifs(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleNotifClick = (n: Notif) => {
    api.post(`/notifications/${n.id}/read`).catch(() => {})
    setNotifs(prev => prev.filter(x => x.id !== n.id))
    setShowNotifs(false)
    navigate(n.link)
  }

  const markAllRead = () => {
    api.post('/notifications/mark-read').catch(() => {})
    setNotifs([])
    setShowNotifs(false)
  }

  const handleLogout = () => { logout(); navigate('/login') }

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
    : '?'

  const navItems = [
    { to: '/dashboard',           icon: Home,          label: 'Головна',       show: true,                          badge: 0 },
    { to: '/supervisions',        icon: GraduationCap, label: 'Моє навчання',  show: true,                          badge: 0 },
    { to: '/events',              icon: Star,          label: 'Події',         show: true,                          badge: eventsNotifCount },
    { to: '/slots',               icon: Calendar,      label: 'Слоти',         show: false,                         badge: 0 },
    { to: '/my-bookings',         icon: CalendarCheck, label: 'Бронювання',    show: false,                         badge: 0 },
    { to: '/my-events',           icon: CalendarCheck, label: 'Мої заходи',    show: false,                         badge: 0 },
    { to: '/community',           icon: Heart,         label: 'Спільнота EFT', show: true,                          badge: 0 },
    { to: '/therapist-requests',  icon: Search,        label: 'Пошук терапевта', show: true,                        badge: 0 },
    { to: '/supervisor',          icon: Shield,        label: 'Супервізор',    show: isSupervisor(user?.roles),     badge: pendingCount },
    { to: '/admin',               icon: Settings,      label: 'Адмін',         show: !!user?.roles.includes('ADMIN'), badge: 0 },
  ].filter(item => item.show)

  const isAdmin = !!user?.roles.includes('ADMIN')
  const isSup = isSupervisor(user?.roles) ||
    user?.eftLevel === 'SUPERVISOR' ||
    user?.eftLevel === 'SUPERVISOR_CANDIDATE'

  const mobileNavItems = [
    { to: '/dashboard',          icon: Home,   label: 'Головна',  badge: 0 },
    { to: '/events',             icon: Star,   label: 'Події',    badge: eventsNotifCount },
    { to: '/community',          icon: Heart,  label: 'Спільнота', badge: 0 },
    { to: '/therapist-requests', icon: Search, label: 'Пошук',    badge: 0 },
    ...(isSup   ? [{ to: '/supervisor', icon: Shield,   label: 'Супервізор', badge: pendingCount }] : []),
    ...(isAdmin ? [{ to: '/admin',      icon: Settings, label: 'Адмін',      badge: 0 }]           : []),
  ]

  return (
    <div className="min-h-screen font-mulish flex flex-col">

      {/* ── Topbar — floating pill ── */}
      <header className="sticky top-0 z-50 px-5 sm:px-7 pt-4 pb-2">
        <div
          className="grid items-center mx-auto rounded-pill px-4 sm:px-6 py-3 max-w-[1560px]"
          style={{
            gridTemplateColumns: '1fr auto 1fr',
            background: 'rgba(252,248,245,.78)',
            backdropFilter: 'blur(18px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(18px) saturate(1.4)',
            boxShadow: 'var(--clay-sm)',
          }}
        >
          {/* Left: back button */}
          <div className="flex items-center">
            {!isDashboard && (
              <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-1.5 text-[color:var(--ink-2)] hover:text-[color:var(--rose-ink)] text-sm font-semibold transition-colors"
              >
                <ChevronLeft size={15} />
                Назад
              </button>
            )}
          </div>

          {/* Center: logo */}
          <Link to="/dashboard" className="flex items-center justify-center">
            <img
              src="/illustrations/Logo_obiymu.png"
              alt="Обійму"
              className="h-9 object-contain"
            />
          </Link>

          {/* Right: bell + avatar + logout */}
          <div className="flex items-center justify-end gap-2">

            {/* Bell */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setShowNotifs(p => !p)}
                className="relative w-10 h-10 rounded-pill flex items-center justify-center bg-surface hover:text-[color:var(--rose-ink)] transition-all"
                style={{ boxShadow: 'var(--clay-sm)', color: 'var(--ink-2)' }}
              >
                <Bell size={17} />
                {notifs.length > 0 && (
                  <span className="absolute top-2 right-2 min-w-[14px] h-3.5 bg-terra text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                    {notifs.length > 9 ? '9+' : notifs.length}
                  </span>
                )}
              </button>

              {showNotifs && (
                <div
                  className="absolute right-0 top-full mt-2 w-80 rounded-clay-lg z-50 overflow-hidden"
                  style={{ background: 'var(--surface)', boxShadow: 'var(--clay)' }}
                >
                  <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--line)' }}>
                    <p className="text-sm font-bold" style={{ color: 'var(--ink)' }}>Сповіщення</p>
                    <div className="flex items-center gap-2">
                      {notifs.length > 0 && (
                        <button
                          onClick={markAllRead}
                          className="text-xs font-semibold hover:opacity-70 transition"
                          style={{ color: 'var(--rose-deep)' }}
                        >
                          Всі прочитані
                        </button>
                      )}
                      <button
                        onClick={() => setShowNotifs(false)}
                        className="hover:opacity-60 transition"
                        style={{ color: 'var(--ink-3)' }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="max-h-72 overflow-y-auto">
                    {notifs.length === 0 ? (
                      <div className="text-center py-8">
                        <Bell size={20} className="mx-auto mb-2" style={{ color: 'var(--ink-3)' }} />
                        <p className="text-sm italic font-cormorant" style={{ color: 'var(--ink-3)' }}>Немає нових сповіщень</p>
                      </div>
                    ) : (
                      notifs.map((n, i) => (
                        <button
                          key={n.id}
                          onClick={() => handleNotifClick(n)}
                          className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-[color:var(--surface-2)] transition-colors"
                          style={{ borderTop: i > 0 ? '1px solid var(--line)' : 'none' }}
                        >
                          <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: 'var(--rose-deep)' }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold leading-snug" style={{ color: 'var(--ink)' }}>{n.title}</p>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--ink-3)' }}>
                              {format(new Date(n.createdAt), 'd MMM, HH:mm', { locale: uk })}
                            </p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Avatar → profile */}
            <Link
              to="/profile"
              title="Мій профіль"
              className="w-10 h-10 rounded-pill overflow-hidden flex items-center justify-center text-white text-sm font-bold hover:opacity-90 transition shrink-0"
              style={{
                background: 'linear-gradient(135deg, #E9C3CC, #C77E91)',
                boxShadow: 'var(--clay-sm)',
              }}
            >
              {user?.avatarUrl
                ? <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                : initials}
            </Link>

            {/* Logout */}
            <button
              onClick={handleLogout}
              title="Вийти"
              className="w-10 h-10 rounded-pill flex items-center justify-center hover:text-[color:var(--rose-ink)] transition-all"
              style={{ color: 'var(--ink-3)' }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1">

        {/* ── Sidebar desktop ── */}
        <nav className="hidden md:flex flex-col w-[264px] sticky top-[92px] h-[calc(100vh-92px)] shrink-0 px-4 pb-7 overflow-y-auto">

          {/* Nav items */}
          <div className="flex flex-col gap-1 py-3 flex-1">
            {navItems.map(({ to, icon: Icon, label, badge }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `neu-nav-item flex items-center gap-3.5 px-5 py-3.5 font-bold text-[15px] transition-all ${
                    isActive ? 'neu-nav-active' : ''
                  }`
                }
                style={({ isActive }) =>
                  isActive ? {} : { color: 'var(--ink-2)' }
                }
              >
                <Icon size={18} strokeWidth={1.75} className="shrink-0" />
                <span className="flex-1">{label}</span>
                {badge > 0 && (
                  <span
                    className="min-w-[22px] h-[22px] px-1.5 rounded-pill text-white text-[11px] font-bold flex items-center justify-center"
                    style={{ background: 'var(--terra)' }}
                  >
                    {badge}
                  </span>
                )}
              </NavLink>
            ))}
          </div>

          {/* Bottom illustration */}
          <div className="shrink-0 flex items-end justify-center px-2">
            <img
              src="/illustrations/embrace.png"
              alt=""
              className="w-full object-contain opacity-90"
            />
          </div>
        </nav>

        {/* ── Main content ── */}
        <main className="flex-1 px-5 sm:px-7 pt-4 pb-28 md:pb-10 min-w-0 max-w-[1296px]">
          {children}
        </main>
      </div>

      {/* ── Mobile bottom nav ── */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 px-3 pb-3 pt-1"
        style={{ background: 'rgba(252,248,245,.88)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)' }}
      >
        <div
          className="flex rounded-pill overflow-x-auto"
          style={{
            boxShadow: 'var(--clay-sm)',
            background: 'rgba(252,248,245,.95)',
            scrollbarWidth: 'none',
          }}
        >
          {mobileNavItems.map(({ to, icon: Icon, label, badge }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex-1 min-w-[60px] flex flex-col items-center py-2.5 gap-0.5 text-[10px] font-bold transition whitespace-nowrap ${
                  isActive ? '' : ''
                }`
              }
              style={({ isActive }) => ({
                color: isActive ? 'var(--rose-ink)' : 'var(--ink-3)',
              })}
            >
              <span className="relative">
                <Icon size={20} strokeWidth={1.75} />
                {badge > 0 && (
                  <span
                    className="absolute -top-1 -right-1.5 w-3.5 h-3.5 rounded-full border-2 border-white"
                    style={{ background: 'var(--terra)' }}
                  />
                )}
              </span>
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
