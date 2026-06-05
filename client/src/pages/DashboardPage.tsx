import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Heart, BookOpen, ChevronRight, Calendar, Clock, User, Star, MapPin, Users } from 'lucide-react'
import Layout from '../components/Layout'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import { format } from 'date-fns'
import { uk } from 'date-fns/locale'

function endTime(start: string, durationMin: number): string {
  const [h, m] = start.split(':').map(Number)
  const total = h * 60 + m + durationMin
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

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
    WAITING_FOR_CASE: 'bg-[#FBF0E8] text-[#B07840]',
    CASE_CONFIRMED: 'bg-[#EEF2F8] text-[#7090B0]',
    REGISTRATION_OPEN: 'bg-[#EEF2EE] text-[#6A9870]',
    RECORDING_AVAILABLE: 'bg-[#EEF2EE] text-[#6A9870]',
  }
  const myStatusLabel: Record<string, string> = {
    PENDING: 'Зареєстровано — очікує оплати',
    RECEIPT_UPLOADED: 'Квитанцію надіслано',
    CONFIRMED: 'Участь підтверджена',
    FREE: 'Участь підтверджена',
  }
  const myStatusCls: Record<string, string> = {
    PENDING: 'text-[#B07840]',
    RECEIPT_UPLOADED: 'text-[#7090B0]',
    CONFIRMED: 'text-[#6A9870]',
    FREE: 'text-[#6A9870]',
  }
  const myStatusIcon: Record<string, string> = {
    PENDING: '⚠️', RECEIPT_UPLOADED: '📎', CONFIRMED: '✅', FREE: '✅',
  }

  return (
    <Layout>
      {/* ── Greeting ── */}
      <div className="mb-7 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-cormorant text-[clamp(28px,3.6vw,38px)] text-[#3C2E27] font-semibold leading-tight">
            Вітаємо, {user?.firstName} ♡
          </h1>
          <p className="font-cormorant italic text-[#6B584E] text-lg mt-1">
            Ваш дім професійного розвитку в ЕФТ
          </p>
        </div>
        <div className="flex items-center gap-1.5 bg-[#F5DEE3] text-[#6C2A41] text-xs font-bold px-3 py-2 rounded-full shrink-0">
          <Calendar size={13} />
          {format(new Date(), 'EEEE, d MMMM', { locale: uk })}
        </div>
      </div>

      <div className="space-y-8">

        {/* ══ 1. HERO EVENT BAND ══ */}
        {upcomingEvents.length > 0 && (() => {
          const ev0 = upcomingEvents[0]
          const reg0 = ev0.registrations[0]
          const d0 = new Date(ev0.date)
          const day0 = format(d0, 'd', { locale: uk })
          const mon0 = format(d0, 'LLL', { locale: uk })
          const full0 = ev0.maxParticipants != null && ev0.maxParticipants - ev0._count.registrations <= 0
          const closed0 = full0 || ev0.registrationClosed
          return (
            <section>
              <div className="flex items-baseline justify-between gap-3 mb-3">
                <div>
                  <h2 className="font-cormorant text-[27px] font-semibold text-[#3C2E27]">Найближча подія</h2>
                  <p className="text-sm text-[#9D8C80] mt-0.5">Не пропустіть реєстрацію</p>
                </div>
                <Link to="/events" className="inline-flex items-center gap-1 text-[#B05572] font-bold text-sm hover:gap-2 transition-all">
                  Усі події <ChevronRight size={14} />
                </Link>
              </div>

              {/* Band */}
              <div className="relative overflow-hidden rounded-[30px] p-7 sm:p-9 border border-[rgba(120,92,72,0.08)]"
                style={{ background: 'radial-gradient(80% 120% at 88% 0%, rgba(216,154,172,.22), transparent 60%), linear-gradient(140deg, #FBEFE6, #F7E2E2)' }}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 items-center">
                  {/* Left — text */}
                  <div>
                    <span className="inline-flex items-center gap-1.5 bg-[#F5DEE3] text-[#6C2A41] text-xs font-bold px-3 py-1.5 rounded-full mb-4">
                      ♡ Подія тижня · {day0} {mon0}
                    </span>
                    <h2 className="font-cormorant text-[clamp(26px,3.6vw,40px)] font-semibold text-[#3C2E27] leading-[1.05] mb-2">
                      {ev0.title}
                    </h2>
                    <p className="font-cormorant italic text-lg text-[#6B584E] mb-6 line-clamp-2">
                      {ev0.description}
                    </p>
                    <div className="flex flex-wrap gap-4 mb-6">
                      {ev0.startTime && (
                        <span className="inline-flex items-center gap-1.5 text-[#6B584E] text-sm font-semibold">
                          <Clock size={15} className="opacity-80" />{ev0.startTime}{ev0.endTime ? `–${ev0.endTime}` : ''} · Київ
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1.5 text-[#6B584E] text-sm font-semibold">
                        <User size={15} className="opacity-80" />{ev0.organizer.firstName} {ev0.organizer.lastName}
                      </span>
                      {ev0.price > 0 && (
                        <span className="inline-flex items-center font-bold text-sm text-[#3C2E27] bg-[rgba(60,46,39,0.06)] px-3 py-1 rounded-full">
                          {ev0.price} {ev0.currency}
                        </span>
                      )}
                      {ev0.price === 0 && (
                        <span className="inline-flex items-center font-bold text-sm text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">
                          Безкоштовно
                        </span>
                      )}
                    </div>
                    <div className="flex gap-3 flex-wrap">
                      {reg0 ? (
                        <div className={`px-5 py-3 rounded-full text-sm font-bold ${reg0.status === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {reg0.status === 'CONFIRMED' ? '✓ Участь підтверджена' : 'Зареєстровано'}
                        </div>
                      ) : closed0 ? (
                        <div className="px-5 py-3 rounded-full text-sm font-bold text-orange-600 bg-orange-50">
                          Реєстрацію закрито
                        </div>
                      ) : (
                        <Link to={`/events/${ev0.id}`}
                          className="inline-flex items-center gap-2 bg-[#B05572] text-white font-bold text-sm px-6 py-3 rounded-full hover:bg-[#98415E] transition-all shadow-[0_6px_18px_rgba(176,85,114,0.28)] hover:shadow-[0_10px_26px_rgba(176,85,114,0.34)]">
                          Зареєструватися <ChevronRight size={16} />
                        </Link>
                      )}
                      <Link to={`/events/${ev0.id}`}
                        className="inline-flex items-center gap-2 text-[#B05572] font-bold text-sm px-6 py-3 rounded-full ring-[1.5px] ring-[rgba(176,85,114,0.32)] hover:bg-[#FBEAEE] transition-all">
                        Деталі
                      </Link>
                    </div>
                  </div>

                  {/* Right — cover image */}
                  <div className="h-[220px] sm:h-[264px] rounded-[24px] overflow-hidden shadow-[0_2px_6px_rgba(70,45,30,.06),0_16px_40px_rgba(130,90,60,.09)] flex items-center justify-center bg-[#F3E2DA]">
                    {ev0.coverImageUrl ? (
                      <img src={ev0.coverImageUrl} alt={ev0.title} className="w-full h-full object-cover" />
                    ) : (
                      <Star size={48} className="text-[rgba(176,85,114,0.25)]" fill="currentColor" />
                    )}
                  </div>
                </div>
              </div>

              {/* 2 smaller events */}
              {upcomingEvents.length > 1 && (
                <div className="grid grid-cols-2 gap-4 mt-4">
                  {upcomingEvents.slice(1, 3).map((ev) => {
                    const reg = ev.registrations[0]
                    const dObj = new Date(ev.date)
                    const dayS = format(dObj, 'd', { locale: uk })
                    const monS = format(dObj, 'LLL', { locale: uk })
                    const isFull = ev.maxParticipants != null && ev.maxParticipants - ev._count.registrations <= 0
                    const isClosed = isFull || ev.registrationClosed
                    return (
                      <Link key={ev.id} to={`/events/${ev.id}`}
                        className="group flex flex-col bg-white rounded-[24px] overflow-hidden border border-[rgba(120,92,72,0.08)] shadow-[0_1px_2px_rgba(70,45,30,.05),0_6px_18px_rgba(130,90,60,.05)] hover:shadow-[0_4px_12px_rgba(70,45,30,.08),0_22px_50px_rgba(130,90,60,.13)] hover:-translate-y-0.5 transition-all duration-200">
                        {/* Image */}
                        <div className="relative h-[150px] overflow-hidden flex items-center justify-center bg-[#F3E2DA]">
                          {ev.coverImageUrl ? (
                            <img src={ev.coverImageUrl} alt={ev.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          ) : (
                            <Star size={28} className="text-[rgba(176,85,114,0.25)]" fill="currentColor" />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
                        </div>
                        {/* Body */}
                        <div className="p-4 flex flex-col gap-2.5 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1 bg-[#F5DEE3] text-[#6C2A41] text-[11px] font-bold px-2.5 py-1 rounded-full">
                              {dayS} {monS}
                            </span>
                            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${ev.price === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-[rgba(60,46,39,0.06)] text-[#3C2E27]'}`}>
                              {ev.price === 0 ? 'Безкошт.' : `${ev.price} ${ev.currency}`}
                            </span>
                          </div>
                          <h4 className="font-cormorant text-[19px] font-semibold text-[#3C2E27] leading-snug group-hover:text-[#B05572] transition line-clamp-2">
                            {ev.title}
                          </h4>
                          {ev.startTime && (
                            <span className="inline-flex items-center gap-1.5 text-[#6B584E] text-xs font-semibold">
                              <Clock size={13} className="opacity-70" />{ev.startTime}{ev.endTime ? `–${ev.endTime}` : ''}
                            </span>
                          )}
                          <div className="mt-auto pt-1">
                            {reg ? (
                              <div className={`text-xs font-bold py-2 rounded-full text-center ${reg.status === 'CONFIRMED' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                {reg.status === 'CONFIRMED' ? '✓ Підтверджено' : 'Зареєстровано'}
                              </div>
                            ) : isClosed ? (
                              <div className="text-xs font-bold text-orange-500 bg-orange-50 py-2 rounded-full text-center">Закрито</div>
                            ) : (
                              <div className="text-xs font-bold bg-[#F5DEE3] text-[#6C2A41] py-2 rounded-full text-center group-hover:bg-[#F0D0D7] transition">
                                Зареєструватися
                              </div>
                            )}
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </section>
          )
        })()}

        {/* ══ 2. STATS ══ */}
        <div className="grid grid-cols-2 gap-4">
          <Link to="/supervisions"
            className="bg-white rounded-[24px] p-5 relative overflow-hidden border border-[rgba(120,92,72,0.08)] shadow-[0_1px_2px_rgba(70,45,30,.05),0_6px_18px_rgba(130,90,60,.05)] hover:shadow-[0_4px_12px_rgba(70,45,30,.08),0_22px_50px_rgba(130,90,60,.13)] hover:-translate-y-0.5 transition-all duration-200 flex flex-col min-h-[160px]">
            <p className="text-[10px] text-[#9D8C80] uppercase tracking-widest font-bold mb-1">Супервізії</p>
            <div className="flex items-baseline gap-1.5 mb-auto">
              <span className="font-cormorant text-5xl font-semibold text-[#3C2E27]">{stats.supervisions}</span>
              <span className="text-xs text-[#9D8C80]">записів</span>
            </div>
            <span className="text-sm text-[#B05572] font-bold mt-3">Переглянути →</span>
            <img src="/illustrations/chairs.png" alt="" className="absolute bottom-[-10px] right-[-8px] w-[90px] sm:w-[130px] object-contain pointer-events-none opacity-80" />
          </Link>
          <Link to="/seminars"
            className="bg-white rounded-[24px] p-5 relative overflow-hidden border border-[rgba(120,92,72,0.08)] shadow-[0_1px_2px_rgba(70,45,30,.05),0_6px_18px_rgba(130,90,60,.05)] hover:shadow-[0_4px_12px_rgba(70,45,30,.08),0_22px_50px_rgba(130,90,60,.13)] hover:-translate-y-0.5 transition-all duration-200 flex flex-col min-h-[160px]">
            <p className="text-[10px] text-[#9D8C80] uppercase tracking-widest font-bold mb-1">Семінари</p>
            <div className="flex items-baseline gap-1.5 mb-auto">
              <span className="font-cormorant text-5xl font-semibold text-[#3C2E27]">{stats.seminars}</span>
              <span className="text-xs text-[#9D8C80]">записів</span>
            </div>
            <span className="text-sm text-[#B05572] font-bold mt-3">Переглянути →</span>
            <img src="/illustrations/books-coffee.png" alt="" className="absolute bottom-[-10px] right-[-8px] w-[90px] sm:w-[130px] object-contain pointer-events-none opacity-80" />
          </Link>
        </div>

        {/* ══ 3. UPCOMING BOOKED SUPERVISION ══ */}
        {upcomingBooking && (
          <div className="bg-white rounded-[24px] p-5 border border-[rgba(120,92,72,0.08)] shadow-[0_1px_2px_rgba(70,45,30,.05),0_6px_18px_rgba(130,90,60,.05)]">
            <p className="text-[10px] text-[#9D8C80] uppercase tracking-widest font-bold mb-3">Найближча супервізія</p>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap gap-4">
                  <span className="inline-flex items-center gap-1.5 text-sm text-[#3C2E27] font-semibold">
                    <Calendar size={13} className="text-[#B05572]" />{upcomingBooking.slot.date}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-sm text-[#6B584E]">
                    <Clock size={13} className="opacity-70" />{upcomingBooking.slot.time} · {upcomingBooking.slot.duration} хв
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-sm text-[#6B584E]">
                    <User size={13} className="opacity-70" />{upcomingBooking.slot.supervisor.firstName} {upcomingBooking.slot.supervisor.lastName}
                  </span>
                </div>
                {(upcomingBooking.meetingLink || upcomingBooking.slot.supervisor.meetingLink) && (
                  <a href={(upcomingBooking.meetingLink || upcomingBooking.slot.supervisor.meetingLink)!} target="_blank" rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 bg-[#B05572] hover:bg-[#98415E] text-white text-xs font-bold px-5 py-2 rounded-full transition shadow-[0_4px_12px_rgba(176,85,114,0.25)]">
                    🎥 Приєднатися до зустрічі
                  </a>
                )}
              </div>
              {upcomingBooking.slot.supervisor.telegram && (
                <a href={`https://t.me/${upcomingBooking.slot.supervisor.telegram.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
                  className="shrink-0 flex items-center gap-2 bg-[#229ED9] hover:bg-[#1a8bc2] text-white text-xs font-bold px-4 py-2 rounded-full transition">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.26 14.4l-2.95-.924c-.64-.203-.658-.64.135-.954l11.57-4.461c.537-.194 1.006.131.88.16z"/></svg>
                  Написати
                </a>
              )}
            </div>
          </div>
        )}

        {/* ══ 4. GROUP SUPERVISIONS ══ */}
        {activeGroups.length > 0 && (
          <section>
            <div className="flex items-baseline justify-between gap-3 mb-3">
              <div>
                <h2 className="font-cormorant text-[27px] font-semibold text-[#3C2E27]">Групові супервізії</h2>
                <p className="text-sm text-[#9D8C80] mt-0.5">Навчання в групі колег</p>
              </div>
            </div>
            <div className="space-y-3">
              {activeGroups.map(g => {
                const myP = g.participants.find(p => p.userId === user?.id)
                const [, mon, day] = g.scheduledDate.split('-')
                const monthNames = ['Січ','Лют','Бер','Кві','Тра','Чер','Лип','Сер','Вер','Жов','Лис','Гру']
                const monthName = monthNames[parseInt(mon) - 1]
                return (
                  <Link key={g.id} to={`/group-supervisions/${g.id}`}
                    className="flex items-stretch bg-white rounded-[24px] overflow-hidden border border-[rgba(120,92,72,0.08)] shadow-[0_1px_2px_rgba(70,45,30,.05),0_6px_18px_rgba(130,90,60,.05)] hover:shadow-[0_4px_12px_rgba(70,45,30,.08),0_22px_50px_rgba(130,90,60,.13)] hover:-translate-y-0.5 transition-all duration-200 group">
                    {/* Date column */}
                    <div className="flex flex-col items-center justify-center bg-[#FBEAEE] px-5 py-4 shrink-0 min-w-[68px]">
                      <span className="font-cormorant text-3xl font-bold text-[#B05572] leading-none">{day}</span>
                      <span className="text-[10px] font-bold text-[#B05572] uppercase tracking-wide mt-1">{monthName}</span>
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0 px-5 py-4">
                      <p className="font-semibold text-[#3C2E27] text-sm leading-snug group-hover:text-[#B05572] transition mb-2 line-clamp-2">{g.title}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#6B584E]">
                        <span className="flex items-center gap-1.5"><Clock size={11} className="opacity-70" />{g.scheduledTime}–{endTime(g.scheduledTime, g.duration)}</span>
                        <span className="flex items-center gap-1.5"><User size={11} className="opacity-70" />{g.supervisor.firstName} {g.supervisor.lastName}</span>
                      </div>
                      {myP && (
                        <div className={`mt-2 text-[10px] font-bold px-2.5 py-1 rounded-full w-fit ${myStatusCls[myP.paymentStatus]}`}>
                          {myP.isPresenter ? 'Ви супервізант' : myStatusLabel[myP.paymentStatus]}
                        </div>
                      )}
                    </div>
                    {/* Status badge */}
                    <div className="flex items-center pr-4">
                      <span className={`text-[11px] font-bold px-3 py-1.5 rounded-full whitespace-nowrap ${groupStatusCls[g.status] || 'bg-sand text-warm-mid'}`}>
                        {groupStatusLabel[g.status] || g.status}
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {/* ══ 5. AVAILABLE SLOTS ══ */}
        <section>
          <div className="flex items-baseline justify-between gap-3 mb-3">
            <div>
              <h2 className="font-cormorant text-[27px] font-semibold text-[#3C2E27]">Вільні слоти</h2>
              <p className="text-sm text-[#9D8C80] mt-0.5">Індивідуальна супервізія — найближчі вільні часи</p>
            </div>
            <Link to="/slots" className="inline-flex items-center gap-1 text-[#B05572] font-bold text-sm hover:gap-2 transition-all">
              Усі слоти <ChevronRight size={14} />
            </Link>
          </div>
          {availableSlots.length === 0 ? (
            <p className="font-cormorant italic text-[#9D8C80] text-base">Поки немає доступних слотів. Зверніться до свого супервізора ♡</p>
          ) : (
            <div className="space-y-2.5">
              {availableSlots.map(slot => {
                const [, mon2, day2] = slot.date.split('-')
                const monthNames2 = ['Січ','Лют','Бер','Кві','Тра','Чер','Лип','Сер','Вер','Жов','Лис','Гру']
                const mName2 = monthNames2[parseInt(mon2) - 1]
                return (
                  <div key={slot.id}
                    className="flex items-center gap-4 bg-white rounded-[18px] border border-[rgba(120,92,72,0.08)] px-4 py-3.5 hover:border-[#F5DEE3] hover:shadow-[0_1px_2px_rgba(70,45,30,.05),0_6px_18px_rgba(130,90,60,.05)] hover:translate-x-0.5 transition-all duration-200">
                    <div className="w-14 h-14 rounded-[15px] bg-[#FBEAEE] flex flex-col items-center justify-center shrink-0">
                      <span className="font-cormorant text-2xl font-bold text-[#B05572] leading-none">{day2}</span>
                      <span className="text-[9px] font-bold text-[#B05572] uppercase tracking-wide mt-0.5">{mName2}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap gap-3 text-sm">
                        <span className="flex items-center gap-1.5 text-[#6B584E] font-semibold"><Clock size={13} className="opacity-70" />{slot.time}</span>
                        <span className="flex items-center gap-1.5 text-[#6B584E]"><User size={13} className="opacity-70" />{slot.supervisor.firstName} {slot.supervisor.lastName}</span>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold bg-[#F1E4CC] text-[#B98E45] px-3 py-1 rounded-full shrink-0">
                      {slot.type === 'INDIVIDUAL' ? 'Інд.' : 'Груп.'}
                    </span>
                    <Link to="/slots" className="shrink-0 text-[#B05572] ring-[1.5px] ring-[rgba(176,85,114,0.32)] font-bold text-sm px-4 py-2 rounded-full hover:bg-[#FBEAEE] transition">
                      Обрати
                    </Link>
                  </div>
                )
              })}
            </div>
          )}
        </section>


          {/* Therapist Search block */}
          <div className="neu-white rounded-2xl overflow-hidden border border-sand/30">

            {/* Header — clean, no gradient */}
            <div className="px-5 pt-5 pb-4 flex items-center justify-between gap-3 border-b border-sand/30">
              <div className="flex items-center gap-3">
                <img
                  src="/illustrations/search_therapist.png"
                  alt=""
                  className="w-12 h-12 object-contain shrink-0 drop-shadow-sm"
                />
                <div>
                  <p className="text-[10px] font-medium text-warm-light uppercase tracking-widest mb-0.5">Спільнота</p>
                  <h3 className="font-cormorant text-xl font-semibold text-warm-dark leading-tight">Пошук терапевта ♡</h3>
                  <p className="text-xs text-warm-light mt-0.5">Запити колег від спільноти</p>
                </div>
              </div>
              <Link to="/therapist-requests" className="shrink-0 text-xs text-rose hover:opacity-80 transition font-medium flex items-center gap-0.5">
                Всі <ChevronRight size={12} />
              </Link>
            </div>

            {/* Content */}
            <div className="px-5 py-4">
              {therapistRequests.length === 0 ? (
                <p className="font-cormorant italic text-warm-light text-base py-2">
                  Поки немає активних запитів. Станьте першим ♡
                </p>
              ) : (
                <div className="divide-y divide-sand/30">
                  {therapistRequests.map(req => (
                    <Link key={req.id} to={`/therapist-requests/${req.id}`}
                      className="block py-3.5 hover:opacity-80 transition group">
                      <p className="text-sm font-medium text-warm-dark group-hover:text-rose transition-colors leading-snug mb-1">{req.title}</p>
                      <p className="text-xs text-warm-mid line-clamp-2 leading-relaxed mb-2">{req.description}</p>
                      <div className="flex items-center gap-3 text-xs text-warm-light">
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
            </div>
          </div>

          {/* EFT Dictionary — unified block */}
          <div className="neu-white rounded-2xl overflow-hidden border border-sand/30">

            {/* Gradient header — warm sage, clearly different from Therapist Search */}
            <div className="bg-gradient-to-br from-[#EEF0E8] via-[#F0EDE8] to-[#F5EDEA] px-5 pt-5 pb-4 flex items-end justify-between gap-3">
              <div className="pb-1">
                <p className="text-[10px] font-medium text-warm-light uppercase tracking-widest mb-1">Словник</p>
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
          <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(140deg, #6A3050 0%, #8A4568 45%, #C07888 100%)', boxShadow: '8px 8px 28px rgba(120,55,80,0.4), -4px -4px 12px rgba(255,255,220,0.2)' }}>

            {/* Header */}
            <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold text-[#C07888] uppercase tracking-[0.18em] mb-2">♡ Спільнота ЕФТ</p>
                <h3 className="font-cormorant text-[30px] font-semibold leading-tight mb-1.5" style={{ color: '#FFF4EC' }}>
                  Спільнота ЕФТ
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
                  REFLECTION: { label: 'Роздуми',   dot: '#C07888' },
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
                className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: 'rgba(255,249,245,0.92)', color: '#6A3050', boxShadow: '0 2px 12px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.6)' }}
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

      </div>{/* end space-y-7 */}
    </Layout>
  )
}
