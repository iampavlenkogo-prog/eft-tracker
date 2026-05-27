import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, Clock, User, Video, ChevronRight, CheckCircle, XCircle, Clock3, Upload, X, ChevronDown } from 'lucide-react'
import Layout from '../components/Layout'
import api from '../api/axios'

interface Booking {
  id: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED'
  caseTitle: string | null
  description: string | null
  protocolFileUrl: string | null
  videoUrl: string | null
  comment: string | null
  meetingLink: string | null
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

const inputClass = 'w-full border border-sand rounded-xl px-4 py-2.5 text-warm-dark text-sm focus:outline-none focus:border-rose focus:ring-1 focus:ring-rose-light transition bg-white'
const labelClass = 'block text-xs font-medium text-warm-mid mb-1.5'

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    api.get('/bookings/my')
      .then(res => setBookings(res.data))
      .finally(() => setIsLoading(false))
  }, [])

  const handleUpdated = (id: string, updated: Partial<Booking>) => {
    setBookings(prev => prev.map(b => b.id === id ? { ...b, ...updated } : b))
  }

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
          {upcoming.length > 0 && (
            <div>
              <p className="text-xs text-warm-light uppercase tracking-widest font-medium mb-3">Заплановані</p>
              <div className="space-y-3">
                {upcoming.map(b => <BookingCard key={b.id} booking={b} onUpdated={handleUpdated} />)}
              </div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              {upcoming.length > 0 && (
                <p className="text-xs text-warm-light uppercase tracking-widest font-medium mb-3">Інші заявки</p>
              )}
              <div className="space-y-3">
                {past.map(b => <BookingCard key={b.id} booking={b} onUpdated={handleUpdated} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </Layout>
  )
}

function BookingCard({ booking, onUpdated }: { booking: Booking; onUpdated: (id: string, updated: Partial<Booking>) => void }) {
  const cfg = STATUS_CONFIG[booking.status]
  const effectiveMeetingLink = booking.meetingLink || booking.slot.supervisor.meetingLink
  const isMeetingLinkVisible = booking.status === 'APPROVED' && effectiveMeetingLink

  const hasDetails = !!booking.caseTitle
  const [showForm, setShowForm] = useState(!hasDetails && booking.status === 'PENDING')
  const [form, setForm] = useState({
    caseTitle: booking.caseTitle ?? '',
    description: booking.description ?? '',
    videoUrl: booking.videoUrl ?? '',
    comment: booking.comment ?? '',
  })
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const handleSubmitDetails = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaveError('')
    try {
      const fd = new FormData()
      if (form.caseTitle) fd.append('caseTitle', form.caseTitle)
      if (form.description) fd.append('description', form.description)
      if (form.videoUrl) fd.append('videoUrl', form.videoUrl)
      if (form.comment) fd.append('comment', form.comment)
      if (file) fd.append('protocolFile', file)
      const res = await api.patch(`/bookings/${booking.id}/details`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      onUpdated(booking.id, {
        caseTitle: res.data.caseTitle,
        description: res.data.description,
        videoUrl: res.data.videoUrl,
        comment: res.data.comment,
        protocolFileUrl: res.data.protocolFileUrl,
      })
      setShowForm(false)
      setFile(null)
    } catch (err: any) {
      setSaveError(err.response?.data?.error || 'Помилка збереження')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            {booking.caseTitle ? (
              <p className="text-sm font-medium text-warm-dark mb-1">📌 {booking.caseTitle}</p>
            ) : (
              <p className="text-sm text-warm-light italic mb-1">Деталі ще не заповнені</p>
            )}
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

        {booking.description && (
          <p className="text-xs text-warm-mid leading-relaxed mb-3 line-clamp-2">{booking.description}</p>
        )}

        <div className="flex flex-wrap gap-2">
          {isMeetingLinkVisible && (
            <a
              href={effectiveMeetingLink!}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-rose hover:bg-[#B5745A] text-white text-xs font-medium px-3 py-1.5 rounded-xl transition"
            >
              <Video size={12} />Приєднатися до зустрічі
            </a>
          )}
          {booking.protocolFileUrl && (
            <a href={booking.protocolFileUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-rose hover:opacity-80 transition border border-rose-light rounded-xl px-3 py-1.5">
              📄 Протокол
            </a>
          )}
          {booking.videoUrl && (
            <a href={booking.videoUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-rose hover:opacity-80 transition border border-rose-light rounded-xl px-3 py-1.5">
              🎥 Відео сесії
            </a>
          )}
          {booking.status === 'PENDING' && (
            <button
              onClick={() => setShowForm(p => !p)}
              className="flex items-center gap-1 text-xs text-warm-mid hover:text-warm-dark border border-sand rounded-xl px-3 py-1.5 transition"
            >
              <ChevronDown size={12} className={`transition-transform ${showForm ? 'rotate-180' : ''}`} />
              {hasDetails ? 'Редагувати деталі' : 'Заповнити деталі'}
            </button>
          )}
        </div>

        {booking.status === 'COMPLETED' && (
          <p className="text-xs text-[#1976D2] mt-3 bg-[#E3F2FD] rounded-xl px-3 py-2">
            ✅ Сесія завершена — запис автоматично додано до вашого журналу супервізій
          </p>
        )}
        {booking.status === 'PENDING' && !hasDetails && !showForm && (
          <p className="text-xs text-warm-light mt-3 italic">
            Додайте деталі вашого випадку — це допоможе супервізору підготуватись до сесії
          </p>
        )}
      </div>

      {/* Details form — only for PENDING */}
      {showForm && booking.status === 'PENDING' && (
        <div className="border-t border-sand">
          <form onSubmit={handleSubmitDetails} className="p-5 space-y-4">
            <p className="text-xs text-warm-light uppercase tracking-widest font-medium">Деталі випадку</p>

            <div>
              <label className={labelClass}>Назва випадку</label>
              <input
                type="text"
                value={form.caseTitle}
                onChange={e => setForm(p => ({ ...p, caseTitle: e.target.value }))}
                placeholder="Короткий опис або назва"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Опис випадку</label>
              <textarea
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                rows={3}
                placeholder="Опишіть ситуацію, з якою ви звертаєтесь до супервізора..."
                className={inputClass + ' resize-none'}
              />
            </div>

            <div>
              <label className={labelClass}>Протокол (PDF або DOCX)</label>
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-sand rounded-xl p-4 text-center cursor-pointer hover:border-rose-light transition"
              >
                {file ? (
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-sm text-warm-dark">{file.name}</span>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setFile(null) }}
                      className="text-warm-light hover:text-rose transition"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : booking.protocolFileUrl ? (
                  <p className="text-xs text-warm-mid">Файл вже завантажено. Натисніть щоб замінити.</p>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <Upload size={16} className="text-warm-light" />
                    <p className="text-xs text-warm-mid">Натисніть щоб завантажити файл</p>
                    <p className="text-xs text-warm-light">PDF або DOCX, до 20 МБ</p>
                  </div>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
            </div>

            <div>
              <label className={labelClass}>Посилання на відео сесії (необов'язково)</label>
              <input
                type="url"
                value={form.videoUrl}
                onChange={e => setForm(p => ({ ...p, videoUrl: e.target.value }))}
                placeholder="https://..."
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Коментар (необов'язково)</label>
              <textarea
                value={form.comment}
                onChange={e => setForm(p => ({ ...p, comment: e.target.value }))}
                rows={2}
                placeholder="Будь-який додатковий контекст..."
                className={inputClass + ' resize-none'}
              />
            </div>

            {saveError && <p className="text-red-500 text-sm bg-red-50 rounded-xl px-4 py-2.5">{saveError}</p>}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 border border-sand text-warm-mid hover:bg-beige font-medium rounded-xl py-2.5 text-sm transition"
              >
                Скасувати
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-rose hover:bg-[#B5745A] disabled:opacity-60 text-white font-medium rounded-xl py-2.5 text-sm transition"
              >
                {saving ? 'Зберігаємо...' : 'Зберегти деталі'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
