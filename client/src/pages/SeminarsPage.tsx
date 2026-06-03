import { useState, useEffect, useRef } from 'react'
import { X, Plus, BookOpen, ExternalLink, Upload, Clock, Award, Search, ChevronDown, FileText } from 'lucide-react'
import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
import Layout from '../components/Layout'
import ReportModal from '../components/ReportModal'
import api from '../api/axios'

type RecordStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

interface Seminar {
  id: string; title: string; date: string; hours: number
  points: number; certificateUrl: string | null; status: RecordStatus
}

const STATUS_STYLES: Record<RecordStatus, { label: string; cls: string }> = {
  PENDING: { label: 'Очікує', cls: 'bg-[#FFF3E0] text-[#E6930A]' },
  APPROVED: { label: 'Підтверджено', cls: 'bg-[#E8F5E9] text-[#4CAF50]' },
  REJECTED: { label: 'Відхилено', cls: 'bg-[#FFEBEE] text-[#E53935]' },
}

const emptyForm = { title: '', date: '', hours: '', points: '' }

export default function SeminarsPage() {
  const [seminars, setSeminars] = useState<Seminar[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.get('/seminars').then(res => setSeminars(res.data)).finally(() => setIsLoading(false))
  }, [])

  const closeModal = () => {
    setIsModalOpen(false)
    setError('')
    setForm(emptyForm)
    setFile(null)
    setDragOver(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const set = (field: string) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }))

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) setFile(dropped)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('title', form.title)
      formData.append('date', form.date)
      formData.append('hours', form.hours)
      formData.append('points', form.points)
      if (file) formData.append('certificate', file)

      const res = await api.post('/seminars', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setSeminars(prev => [res.data, ...prev])
      closeModal()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Помилка')
    } finally {
      setIsSubmitting(false)
    }
  }

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<RecordStatus | 'all'>('all')

  const approved = seminars.filter(s => s.status === 'APPROVED')
  const totalHours = approved.reduce((sum, s) => sum + s.hours, 0)
  const totalCerts = approved.filter(s => s.certificateUrl).length

  const filtered = seminars.filter(s => {
    const statusOk = statusFilter === 'all' || s.status === statusFilter
    const searchOk = search === '' || s.title.toLowerCase().includes(search.toLowerCase())
    return statusOk && searchOk
  })

  const inputClass = 'w-full bg-[#FDFAF8] border border-[#DDD5CC] rounded-xl px-4 py-2.5 text-sm text-warm-dark placeholder:text-[#C5B5A8] focus:outline-none focus:border-[#C4856A]/60 transition'
  const labelClass = 'block text-sm font-medium text-warm-mid mb-1.5'

  return (
    <Layout>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="font-cormorant text-3xl text-warm-dark font-semibold">Семінари ♡</h1>
              <p className="font-cormorant italic text-warm-mid mt-0.5">Ваші навчальні заходи</p>
            </div>
            <button
              onClick={() => setShowReport(true)}
              className="flex items-center gap-2 border border-[#DDD5CC] bg-white text-warm-mid rounded-xl px-4 py-2.5 text-sm hover:bg-[#F5EFE9] hover:border-[#C08898]/30 transition shrink-0 mt-1"
            >
              <FileText size={14} />
              Звіт
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-warm-light" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Пошук..."
                className="w-full bg-[#FDFAF8] border border-[#DDD5CC] rounded-xl pl-9 pr-4 py-2.5 text-sm text-warm-dark placeholder:text-[#C5B5A8] focus:outline-none focus:border-[#C4856A]/60 transition"
              />
            </div>
            <div className="relative">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as RecordStatus | 'all')}
                className="appearance-none bg-[#FDFAF8] border border-[#DDD5CC] rounded-xl px-4 py-2.5 pr-8 text-sm text-warm-dark focus:outline-none focus:border-[#C4856A]/60 transition"
              >
                <option value="all">Статус: Усі</option>
                <option value="PENDING">Очікує</option>
                <option value="APPROVED">Підтверджено</option>
                <option value="REJECTED">Відхилено</option>
              </select>
              <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-warm-light pointer-events-none" />
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 bg-gradient-to-br from-[#C08898] to-[#A8707E] text-white font-medium rounded-xl px-6 py-2.5 text-sm shadow-[0_2px_10px_rgba(196,133,106,0.25)] hover:opacity-90 transition"
            >
              <Plus size={15} />
              Додати
            </button>
          </div>

          {/* List */}
          {isLoading ? (
            <div className="flex justify-center py-16">
              <div className="w-7 h-7 border-4 border-sand border-t-rose rounded-full animate-spin" />
            </div>
          ) : seminars.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-14 h-14 bg-beige rounded-2xl flex items-center justify-center mx-auto mb-4">
                <BookOpen size={24} className="text-warm-light" />
              </div>
              <p className="text-warm-mid font-medium">Ще немає семінарів</p>
              <p className="text-warm-light text-sm mt-1">Додайте перший запис після навчання</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-14 h-14 bg-beige rounded-2xl flex items-center justify-center mx-auto mb-4">
                <BookOpen size={24} className="text-warm-light" />
              </div>
              <p className="text-warm-mid font-medium">Нічого не знайдено</p>
              <p className="text-warm-light text-sm mt-1">Спробуйте змінити параметри пошуку</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(s => {
                const st = STATUS_STYLES[s.status]
                return (
                  <div key={s.id} className="bg-white rounded-2xl shadow-sm p-5 flex items-center gap-4">
                    <div className="w-20 h-20 bg-beige rounded-xl flex items-center justify-center shrink-0 p-2">
                      <img src="/illustrations/books-coffee.png" alt="" className="w-full h-full object-contain" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <p className="text-sm font-medium text-warm-dark leading-snug">{s.title}</p>
                        <span className={`shrink-0 text-xs font-medium px-3 py-1 rounded-full ${st.cls}`}>
                          {st.label}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="text-xs text-warm-light">
                          🕐 {s.hours} год.
                        </span>
                        <span className="text-xs text-warm-light">
                          ⭐ {s.points} балів
                        </span>
                        <span className="text-xs text-warm-light">
                          {format(new Date(s.date), 'd MMM yyyy', { locale: uk })}
                        </span>
                        {s.certificateUrl && (
                          <button
                            onClick={async () => {
                              const win = window.open('', '_blank')
                              try {
                                const res = await api.get(`/seminars/${s.id}/certificate`, { responseType: 'blob' })
                                if (String(res.headers['content-type'] ?? '').includes('application/pdf')) {
                                  const blobUrl = URL.createObjectURL(res.data)
                                  if (win) win.location.href = blobUrl
                                } else {
                                  const json = JSON.parse(await res.data.text())
                                  if (win) win.location.href = json.url
                                }
                              } catch { if (win) win.close() }
                            }}
                            className="flex items-center gap-1 text-xs text-rose hover:opacity-80 transition"
                          >
                            <FileText size={11} />
                            Сертифікат
                            <ExternalLink size={10} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Right sidebar ── */}
        <div className="space-y-4">
          <div className="bg-beige rounded-2xl p-6">
            <p className="text-xs text-warm-light uppercase tracking-widest mb-4 font-medium">Статистика навчання</p>
            <div className="space-y-3">
              {[
                { icon: BookOpen, label: 'Пройдено семінарів', value: approved.length },
                { icon: Clock, label: 'Годин навчання', value: totalHours },
                { icon: Award, label: 'Сертифікатів', value: totalCerts },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-3 py-2 border-b border-sand/50 last:border-0">
                  <item.icon size={16} strokeWidth={1.75} className="text-warm-light shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-warm-light leading-tight">{item.label}</p>
                  </div>
                  <span className="font-cormorant text-2xl text-warm-dark">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <img src="/illustrations/books-coffee.png" alt="" className="w-full -mt-24 -mb-24" />
            <div className="px-6 pb-6 pt-2">
              <h3 className="font-cormorant text-xl font-semibold text-warm-dark mb-3">Навчання ♡</h3>
              <p className="font-cormorant italic text-warm-mid text-sm leading-relaxed">
                Кожен семінар — це нові інструменти для вашої практики та глибший зв'язок із собою та клієнтами.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Add modal ── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-cormorant text-2xl font-semibold text-warm-dark">Додати семінар ♡</h3>
                <p className="font-cormorant italic text-warm-mid text-sm">Заповніть інформацію про навчальний захід</p>
              </div>
              <button onClick={closeModal} className="text-warm-light hover:text-warm-mid transition">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={labelClass}>Назва семінару *</label>
                <input type="text" value={form.title} onChange={set('title')} required placeholder="Введіть назву..." className={inputClass} />
              </div>

              <div>
                <label className={labelClass}>Дата *</label>
                <input type="date" value={form.date} onChange={set('date')} required className={inputClass} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Годин *</label>
                  <input type="number" value={form.hours} onChange={set('hours')} required min="0.5" step="0.5" placeholder="8" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Балів *</label>
                  <input type="number" value={form.points} onChange={set('points')} required min="0" step="0.5" placeholder="3" className={inputClass} />
                </div>
              </div>

              {/* Upload zone */}
              <div>
                <label className={labelClass}>Сертифікат</label>
                <div
                  onClick={() => fileRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
                    dragOver ? 'border-rose bg-rose-lighter' : 'border-sand hover:border-rose-light'
                  }`}
                >
                  <Upload size={24} className="mx-auto text-warm-light mb-2" />
                  {file ? (
                    <p className="text-sm text-warm-dark font-medium">{file.name}</p>
                  ) : (
                    <>
                      <p className="text-sm text-warm-mid font-medium">Завантажте файл сертифікату</p>
                      <p className="text-xs text-warm-light mt-1">PDF, JPG або PNG, до 10 МБ</p>
                    </>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={e => setFile(e.target.files?.[0] ?? null)}
                  className="hidden"
                />
              </div>

              {error && <p className="text-red-500 text-sm bg-red-50 rounded-xl px-4 py-2.5">{error}</p>}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={closeModal} className="flex-1 border border-[#DDD5CC] bg-white text-warm-mid rounded-xl px-4 py-2.5 text-sm hover:bg-[#F5EFE9] hover:border-[#C08898]/30 transition">
                  Скасувати
                </button>
                <button type="submit" disabled={isSubmitting} className="flex-1 bg-gradient-to-br from-[#C08898] to-[#A8707E] text-white font-medium rounded-xl px-6 py-2.5 text-sm shadow-[0_2px_10px_rgba(196,133,106,0.25)] hover:opacity-90 transition disabled:opacity-50">
                  {isSubmitting ? 'Додаємо...' : 'Додати'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showReport && (
        <ReportModal defaultSections="seminars" onClose={() => setShowReport(false)} />
      )}
    </Layout>
  )
}
