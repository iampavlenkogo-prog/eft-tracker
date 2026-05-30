import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, Clock, Users, Tag, ArrowRight, CheckCircle, Video } from 'lucide-react'
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
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-warm-dark">Події простору</h1>
          <p className="text-warm-mid text-sm mt-1">Воркшопи, вебінари та навчальні заходи для ЕФТ-терапевтів</p>
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
          <div className="grid gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 bg-white rounded-2xl border border-sand animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-sand">
            <Calendar size={40} className="text-sand mx-auto mb-3" />
            <p className="text-warm-mid font-medium">Немає заходів</p>
            <p className="text-sm text-warm-light mt-1">Нові події з'являться тут після публікації</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filtered.map(event => {
              const reg = event.registrations[0]
              const isCompleted = event.status === 'COMPLETED'
              const dateObj = new Date(event.date)
              const dateStr = format(dateObj, 'd MMMM yyyy', { locale: uk })
              const spotsLeft = event.maxParticipants
                ? event.maxParticipants - event._count.registrations
                : null
              const isFull = spotsLeft !== null && spotsLeft <= 0
              const closed = event.registrationClosed || isFull

              return (
                <div
                  key={event.id}
                  onClick={() => navigate(`/events/${event.id}`)}
                  className="bg-white rounded-2xl border border-sand overflow-hidden hover:shadow-md transition cursor-pointer group"
                >
                  <div className="flex flex-col sm:flex-row">
                    {/* Cover image */}
                    {event.coverImageUrl ? (
                      <div className="sm:w-48 h-44 sm:h-auto shrink-0 overflow-hidden">
                        <img
                          src={event.coverImageUrl}
                          alt={event.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        />
                      </div>
                    ) : (
                      <div className="sm:w-48 h-44 sm:h-auto shrink-0 bg-gradient-to-br from-rose-light to-beige flex items-center justify-center">
                        <Calendar size={32} className="text-rose/40" />
                      </div>
                    )}

                    {/* Content */}
                    <div className="flex-1 p-5 flex flex-col justify-between min-w-0">
                      <div>
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <h3 className="font-semibold text-warm-dark text-lg leading-snug group-hover:text-rose transition line-clamp-2">
                            {event.title}
                          </h3>
                          <div className="shrink-0 flex flex-col items-end gap-1">
                            {isCompleted && (
                              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                                Завершено
                              </span>
                            )}
                            {reg && STATUS_LABEL[reg.status] && (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${STATUS_LABEL[reg.status].class}`}>
                                {STATUS_LABEL[reg.status].label}
                              </span>
                            )}
                          </div>
                        </div>

                        <p className="text-sm text-warm-mid line-clamp-2 mb-3">
                          {event.description}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-warm-light">
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {dateStr}
                        </span>
                        {event.startTime && (
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {event.startTime}{event.endTime ? `–${event.endTime}` : ''} Київський час
                          </span>
                        )}
                        {event.maxParticipants && (
                          <span className="flex items-center gap-1">
                            <Users size={12} />
                            {event._count.registrations} / {event.maxParticipants}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Tag size={12} />
                          {event.price === 0 ? 'Безкоштовно' : `${event.price} ${event.currency}`}
                        </span>
                        <span className="flex items-center gap-1 ml-auto">
                          <span className="text-warm-mid font-medium">
                            {event.organizer.firstName} {event.organizer.lastName}
                          </span>
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-sand/60">
                        <div>
                          {isCompleted && event.recordingUrl && reg?.status === 'CONFIRMED' && (
                            <span className="inline-flex items-center gap-1 text-xs text-purple-600 font-medium">
                              <Video size={12} />
                              Запис доступний
                            </span>
                          )}
                          {reg?.status === 'CONFIRMED' && !isCompleted && (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                              <CheckCircle size={12} />
                              Ваша участь підтверджена
                            </span>
                          )}
                          {closed && !reg && !isCompleted && (
                            <span className="text-xs text-warm-light">Реєстрацію закрито</span>
                          )}
                        </div>
                        <span className="flex items-center gap-1 text-rose text-xs font-medium">
                          Детальніше <ArrowRight size={12} />
                        </span>
                      </div>
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
