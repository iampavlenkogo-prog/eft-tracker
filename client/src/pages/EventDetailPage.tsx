import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import {
  Calendar, CheckCircle, Video, Upload, X,
  ExternalLink, Lock, ChevronRight, AlertCircle, ChevronLeft, Send, Link as LinkIcon, Clock,
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
  PENDING:          { label: 'Зареєстровано',       class: 'bg-amber-100 text-amber-700',   desc: 'Очікуйте реквізитів для оплати від організатора' },
  PAYMENT_SENT:     { label: 'Реквізити надіслано',  class: 'bg-blue-100 text-blue-700',     desc: 'Завантажте підтвердження оплати нижче' },
  RECEIPT_UPLOADED: { label: 'Квитанцію надіслано',  class: 'bg-purple-100 text-purple-700', desc: 'Очікуйте підтвердження від організатора' },
  CONFIRMED:        { label: 'Підтверджено ✓',       class: 'bg-emerald-100 text-emerald-700', desc: 'Ваша участь підтверджена. Zoom-посилання нижче.' },
  REJECTED:         { label: 'Відхилено',            class: 'bg-red-100 text-red-700',       desc: 'Реєстрацію відхилено. Зверніться до організатора.' },
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

  if (loading) {
    return (
      <Layout>
        <div className="max-w-[1180px] mx-auto space-y-4 animate-pulse">
          <div className="h-64 bg-white rounded-[28px] border border-sand" />
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
  const isOrganizer = event.organizer.id === user?.id
  const isCompleted = event.status === 'COMPLETED'
  const isCancelled = event.status === 'CANCELLED'
  const spotsLeft = event.maxParticipants ? event.maxParticipants - event._count.registrations : null
  const isFull = spotsLeft !== null && spotsLeft <= 0
  const canRegister = !reg && !isCompleted && !isCancelled && !event.registrationClosed && !isFull && !isOrganizer
  const canUploadReceipt = reg && (reg.status === 'PAYMENT_SENT' || reg.status === 'RECEIPT_UPLOADED')
  const recordingExpired = event.recordingExpiresAt && new Date(event.recordingExpiresAt) < new Date()

  const OrgAvatar = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => {
    const cls = size === 'sm' ? 'w-10 h-10 text-sm' : size === 'lg' ? 'w-16 h-16 text-lg' : 'w-10 h-10 text-sm'
    return (
      <div className={`${cls} rounded-full bg-gradient-to-br from-[#E9C3CC] to-[#D89AAC] flex items-center justify-center shrink-0 overflow-hidden text-white font-bold`}>
        {event.organizer.avatarUrl
          ? <img src={event.organizer.avatarUrl} alt="" className="w-full h-full object-cover" />
          : `${event.organizer.firstName[0]}${event.organizer.lastName[0]}`}
      </div>
    )
  }

  return (
    <Layout>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 bg-[#3C2E27] text-white px-5 py-3 rounded-2xl text-sm shadow-xl z-50 max-w-xs text-center">
          {toast}
        </div>
      )}

      <div className="max-w-[1180px] mx-auto">

        {/* Back */}
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 text-sm text-[#9D8C80] hover:text-[#6B584E] transition mb-5"
        >
          <ChevronLeft size={14} />
          Усі події
        </button>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 items-start">

          {/* ══ MAIN ══ */}
          <div className="min-w-0 order-2 lg:order-1">

            {/* Banner */}
            <div
              className="relative rounded-[28px] overflow-hidden bg-[#F3E2DA] border border-[rgba(120,92,72,0.08)] shadow-[0_2px_6px_rgba(70,45,30,.06),0_16px_40px_rgba(130,90,60,.09)]"
              style={{ aspectRatio: '16/7' }}
            >
              {event.coverImageUrl
                ? <img src={event.coverImageUrl} alt={event.title} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center">
                    <Calendar size={72} className="text-[rgba(176,85,114,0.2)]" />
                  </div>
              }
              {/* Overlay badges */}
              <div className="absolute top-4 left-4 flex gap-2">
                {isCancelled && (
                  <span className="bg-white/92 text-red-700 text-xs font-bold px-3 py-1.5 rounded-full shadow-sm">Скасовано</span>
                )}
                {isCompleted && (
                  <span className="bg-white/92 text-purple-700 text-xs font-bold px-3 py-1.5 rounded-full shadow-sm">Захід завершено</span>
                )}
                {!isCancelled && !isCompleted && (
                  <span className="bg-white/92 text-[#6C2A41] text-[11px] font-bold px-3 py-1.5 rounded-full shadow-sm tracking-wider uppercase">✦ Подія</span>
                )}
              </div>
            </div>

            {/* Title */}
            <h1 className="font-cormorant text-[clamp(30px,4vw,42px)] font-semibold text-[#3C2E27] leading-[1.08] mt-7">
              {event.title}
            </h1>

            {/* Quick facts 2×2 */}
            <div className="grid grid-cols-2 mt-6 bg-white border border-[rgba(120,92,72,0.08)] rounded-[18px] shadow-[0_1px_2px_rgba(70,45,30,.05),0_6px_18px_rgba(130,90,60,.05)] overflow-hidden">

              {/* Date */}
              <div className="flex items-center gap-3.5 p-5">
                <div className="w-10 h-10 rounded-[12px] bg-[#FBEAEE] flex items-center justify-center shrink-0">
                  <Calendar size={19} className="text-[#B05572]" />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-[#9D8C80]">Дата</p>
                  <p className="text-[15px] font-bold text-[#3C2E27] mt-0.5 leading-snug capitalize">{dateStr}</p>
                </div>
              </div>

              {/* Time */}
              <div className="flex items-center gap-3.5 p-5 border-l border-[rgba(120,92,72,0.08)]">
                <div className="w-10 h-10 rounded-[12px] bg-[#FBEAEE] flex items-center justify-center shrink-0">
                  <Clock size={19} className="text-[#B05572]" />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-[#9D8C80]">Час (Київ)</p>
                  <p className="text-[15px] font-bold text-[#3C2E27] mt-0.5">
                    {event.startTime || '—'}{event.endTime ? `–${event.endTime}` : ''}
                  </p>
                </div>
              </div>

              {/* Format */}
              <div className="flex items-center gap-3.5 p-5 border-t border-[rgba(120,92,72,0.08)]">
                <div className="w-10 h-10 rounded-[12px] bg-[#FBEAEE] flex items-center justify-center shrink-0">
                  <Video size={19} className="text-[#B05572]" />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-[#9D8C80]">Формат</p>
                  <p className="text-[15px] font-bold text-[#3C2E27] mt-0.5">
                    {event.zoomLink ? 'Онлайн · Zoom' : 'Офлайн'}
                  </p>
                </div>
              </div>

              {/* Organizer */}
              <div className="flex items-center gap-3.5 p-5 border-t border-l border-[rgba(120,92,72,0.08)]">
                <OrgAvatar size="sm" />
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-[#9D8C80]">Організатор</p>
                  <p className="text-[15px] font-bold text-[#3C2E27] mt-0.5 leading-snug">
                    {event.organizer.firstName} {event.organizer.lastName}
                  </p>
                </div>
              </div>
            </div>

            {/* About */}
            <section className="mt-9">
              <h2 className="font-cormorant text-[26px] font-semibold text-[#3C2E27] mb-4">Про захід</h2>
              <p className="text-[15.5px] text-[#6B584E] leading-[1.72] whitespace-pre-line">{event.description}</p>
            </section>

            {/* Benefits */}
            {Array.isArray(event.benefitsList) && event.benefitsList.length > 0 && (
              <section className="mt-9">
                <h2 className="font-cormorant text-[26px] font-semibold text-[#3C2E27] mb-4">Що отримаєте</h2>
                <div className="space-y-4">
                  {event.benefitsList.map((b, i) => (
                    <div key={i} className="flex gap-3.5 items-start">
                      <div className="w-7 h-7 rounded-[9px] bg-[#E4EFE6] flex items-center justify-center shrink-0 mt-0.5">
                        <CheckCircle size={15} className="text-[#5E8E6E]" />
                      </div>
                      <p className="text-[15.5px] text-[#3C2E27] leading-[1.55]">{b}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Presenter */}
            <section className="mt-9">
              <h2 className="font-cormorant text-[26px] font-semibold text-[#3C2E27] mb-4">Ведучий/а</h2>
              <div className="flex gap-4 items-center p-5 bg-white border border-[rgba(120,92,72,0.08)] rounded-[18px] shadow-[0_1px_2px_rgba(70,45,30,.05),0_6px_18px_rgba(130,90,60,.05)]">
                <OrgAvatar size="lg" />
                <div>
                  <p className="font-cormorant text-[21px] font-semibold text-[#3C2E27] leading-tight">
                    {event.organizer.firstName} {event.organizer.lastName}
                  </p>
                  <p className="text-[13.5px] text-[#9D8C80] mt-1.5">Організатор заходу</p>
                </div>
              </div>
            </section>

            {/* Organizer controls */}
            {isOrganizer && (
              <div className="mt-9 bg-white rounded-[18px] border border-[rgba(120,92,72,0.08)] shadow-[0_1px_2px_rgba(70,45,30,.05),0_6px_18px_rgba(130,90,60,.05)] p-6">
                <h2 className="font-cormorant text-[22px] font-semibold text-[#3C2E27] mb-1">Управління подією</h2>
                <p className="text-xs text-[#9D8C80] mb-4">Ви — організатор цього заходу</p>
                <button
                  onClick={() => { setNotifyError(''); setNotifySuccess(''); setShowNotifyModal(true) }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-[#FBEAEE] border border-[rgba(176,85,114,0.2)] text-[#B05572] rounded-xl text-sm font-medium hover:bg-[#B05572] hover:text-white transition"
                >
                  <Send size={15} />
                  Написати всім учасникам
                </button>
              </div>
            )}

          </div>

          {/* ══ STICKY SIDEBAR ══ */}
          <aside className="order-1 lg:order-2 lg:sticky lg:top-[88px] flex flex-col gap-4">
            <div className="bg-white border border-[rgba(120,92,72,0.08)] rounded-[28px] shadow-[0_2px_6px_rgba(70,45,30,.06),0_16px_40px_rgba(130,90,60,.09)] p-6">

              {/* Price */}
              <div className="flex items-baseline gap-2">
                {event.price === 0
                  ? <span className="font-cormorant text-[36px] font-bold text-[#5E8E6E] leading-none">Безкоштовно</span>
                  : <>
                      <span className="font-cormorant text-[44px] font-bold text-[#3C2E27] leading-none">{event.price}</span>
                      <span className="text-[15px] text-[#9D8C80] font-semibold">{event.currency}</span>
                    </>
                }
              </div>

              {/* Spots indicator */}
              {spotsLeft !== null && spotsLeft > 0 && (
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="w-2 h-2 rounded-full bg-[#5E8E6E] shrink-0" />
                  <span className="text-[13px] font-bold text-[#5E8E6E]">Залишилось {spotsLeft} місць</span>
                </div>
              )}
              {isFull && (
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="w-2 h-2 rounded-full bg-orange-400 shrink-0" />
                  <span className="text-[13px] font-bold text-orange-600">Місця вичерпані</span>
                </div>
              )}

              {/* Date / time / format meta */}
              <div className="border-t border-[rgba(120,92,72,0.08)] mt-5 pt-5 space-y-3">
                <div className="flex items-center gap-3 text-[14.5px] text-[#6B584E]">
                  <Calendar size={16} className="text-[#B05572] shrink-0" />
                  <span>
                    <strong className="text-[#3C2E27]">{format(dateObj, 'd MMMM', { locale: uk })}</strong>
                    {', '}{format(dateObj, 'EEEE', { locale: uk })}
                  </span>
                </div>
                {event.startTime && (
                  <div className="flex items-center gap-3 text-[14.5px] text-[#6B584E]">
                    <Clock size={16} className="text-[#B05572] shrink-0" />
                    <span>{event.startTime}{event.endTime ? `–${event.endTime}` : ''} · Київ</span>
                  </div>
                )}
                {event.zoomLink && (
                  <div className="flex items-center gap-3 text-[14.5px] text-[#6B584E]">
                    <Video size={16} className="text-[#B05572] shrink-0" />
                    <span>Онлайн · Zoom</span>
                  </div>
                )}
              </div>

              {/* ── Registration area ── */}
              <div className="mt-5">

                {/* Status badge */}
                {reg && STATUS_LABEL[reg.status] && (
                  <div className={`rounded-xl px-4 py-3 flex items-start gap-3 mb-4 ${STATUS_LABEL[reg.status].class}`}>
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-sm">{STATUS_LABEL[reg.status].label}</p>
                      <p className="text-xs mt-0.5 opacity-80">{STATUS_LABEL[reg.status].desc}</p>
                    </div>
                  </div>
                )}

                {/* Zoom / materials / recording for CONFIRMED */}
                {reg?.status === 'CONFIRMED' && (
                  <div className="space-y-2 mb-4">
                    {event.zoomLink && (
                      <a href={event.zoomLink} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition">
                        <Video size={17} className="text-emerald-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-emerald-800">Приєднатися до Zoom</p>
                          {event.zoomPassword && <p className="text-xs text-emerald-600 mt-0.5">Пароль: {event.zoomPassword}</p>}
                        </div>
                        <ExternalLink size={13} className="text-emerald-400 shrink-0" />
                      </a>
                    )}
                    {event.presentationUrl && (
                      <a href={event.presentationUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition">
                        <ExternalLink size={17} className="text-blue-600 shrink-0" />
                        <p className="text-sm font-medium text-blue-800 flex-1">Презентація</p>
                        <ChevronRight size={13} className="text-blue-400" />
                      </a>
                    )}
                    {event.recordingUrl && !recordingExpired && (
                      <a href={event.recordingUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-3 px-4 py-3 bg-purple-50 border border-purple-200 rounded-xl hover:bg-purple-100 transition">
                        <Video size={17} className="text-purple-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-purple-800">Переглянути запис</p>
                          {event.recordingExpiresAt && (
                            <p className="text-xs text-purple-500 mt-0.5">
                              Доступно до {format(new Date(event.recordingExpiresAt), 'd MMMM', { locale: uk })}
                            </p>
                          )}
                        </div>
                        <ExternalLink size={13} className="text-purple-400 shrink-0" />
                      </a>
                    )}
                    {event.recordingUrl && recordingExpired && (
                      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-500">
                        <Lock size={15} className="shrink-0" />
                        <p className="text-sm">Термін доступу до запису минув</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Receipt upload */}
                {canUploadReceipt && (
                  <div className="space-y-3 mb-4">
                    {event.paymentInstructions && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                        <p className="text-xs text-amber-800 font-medium mb-1.5">💳 Реквізити для оплати</p>
                        <p className="text-sm text-amber-900 whitespace-pre-line leading-relaxed">{event.paymentInstructions}</p>
                      </div>
                    )}
                    <h3 className="text-sm font-semibold text-[#3C2E27]">Підтвердження оплати</h3>
                    {!pendingReceiptFile ? (
                      <div
                        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleFileDrop}
                        onClick={() => fileRef.current?.click()}
                        className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition ${
                          dragOver ? 'border-[#B05572] bg-[#FBEAEE]' : 'border-[#E4CFC0] hover:border-[#B05572]/50 hover:bg-[#FBF5ED]'
                        }`}
                      >
                        <Upload size={22} className="text-[#B05572]/50 mx-auto mb-2" />
                        <p className="text-sm text-[#6B584E] font-medium">Оберіть файл квитанції</p>
                        <p className="text-xs text-[#9D8C80] mt-1">PDF, JPG, PNG — перетягніть або натисніть</p>
                      </div>
                    ) : (
                      <div className="border border-[#E4CFC0] rounded-xl px-4 py-3 bg-[#FBF5ED] flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#3C2E27] truncate">{pendingReceiptFile.name}</p>
                          <p className="text-xs text-[#9D8C80] mt-0.5">{(pendingReceiptFile.size / 1024).toFixed(0)} КБ</p>
                        </div>
                        <button onClick={() => setPendingReceiptFile(null)} className="text-[#9D8C80] hover:text-[#B05572] transition shrink-0">
                          <X size={15} />
                        </button>
                      </div>
                    )}
                    <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                      onChange={e => { if (e.target.files?.[0]) { setPendingReceiptFile(e.target.files[0]); e.target.value = '' } }} />
                    {pendingReceiptFile && (
                      <button
                        onClick={handleUploadReceipt}
                        disabled={uploadingReceipt}
                        className="w-full flex items-center justify-center gap-2 bg-[#B05572] text-white font-bold text-sm px-6 py-3 rounded-full hover:bg-[#98415E] transition disabled:opacity-50 shadow-[0_4px_12px_rgba(176,85,114,0.25)]"
                      >
                        <Upload size={15} />
                        {uploadingReceipt ? 'Надсилаємо...' : 'Надіслати квитанцію'}
                      </button>
                    )}
                    {reg?.status === 'RECEIPT_UPLOADED' && !pendingReceiptFile && (
                      <p className="text-xs text-purple-600 text-center">Квитанцію отримано — очікуйте підтвердження</p>
                    )}
                  </div>
                )}

                {/* Register button */}
                {canRegister && (
                  <>
                    <button
                      onClick={() => { setConsents([false, false, false, false, false]); setShowConsentModal(true) }}
                      disabled={registering}
                      className="w-full bg-[#B05572] text-white font-bold text-[15px] px-6 py-3.5 rounded-full hover:bg-[#98415E] transition-all shadow-[0_6px_18px_rgba(176,85,114,0.28)] hover:shadow-[0_10px_26px_rgba(176,85,114,0.34)] disabled:opacity-50"
                    >
                      {registering ? 'Реєстрація...' : 'Зареєструватися'}
                    </button>
                    {event.paymentInstructions && (
                      <p className="text-[12.5px] text-[#9D8C80] text-center mt-3 leading-relaxed">
                        Реквізити для оплати з'являться одразу після реєстрації
                      </p>
                    )}
                  </>
                )}

                {/* Closed / full */}
                {!reg && !canRegister && !isCompleted && !isCancelled && (
                  <div className="text-center py-3 text-[#9D8C80] text-sm">
                    <Lock size={18} className="mx-auto mb-1.5 text-[#B9A99E]" />
                    {isFull ? 'Всі місця зайняті' : 'Реєстрацію закрито'}
                  </div>
                )}

                {!reg && isCompleted && (
                  <div className="text-center py-3 text-[#9D8C80] text-sm">Захід завершився</div>
                )}

                {isCancelled && (
                  <div className="text-center py-3 text-red-500 text-sm font-medium">Захід скасовано</div>
                )}

              </div>
            </div>
          </aside>

        </div>
      </div>

      {/* ── Notify participants modal ── */}
      {showNotifyModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowNotifyModal(false)} />
          <div className="relative bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[92vh]">
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
            <form id="notify-form" onSubmit={handleNotifyParticipants} className="px-6 py-5 overflow-y-auto flex-1 space-y-4">
              {notifySuccess && <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-800 font-medium">{notifySuccess}</div>}
              {notifyError  && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{notifyError}</div>}
              <div>
                <label className="block text-xs font-medium text-warm-dark mb-1.5">Тема листа *</label>
                <input type="text" value={notifySubject} onChange={e => setNotifySubject(e.target.value)} required
                  placeholder="Наприклад: Важлива інформація щодо заходу"
                  className="w-full bg-[#FFF9F5] border border-[#EDE5DE] rounded-xl px-4 py-2.5 text-sm text-warm-dark placeholder:text-[#9A8878] focus:outline-none focus:border-[#B8A8A4]/60 transition" />
              </div>
              <div>
                <label className="block text-xs font-medium text-warm-dark mb-1.5">Повідомлення *</label>
                <textarea value={notifyMessage} onChange={e => setNotifyMessage(e.target.value)} required rows={5}
                  placeholder="Текст повідомлення для всіх учасників..."
                  className="w-full bg-[#FFF9F5] border border-[#EDE5DE] rounded-xl px-4 py-2.5 text-sm text-warm-dark placeholder:text-[#9A8878] focus:outline-none focus:border-[#B8A8A4]/60 transition resize-none" />
              </div>
              <div className="space-y-3">
                <p className="text-xs font-medium text-warm-dark flex items-center gap-1.5">
                  <LinkIcon size={12} className="text-warm-light" />Посилання (необов'язково)
                </p>
                <div>
                  <label className="block text-xs text-warm-light mb-1">URL посилання</label>
                  <input type="url" value={notifyLinkUrl} onChange={e => setNotifyLinkUrl(e.target.value)} placeholder="https://..."
                    className="w-full bg-[#FFF9F5] border border-[#EDE5DE] rounded-xl px-4 py-2.5 text-sm text-warm-dark placeholder:text-[#9A8878] focus:outline-none focus:border-[#B8A8A4]/60 transition" />
                </div>
                <div>
                  <label className="block text-xs text-warm-light mb-1">Текст кнопки</label>
                  <input type="text" value={notifyLinkText} onChange={e => setNotifyLinkText(e.target.value)} placeholder="Наприклад: Відкрити Zoom"
                    className="w-full bg-[#FFF9F5] border border-[#EDE5DE] rounded-xl px-4 py-2.5 text-sm text-warm-dark placeholder:text-[#9A8878] focus:outline-none focus:border-[#B8A8A4]/60 transition" />
                </div>
              </div>
            </form>
            <div className="px-6 py-4 border-t border-sand shrink-0">
              <button type="submit" form="notify-form" disabled={sending || !notifySubject.trim() || !notifyMessage.trim()}
                className="w-full flex items-center justify-center gap-2 bg-[#B05572] text-white font-bold text-sm px-6 py-3 rounded-full hover:bg-[#98415E] transition disabled:opacity-40 disabled:cursor-not-allowed">
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
            <div className="px-6 py-4 border-t border-sand shrink-0">
              <button
                onClick={async () => { setShowConsentModal(false); await handleRegister() }}
                disabled={!consents.every(Boolean) || registering}
                className="w-full bg-[#B05572] text-white font-bold text-[15px] px-6 py-3.5 rounded-full hover:bg-[#98415E] transition disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_6px_18px_rgba(176,85,114,0.28)]"
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
