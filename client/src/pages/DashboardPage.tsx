import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Heart, BookOpen, ChevronRight, ChevronLeft, Calendar, CalendarDays, Clock, User, Star } from 'lucide-react'
import Layout from '../components/Layout'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import { format } from 'date-fns'
import { uk } from 'date-fns/locale'

interface Stats {
  supervisions: number
  seminars: number
  points: number
}

interface Phrase {
  id: string
  text: string
  author: { id: string; firstName: string; lastName: string }
  savedByMe: boolean
}

interface AvailableSlot {
  id: string
  date: string
  time: string
  duration: number
  type: 'INDIVIDUAL' | 'GROUP'
  supervisor: { firstName: string; lastName: string }
}

interface Booking {
  id: string
  status: string
  meetingLink: string | null
  slot: {
    date: string
    time: string
    duration: number
    supervisor: { firstName: string; lastName: string; telegram: string | null; meetingLink: string | null }
  }
}

interface UpcomingEvent {
  id: string
  title: string
  description: string
  date: string
  startTime: string | null
  endTime: string | null
  price: number
  currency: string
  coverImageUrl: string | null
  registrationClosed: boolean
  maxParticipants: number | null
  status: string
  organizer: { firstName: string; lastName: string; avatarUrl: string | null }
  registrations: { id: string; status: string }[]
  _count: { registrations: number }
}

interface GroupSupervision {
  id: string
  title: string
  scheduledDate: string
  scheduledTime: string
  duration: number
  status: string
  price: number
  currency: string
  supervisor: { firstName: string; lastName: string }
  presenterUser: { firstName: string; lastName: string } | null
  participants: { userId: string; paymentStatus: string; isPresenter: boolean }[]
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [stats, setStats] = useState<Stats>({ supervisions: 0, seminars: 0, points: 0 })
  const [phrases, setPhrases] = useState<Phrase[]>([])
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([])
  const [upcomingBooking, setUpcomingBooking] = useState<Booking | null>(null)
  const [activeGroups, setActiveGroups] = useState<GroupSupervision[]>([])
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([])
  const [mobileEventIdx, setMobileEventIdx] = useState(0)

  useEffect(() => {
    api.get('/dashboard/stats').then(res => setStats(res.data)).catch(() => {})
    api.get('/phrases?limit=5&random=true').then(res => setPhrases(res.data)).catch(() => {})
    api.get('/slots/available?limit=3').then(res => setAvailableSlots(res.data)).catch(() => {})
    api.get('/bookings/my').then(res => {
      const today = new Date().toISOString().slice(0, 10)
      const upcoming = (res.data as Booking[])
        .filter(b => b.status === 'APPROVED' && b.slot.date >= today)
        .sort((a, b) => a.slot.date.localeCompare(b.slot.date) || a.slot.time.localeCompare(b.slot.time))
      setUpcomingBooking(upcoming[0] ?? null)
    }).catch(() => {})
    api.get('/group-supervisions').then(res => {
      const relevant = (res.data as GroupSupervision[]).filter(g =>
        ['WAITING_FOR_CASE', 'CASE_CONFIRMED', 'REGISTRATION_OPEN', 'RECORDING_AVAILABLE'].includes(g.status)
      ).slice(0, 3)
      setActiveGroups(relevant)
    }).catch(() => {})
    api.get('/events').then(res => {
      const now = new Date()
      const upcoming = (res.data as UpcomingEvent[])
        .filter(e => e.status === 'PUBLISHED' && new Date(e.date) >= now)
        .slice(0, 5)
      setUpcomingEvents(upcoming)
    }).catch(() => {})
  }, [])

  const toggleSave = async (phrase: Phrase) => {
    setPhrases(prev => prev.map(p => p.id === phrase.id ? { ...p, savedByMe: !p.savedByMe } : p))
    try {
      if (phrase.savedByMe) {
        await api.delete(`/phrases/${phrase.id}/save`)
      } else {
        await api.post(`/phrases/${phrase.id}/save`)
      }
    } catch {
      setPhrases(prev => prev.map(p => p.id === phrase.id ? { ...p, savedByMe: phrase.savedByMe } : p))
    }
  }

