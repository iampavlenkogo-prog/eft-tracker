import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, Clock, User, Video, ChevronRight, CheckCircle, XCircle, Clock3 } from 'lucide-react'
import Layout from '../components/Layout'
import api from '../api/axios'

interface Booking {
  id: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED'
  caseTitle: string
  description: string
  protocolFileUrl: string | null
  videoUrl: string | null
  comment: string | null
  createdAt: string
  slot: {
    date: string
    time: string
    duration: number
    type: 'INDIVIDUAL' | 'GROUP'
    supervisor: { firstName: string; lastName: string; meetingLink: string | null }
  }
}

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  PENDING:   { label: 'Очікує підтвердження', cls: 'bg-[#FFF3E0] text-[#E6930A]', icon: <Clock3 size={13} /> },
  APPROVED:  { label: 'Підтверджено',         cls: 'bg-[#E8F5E9] text-[#4CAF50]',  icon: <CheckCircle size={13} /> },
  REJECTED:  { label: 'Відхилено',            cls: 'bg-[#FFEBEE] text-[#E53935]',  icon: <XCircle size={13} /> },
  COMPLETED: { label: 'Завершено',            cls: 'bg-[#E3F2FD] text-[#1976D2]',  icon: <CheckCircle size={13} /> },
  CANCELLED: { label: 'Скасовано',            cls: 'bg-sand text-warm-light',       icon: <XCircle size={13} /> },
}

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    api.get('/bookings/my')
      .then(res => setBookings(res.data))
      .finally(() => setIsLoading(false))
  }, [])

  const today = new Date().toISOString().slice(0, 10)
  const upcoming = bookings.filter(b => b.status === 'APPROVED' && b.slot.date >= today)
  const past = bookings.filter(b => b.status !== 'APPROVED' || b.slot.date < today)

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="font-cormorant text-3xl text-warm-dark font-semibold">Мої бронювання ♡</h1>
        <p className="font-cormorant italic text-warm-mid mt-0.5">Ваші заявки на супервізійні сесії</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-7 h-7 border-4 border-sand border-t-rose rounded-full animate-spin" />
        </div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-16 max-w-sm mx-auto">
          <div className="w-14 h-14 bg-beige rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Calendar size={24} className="text-warm-light" />
          </div>
          <p className="text-warm-mid font-medium mb-1">Ви ще не бронювали супервізій</p>
          <p className="text-warm-light text-sm mb-4">Оберіть зручний слот і подайте заявку</p>
          <Link to="/slots" className="inline-flex items-center gap-1.5 bg-rose text-white text-sm font-medium rounded-xl px-5 py-2.5 hover:bg-[#B5745A] transition">
            Переглянути доступні слоти <ChevronRight size={14} />
          </Link>
        </div>
      ) : (
        <div className="max-w-2xl space-y-6">
          {/* Upcoming approved */}
          {upcoming.length > 0 && (
            <div>
              <p className="text-xs text-warm-light uppercase tracking-widest font-medium mb-3">Заплановані</p>
              <div className="space-y-3">
                {upcoming.map(b => (
                  <BookingCard key={b.id} booking={b} />
                ))}
              </div>
            </div>
          )}

          {/* All other */}
          {past.length > 0 && (
            <div>
              {upcoming.length > 0 && (
                <p className="text-xs text-warm-light uppercase tracking-widest font-medium mb-3">Інші заявки</p>
              )}
              <div className="space-y-3">
                {past.map(b => (
                  <BookingCard key={b.id} booking={b} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Layout>
  )
}

function BookingCard({ booking }: { booking: Booking }) {
  const cfg = STATUS_CONFIG[booking.status]
  const isSupervisorLinkVisible = booking.status === 'APPROVED' && booking.slot.supervisor.meetingLink

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <p className="text-sm font-medium text-warm-dark mb-1">📌 {booking.caseTitle}</p>
          <div className="flex flex-wrap gap-3 text-xs text-warm-mid">
            <span className="flex items-center gap-1"><Calendar size={11} className="text-warm-light" />{booking.slot.date}</span>
            <span className="flex items-center gap-1"><Clock size={11} className="text-warm-light" />{booking.slot.time} · {booking.slot.duration} хв</span>
            <span className="flex items-center gap-1"><User size={11} className="text-warm-light" />{booking.slot.supervisor.firstName} {booking.slot.supervisor.lastName}</span>
          </div>
        </div>
        <span className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${cfg.cls}`}>
          {cfg.icon}{cfg.label}
        </span>
      </div>

      <p className="text-xs text-warm-mid leading-relaxed mb-3 line-clamp-2">{booking.description}</p>

      <div className="flex flex-wrap gap-2">
        {isSupervisorLinkVisible && (
          <a
            href={booking.slot.supervisor.meetingLink!}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 bg-rose hover:bg-[#B5745A] text-white text-xs font-medium px-3 py-1.5 rounded-xl transition"
          >
            <Video size={12} />Приєднатися до зустрічі
          </a>
        )}
        {booking.protocolFileUrl && (
          <a
            href={booking.protocolFileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-rose hover:opacity-80 transition border border-rose-light rounded-xl px-3 py-1.5"
          >
            📄 Протокол
          </a>
        )}
        {booking.videoUrl && (
          <a
            href={booking.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-rose hover:opacity-80 transition border border-rose-light rounded-xl px-3 py-1.5"
          >
            🎥 Відео сесії
          </a>
        )}
      </div>

      {booking.status === 'COMPLETED' && (
        <p className="text-xs text-[#1976D2] mt-3 bg-[#E3F2FD] rounded-xl px-3 py-2">
          ✅ Сесія завершена — запис автоматично додано до вашого журналу супервізій
        </p>
      )}
      {booking.status === 'PENDING' && (
        <p className="text-xs text-warm-light mt-3 italic">
          Супервізор розгляне вашу заявку найближчим часом
        </p>
      )}
    </div>
  )
}
