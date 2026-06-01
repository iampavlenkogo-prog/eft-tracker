import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, CalendarDays, Star, Users, User } from 'lucide-react'
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths,
  isToday, parseISO,
} from 'date-fns'
import { uk } from 'date-fns/locale'
import api from '../api/axios'
import Layout from '../components/Layout'
import { useAuth } from '../context/AuthContext'

interface ApiEvent {
  id: string
  title: string
  date: string
  startTime: string | null
  status: 'PUBLISHED' | 'COMPLETED' | 'CANCELLED' | 'DRAFT'
  registrations: { id: string; status: string }[]
}

interface ApiGroup {
  id: string
  title: string
  scheduledDate: string
  scheduledTime: string
  status: string
  participants: { userId: string; paymentStatus: string; isPresenter: boolean }[]
}

interface ApiBooking {
  id: string
  status: string
  slot: {
    date: string
    time: string
    supervisor: { firstName: string; lastName: string }
  }
}

interface CalEvent {
  id: string
  title: string
  date: Date
  time?: string
  type: 'event' | 'group' | 'slot'
  myStatus: 'none' | 'pending' | 'confirmed' | 'completed'
  link: string
}

const DOT: Record<string, string> = {
  none:      'bg-rose-400',
  pending:   'bg-amber-400',
  confirmed: 'bg-emerald-400',
  completed: 'bg-gray-300',
}

const BADGE: Record<string, string> = {
  none:      'bg-rose-50 text-rose-600',
  pending:   'bg-amber-50 text-amber-700',
  confirmed: 'bg-emerald-50 text-emerald-700',
  completed: 'bg-gray-100 text-gray-500',
}

const BADGE_LABEL: Record<string, string> = {
  none:      'Реєстрація відкрита',
  pending:   'Очікує підтвердження',
  confirmed: 'Підтверджено',
  completed: 'Завершено',
}

const TYPE_LABEL: Record<string, string> = {
  event: 'Подія',
  group: 'Групова супервізія',
  slot:  'Індивідуальна супервізія',
}

const TypeIcon = ({ type }: { type: CalEvent['type'] }) => {
  if (type === 'event') return <Star size={11} className="shrink-0" />
  if (type === 'group') return <Users size={11} className="shrink-0" />
  return <User size={11} className="shrink-0" />
}

