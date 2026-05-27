import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Heart, BookOpen, ChevronRight, Calendar, Clock, User, Video } from 'lucide-react'
import Layout from '../components/Layout'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'

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
  slot: {
    date: string
    time: string
    duration: number
    supervisor: { firstName: string; lastName: string; meetingLink: string | null }
  }
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [stats, setStats] = useState<Stats>({ supervisions: 0, seminars: 0, points: 0 })
  const [phrases, setPhrases] = useState<Phrase[]>([])
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([])
  const [upcomingBooking, setUpcomingBooking] = useState<Booking | null>(null)

  useEffect(() => {
    api.get('/dashboard/stats').then(res => setStats(res.data)).catch(() => {})
    api.get('/phrases?limit=5&random=true').then(res => setPhrases(res.data)).catch(() => {})
    api.get('/slots/available?limit=3').then(res => setAvailableSlots(res.data)).catch(() => {})
    api.get('/bookings/my').then(res => {
      const today = new Date().toISOString().slice(0, 10)
      const approved = (res.data as Booking[])
        .filter(b => b.status === 'APPROVED' && b.slot.date >= today)
        .sort((a, b) => a.slot.date.localeCompare(b.slot.date) || a.slot.time.localeCompare(b.slot.time))
      setUpcomingBooking(approved[0] ?? null)
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

          {/* Upcoming booked supervision */}
          {upcomingBooking && (
            <div className="bg-gradient-to-r from-[#FDF0EC] to-beige rounded-2xl p-5 border border-rose-light">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium text-warm-light uppercase tracking-widest mb-1">Найближча супервізія</p>
                  <div className="flex flex-wrap gap-4 mt-2">
                    <div className="flex items-center gap-1.5 text-sm text-warm-dark font-medium">
                      <Calendar size={13} className="text-rose" />
                      {upcomingBooking.slot.date}
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-warm-mid">
                      <Clock size={13} className="text-warm-light" />
                      {upcomingBooking.slot.time} · {upcomingBooking.slot.duration} хв
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-warm-mid">
                      <User size={13} className="text-warm-light" />
                      {upcomingBooking.slot.supervisor.firstName} {upcomingBooking.slot.supervisor.lastName}
                    </div>
                  </div>
                </div>
                {upcomingBooking.slot.supervisor.meetingLink && (
                  <a
                    href={upcomingBooking.slot.supervisor.meetingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 flex items-center gap-1.5 bg-rose hover:bg-[#B5745A] text-white text-sm font-medium px-4 py-2 rounded-xl transition"
                  >
                    <Video size={14} />
                    Приєднатися
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
                      <span className="text-warm-dark font-medium flex items-center gap-1.5">
                        <Calendar size={12} className="text-warm-light" />
                        {slot.date}
                      </span>
                      <span className="text-warm-mid flex items-center gap-1.5">
                        <Clock size={12} className="text-warm-light" />
                        {slot.time}
                      </span>
                      <span className="text-warm-mid flex items-center gap-1.5">
                        <User size={12} className="text-warm-light" />
                        {slot.supervisor.firstName} {slot.supervisor.lastName}
                      </span>
                    </div>
                    <span className="text-xs bg-rose-light text-rose px-2 py-0.5 rounded-full shrink-0">
                      {slot.type === 'INDIVIDUAL' ? 'Інд.' : 'Груп.'}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <Link
              to="/slots"
              className="mt-4 flex items-center gap-1 text-sm text-rose hover:opacity-80 transition font-medium"
            >
              Переглянути всі слоти <ChevronRight size={14} />
            </Link>
          </div>

          {/* EFT Phrases block */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="flex items-baseline gap-3 mb-4">
              <h3 className="font-cormorant text-xl font-semibold text-warm-dark">Словник ЕФТ терапевта</h3>
              <p className="text-xs text-warm-light italic">Натисніть ♡ щоб зберегти фразу до своєї колекції</p>
            </div>
            {phrases.length === 0 ? (
              <p className="font-cormorant italic text-warm-light text-base">
                Словник ще порожній. Додайте свій перший запис у профілі ♡
              </p>
            ) : (
              <div className="space-y-3">
                {phrases.map(phrase => (
                  <div key={phrase.id} className="bg-beige rounded-xl p-4 flex gap-3 items-start">
                    <div className="flex-1 min-w-0">
                      <p className="font-cormorant italic text-warm-dark text-base leading-relaxed">«{phrase.text}»</p>
                      <p className="text-xs text-warm-light mt-1.5">{phrase.author.firstName} {phrase.author.lastName}</p>
                    </div>
                    <button
                      onClick={() => toggleSave(phrase)}
                      className={`shrink-0 mt-1 transition-colors ${phrase.savedByMe ? 'text-rose' : 'text-warm-light hover:text-rose'}`}
                      title={phrase.savedByMe ? 'Видалити з колекції' : 'Зберегти до колекції'}
                    >
                      <Heart size={18} fill={phrase.savedByMe ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* My EFT Dictionary button */}
          <Link
            to="/profile#eft-dictionary"
            className="group bg-gradient-to-r from-[#FDF0EC] to-beige rounded-2xl p-5 flex items-center gap-4 border border-rose-light hover:shadow-md hover:border-rose/30 transition-all duration-200"
          >
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
      </div>
    </Layout>
  )
}
