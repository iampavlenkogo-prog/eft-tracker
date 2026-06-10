import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import {
  Calendar, CheckCircle, Video, Upload, X,
  ExternalLink, Lock, AlertCircle, ChevronLeft, Send, Link as LinkIcon, Clock,
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

const CLAY = '-10px -10px 24px rgba(255,255,255,.85), 14px 16px 36px rgba(190,150,155,.30)'
const CLAY_SM = '-6px -6px 14px rgba(255,255,255,.80), 8px 10px 22px rgba(190,150,155,.24)'
const BTN_SHADOW = '-4px -4px 12px rgba(255,255,255,.4), 10px 12px 26px rgba(168,94,115,.40)'

const STATUS_INFO: Record<string, { label: string; desc: string; bg: string }> = {
  PENDING:          { label: 'Зареєстровано',       desc: 'Очікуйте реквізитів для оплати від організатора', bg: 'bg-amber-100 text-amber-700' },
  PAYMENT_SENT:     { label: 'Реквізити надіслано',  desc: 'Завантажте підтвердження оплати нижче',           bg: 'bg-blue-100 text-blue-700' },
  RECEIPT_UPLOADED: { label: 'Квитанцію надіслано',  desc: 'Очікуйте підтвердження від організатора',         bg: 'bg-purple-100 text-purple-700' },
  CONFIRMED:        { label: 'Підтверджено ✓',       desc: 'Ваша участь підтверджена',                        bg: 'bg-emerald-100 text-emerald-700' },
  REJECTED:         { label: 'Відхилено',            desc: 'Реєстрацію відхилено. Зверніться до організатора.', bg: 'bg-red-100 text-red-700' },
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
  const [consents, setConsents] = useState([false, false, false, false, false, false])
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
        <div className="max-w-[1120px] mx-auto px-4 animate-pulse">
          <div className="h-5 w-24 bg-[#F5E4E4] rounded-full mb-5" />
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_354px] gap-8">
            <div className="space-y-6">
              <div className="aspect-[16/10] bg-[#FCF8F5] rounded-[46px]" style={{ boxShadow: CLAY }} />
              <div className="h-5 w-36 bg-[#F5E4E4] rounded-full" />
              <div className="h-10 w-3/4 bg-[#FCF8F5] rounded-xl" />
            </div>
            <div className="h-[360px] bg-[#FCF8F5] rounded-[46px]" style={{ boxShadow: CLAY }} />
          </div>
        </div>
      </Layout>
    )
  }

  if (!event) return null

  const dateObj = new Date(event.date)
  const dateLong = format(dateObj, 'd MMMM, EEEE', { locale: uk })
  const reg = event.registrations[0]
  const isOrganizer = event.organizer.id === user?.id
  const isCompleted = event.status === 'COMPLETED'
  const isCancelled = event.status === 'CANCELLED'
  const spotsLeft = event.maxParticipants ? event.maxParticipants - event._count.registrations : null
  const isFull = spotsLeft !== null && spotsLeft <= 0
  const canRegister = !reg && !isCompleted && !isCancelled && !event.registrationClosed && !isFull && !isOrganizer
  const canUploadReceipt = reg && (reg.status === 'PAYMENT_SENT' || reg.status === 'RECEIPT_UPLOADED')
  const recordingExpired = event.recordingExpiresAt && new Date(event.recordingExpiresAt) < new Date()
  const formatLabel = event.zoomLink ? 'Онлайн · Zoom' : 'Офлайн'
  const timeLabel = event.startTime
    ? `${event.startTime}${event.endTime ? `–${event.endTime}` : ''} · Київ`
    : '—'
  const statusInfo = reg ? STATUS_INFO[reg.status] : null

  const OrgAvatar = ({ size = 'sm' }: { size?: 'sm' | 'lg' }) => {
    const sz = size === 'lg' ? 'w-16 h-16 text-[18px]' : 'w-10 h-10 text-[13px]'
    return (
      <div
        className={`${sz} rounded-full flex items-center justify-center shrink-0 overflow-hidden text-white font-extrabold`}
        style={{ background: 'linear-gradient(135deg,#E0A9B6,#C4778C)', boxShadow: CLAY_SM }}
      >
        {event.organizer.avatarUrl
          ? <img src={event.organizer.avatarUrl} alt="" className="w-full h-full object-cover" />
          : `${event.organizer.firstName[0]}${event.organizer.lastName[0]}`}
      </div>
    )
  }

  const IcChip = ({ children }: { children: React.ReactNode }) => (
    <span
      className="w-[42px] h-[42px] rounded-[13px] flex items-center justify-center shrink-0 bg-[#F5E4E4] text-[#B06B7E]"
      style={{ boxShadow: CLAY_SM }}
    >
      {children}
    </span>
  )

  const RegChip = ({ children }: { children: React.ReactNode }) => (
    <span
      className="w-[38px] h-[38px] rounded-[12px] flex items-center justify-center shrink-0 bg-[#F5E4E4] text-[#B06B7E]"
      style={{ boxShadow: CLAY_SM }}
    >
      {children}
    </span>
  )

  return (
    <Layout>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 bg-[#4A3F45] text-white px-5 py-3 rounded-2xl text-sm shadow-xl z-50 max-w-xs text-center">
          {toast}
        </div>
      )}

      <div className="max-w-[1120px] mx-auto px-4 pb-16">

        {/* Back */}
        <button
          onClick={handleBack}
          className="hidden md:inline-flex items-center gap-2 text-[14px] font-bold text-[#A99CA1] hover:text-[#7A6E73] transition mb-5"
        >
          <ChevronLeft size={15} />
          Усі події
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_354px] gap-8 items-start">

          {/* ══ MAIN ══ */}
          <div className="min-w-0 order-2 lg:order-1">

            {/* Banner */}
            <div
              className="relative overflow-hidden rounded-[46px] aspect-[16/10]"
              style={{
                boxShadow: CLAY,
                background: event.coverImageUrl ? undefined :
                  'radial-gradient(42% 46% at 40% 42%,rgba(236,176,182,.85),transparent 72%),radial-gradient(38% 42% at 68% 58%,rgba(216,154,172,.6),transparent 72%),radial-gradient(55% 55% at 55% 88%,rgba(247,215,197,.85),transparent 75%),linear-gradient(150deg,#FBEDED,#F3DCDF)',
              }}
            >
              {event.coverImageUrl && (
                <img src={event.coverImageUrl} alt={event.title} className="w-full h-full object-cover" />
              )}
              <div className="absolute left-5 top-5">
                {isCancelled ? (
                  <span className="inline-flex items-center gap-[7px] px-4 py-[9px] rounded-full bg-white/90 text-red-700 text-[12px] font-extrabold tracking-[.08em] uppercase" style={{ boxShadow: CLAY_SM }}>
                    Скасовано
                  </span>
                ) : isCompleted ? (
                  <span className="inline-flex items-center gap-[7px] px-4 py-[9px] rounded-full bg-white/90 text-purple-700 text-[12px] font-extrabold tracking-[.08em] uppercase" style={{ boxShadow: CLAY_SM }}>
                    Захід завершено
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-[7px] px-4 py-[9px] rounded-full bg-[rgba(252,248,245,.92)] text-[#8E4F62] text-[12px] font-extrabold tracking-[.08em] uppercase" style={{ boxShadow: CLAY_SM }}>
                    ✦ Подія
                  </span>
                )}
              </div>
            </div>

            {/* Category kicker */}
            <div className="inline-flex items-center gap-[7px] mt-6 text-[13px] font-bold text-[#A99CA1]">
              <span className="w-2 h-2 rounded-full bg-[#B06B7E]" />
              {isCancelled ? 'Скасовано' : isCompleted ? 'Захід завершено' : 'Подія · Обійми ЕФТ Space'}
            </div>

            {/* Title */}
            <h1
              className="font-cormorant font-semibold text-[#4A3F45] leading-[1.06] mt-[10px]"
              style={{ fontSize: 'clamp(30px,4vw,44px)' }}
            >
              {event.title}
            </h1>

            {/* About */}
            <section className="mt-9">
              <h2 className="font-cormorant text-[27px] font-semibold text-[#4A3F45] mb-4">Про захід</h2>

              {/* evd-key: 4-cell clay grid */}
              <div
                className="grid grid-cols-2 rounded-[36px] overflow-hidden mb-[22px]"
                style={{ background: '#FCF8F5', boxShadow: CLAY }}
              >
                <div className="flex items-center gap-[13px] p-[18px_22px] bg-[#FCF8F5]">
                  <IcChip><Calendar size={19} /></IcChip>
                  <div>
                    <div className="text-[11px] font-extrabold uppercase tracking-[.1em] text-[#A99CA1]">Коли</div>
                    <div className="text-[15px] font-bold text-[#4A3F45] mt-[3px] capitalize leading-snug">{dateLong}</div>
                  </div>
                </div>
                <div className="flex items-center gap-[13px] p-[18px_22px] bg-[#FCF8F5] border-l border-[rgba(120,90,95,.10)]">
                  <IcChip><Clock size={19} /></IcChip>
                  <div>
                    <div className="text-[11px] font-extrabold uppercase tracking-[.1em] text-[#A99CA1]">Час</div>
                    <div className="text-[15px] font-bold text-[#4A3F45] mt-[3px]">{timeLabel}</div>
                  </div>
                </div>
                <div className="flex items-center gap-[13px] p-[18px_22px] bg-[#FCF8F5] border-t border-[rgba(120,90,95,.10)]">
                  <IcChip><Video size={19} /></IcChip>
                  <div>
                    <div className="text-[11px] font-extrabold uppercase tracking-[.1em] text-[#A99CA1]">Формат</div>
                    <div className="text-[15px] font-bold text-[#4A3F45] mt-[3px]">{formatLabel}</div>
                  </div>
                </div>
                <div className="flex items-center gap-[13px] p-[18px_22px] bg-[#FCF8F5] border-t border-l border-[rgba(120,90,95,.10)]">
                  <OrgAvatar size="sm" />
                  <div>
                    <div className="text-[11px] font-extrabold uppercase tracking-[.1em] text-[#A99CA1]">Організатор</div>
                    <div className="text-[15px] font-bold text-[#4A3F45] mt-[3px] leading-snug">
                      {event.organizer.firstName} {event.organizer.lastName}
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-[16px] text-[#7A6E73] leading-[1.72] whitespace-pre-line">{event.description}</p>
            </section>

            {/* Benefits */}
            {Array.isArray(event.benefitsList) && event.benefitsList.length > 0 && (
              <section className="mt-9">
                <h2 className="font-cormorant text-[27px] font-semibold text-[#4A3F45] mb-4">Що отримаєте</h2>
                <div>
                  {event.benefitsList.map((b, i) => (
                    <div key={i} className={`flex gap-[14px] items-start py-[14px] ${i > 0 ? 'border-t border-[rgba(120,90,95,.10)]' : ''}`}>
                      <span
                        className="w-[30px] h-[30px] rounded-[10px] flex items-center justify-center shrink-0 mt-0.5 bg-[#DDE7DD] text-[#6E8A72]"
                        style={{ boxShadow: CLAY_SM }}
                      >
                        <CheckCircle size={15} />
                      </span>
                      <p className="text-[16px] text-[#4A3F45] leading-[1.5] mt-0.5">{b}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Presenter */}
            <section className="mt-9">
              <h2 className="font-cormorant text-[27px] font-semibold text-[#4A3F45] mb-4">Ведучий/а</h2>
              <div
                className="flex gap-[18px] items-center p-[22px_24px] rounded-[36px]"
                style={{ background: '#FCF8F5', boxShadow: CLAY }}
              >
                <OrgAvatar size="lg" />
                <div>
                  <div className="font-cormorant text-[21px] font-semibold text-[#4A3F45] leading-tight">
                    {event.organizer.firstName} {event.organizer.lastName}
                  </div>
                  <div className="text-[13.5px] text-[#A99CA1] mt-[2px]">Організатор заходу</div>
                </div>
              </div>
            </section>

            {/* Organizer controls */}
            {isOrganizer && (
              <div className="mt-9 rounded-[28px] p-6" style={{ background: '#FCF8F5', boxShadow: CLAY }}>
                <h2 className="font-cormorant text-[22px] font-semibold text-[#4A3F45] mb-1">Управління подією</h2>
                <p className="text-xs text-[#A99CA1] mb-4">Ви — організатор цього заходу</p>
                <button
                  onClick={() => { setNotifyError(''); setNotifySuccess(''); setShowNotifyModal(true) }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-[#F5E4E4] border border-[rgba(176,107,126,.2)] text-[#8E4F62] rounded-full text-sm font-bold hover:bg-[#B06B7E] hover:text-white transition"
                >
                  <Send size={15} />
                  Написати всім учасникам
                </button>
              </div>
            )}

          </div>

          {/* ══ STICKY SIDEBAR ══ */}
          <aside className="order-1 lg:order-2 lg:sticky lg:top-[92px]">
            <div className="rounded-[46px] p-7" style={{ background: '#FCF8F5', boxShadow: CLAY }}>

              {/* Price */}
              <div className="flex items-baseline gap-2">
                {event.price === 0
                  ? <span className="font-cormorant text-[36px] font-bold text-[#6E8A72] leading-none">Безкоштовно</span>
                  : <>
                      <span className="font-cormorant text-[44px] font-bold text-[#4A3F45] leading-none">{event.price}</span>
                      <span className="text-[16px] text-[#A99CA1] font-semibold">{event.currency}</span>
                    </>
                }
              </div>

              {/* Spots */}
              {spotsLeft !== null && spotsLeft > 0 && (
                <div className="inline-flex items-center gap-[7px] text-[13px] font-bold text-[#6E8A72] mt-[10px]">
                  <span className="w-[7px] h-[7px] rounded-full bg-[#6E8A72]" />
                  Залишилось {spotsLeft} місць
                </div>
              )}
              {isFull && (
                <div className="inline-flex items-center gap-[7px] text-[13px] font-bold text-orange-600 mt-[10px]">
                  <span className="w-[7px] h-[7px] rounded-full bg-orange-400" />
                  Місця вичерпані
                </div>
              )}

              {/* Divider */}
              <div className="h-px bg-[rgba(120,90,95,.10)] my-5" />

              {/* Meta rows */}
              <div className="grid gap-[14px]">
                <div className="flex items-center gap-[13px]">
                  <RegChip><Calendar size={17} /></RegChip>
                  <div>
                    <div className="text-[11px] font-extrabold uppercase tracking-[.08em] text-[#A99CA1]">Дата</div>
                    <div className="text-[14.5px] font-bold text-[#4A3F45] mt-[2px] capitalize">{dateLong}</div>
                  </div>
                </div>
                {event.startTime && (
                  <div className="flex items-center gap-[13px]">
                    <RegChip><Clock size={17} /></RegChip>
                    <div>
                      <div className="text-[11px] font-extrabold uppercase tracking-[.08em] text-[#A99CA1]">Час</div>
                      <div className="text-[14.5px] font-bold text-[#4A3F45] mt-[2px]">{timeLabel}</div>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-[13px]">
                  <RegChip><Video size={17} /></RegChip>
                  <div>
                    <div className="text-[11px] font-extrabold uppercase tracking-[.08em] text-[#A99CA1]">Формат</div>
                    <div className="text-[14.5px] font-bold text-[#4A3F45] mt-[2px]">{formatLabel}</div>
                  </div>
                </div>
              </div>

              {/* ── Registration area ── */}
              <div className="mt-[22px]">

                {/* Status badge */}
                {statusInfo && (
                  <div className={`rounded-[18px] px-4 py-3 flex items-start gap-3 mb-4 ${statusInfo.bg}`}>
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <div>
                      <p className="font-bold text-sm">{statusInfo.label}</p>
                      <p className="text-xs mt-0.5 opacity-80">{statusInfo.desc}</p>
                    </div>
                  </div>
                )}

                {/* Resources for CONFIRMED */}
                {reg?.status === 'CONFIRMED' && (
                  <div className="space-y-2 mb-4">
                    {event.zoomLink && (
                      <a href={event.zoomLink} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-[18px] hover:bg-emerald-100 transition">
                        <Video size={17} className="text-emerald-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-emerald-800">Приєднатися до Zoom</p>
                          {event.zoomPassword && <p className="text-xs text-emerald-600 mt-0.5">Пароль: {event.zoomPassword}</p>}
                        </div>
                        <ExternalLink size={13} className="text-emerald-400 shrink-0" />
                      </a>
                    )}
                    {event.presentationUrl && (
                      <a href={event.presentationUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-[18px] hover:bg-blue-100 transition">
                        <ExternalLink size={17} className="text-blue-600 shrink-0" />
                        <p className="text-sm font-bold text-blue-800 flex-1">Презентація</p>
                      </a>
                    )}
                    {event.recordingUrl && !recordingExpired && (
                      <a href={event.recordingUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-3 px-4 py-3 bg-purple-50 border border-purple-200 rounded-[18px] hover:bg-purple-100 transition">
                        <Video size={17} className="text-purple-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-purple-800">Переглянути запис</p>
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
                      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-[18px] text-gray-500">
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
                      <div className="bg-amber-50 border border-amber-200 rounded-[18px] px-4 py-3">
                        <p className="text-xs text-amber-800 font-bold mb-1.5">💳 Реквізити для оплати</p>
                        <p className="text-sm text-amber-900 whitespace-pre-line leading-relaxed">{event.paymentInstructions}</p>
                      </div>
                    )}
                    <h3 className="text-sm font-bold text-[#4A3F45]">Підтвердження оплати</h3>
                    {!pendingReceiptFile ? (
                      <div
                        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleFileDrop}
                        onClick={() => fileRef.current?.click()}
                        className={`border-2 border-dashed rounded-[18px] p-5 text-center cursor-pointer transition ${
                          dragOver ? 'border-[#B06B7E] bg-[#F5E4E4]' : 'border-[#DDD4D0] hover:border-[rgba(176,107,126,.5)] hover:bg-[#FCF8F5]'
                        }`}
                      >
                        <Upload size={22} className="text-[#B06B7E]/50 mx-auto mb-2" />
                        <p className="text-sm text-[#7A6E73] font-bold">Оберіть файл квитанції</p>
                        <p className="text-xs text-[#A99CA1] mt-1">PDF, JPG, PNG — перетягніть або натисніть</p>
                      </div>
                    ) : (
                      <div className="border border-[#E4CFC0] rounded-[18px] px-4 py-3 bg-[#FCF8F5] flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-[#4A3F45] truncate">{pendingReceiptFile.name}</p>
                          <p className="text-xs text-[#A99CA1] mt-0.5">{(pendingReceiptFile.size / 1024).toFixed(0)} КБ</p>
                        </div>
                        <button onClick={() => setPendingReceiptFile(null)} className="text-[#A99CA1] hover:text-[#B06B7E] transition shrink-0">
                          <X size={15} />
                        </button>
                      </div>
                    )}
                    <input
                      ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                      onChange={e => { if (e.target.files?.[0]) { setPendingReceiptFile(e.target.files[0]); e.target.value = '' } }}
                    />
                    {pendingReceiptFile && (
                      <button
                        onClick={handleUploadReceipt}
                        disabled={uploadingReceipt}
                        className="w-full flex items-center justify-center gap-2 text-white font-bold text-sm px-6 py-3 rounded-full hover:opacity-90 transition disabled:opacity-50"
                        style={{ background: 'linear-gradient(135deg,#C77E91,#A85E73)', boxShadow: BTN_SHADOW }}
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
                      onClick={() => { setConsents([false, false, false, false, false, false]); setShowConsentModal(true) }}
                      disabled={registering}
                      className="w-full text-white font-bold text-[15.5px] px-6 py-4 rounded-full hover:opacity-90 transition-all disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg,#C77E91,#A85E73)', boxShadow: BTN_SHADOW }}
                    >
                      {registering ? 'Реєстрація...' : 'Зареєструватися'}
                    </button>
                    {event.paymentInstructions && (
                      <p className="text-[12.5px] text-[#A99CA1] text-center mt-[14px] leading-[1.45]">
                        Реквізити для оплати з'являться одразу після реєстрації
                      </p>
                    )}
                  </>
                )}

                {/* Closed / full */}
                {!reg && !canRegister && !isCompleted && !isCancelled && (
                  <div className="text-center py-3 text-[#A99CA1] text-sm">
                    <Lock size={18} className="mx-auto mb-1.5 text-[#C8BAB5]" />
                    {isFull ? 'Всі місця зайняті' : 'Реєстрацію закрито'}
                  </div>
                )}
                {!reg && isCompleted && (
                  <div className="text-center py-3 text-[#A99CA1] text-sm">Захід завершився</div>
                )}
                {isCancelled && (
                  <div className="text-center py-3 text-red-500 text-sm font-bold">Захід скасовано</div>
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
          <div
            className="relative w-full sm:max-w-lg sm:rounded-[28px] rounded-t-[28px] shadow-2xl flex flex-col max-h-[92vh]"
            style={{ background: '#FCF8F5' }}
          >
            <div className="px-6 pt-6 pb-4 border-b border-[rgba(120,90,95,.10)] shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-cormorant text-xl font-semibold text-[#4A3F45] leading-snug">Написати учасникам</h2>
                  <p className="text-sm text-[#B06B7E] font-bold mt-0.5 truncate">{event.title}</p>
                </div>
                <button onClick={() => setShowNotifyModal(false)} className="text-[#A99CA1] hover:text-[#7A6E73] transition shrink-0 mt-0.5">
                  <X size={18} />
                </button>
              </div>
            </div>
            <form id="notify-form" onSubmit={handleNotifyParticipants} className="px-6 py-5 overflow-y-auto flex-1 space-y-4">
              {notifySuccess && <div className="bg-emerald-50 border border-emerald-200 rounded-[18px] px-4 py-3 text-sm text-emerald-800 font-bold">{notifySuccess}</div>}
              {notifyError && <div className="bg-red-50 border border-red-200 rounded-[18px] px-4 py-3 text-sm text-red-700">{notifyError}</div>}
              <div>
                <label className="block text-xs font-bold text-[#4A3F45] mb-1.5">Тема листа *</label>
                <input type="text" value={notifySubject} onChange={e => setNotifySubject(e.target.value)} required
                  placeholder="Наприклад: Важлива інформація щодо заходу"
                  className="w-full bg-white border border-[#EDE5DE] rounded-[18px] px-4 py-2.5 text-sm text-[#4A3F45] placeholder:text-[#A99CA1] focus:outline-none focus:border-[rgba(176,107,126,.6)] transition" />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#4A3F45] mb-1.5">Повідомлення *</label>
                <textarea value={notifyMessage} onChange={e => setNotifyMessage(e.target.value)} required rows={5}
                  placeholder="Текст повідомлення для всіх учасників..."
                  className="w-full bg-white border border-[#EDE5DE] rounded-[18px] px-4 py-2.5 text-sm text-[#4A3F45] placeholder:text-[#A99CA1] focus:outline-none focus:border-[rgba(176,107,126,.6)] transition resize-none" />
              </div>
              <div className="space-y-3">
                <p className="text-xs font-bold text-[#4A3F45] flex items-center gap-1.5">
                  <LinkIcon size={12} className="text-[#A99CA1]" />Посилання (необов'язково)
                </p>
                <div>
                  <label className="block text-xs text-[#A99CA1] mb-1">URL посилання</label>
                  <input type="url" value={notifyLinkUrl} onChange={e => setNotifyLinkUrl(e.target.value)} placeholder="https://..."
                    className="w-full bg-white border border-[#EDE5DE] rounded-[18px] px-4 py-2.5 text-sm text-[#4A3F45] placeholder:text-[#A99CA1] focus:outline-none focus:border-[rgba(176,107,126,.6)] transition" />
                </div>
                <div>
                  <label className="block text-xs text-[#A99CA1] mb-1">Текст кнопки</label>
                  <input type="text" value={notifyLinkText} onChange={e => setNotifyLinkText(e.target.value)} placeholder="Наприклад: Відкрити Zoom"
                    className="w-full bg-white border border-[#EDE5DE] rounded-[18px] px-4 py-2.5 text-sm text-[#4A3F45] placeholder:text-[#A99CA1] focus:outline-none focus:border-[rgba(176,107,126,.6)] transition" />
                </div>
              </div>
            </form>
            <div className="px-6 py-4 border-t border-[rgba(120,90,95,.10)] shrink-0">
              <button type="submit" form="notify-form" disabled={sending || !notifySubject.trim() || !notifyMessage.trim()}
                className="w-full flex items-center justify-center gap-2 text-white font-bold text-sm px-6 py-3 rounded-full hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg,#C77E91,#A85E73)' }}>
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
          <div
            className="relative w-full sm:max-w-lg sm:rounded-[28px] rounded-t-[28px] shadow-2xl flex flex-col max-h-[92vh]"
            style={{ background: '#FCF8F5' }}
          >
            <div className="px-6 pt-6 pb-4 border-b border-[rgba(120,90,95,.10)] shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-cormorant text-[22px] font-semibold text-[#4A3F45] leading-snug">
                    Підтвердження участі
                  </h2>
                  <p className="text-[12.5px] text-[#B06B7E] font-bold mt-0.5 leading-snug">
                    Простір довіри, конфіденційності та професійної етики
                  </p>
                </div>
                <button onClick={() => setShowConsentModal(false)} className="text-[#A99CA1] hover:text-[#7A6E73] transition shrink-0 mt-0.5">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="px-6 py-5 overflow-y-auto flex-1 space-y-5">
              <div className="space-y-3">
                <p className="text-[14px] text-[#7A6E73] leading-relaxed">
                  Беручи участь у цій події, я долучаюся до професійного простору ЕФТ-спільноти, побудованого на повазі, безпеці та відповідальному ставленні до досвіду інших людей.
                </p>
                <p className="text-[14px] text-[#7A6E73] leading-relaxed">
                  Під час заходу можуть обговорюватися клінічні випадки, професійний досвід, навчальні матеріали та інша чутлива інформація. Для збереження довіри між учасниками важливо дотримуватися спільних етичних принципів.
                </p>
              </div>

              <div>
                <p className="text-[13px] font-bold text-[#4A3F45] mb-3">Я підтверджую, що:</p>
                <div className="space-y-3">
                  {[
                    'Зберігатиму конфіденційність інформації, яку почую або побачу під час події.',
                    'Не записуватиму, не фотографуватиму та не поширюватиму матеріали, обговорення чи особисту інформацію учасників без їхньої явної згоди.',
                    'Поважатиму різноманітність професійного досвіду, поглядів та підходів колег.',
                    'Підтримуватиму атмосферу безпеки, доброзичливості та професійної взаємоповаги.',
                    'Використовуватиму отримані матеріали виключно для власного навчання, супервізійної та професійної практики.',
                    'Якщо під час події будуть представлені клінічні матеріали, ставитимусь до них з максимальною етичною відповідальністю та не використовуватиму їх поза межами навчального контексту.',
                  ].map((text, i) => (
                    <label key={i} onClick={() => setConsents(prev => prev.map((v, idx) => idx === i ? !v : v))} className="flex items-start gap-3 cursor-pointer group">
                      <div className={`mt-0.5 w-5 h-5 shrink-0 rounded border-2 flex items-center justify-center transition-all ${
                        consents[i] ? 'bg-[#B06B7E] border-[#B06B7E]' : 'border-[#E4CFC0] group-hover:border-[rgba(176,107,126,.5)]'
                      }`}>
                        {consents[i] && (
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <span className="text-[13.5px] text-[#7A6E73] leading-relaxed select-none group-hover:text-[#4A3F45] transition-colors">
                        {text}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="bg-[#F6ECE8] border border-[rgba(176,107,126,.12)] rounded-[18px] px-4 py-3.5">
                <p className="text-[13px] text-[#7A6E73] leading-relaxed">
                  ♡ Ми цінуємо простір, у якому терапевти можуть навчатися, розвиватися та звертатися по підтримку, знаючи, що їхній досвід буде зустрінутий з повагою та турботою.
                </p>
              </div>
            </div>

            <div className="px-6 pt-4 pb-5 border-t border-[rgba(120,90,95,.10)] shrink-0 space-y-3">
              <div className="bg-[#FFF4EC] border border-[rgba(176,107,126,.15)] rounded-[18px] px-4 py-3">
                <p className="text-[11.5px] text-[#7A6E73] leading-relaxed">
                  <span className="font-bold text-[#B06B7E]">Важливо:</span> якщо під час події демонструються записи сесій або клінічні матеріали, їх перегляд дозволений лише в межах цієї події та не передбачає жодного копіювання, збереження чи подальшого поширення.
                </p>
              </div>
              <button
                onClick={async () => { setShowConsentModal(false); await handleRegister() }}
                disabled={!consents.every(Boolean) || registering}
                className="w-full text-white font-bold text-[15px] px-6 py-3.5 rounded-full hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg,#C77E91,#A85E73)', boxShadow: BTN_SHADOW }}
              >
                {registering ? 'Реєстрація...' : 'Підтверджую та приєднатися'}
              </button>
              {!consents.every(Boolean) && (
                <p className="text-center text-xs text-[#A99CA1]">Позначте всі пункти, щоб продовжити</p>
              )}
            </div>
          </div>
        </div>
      )}

    </Layout>
  )
}