  const groupStatusLabel: Record<string, string> = {
    WAITING_FOR_CASE: 'Очікує супервізанта',
    CASE_CONFIRMED: 'Незабаром реєстрація',
    REGISTRATION_OPEN: 'Реєстрація відкрита',
    RECORDING_AVAILABLE: 'Запис доступний',
  }
  const groupStatusCls: Record<string, string> = {
    WAITING_FOR_CASE: 'bg-[#FFF3E0] text-[#E6930A]',
    CASE_CONFIRMED: 'bg-[#E3F2FD] text-[#1976D2]',
    REGISTRATION_OPEN: 'bg-[#E8F5E9] text-[#4CAF50]',
    RECORDING_AVAILABLE: 'bg-[#E8F5E9] text-[#4CAF50]',
  }
  const myStatusLabel: Record<string, string> = {
    PENDING: 'Зареєстровано — очікує оплати',
    RECEIPT_UPLOADED: 'Квитанцію надіслано',
    CONFIRMED: 'Участь підтверджена',
    FREE: 'Участь підтверджена',
  }
  const myStatusCls: Record<string, string> = {
    PENDING: 'text-[#E6930A]',
    RECEIPT_UPLOADED: 'text-[#1976D2]',
    CONFIRMED: 'text-[#4CAF50]',
    FREE: 'text-[#4CAF50]',
  }
  const myStatusIcon: Record<string, string> = {
    PENDING: '⚠️', RECEIPT_UPLOADED: '📎', CONFIRMED: '✅', FREE: '✅',
  }

