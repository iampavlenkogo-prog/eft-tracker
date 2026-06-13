import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, Clock, Users, Search, CheckCircle, Video, ArrowRight } from 'lucide-react'
import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
import api from '../api/axios'
import Layout from '../components/Layout'

// ── Types ──────────────────────────────────────────────────

interface RegistrationStatus {
  id: string
  status: 'PENDING' | 'PAYMENT_SENT' | 'RECEIPT_UPLOADED' | 'CONFIRMED' | 'REJECTED'
}
interface Event {
  id: string
  title: string
  description: string
  date: string
  startTime: string | null
  endTime: string | null
  price: number
  currency: string
  coverImageUrl: string | null
  maxParticipants: number | null
  registrationClosed: boolean
  status: 'PUBLISHED' | 'COMPLETED' | 'CANCELLED' | 'DRAFT'
  benefitsList: string[] | null
  recordingUrl: string | null
  organizer: { id: string; firstName: string; lastName: string; avatarUrl: string | null }
  registrations: RegistrationStatus[]
  _count: { registrations: number }
}
type ViewFilter = 'upcoming' | 'past' | 'all'

// ── Helpers ────────────────────────────────────────────────

function getCategory(title: string): 'seminar' | 'super' | 'master' | 'group' {
  const t = title.toLowerCase()
  if (t.includes('супервіз')) return 'super'
  if (t.includes('майстер') || t.includes('master')) return 'master'
  if (t.includes('груп') && (t.includes('навичок') || t.includes('супервіз'))) return 'group'
  return 'seminar'
}

const CAT_MEDIA: Record<string, string> = {
  seminar: 'from-[#FBEDED] to-[#E8B9A6]',
  super:   'from-[#FBF1E4] to-[#F4E2CF]',
  master:  'from-[#F2ECFA] to-[#E5DAF3]',
  group:   'from-[#EDF3EA] to-[#DCE9D6]',
}
const CAT_BADGE: Record<string, string> = {
  seminar: 'bg-[#F3DDD1] text-[#C9401E]',
  super:   'bg-[#F1E4CC] text-[#B98E45]',
  master:  'bg-[#C7D8DD] text-[#5E828E]',
  group:   'bg-[#DCE7EA] text-[#5E828E]',
}
const CAT_LABEL: Record<string, string> = {
  seminar: 'Семінар',
  super:   'Супервізія',
  master:  'Майстер-клас',
  group:   'Групова',
}

// ── Component ──────────────────────────────────────────────

