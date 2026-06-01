import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Heart, BookOpen, ChevronRight, Calendar, Clock, User, Monitor } from 'lucide-react'
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
  recordingAvailabilityDays: number | null
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

      {/* ── Events Block ── */}
      {upcomingEvents.length > 0 && (
        <div className="bg-[#FDF8F5] border border-rose-light/60 rounded-2xl p-5 mb-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h2 className="font-cormorant text-2xl font-semibold text-warm-dark">Події простору ♡</h2>
              <p className="text-sm text-warm-mid mt-0.5">Анонси подій для вашого професійного зростання та натхнення</p>
            </div>
            <Link to="/events"
              className="shrink-0 flex items-center gap-1.5 text-sm text-rose border border-rose/40 rounded-full px-4 py-1.5 hover:bg-rose/5 transition whitespace-nowrap font-medium">
              Всі події <ChevronRight size={14} />
            </Link>
          </div>

          {/* Carousel */}
          <div className="flex gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}>
            {upcomingEvents.map(ev => {
              const dateObj = new Date(ev.date)
              const dayMonthStr = format(dateObj, 'd MMMM', { locale: uk })
              const reg = ev.registrations[0]
              return (
                <div key={ev.id} className="shrink-0 w-[268px] bg-white rounded-2xl shadow-sm flex flex-col overflow-hidden border border-sand/40">
                  <div className="p-4 flex flex-col flex-1">
                    {/* Date + status */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-medium text-warm-mid bg-beige rounded-full px-3 py-1 capitalize">{dayMonthStr}</span>
                      {reg?.status === 'CONFIRMED' && (
                        <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">✓ Підтверджено</span>
                      )}
                    </div>

                    {/* Title */}
                    <h3 className="font-cormorant text-[19px] font-semibold text-warm-dark leading-snug mb-3 line-clamp-3 flex-1">{ev.title}</h3>

                    {/* Organizer */}
                    <div className="flex items-center gap-2 mb-3">
                      {ev.organizer.avatarUrl ? (
                        <img src={ev.organizer.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-rose-light flex items-center justify-center text-xs font-semibold text-rose shrink-0">
                          {ev.organizer.firstName[0]}{ev.organizer.lastName[0]}
                        </div>
                      )}
                      <p className="text-xs font-medium text-warm-dark leading-tight">{ev.organizer.firstName} {ev.organizer.lastName}</p>
                    </div>

                    {/* Details */}
                    <div className="space-y-1.5 mb-4">
                      <div className="flex items-center gap-2 text-xs text-warm-mid">
                        <Calendar size={12} className="shrink-0 text-warm-light" />
                        <span>{format(dateObj, 'd MMMM yyyy', { locale: uk })}</span>
                      </div>
                      {ev.startTime && (
                        <div className="flex items-center gap-2 text-xs text-warm-mid">
                          <Clock size={12} className="shrink-0 text-warm-light" />
                          <span>{ev.startTime}{ev.endTime ? ` – ${ev.endTime}` : ''}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-warm-light text-[11px] font-medium shrink-0">₴</span>
                        <span className="font-semibold text-warm-dark">{ev.price === 0 ? 'Безкоштовно' : `${ev.price} ${ev.currency}`}</span>
                      </div>
                      {ev.recordingAvailabilityDays && (
                        <div className="flex items-center gap-2 text-xs text-rose font-medium">
                          <Monitor size={12} className="shrink-0" />
                          <span>Запис буде доступний {ev.recordingAvailabilityDays} днів</span>
                        </div>
                      )}
                    </div>

                    {/* CTA */}
                    <Link to={`/events/${ev.id}`}
                      className="block text-center bg-rose text-white rounded-xl py-2.5 text-sm font-medium hover:bg-rose/90 transition">
                      Детальніше
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Dots */}
          {upcomingEvents.length > 1 && (
            <div className="flex justify-center gap-1.5 mt-4">
              {upcomingEvents.slice(0, 6).map((_, i) => (
                <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i === 0 ? 'bg-rose' : 'bg-sand'}`} />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-6 items-start">

        {/* ── Main content column ── */}
        <div className="flex-1 min-w-0 space-y-5">

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

      </div>{/* end flex */}
    </Layout>
  )
}
