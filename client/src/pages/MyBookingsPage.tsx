import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, Clock, User, ChevronRight, CheckCircle, XCircle, Clock3 } from 'lucide-react'
import Layout from '../components/Layout'
import api from '../api/axios'

interface Booking {
  id: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED'
  meetingLink: string | null
  createdAt: string
  slot: {
    date: string
    time: string
    duration: number
    type: 'INDIVIDUAL' | 'GROUP'
    supervisor: { firstName: string; lastName: string; telegram: string | null; meetingLink: string | null }
  }
}

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  PENDING:   { label: 'Очікує підтвердження', cls: 'bg-[#FFF3E0] text-[#E6930A]', icon: <Clock3 size={13} /> },
  APPROVED:  { label: 'Підтверджено',         cls: 'bg-[#E8F5E9] text-[#4CAF50]',  icon: <CheckCircle size={13} /> },
  REJECTED:  { label: 'Відхилено',            cls: 'bg-[#FFEBEE] text-[#E53935]',  icon: <XCircle size={13} /> },
  COMPLETED: { label: 'Завершено',            cls: 'bg-[#E3F2FD] text-[#1976D2]',  icon: <CheckCircle size={13} /> },
  CANCELLED: { label: 'Скасовано',            cls: 'bg-sand text-warm-light',       icon: <XCircle size={13} /> },
}

function telegramLink(handle: string | null | undefined): string | null {
  if (!handle) return null
  const username = handle.replace('@', '').trim()
  return username ? `https://t.me/${username}` : null
}

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    api.get('/bookings/my')
      .then(res => setBookings(res.data))
      .finally(() => setIsLoading(false))
  }, [])

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
          <Link to="/slots" className="inline-flex items-center gap-1.5 bg-gradient-to-br from-[#D79A95] to-[#C8857F] text-white text-sm font-medium rounded-xl px-5 py-2.5 shadow-[0_2px_10px_rgba(215,154,149,0.25)] hover:opacity-90 transition">
            Переглянути доступні слоти <ChevronRight size={14} />
          </Link>
        </div>
      ) : (
        <div className="max-w-2xl space-y-3">
          {bookings.map(b => {
            const cfg = STATUS_CONFIG[b.status]
            const tgLink = telegramLink(b.slot.supervisor.telegram)
            const zoomLink = b.meetingLink || b.slot.supervisor.meetingLink
            return (
              <div key={b.id} className="bg-white rounded-2xl shadow-sm p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="flex flex-wrap gap-3 text-xs text-warm-mid mb-1.5">
                      <span className="flex items-center gap-1"><Calendar size={11} className="text-warm-light" />{b.slot.date}</span>
                      <span className="flex items-center gap-1"><Clock size={11} className="text-warm-light" />{b.slot.time} <span className="text-warm-light">Київський час</span> · {b.slot.duration} хв</span>
                      <span className="flex items-center gap-1"><User size={11} className="text-warm-light" />{b.slot.supervisor.firstName} {b.slot.supervisor.lastName}</span>
                    </div>
                    <span className="text-xs text-warm-light">{b.slot.type === 'INDIVIDUAL' ? 'Індивідуальна' : 'Групова'}</span>
                  </div>
                  <span className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${cfg.cls}`}>
                    {cfg.icon}{cfg.label}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {b.status === 'APPROVED' && zoomLink && (
                    <a
                      href={zoomLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 bg-gradient-to-br from-[#D79A95] to-[#C8857F] text-white text-xs font-medium rounded-xl px-3 py-1.5 shadow-[0_2px_8px_rgba(215,154,149,0.25)] hover:opacity-90 transition"
                    >
                      🎥 Приєднатися до зустрічі
                    </a>
                  )}
                  {(b.status === 'PENDING' || b.status === 'APPROVED') && tgLink && (
                    <a
                      href={tgLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 bg-[#229ED9] hover:bg-[#1a8bc2] text-white text-xs font-medium rounded-xl px-3 py-1.5 transition"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.26 14.4l-2.95-.924c-.64-.203-.658-.64.135-.954l11.57-4.461c.537-.194 1.006.131.88.16z"/>
                      </svg>
                      Написати супервізору
                    </a>
                  )}
                </div>

                {b.status === 'COMPLETED' && (
                  <p className="text-xs text-[#1976D2] mt-2 bg-[#E3F2FD] rounded-xl px-3 py-2">
                    ✅ Завершено — запис додано до журналу супервізій
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Layout>
  )
}
