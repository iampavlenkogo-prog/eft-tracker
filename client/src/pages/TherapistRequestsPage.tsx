import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Search, Plus, X, ChevronRight, Users, MapPin, Globe, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
import Layout from '../components/Layout'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'

interface TherapistRequest {
  id: string
  title: string
  description: string
  workFormat: string | null
  country: string | null
  city: string | null
  language: string | null
  therapyFormats: string[]
  status: 'OPEN' | 'CLOSED'
  createdAt: string
  author: { id: string; firstName: string; lastName: string; avatarUrl: string | null }
  _count: { responses: number }
}

const THERAPY_FORMAT_LABELS: Record<string, string> = {
  INDIVIDUAL: 'Індивідуальна',
  COUPLE: 'Парна',
  FAMILY: 'Сімейна',
}

const WORK_FORMAT_LABELS: Record<string, string> = {
  ONLINE: 'Онлайн',
  OFFLINE: 'Офлайн',
  BOTH: 'Онлайн / Офлайн',
}

const inputClass = 'w-full bg-[#F1F7F7] border border-[#D5E6E5] rounded-xl px-4 py-2.5 text-sm text-warm-dark placeholder:text-[#8AABAB] focus:outline-none focus:border-[#4D8A85]/60 transition neu-input'
const labelClass = 'block text-xs font-medium text-warm-light uppercase tracking-widest mb-1.5'

