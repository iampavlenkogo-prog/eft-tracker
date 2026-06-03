import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Heart, BookOpen, ChevronRight, ChevronLeft, ChevronDown, Calendar, Clock, User, Star, MapPin, Users } from 'lucide-react'
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

interface CommunityPostPreview {
  id: string
  type: 'REFLECTION' | 'QUESTION' | 'SUPPORT' | 'RESOURCE'
  title: string | null
  content: string
  _count: { comments: number }
  reactions: { emoji: string }[]
  author: { firstName: string; lastName: string }
  createdAt: string
}

interface TherapistRequestPreview {
  id: string
  title: string
  description: string
  therapyFormats: string[]
  workFormat: string | null
  city: string | null
  createdAt: string
  _count: { responses: number }
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
  const { user } = useAuth()
  const [stats, setStats] = useState<Stats>({ supervisions: 0, seminars: 0, points: 0 })
  const [phrases, setPhrases] = useState<Phrase[]>([])
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([])
  const [upcomingBooking, setUpcomingBooking] = useState<Booking | null>(null)
  const [activeGroups, setActiveGroups] = useState<GroupSupervision[]>([])
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([])
  const [mobileEventIdx, setMobileEventIdx] = useState(0)
  const [therapistRequests, setTherapistRequests] = useState<TherapistRequestPreview[]>([])
  const [communityPreviews, setCommunityPreviews] = useState<CommunityPostPreview[]>([])

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
    api.get('/therapist-requests').then(res => {
      setTherapistRequests((res.data as TherapistRequestPreview[]).slice(0, 3))
    }).catch(() => {})
    api.get('/community?limit=3').then(res => {
      setCommunityPreviews((res.data as CommunityPostPreview[]).slice(0, 3))
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
    WAITING_FOR_CASE: 'Шукаємо супервізанта ♡',
    CASE_CONFIRMED: 'Випадок підтверджено ♡',
    REGISTRATION_OPEN: 'Реєстрацію відкрито ♡',
    RECORDING_AVAILABLE: 'Запис доступний ♡',
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
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-cormorant text-4xl text-warm-dark font-semibold leading-tight">
            Вітаємо, {user?.firstName} ♡
          </h1>
          <p className="font-cormorant italic text-warm-mid text-lg mt-1">
            Ваш дім професійного розвитку в ЕФТ
          </p>
        </div>
        <Link to="/calendar" className="shrink-0 group flex flex-col items-center gap-0.5">
          <img
            src="/illustrations/calendar.png"
            alt="Календар спільноти"
            className="w-20 sm:w-24 object-contain group-hover:scale-105 transition-transform duration-200 drop-shadow-sm"
          />
          <span className="text-[11px] text-warm-light group-hover:text-rose transition-colors font-medium">Календар</span>
        </Link>
      </div>

      <div className="flex gap-6 items-start">

        {/* ── Main content column ── */}
        <div className="flex-1 min-w-0 space-y-5">

          {/* Stats cards */}
          <div className="grid grid-cols-2 gap-3 sm:gap-5">
            <Link to="/supervisions" className="grad-tangelo rounded-2xl p-4 sm:p-6 relative overflow-visible min-h-[190px] sm:min-h-[240px] flex flex-col hover:opacity-90 active:scale-[0.98] transition-all duration-150">
              <div>
                <p className="text-[9px] sm:text-[10px] font-semibold text-warm-light uppercase tracking-widest mb-0.5">Супервізії</p>
                <p className="text-[10px] sm:text-xs text-warm-light mb-3">підтверджених сесій</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-cormorant text-4xl sm:text-5xl font-light text-warm-dark">{stats.supervisions}</span>
                  <span className="text-xs text-warm-light">зап.</span>
                </div>
              </div>
              <span className="mt-auto text-xs sm:text-sm text-[#A2C2BE] font-medium block pt-3">
                Переглянути →
              </span>
              <img src="/illustrations/chairs.png" alt="" className="absolute bottom-[-10px] right-[-8px] w-[110px] sm:w-[220px] object-contain pointer-events-none" />
            </Link>

            <Link to="/seminars" className="grad-ash rounded-2xl p-4 sm:p-6 relative overflow-visible min-h-[190px] sm:min-h-[240px] flex flex-col hover:opacity-90 active:scale-[0.98] transition-all duration-150">
              <div>
                <p className="text-[9px] sm:text-[10px] font-semibold text-warm-light uppercase tracking-widest mb-0.5">Семінари</p>
                <p className="text-[10px] sm:text-xs text-warm-light mb-3">пройдено навчань</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-cormorant text-4xl sm:text-5xl font-light text-warm-dark">{stats.seminars}</span>
                  <span className="text-xs text-warm-light">зап.</span>
                </div>
              </div>
              <span className="mt-auto text-xs sm:text-sm text-[#A2C2BE] font-medium block pt-3">
                Переглянути →
              </span>
              <img src="/illustrations/books-coffee.png" alt="" className="absolute bottom-[-10px] right-[-8px] w-[110px] sm:w-[220px] object-contain pointer-events-none" />
            </Link>
          </div>

          {/* Upcoming booked supervision */}
          {upcomingBooking && (
            <div className="bg-gradient-to-r from-[#EEF0E8] to-beige rounded-2xl p-5 border border-rose-light">
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
                      className="mt-3 inline-flex items-center gap-1.5 bg-rose hover:bg-[#CC3A00] text-white text-xs font-medium px-4 py-2 rounded-xl transition">
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
            <div className="lg:hidden neu-white rounded-2xl overflow-hidden">
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

          {/* Animated arrow to all events — mobile only */}
          {upcomingEvents.length > 0 && (
            <div className="lg:hidden flex justify-center py-2">
              <Link to="/events" className="group flex flex-col items-center gap-2.5">
                <span className="text-[10px] tracking-[0.18em] uppercase text-warm-light font-medium group-hover:text-rose transition-colors">
                  Переглянути всі події
                </span>
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-rose to-[#CC3A00] shadow-[0_4px_16px_rgba(235,70,0,0.35)] flex items-center justify-center group-hover:shadow-[0_6px_22px_rgba(80,180,173,0.6)] transition-shadow animate-bounce">
                  <ChevronDown size={32} strokeWidth={2} className="text-white" />
                </div>
              </Link>
            </div>
          )}

          {/* Available supervisions */}
          <div className="neu-card rounded-2xl p-6">
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
                  <div key={slot.id} className="flex items-center justify-between gap-4 neu-inset-sm rounded-xl px-4 py-3">
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
            <div className="neu-card rounded-2xl overflow-hidden">
              <div className="px-5 pt-5 pb-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-medium text-warm-light uppercase tracking-widest mb-0.5">Навчання</p>
                  <h3 className="font-cormorant text-xl font-semibold text-warm-dark">Групові супервізії</h3>
                </div>
              </div>
              <div className="px-5 pb-5 space-y-3">
                {activeGroups.map(g => {
                  const myP = g.participants.find(p => p.userId === user?.id)
                  const [, mon, day] = g.scheduledDate.split('-')
                  const monthNames = ['Січ','Лют','Бер','Кві','Тра','Чер','Лип','Сер','Вер','Жов','Лис','Гру']
                  const monthName = monthNames[parseInt(mon) - 1]

                  return (
                    <Link key={g.id} to={`/group-supervisions/${g.id}`}
                      className="flex items-stretch rounded-2xl overflow-hidden border border-sand/70 hover:border-rose/30 hover:shadow-md transition-all group">

                      {/* Date column */}
                      <div className="flex flex-col items-center justify-center bg-gradient-to-b from-rose-lighter to-[#F5F0ED] px-4 py-4 shrink-0 min-w-[60px] border-r border-rose-light/60">
                        <span className="font-cormorant text-2xl font-bold text-warm-dark leading-none">{day}</span>
                        <span className="text-[10px] font-semibold text-warm-mid uppercase tracking-wide mt-1">{monthName}</span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 px-4 py-3.5">
                        <p className="font-medium text-warm-dark text-sm leading-snug group-hover:text-rose transition mb-1.5 line-clamp-2">
                          {g.title}
                        </p>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-warm-mid mb-2">
                          <span className="flex items-center gap-1">
                            <Clock size={10} className="text-warm-light" />{g.scheduledTime} · {g.duration} хв
                          </span>
                          <span className="flex items-center gap-1">
                            <User size={10} className="text-warm-light" />{g.supervisor.firstName} {g.supervisor.lastName}
                          </span>
                        </div>
                        {g.presenterUser && (
                          <p className="text-xs text-rose mb-2 flex items-center gap-1">
                            <span>♡</span>
                            <span>{g.presenterUser.firstName} {g.presenterUser.lastName}</span>
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${groupStatusCls[g.status] || 'bg-sand text-warm-mid'}`}>
                            {groupStatusLabel[g.status] || g.status}
                          </span>
                          {myP && (
                            <span className={`text-[10px] font-medium flex items-center gap-1 ${myStatusCls[myP.paymentStatus]}`}>
                              <span>{myStatusIcon[myP.paymentStatus]}</span>
                              <span>{myP.isPresenter ? 'Ви супервізант' : myStatusLabel[myP.paymentStatus]}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}


          {/* Therapist Search block */}
          <div className="neu-white rounded-2xl overflow-hidden">
            {/* Gradient header with large illustration */}
            <div className="bg-gradient-to-br from-rose-lighter via-[#F5F0ED] to-[#EEF0E8] px-5 pt-5 pb-4 flex items-end justify-between gap-3">
              <div className="pb-1">
                <p className="text-[10px] font-medium text-warm-light uppercase tracking-widest mb-1">Спільнота</p>
                <h3 className="font-cormorant text-2xl font-semibold text-warm-dark leading-tight">Пошук терапевта ♡</h3>
                <p className="text-xs text-warm-mid mt-1 leading-relaxed">Запити колег та рекомендації від спільноти</p>
              </div>
              <img
                src="/illustrations/search_therapist.png"
                alt=""
                className="w-24 h-24 object-contain shrink-0 drop-shadow-sm"
              />
            </div>

            {/* Content */}
            <div className="px-5 py-4">
              {therapistRequests.length === 0 ? (
                <p className="font-cormorant italic text-warm-light text-base">
                  Поки немає активних запитів. Станьте першим ♡
                </p>
              ) : (
                <div className="space-y-2">
                  {therapistRequests.map(req => (
                    <Link key={req.id} to={`/therapist-requests/${req.id}`}
                      className="block bg-beige rounded-xl px-4 py-3.5 hover:bg-[#F0E6E0] transition group">
                      <p className="text-sm font-medium text-warm-dark group-hover:text-rose transition-colors leading-snug mb-1">{req.title}</p>
                      <p className="text-xs text-warm-mid line-clamp-2 leading-relaxed">{req.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-warm-light">
                        {req.city && (
                          <span className="flex items-center gap-1"><MapPin size={10} />{req.city}</span>
                        )}
                        <span className="flex items-center gap-1">
                          <Users size={10} />
                          {req._count.responses} {req._count.responses === 1 ? 'відгук' : req._count.responses < 5 ? 'відгуки' : 'відгуків'}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
              <Link to="/therapist-requests" className="mt-4 flex items-center gap-1 text-sm text-rose hover:opacity-80 transition font-medium">
                Переглянути всі запити <ChevronRight size={14} />
              </Link>
            </div>
          </div>

          {/* EFT Dictionary — unified block */}
          <div className="neu-white rounded-2xl overflow-hidden">

            {/* Gradient header */}
            <div className="bg-gradient-to-br from-rose-lighter via-[#EEF0E8] to-[#E8EDE0] px-5 pt-5 pb-4 flex items-end justify-between gap-3">
              <div className="pb-1">
                <p className="text-[10px] font-medium text-warm-light uppercase tracking-widest mb-1">Спільнота</p>
                <h3 className="font-cormorant text-2xl font-semibold text-warm-dark leading-tight">Словник ЕФТ терапевта ♡</h3>
                <p className="text-xs text-warm-mid mt-1">Натисніть ♡ щоб зберегти фразу до колекції</p>
              </div>
              <img src="/illustrations/slovnyk_EFT.png" alt=""
                className="w-24 h-24 object-contain shrink-0 drop-shadow-sm" />
            </div>

            {/* Phrases */}
            <div className="px-5 py-5">
              {phrases.length === 0 ? (
                <p className="font-cormorant italic text-warm-light text-base leading-relaxed">
                  Словник ще порожній. Поділіться своєю першою фразою у профілі ♡
                </p>
              ) : (
                <div className="space-y-5">
                  {phrases.map(phrase => (
                    <div key={phrase.id} className="group flex items-start gap-4">
                      <div className="flex-1 min-w-0 pl-4 border-l-2 border-rose-light group-hover:border-rose transition-colors duration-200">
                        <p className="font-cormorant italic text-warm-dark text-[17px] leading-relaxed">
                          «{phrase.text}»
                        </p>
                        <p className="text-xs text-warm-light mt-2">
                          — {phrase.author.firstName} {phrase.author.lastName}
                        </p>
                      </div>
                      <button
                        onClick={() => toggleSave(phrase)}
                        className={`shrink-0 mt-1 transition-all duration-200 ${
                          phrase.savedByMe
                            ? 'text-rose scale-110'
                            : 'text-warm-light hover:text-rose hover:scale-110'
                        }`}
                        title={phrase.savedByMe ? 'Видалити з колекції' : 'Зберегти до колекції'}>
                        <Heart size={18} fill={phrase.savedByMe ? 'currentColor' : 'none'} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer CTA — Мій словник */}
            <div className="border-t border-sand/60 px-5 py-4">
              <Link to="/profile#eft-dictionary"
                className="group flex items-center justify-between gap-3 hover:opacity-80 transition">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-rose-lighter rounded-xl flex items-center justify-center shrink-0">
                    <BookOpen size={17} className="text-rose" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-warm-dark">Мій словник ЕФТ</p>
                    <p className="text-xs text-warm-light mt-0.5">Ваші терміни, фрази та визначення</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-warm-light group-hover:text-rose group-hover:translate-x-0.5 transition-all shrink-0" />
              </Link>
            </div>

          </div>

          {/* Спільнота EFT — Bold dark forest */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(140deg, #8A2000 0%, #B83200 45%, #EB4600 100%)', boxShadow: '8px 8px 28px rgba(140,40,0,0.45), -4px -4px 12px rgba(255,255,220,0.2)' }}>

            {/* Header */}
            <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold text-[#EB4600] uppercase tracking-[0.18em] mb-2">♡ Спільнота ЕФТ</p>
                <h3 className="font-cormorant text-[30px] font-semibold leading-tight mb-1.5" style={{ color: '#FFF4EC' }}>
                  Голоси колег
                </h3>
                <p className="text-xs leading-relaxed max-w-[180px]" style={{ color: 'rgba(200,238,235,0.8)' }}>
                  Думки, питання, підтримка та натхнення від спільноти
                </p>
              </div>
              <img
                src="/illustrations/spilnota_EFT.png"
                alt=""
                className="w-28 h-28 object-contain shrink-0 drop-shadow-lg"
                style={{ filter: 'brightness(0.95) saturate(0.9)' }}
              />
            </div>

            {/* Divider */}
            <div className="mx-6 h-px" style={{ background: 'rgba(255,255,255,0.1)' }} />

            {/* Posts */}
            <div>
              {communityPreviews.length === 0 ? (
                <div className="px-6 py-5">
                  <p className="font-cormorant italic text-base" style={{ color: 'rgba(200,238,235,0.6)' }}>
                    Спільнота ще мовчить. Поділіться першим ♡
                  </p>
                </div>
              ) : communityPreviews.map((post, idx) => {
                const META: Record<string, { label: string; dot: string }> = {
                  REFLECTION: { label: 'Роздуми',   dot: '#EB4600' },
                  QUESTION:   { label: 'Питання',   dot: '#C9A87A' },
                  SUPPORT:    { label: 'Підтримка', dot: '#A89BCE' },
                  RESOURCE:   { label: 'Ресурси',   dot: '#8AB89A' },
                }
                const m = META[post.type]
                return (
                  <Link key={post.id} to="/community" state={{ scrollTo: post.id }}
                    className="block px-6 py-3.5 transition group"
                    style={{ borderTop: idx > 0 ? '1px solid rgba(255,255,255,0.07)' : 'none' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: m.dot }} />
                      <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: m.dot }}>{m.label}</span>
                      <span className="text-[10px] ml-auto" style={{ color: 'rgba(200,238,235,0.5)' }}>{post.author.firstName} {post.author.lastName[0]}.</span>
                    </div>
                    {post.title
                      ? <p className="text-sm font-medium leading-snug" style={{ color: '#FFF4EC' }}>{post.title}</p>
                      : <p className="text-sm line-clamp-2 leading-snug" style={{ color: 'rgba(200,238,235,0.8)' }}>{post.content}</p>
                    }
                    {(post.reactions.length > 0 || post._count.comments > 0) && (
                      <div className="flex items-center gap-3 mt-1 text-[11px]" style={{ color: 'rgba(200,238,235,0.45)' }}>
                        {post.reactions.length > 0 && <span>{post.reactions.length} реакцій</span>}
                        {post._count.comments > 0 && <span>{post._count.comments} коментарів</span>}
                      </div>
                    )}
                  </Link>
                )
              })}
            </div>

            {/* CTA */}
            <div className="px-6 pt-3 pb-6">
              <Link
                to="/community"
                className="flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-medium transition-opacity hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #EB4600 0%, #CC3A00 100%)', boxShadow: '-2px -2px 6px rgba(255,240,230,0.45), 2px 4px 10px rgba(150,75,70,0.2), 0 10px 18px -6px rgba(240,155,80,0.28), inset 0 1px 0 rgba(255,255,255,0.15)' }}
              >
                Перейти до спільноти ♡
              </Link>
            </div>
          </div>

          {/* Пам'ятай */}
          <div className="neu-card rounded-2xl overflow-hidden flex">
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
