import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import {
  Calendar, CheckCircle, Video, Upload, X,
  ExternalLink, Lock, ChevronRight, AlertCircle, ChevronLeft,
} from 'lucide-react'
import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
import api from '../api/axios'
import Layout from '../components/Layout'

interface Registration {
  id: string
  status: 'PENDING' | 'PAYMENT_SENT' | 'RECEIPT_UPLOADED' | 'CONFIRMED' | 'REJECTED'
  paymentReceiptUrl: string | null
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
  paymentInstructions: string
  paymentPurpose: string | null
  zoomLink: string | null
  zoomPassword: string | null
  presentationUrl: string | null
  recordingUrl: string | null
  recordingExpiresAt: string | null
  organizer: { id: string; firstName: string; lastName: string; avatarUrl: string | null }
  registrations: Registration[]
  _count: { registrations: number }
}

const STATUS_LABEL: Record<string, { label: string; class: string; desc: string }> = {
  PENDING: { label: 'Зареєстровано', class: 'bg-amber-100 text-amber-700', desc: 'Очікуйте реквізитів для оплати від організатора' },
  PAYMENT_SENT: { label: 'Реквізити надіслано', class: 'bg-blue-100 text-blue-700', desc: 'Завантажте підтвердження оплати нижче' },
  RECEIPT_UPLOADED: { label: 'Квитанцію надіслано', class: 'bg-purple-100 text-purple-700', desc: 'Очікуйте підтвердження від організатора' },
  CONFIRMED: { label: 'Підтверджено ✓', class: 'bg-emerald-100 text-emerald-700', desc: 'Ваша участь підтверджена. Zoom-посилання нижче.' },
  REJECTED: { label: 'Відхилено', class: 'bg-red-100 text-red-700', desc: 'Реєстрацію відхилено. Зверніться до організатора.' },
}

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const handleBack = () => {
    const from = (location.state as any)?.from
    if (from === 'supervisor') navigate('/supervisor?tab=events')
    else navigate(-1)
  }

  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [registering, setRegistering] = useState(false)
  const [uploadingReceipt, setUploadingReceipt] = useState(false)
  const [pendingReceiptFile, setPendingReceiptFile] = useState<File | null>(null)
  const [toast, setToast] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const fetchEvent = () => {
    api.get(`/events/${id}`).then(res => setEvent(res.data)).catch(() => navigate('/events')).finally(() => setLoading(false))
  }

  useEffect(() => { fetchEvent() }, [id])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }

  const handleRegister = async () => {
    if (!event) return
    setRegistering(true)
    try {
      await api.post(`/events/${event.id}/register`)
      showToast(event.price === 0 ? 'Зареєстровано! Участь підтверджена.' : 'Зареєстровано! Реквізити для оплати — нижче на цій сторінці.')
      fetchEvent()
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Помилка реєстрації')
    } finally {
      setRegistering(false)
    }
  }

  const handleUploadReceipt = async () => {
    if (!event || !pendingReceiptFile) return
    const reg = event.registrations[0]
    if (!reg) return
    setUploadingReceipt(true)
    try {
      const fd = new FormData()
      fd.append('receipt', pendingReceiptFile)
      await api.post(`/events/${event.id}/registrations/${reg.id}/upload-receipt`, fd)
      showToast('Квитанцію надіслано! Очікуйте підтвердження.')
      setPendingReceiptFile(null)
      fetchEvent()
    } catch {
      showToast('Помилка завантаження файлу')
    } finally {
      setUploadingReceipt(false)
    }
  }

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) setPendingReceiptFile(file)
  }

  if (loading) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto space-y-4 animate-pulse">
          <div className="h-56 bg-white rounded-2xl border border-sand" />
          <div className="h-8 w-2/3 bg-beige rounded-xl" />
          <div className="h-4 w-full bg-beige rounded" />
        </div>
      </Layout>
    )
  }

  if (!event) return null

  const dateObj = new Date(event.date)
  const dateStr = format(dateObj, 'EEEE, d MMMM yyyy', { locale: uk })
  const reg = event.registrations[0]
  const isCompleted = event.status === 'COMPLETED'
  const isCancelled = event.status === 'CANCELLED'
  const spotsLeft = event.maxParticipants ? event.maxParticipants - event._count.registrations : null
  const isFull = spotsLeft !== null && spotsLeft <= 0
  const canRegister = !reg && !isCompleted && !isCancelled && !event.registrationClosed && !isFull
  const canUploadReceipt = reg && (reg.status === 'PAYMENT_SENT' || reg.status === 'RECEIPT_UPLOADED')
  const recordingExpired = event.recordingExpiresAt && new Date(event.recordingExpiresAt) < new Date()

  return (
    <Layout>
      {toast && (
        <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 bg-warm-dark text-white px-5 py-3 rounded-2xl text-sm shadow-xl z-50 max-w-xs text-center">
          {toast}
        </div>
      )}

      <div className="max-w-3xl mx-auto space-y-5">

        {/* Back button */}
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 text-warm-mid hover:text-warm-dark text-sm transition"
        >
          <ChevronLeft size={15} />
          Назад
        </button>

        {/* Cover */}
        {event.coverImageUrl ? (
          <div className="relative w-full rounded-2xl overflow-hidden aspect-video">
            <img src={event.coverImageUrl} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover scale-110 blur-md opacity-40" />
            <img src={event.coverImageUrl} alt={event.title} className="relative w-full h-full object-contain" />
          </div>
        ) : (
          <div className="w-full h-40 rounded-2xl bg-gradient-to-br from-rose-light to-beige flex items-center justify-center">
            <Calendar size={40} className="text-rose/40" />
          </div>
        )}

        {/* Status badges */}
        <div className="flex flex-wrap gap-2">
          {isCompleted && (
            <span className="text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded-full font-medium">Захід завершено</span>
          )}
          {isCancelled && (
            <span className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded-full font-medium">Скасовано</span>
          )}
          {event.registrationClosed && !isFull && !isCompleted && !isCancelled && (
            <span className="text-xs bg-warm-light/20 text-warm-mid px-3 py-1 rounded-full font-medium">Реєстрацію закрито</span>
          )}
          {isFull && !isCompleted && !isCancelled && (
            <span className="text-xs bg-orange-100 text-orange-700 px-3 py-1 rounded-full font-medium">Місця вичерпані</span>
          )}
        </div>

        {/* Title + meta */}
        <div className="bg-white rounded-2xl border border-sand p-6">
          <h1 className="text-2xl font-semibold text-warm-dark mb-4 leading-snug">{event.title}</h1>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-wide text-warm-light font-medium">Дата</span>
              <span className="text-sm text-warm-dark font-medium capitalize">{dateStr}</span>
            </div>
            {event.startTime && (
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] uppercase tracking-wide text-warm-light font-medium">Час (Київський час)</span>
                <span className="text-sm text-warm-dark font-medium">
                  {event.startTime}{event.endTime ? `–${event.endTime}` : ''}
                </span>
              </div>
            )}
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-wide text-warm-light font-medium">Вартість</span>
              <span className="text-sm text-warm-dark font-medium">
                {event.price === 0 ? 'Безкоштовно' : `${event.price} ${event.currency}`}
              </span>
            </div>
            {event.maxParticipants && (
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] uppercase tracking-wide text-warm-light font-medium">Учасників</span>
                <span className="text-sm text-warm-dark font-medium">
                  {event._count.registrations} / {event.maxParticipants}
                  {spotsLeft !== null && spotsLeft > 0 && (
                    <span className="text-warm-light text-xs ml-1">(ще {spotsLeft})</span>
                  )}
                </span>
              </div>
            )}
          </div>

          {/* Organizer */}
          <div className="flex items-center gap-3 py-3 border-t border-sand">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-rose-light to-rose/60 flex items-center justify-center text-white text-sm font-semibold shrink-0 overflow-hidden">
              {event.organizer.avatarUrl
                ? <img src={event.organizer.avatarUrl} alt="" className="w-full h-full object-cover" />
                : `${event.organizer.firstName[0]}${event.organizer.lastName[0]}`}
            </div>
            <div>
              <p className="text-xs text-warm-light">Організатор</p>
              <p className="text-sm text-warm-dark font-medium">{event.organizer.firstName} {event.organizer.lastName}</p>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="bg-white rounded-2xl border border-sand p-6">
          <h2 className="text-base font-semibold text-warm-dark mb-3">Про захід</h2>
          <p className="text-sm text-warm-mid leading-relaxed whitespace-pre-line">{event.description}</p>

          {Array.isArray(event.benefitsList) && event.benefitsList.length > 0 && (
            <div className="mt-5">
              <h3 className="text-sm font-semibold text-warm-dark mb-3">Що отримаєте</h3>
              <ul className="space-y-2">
                {event.benefitsList.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-warm-mid">
                    <CheckCircle size={15} className="text-emerald-500 mt-0.5 shrink-0" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Registration & payment block */}
        {!isCancelled && (
          <div className="bg-white rounded-2xl border border-sand p-6 space-y-4">

            {/* My status */}
            {reg && STATUS_LABEL[reg.status] && (
              <div className={`rounded-xl px-4 py-3 flex items-start gap-3 ${STATUS_LABEL[reg.status].class}`}>
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm">{STATUS_LABEL[reg.status].label}</p>
                  <p className="text-xs mt-0.5 opacity-80">{STATUS_LABEL[reg.status].desc}</p>
                </div>
              </div>
            )}

            {/* Zoom & materials for CONFIRMED */}
            {reg?.status === 'CONFIRMED' && (
              <div className="space-y-3">
                {event.zoomLink && (
                  <a
                    href={event.zoomLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition"
                  >
                    <Video size={18} className="text-emerald-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-emerald-800">Приєднатися до Zoom</p>
                      {event.zoomPassword && (
                        <p className="text-xs text-emerald-600 mt-0.5">Пароль: {event.zoomPassword}</p>
                      )}
                    </div>
                    <ExternalLink size={14} className="text-emerald-400 shrink-0" />
                  </a>
                )}
                {event.presentationUrl && (
                  <a
                    href={event.presentationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition"
                  >
                    <ExternalLink size={18} className="text-blue-600 shrink-0" />
                    <p className="text-sm font-medium text-blue-800 flex-1">Презентація</p>
                    <ChevronRight size={14} className="text-blue-400" />
                  </a>
                )}
                {/* Recording */}
                {event.recordingUrl && !recordingExpired && (
                  <a
                    href={event.recordingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-4 py-3 bg-purple-50 border border-purple-200 rounded-xl hover:bg-purple-100 transition"
                  >
                    <Video size={18} className="text-purple-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-purple-800">Переглянути запис</p>
                      {event.recordingExpiresAt && (
                        <p className="text-xs text-purple-500 mt-0.5">
                          Доступно до {format(new Date(event.recordingExpiresAt), 'd MMMM', { locale: uk })}
                        </p>
                      )}
                    </div>
                    <ExternalLink size={14} className="text-purple-400 shrink-0" />
                  </a>
                )}
                {event.recordingUrl && recordingExpired && (
                  <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-500">
                    <Lock size={16} className="shrink-0" />
                    <p className="text-sm">Термін доступу до запису минув</p>
                  </div>
                )}
              </div>
            )}

            {/* Receipt upload for PAYMENT_SENT / RECEIPT_UPLOADED */}
            {canUploadReceipt && (
              <div className="space-y-3">
                {event.paymentInstructions && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                    <p className="text-xs text-amber-800 font-medium mb-1.5">💳 Реквізити для оплати</p>
                    <p className="text-sm text-amber-900 whitespace-pre-line leading-relaxed">{event.paymentInstructions}</p>
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-semibold text-warm-dark mb-2">Підтвердження оплати</h3>

                  {/* Step 1: drop zone / file picker */}
                  {!pendingReceiptFile && (
                    <div
                      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={handleFileDrop}
                      onClick={() => fileRef.current?.click()}
                      className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${
                        dragOver ? 'border-rose bg-rose-lighter' : 'border-sand hover:border-rose/50 hover:bg-beige'
                      }`}
                    >
                      <Upload size={24} className="text-rose/50 mx-auto mb-2" />
                      <p className="text-sm text-warm-mid font-medium">Оберіть файл квитанції</p>
                      <p className="text-xs text-warm-light mt-1">PDF, JPG, PNG — перетягніть або натисніть</p>
                    </div>
                  )}

                  {/* Step 2: file selected, confirm send */}
                  {pendingReceiptFile && (
                    <div className="border border-sand rounded-xl px-4 py-3 bg-beige flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-warm-dark truncate">{pendingReceiptFile.name}</p>
                        <p className="text-xs text-warm-light mt-0.5">{(pendingReceiptFile.size / 1024).toFixed(0)} КБ</p>
                      </div>
                      <button
                        onClick={() => setPendingReceiptFile(null)}
                        className="text-warm-light hover:text-rose transition shrink-0"
                        title="Скасувати"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}

                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={e => { if (e.target.files?.[0]) { setPendingReceiptFile(e.target.files[0]); e.target.value = '' } }}
                  />

                  {pendingReceiptFile && (
                    <button
                      onClick={handleUploadReceipt}
                      disabled={uploadingReceipt}
                      className="mt-3 w-full py-3 bg-rose text-white rounded-xl font-medium hover:bg-rose/90 transition disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      <Upload size={16} />
                      {uploadingReceipt ? 'Надсилаємо...' : 'Надіслати квитанцію'}
                    </button>
                  )}

                  {reg?.status === 'RECEIPT_UPLOADED' && !pendingReceiptFile && (
                    <p className="text-xs text-purple-600 mt-2 text-center">
                      Квитанцію отримано — очікуйте підтвердження
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Register button */}
            {canRegister && (
              <div>
                <div className="bg-rose-lighter border border-rose/20 rounded-xl px-4 py-3 mb-4">
                  <p className="text-xs text-warm-mid font-medium mb-1">Вартість</p>
                  <p className="text-lg font-bold text-warm-dark">
                    {event.price === 0 ? 'Безкоштовно' : `${event.price} ${event.currency}`}
                  </p>
                  {event.paymentInstructions && (
                    <p className="text-xs text-warm-light mt-1">Реквізити для оплати з'являться тут одразу після реєстрації</p>
                  )}
                </div>
                <button
                  onClick={handleRegister}
                  disabled={registering}
                  className="w-full py-3 bg-rose text-white rounded-xl font-medium hover:bg-rose/90 transition disabled:opacity-60"
                >
                  {registering ? 'Реєстрація...' : 'Зареєструватися'}
                </button>
              </div>
            )}

            {/* Not registered, closed */}
            {!reg && !canRegister && !isCompleted && (
              <div className="text-center py-4 text-warm-light text-sm">
                <Lock size={18} className="mx-auto mb-1.5 text-sand" />
                {isFull ? 'Всі місця зайняті' : 'Реєстрацію закрито'}
              </div>
            )}

            {/* Not registered, completed */}
            {!reg && isCompleted && (
              <div className="text-center py-4 text-warm-light text-sm">
                Захід завершився
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}
