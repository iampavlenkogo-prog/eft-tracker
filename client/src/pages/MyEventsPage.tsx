import { useState, useEffect, useRef } from 'react'
import { Calendar, CheckCircle, Clock, ExternalLink, Upload, Video } from 'lucide-react'
import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
import Layout from '../components/Layout'
import api from '../api/axios'

interface EventDetails {
  id: string
  title: string
  description: string
  date: string
  price: number
  zoomLink: string | null
  presentationUrl: string | null
  status: string
  organizer: { firstName: string; lastName: string }
}

interface MyRegistration {
  id: string
  eventId: string
  status: string
  paymentReceiptUrl: string | null
  createdAt: string
  event: EventDetails
}

const REG_STATUS: Record<string, { label: string; cls: string; desc: string }> = {
  PENDING:          { label: 'Очікує',               cls: 'bg-[#FFF3E0] text-[#E6930A]',  desc: 'Ваша заявка отримана. Очікуйте на реквізити для оплати.' },
  PAYMENT_SENT:     { label: 'Реквізити надіслано',  cls: 'bg-[#E3F2FD] text-[#1976D2]',  desc: 'Реквізити надіслано на вашу пошту. Завантажте квитанцію.' },
  RECEIPT_UPLOADED: { label: 'Квитанція надіслана',  cls: 'bg-[#F3E5F5] text-[#7B1FA2]',  desc: 'Ваша квитанція перевіряється організатором.' },
  CONFIRMED:        { label: 'Підтверджено',         cls: 'bg-[#E8F5E9] text-[#4CAF50]',  desc: 'Участь підтверджена! Деталі нижче.' },
  REJECTED:         { label: 'Відхилено',            cls: 'bg-[#FFEBEE] text-[#E53935]',  desc: 'На жаль, вашу реєстрацію було відхилено.' },
}

