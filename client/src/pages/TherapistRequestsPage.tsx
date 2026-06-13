import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Search, Plus, X, Globe, MapPin, Clock, MessageCircle,
  Info, TrendingUp, Check, ChevronRight,
} from 'lucide-react'
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
  price: number | null
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

type FeedFilter = 'all' | 'open'

const inputCls = 'w-full bg-white border border-sand rounded-xl px-4 py-2.5 text-sm text-warm-dark placeholder:text-warm-light focus:outline-none focus:border-rose focus:ring-1 focus:ring-rose-light transition'

export default function TherapistRequestsPage() {
  const { user } = useAuth()
  const [requests, setRequests] = useState<TherapistRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('all')

  const [form, setForm] = useState({
    title: '',
    description: '',
    workFormat: '',
    country: '',
    city: '',
    language: '',
    therapyFormats: [] as string[],
    price: '',
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
        price: form.price !== '' ? parseFloat(form.price) : null,
      })
      setRequests(prev => [res.data, ...prev])
      setShowModal(false)
      resetForm()
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Помилка збереження')
    } finally { setSaving(false) }
  }

  const resetForm = () => setForm({ title: '', description: '', workFormat: '', country: '', city: '', language: '', therapyFormats: [], price: '' })

  const filtered = useMemo(() => {
    let list = requests
    if (feedFilter === 'open') list = list.filter(r => r.status === 'OPEN')
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(r =>
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        (r.city || '').toLowerCase().includes(q) ||
        (r.country || '').toLowerCase().includes(q)
      )
    }
    return list
  }, [requests, feedFilter, search])

  const openCount = requests.filter(r => r.status === 'OPEN').length
  const myRequests = requests.filter(r => r.author.id === user?.id)
  const myResponsesTotal = myRequests.reduce((s, r) => s + r._count.responses, 0)

  function plural(n: number) {
    if (n === 1) return 'запис'
    if (n >= 2 && n <= 4) return 'записи'
    return 'записів'
  }

  return (
    <Layout>
      <div className="max-w-[1120px] mx-auto">

        {/* ── Hero ── */}
        <section className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <h1 className="font-cormorant text-[clamp(30px,3.6vw,42px)] font-semibold leading-[1.06] flex items-center gap-3" style={{ color: 'var(--ink)' }}>
              Пошук терапевта{' '}
              <span style={{ color: 'var(--coral)' }}>♡</span>
            </h1>
            <p className="font-cormorant italic text-[19px] mt-2" style={{ color: 'var(--ink-2)' }}>
              Запити до спільноти та рекомендації від колег
            </p>
          </div>
          <button
            onClick={() => { resetForm(); setError(''); setShowModal(true) }}
            className="inline-flex items-center gap-2 rounded-[var(--r-pill)] font-bold text-[15.5px] text-white border-none cursor-pointer transition-all duration-200"
            style={{
              padding: '14px 26px',
              background: 'linear-gradient(135deg, #F45A34, #D93818)',
              boxShadow: '-4px -4px 12px rgba(255,255,255,.4), 10px 12px 26px rgba(244,90,52,.40)',
            }}
          >
            Створити запит
            <Plus size={17} />
          </button>
        </section>

        {/* ── Intro band ── */}
        <section
          className="relative overflow-hidden rounded-[var(--r-xl)] shadow-clay mt-7"
          style={{ background: 'linear-gradient(150deg, #FBEFE9, #F3DEE6 55%, #ECE0F2)', padding: '30px 34px' }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-7 items-center">
            <div>
              <h2 className="font-cormorant text-[26px] font-semibold leading-[1.1]" style={{ color: 'var(--ink)' }}>
                Потрібна рекомендація колеги для клієнта?
              </h2>
              <p className="font-cormorant italic text-[17px] mt-2 max-w-[520px]" style={{ color: 'var(--ink-2)' }}>
                Опишіть запит, і терапевти нашої спільноти зможуть відгукнутися та запропонувати свою допомогу.
              </p>
            </div>
            <div
              className="hidden lg:block w-[130px] h-[130px] rounded-[var(--r-lg)] flex-shrink-0 relative overflow-hidden shadow-clay-sm"
              style={{
                background: 'radial-gradient(60% 55% at 35% 35%, rgba(225,180,170,.6), transparent 70%), radial-gradient(55% 50% at 70% 65%, rgba(216,154,172,.4), transparent 72%), var(--surface)',
              }}
            >
              <img
                src="/illustrations/search_therapist.png"
                alt=""
                className="absolute inset-0 w-full h-full object-cover opacity-80"
              />
            </div>
          </div>
        </section>

        {/* ── Search ── */}
        <div
          className="flex items-center gap-3 mt-7 rounded-[var(--r-pill)] shadow-clay-sm"
          style={{ background: 'var(--surface)', padding: '8px 8px 8px 22px' }}
        >
          <Search size={20} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Пошук за описом, містом або типом запиту…"
            className="flex-1 min-w-0 border-none bg-transparent outline-none font-mulish text-[16px]"
            style={{ color: 'var(--ink)' }}
          />
        </div>

        {/* ── Filter tabs ── */}
        <div className="flex flex-wrap items-center gap-[10px] mt-[18px]">
          <button
            onClick={() => setFeedFilter('all')}
            className="inline-flex items-center gap-[7px] px-4 py-[9px] rounded-[var(--r-pill)] font-bold text-[14px] border-none cursor-pointer transition-transform duration-200"
            style={
              feedFilter === 'all'
                ? { background: 'linear-gradient(135deg,#F45A34,#D93818)', color: '#fff', boxShadow: '-3px -3px 8px rgba(255,255,255,.3), 8px 10px 22px rgba(244,90,52,.4)' }
                : { background: 'var(--surface)', color: 'var(--ink-2)', boxShadow: 'var(--clay-sm)' }
            }
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h11"/></svg>
            Усі
          </button>
          <button
            onClick={() => setFeedFilter('open')}
            className="inline-flex items-center gap-[7px] px-4 py-[9px] rounded-[var(--r-pill)] font-bold text-[14px] border-none cursor-pointer transition-transform duration-200"
            style={
              feedFilter === 'open'
                ? { background: 'linear-gradient(135deg,#F45A34,#D93818)', color: '#fff', boxShadow: '-3px -3px 8px rgba(255,255,255,.3), 8px 10px 22px rgba(244,90,52,.4)' }
                : { background: 'var(--surface)', color: 'var(--ink-2)', boxShadow: 'var(--clay-sm)' }
            }
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg>
            Відкриті
          </button>
          <span className="ml-auto text-[13px] font-bold" style={{ color: 'var(--ink-3)' }}>
            {filtered.length} {plural(filtered.length)}
          </span>
        </div>

        {/* ── Body: 2-col ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 items-start mt-7">

          {/* ════ Feed ════ */}
          <div>
            {loading ? (
              <div className="space-y-[18px]">
                {[1, 2, 3].map(i => (
                  <div key={i} className="rounded-[var(--r-lg)] shadow-clay animate-pulse" style={{ background: 'var(--surface)', padding: '26px 30px' }}>
                    <div className="h-6 rounded-full mb-3" style={{ background: 'var(--surface-2)', width: '75%' }} />
                    <div className="h-4 rounded-full mb-2" style={{ background: 'var(--surface-2)', width: '100%' }} />
                    <div className="h-4 rounded-full" style={{ background: 'var(--surface-2)', width: '60%' }} />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center rounded-[var(--r-lg)] shadow-clay" style={{ background: 'var(--surface)', padding: '50px 20px' }}>
                <Search size={44} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--ink-3)' }} />
                <p className="font-cormorant text-[20px]" style={{ color: 'var(--ink-3)' }}>
                  {search ? 'Записів не знайдено. Спробуйте інший фільтр ♡' : 'Поки що немає запитів'}
                </p>
              </div>
            ) : (
              <div>
                {filtered.map(req => (
                  <RequestCard key={req.id} req={req} currentUserId={user?.id} />
                ))}
              </div>
            )}
          </div>

          {/* ════ Right rail ════ */}
          <div className="lg:sticky lg:top-24 flex flex-col gap-5">

            {/* Create card */}
            <div
              className="rounded-[var(--r-lg)] text-white"
              style={{
                background: 'linear-gradient(150deg, #F45A34, #C83010)',
                boxShadow: 'var(--float)',
                padding: '26px 28px',
              }}
            >
              <h3 className="font-cormorant text-[22px] font-semibold" style={{ color: '#fff' }}>Шукаєте колегу?</h3>
              <p className="text-[14px] mt-2 leading-[1.55]" style={{ color: 'rgba(255,255,255,.85)' }}>
                Опишіть, кого шукаєте для клієнта — спільнота відгукнеться й порадить перевірених терапевтів.
              </p>
              <button
                onClick={() => { resetForm(); setError(''); setShowModal(true) }}
                className="flex items-center justify-center gap-2 w-full mt-[18px] rounded-[var(--r-pill)] font-extrabold text-[15px] border-none cursor-pointer transition-transform duration-200 hover:-translate-y-0.5"
                style={{
                  padding: '14px',
                  background: 'rgba(255,255,255,.95)',
                  color: 'var(--rose-ink)',
                }}
              >
                <Plus size={17} />
                Створити запит
              </button>
            </div>

            {/* Tips widget */}
            <div className="rounded-[var(--r-lg)] shadow-clay" style={{ background: 'var(--surface)', padding: '24px 26px' }}>
              <div className="flex items-center gap-[9px] mb-[14px]">
                <Info size={18} style={{ color: 'var(--rose-deep)', flexShrink: 0 }} />
                <h3 className="font-cormorant text-[18px] font-semibold" style={{ color: 'var(--ink)' }}>Як скласти запит</h3>
              </div>
              <div className="grid gap-3">
                {[
                  'Вкажіть формат (онлайн/офлайн) і місто',
                  'Опишіть запит клієнта без особистих даних',
                  'Зазначте тип ЕФТ та бюджет, якщо є',
                ].map((tip, i) => (
                  <div key={i} className="flex gap-[11px] items-start text-[14px] leading-[1.45]" style={{ color: 'var(--ink-2)' }}>
                    <Check size={17} style={{ color: 'var(--sage-deep)', flexShrink: 0, marginTop: 2 }} />
                    {tip}
                  </div>
                ))}
              </div>
            </div>

            {/* Stats widget */}
            <div className="rounded-[var(--r-lg)] shadow-clay" style={{ background: 'var(--surface)', padding: '24px 26px' }}>
              <div className="flex items-center gap-[9px] mb-[14px]">
                <TrendingUp size={18} style={{ color: 'var(--rose-deep)', flexShrink: 0 }} />
                <h3 className="font-cormorant text-[18px] font-semibold" style={{ color: 'var(--ink)' }}>Активність</h3>
              </div>
              {[
                { label: 'Відкритих запитів', value: openCount },
                { label: 'Мої запити', value: myRequests.length },
                { label: 'Мої відгуки', value: myResponsesTotal },
              ].map((s, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-[11px]"
                  style={{ borderTop: i > 0 ? '1px solid var(--line)' : undefined }}
                >
                  <span className="text-[14px] font-semibold" style={{ color: 'var(--ink-2)' }}>{s.label}</span>
                  <b className="font-cormorant text-[22px] font-bold" style={{ color: 'var(--rose-deep)' }}>{s.value}</b>
                </div>
              ))}
            </div>

          </div>
        </div>
      </div>

      {/* ── Create Request Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/25 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-[#FFF9F5] rounded-3xl shadow-[0_20px_60px_rgba(160,80,100,0.12)] w-full max-w-lg p-8 max-h-[90vh] overflow-y-auto">

            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-cormorant text-2xl font-semibold text-warm-dark">Новий запит ♡</h3>
                <p className="font-cormorant italic text-warm-mid text-sm">Зверніться до спільноти за рекомендацією</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-warm-light hover:text-warm-mid transition"><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <ModalField label="Заголовок запиту *">
                <input
                  type="text" required
                  value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="Напр: Шукаю EFT-терапевта для роботи з підлітком"
                  className={inputCls}
                />
              </ModalField>

              <ModalField label="Опис запиту *">
                <textarea
                  required rows={5}
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Опишіть ситуацію, запит, побажання та особливості."
                  className={inputCls + ' resize-none'}
                />
              </ModalField>

              <div>
                <p className="block text-xs font-semibold text-warm-mid uppercase tracking-wider mb-3">Формат роботи</p>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(WORK_FORMAT_LABELS).map(([val, lbl]) => (
                    <label
                      key={val}
                      className={`flex items-center gap-2.5 p-3 rounded-xl border-2 cursor-pointer transition ${
                        form.workFormat === val
                          ? 'border-rose bg-rose-lighter'
                          : 'border-sand bg-[#FFF9F5] hover:border-rose-light'
                      }`}
                      onClick={() => setForm(p => ({ ...p, workFormat: p.workFormat === val ? '' : val }))}
                    >
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${form.workFormat === val ? 'border-rose' : 'border-sand'}`}>
                        {form.workFormat === val && <div className="w-2 h-2 rounded-full bg-rose" />}
                      </div>
                      <span className="text-[13px] font-semibold text-warm-dark leading-tight">{lbl}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <ModalField label="Країна">
                  <input type="text" value={form.country} onChange={e => setForm(p => ({ ...p, country: e.target.value }))} placeholder="Україна" className={inputCls} />
                </ModalField>
                <ModalField label="Місто">
                  <input type="text" value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} placeholder="Київ" className={inputCls} />
                </ModalField>
              </div>

              <ModalField label="Мова роботи">
                <input type="text" value={form.language} onChange={e => setForm(p => ({ ...p, language: e.target.value }))} placeholder="Українська" className={inputCls} />
              </ModalField>

              <ModalField label="Вартість сесії (грн)">
                <input type="number" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} min="0" step="50" placeholder="Наприклад, 1000" className={inputCls} />
              </ModalField>

              <div>
                <p className="block text-xs font-semibold text-warm-mid uppercase tracking-wider mb-3">Формат терапії</p>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(THERAPY_FORMAT_LABELS).map(([val, lbl]) => {
                    const checked = form.therapyFormats.includes(val)
                    return (
                      <label
                        key={val}
                        className={`flex items-center gap-2.5 p-3 rounded-xl border-2 cursor-pointer transition ${
                          checked ? 'border-rose bg-rose-lighter' : 'border-sand bg-[#FFF9F5] hover:border-rose-light'
                        }`}
                        onClick={() => toggleFormat(val)}
                      >
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${checked ? 'border-rose bg-rose' : 'border-sand'}`}>
                          {checked && (
                            <svg width="9" height="7" viewBox="0 0 10 8" fill="none">
                              <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                        <span className="text-[13px] font-semibold text-warm-dark leading-tight">{lbl}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {error && (
                <p className="text-sm rounded-2xl px-4 py-2.5 text-[#A86060] bg-[#F8EEEE]">{error}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button" onClick={() => setShowModal(false)}
                  className="flex-1 border border-[#EBDDD0] bg-white text-warm-mid rounded-2xl px-4 py-3 text-sm hover:bg-cream transition"
                >
                  Скасувати
                </button>
                <button
                  type="submit" disabled={saving}
                  className="flex-1 text-white font-medium rounded-2xl px-6 py-3 text-sm transition disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#F45A34,#D93818)' }}
                >
                  {saving ? 'Публікуємо…' : 'Опублікувати'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}

function ModalField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-warm-mid uppercase tracking-wider mb-2">{label}</label>
      {children}
    </div>
  )
}

function RequestCard({ req, currentUserId }: { req: TherapistRequest; currentUserId?: string }) {
  const isOpen = req.status === 'OPEN'

  return (
    <Link
      to={`/therapist-requests/${req.id}`}
      className="block rounded-[var(--r-lg)] shadow-clay mb-[18px] transition-all duration-300 cursor-pointer no-underline hover:-translate-y-[3px]"
      style={{
        background: 'var(--surface)',
        boxShadow: 'var(--clay)',
        padding: '26px 30px',
        textDecoration: 'none',
      }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = 'var(--clay-hover)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'var(--clay)')}
    >
      {/* Top */}
      <div className="flex items-start gap-[14px]">
        <h3 className="font-cormorant text-[24px] font-bold leading-[1.18] flex-1 min-w-0" style={{ color: 'var(--ink)' }}>
          {req.title}
        </h3>
        <span
          className="inline-flex items-center gap-[6px] rounded-[var(--r-pill)] text-[12px] font-extrabold flex-shrink-0"
          style={{
            padding: '6px 13px',
            background: isOpen ? 'var(--sage)' : 'var(--surface-2)',
            color: isOpen ? 'var(--sage-deep)' : 'var(--ink-3)',
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="7"/></svg>
          {isOpen ? 'Відкрито' : 'Закрито'}
        </span>
      </div>

      {/* Description */}
      <p className="text-[15.5px] leading-[1.6] mt-3 line-clamp-3" style={{ color: 'var(--ink-2)' }}>
        {req.description}
      </p>

      {/* Tags */}
      <div className="flex flex-wrap gap-[9px] mt-4">
        {req.workFormat && (
          <span className="inline-flex items-center gap-[7px] rounded-[var(--r-pill)] text-[13px] font-bold" style={{ padding: '7px 13px', background: 'var(--surface-2)', color: 'var(--ink-2)' }}>
            <Globe size={14} style={{ opacity: .8 }} />
            {WORK_FORMAT_LABELS[req.workFormat] ?? req.workFormat}
          </span>
        )}
        {(req.city || req.country) && (
          <span className="inline-flex items-center gap-[7px] rounded-[var(--r-pill)] text-[13px] font-bold" style={{ padding: '7px 13px', background: 'var(--surface-2)', color: 'var(--ink-2)' }}>
            <MapPin size={14} style={{ opacity: .8 }} />
            {[req.city, req.country].filter(Boolean).join(', ')}
          </span>
        )}
        {req.therapyFormats.map(f => (
          <span key={f} className="inline-flex items-center rounded-[var(--r-pill)] text-[13px] font-bold" style={{ padding: '7px 13px', background: 'var(--blush)', color: 'var(--rose-ink)' }}>
            {THERAPY_FORMAT_LABELS[f] ?? f}
          </span>
        ))}
        {req.language && (
          <span className="inline-flex items-center rounded-[var(--r-pill)] text-[13px] font-bold" style={{ padding: '7px 13px', background: 'var(--surface-2)', color: 'var(--ink-2)' }}>
            {req.language}
          </span>
        )}
        {req.price != null && (
          <span className="inline-flex items-center rounded-[var(--r-pill)] text-[13px] font-bold" style={{ padding: '7px 13px', background: 'var(--sage)', color: 'var(--sage-deep)' }}>
            до {req.price.toLocaleString('uk-UA')} грн
          </span>
        )}
      </div>

      {/* Footer */}
      <div
        className="flex flex-wrap items-center gap-[18px] mt-[18px] pt-4"
        style={{ borderTop: '1px solid var(--line)' }}
      >
        <span className="inline-flex items-center gap-[7px] text-[13px] font-semibold" style={{ color: 'var(--ink-3)' }}>
          <Clock size={15} />
          {format(new Date(req.createdAt), 'd MMM yyyy', { locale: uk })}
        </span>
        <span className="inline-flex items-center gap-[7px] text-[13px] font-semibold" style={{ color: 'var(--ink-3)' }}>
          <MessageCircle size={15} />
          {req._count.responses} {req._count.responses === 1 ? 'відгук' : req._count.responses < 5 ? 'відгуки' : 'відгуків'}
        </span>
        <span
          className="ml-auto inline-flex items-center gap-1 rounded-[var(--r-pill)] font-bold text-[14.5px] text-white border-none"
          style={{
            padding: '9px 22px',
            background: 'linear-gradient(135deg, #F45A34, #D93818)',
            boxShadow: '-3px -3px 8px rgba(255,255,255,.3), 8px 10px 22px rgba(244,90,52,.4)',
          }}
        >
          Відгукнутися
          <ChevronRight size={14} />
        </span>
        <span className="text-[11.5px] font-extrabold tracking-[.08em] uppercase" style={{ color: 'var(--ink-3)' }}>
          {req.author.firstName} {req.author.lastName}
          {req.author.id === currentUserId && ' (ви)'}
        </span>
      </div>
    </Link>
  )
}
