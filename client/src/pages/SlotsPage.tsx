import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, Clock, User, CheckCircle, ChevronRight } from 'lucide-react'
import Layout from '../components/Layout'
import api from '../api/axios'

interface Slot {
  id: string
  date: string
  time: string
  duration: number
  type: 'INDIVIDUAL' | 'GROUP'
  notes: string | null
  status: string
  supervisor: { id: string; firstName: string; lastName: string }
}

export default function SlotsPage() {
  const [slots, setSlots] = useState<Slot[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [bookingId, setBookingId] = useState<string | null>(null)
  const [bookedSlotId, setBookedSlotId] = useState<string | null>(null)

  useEffect(() => {
    api.get('/slots/available')
      .then(res => setSlots(res.data))
      .finally(() => setIsLoading(false))
  }, [])

  const handleBook = async (slot: Slot) => {
    setBookingId(slot.id)
    try {
      await api.post('/bookings', { slotId: slot.id })
      setSlots(prev => prev.filter(s => s.id !== slot.id))
      setBookedSlotId(slot.id)
    } catch (err: any) {
      alert(err.response?.data?.error || 'Помилка бронювання')
    } finally {
      setBookingId(null)
    }
  }

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="font-cormorant text-3xl text-warm-dark font-semibold">Слоти ♡</h1>
        <p className="font-cormorant italic text-warm-mid mt-0.5">Доступний час для супервізій</p>
      </div>

      {/* Success state after booking */}
      {bookedSlotId && (
        <div className="max-w-lg mb-6 bg-[#E8F5E9] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle size={18} className="text-[#4CAF50] shrink-0" />
            <p className="text-sm font-medium text-[#2E7D32]">Слот успішно заброньовано!</p>
          </div>
          <p className="text-xs text-[#388E3C] mb-4 leading-relaxed">
            Супервізора сповіщено. Тепер заповніть деталі вашого випадку — це допоможе супервізору підготуватись до сесії.
          </p>
          <Link
            to="/my-bookings"
            className="inline-flex items-center gap-1.5 bg-[#4CAF50] hover:bg-[#388E3C] text-white text-sm font-medium rounded-xl px-4 py-2 transition"
          >
            Заповнити деталі <ChevronRight size={14} />
          </Link>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-7 h-7 border-4 border-sand border-t-rose rounded-full animate-spin" />
        </div>
      ) : slots.length === 0 && !bookedSlotId ? (
        <div className="text-center py-16">
          <div className="w-14 h-14 bg-beige rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Calendar size={24} className="text-warm-light" />
          </div>
          <p className="text-warm-mid font-medium">Немає доступних слотів</p>
          <p className="text-warm-light text-sm mt-1">Супервізори поки не виставили вільний час</p>
        </div>
      ) : (
        <div className="space-y-3 max-w-2xl">
          {slots.map(slot => (
            <div key={slot.id} className="bg-white rounded-2xl shadow-sm p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs bg-rose-light text-rose font-medium px-2.5 py-1 rounded-full">
                      {slot.type === 'INDIVIDUAL' ? 'Індивідуальна' : 'Групова'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-1.5 text-sm text-warm-dark font-medium">
                      <Calendar size={13} className="text-warm-light" />
                      {slot.date}
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-warm-mid">
                      <Clock size={13} className="text-warm-light" />
                      {slot.time} · {slot.duration} хв
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-warm-mid">
                      <User size={13} className="text-warm-light" />
                      {slot.supervisor.firstName} {slot.supervisor.lastName}
                    </div>
                  </div>
                  {slot.notes && (
                    <p className="text-xs text-warm-light mt-2 italic">{slot.notes}</p>
                  )}
                </div>
                <button
                  onClick={() => handleBook(slot)}
                  disabled={bookingId === slot.id}
                  className="shrink-0 bg-rose hover:bg-[#B5745A] disabled:opacity-60 text-white font-medium rounded-xl px-5 py-2 text-sm transition"
                >
                  {bookingId === slot.id ? 'Бронюємо...' : 'Забронювати'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!bookedSlotId && (
        <div className="mt-6 max-w-lg bg-beige rounded-2xl p-5">
          <p className="font-cormorant text-lg font-semibold text-warm-dark mb-2">Як це працює ♡</p>
          <p className="text-xs text-warm-mid leading-relaxed">
            Натисніть «Забронювати» — слот буде зарезервовано, а супервізор отримає сповіщення.
            Після цього заповніть деталі вашого випадку у розділі «Мої бронювання».
          </p>
        </div>
      )}
    </Layout>
  )
}
