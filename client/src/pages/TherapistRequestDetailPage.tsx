import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, X, Plus, Trash2, FileDown, Loader2, Users, MapPin, Globe, Clock, CheckSquare, Square } from 'lucide-react'
import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
import Layout from '../components/Layout'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'

interface Therapist {
  id: string
  firstName: string
  lastName: string
  avatarUrl: string | null
  telegram: string | null
  email: string
}

interface TherapistResponse {
  id: string
  therapistId: string
  therapist: Therapist
  presentation: string
  links: string | null
  isSelected: boolean
  createdAt: string
}

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
  closedAt: string | null
  createdAt: string
  author: Therapist
  responses: TherapistResponse[]
  isAuthor: boolean
  myResponseId: string | null
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

const inputClass = 'w-full bg-[#FFF9F5] border border-[#EDE5DE] rounded-xl px-4 py-2.5 text-sm text-warm-dark placeholder:text-[#9A8878] focus:outline-none focus:border-[#B8A8A4]/60 transition neu-input'
const labelClass = 'block text-xs font-medium text-warm-light uppercase tracking-widest mb-1.5'

export default function TherapistRequestDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [request, setRequest] = useState<TherapistRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [showRespondModal, setShowRespondModal] = useState(false)
  const [respondSaving, setRespondSaving] = useState(false)
  const [respondError, setRespondError] = useState('')
  const [pdfLoading, setPdfLoading] = useState(false)
  const [closingRequest, setClosingRequest] = useState(false)
  const [toast, setToast] = useState('')

  const [presentation, setPresentation] = useState('')
  const [links, setLinks] = useState<string[]>([''])

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 4000) }

  useEffect(() => {
    api.get(`/therapist-requests/${id}`)
      .then(res => setRequest(res.data))
      .catch(() => navigate('/therapist-requests'))
      .finally(() => setLoading(false))
  }, [id])

  const handleRespond = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!presentation.trim()) return
    setRespondSaving(true); setRespondError('')
    try {
      const validLinks = links.filter(l => l.trim())
      const res = await api.post(`/therapist-requests/${id}/respond`, {
        presentation: presentation.trim(),
        links: validLinks.length ? validLinks : undefined,
      })
      setRequest(prev => prev ? {
        ...prev,
        responses: [...prev.responses, res.data],
        myResponseId: res.data.id,
        _count: { responses: prev._count.responses + 1 },
      } : prev)
      setShowRespondModal(false)
      setPresentation(''); setLinks([''])
      showToast('Ваш відгук додано!')
    } catch (err: any) {
      setRespondError(err?.response?.data?.error || 'Помилка')
    } finally { setRespondSaving(false) }
  }

  const handleToggleSelect = async (responseId: string) => {
    try {
      const res = await api.patch(`/therapist-requests/${id}/responses/${responseId}/select`)
      setRequest(prev => prev ? {
        ...prev,
        responses: prev.responses.map(r => r.id === responseId ? { ...r, isSelected: res.data.isSelected } : r),
      } : prev)
    } catch { showToast('Помилка') }
  }

  const handleClose = async () => {
    if (!confirm('Закрити запит? Нові відгуки більше не приймаються.')) return
    setClosingRequest(true)
    try {
      await api.post(`/therapist-requests/${id}/close`)
      setRequest(prev => prev ? { ...prev, status: 'CLOSED', closedAt: new Date().toISOString() } : prev)
      showToast('Запит закрито')
    } catch { showToast('Помилка') } finally { setClosingRequest(false) }
  }

  const handlePdf = async () => {
    setPdfLoading(true)
    try {
      const res = await api.get(`/therapist-requests/${id}/pdf`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `EFT_Therapists_${new Date().toISOString().slice(0, 10)}.pdf`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err: any) {
      if (err.response?.data instanceof Blob) {
        const text = await err.response.data.text()
        try { showToast(JSON.parse(text).error || 'Помилка PDF') } catch { showToast('Помилка PDF') }
      } else { showToast('Помилка формування PDF') }
    } finally { setPdfLoading(false) }
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-rose" />
        </div>
      </Layout>
    )
  }

  if (!request) return null

  const selectedCount = request.responses.filter(r => r.isSelected).length
  const canRespond = !request.isAuthor && !request.myResponseId && request.status === 'OPEN'

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">

        {/* Back */}
        <button
          onClick={() => navigate('/therapist-requests')}
          className="flex items-center gap-1.5 text-warm-mid hover:text-warm-dark text-sm transition mb-5"
        >
          <ChevronLeft size={15} /> Назад до запитів
        </button>

        {/* Status badge */}
        {request.status === 'CLOSED' && (
          <div className="mb-4 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-500 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-gray-300 shrink-0" />
            Запит закрито {request.closedAt && `· ${format(new Date(request.closedAt), 'd MMM yyyy', { locale: uk })}`}. Нові відгуки не приймаються.
          </div>
        )}

        {/* Request card */}
        <div className="bg-white rounded-2xl border border-sand/60 p-6 mb-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <h1 className="font-cormorant text-2xl font-semibold text-warm-dark leading-tight flex-1">{request.title}</h1>
            <span className={`shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full ${request.status === 'OPEN' ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
              {request.status === 'OPEN' ? 'Відкрито' : 'Закрито'}
            </span>
          </div>

          <p className="text-sm text-warm-mid leading-relaxed mb-4 whitespace-pre-line">{request.description}</p>

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {request.workFormat && (
              <span className="inline-flex items-center gap-1 text-[11px] bg-beige text-warm-mid rounded-full px-2.5 py-0.5">
                <Globe size={10} />{WORK_FORMAT_LABELS[request.workFormat] ?? request.workFormat}
              </span>
            )}
            {(request.city || request.country) && (
              <span className="inline-flex items-center gap-1 text-[11px] bg-beige text-warm-mid rounded-full px-2.5 py-0.5">
                <MapPin size={10} />{[request.city, request.country].filter(Boolean).join(', ')}
              </span>
            )}
            {request.therapyFormats.map(f => (
              <span key={f} className="text-[11px] bg-rose-lighter text-rose rounded-full px-2.5 py-0.5">
                {THERAPY_FORMAT_LABELS[f] ?? f}
              </span>
            ))}
            {request.language && (
              <span className="text-[11px] bg-beige text-warm-mid rounded-full px-2.5 py-0.5">{request.language}</span>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-sand/50 pt-3">
            <div className="flex items-center gap-3 text-xs text-warm-light">
              <span className="flex items-center gap-1">
                <Clock size={11} />
                {format(new Date(request.createdAt), 'd MMMM yyyy', { locale: uk })}
              </span>
              <span className="flex items-center gap-1">
                <Users size={11} />
                {request._count.responses} {request._count.responses === 1 ? 'відгук' : request._count.responses < 5 ? 'відгуки' : 'відгуків'}
              </span>
            </div>
            <span className="text-xs text-warm-light">{request.author.firstName} {request.author.lastName}</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 mb-6">
          {canRespond && (
            <button
              onClick={() => { setPresentation(''); setLinks(['']); setRespondError(''); setShowRespondModal(true) }}
              className="flex items-center gap-2 bg-gradient-to-br from-[#C07888] to-[#A06070] text-white font-medium rounded-xl px-4 py-2.5 text-sm neu-btn-primary hover:opacity-90 transition"
            >
              <Plus size={14} /> Відгукнутися
            </button>
          )}
          {request.myResponseId && !request.isAuthor && (
            <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 rounded-xl px-4 py-2.5 font-medium">
              ✓ Ви відгукнулись на цей запит
            </div>
          )}
          {request.isAuthor && request.status === 'OPEN' && (
            <button
              onClick={handleClose} disabled={closingRequest}
              className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 hover:border-amber-300 font-medium rounded-xl px-4 py-2.5 text-sm transition"
            >
              {closingRequest ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
              Закрити запит
            </button>
          )}
          {request.isAuthor && selectedCount > 0 && (
            <button
              onClick={handlePdf} disabled={pdfLoading}
              className="flex items-center gap-2 bg-[#6B7FD7] hover:bg-[#5A6EC6] text-white font-medium rounded-xl px-4 py-2.5 text-sm transition shadow-sm ml-auto"
            >
              {pdfLoading ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
              Сформувати PDF ({selectedCount})
            </button>
          )}
        </div>

        {/* Responses — visible only to author */}
        {request.isAuthor && (
          <div>
            <h2 className="font-cormorant text-xl font-semibold text-warm-dark mb-3">
              Відгуки на запит
              {request.responses.length > 0 && <span className="text-warm-light text-base font-normal ml-2">({request.responses.length})</span>}
            </h2>

            {request.responses.length === 0 ? (
              <div className="bg-white rounded-2xl border border-sand px-6 py-10 text-center">
                <Users size={28} className="text-sand mx-auto mb-2.5" />
                <p className="text-sm text-warm-light">Поки що немає відгуків</p>
                <p className="text-xs text-warm-light/70 mt-1">Колеги побачать запит у сповіщеннях і зможуть відгукнутись</p>
              </div>
            ) : (
              <div className="space-y-4">
                {request.isAuthor && request.responses.length > 0 && (
                  <p className="text-xs text-warm-light">Оберіть терапевтів для включення в PDF-список рекомендацій</p>
                )}
                {request.responses.map(resp => {
                  const parsedLinks: string[] = resp.links ? JSON.parse(resp.links) : []
                  return (
                    <div
                      key={resp.id}
                      className={`bg-white rounded-2xl border transition-all ${resp.isSelected ? 'border-rose/40 bg-rose-lighter/30' : 'border-sand/60'} p-5`}
                    >
                      <div className="flex items-start gap-4">
                        {/* Select checkbox */}
                        <button
                          onClick={() => handleToggleSelect(resp.id)}
                          className="shrink-0 mt-0.5 text-rose hover:opacity-70 transition"
                          title={resp.isSelected ? 'Прибрати з PDF' : 'Додати в PDF'}
                        >
                          {resp.isSelected ? <CheckSquare size={20} /> : <Square size={20} className="text-sand" />}
                        </button>

                        {/* Avatar */}
                        {resp.therapist.avatarUrl ? (
                          <img src={resp.therapist.avatarUrl} alt={resp.therapist.firstName} className="w-12 h-12 rounded-full object-cover shrink-0 border border-sand" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-beige flex items-center justify-center shrink-0 text-warm-mid font-medium text-sm border border-sand">
                            {resp.therapist.firstName[0]}{resp.therapist.lastName[0]}
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="font-medium text-warm-dark text-sm">{resp.therapist.firstName} {resp.therapist.lastName}</p>
                            <span className="text-[10px] text-warm-light/60 shrink-0">
                              {format(new Date(resp.createdAt), 'd MMM', { locale: uk })}
                            </span>
                          </div>
                          <div className="flex gap-3 text-xs text-warm-light mb-3">
                            {resp.therapist.telegram && <span>✈ {resp.therapist.telegram}</span>}
                            <span>✉ {resp.therapist.email}</span>
                          </div>
                          <p className="text-sm text-warm-mid leading-relaxed whitespace-pre-line">{resp.presentation}</p>
                          {parsedLinks.length > 0 && (
                            <div className="mt-3 space-y-1">
                              {parsedLinks.map((link, i) => (
                                <a key={i} href={link} target="_blank" rel="noreferrer"
                                  className="block text-xs text-rose hover:underline truncate">{link}</a>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Non-author: show response count only */}
        {!request.isAuthor && request.responses.length > 0 && (
          <div className="bg-beige/50 rounded-2xl px-5 py-4 text-sm text-warm-mid text-center font-cormorant italic">
            На цей запит відгукнулися {request.responses.length} {request.responses.length === 1 ? 'колега' : 'колеги'}
          </div>
        )}
      </div>

      {/* ── Respond Modal ── */}
      {showRespondModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-7 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-cormorant text-2xl font-semibold text-warm-dark">Ваш відгук ♡</h3>
                <p className="font-cormorant italic text-warm-mid text-sm">Розкажіть про свій досвід та підхід</p>
              </div>
              <button onClick={() => setShowRespondModal(false)} className="text-warm-light hover:text-warm-mid transition"><X size={20} /></button>
            </div>

            {/* Auto-populated profile info */}
            <div className="bg-beige/50 rounded-xl p-4 mb-5">
              <p className="text-xs font-medium text-warm-light uppercase tracking-widest mb-2">Ваші дані (з профілю)</p>
              <div className="flex items-center gap-3">
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover border border-sand" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-white border border-sand flex items-center justify-center text-warm-mid text-sm font-medium">
                    {user?.firstName?.[0]}{user?.lastName?.[0]}
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-warm-dark">{user?.firstName} {user?.lastName}</p>
                  <p className="text-xs text-warm-light">{user?.email}{user?.telegram ? ` · ${user.telegram}` : ''}</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleRespond} className="space-y-4">
              <div>
                <label className={labelClass}>Самопрезентація *</label>
                <textarea
                  required rows={6}
                  value={presentation}
                  onChange={e => setPresentation(e.target.value)}
                  placeholder="Розкажіть про свій досвід, особливості роботи, чому саме ви підходите для цього запиту..."
                  className={inputClass + ' resize-none'}
                />
              </div>

              <div>
                <label className={labelClass}>Додаткові посилання (необов'язково)</label>
                <div className="space-y-2">
                  {links.map((link, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        type="url"
                        value={link}
                        onChange={e => setLinks(prev => prev.map((l, j) => j === i ? e.target.value : l))}
                        placeholder="https://..."
                        className={inputClass}
                      />
                      {links.length > 1 && (
                        <button type="button" onClick={() => setLinks(prev => prev.filter((_, j) => j !== i))}
                          className="text-warm-light hover:text-rose transition shrink-0"><Trash2 size={15} /></button>
                      )}
                    </div>
                  ))}
                  {links.length < 5 && (
                    <button type="button" onClick={() => setLinks(prev => [...prev, ''])}
                      className="text-xs text-rose hover:opacity-80 transition flex items-center gap-1">
                      <Plus size={12} /> Додати посилання
                    </button>
                  )}
                </div>
              </div>

              {respondError && <p className="text-red-500 text-sm bg-red-50 rounded-xl px-4 py-2.5">{respondError}</p>}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowRespondModal(false)}
                  className="flex-1 border border-[#EBDDD0] bg-white text-warm-mid rounded-xl py-2.5 text-sm font-medium hover:bg-[#FFF4EC] hover:border-[#C07888]/30 transition neu-btn">
                  Скасувати
                </button>
                <button type="submit" disabled={respondSaving}
                  className="flex-1 bg-gradient-to-br from-[#C07888] to-[#A06070] text-white font-medium rounded-xl py-2.5 text-sm neu-btn-primary hover:opacity-90 transition disabled:opacity-50">
                  {respondSaving ? 'Надсилаємо...' : 'Відгукнутися'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-warm-dark text-white text-sm px-5 py-3 rounded-2xl shadow-lg">
          {toast}
        </div>
      )}
    </Layout>
  )
}