  return (
    <Layout>
      {/* ── Greeting ── */}
      <div className="mb-8">
        <h1 className="font-cormorant text-4xl text-warm-dark font-semibold leading-tight">
          Вітаємо, {user?.firstName} ♡
        </h1>
        <p className="font-cormorant italic text-warm-mid text-lg mt-1">
          Ваша база навчання в методі ЕФТ
        </p>
      </div>

      <div className="flex gap-6 items-start">

        {/* ── Main content column ── */}
        <div className="flex-1 min-w-0 space-y-5">

          {/* Community calendar button */}
          <Link to="/calendar"
            className="group flex items-center gap-4 bg-white rounded-2xl shadow-sm p-4 hover:shadow-md transition-all duration-200 border border-sand/50">
            <div className="w-11 h-11 bg-[#EEF3FB] rounded-xl flex items-center justify-center shrink-0 group-hover:bg-[#DDE7F5] transition-colors">
              <CalendarDays size={20} className="text-[#4A7EC7]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-cormorant text-lg font-semibold text-warm-dark leading-tight">Календар спільноти</p>
              <p className="text-xs text-warm-light mt-0.5">Всі події, групові супервізії та заходи</p>
            </div>
            <ChevronRight size={18} className="text-warm-light group-hover:text-rose group-hover:translate-x-0.5 transition-all shrink-0" />
          </Link>

          {/* Stats cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl shadow-sm p-6 relative overflow-visible min-h-[240px] flex flex-col">
              <div className="max-w-[52%]">
                <p className="text-xs font-medium text-warm-light uppercase tracking-widest mb-1">Супервізії</p>
                <p className="text-xs text-warm-light mb-4">підтверджених сесій</p>
                <div className="flex items-baseline gap-2">
                  <span className="font-cormorant text-5xl font-light text-warm-dark">{stats.supervisions}</span>
                  <span className="text-sm text-warm-light">записів</span>
                </div>
              </div>
              <button onClick={() => navigate('/supervisions')} className="mt-auto text-sm text-rose hover:opacity-80 transition font-medium block pt-4 max-w-[52%]">
                Переглянути записи →
              </button>
              <img src="/illustrations/chairs.png" alt="" className="absolute bottom-[-16px] right-[-12px] w-[220px] object-contain pointer-events-none" />
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-6 relative overflow-visible min-h-[240px] flex flex-col">
              <div className="max-w-[52%]">
                <p className="text-xs font-medium text-warm-light uppercase tracking-widest mb-1">Семінари</p>
                <p className="text-xs text-warm-light mb-4">пройдено навчань</p>
                <div className="flex items-baseline gap-2">
                  <span className="font-cormorant text-5xl font-light text-warm-dark">{stats.seminars}</span>
                  <span className="text-sm text-warm-light">записів</span>
                </div>
              </div>
              <button onClick={() => navigate('/seminars')} className="mt-auto text-sm text-rose hover:opacity-80 transition font-medium block pt-4 max-w-[52%]">
                Переглянути записи →
              </button>
              <img src="/illustrations/books-coffee.png" alt="" className="absolute bottom-[-16px] right-[-12px] w-[220px] object-contain pointer-events-none" />
            </div>
          </div>

          {/* Upcoming booked supervision */}
          {upcomingBooking && (
            <div className="bg-gradient-to-r from-[#FDF0EC] to-beige rounded-2xl p-5 border border-rose-light">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-warm-light uppercase tracking-widest mb-1">Найближча супервізія</p>
                  <div className="flex flex-wrap gap-4 mt-2">
                    <div className="flex items-center gap-1.5 text-sm text-warm-dark font-medium">
                      <Calendar size={13} className="text-rose" />
                      {upcomingBooking.slot.date}
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-warm-mid">
                      <Clock size={13} className="text-warm-light" />
                      {upcomingBooking.slot.time} <span className="text-warm-light text-xs font-normal">Київський час</span> · {upcomingBooking.slot.duration} хв
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-warm-mid">
                      <User size={13} className="text-warm-light" />
                      {upcomingBooking.slot.supervisor.firstName} {upcomingBooking.slot.supervisor.lastName}
                    </div>
                  </div>
                  {(upcomingBooking.meetingLink || upcomingBooking.slot.supervisor.meetingLink) && (
                    <a href={(upcomingBooking.meetingLink || upcomingBooking.slot.supervisor.meetingLink)!} target="_blank" rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 bg-rose hover:bg-[#B5745A] text-white text-xs font-medium px-4 py-2 rounded-xl transition">
                      🎥 Приєднатися до зустрічі
                    </a>
                  )}
                </div>
                {upcomingBooking.slot.supervisor.telegram && (
                  <a href={`https://t.me/${upcomingBooking.slot.supervisor.telegram.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
                    className="shrink-0 flex items-center gap-2 bg-[#229ED9] hover:bg-[#1a8bc2] text-white text-sm font-medium px-4 py-2 rounded-xl transition">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.26 14.4l-2.95-.924c-.64-.203-.658-.64.135-.954l11.57-4.461c.537-.194 1.006.131.88.16z"/>
                    </svg>
                    Написати
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Mobile events carousel — shown only on small screens */}
          {upcomingEvents.length > 0 && (
            <div className="lg:hidden bg-white rounded-2xl shadow-sm overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose to-[#E8A090] flex items-center justify-center shadow-sm">
                    <Star size={14} className="text-white" fill="currentColor" />
                  </div>
                  <div>
                    <h3 className="font-cormorant text-xl font-semibold text-warm-dark leading-none">Події простору</h3>
                    <p className="text-[11px] text-warm-light mt-0.5">Анонси заходів для вас</p>
                  </div>
                </div>
                <Link to="/events" className="text-sm text-rose font-medium flex items-center gap-0.5">
                  Всі <ChevronRight size={14} />
                </Link>
              </div>

              {/* Card */}
              {(() => {
                const ev = upcomingEvents[mobileEventIdx]
                if (!ev) return null
                const reg = ev.registrations[0]
                const dateObj = new Date(ev.date)
                const dayStr = format(dateObj, 'd', { locale: uk })
                const monthStr = format(dateObj, 'MMM', { locale: uk })
                const spotsLeft = ev.maxParticipants ? ev.maxParticipants - ev._count.registrations : null
                const isFull = spotsLeft !== null && spotsLeft <= 0

                return (
                  <div>
                    {/* Image + arrows */}
                    <div className="relative h-56 overflow-hidden flex items-center justify-center">
                      {ev.coverImageUrl ? (
                        <>
                          {/* Blurred background fill */}
                          <img src={ev.coverImageUrl} alt="" aria-hidden="true"
                            className="absolute inset-0 w-full h-full object-cover scale-110 blur-md opacity-50" />
                          {/* Full uncropped image */}
                          <img src={ev.coverImageUrl} alt={ev.title}
                            className="relative z-10 w-full h-full object-contain" />
                        </>
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-[#F5DDD5] via-[#F0C9BD] to-[#E8A898] flex items-center justify-center">
                          <Star size={44} className="text-white/60" fill="currentColor" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent z-20" />

                      {/* Prev arrow */}
                      {mobileEventIdx > 0 && (
                        <button
                          onClick={() => setMobileEventIdx(i => i - 1)}
                          className="absolute left-3 top-1/2 -translate-y-1/2 z-30 w-10 h-10 bg-white/85 backdrop-blur-sm rounded-full shadow-md flex items-center justify-center text-warm-dark active:scale-95 transition-transform"
                        >
                          <ChevronLeft size={20} />
                        </button>
                      )}

                      {/* Next arrow */}
                      {mobileEventIdx < upcomingEvents.length - 1 && (
                        <button
                          onClick={() => setMobileEventIdx(i => i + 1)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 z-30 w-10 h-10 bg-white/85 backdrop-blur-sm rounded-full shadow-md flex items-center justify-center text-warm-dark active:scale-95 transition-transform"
                        >
                          <ChevronRight size={20} />
                        </button>
                      )}

                      {/* Date badge */}
                      <div className="absolute top-4 left-4 z-30 bg-white/95 backdrop-blur-sm rounded-xl px-3 py-2 shadow-sm text-center min-w-[44px]">
                        <p className="text-lg font-bold text-warm-dark leading-none">{dayStr}</p>
                        <p className="text-[11px] font-medium text-warm-mid uppercase tracking-wide leading-none mt-0.5">{monthStr}</p>
                      </div>

                      {/* Price badge */}
                      <div className={`absolute top-4 right-4 z-30 rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm ${
                        ev.price === 0 ? 'bg-emerald-500 text-white' : 'bg-white/95 text-warm-dark'
                      }`}>
                        {ev.price === 0 ? 'Безкоштовно' : `${ev.price} ${ev.currency}`}
                      </div>

                      {/* My status */}
                      {reg && (
                        <div className="absolute bottom-4 left-4 z-30">
                          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                            reg.status === 'CONFIRMED' ? 'bg-emerald-500 text-white' : 'bg-white/90 text-amber-700'
                          }`}>
                            {reg.status === 'CONFIRMED' ? '✓ Підтверджено' : 'Зареєстровано'}
                          </span>
                        </div>
                      )}

                      {/* Dots */}
                      {upcomingEvents.length > 1 && (
                        <div className="absolute bottom-4 right-4 z-30 flex gap-1.5">
                          {upcomingEvents.map((_, i) => (
                            <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === mobileEventIdx ? 'bg-white' : 'bg-white/35'}`} />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Body */}
                    <Link to={`/events/${ev.id}`} className="block px-5 py-4">
                      <h3 className="font-cormorant text-xl font-semibold text-warm-dark leading-snug mb-1.5 line-clamp-2">{ev.title}</h3>
                      <p className="text-sm text-warm-mid line-clamp-2 leading-relaxed mb-3">{ev.description}</p>
                      <div className="flex items-center justify-between text-xs text-warm-light">
                        <div className="flex items-center gap-3">
                          {ev.startTime && (
                            <span className="flex items-center gap-1"><Clock size={11} />{ev.startTime}{ev.endTime ? `–${ev.endTime}` : ''}</span>
                          )}
                          <span className="flex items-center gap-1"><User size={11} />{ev.organizer.firstName} {ev.organizer.lastName}</span>
                        </div>
                        {isFull
                          ? <span className="text-orange-500 font-medium">Місця вичерпані</span>
                          : !ev.registrationClosed && <span className="text-rose font-medium">Реєстрація відкрита</span>
                        }
                      </div>
                    </Link>
                  </div>
                )
              })()}
            </div>
          )}

          {/* Available supervisions */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="flex items-baseline justify-between gap-3 mb-4">
              <h3 className="font-cormorant text-xl font-semibold text-warm-dark">Доступні супервізії</h3>
              <Link to="/slots" className="text-xs text-rose hover:opacity-80 transition font-medium flex items-center gap-1">
                Всі слоти <ChevronRight size={13} />
              </Link>
            </div>
            {availableSlots.length === 0 ? (
              <p className="font-cormorant italic text-warm-light text-base">
                Поки немає доступних слотів. Зверніться до свого супервізора ♡
              </p>
            ) : (
              <div className="space-y-2">
                {availableSlots.map(slot => (
                  <div key={slot.id} className="flex items-center justify-between gap-4 bg-beige rounded-xl px-4 py-3">
                    <div className="flex flex-wrap gap-3 text-sm">
                      <span className="text-warm-dark font-medium flex items-center gap-1.5"><Calendar size={12} className="text-warm-light" />{slot.date}</span>
                      <span className="text-warm-mid flex items-center gap-1.5"><Clock size={12} className="text-warm-light" />{slot.time} <span className="text-xs text-warm-light">Київський час</span></span>
                      <span className="text-warm-mid flex items-center gap-1.5"><User size={12} className="text-warm-light" />{slot.supervisor.firstName} {slot.supervisor.lastName}</span>
                    </div>
                    <span className="text-xs bg-rose-light text-rose px-2 py-0.5 rounded-full shrink-0">
                      {slot.type === 'INDIVIDUAL' ? 'Інд.' : 'Груп.'}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <Link to="/slots" className="mt-4 flex items-center gap-1 text-sm text-rose hover:opacity-80 transition font-medium">
              Переглянути всі слоти <ChevronRight size={14} />
            </Link>
          </div>

          {/* Group supervisions */}
          {activeGroups.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h3 className="font-cormorant text-xl font-semibold text-warm-dark mb-4">Групові супервізії</h3>
              <div className="space-y-3">
                {activeGroups.map(g => {
                  const myP = g.participants.find(p => p.userId === user?.id)
                  return (
                    <Link key={g.id} to={`/group-supervisions/${g.id}`}
                      className="block bg-beige rounded-xl px-4 py-3 hover:bg-[#F0E6E0] transition">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-warm-dark truncate">{g.title}</p>
                          <div className="flex flex-wrap gap-3 mt-1 text-xs text-warm-mid">
                            <span className="flex items-center gap-1"><Calendar size={11} />{g.scheduledDate}</span>
                            <span className="flex items-center gap-1"><Clock size={11} />{g.scheduledTime} <span className="text-warm-light">Київський час</span></span>
                            <span className="flex items-center gap-1"><User size={11} />Супервізор: {g.supervisor.firstName} {g.supervisor.lastName}</span>
                            {g.presenterUser && (
                              <span className="flex items-center gap-1 text-rose"><User size={11} />Супервізант: {g.presenterUser.firstName} {g.presenterUser.lastName}</span>
                            )}
                            {myP?.isPresenter && <span className="text-rose font-medium">· Ви супервізант</span>}
                          </div>
                        </div>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${groupStatusCls[g.status] || 'bg-sand text-warm-mid'}`}>
                          {groupStatusLabel[g.status] || g.status}
                        </span>
                      </div>
                      {myP && (
                        <div className={`flex items-center gap-1.5 mt-2 pt-2 border-t border-sand/60 text-xs font-medium ${myStatusCls[myP.paymentStatus]}`}>
                          <span>{myStatusIcon[myP.paymentStatus]}</span>
                          <span>{myStatusLabel[myP.paymentStatus]}</span>
                        </div>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          )}


          {/* EFT Phrases block */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="flex items-baseline gap-3 mb-4">
              <h3 className="font-cormorant text-xl font-semibold text-warm-dark">Словник ЕФТ терапевта</h3>
              <p className="text-xs text-warm-light italic">Натисніть ♡ щоб зберегти фразу</p>
            </div>
            {phrases.length === 0 ? (
              <p className="font-cormorant italic text-warm-light text-base">Словник ще порожній. Додайте свій перший запис у профілі ♡</p>
            ) : (
              <div className="space-y-3">
                {phrases.map(phrase => (
                  <div key={phrase.id} className="bg-beige rounded-xl p-4 flex gap-3 items-start">
                    <div className="flex-1 min-w-0">
                      <p className="font-cormorant italic text-warm-dark text-base leading-relaxed">«{phrase.text}»</p>
                      <p className="text-xs text-warm-light mt-1.5">{phrase.author.firstName} {phrase.author.lastName}</p>
                    </div>
                    <button onClick={() => toggleSave(phrase)}
                      className={`shrink-0 mt-1 transition-colors ${phrase.savedByMe ? 'text-rose' : 'text-warm-light hover:text-rose'}`}
                      title={phrase.savedByMe ? 'Видалити з колекції' : 'Зберегти до колекції'}>
                      <Heart size={18} fill={phrase.savedByMe ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* My EFT Dictionary button */}
          <Link to="/profile#eft-dictionary"
            className="group bg-gradient-to-r from-[#FDF0EC] to-beige rounded-2xl p-5 flex items-center gap-4 border border-rose-light hover:shadow-md hover:border-rose/30 transition-all duration-200">
            <div className="w-12 h-12 bg-rose/10 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-rose/15 transition-colors">
              <BookOpen size={22} className="text-rose" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-cormorant text-lg font-semibold text-warm-dark leading-tight">Мій словник ЕФТ</p>
              <p className="text-xs text-warm-light mt-0.5">Ваші терміни, фрази та визначення</p>
            </div>
            <ChevronRight size={18} className="text-warm-light group-hover:text-rose group-hover:translate-x-0.5 transition-all shrink-0" />
          </Link>

          {/* Пам'ятай */}
          <div className="bg-beige rounded-2xl overflow-hidden flex">
            <img src="/illustrations/therapist-duo.png" alt="" className="w-48 object-cover shrink-0" />
            <div className="px-6 py-6 flex flex-col justify-center">
              <h3 className="font-cormorant text-xl font-semibold text-warm-dark mb-4">Пам'ятай ♡</h3>
              <p className="font-cormorant italic text-warm-mid text-base leading-relaxed">
                Ти робиш важливу справу.<br />
                Твоя присутність має значення.<br />
                Ти допомагаєш іншим знаходити<br />
                себе через зв'язок.
              </p>
            </div>
          </div>

        </div>{/* end main column */}

        {/* ── Events sidebar (desktop only) ── */}
        {upcomingEvents.length > 0 && (
          <aside className="hidden lg:block w-[300px] shrink-0 sticky top-20 space-y-3">

            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-rose to-[#E8A090] flex items-center justify-center shadow-sm">
                  <Star size={13} className="text-white" fill="currentColor" />
                </div>
                <h2 className="font-cormorant text-lg font-semibold text-warm-dark">Події простору</h2>
              </div>
              <Link to="/events" className="text-xs text-rose hover:opacity-70 transition font-medium flex items-center gap-0.5">
                Всі <ChevronRight size={12} />
              </Link>
            </div>

            {/* Event cards */}
            {upcomingEvents.map((ev, idx) => {
              const reg = ev.registrations[0]
              const dateObj = new Date(ev.date)
              const dayStr = format(dateObj, 'd', { locale: uk })
              const monthStr = format(dateObj, 'MMM', { locale: uk })
              const spotsLeft = ev.maxParticipants ? ev.maxParticipants - ev._count.registrations : null
              const isFull = spotsLeft !== null && spotsLeft <= 0

              return (
                <Link key={ev.id} to={`/events/${ev.id}`}
                  className="block group rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200 border border-sand/60">

                  {/* Cover / gradient */}
                  <div className="relative h-36 overflow-hidden">
                    {ev.coverImageUrl ? (
                      <img src={ev.coverImageUrl} alt={ev.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className={`w-full h-full ${
                        idx % 3 === 0 ? 'bg-gradient-to-br from-[#F5DDD5] via-[#F0C9BD] to-[#E8A898]'
                        : idx % 3 === 1 ? 'bg-gradient-to-br from-[#E8EEF5] via-[#D4E0ED] to-[#BDD0E8]'
                        : 'bg-gradient-to-br from-[#EEF0E8] via-[#DFE4D4] to-[#C8D4B8]'
                      } flex items-center justify-center`}>
                        <Star size={28} className="text-white/60" fill="currentColor" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

                    {/* Date badge */}
                    <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm rounded-xl px-2.5 py-1.5 shadow-sm text-center min-w-[40px]">
                      <p className="text-base font-bold text-warm-dark leading-none">{dayStr}</p>
                      <p className="text-[10px] font-medium text-warm-mid uppercase tracking-wide leading-none mt-0.5">{monthStr}</p>
                    </div>

                    {/* Price badge */}
                    <div className={`absolute top-3 right-3 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm ${
                      ev.price === 0 ? 'bg-emerald-500 text-white' : 'bg-white/95 text-warm-dark'
                    }`}>
                      {ev.price === 0 ? 'Безкоштовно' : `${ev.price} ${ev.currency}`}
                    </div>

                    {/* My status overlay */}
                    {reg && (
                      <div className="absolute bottom-3 left-3">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          reg.status === 'CONFIRMED' ? 'bg-emerald-500 text-white' : 'bg-white/90 text-amber-700'
                        }`}>
                          {reg.status === 'CONFIRMED' ? '✓ Підтверджено' : 'Зареєстровано'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Card body */}
                  <div className="bg-white p-4">
                    <h3 className="font-semibold text-warm-dark text-sm leading-snug group-hover:text-rose transition line-clamp-2 mb-1.5">
                      {ev.title}
                    </h3>

                    <p className="text-xs text-warm-light line-clamp-2 leading-relaxed mb-3">
                      {ev.description}
                    </p>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[11px] text-warm-light">
                        {ev.startTime && (
                          <>
                            <Clock size={10} />
                            <span>{ev.startTime}{ev.endTime ? `–${ev.endTime}` : ''}</span>
                            <span className="text-sand">·</span>
                          </>
                        )}
                        <User size={10} />
                        <span>{ev.organizer.firstName} {ev.organizer.lastName}</span>
                      </div>
                      {spotsLeft !== null && !isFull && (
                        <span className="text-[10px] text-warm-light">ще {spotsLeft} місць</span>
                      )}
                      {isFull && (
                        <span className="text-[10px] text-orange-500 font-medium">Місця вичерпані</span>
                      )}
                    </div>

                    <div className="mt-3 pt-3 border-t border-sand/50 flex items-center justify-between">
                      <span className="text-[11px] text-warm-light">
                        {ev.registrationClosed || isFull ? 'Реєстрацію закрито' : 'Реєстрація відкрита'}
                      </span>
                      <span className="text-xs text-rose font-medium group-hover:gap-1.5 flex items-center gap-1 transition-all">
                        Детальніше <ChevronRight size={12} />
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}

          </aside>
        )}

      </div>{/* end flex */}
    </Layout>
  )
}
