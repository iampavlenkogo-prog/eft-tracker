import { useState, useEffect, useRef } from 'react'
import { Calendar, Clock, User, X, Upload, CheckCircle, ExternalLink } from 'lucide-react'
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

const inputClass = 'w-full border border-sand rounded-xl px-4 py-2.5 text-warm-dark text-sm focus:outline-none focus:border-rose focus:ring-1 focus:ring-rose-light transition bg-white'
const labelClass = 'block text-sm font-medium text-warm-mid mb-1.5'

export default function SlotsPage() {
  const [slots, setSlots] = useState<Slot[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [success, setSuccess] = useState(false)

  // Booking form state
  const [caseTitle, setCaseTitle] = useState('')
  const [description, setDescription] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [comment, setComment] = useState('')
  const [protocolFile, setProtocolFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.get('/slots/available')
      .then(res => setSlots(res.data))
      .finally(() => setIsLoading(false))
  }, [])

  const resetForm = () => {
    setCaseTitle('')
    setDescription('')
    setVideoUrl('')
    setComment('')
    setProtocolFile(null)
    setFormError('')
    setIsDragging(false)
  }

  const openModal = (slot: Slot) => {
    resetForm()
    setSelectedSlot(slot)
  }

  const closeModal = () => {
    setSelectedSlot(null)
    resetForm()
  }

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) setProtocolFile(file)
  }

  const handleSubmit = async () => {
    if (!selectedSlot) return
    if (!caseTitle.trim()) { setFormError('Введіть назву випадку'); return }
    if (!description.trim()) { setFormError('Введіть опис випадку'); return }

    setSubmitting(true)
    setFormError('')
    try {
      const formData = new FormData()
      formData.append('slotId', selectedSlot.id)
      formData.append('caseTitle', caseTitle.trim())
      formData.append('description', description.trim())
      if (videoUrl.trim()) formData.append('videoUrl', videoUrl.trim())
      if (comment.trim()) formData.append('comment', comment.trim())
      if (protocolFile) formData.append('protocolFile', protocolFile)

      await api.post('/bookings', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      setSlots(prev => prev.filter(s => s.id !== selectedSlot.id))
      setSelectedSlot(null)
      resetForm()
      setSuccess(true)
      setTimeout(() => setSuccess(false), 5000)
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Помилка відправки заявки')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="font-cormorant text-3xl text-warm-dark font-semibold">Слоти ♡</h1>
        <p className="font-cormorant italic text-warm-mid mt-0.5">Доступний час для супервізій</p>
      </div>

      {success && (
        <div className="flex items-center gap-2 bg-[#E8F5E9] rounded-2xl px-5 py-3 mb-5 max-w-lg text-[#4CAF50] text-sm font-medium">
          <CheckCircle size={16} />
          Заявку подано! Супервізор розгляне її найближчим часом.
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-7 h-7 border-4 border-sand border-t-rose rounded-full animate-spin" />
        </div>
      ) : slots.length === 0 ? (
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
                  onClick={() => openModal(slot)}
                  className="shrink-0 bg-rose hover:bg-[#B5745A] text-white font-medium rounded-xl px-5 py-2 text-sm transition"
                >
                  Забронювати
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 max-w-lg bg-beige rounded-2xl p-5">
        <p className="font-cormorant text-lg font-semibold text-warm-dark mb-2">Як це працює ♡</p>
        <p className="text-xs text-warm-mid leading-relaxed">
          Оберіть зручний слот і натисніть «Забронювати». Заповніть форму з описом випадку.
          Супервізор отримає заявку і підтвердить або відхилить її. Після підтвердження ви отримаєте посилання на зустріч.
        </p>
      </div>

      {/* Booking Modal */}
      {selectedSlot && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-5">
                <div>
                  <h2 className="font-cormorant text-2xl text-warm-dark font-semibold">Заявка на супервізію</h2>
                  <p className="text-sm text-warm-mid mt-0.5">
                    {selectedSlot.date} о {selectedSlot.time} · {selectedSlot.supervisor.firstName} {selectedSlot.supervisor.lastName}
                  </p>
                </div>
                <button onClick={closeModal} className="text-warm-light hover:text-warm-mid transition">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                {/* Case title */}
                <div>
                  <label className={labelClass}>Назва випадку *</label>
                  <input
                    className={inputClass}
                    placeholder="Коротка назва або тема"
                    value={caseTitle}
                    onChange={e => setCaseTitle(e.target.value)}
                  />
                </div>

                {/* Description */}
                <div>
                  <label className={labelClass}>Опис випадку *</label>
                  <textarea
                    className={`${inputClass} resize-none`}
                    rows={4}
                    placeholder="Опишіть ситуацію клієнта, запит на супервізію..."
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                  />
                </div>

                {/* Protocol file */}
                <div>
                  <label className={labelClass}>Протокол (PDF або DOCX, необов'язково)</label>
                  <div
                    className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition ${
                      isDragging ? 'border-rose bg-rose-lighter' : 'border-sand hover:border-rose-light'
                    }`}
                    onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleFileDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload size={18} className="text-warm-light mx-auto mb-1.5" />
                    {protocolFile ? (
                      <p className="text-sm text-warm-dark font-medium">{protocolFile.name}</p>
                    ) : (
                      <p className="text-xs text-warm-light">Перетягніть файл або натисніть для вибору</p>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      className="hidden"
                      onChange={e => e.target.files?.[0] && setProtocolFile(e.target.files[0])}
                    />
                  </div>
                  {protocolFile && (
                    <button
                      onClick={() => setProtocolFile(null)}
                      className="text-xs text-warm-light hover:text-rose mt-1 transition"
                    >
                      Видалити файл
                    </button>
                  )}
                </div>

                {/* Video URL */}
                <div>
                  <label className={labelClass}>Посилання на відео сесії (необов'язково)</label>
                  <div className="relative">
                    <input
                      className={inputClass}
                      placeholder="https://..."
                      value={videoUrl}
                      onChange={e => setVideoUrl(e.target.value)}
                    />
                    <ExternalLink size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-warm-light pointer-events-none" />
                  </div>
                </div>

                {/* Comment */}
                <div>
                  <label className={labelClass}>Коментар (необов'язково)</label>
                  <textarea
                    className={`${inputClass} resize-none`}
                    rows={2}
                    placeholder="Додаткова інформація для супервізора..."
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                  />
                </div>

                {formError && (
                  <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-2">{formError}</p>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={closeModal}
                    className="flex-1 border border-sand text-warm-mid rounded-xl py-2.5 text-sm font-medium hover:bg-beige transition"
                  >
                    Скасувати
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex-1 bg-rose hover:bg-[#B5745A] disabled:opacity-60 text-white rounded-xl py-2.5 text-sm font-medium transition"
                  >
                    {submitting ? 'Надсилаємо...' : 'Подати заявку'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
