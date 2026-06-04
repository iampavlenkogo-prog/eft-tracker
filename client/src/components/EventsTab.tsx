import { useState, useEffect, useRef } from 'react'
import { Calendar, Clock, Plus, X, ChevronDown, ChevronUp, FileText, ExternalLink, Upload, Video } from 'lucide-react'
import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
import api from '../api/axios'

interface EventRegistration {
  id: string; status: string; paymentReceiptUrl: string | null; createdAt: string
  user: { id: string; firstName: string; lastName: string; email: string; phone?: string; telegram?: string }
}

interface EventReminderData { id: string; sendAt: string; sent: boolean }

interface OrganizerEvent {
  id: string; title: string; description: string; date: string
  startTime: string | null; endTime: string | null
  price: number; currency: string
  priceVariations: Array<{ label: string; price: number }> | null
  coverImageUrl: string | null; zoomLink: string | null
  presentationUrl: string | null; status: string; createdAt: string
  paymentInstructions: string
  registrations: EventRegistration[]
  reminders: EventReminderData[]
}

type PriceVar = { label: string; price: string }
type ReminderInput = { sendAt: string }

const REG_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING:          { label: 'Очікує',               cls: 'bg-[#FBF0E8] text-[#B07840]' },
  PAYMENT_SENT:     { label: 'Реквізити надіслано',  cls: 'bg-[#EEF2F8] text-[#7090B0]' },
  RECEIPT_UPLOADED: { label: 'Квитанція завантажена', cls: 'bg-[#F2EEF8] text-[#9080B0]' },
  CONFIRMED:        { label: 'Підтверджено',         cls: 'bg-[#EEF2EE] text-[#6A9870]' },
  REJECTED:         { label: 'Відхилено',            cls: 'bg-[#F8EEEE] text-[#A86060]' },
}

const EVENT_STATUS: Record<string, { label: string; cls: string }> = {
  DRAFT:     { label: 'Чернетка',      cls: 'bg-sand text-warm-mid' },
  PUBLISHED: { label: 'Опублікований', cls: 'bg-[#EEF2EE] text-[#6A9870]' },
  CANCELLED: { label: 'Скасовано',     cls: 'bg-[#F8EEEE] text-[#A86060]' },
}

const CURRENCIES = [
  { value: 'UAH', label: '₴ Гривня' },
  { value: 'EUR', label: '€ Євро' },
  { value: 'USD', label: '$ Долар' },
]
const CURRENCY_SYMBOL: Record<string, string> = { UAH: '₴', EUR: '€', USD: '$' }

const inputCls = 'w-full border border-sand rounded-xl px-4 py-2.5 text-warm-dark text-sm focus:outline-none focus:border-rose focus:ring-1 focus:ring-rose-light transition bg-white'
const iconInputCls = 'w-full border border-sand rounded-xl pl-9 pr-3 py-2.5 text-warm-dark text-sm focus:outline-none focus:border-rose focus:ring-1 focus:ring-rose-light transition bg-white'
const labelCls = 'block text-xs font-medium text-warm-light uppercase tracking-wider mb-2'

const emptyForm = { title: '', description: '', date: '', startTime: '', endTime: '', price: '', currency: 'UAH', paymentInstructions: '' }
const emptyReminders: ReminderInput[] = [{ sendAt: '' }, { sendAt: '' }]

function toLocalDatetime(iso: string) {
  try { return new Date(iso).toISOString().slice(0, 16) } catch { return '' }
}

// ─── Sub-components ────────────────────────────────────────────────────────

