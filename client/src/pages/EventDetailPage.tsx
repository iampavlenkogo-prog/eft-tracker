import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import {
  Calendar, CheckCircle, Video, Upload, X,
  ExternalLink, Lock, ChevronRight, AlertCircle, ChevronLeft, Send, Link as LinkIcon,
} from 'lucide-react'
import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
import api from '../api/axios'
import Layout from '../components/Layout'
import { useAuth } from '../context/AuthContext'

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
  const { user } = useAuth()
  const handleBack = () => {
    const from = (location.state as any)?.from
    if (from === 'supervisor') navigate('/supervisor?tab=events')
    else navigate(-1)
  }

  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [registering, setRegistering] = useState(false)
  const [showConsentModal, setShowConsentModal] = useState(false)
  const [consents, setConsents] = useState([false, false, false, false, false])
  const [uploadingReceipt, setUploadingReceipt] = useState(false)
  const [pendingReceiptFile, setPendingReceiptFile] = useState<File | null>(null)
  const [toast, setToast] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Notify participants
  const [showNotifyModal, setShowNotifyModal] = useState(false)
  const [notifySubject, setNotifySubject] = useState('')
  const [notifyMessage, setNotifyMessage] = useState('')
  const [notifyLinkUrl, setNotifyLinkUrl] = useState('')
  const [notifyLinkText, setNotifyLinkText] = useState('')
  const [sending, setSending] = useState(false)
  const [notifyError, setNotifyError] = useState('')
  const [notifySuccess, setNotifySuccess] = useState('')

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

  const handleNotifyParticipants = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!event) return
    setNotifyError(''); setNotifySuccess(''); setSending(true)
    try {
      const res = await api.post(`/events/${event.id}/notify-participants`, {
        subject: notifySubject,
        message: notifyMessage,
        linkUrl: notifyLinkUrl || null,
        linkText: notifyLinkText || null,
      })
      setNotifySuccess(`Надіслано ${res.data.sent} учасникам ✓`)
      setNotifySubject(''); setNotifyMessage(''); setNotifyLinkUrl(''); setNotifyLinkText('')
    } catch (err: any) {
      setNotifyError(err.response?.data?.error || 'Помилка надсилання')
    } finally {
      setSending(false)
    }
  }

  if (!event) return null

  const dateObj = new Date(event.date)
  const dateStr = format(dateObj, 'EEEE, d MMMM yyyy', { locale: uk })
  const reg = event.registrations[0]
  const isOrganizer = event.organizer.id === user?.id
  const isCompleted = event.status === 'COMPLETED'
  const isCancelled = event.status === 'CANCELLED'
  const spotsLeft = event.maxParticipants ? event.maxParticipants - event._count.registrations : null
  const isFull = spotsLeft !== null && spotsLeft <= 0
  const canRegister = !reg && !isCompleted && !isCancelled && !event.registrationClosed && !isFull && !isOrganizer
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

        {/* Organizer controls */}
        {isOrganizer && (
          <div className="bg-white rounded-2xl border border-sand p-6">
            <h2 className="text-base font-semibold text-warm-dark mb-1">Управління подією</h2>
            <p className="text-xs text-warm-light mb-4">Ви — організатор цього заходу</p>
            <button
              onClick={() => { setNotifyError(''); setNotifySuccess(''); setShowNotifyModal(true) }}
              className="flex items-center gap-2 px-4 py-2.5 bg-rose-lighter border border-rose/20 text-rose rounded-xl text-sm font-medium hover:bg-rose hover:text-white transition"
            >
              <Send size={15} />
              Написати всім учасникам
            </button>
          </div>
        )}

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
                      className="mt-3 bg-gradient-to-br from-[#6BC1B6] to-[#5AAEAA] text-white font-medium rounded-xl px-6 py-2.5 text-sm neu-btn-primary hover:opacity-90 transition disabled:opacity-50 w-full justify-center flex items-center gap-2"
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
                  onClick={() => { setConsents([false, false, false, false, false]); setShowConsentModal(true) }}
                  className="bg-gradient-to-br from-[#6BC1B6] to-[#5AAEAA] text-white font-medium rounded-xl px-6 py-2.5 text-sm neu-btn-primary hover:opacity-90 transition w-full justify-center flex items-center gap-2"
                >
                  Зареєструватися
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

      {/* ── Notify participants modal ── */}
      {showNotifyModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowNotifyModal(false)} />
          <div className="relative bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[92vh]">

            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-sand shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-cormorant text-xl font-semibold text-warm-dark leading-snug">Написати учасникам</h2>
                  <p className="text-sm text-rose font-medium mt-0.5 truncate">{event.title}</p>
                </div>
                <button onClick={() => setShowNotifyModal(false)} className="text-warm-light hover:text-warm-mid transition shrink-0 mt-0.5">
                  <X size={18} />
                </button>
              </div>
            </div>

            <form
              id="notify-form"
              onSubmit={handleNotifyParticipants}
              className="px-6 py-5 overflow-y-auto flex-1 space-y-4"
            >
              {notifySuccess && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-800 font-medium">
                  {notifySuccess}
                </div>
              )}
              {notifyError && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                  {notifyError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-warm-dark mb-1.5">Тема листа *</label>
                <input
                  type="text"
                  value={notifySubject}
                  onChange={e => setNotifySubject(e.target.value)}
                  required
                  placeholder="Наприклад: Важлива інформація щодо заходу"
                  className="w-full bg-[#F1F7F7] border border-[#D5E6E5] rounded-xl px-4 py-2.5 text-sm text-warm-dark placeholder:text-[#8AABAB] focus:outline-none focus:border-[#4D8A85]/60 transition neu-input"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-warm-dark mb-1.5">Повідомлення *</label>
                <textarea
                  value={notifyMessage}
                  onChange={e => setNotifyMessage(e.target.value)}
                  required
                  rows={5}
                  placeholder="Текст повідомлення для всіх учасників..."
                  className="w-full bg-[#F1F7F7] border border-[#D5E6E5] rounded-xl px-4 py-2.5 text-sm text-warm-dark placeholder:text-[#8AABAB] focus:outline-none focus:border-[#4D8A85]/60 transition neu-input resize-none"
                />
              </div>

              <div className="space-y-3">
                <p className="text-xs font-medium text-warm-dark flex items-center gap-1.5">
                  <LinkIcon size={12} className="text-warm-light" />
                  Посилання (необов'язково)
                </p>
                <div>
                  <label className="block text-xs text-warm-light mb-1">URL посилання</label>
                  <input
                    type="url"
                    value={notifyLinkUrl}
                    onChange={e => setNotifyLinkUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-[#F1F7F7] border border-[#D5E6E5] rounded-xl px-4 py-2.5 text-sm text-warm-dark placeholder:text-[#8AABAB] focus:outline-none focus:border-[#4D8A85]/60 transition neu-input"
                  />
                </div>
                <div>
                  <label className="block text-xs text-warm-light mb-1">Текст кнопки</label>
                  <input
                    type="text"
                    value={notifyLinkText}
                    onChange={e => setNotifyLinkText(e.target.value)}
                    placeholder="Наприклад: Відкрити Zoom"
                    className="w-full bg-[#F1F7F7] border border-[#D5E6E5] rounded-xl px-4 py-2.5 text-sm text-warm-dark placeholder:text-[#8AABAB] focus:outline-none focus:border-[#4D8A85]/60 transition neu-input"
                  />
                </div>
              </div>
            </form>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-sand shrink-0">
              <button
                type="submit"
                form="notify-form"
                disabled={sending || !notifySubject.trim() || !notifyMessage.trim()}
                className="bg-gradient-to-br from-[#6BC1B6] to-[#5AAEAA] text-white font-medium rounded-xl px-6 py-2.5 text-sm neu-btn-primary hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed w-full justify-center flex items-center gap-2"
              >
                <Send size={15} />
                {sending ? 'Надсилаємо...' : 'Надіслати всім учасникам'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Consent modal ── */}
      {showConsentModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowConsentModal(false)} />
          <div className="relative bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[92vh]">

            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-sand shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-cormorant text-xl font-semibold text-warm-dark leading-snug">Підтвердження участі</h2>
                  <p className="text-sm text-rose font-medium mt-0.5">Простір довіри та професійної етики</p>
                </div>
                <button onClick={() => setShowConsentModal(false)} className="text-warm-light hover:text-warm-mid transition shrink-0 mt-0.5">
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-5 overflow-y-auto flex-1 space-y-4">
              <p className="text-sm text-warm-mid leading-relaxed">
                Беручи участь у цій події, я підтверджую, що дотримуватимуся етичних принципів професійної EFT-спільноти.
              </p>
              <p className="text-sm text-warm-mid leading-relaxed">
                Я усвідомлюю, що під час події можуть обговорюватися клінічні випадки, особистий досвід учасників, навчальні матеріали та інша конфіденційна інформація.
              </p>

              <p className="text-sm font-medium text-warm-dark">Я погоджуюся:</p>

              <div className="space-y-3">
                {[
                  'дотримуватися конфіденційності щодо всього, що почую або побачу під час події;',
                  'не поширювати записи, матеріали або інформацію про учасників без їхнього дозволу;',
                  'з повагою ставитися до різних професійних поглядів, досвіду та особистих історій;',
                  'підтримувати безпечну, доброзичливу та професійну атмосферу спільноти;',
                  'використовувати отримані матеріали виключно для власного навчання та професійного розвитку.',
                ].map((text, i) => (
                  <label key={i} className="flex items-start gap-3 cursor-pointer group">
                    <div
                      onClick={() => setConsents(prev => prev.map((v, idx) => idx === i ? !v : v))}
                      className={`mt-0.5 w-5 h-5 shrink-0 rounded border-2 flex items-center justify-center transition-colors ${
                        consents[i] ? 'bg-rose border-rose' : 'border-sand group-hover:border-rose/50'
                      }`}
                    >
                      {consents[i] && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <span
                      onClick={() => setConsents(prev => prev.map((v, idx) => idx === i ? !v : v))}
                      className="text-sm text-warm-mid leading-relaxed select-none"
                    >
                      {text}
                    </span>
                  </label>
                ))}
              </div>

              <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 mt-2">
                <p className="text-sm text-amber-800 leading-relaxed">
                  💛 Ми цінуємо простір, у якому кожен може навчатися, ділитися досвідом і зростати в атмосфері довіри та взаємної поваги.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-sand shrink-0">
              <button
                onClick={async () => {
                  setShowConsentModal(false)
                  await handleRegister()
                }}
                disabled={!consents.every(Boolean) || registering}
                className="bg-gradient-to-br from-[#6BC1B6] to-[#5AAEAA] text-white font-medium rounded-xl px-6 py-2.5 text-sm neu-btn-primary hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed w-full"
              >
                {registering ? 'Реєстрація...' : 'Погоджуюся та продовжити'}
              </button>
              {!consents.every(Boolean) && (
                <p className="text-center text-xs text-warm-light mt-2">Позначте всі пункти, щоб продовжити</p>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