export default function TherapistRequestsPage() {
  const { user } = useAuth()
  const [requests, setRequests] = useState<TherapistRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    title: '',
    description: '',
    workFormat: '',
    country: '',
    city: '',
    language: '',
    therapyFormats: [] as string[],
  })

  useEffect(() => {
    api.get('/therapist-requests')
      .then(res => setRequests(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const toggleFormat = (fmt: string) => {
    setForm(prev => ({
      ...prev,
      therapyFormats: prev.therapyFormats.includes(fmt)
        ? prev.therapyFormats.filter(f => f !== fmt)
        : [...prev.therapyFormats, fmt],
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !form.description.trim()) return
    setSaving(true); setError('')
    try {
      const res = await api.post('/therapist-requests', {
        ...form,
        workFormat: form.workFormat || null,
        country: form.country || null,
        city: form.city || null,
        language: form.language || null,
      })
      setRequests(prev => [res.data, ...prev])
      setShowModal(false)
      resetForm()
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Помилка збереження')
    } finally { setSaving(false) }
  }

  const resetForm = () => setForm({ title: '', description: '', workFormat: '', country: '', city: '', language: '', therapyFormats: [] })

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-cormorant text-3xl font-semibold text-warm-dark">Пошук терапевта ♡</h1>
            <p className="font-cormorant italic text-warm-mid mt-0.5">Запити до спільноти та рекомендації від колег</p>
          </div>
          <button
            onClick={() => { resetForm(); setError(''); setShowModal(true) }}
            className="shrink-0 flex items-center gap-2 bg-gradient-to-br from-[#6BC1B6] to-[#5AAEAA] text-white font-medium rounded-xl px-4 py-2.5 text-sm neu-btn-primary hover:opacity-90 transition"
          >
            <Plus size={15} />
            Створити запит
          </button>
        </div>

        {/* Info banner */}
        <div className="bg-rose-lighter border border-rose-light rounded-2xl px-5 py-4 mb-6 flex items-center gap-4">
          <div className="flex-1">
            <p className="font-cormorant font-semibold text-warm-dark text-lg leading-snug mb-1">
              Потрібна рекомендація колеги для клієнта?
            </p>
            <p className="font-cormorant italic text-warm-mid text-base leading-relaxed">
              Опишіть запит, і терапевти нашої спільноти зможуть відгукнутися та запропонувати свою допомогу.
            </p>
          </div>
          <img
            src="/illustrations/search_therapist.png"
            alt=""
            className="w-20 h-20 object-contain shrink-0 drop-shadow-sm"
          />
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-sand animate-pulse">
                <div className="h-5 bg-beige rounded w-2/3 mb-3" />
                <div className="h-3 bg-beige rounded w-full mb-2" />
                <div className="h-3 bg-beige rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-white rounded-2xl border border-sand px-6 py-16 text-center">
            <Search size={36} className="text-sand mx-auto mb-3" />
            <p className="font-cormorant text-xl text-warm-mid font-semibold mb-1">Поки що немає активних запитів</p>
            <p className="text-sm text-warm-light mb-5">Станьте першим — створіть запит до спільноти</p>
            <button
              onClick={() => { resetForm(); setError(''); setShowModal(true) }}
              className="inline-flex items-center gap-2 bg-gradient-to-br from-[#6BC1B6] to-[#5AAEAA] text-white font-medium rounded-xl px-5 py-2.5 text-sm neu-btn-primary hover:opacity-90 transition"
            >
              <Plus size={14} /> Створити запит
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map(req => (
              <Link
                key={req.id}
                to={`/therapist-requests/${req.id}`}
                className="group block bg-white rounded-2xl border border-sand/60 hover:border-rose/30 hover:shadow-md transition-all duration-200 p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 mb-1.5">
                      <h3 className="font-cormorant text-lg font-semibold text-warm-dark leading-tight group-hover:text-rose transition-colors flex-1">
                        {req.title}
                      </h3>
                      <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full mt-0.5 ${req.status === 'OPEN' ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                        {req.status === 'OPEN' ? 'Відкрито' : 'Закрито'}
                      </span>
                    </div>
                    <p className="text-sm text-warm-mid line-clamp-2 leading-relaxed mb-3">
                      {req.description}
                    </p>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {req.workFormat && (
                        <span className="inline-flex items-center gap-1 text-[11px] bg-beige text-warm-mid rounded-full px-2.5 py-0.5">
                          <Globe size={10} />{WORK_FORMAT_LABELS[req.workFormat] ?? req.workFormat}
                        </span>
                      )}
                      {(req.city || req.country) && (
                        <span className="inline-flex items-center gap-1 text-[11px] bg-beige text-warm-mid rounded-full px-2.5 py-0.5">
                          <MapPin size={10} />{[req.city, req.country].filter(Boolean).join(', ')}
                        </span>
                      )}
                      {req.therapyFormats.map(f => (
                        <span key={f} className="text-[11px] bg-rose-lighter text-rose rounded-full px-2.5 py-0.5">
                          {THERAPY_FORMAT_LABELS[f] ?? f}
                        </span>
                      ))}
                      {req.language && (
                        <span className="text-[11px] bg-beige text-warm-mid rounded-full px-2.5 py-0.5">
                          {req.language}
                        </span>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center gap-3 text-xs text-warm-light">
                      <span className="flex items-center gap-1">
                        <Clock size={11} />
                        {format(new Date(req.createdAt), 'd MMM yyyy', { locale: uk })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users size={11} />
                        {req._count.responses} {req._count.responses === 1 ? 'відгук' : req._count.responses < 5 ? 'відгуки' : 'відгуків'}
                      </span>
                      <span className="ml-auto text-[10px] font-medium text-warm-light/60 uppercase tracking-wide">
                        {req.author.firstName} {req.author.lastName}
                        {req.author.id === user?.id && ' (ви)'}
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-warm-light group-hover:text-rose group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── Create Request Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-7 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-cormorant text-2xl font-semibold text-warm-dark">Новий запит ♡</h3>
                <p className="font-cormorant italic text-warm-mid text-sm">Зверніться до спільноти за рекомендацією</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-warm-light hover:text-warm-mid transition"><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={labelClass}>Заголовок запиту *</label>
                <input
                  type="text" required
                  value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="Напр: Шукаю EFT-терапевта для роботи з підлітком"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Опис запиту *</label>
                <textarea
                  required rows={5}
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Опишіть ситуацію, запит, побажання та особливості. Тут немає жодних шаблонів — пишіть вільно."
                  className={inputClass + ' resize-none'}
                />
              </div>

              <div>
                <label className={labelClass}>Формат роботи</label>
                <div className="flex gap-2">
                  {Object.entries(WORK_FORMAT_LABELS).map(([val, lbl]) => (
                    <button
                      key={val} type="button"
                      onClick={() => setForm(p => ({ ...p, workFormat: p.workFormat === val ? '' : val }))}
                      className={`flex-1 py-2 rounded-xl text-sm font-medium border transition ${form.workFormat === val ? 'bg-gradient-to-br from-[#6BC1B6] to-[#5AAEAA] text-white border-transparent shadow-[0_2px_8px_rgba(80,180,173,0.25)]' : 'bg-white text-warm-mid border-[#D5E6E5] hover:border-[#6BC1B6]/40 hover:bg-[#EBF5F3]'}`}
                    >{lbl}</button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Країна</label>
                  <input type="text" value={form.country} onChange={e => setForm(p => ({ ...p, country: e.target.value }))} placeholder="Україна" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Місто</label>
                  <input type="text" value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} placeholder="Київ" className={inputClass} />
                </div>
              </div>

              <div>
                <label className={labelClass}>Мова роботи</label>
                <input type="text" value={form.language} onChange={e => setForm(p => ({ ...p, language: e.target.value }))} placeholder="Українська" className={inputClass} />
              </div>

              <div>
                <label className={labelClass}>Формат терапії</label>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(THERAPY_FORMAT_LABELS).map(([val, lbl]) => (
                    <button
                      key={val} type="button"
                      onClick={() => toggleFormat(val)}
                      className={`px-3.5 py-1.5 rounded-xl text-sm font-medium border transition ${form.therapyFormats.includes(val) ? 'bg-gradient-to-br from-[#6BC1B6] to-[#5AAEAA] text-white border-transparent shadow-[0_2px_8px_rgba(80,180,173,0.25)]' : 'bg-white text-warm-mid border-[#D5E6E5] hover:border-[#6BC1B6]/40 hover:bg-[#EBF5F3]'}`}
                    >{lbl}</button>
                  ))}
                </div>
              </div>

              {error && <p className="text-red-500 text-sm bg-red-50 rounded-xl px-4 py-2.5">{error}</p>}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 border border-[#D5E6E5] bg-white text-warm-mid rounded-xl py-2.5 text-sm font-medium hover:bg-[#EBF5F3] hover:border-[#6BC1B6]/30 transition neu-btn">
                  Скасувати
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-gradient-to-br from-[#6BC1B6] to-[#5AAEAA] text-white font-medium rounded-xl py-2.5 text-sm neu-btn-primary hover:opacity-90 transition disabled:opacity-50">
                  {saving ? 'Публікуємо...' : 'Опублікувати запит'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}