function PriceVariationsEditor({ variations, onChange }: { variations: PriceVar[]; onChange: (v: PriceVar[]) => void }) {
  const add = () => onChange([...variations, { label: '', price: '' }])
  const remove = (i: number) => onChange(variations.filter((_, idx) => idx !== i))
  const update = (i: number, field: keyof PriceVar, val: string) =>
    onChange(variations.map((v, idx) => idx === i ? { ...v, [field]: val } : v))

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className={labelCls}>Варіації вартості (необов'язково)</label>
        {variations.length < 5 && (
          <button type="button" onClick={add} className="text-xs text-rose hover:opacity-70 transition">+ Додати</button>
        )}
      </div>
      {variations.length === 0 && (
        <p className="text-xs text-warm-light italic">Наприклад: Early Bird, Для членів асоціації</p>
      )}
      <div className="space-y-2">
        {variations.map((v, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input type="text" placeholder="Назва (напр. Early Bird)" value={v.label}
              onChange={e => update(i, 'label', e.target.value)} className={inputCls} />
            <input type="number" placeholder="Ціна" value={v.price} min="0"
              onChange={e => update(i, 'price', e.target.value)} className={inputCls + ' w-28 shrink-0'} />
            <button type="button" onClick={() => remove(i)} className="text-warm-light hover:text-rose transition shrink-0">
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function RemindersEditor({ reminders, onChange }: { reminders: ReminderInput[]; onChange: (r: ReminderInput[]) => void }) {
  const update = (i: number, val: string) =>
    onChange(reminders.map((r, idx) => idx === i ? { sendAt: val } : r))

  return (
    <div>
      <label className={labelCls}>Нагадування (надсилаються всім автоматично)</label>
      <div className="space-y-2">
        {reminders.map((r, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="text-xs text-warm-light shrink-0 w-28">Нагадування {i + 1}:</span>
            <input type="datetime-local" value={r.sendAt}
              onChange={e => update(i, e.target.value)} className={inputCls + ' flex-1'} />
          </div>
        ))}
      </div>
      <p className="text-xs text-warm-light mt-1 italic">Залиште порожнім, щоб не надсилати</p>
    </div>
  )
}

// ─── EventForm (shared between Create and Edit modals) ─────────────────────

interface EventFormProps {
  form: typeof emptyForm
  setForm: (f: typeof emptyForm) => void
  priceVars: PriceVar[]
  setPriceVars: (v: PriceVar[]) => void
  reminders: ReminderInput[]
  setReminders: (r: ReminderInput[]) => void
  coverFile: File | null
  setCoverFile: (f: File | null) => void
  error: string
  saving: boolean
  onClose: () => void
  onSave: (e: React.FormEvent, publish?: boolean) => void
  title: string
  isEdit?: boolean
  hasCover?: boolean
}

function EventFormModal({
  form, setForm, priceVars, setPriceVars, reminders, setReminders,
  coverFile, setCoverFile, error, saving, onClose, onSave, title, isEdit, hasCover,
}: EventFormProps) {
  const coverRef = useRef<HTMLInputElement>(null)
  const [coverDrag, setCoverDrag] = useState(false)
  const sf = (f: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm({ ...form, [f]: e.target.value })

  return (
    <div className="fixed inset-0 bg-black/25 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-[#FFF9F5] rounded-3xl shadow-[0_20px_60px_rgba(160,80,100,0.12)] w-full max-w-lg p-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-cormorant text-2xl font-semibold text-warm-dark">{title}</h3>
            <p className="font-cormorant italic text-warm-mid text-sm">Заповніть інформацію про захід</p>
          </div>
          <button onClick={onClose} className="text-warm-light hover:text-warm-mid transition"><X size={20} /></button>
        </div>

        <form onSubmit={e => onSave(e, false)} className="space-y-4">
          {/* Title */}
          <div>
            <label className={labelCls}>Назва *</label>
            <input type="text" value={form.title} onChange={sf('title')} required placeholder="Назва заходу" className={inputCls} />
          </div>

          {/* Description */}
          <div>
            <label className={labelCls}>Опис *</label>
            <textarea value={form.description} onChange={sf('description')} required rows={3} placeholder="Детальний опис..." className={inputCls + ' resize-none'} />
          </div>

          {/* Date + Times */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className={labelCls}>Дата *</label>
              <div className="relative">
                <Calendar size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-warm-light pointer-events-none z-10" />
                <input type="date" value={form.date} onChange={sf('date')} required placeholder="дд.мм.рр" className={iconInputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Початок</label>
              <div className="relative">
                <Clock size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-warm-light pointer-events-none z-10" />
                <input type="time" value={form.startTime} onChange={sf('startTime')} className={iconInputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Кінець</label>
              <div className="relative">
                <Clock size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-warm-light pointer-events-none z-10" />
                <input type="time" value={form.endTime} onChange={sf('endTime')} className={iconInputCls} />
              </div>
            </div>
          </div>

          {/* Currency + Price */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Валюта *</label>
              <select value={form.currency} onChange={sf('currency')} className={inputCls}>
                {CURRENCIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Вартість *</label>
              <input type="number" value={form.price} onChange={sf('price')} required min="0" placeholder="0" className={inputCls} />
            </div>
          </div>

          {/* Price variations */}
          <PriceVariationsEditor variations={priceVars} onChange={setPriceVars} />

          {/* Payment instructions */}
          <div>
            <label className={labelCls}>Реквізити для оплати *</label>
            <textarea value={form.paymentInstructions} onChange={sf('paymentInstructions')} required rows={3}
              placeholder="Банківські реквізити або інструкції..." className={inputCls + ' resize-none'} />
          </div>

          {/* Cover image */}
          <div>
            <label className={labelCls}>Обкладинка {hasCover ? '(є — можна замінити)' : "(необов'язково)"}</label>
            <div onClick={() => coverRef.current?.click()}
              onDrop={e => { e.preventDefault(); setCoverDrag(false); const f = e.dataTransfer.files[0]; if (f) setCoverFile(f) }}
              onDragOver={e => { e.preventDefault(); setCoverDrag(true) }} onDragLeave={() => setCoverDrag(false)}
              className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition ${coverDrag ? 'border-rose bg-rose-lighter' : 'border-sand hover:border-rose-light'}`}>
              <Upload size={18} className="mx-auto text-warm-light mb-1" />
              {coverFile ? <p className="text-sm text-warm-dark font-medium">{coverFile.name}</p>
                : <p className="text-sm text-warm-mid">Завантажте зображення</p>}
            </div>
            <input ref={coverRef} type="file" accept="image/*" onChange={e => setCoverFile(e.target.files?.[0] ?? null)} className="hidden" />
          </div>

          {/* Reminders */}
          <RemindersEditor reminders={reminders} onChange={setReminders} />

          {error && <p className="text-[#A86060] text-sm bg-[#F8EEEE] rounded-2xl px-4 py-2.5">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-sand text-warm-mid hover:bg-beige font-medium rounded-xl py-2.5 text-sm transition">
              Скасувати
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 border border-sand text-warm-mid hover:bg-beige font-medium rounded-xl py-2.5 text-sm transition disabled:opacity-60">
              {saving ? 'Зберігаємо...' : 'Зберегти як чернетку'}
            </button>
            {!isEdit && (
              <button type="button" disabled={saving} onClick={e => onSave(e as any, true)}
                className="flex-1 bg-rose hover:bg-[#A06070] disabled:opacity-60 text-white font-medium rounded-xl py-2.5 text-sm transition">
                Опублікувати
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main EventsTab ─────────────────────────────────────────────────────────

export default function EventsTab() {
  const [events, setEvents] = useState<OrganizerEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Create modal
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState(emptyForm)
  const [createPriceVars, setCreatePriceVars] = useState<PriceVar[]>([])
  const [createReminders, setCreateReminders] = useState<ReminderInput[]>(emptyReminders.map(r => ({ ...r })))
  const [createCover, setCreateCover] = useState<File | null>(null)
  const [createSaving, setCreateSaving] = useState(false)
  const [createError, setCreateError] = useState('')

  // Edit modal
  const [editingEvent, setEditingEvent] = useState<OrganizerEvent | null>(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const [editPriceVars, setEditPriceVars] = useState<PriceVar[]>([])
  const [editReminders, setEditReminders] = useState<ReminderInput[]>(emptyReminders.map(r => ({ ...r })))
  const [editCover, setEditCover] = useState<File | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  // Materials modal
  const [materialsEvent, setMaterialsEvent] = useState<OrganizerEvent | null>(null)
  const [materialsZoom, setMaterialsZoom] = useState('')
  const [presentationFile, setPresentationFile] = useState<File | null>(null)
  const [presentationDrag, setPresentationDrag] = useState(false)
  const [materialsSaving, setMaterialsSaving] = useState(false)
  const [materialsError, setMaterialsError] = useState('')
  const presentationRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.get('/events/my').then(res => setEvents(res.data)).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const reload = () => api.get('/events/my').then(res => setEvents(res.data)).catch(() => {})

  // ── Build FormData ──────────────────────────────────────────────────────
  function buildFD(form: typeof emptyForm, priceVars: PriceVar[], reminders: ReminderInput[], cover: File | null) {
    const fd = new FormData()
    fd.append('title', form.title)
    fd.append('description', form.description)
    fd.append('date', form.date)
    fd.append('startTime', form.startTime)
    fd.append('endTime', form.endTime)
    fd.append('price', form.price)
    fd.append('currency', form.currency)
    fd.append('paymentInstructions', form.paymentInstructions)

    const validVars = priceVars.filter(v => v.label && v.price)
    fd.append('priceVariations', JSON.stringify(validVars.map(v => ({ label: v.label, price: parseFloat(v.price) }))))

    const validReminders = reminders.filter(r => r.sendAt)
    fd.append('reminders', JSON.stringify(validReminders.map(r => ({ sendAt: new Date(r.sendAt).toISOString() }))))

    if (cover) fd.append('coverImage', cover)
    return fd
  }

  // ── Create ──────────────────────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent, publish = false) => {
    e.preventDefault(); setCreateError(''); setCreateSaving(true)
    try {
      const fd = buildFD(createForm, createPriceVars, createReminders, createCover)
      const res = await api.post('/events', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      if (publish) await api.post(`/events/${res.data.id}/publish`)
      setShowCreate(false)
      setCreateForm(emptyForm); setCreatePriceVars([]); setCreateReminders(emptyReminders.map(r => ({ ...r }))); setCreateCover(null)
      reload()
    } catch (err: any) { setCreateError(err.response?.data?.error || 'Помилка') }
    finally { setCreateSaving(false) }
  }

  // ── Edit ────────────────────────────────────────────────────────────────
  const openEdit = (ev: OrganizerEvent) => {
    setEditingEvent(ev)
    setEditForm({
      title: ev.title, description: ev.description,
      date: ev.date.split('T')[0],
      startTime: ev.startTime ?? '', endTime: ev.endTime ?? '',
      price: String(ev.price), currency: ev.currency ?? 'UAH',
      paymentInstructions: ev.paymentInstructions ?? '',
    })
    setEditPriceVars(
      Array.isArray(ev.priceVariations)
        ? ev.priceVariations.map(v => ({ label: String(v.label ?? ''), price: String(v.price ?? '') }))
        : []
    )
    const rem = ev.reminders ?? []
    setEditReminders([
      { sendAt: rem[0] ? toLocalDatetime(rem[0].sendAt) : '' },
      { sendAt: rem[1] ? toLocalDatetime(rem[1].sendAt) : '' },
    ])
    setEditCover(null); setEditError('')
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault(); setEditError(''); setEditSaving(true)
    try {
      const fd = buildFD(editForm, editPriceVars, editReminders, editCover)
      await api.patch(`/events/${editingEvent!.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setEditingEvent(null); reload()
    } catch (err: any) { setEditError(err.response?.data?.error || 'Помилка') }
    finally { setEditSaving(false) }
  }

  // ── Materials ────────────────────────────────────────────────────────────
  const openMaterials = (ev: OrganizerEvent) => {
    setMaterialsEvent(ev)
    setMaterialsZoom(ev.zoomLink ?? '')
    setPresentationFile(null); setMaterialsError('')
  }

  const handleMaterialsSave = async (e: React.FormEvent) => {
    e.preventDefault(); setMaterialsError(''); setMaterialsSaving(true)
    try {
      const fd = new FormData()
      fd.append('zoomLink', materialsZoom)
      if (presentationFile) fd.append('presentation', presentationFile)
      await api.post(`/events/${materialsEvent!.id}/materials`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setMaterialsEvent(null); reload()
    } catch (err: any) { setMaterialsError(err.response?.data?.error || 'Помилка') }
    finally { setMaterialsSaving(false) }
  }

  // ── Actions ──────────────────────────────────────────────────────────────
  const handlePublish = async (id: string) => {
    setActionLoading(id + '-publish')
    try { await api.post(`/events/${id}/publish`); reload() }
    catch (err: any) { alert(err.response?.data?.error || 'Помилка') }
    finally { setActionLoading(null) }
  }

  const handleCancel = async (id: string) => {
    if (!confirm('Скасувати захід?')) return
    setActionLoading(id + '-cancel')
    try { await api.delete(`/events/${id}`); reload() }
    catch (err: any) { alert(err.response?.data?.error || 'Помилка') }
    finally { setActionLoading(null) }
  }

  const handleSendPayment = async (eventId: string, regId: string) => {
    setActionLoading(regId + '-pay')
    try { await api.post(`/events/${eventId}/registrations/${regId}/send-payment`); reload() }
    catch (err: any) { alert(err.response?.data?.error || 'Помилка') }
    finally { setActionLoading(null) }
  }

  const handleConfirm = async (eventId: string, regId: string) => {
    setActionLoading(regId + '-confirm')
    try { await api.post(`/events/${eventId}/registrations/${regId}/confirm`); reload() }
    catch (err: any) { alert(err.response?.data?.error || 'Помилка') }
    finally { setActionLoading(null) }
  }

  const handleReject = async (eventId: string, regId: string) => {
    setActionLoading(regId + '-reject')
    try { await api.post(`/events/${eventId}/registrations/${regId}/reject`); reload() }
    catch (err: any) { alert(err.response?.data?.error || 'Помилка') }
    finally { setActionLoading(null) }
  }

  const openReceipt = async (eventId: string, regId: string, url: string) => {
    if (url.includes('/raw/upload/')) {
      const win = window.open('', '_blank')
      try {
        const res = await api.get(`/events/${eventId}/registrations/${regId}/receipt`, { responseType: 'blob' })
        if (win) win.location.href = URL.createObjectURL(res.data)
      } catch { if (win) win.close() }
    } else {
      window.open(url, '_blank')
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl">
      <div className="flex justify-end mb-4">
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-rose hover:bg-[#A06070] text-white font-medium rounded-xl px-5 py-2.5 text-sm transition">
          <Plus size={16} />Створити захід
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-7 h-7 border-4 border-sand border-t-rose rounded-full animate-spin" /></div>
      ) : events.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-14 h-14 bg-beige rounded-2xl flex items-center justify-center mx-auto mb-4"><Calendar size={24} className="text-warm-light" /></div>
          <p className="text-warm-mid font-medium">Немає заходів</p>
          <p className="text-warm-light text-sm mt-1">Створіть перший захід для спільноти</p>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map(ev => {
            const st = EVENT_STATUS[ev.status] ?? EVENT_STATUS.DRAFT
            const isExpanded = expandedEvent === ev.id
            const sym = CURRENCY_SYMBOL[ev.currency] ?? ev.currency
            return (
              <div key={ev.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${st.cls}`}>{st.label}</span>
                        <span className="text-xs text-warm-light">{format(new Date(ev.date), 'd MMM yyyy', { locale: uk })}</span>
                        {ev.startTime && <span className="text-xs text-warm-light">{ev.startTime}{ev.endTime ? `–${ev.endTime}` : ''}</span>}
                      </div>
                      <p className="font-cormorant text-xl font-semibold text-warm-dark">{ev.title}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-warm-light">{ev.registrations.length} реєстрацій</span>
                        <span className="text-xs text-warm-light">
                          {ev.price === 0 ? 'Безкоштовно' : `${ev.price} ${sym}`}
                        </span>
                        {Array.isArray(ev.priceVariations) && ev.priceVariations.length > 0 && (
                          <span className="text-xs text-warm-light">+{ev.priceVariations.length} варіації</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                      {ev.status === 'DRAFT' && (
                        <button onClick={() => handlePublish(ev.id)} disabled={actionLoading === ev.id + '-publish'}
                          className="text-xs bg-[#E8F5E9] hover:bg-[#C8E6C9] text-[#6A9870] font-medium rounded-xl px-3 py-1.5 transition disabled:opacity-50">
                          Опублікувати
                        </button>
                      )}
                      <button onClick={() => openEdit(ev)}
                        className="text-xs border border-sand text-warm-mid hover:bg-beige rounded-xl px-3 py-1.5 transition">
                        Редагувати
                      </button>
                      <button onClick={() => openMaterials(ev)}
                        className="flex items-center gap-1 text-xs border border-sand text-warm-mid hover:bg-beige rounded-xl px-3 py-1.5 transition">
                        <Video size={12} />Матеріали
                      </button>
                      {ev.status !== 'CANCELLED' && (
                        <button onClick={() => handleCancel(ev.id)} disabled={actionLoading === ev.id + '-cancel'}
                          className="text-xs text-warm-light hover:text-[#A86060] hover:bg-[#FFEBEE] rounded-xl px-3 py-1.5 transition disabled:opacity-50">
                          Скасувати
                        </button>
                      )}
                      <button onClick={() => setExpandedEvent(isExpanded ? null : ev.id)}
                        className="text-warm-light hover:text-warm-dark transition">
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </button>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-sand">
                    {ev.registrations.length === 0 ? (
                      <p className="text-sm text-warm-light italic text-center py-6">Реєстрацій ще немає</p>
                    ) : (
                      <div className="divide-y divide-sand">
                        {ev.registrations.map(reg => {
                          const rs = REG_STATUS[reg.status] ?? REG_STATUS.PENDING
                          return (
                            <div key={reg.id} className="p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-medium text-warm-dark">{reg.user.firstName} {reg.user.lastName}</p>
                                  <p className="text-xs text-warm-light">{reg.user.email}</p>
                                  {reg.user.phone && <p className="text-xs text-warm-light">{reg.user.phone}</p>}
                                  {reg.user.telegram && <p className="text-xs text-warm-light">TG: {reg.user.telegram}</p>}
                                </div>
                                <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${rs.cls}`}>{rs.label}</span>
                              </div>
                              <div className="flex flex-wrap gap-2 mt-3">
                                {reg.status === 'PENDING' && (
                                  <button onClick={() => handleSendPayment(ev.id, reg.id)} disabled={actionLoading === reg.id + '-pay'}
                                    className="text-xs bg-rose hover:bg-[#A06070] disabled:opacity-50 text-white font-medium rounded-lg px-3 py-1.5 transition">
                                    Надіслати реквізити
                                  </button>
                                )}
                                {reg.status === 'RECEIPT_UPLOADED' && (
                                  <>
                                    {reg.paymentReceiptUrl && (
                                      <button onClick={() => openReceipt(ev.id, reg.id, reg.paymentReceiptUrl!)}
                                        className="flex items-center gap-1 text-xs border border-sand text-warm-mid hover:bg-beige rounded-lg px-3 py-1.5 transition">
                                        <FileText size={12} />Квитанція<ExternalLink size={10} />
                                      </button>
                                    )}
                                    <button onClick={() => handleConfirm(ev.id, reg.id)} disabled={actionLoading === reg.id + '-confirm'}
                                      className="text-xs bg-[#E8F5E9] hover:bg-[#C8E6C9] disabled:opacity-50 text-[#6A9870] font-medium rounded-lg px-3 py-1.5 transition">
                                      Підтвердити участь
                                    </button>
                                    <button onClick={() => handleReject(ev.id, reg.id)} disabled={actionLoading === reg.id + '-reject'}
                                      className="text-xs bg-[#FFEBEE] hover:bg-[#FFCDD2] disabled:opacity-50 text-[#A86060] font-medium rounded-lg px-3 py-1.5 transition">
                                      Відхилити
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Create modal ── */}
      {showCreate && (
        <EventFormModal
          title="Новий захід ♡"
          form={createForm} setForm={setCreateForm}
          priceVars={createPriceVars} setPriceVars={setCreatePriceVars}
          reminders={createReminders} setReminders={setCreateReminders}
          coverFile={createCover} setCoverFile={setCreateCover}
          error={createError} saving={createSaving}
          onClose={() => { setShowCreate(false); setCreateForm(emptyForm); setCreatePriceVars([]); setCreateReminders(emptyReminders.map(r => ({ ...r }))); setCreateCover(null); setCreateError('') }}
          onSave={handleCreate}
        />
      )}

      {/* ── Edit modal ── */}
      {editingEvent && (
        <EventFormModal
          title="Редагувати захід ♡"
          isEdit
          hasCover={!!editingEvent.coverImageUrl}
          form={editForm} setForm={setEditForm}
          priceVars={editPriceVars} setPriceVars={setEditPriceVars}
          reminders={editReminders} setReminders={setEditReminders}
          coverFile={editCover} setCoverFile={setEditCover}
          error={editError} saving={editSaving}
          onClose={() => setEditingEvent(null)}
          onSave={handleEdit}
        />
      )}

      {/* ── Materials modal ── */}
      {materialsEvent && (
        <div className="fixed inset-0 bg-black/25 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-[#FFF9F5] rounded-3xl shadow-[0_20px_60px_rgba(160,80,100,0.12)] w-full max-w-md p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-cormorant text-2xl font-semibold text-warm-dark">Матеріали ♡</h3>
                <p className="font-cormorant italic text-warm-mid text-sm truncate max-w-[260px]">{materialsEvent.title}</p>
              </div>
              <button onClick={() => setMaterialsEvent(null)} className="text-warm-light hover:text-warm-mid transition"><X size={20} /></button>
            </div>
            <form onSubmit={handleMaterialsSave} className="space-y-4">
              <div>
                <label className={labelCls}>Zoom-посилання</label>
                <input type="url" value={materialsZoom} onChange={e => setMaterialsZoom(e.target.value)}
                  placeholder="https://zoom.us/j/..." className={inputCls} />
                <p className="text-xs text-warm-light mt-1 italic">Обов'язкове для підтвердження участі</p>
              </div>
              <div>
                <label className={labelCls}>Презентація {materialsEvent.presentationUrl && '(є — можна замінити)'}</label>
                <div onClick={() => presentationRef.current?.click()}
                  onDrop={e => { e.preventDefault(); setPresentationDrag(false); const f = e.dataTransfer.files[0]; if (f) setPresentationFile(f) }}
                  onDragOver={e => { e.preventDefault(); setPresentationDrag(true) }} onDragLeave={() => setPresentationDrag(false)}
                  className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition ${presentationDrag ? 'border-rose bg-rose-lighter' : 'border-sand hover:border-rose-light'}`}>
                  <Upload size={20} className="mx-auto text-warm-light mb-1" />
                  {presentationFile ? <p className="text-sm text-warm-dark font-medium">{presentationFile.name}</p>
                    : <p className="text-sm text-warm-mid">PDF або зображення, до 25 МБ</p>}
                </div>
                <input ref={presentationRef} type="file" accept="application/pdf,image/*"
                  onChange={e => setPresentationFile(e.target.files?.[0] ?? null)} className="hidden" />
              </div>
              {materialsError && <p className="text-[#A86060] text-sm bg-[#F8EEEE] rounded-2xl px-4 py-2.5">{materialsError}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setMaterialsEvent(null)}
                  className="flex-1 border border-sand text-warm-mid hover:bg-beige font-medium rounded-xl py-2.5 text-sm transition">Скасувати</button>
                <button type="submit" disabled={materialsSaving}
                  className="flex-1 bg-rose hover:bg-[#A06070] disabled:opacity-60 text-white font-medium rounded-xl py-2.5 text-sm transition">
                  {materialsSaving ? 'Зберігаємо...' : 'Зберегти'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
