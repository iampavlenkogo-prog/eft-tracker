import { ReactNode, useEffect, useRef, useState } from 'react'
import { NavLink, useNavigate, useLocation, Link } from 'react-router-dom'
import { Home, Users, BookOpen, FileText, Shield, Settings, Calendar, Bell, ChevronLeft, CalendarCheck, X, LogOut, Star, Search, Flower2 } from 'lucide-react'
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

  // Close dropdown on outside click
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
    { to: '/dashboard', icon: Home, img: null, label: 'Головна', show: true, badge: 0 },
    { to: '/supervisions', icon: Users, img: null, label: 'Супервізії', show: true, badge: 0 },
    { to: '/seminars', icon: BookOpen, img: null, label: 'Семінари', show: true, badge: 0 },
    { to: '/events', icon: Star, img: null, label: 'Події', show: true, badge: eventsNotifCount },
    { to: '/slots', icon: Calendar, img: null, label: 'Слоти', show: false, badge: 0 },
    { to: '/my-bookings', icon: CalendarCheck, img: null, label: 'Мої бронювання', show: false, badge: 0 },
    { to: '/my-events', icon: CalendarCheck, img: null, label: 'Мої заходи', show: false, badge: 0 },
    { to: '/community', icon: Flower2, img: null, label: 'Спільнота EFT', show: true, badge: 0 },
    { to: '/therapist-requests', icon: Search, img: null, label: 'Пошук терапевта', show: true, badge: 0 },
    { to: '/reports', icon: FileText, img: null, label: 'Звіти', show: true, badge: 0 },
    { to: '/supervisor', icon: Shield, img: null, label: 'Супервізор', show: isSupervisor(user?.roles), badge: pendingCount },
    { to: '/admin', icon: Settings, img: null, label: 'Адмін', show: !!user?.roles.includes('ADMIN'), badge: 0 },
  ].filter(item => item.show)

  const isAdmin = !!user?.roles.includes('ADMIN')
  const isSup = isSupervisor(user?.roles) ||
    user?.eftLevel === 'SUPERVISOR' ||
    user?.eftLevel === 'SUPERVISOR_CANDIDATE'

  const mobileNavItems = [
    { to: '/dashboard', icon: Home, label: 'Головна', badge: 0 },
    { to: '/events', icon: Star, label: 'Події', badge: eventsNotifCount },
    { to: '/community', icon: Flower2, label: 'Спільнота', badge: 0 },
    { to: '/therapist-requests', icon: Search, label: 'Пошук', badge: 0 },
    { to: '/reports', icon: FileText, label: 'Звіти', badge: 0 },
    ...(isSup ? [{ to: '/supervisor', icon: Shield, label: 'Супервізор', badge: pendingCount }] : []),
    ...(isAdmin ? [{ to: '/admin', icon: Settings, label: 'Адмін', badge: 0 }] : []),
  ]

  return (
    <div className="min-h-screen bg-cream flex flex-col font-inter">

      {/* ── Header ── */}
      <header className="bg-white/90 backdrop-blur-sm border-b border-sand h-16 flex items-center justify-between px-5 sticky top-0 z-20">
        {/* Left: back */}
        <div className="w-28">
          {!isDashboard && (
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 text-warm-mid hover:text-warm-dark text-sm transition"
            >
              <ChevronLeft size={15} />
              Назад
            </button>
          )}
        </div>

        {/* Center: logo */}
        <div className="flex items-center justify-center">
          <img src="/illustrations/Logo_obiymu.png" alt="Обійму" className="h-10 object-contain" />
        </div>

        {/* Right: bell + avatar + logout */}
        <div className="flex items-center gap-2 w-36 justify-end">

          {/* Bell with dropdown */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setShowNotifs(p => !p)}
              className="relative p-1.5 hover:bg-beige rounded-xl transition"
            >
              <Bell size={18} className="text-warm-light" />
              {notifs.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-orange-400 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5">
                  {notifs.length > 9 ? '9+' : notifs.length}
                </span>
              )}
            </button>

            {showNotifs && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-sand z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-sand">
                  <p className="text-sm font-medium text-warm-dark">Сповіщення</p>
                  <div className="flex items-center gap-2">
                    {notifs.length > 0 && (
                      <button
                        onClick={markAllRead}
                        className="text-xs text-rose hover:opacity-70 transition"
                      >
                        Всі прочитані
                      </button>
                    )}
                    <button onClick={() => setShowNotifs(false)} className="text-warm-light hover:text-warm-mid transition">
                      <X size={15} />
                    </button>
                  </div>
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-sand">
                  {notifs.length === 0 ? (
                    <div className="text-center py-8">
                      <Bell size={20} className="text-warm-light mx-auto mb-2" />
                      <p className="text-sm text-warm-light italic">Немає нових сповіщень</p>
                    </div>
                  ) : (
                    notifs.map(n => (
                      <button
                        key={n.id}
                        onClick={() => handleNotifClick(n)}
                        className="w-full text-left px-4 py-3 hover:bg-beige transition flex items-start gap-3"
                      >
                        <div className="w-2 h-2 rounded-full bg-orange-400 mt-1.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-warm-dark font-medium leading-snug">{n.title}</p>
                          <p className="text-xs text-warm-light mt-0.5">
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
            className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-rose-light to-rose/80 flex items-center justify-center text-white text-sm font-semibold shadow-sm hover:opacity-90 transition shrink-0"
          >
            {user?.avatarUrl
              ? <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
              : initials}
          </Link>

          {/* Logout */}
          <button
            onClick={handleLogout}
            title="Вийти"
            className="p-1.5 hover:bg-beige rounded-xl transition text-warm-light hover:text-rose shrink-0"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* ── Sidebar desktop ── */}
        <nav className="hidden md:flex flex-col w-[260px] bg-beige border-r border-sand sticky top-16 h-[calc(100vh-64px)] shrink-0">

          {/* Nav items */}
          <div className="px-3 py-4 space-y-0.5 overflow-y-auto flex-1">
            {navItems.map(({ to, icon: Icon, img, label, badge }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition ${
                    isActive
                      ? 'bg-white text-rose font-medium shadow-sm'
                      : 'text-warm-mid hover:bg-white/60 hover:text-warm-dark'
                  }`
                }
              >
                {img
                  ? <img src={img} alt="" className="w-4 h-4 object-contain shrink-0" />
                  : <Icon size={16} strokeWidth={1.75} />
                }
                <span className="flex-1">{label}</span>
                {badge > 0 && (
                  <span className="text-xs bg-orange-400 text-white rounded-full w-5 h-5 flex items-center justify-center font-medium">
                    {badge}
                  </span>
                )}
              </NavLink>
            ))}
          </div>

          {/* Bottom illustration */}
          <div className="shrink-0 flex items-end justify-center px-2 pb-2">
            <img
              src="/illustrations/embrace.png"
              alt=""
              className="w-full object-contain opacity-90"
            />
          </div>
        </nav>

        {/* ── Main content ── */}
        <main className="flex-1 p-6 pb-28 md:pb-8 min-w-0">
          {children}
        </main>
      </div>

      {/* ── Mobile bottom nav ── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.06)] z-40">
        <div
          className="flex overflow-x-auto"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
        >
          {mobileNavItems.map(({ to, icon: Icon, label, badge }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex-1 min-w-[60px] flex flex-col items-center py-2.5 gap-0.5 text-[10px] transition whitespace-nowrap ${
                  isActive ? 'text-rose' : 'text-warm-light'
                }`
              }
            >
              <span className="relative">
                <Icon size={20} strokeWidth={1.75} />
                {badge > 0 && (
                  <span className="absolute -top-1 -right-1.5 w-[14px] h-[14px] bg-orange-400 rounded-full border-2 border-white" />
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
