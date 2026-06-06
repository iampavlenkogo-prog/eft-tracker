import { useState, useEffect } from 'react'
import { Calendar, Clock, User } from 'lucide-react'
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
  supervisor: { id: string; firstName: string; lastName: string; telegram: string | null }
}

function telegramLink(handle: string | null | undefined): string | null {
  if (!handle) return null
  const username = handle.replace('@', '').trim()
  return username ? `https://t.me/${username}` : null
}

export default function SlotsPage() {
  const [slots, setSlots] = useState<Slot[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [bookingId, setBookingId] = useState<string | null>(null)
  const [bookedSupervisor, setBookedSupervisor] = useState<{ name: string; telegram: string | null } | null>(null)

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
      setBookedSupervisor({
        name: `${slot.supervisor.firstName} ${slot.supervisor.lastName}`,
        telegram: slot.supervisor.telegram,
      })
    } catch (err: any) {
      alert(err.response?.data?.error || 'Помилка бронювання')
    } finally {
      setBookingId(null)
    }
  }

  const tgLink = telegramLink(bookedSupervisor?.telegram)

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="font-cormorant text-3xl text-warm-dark font-semibold">Слоти ♡</h1>
        <p className="font-cormorant italic text-warm-mid mt-0.5">Доступний час для супервізій</p>
      </div>

      {/* Success state after booking */}
      {bookedSupervisor && (
        <div className="max-w-lg mb-6 bg-[#E8F5E9] rounded-2xl p-5">
          <p className="text-sm font-medium text-[#2E7D32] mb-1">✅ Слот успішно заброньовано!</p>
          <p className="text-xs text-[#388E3C] mb-4 leading-relaxed">
            Напишіть супервізору {bookedSupervisor.name} у Telegram — там домовтесь про деталі та надішліть матеріали.
          </p>
          {tgLink ? (
            <a
              href={tgLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#229ED9] hover:bg-[#1a8bc2] text-white text-sm font-medium rounded-xl px-4 py-2 transition"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.26 14.4l-2.95-.924c-.64-.203-.658-.64.135-.954l11.57-4.461c.537-.194 1.006.131.88.16z"/>
              </svg>
              Написати супервізору
            </a>
          ) : (
            <p className="text-xs text-[#388E3C] italic">
              Telegram супервізора не вказано — зверніться через email або особисто.
            </p>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-7 h-7 border-4 border-sand border-t-rose rounded-full animate-spin" />
        </div>
      ) : slots.length === 0 && !bookedSupervisor ? (
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
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs bg-rose-light text-rose font-medium px-2.5 py-1 rounded-full">
                      {slot.type === 'INDIVIDUAL' ? 'Індивідуальна' : 'Групова'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5 text-sm text-warm-dark font-medium">
                      <Calendar size={13} className="text-warm-light" />
                      {slot.date}
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-warm-mid">
                      <Clock size={13} className="text-warm-light" />
                      {slot.time} <span className="text-xs text-warm-light">Київ</span> · {slot.duration} хв
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
                  className="w-full sm:w-auto sm:shrink-0 bg-gradient-to-br from-[#C07888] to-[#A06070] text-white font-medium rounded-xl px-6 py-2.5 text-sm neu-btn-primary hover:opacity-90 transition disabled:opacity-50"
                >
                  {bookingId === slot.id ? 'Бронюємо...' : 'Забронювати'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!bookedSupervisor && (
        <div className="mt-6 max-w-lg bg-beige rounded-2xl p-5">
          <p className="font-cormorant text-lg font-semibold text-warm-dark mb-2">Як це працює ♡</p>
          <p className="text-xs text-warm-mid leading-relaxed">
            Натисніть «Забронювати» — слот зарезервується і ви отримаєте кнопку для зв'язку з супервізором у Telegram.
            Там домовтесь про деталі та надішліть матеріали. Після супервізії внесіть запис у розділі «Супервізії».
          </p>
        </div>
      )}
    </Layout>
  )
}
