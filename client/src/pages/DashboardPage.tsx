import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
import Layout from '../components/Layout'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'

interface Stats {
  supervisions: number
  seminars: number
  points: number
}

interface PublishedEvent {
  id: string
  title: string
  description: string
  date: string
  price: number
  currency: string
  coverImageUrl: string | null
  organizer: { firstName: string; lastName: string }
  registrations: Array<{ id: string; status: string }>
  _count: { registrations: number }
}

const CURRENCY_SYMBOL: Record<string, string> = { UAH: '₴', EUR: '€', USD: '$' }

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [stats, setStats] = useState<Stats>({ supervisions: 0, seminars: 0, points: 0 })
  const [events, setEvents] = useState<PublishedEvent[]>([])
  const [registeringId, setRegisteringId] = useState<string | null>(null)

  useEffect(() => {
    api.get('/dashboard/stats').then(res => setStats(res.data)).catch(() => {})
    api.get('/events').then(res => setEvents(res.data)).catch(() => {})
  }, [])

  const handleRegister = async (eventId: string) => {
    setRegisteringId(eventId)
    try {
      await api.post(`/events/${eventId}/register`)
      const res = await api.get('/events')
      setEvents(res.data)
    } catch (err: any) {
      if (err.response?.status !== 409) {
        alert(err.response?.data?.error || 'Помилка реєстрації')
      }
    } finally {
      setRegisteringId(null)
    }
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

      <div className="max-w-3xl space-y-5">
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
              <button
                onClick={() => navigate('/supervisions')}
                className="mt-auto text-sm text-rose hover:opacity-80 transition font-medium block pt-4 max-w-[52%]"
              >
                Переглянути записи →
              </button>
              <img
                src="/illustrations/chairs.png"
                alt=""
                className="absolute bottom-[-16px] right-[-12px] w-[220px] object-contain pointer-events-none"
              />
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
              <button
                onClick={() => navigate('/seminars')}
                className="mt-auto text-sm text-rose hover:opacity-80 transition font-medium block pt-4 max-w-[52%]"
              >
                Переглянути записи →
              </button>
              <img
                src="/illustrations/books-coffee.png"
                alt=""
                className="absolute bottom-[-16px] right-[-12px] w-[220px] object-contain pointer-events-none"
              />
            </div>
          </div>

          {/* ── Events block ── */}
          <div>
            <h2 className="font-cormorant text-2xl font-semibold text-warm-dark mb-3">Анонси заходів</h2>
            {events.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
                <div className="w-12 h-12 bg-beige rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Calendar size={22} className="text-warm-light" />
                </div>
                <p className="text-warm-mid font-medium font-cormorant text-lg">Поки немає заходів</p>
                <p className="text-warm-light text-sm mt-1">Незабаром тут з'являться анонси вебінарів та тренінгів</p>
              </div>
            ) : (
              <div className="space-y-3">
                {events.map(ev => {
                  const alreadyRegistered = ev.registrations.length > 0
                  const sym = CURRENCY_SYMBOL[ev.currency] ?? ev.currency
                  return (
                    <div key={ev.id} className="bg-white rounded-2xl shadow-sm overflow-hidden flex gap-0">
                      {ev.coverImageUrl && (
                        <img
                          src={ev.coverImageUrl}
                          alt=""
                          className="w-28 sm:w-36 object-cover shrink-0"
                        />
                      )}
                      <div className="p-5 flex flex-col flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <h3 className="font-cormorant text-xl font-semibold text-warm-dark leading-snug">{ev.title}</h3>
                          <span className="shrink-0 text-xs font-medium text-warm-light whitespace-nowrap">
                            {ev.price === 0 ? 'Безкоштовно' : `${ev.price} ${sym}`}
                          </span>
                        </div>
                        <p className="text-xs text-warm-light flex items-center gap-1.5 mb-2">
                          <Calendar size={12} />
                          {format(new Date(ev.date), 'd MMMM yyyy', { locale: uk })}
                          {' · '}
                          {ev.organizer.firstName} {ev.organizer.lastName}
                        </p>
                        <p className="text-sm text-warm-mid leading-relaxed line-clamp-2 mb-4">
                          {ev.description}
                        </p>
                        <div className="mt-auto">
                          {alreadyRegistered ? (
                            <span className="inline-block text-xs font-medium bg-[#E8F5E9] text-[#4CAF50] px-3 py-1.5 rounded-xl">
                              Вже зареєстровані ✓
                            </span>
                          ) : (
                            <button
                              disabled={registeringId === ev.id}
                              onClick={() => handleRegister(ev.id)}
                              className="bg-rose hover:bg-[#B5745A] disabled:opacity-50 text-white text-sm font-medium rounded-xl px-5 py-2 transition"
                            >
                              {registeringId === ev.id ? 'Реєструємо...' : 'Зареєструватись'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Quote block */}
          <div className="bg-rose-lighter rounded-2xl p-5 border border-rose-light">
            <p className="font-cormorant italic text-lg text-warm-mid leading-relaxed">
              ♡&nbsp;&nbsp;«Кожен крок у навчанні — це інвестиція у глибші стосунки та більшу присутність.»
            </p>
          </div>

          {/* Action cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { icon: '＋', title: 'Додати супервізію', sub: 'Записати нову сесію', path: '/supervisions' },
              { icon: '＋', title: 'Додати семінар', sub: 'Зафіксувати навчання', path: '/seminars' },
              { icon: '📄', title: 'Звіти', sub: 'Завантажити PDF', path: '/reports' },
            ].map(item => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="bg-white rounded-xl p-5 text-left hover:shadow-md transition group"
              >
                <div className="text-2xl text-rose mb-3">{item.icon}</div>
                <p className="text-sm font-medium text-warm-dark group-hover:text-rose transition">{item.title}</p>
                <p className="text-xs text-warm-light mt-0.5">{item.sub}</p>
              </button>
            ))}
          </div>

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
      </div>
    </Layout>
  )
}
