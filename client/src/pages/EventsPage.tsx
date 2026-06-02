import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Calendar, Clock, Users, ArrowRight, CheckCircle, Video, ChevronLeft } from 'lucide-react'
import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
import api from '../api/axios'
import Layout from '../components/Layout'

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

const STATUS_LABEL: Record<string, { label: string; class: string }> = {
  PENDING: { label: 'Очікує оплати', class: 'bg-amber-100 text-amber-700' },
  PAYMENT_SENT: { label: 'Реквізити надіслано', class: 'bg-blue-100 text-blue-700' },
  RECEIPT_UPLOADED: { label: 'Квитанцію надіслано', class: 'bg-purple-100 text-purple-700' },
  CONFIRMED: { label: 'Підтверджено', class: 'bg-emerald-100 text-emerald-700' },
  REJECTED: { label: 'Відхилено', class: 'bg-red-100 text-red-700' },
}

export default function EventsPage() {
  const navigate = useNavigate()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'completed'>('upcoming')

  useEffect(() => {
    api.get('/events').then(res => {
      setEvents(res.data)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const now = new Date()
  const filtered = events.filter(e => {
    if (filter === 'upcoming') return new Date(e.date) >= now && e.status === 'PUBLISHED'
    if (filter === 'completed') return e.status === 'COMPLETED'
    return true
  })

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">

        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-warm-mid hover:text-warm-dark text-sm transition mb-5"
        >
          <ChevronLeft size={15} />
          Назад
        </button>

        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-warm-dark">Події простору</h1>
            <p className="text-warm-mid text-sm mt-1">Воркшопи, вебінари та навчальні заходи для ЕФТ-терапевтів</p>
          </div>
          <Link to="/calendar" className="shrink-0 group flex flex-col items-center gap-0.5">
            <img
              src="/illustrations/calendar.png"
              alt="Календар спільноти"
              className="w-16 sm:w-20 object-contain group-hover:scale-105 transition-transform duration-200 drop-shadow-sm"
            />
            <span className="text-[11px] text-warm-light group-hover:text-rose transition-colors font-medium">Календар</span>
          </Link>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6">
          {(['upcoming', 'completed', 'all'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                filter === f
                  ? 'bg-rose text-white shadow-sm'
                  : 'bg-white text-warm-mid hover:bg-beige border border-sand'
              }`}
            >
              {f === 'upcoming' ? 'Майбутні' : f === 'completed' ? 'Завершені' : 'Всі'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid sm:grid-cols-2 gap-5">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-sand animate-pulse overflow-hidden">
                <div className="h-52 bg-beige" />
                <div className="p-5 space-y-2">
                  <div className="h-4 bg-beige rounded w-3/4" />
                  <div className="h-3 bg-beige rounded w-full" />
                  <div className="h-3 bg-beige rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-sand">
            <Calendar size={40} className="text-sand mx-auto mb-3" />
            <p className="text-warm-mid font-medium">Немає заходів</p>
            <p className="text-sm text-warm-light mt-1">Нові події з'являться тут після публікації</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-5">
            {filtered.map(event => {
              const reg = event.registrations[0]
              const isCompleted = event.status === 'COMPLETED'
              const dateObj = new Date(event.date)
              const dayStr = format(dateObj, 'd', { locale: uk })
              const monthStr = format(dateObj, 'MMMM', { locale: uk })
              const yearStr = format(dateObj, 'yyyy', { locale: uk })
              const spotsLeft = event.maxParticipants
                ? event.maxParticipants - event._count.registrations
                : null
              const isFull = spotsLeft !== null && spotsLeft <= 0
              const closed = event.registrationClosed || isFull

              return (
                <div
                  key={event.id}
                  onClick={() => navigate(`/events/${event.id}`)}
                  className="bg-white rounded-2xl border border-sand overflow-hidden hover:shadow-lg transition-shadow duration-200 cursor-pointer group flex flex-col"
                >
                  {/* Cover image — top, full width */}
                  <div className="relative overflow-hidden">
                    {event.coverImageUrl ? (
                      <>
                        {/* Blurred background fill */}
                        <div className="absolute inset-0 overflow-hidden">
                          <img
                            src={event.coverImageUrl}
                            alt=""
                            className="w-full h-full object-cover scale-110 blur-md opacity-40"
                            aria-hidden="true"
                          />
                        </div>
                        {/* Main image: contain so nothing is cropped */}
                        <div className="relative flex items-center justify-center bg-beige/30 h-52">
                          <img
                            src={event.coverImageUrl}
                            alt={event.title}
                            className="relative z-10 max-h-52 w-full object-contain group-hover:scale-[1.02] transition-transform duration-300"
                          />
                        </div>
                      </>
                    ) : (
                      <div className="h-52 bg-gradient-to-br from-rose-light via-[#F5D5C5] to-beige flex items-center justify-center">
                        <Calendar size={36} className="text-rose/30" />
                      </div>
                    )}

                    {/* Date badge — top left */}
                    <div className="absolute top-3 left-3 z-20 bg-white/95 backdrop-blur-sm rounded-xl px-3 py-2 shadow-sm text-center min-w-[48px]">
                      <p className="text-xl font-bold text-warm-dark leading-none">{dayStr}</p>
                      <p className="text-[10px] font-medium text-warm-mid uppercase tracking-wide leading-none mt-0.5 capitalize">{monthStr}</p>
                      <p className="text-[9px] text-warm-light leading-none mt-0.5">{yearStr}</p>
                    </div>

                    {/* Price badge — top right */}
                    <div className={`absolute top-3 right-3 z-20 rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm ${
                      event.price === 0
                        ? 'bg-emerald-500 text-white'
                        : 'bg-white/95 backdrop-blur-sm text-warm-dark'
                    }`}>
                      {event.price === 0 ? 'Безкоштовно' : `${event.price} ${event.currency}`}
                    </div>

                    {/* Status badges */}
                    {(isCompleted || reg) && (
                      <div className="absolute bottom-3 left-3 z-20 flex gap-1.5">
                        {isCompleted && (
                          <span className="text-[10px] font-semibold bg-purple-500 text-white px-2 py-0.5 rounded-full">
                            Завершено
                          </span>
                        )}
                        {reg && STATUS_LABEL[reg.status] && (
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_LABEL[reg.status].class}`}>
                            {STATUS_LABEL[reg.status].label}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Card body */}
                  <div className="flex-1 flex flex-col p-5">
                    <h3 className="font-semibold text-warm-dark text-base leading-snug group-hover:text-rose transition line-clamp-2 mb-2">
                      {event.title}
                    </h3>

                    <p className="text-sm text-warm-mid line-clamp-2 leading-relaxed mb-4 flex-1">
                      {event.description}
                    </p>

                    <div className="space-y-1.5 text-xs text-warm-light mb-4">
                      {event.startTime && (
                        <span className="flex items-center gap-1.5">
                          <Clock size={11} className="shrink-0" />
                          {event.startTime}{event.endTime ? `–${event.endTime}` : ''} Київський час
                        </span>
                      )}
                      {event.maxParticipants && (
                        <span className="flex items-center gap-1.5">
                          <Users size={11} className="shrink-0" />
                          {event._count.registrations} / {event.maxParticipants} учасників
                          {spotsLeft !== null && spotsLeft > 0 && !isFull && (
                            <span className="text-rose font-medium">· ще {spotsLeft} місць</span>
                          )}
                          {isFull && <span className="text-orange-500 font-medium">· місця вичерпані</span>}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-gradient-to-br from-rose-light to-rose/60 shrink-0" />
                        {event.organizer.firstName} {event.organizer.lastName}
                      </span>
                    </div>

                    <div className="pt-3 border-t border-sand/60 flex items-center justify-between">
                      <div className="text-xs text-warm-light">
                        {reg?.status === 'CONFIRMED' && !isCompleted && (
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                            <CheckCircle size={11} />
                            Участь підтверджена
                          </span>
                        )}
                        {isCompleted && reg?.status === 'CONFIRMED' && event.recordingUrl && (
                          <span className="inline-flex items-center gap-1 text-purple-600 font-medium">
                            <Video size={11} />
                            Запис доступний
                          </span>
                        )}
                        {closed && !reg && !isCompleted && (
                          <span>Реєстрацію закрито</span>
                        )}
                        {!closed && !reg && !isCompleted && (
                          <span className="text-rose font-medium">Реєстрація відкрита</span>
                        )}
                      </div>
                      <span className="flex items-center gap-1 text-rose text-xs font-medium group-hover:gap-1.5 transition-all">
                        Детальніше <ArrowRight size={12} />
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Layout>
  )
}