export default function EventsPage() {
  const navigate = useNavigate()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<ViewFilter>('upcoming')
  const [search, setSearch] = useState('')

  useEffect(() => {
    api.get('/events').then(res => setEvents(res.data)).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const now = new Date()

  const allFiltered = events.filter(e => {
    const isUpcoming = new Date(e.date) >= now && e.status === 'PUBLISHED'
    const isPast = e.status === 'COMPLETED'
    const matchFilter =
      filter === 'all' ||
      (filter === 'upcoming' && isUpcoming) ||
      (filter === 'past' && isPast)
    const matchSearch =
      !search ||
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.organizer.firstName.toLowerCase().includes(search.toLowerCase()) ||
      e.organizer.lastName.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  // Spotlight = nearest upcoming PUBLISHED event
  const spotlight = events
    .filter(e => new Date(e.date) >= now && e.status === 'PUBLISHED')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0] ?? null

  // Grid excludes spotlight when on upcoming tab
  const gridEvents = allFiltered.filter(e =>
    !(filter === 'upcoming' && spotlight && e.id === spotlight.id)
  )

  return (
    <Layout>

      {/* ── Hero ── */}
      <section className="flex items-start justify-between gap-6">
        <div>
          <h1 className="font-cormorant font-semibold text-warm-dark leading-tight" style={{ fontSize: 'clamp(32px,4vw,46px)' }}>
            Події простору
          </h1>
          <p className="font-cormorant italic text-lg text-warm-mid mt-2">
            Воркшопи, вебінари та навчальні заходи для ЕФТ-терапевтів
          </p>
        </div>
        <div
          className="w-[92px] h-[92px] rounded-[36px] shrink-0 flex items-center justify-center"
          style={{
            background: 'radial-gradient(60% 55% at 50% 38%, rgba(225,180,170,.55), transparent 70%), var(--surface)',
            boxShadow: 'var(--clay-sm)',
          }}
        >
          <Calendar size={40} style={{ color: 'var(--rose-deep)' }} strokeWidth={1.6} />
        </div>
      </section>

      {/* ── Spotlight ── */}
      {!loading && spotlight && filter === 'upcoming' && (
        <section
          className="grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] rounded-[46px] overflow-hidden mt-7 cursor-pointer hover:-translate-y-1 transition"
          style={{ boxShadow: 'var(--clay)', background: 'var(--surface)' }}
          onClick={() => navigate(`/events/${spotlight.id}`)}
        >
          {/* Media */}
          <div
            className="relative min-h-[280px] lg:min-h-[360px]"
            style={{
              background: spotlight.coverImageUrl ? undefined :
                'radial-gradient(45% 50% at 38% 42%, rgba(236,176,182,.85), transparent 72%), radial-gradient(40% 45% at 70% 60%, rgba(216,154,172,.6), transparent 72%), linear-gradient(150deg, #FBEDED, #F3DCDF)',
            }}
          >
            {spotlight.coverImageUrl && (
              <img src={spotlight.coverImageUrl} alt={spotlight.title} className="absolute inset-0 w-full h-full object-cover" />
            )}
            {/* Tag */}
            <span
              className="absolute left-5 top-5 inline-flex items-center gap-[7px] px-4 py-2 rounded-[999px] font-extrabold text-[12px] tracking-[.06em] uppercase"
              style={{ background: 'rgba(252,248,245,.92)', color: 'var(--rose-ink)', boxShadow: 'var(--clay-sm)' }}
            >
              ♡ Подія тижня
            </span>
            {/* Date */}
            <div
              className="absolute right-5 top-5 w-[76px] h-[84px] rounded-[20px] flex flex-col items-center justify-center"
              style={{ background: 'rgba(252,248,245,.95)', boxShadow: 'var(--clay-sm)', color: 'var(--rose-deep)' }}
            >
              <b className="font-cormorant text-[32px] font-bold leading-none">{format(new Date(spotlight.date), 'd', { locale: uk })}</b>
              <span className="text-[11px] font-extrabold tracking-[.06em] uppercase mt-0.5">{format(new Date(spotlight.date), 'MMM', { locale: uk })}</span>
            </div>
          </div>

          {/* Body */}
          <div className="p-[32px_34px] lg:p-[36px_38px] flex flex-col">
            <span className="inline-flex items-center gap-2 text-[12px] font-extrabold tracking-[.14em] uppercase" style={{ color: 'var(--rose-ink)' }}>
              Найближча подія · {CAT_LABEL[getCategory(spotlight.title)]}
            </span>
            <h2 className="font-cormorant font-semibold text-warm-dark mt-3 leading-tight" style={{ fontSize: 'clamp(24px,3vw,34px)' }}>
              {spotlight.title}
            </h2>
            <p className="text-[15px] text-warm-mid leading-relaxed mt-3 line-clamp-3">{spotlight.description}</p>
            <div className="flex flex-wrap gap-4 mt-4">
              {spotlight.startTime && (
                <span className="inline-flex items-center gap-2 text-[14px] text-warm-mid font-semibold">
                  <Clock size={16} style={{ color: 'var(--rose-deep)' }} />
                  {spotlight.startTime}{spotlight.endTime ? `–${spotlight.endTime}` : ''} · Київський час
                </span>
              )}
              <span className="inline-flex items-center gap-2 text-[14px] text-warm-mid font-semibold">
                <Users size={16} style={{ color: 'var(--rose-deep)' }} />
                {spotlight.organizer.firstName} {spotlight.organizer.lastName}
              </span>
            </div>
            <div className="flex items-center gap-4 mt-auto pt-6 flex-wrap">
              <span className="font-cormorant text-[28px] font-bold text-warm-dark">
                {spotlight.price === 0 ? 'Безкоштовно' : `${spotlight.price}`}
                {spotlight.price > 0 && <small className="text-[15px] text-warm-light font-semibold font-mulish ml-1">{spotlight.currency}</small>}
              </span>
              <button
                onClick={e => { e.stopPropagation(); navigate(`/events/${spotlight.id}`) }}
                className="flex items-center gap-2 text-white font-bold text-[15.5px] rounded-[999px] px-[28px] py-[15px] transition hover:-translate-y-0.5"
                style={{ background: 'linear-gradient(135deg,#E0734F,#C24A28)', boxShadow: '-4px -4px 12px rgba(255,255,255,.4),10px 12px 26px rgba(194,74,40,.40)' }}
              >
                Зареєструватися <ArrowRight size={17} />
              </button>
              <button
                onClick={e => { e.stopPropagation(); navigate(`/events/${spotlight.id}`) }}
                className="font-bold text-[15.5px] rounded-[999px] px-[28px] py-[15px] transition hover:-translate-y-0.5"
                style={{ background: 'var(--surface)', color: 'var(--rose-ink)', boxShadow: 'var(--clay-sm)' }}
              >
                Деталі
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-[14px] mt-[34px] flex-wrap">
        <div
          className="flex gap-[6px] p-[6px] rounded-[999px]"
          style={{ background: 'var(--surface)', boxShadow: 'var(--clay-sm)' }}
        >
          {([
            { key: 'upcoming', label: 'Найближчі' },
            { key: 'past',     label: 'Завершені' },
            { key: 'all',      label: 'Всі' },
          ] as { key: ViewFilter; label: string }[]).map(s => (
            <button
              key={s.key}
              onClick={() => setFilter(s.key)}
              className="px-[20px] py-[10px] rounded-[999px] font-bold text-[14.5px] transition-all"
              style={filter === s.key
                ? { background: 'linear-gradient(135deg,#E0734F,#C24A28)', color: '#fff', boxShadow: '-3px -3px 8px rgba(255,255,255,.3),6px 8px 18px rgba(194,74,40,.4)' }
                : { color: 'var(--ink-2)' }}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div
          className="flex items-center gap-[11px] rounded-[999px] px-[18px] py-[11px] flex-1 min-w-[200px]"
          style={{ background: 'var(--surface)', boxShadow: 'var(--clay-sm)' }}
        >
          <Search size={18} className="text-warm-light shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Пошук події за назвою або ведучим…"
            className="flex-1 min-w-0 bg-transparent border-none outline-none text-[15px] text-warm-dark placeholder:text-warm-light"
          />
        </div>
      </div>

      {/* Count */}
      <p className="text-[13px] text-warm-light font-bold mt-4 mb-2">{allFiltered.length} подій</p>

      {/* ── Grid ── */}
      {loading ? (
        <div className="grid sm:grid-cols-2 gap-6">
          {[1,2,3,4].map(i => (
            <div key={i} className="rounded-[36px] overflow-hidden animate-pulse" style={{ background: 'var(--surface)', boxShadow: 'var(--clay)' }}>
              <div className="h-[184px] bg-[#F0E8E4]" />
              <div className="p-6 space-y-3">
                <div className="h-5 bg-[#F0E8E4] rounded-full w-3/4" />
                <div className="h-4 bg-[#F0E8E4] rounded-full w-full" />
                <div className="h-4 bg-[#F0E8E4] rounded-full w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : gridEvents.length === 0 && allFiltered.length === 0 ? (
        <div className="text-center py-14 rounded-[36px]" style={{ background: 'var(--surface)', boxShadow: 'var(--clay)' }}>
          <div className="w-[70px] h-[70px] rounded-[22px] bg-[#F3DDD1] flex items-center justify-center mx-auto mb-[18px]" style={{ boxShadow: 'var(--clay-sm)' }}>
            <Calendar size={34} style={{ color: 'var(--rose-deep)' }} strokeWidth={1.6} />
          </div>
          <h3 className="font-cormorant text-[24px] font-semibold text-warm-dark">Подій не знайдено</h3>
          <p className="text-[15px] text-warm-light mt-2">Спробуйте інший фільтр ♡</p>
        </div>
      ) : gridEvents.length === 0 ? null : (
        <div className="grid sm:grid-cols-2 gap-6">
          {gridEvents.map(event => {
            const cat = getCategory(event.title)
            const isCompleted = event.status === 'COMPLETED'
            const reg = event.registrations[0]
            const confirmed = reg?.status === 'CONFIRMED'
            const spotsLeft = event.maxParticipants ? event.maxParticipants - event._count.registrations : null
            const isFull = spotsLeft !== null && spotsLeft <= 0
            const closed = event.registrationClosed || isFull
            const d = new Date(event.date)

            return (
              <article
                key={event.id}
                onClick={() => navigate(`/events/${event.id}`)}
                className={`rounded-[36px] overflow-hidden flex flex-col cursor-pointer transition hover:-translate-y-[5px] ${isCompleted ? 'opacity-90' : ''}`}
                style={{ background: 'var(--surface)', boxShadow: 'var(--clay)' }}
              >
                {/* Media */}
                <div className={`relative h-[184px] bg-gradient-to-br ${CAT_MEDIA[cat]}`}>
                  {event.coverImageUrl && (
                    <img
                      src={event.coverImageUrl}
                      alt={event.title}
                      className={`absolute inset-0 w-full h-full object-cover ${isCompleted ? 'saturate-75' : ''}`}
                    />
                  )}
                  {/* Date badge */}
                  <div
                    className="absolute left-4 top-4 w-[60px] h-[66px] rounded-[16px] flex flex-col items-center justify-center"
                    style={{ background: 'rgba(252,248,245,.95)', boxShadow: 'var(--clay-sm)', color: 'var(--rose-deep)' }}
                  >
                    <b className="font-cormorant text-[24px] font-bold leading-none">{format(d, 'd', { locale: uk })}</b>
                    <span className="text-[9.5px] font-extrabold tracking-[.06em] uppercase mt-0.5">{format(d, 'MMM', { locale: uk })}</span>
                  </div>
                  {/* Price badge */}
                  <div
                    className="absolute right-4 top-[18px] px-3 py-1.5 rounded-[999px] font-extrabold text-[13px]"
                    style={{ background: 'rgba(252,248,245,.95)', color: 'var(--ink)', boxShadow: 'var(--clay-sm)' }}
                  >
                    {event.price === 0 ? 'Безкоштовно' : `${event.price} ${event.currency}`}
                  </div>
                  {/* Category + status badge (bottom-left) */}
                  <div className="absolute left-4 bottom-3 flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[999px] text-[11.5px] font-extrabold ${CAT_BADGE[cat]}`}
                      style={{ boxShadow: 'var(--clay-sm)' }}
                    >
                      {CAT_LABEL[cat]}
                    </span>
                    {confirmed && !isCompleted && (
                      <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[999px] text-[11.5px] font-extrabold bg-[#DCE7EA] text-[#5E828E]" style={{ boxShadow: 'var(--clay-sm)' }}>
                        <CheckCircle size={12} />Зареєстровано
                      </span>
                    )}
                  </div>
                </div>

                {/* Body */}
                <div className="flex flex-col flex-1 p-[20px_24px_24px]">
                  <h3 className="font-cormorant text-[22px] font-semibold text-warm-dark leading-tight">{event.title}</h3>
                  <p className="text-[14px] text-warm-mid leading-relaxed mt-2 line-clamp-2 flex-1">{event.description}</p>
                  {event.startTime && (
                    <span className="inline-flex items-center gap-2 text-[13.5px] text-warm-mid font-semibold mt-3">
                      <Clock size={15} style={{ color: 'var(--rose-deep)' }} />
                      {event.startTime}{event.endTime ? `–${event.endTime}` : ''} · Київський час
                    </span>
                  )}
                  <div className="flex items-center gap-3 mt-4 pt-4" style={{ borderTop: '1px solid var(--line)' }}>
                    {/* Left label */}
                    <div className="text-[12.5px] font-bold flex-1">
                      {isCompleted && event.recordingUrl && confirmed
                        ? <span className="inline-flex items-center gap-1 text-[#9080B0]"><Video size={13} />Запис доступний</span>
                        : !closed && !reg && !isCompleted
                          ? <span style={{ color: 'var(--rose-ink)' }}>Реєстрація відкрита</span>
                          : closed && !reg && !isCompleted
                            ? <span className="text-warm-light">Реєстрацію закрито</span>
                            : event.maxParticipants && !isCompleted && spotsLeft !== null && spotsLeft > 0
                              ? <span style={{ color: 'var(--sage-deep)' }}><span className="w-2 h-2 rounded-full bg-[#5E828E] inline-block mr-1.5" />ще {spotsLeft} місць</span>
                              : null
                      }
                    </div>
                    {/* Register button */}
                    <button
                      onClick={e => { e.stopPropagation(); navigate(`/events/${event.id}`) }}
                      className="font-bold text-[13.5px] rounded-[999px] px-[20px] py-[10px] transition hover:-translate-y-0.5 whitespace-nowrap"
                      style={confirmed || isCompleted
                        ? { background: 'var(--sage)', color: 'var(--sage-deep)', boxShadow: 'var(--clay-sm)' }
                        : { background: 'linear-gradient(135deg,#E0734F,#C24A28)', color: '#fff', boxShadow: '-3px -3px 8px rgba(255,255,255,.3),6px 8px 18px rgba(194,74,40,.4)' }
                      }
                    >
                      {isCompleted ? 'Дивитися' : confirmed ? '♡ Зареєстровано' : 'Реєструватись'}
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </Layout>
  )
}