export default function CalendarPage() {
  const { user } = useAuth()
  const [month, setMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [apiEvents, setApiEvents] = useState<ApiEvent[]>([])
  const [apiGroups, setApiGroups] = useState<ApiGroup[]>([])
  const [apiBookings, setApiBookings] = useState<ApiBooking[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/events'),
      api.get('/group-supervisions'),
      api.get('/bookings/my'),
    ]).then(([evRes, grRes, bkRes]) => {
      setApiEvents((evRes.data as ApiEvent[]).filter(e => e.status !== 'CANCELLED' && e.status !== 'DRAFT'))
      setApiGroups((grRes.data as ApiGroup[]).filter(g => g.status !== 'CANCELLED'))
      setApiBookings((bkRes.data as ApiBooking[]).filter(b => b.status !== 'CANCELLED' && b.status !== 'REJECTED'))
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const calEvents = useMemo<CalEvent[]>(() => {
    const result: CalEvent[] = []

    // Published & completed events
    apiEvents.forEach(ev => {
      const reg = ev.registrations[0]
      if (reg?.status === 'REJECTED') return
      let myStatus: CalEvent['myStatus'] = 'none'
      if (ev.status === 'COMPLETED') myStatus = 'completed'
      else if (reg?.status === 'CONFIRMED') myStatus = 'confirmed'
      else if (reg) myStatus = 'pending'
      result.push({
        id: ev.id,
        title: ev.title,
        date: parseISO(ev.date.slice(0, 10)),
        time: ev.startTime ?? undefined,
        type: 'event',
        myStatus,
        link: `/events/${ev.id}`,
      })
    })

    // Group supervisions
    apiGroups.forEach(g => {
      const myP = g.participants.find(p => p.userId === user?.id)
      let myStatus: CalEvent['myStatus'] = 'none'
      if (g.status === 'COMPLETED') myStatus = 'completed'
      else if (myP) {
        myStatus = (myP.paymentStatus === 'CONFIRMED' || myP.paymentStatus === 'FREE') ? 'confirmed' : 'pending'
      }
      result.push({
        id: g.id,
        title: g.title,
        date: parseISO(g.scheduledDate),
        time: g.scheduledTime,
        type: 'group',
        myStatus,
        link: `/group-supervisions/${g.id}`,
      })
    })

    // Booked individual slots
    apiBookings.forEach(b => {
      result.push({
        id: b.id,
        title: `Супервізія з ${b.slot.supervisor.firstName} ${b.slot.supervisor.lastName}`,
        date: parseISO(b.slot.date),
        time: b.slot.time,
        type: 'slot',
        myStatus: b.status === 'APPROVED' ? 'confirmed' : 'pending',
        link: '/my-bookings',
      })
    })

    return result
  }, [apiEvents, apiGroups, apiBookings, user?.id])

  // Calendar grid
  const monthStart = startOfMonth(month)
  const monthEnd   = endOfMonth(month)
  const calStart   = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd     = endOfWeek(monthEnd,   { weekStartsOn: 1 })
  const days       = eachDayOfInterval({ start: calStart, end: calEnd })

  const eventsForDay = (day: Date) => calEvents.filter(e => isSameDay(e.date, day))

  const selectedDayEvents = selectedDay ? eventsForDay(selectedDay) : []

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-5">
          <h1 className="font-cormorant text-3xl font-semibold text-warm-dark">Календар спільноти</h1>
          <p className="text-warm-mid text-sm mt-1">Всі події, групові супервізії та заходи спільноти</p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mb-5">
          {[
            { label: 'Реєстрація відкрита', dot: 'bg-rose-400' },
            { label: 'Очікує підтвердження', dot: 'bg-amber-400' },
            { label: 'Підтверджено / берете участь', dot: 'bg-emerald-400' },
            { label: 'Завершено', dot: 'bg-gray-300' },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-2 text-xs text-warm-mid">
              <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${l.dot}`} />
              {l.label}
            </div>
          ))}
        </div>

        <div className="lg:flex gap-5 items-start">

          {/* ── Calendar grid ── */}
          <div className="flex-1 bg-white rounded-2xl shadow-sm overflow-hidden border border-sand/40">

            {/* Month nav */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-sand">
              <button
                onClick={() => setMonth(m => subMonths(m, 1))}
                className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-beige transition text-warm-mid"
              >
                <ChevronLeft size={18} />
              </button>
              <h2 className="font-cormorant text-xl font-semibold text-warm-dark capitalize">
                {format(month, 'LLLL yyyy', { locale: uk })}
              </h2>
              <button
                onClick={() => setMonth(m => addMonths(m, 1))}
                className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-beige transition text-warm-mid"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Day names */}
            <div className="grid grid-cols-7 border-b border-sand bg-beige/40">
              {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map(d => (
                <div key={d} className="py-2 text-center text-[11px] font-medium text-warm-light tracking-wide">{d}</div>
              ))}
            </div>

            {/* Days */}
            {loading ? (
              <div className="h-64 flex items-center justify-center text-warm-light text-sm">Завантаження...</div>
            ) : (
              <div className="grid grid-cols-7">
                {days.map(day => {
                  const dayEvs = eventsForDay(day)
                  const inMonth  = isSameMonth(day, month)
                  const isSelected = selectedDay && isSameDay(day, selectedDay)
                  const today = isToday(day)

                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => setSelectedDay(prev => prev && isSameDay(prev, day) ? null : day)}
                      className={`relative min-h-[60px] sm:min-h-[72px] p-1.5 border-b border-r border-sand/40 flex flex-col items-center gap-1 transition-colors ${
                        isSelected ? 'bg-rose/5' : 'hover:bg-beige/50'
                      } ${!inMonth ? 'opacity-30 pointer-events-none' : ''}`}
                    >
                      <span className={`text-sm w-7 h-7 flex items-center justify-center rounded-full font-medium leading-none transition-colors ${
                        today
                          ? 'bg-rose text-white'
                          : isSelected
                            ? 'bg-rose/15 text-rose'
                            : 'text-warm-dark'
                      }`}>
                        {format(day, 'd')}
                      </span>

                      {/* Up to 3 dots */}
                      {dayEvs.length > 0 && (
                        <div className="flex items-center justify-center gap-0.5 flex-wrap">
                          {dayEvs.slice(0, 3).map((e, i) => (
                            <div key={i} className={`w-1.5 h-1.5 rounded-full ${DOT[e.myStatus]}`} />
                          ))}
                          {dayEvs.length > 3 && (
                            <div className="text-[9px] text-warm-light font-medium leading-none">+{dayEvs.length - 3}</div>
                          )}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Day panel ── */}
          <div className="lg:w-[280px] shrink-0 mt-4 lg:mt-0">
            {selectedDay ? (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-sand/40">
                {/* Day header */}
                <div className="px-5 py-4 border-b border-sand bg-beige/30">
                  <p className="text-[11px] font-medium text-warm-light uppercase tracking-widest capitalize">
                    {format(selectedDay, 'EEEE', { locale: uk })}
                  </p>
                  <h3 className="font-cormorant text-xl font-semibold text-warm-dark mt-0.5 capitalize">
                    {format(selectedDay, 'd MMMM yyyy', { locale: uk })}
                  </h3>
                </div>

                {selectedDayEvents.length === 0 ? (
                  <div className="px-5 py-10 text-center">
                    <CalendarDays size={28} className="text-sand mx-auto mb-2.5" />
                    <p className="text-sm text-warm-light">Немає подій цього дня</p>
                  </div>
                ) : (
                  <div className="divide-y divide-sand/60">
                    {selectedDayEvents.map(ev => (
                      <Link
                        key={`${ev.type}-${ev.id}`}
                        to={ev.link}
                        className="flex items-start gap-3 px-5 py-4 hover:bg-beige/50 transition"
                      >
                        {/* Status dot */}
                        <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${DOT[ev.myStatus]}`} />

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-warm-dark leading-snug line-clamp-2 mb-1">{ev.title}</p>

                          <div className="flex items-center gap-1 text-[10px] text-warm-light mb-1.5">
                            <TypeIcon type={ev.type} />
                            <span>{TYPE_LABEL[ev.type]}</span>
                            {ev.time && <><span className="text-sand mx-0.5">·</span><span>{ev.time} Київський час</span></>}
                          </div>

                          <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${BADGE[ev.myStatus]}`}>
                            {BADGE_LABEL[ev.myStatus]}
                          </span>
                        </div>

                        <ChevronRight size={13} className="text-warm-light shrink-0 mt-1.5" />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-sand/40 px-5 py-10 text-center">
                <CalendarDays size={32} className="text-sand mx-auto mb-3" />
                <p className="text-sm text-warm-mid font-medium mb-1">Оберіть день</p>
                <p className="text-xs text-warm-light">щоб побачити події та заходи</p>
              </div>
            )}

            {/* Today shortcut */}
            {selectedDay && !isToday(selectedDay) && (
              <button
                onClick={() => { setMonth(new Date()); setSelectedDay(new Date()) }}
                className="mt-3 w-full text-xs text-rose font-medium py-2 hover:opacity-80 transition"
              >
                Перейти до сьогодні
              </button>
            )}
          </div>

        </div>
      </div>
    </Layout>
  )
}