export default function MyEventsPage() {
  const [registrations, setRegistrations] = useState<MyRegistration[]>([])
  const [loading, setLoading] = useState(true)

  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string>('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [activeUpload, setActiveUpload] = useState<string | null>(null)

  useEffect(() => {
    api.get('/events/my-registrations')
      .then(res => setRegistrations(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleUploadReceipt = async (reg: MyRegistration) => {
    if (!receiptFile) return
    setUploadingId(reg.id)
    setUploadError('')
    try {
      const fd = new FormData()
      fd.append('receipt', receiptFile)
      const res = await api.post(
        `/events/${reg.eventId}/registrations/${reg.id}/upload-receipt`,
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      setRegistrations(prev => prev.map(r =>
        r.id === reg.id ? { ...r, status: res.data.status, paymentReceiptUrl: res.data.paymentReceiptUrl } : r
      ))
      setReceiptFile(null)
      setActiveUpload(null)
    } catch (err: any) {
      setUploadError(err.response?.data?.error || 'Помилка завантаження')
    } finally {
      setUploadingId(null)
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center py-24">
          <div className="w-7 h-7 border-4 border-sand border-t-rose rounded-full animate-spin" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="font-cormorant text-4xl text-warm-dark font-semibold leading-tight">Мої заходи ♡</h1>
        <p className="font-cormorant italic text-warm-mid text-lg mt-1">Ваші реєстрації на заходи спільноти</p>
      </div>

      {registrations.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-beige rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Calendar size={28} className="text-warm-light" />
          </div>
          <p className="text-warm-mid font-medium text-lg font-cormorant">Ви ще не зареєстровані на жодний захід</p>
          <p className="text-warm-light text-sm mt-1">Перегляньте анонси на головній сторінці</p>
        </div>
      ) : (
        <div className="space-y-5 max-w-2xl">
          {registrations.map(reg => {
            const st = REG_STATUS[reg.status] ?? REG_STATUS.PENDING
            const isActiveUpload = activeUpload === reg.id
            return (
              <div key={reg.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="p-6">
                  {/* Event header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <h2 className="font-cormorant text-xl font-semibold text-warm-dark leading-snug">{reg.event.title}</h2>
                    <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${st.cls}`}>{st.label}</span>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3">
                    <span className="flex items-center gap-1.5 text-xs text-warm-light">
                      <Calendar size={12} />
                      {format(new Date(reg.event.date), 'd MMMM yyyy', { locale: uk })}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-warm-light">
                      <Clock size={12} />
                      Зареєстровано: {format(new Date(reg.createdAt), 'd MMM yyyy', { locale: uk })}
                    </span>
                  </div>

                  <p className="text-xs text-warm-light italic mb-3">{st.desc}</p>

                  {/* PAYMENT_SENT: receipt upload */}
                  {reg.status === 'PAYMENT_SENT' && (
                    <div className="mt-4 border-t border-sand pt-4">
                      {!isActiveUpload ? (
                        <button
                          onClick={() => { setActiveUpload(reg.id); setReceiptFile(null); setUploadError('') }}
                          className="flex items-center gap-2 bg-gradient-to-br from-[#EB4600] to-[#CC3A00] text-white text-sm font-medium rounded-xl px-5 py-2.5 neu-btn-primary hover:opacity-90 transition"
                        >
                          <Upload size={15} />
                          Завантажити квитанцію
                        </button>
                      ) : (
                        <div className="space-y-3">
                          <div
                            onClick={() => fileRef.current?.click()}
                            onDrop={e => { e.preventDefault(); setDragId(null); const f = e.dataTransfer.files[0]; if (f) setReceiptFile(f) }}
                            onDragOver={e => { e.preventDefault(); setDragId(reg.id) }}
                            onDragLeave={() => setDragId(null)}
                            className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition ${
                              dragId === reg.id ? 'border-rose bg-rose-lighter' : 'border-sand hover:border-rose-light'
                            }`}
                          >
                            <Upload size={20} className="mx-auto text-warm-light mb-1" />
                            {receiptFile
                              ? <p className="text-sm text-warm-dark font-medium">{receiptFile.name}</p>
                              : <p className="text-sm text-warm-mid">Перетягніть файл або клацніть</p>
                            }
                            <p className="text-xs text-warm-light mt-0.5">PDF або зображення</p>
                          </div>
                          <input
                            ref={fileRef}
                            type="file"
                            accept="application/pdf,image/*"
                            onChange={e => setReceiptFile(e.target.files?.[0] ?? null)}
                            className="hidden"
                          />
                          {uploadError && (
                            <p className="text-red-500 text-sm bg-red-50 rounded-xl px-4 py-2">{uploadError}</p>
                          )}
                          <div className="flex gap-2">
                            <button
                              onClick={() => { setActiveUpload(null); setReceiptFile(null); setUploadError('') }}
                              className="flex-1 border border-[#EBDDD0] bg-white text-warm-mid rounded-xl py-2 text-sm font-medium hover:bg-[#FFF4EC] hover:border-[#EB4600]/30 transition neu-btn"
                            >
                              Скасувати
                            </button>
                            <button
                              disabled={!receiptFile || uploadingId === reg.id}
                              onClick={() => handleUploadReceipt(reg)}
                              className="flex-1 bg-gradient-to-br from-[#EB4600] to-[#CC3A00] text-white font-medium rounded-xl py-2 text-sm shadow-[0_2px_8px_rgba(235,70,0,0.2)] hover:opacity-90 transition disabled:opacity-50"
                            >
                              {uploadingId === reg.id ? 'Завантажуємо...' : 'Надіслати'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* CONFIRMED: show Zoom + presentation */}
                  {reg.status === 'CONFIRMED' && (
                    <div className="mt-4 border-t border-sand pt-4 space-y-2">
                      <div className="flex items-center gap-1.5 mb-2">
                        <CheckCircle size={14} className="text-[#4CAF50]" />
                        <span className="text-sm font-medium text-warm-dark">Деталі участі</span>
                      </div>
                      {reg.event.zoomLink && (
                        <a
                          href={reg.event.zoomLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 bg-[#E3F2FD] hover:bg-[#BBDEFB] text-[#1976D2] text-sm font-medium rounded-xl px-4 py-2.5 transition w-fit"
                        >
                          <Video size={15} />
                          Приєднатись до Zoom
                          <ExternalLink size={12} />
                        </a>
                      )}
                      {reg.event.presentationUrl && (
                        <a
                          href={reg.event.presentationUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 border border-sand text-warm-mid hover:bg-beige text-sm font-medium rounded-xl px-4 py-2.5 transition w-fit"
                        >
                          <ExternalLink size={13} />
                          Завантажити презентацію
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Layout>
  )
}
