import { useState, useEffect } from 'react'
import { Shield, CheckCircle, XCircle, Calendar, Plus, X, Clock, Users, Search, BookOpen } from 'lucide-react'
import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
import Layout from '../components/Layout'
import api from '../api/axios'

type Tab = 'requests' | 'slots' | 'journal'
type SupervisionType = 'INDIVIDUAL_PRESENTER' | 'INDIVIDUAL_LISTENER' | 'GROUP_PRESENTER' | 'GROUP_LISTENER'
type RecordStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

interface PendingSupervision {
  id: string; date: string; type: SupervisionType; createdAt: string
  user: { id: string; firstName: string; lastName: string }
}

interface PendingSkillsGroup {
  id: string; date: string; hours: number; createdAt: string
  user: { id: string; firstName: string; lastName: string }
}

interface ConductedSupervision {
  id: string; date: string; type: SupervisionType; status: RecordStatus; hours: number; createdAt: string
  user: { id: string; firstName: string; lastName: string; email: string }
}

interface SlotBooking {
  id: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED'
  caseTitle: string | null
  description: string | null
  protocolFileUrl: string | null
  videoUrl: string | null
  comment: string | null
  meetingLink: string | null
  therapist: { id: string; firstName: string; lastName: string; email: string; phone: string | null; telegram: string | null }
}

interface Slot {
  id: string; date: string; time: string; duration: number
  type: 'INDIVIDUAL' | 'GROUP'; notes: string | null
  status: 'AVAILABLE' | 'PENDING' | 'BOOKED' | 'COMPLETED' | 'CANCELLED'
  bookings: SlotBooking[]
}

const TYPE_LABELS: Record<SupervisionType, string> = {
  INDIVIDUAL_PRESENTER: 'Індивідуальна • Подання випадку',
  INDIVIDUAL_LISTENER: 'Індивідуальна • Слухач',
  GROUP_PRESENTER: 'Групова • Подання випадку',
  GROUP_LISTENER: 'Групова • Слухач',
}

const STATUS_STYLES: Record<RecordStatus, { label: string; cls: string }> = {
  PENDING:  { label: 'Очікує',       cls: 'bg-[#FFF3E0] text-[#E6930A]' },
  APPROVED: { label: 'Підтверджено', cls: 'bg-[#E8F5E9] text-[#4CAF50]' },
  REJECTED: { label: 'Відхилено',    cls: 'bg-[#FFEBEE] text-[#E53935]' },
}

function formatHours(h: number) {
  const hrs = Math.floor(h)
  const mins = Math.round((h - hrs) * 60)
  if (mins === 0) return `${hrs} год`
  return `${hrs} год ${mins} хв`
}

const inputClass = 'w-full border border-sand rounded-xl px-4 py-2.5 text-warm-dark text-sm focus:outline-none focus:border-rose focus:ring-1 focus:ring-rose-light transition bg-white'
const labelClass = 'block text-sm font-medium text-warm-mid mb-1.5'

export default function SupervisorPage() {
  const [tab, setTab] = useState<Tab>('requests')

  // ── Requests ──────────────────────────────────────────
  const [supervisions, setSupervisions] = useState<PendingSupervision[]>([])
  const [skillsGroups, setSkillsGroups] = useState<PendingSkillsGroup[]>([])
  const [loadingRequests, setLoadingRequests] = useState(true)
  const [requestsError, setRequestsError] = useState('')
  const [processing, setProcessing] = useState<string | null>(null)
  const [confirmingAll, setConfirmingAll] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get('/supervisions/pending'),
      api.get('/skills-groups/pending'),
    ])
      .then(([supRes, sgRes]) => {
        setSupervisions(supRes.data)
        setSkillsGroups(sgRes.data)
      })
      .catch(err => setRequestsError(err.response?.data?.error || `Помилка (${err.response?.status})`))
      .finally(() => setLoadingRequests(false))
  }, [])

  const handleSupervisionAction = async (id: string, action: 'approve' | 'reject') => {
    setProcessing(id)
    try {
      await api.patch(`/supervisions/${id}/${action}`)
      setSupervisions(prev => prev.filter(s => s.id !== id))
    } catch (err: any) { alert(err.response?.data?.error || 'Помилка') }
    finally { setProcessing(null) }
  }

  const handleSkillsAction = async (id: string, action: 'approve' | 'reject') => {
    setProcessing(id)
    try {
      await api.patch(`/skills-groups/${id}/${action}`)
      setSkillsGroups(prev => prev.filter(s => s.id !== id))
    } catch (err: any) { alert(err.response?.data?.error || 'Помилка') }
    finally { setProcessing(null) }
  }

  const handleConfirmAll = async () => {
    setConfirmingAll(true)
    try {
      await Promise.all([
        api.post('/supervisions/approve-all'),
        api.post('/skills-groups/approve-all'),
      ])
      setSupervisions([])
      setSkillsGroups([])
    } catch (err: any) { alert(err.response?.data?.error || 'Помилка') }
    finally { setConfirmingAll(false) }
  }

  const totalPending = supervisions.length + skillsGroups.length

  // ── Slots ─────────────────────────────────────────────
  const [slots, setSlots] = useState<Slot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [showSlotModal, setShowSlotModal] = useState(false)
  const [slotForm, setSlotForm] = useState({ date: '', time: '', duration: '60', type: 'INDIVIDUAL', notes: '' })
  const [slotSaving, setSlotSaving] = useState(false)
  const [slotError, setSlotError] = useState('')
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  useEffect(() => {
    if (tab === 'slots' && slots.length === 0) {
      setLoadingSlots(true)
      api.get('/slots/my').then(res => setSlots(res.data)).finally(() => setLoadingSlots(false))
    }
  }, [tab])

  const setSlotField = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setSlotForm(prev => ({ ...prev, [f]: e.target.value }))

  const handleCreateSlot = async (e: React.FormEvent) => {
    e.preventDefault(); setSlotError(''); setSlotSaving(true)
    try {
      const res = await api.post('/slots', { date: slotForm.date, time: slotForm.time, duration: Number(slotForm.duration), type: slotForm.type, notes: slotForm.notes || undefined })
      setSlots(prev => [...prev, { ...res.data, bookings: [] }].sort((a, b) => a.date.localeCompare(b.date)))
      setShowSlotModal(false); setSlotForm({ date: '', time: '', duration: '60', type: 'INDIVIDUAL', notes: '' })
    } catch (err: any) { setSlotError(err.response?.data?.error || 'Помилка') }
    finally { setSlotSaving(false) }
  }

  const handleCancelSlot = async (id: string) => {
    setCancellingId(id)
    try {
      await api.delete(`/slots/${id}`)
      setSlots(prev => prev.map(s => s.id === id ? { ...s, status: 'CANCELLED' } : s))
    } catch (err: any) { alert(err.response?.data?.error || 'Помилка') }
    finally { setCancellingId(null) }
  }

  const [bookingProcessing, setBookingProcessing] = useState<string | null>(null)

  const handleApproveBooking = async (bookingId: string, slotId: string) => {
    setBookingProcessing(bookingId)
    try {
      await api.post(`/bookings/${bookingId}/approve`)
      setSlots(prev => prev.map(s => s.id === slotId
        ? { ...s, status: 'BOOKED' as const, bookings: s.bookings.map(b => b.id === bookingId ? { ...b, status: 'APPROVED' as const } : b) }
        : s
      ))
    } catch (err: any) { alert(err.response?.data?.error || 'Помилка') }
    finally { setBookingProcessing(null) }
  }

  const handleRejectBooking = async (bookingId: string, slotId: string) => {
    setBookingProcessing(bookingId)
    try {
      await api.post(`/bookings/${bookingId}/reject`)
      setSlots(prev => prev.map(s => s.id === slotId
        ? { ...s, status: 'AVAILABLE' as const, bookings: s.bookings.map(b => b.id === bookingId ? { ...b, status: 'REJECTED' as const } : b) }
        : s
      ))
    } catch (err: any) { alert(err.response?.data?.error || 'Помилка') }
    finally { setBookingProcessing(null) }
  }

  const handleCompleteBooking = async (bookingId: string, slotId: string) => {
    setBookingProcessing(bookingId)
    try {
      await api.post(`/bookings/${bookingId}/complete`)
      setSlots(prev => prev.map(s => s.id === slotId
        ? { ...s, status: 'COMPLETED' as const, bookings: s.bookings.map(b => b.id === bookingId ? { ...b, status: 'COMPLETED' as const } : b) }
        : s
      ))
    } catch (err: any) { alert(err.response?.data?.error || 'Помилка') }
    finally { setBookingProcessing(null) }
  }


  const statusBadge: Record<string, string> = {
    AVAILABLE: 'bg-[#E8F5E9] text-[#4CAF50]',
    PENDING: 'bg-[#FFF3E0] text-[#E6930A]',
    BOOKED: 'bg-rose-light text-rose',
    COMPLETED: 'bg-[#E3F2FD] text-[#1976D2]',
    CANCELLED: 'bg-sand text-warm-light',
  }
  const statusLabel: Record<string, string> = {
    AVAILABLE: 'Вільний', PENDING: 'Очікує заявки', BOOKED: 'Заброньований',
    COMPLETED: 'Завершено', CANCELLED: 'Скасований',
  }

  // ── Journal ───────────────────────────────────────────
  const [journal, setJournal] = useState<ConductedSupervision[]>([])
  const [loadingJournal, setLoadingJournal] = useState(false)
  const [journalLoaded, setJournalLoaded] = useState(false)
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (tab === 'journal' && !journalLoaded) {
      loadJournal()
    }
  }, [tab])

  const loadJournal = () => {
    setLoadingJournal(true)
    const params = new URLSearchParams()
    if (filterType) params.set('type', filterType)
    if (filterStatus) params.set('status', filterStatus)
    if (filterDateFrom) params.set('dateFrom', filterDateFrom)
    if (filterDateTo) params.set('dateTo', filterDateTo)
    api.get(`/supervisions/conducted?${params}`)
      .then(res => { setJournal(res.data); setJournalLoaded(true) })
      .catch(() => {})
      .finally(() => setLoadingJournal(false))
  }

  const applyFilters = () => { setJournalLoaded(false); loadJournal() }
  const resetFilters = () => {
    setFilterType(''); setFilterStatus(''); setFilterDateFrom(''); setFilterDateTo(''); setSearch('')
    setJournalLoaded(false)
    setLoadingJournal(true)
    api.get('/supervisions/conducted').then(res => { setJournal(res.data); setJournalLoaded(true) }).finally(() => setLoadingJournal(false))
  }

  const filteredJournal = journal.filter(s => {
    if (!search) return true
    const q = search.toLowerCase()
    return `${s.user.firstName} ${s.user.lastName}`.toLowerCase().includes(q) || s.user.email.toLowerCase().includes(q)
  })

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="font-cormorant text-3xl text-warm-dark font-semibold">Супервізор ♡</h1>
        {totalPending > 0 && !loadingRequests && (
          <p className="font-cormorant italic text-warm-mid mt-0.5">{totalPending} заявок очікують підтвердження</p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-sand mb-6 overflow-x-auto">
        {([
          { key: 'requests', label: totalPending > 0 ? `Заявки (${totalPending})` : 'Заявки' },
          { key: 'slots', label: 'Мої слоти' },
          { key: 'journal', label: 'Журнал супервізій' },
        ] as { key: Tab; label: string }[]).map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`pb-3 text-sm font-medium transition whitespace-nowrap ${tab === key ? 'border-b-2 border-rose text-rose' : 'text-warm-mid hover:text-warm-dark'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Requests ── */}
      {tab === 'requests' && (
        loadingRequests ? <div className="flex justify-center py-16"><div className="w-7 h-7 border-4 border-sand border-t-rose rounded-full animate-spin" /></div>
        : requestsError ? <div className="bg-red-50 text-red-500 rounded-2xl px-5 py-4 text-sm max-w-lg">{requestsError}</div>
        : totalPending === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 bg-beige rounded-2xl flex items-center justify-center mx-auto mb-4"><Shield size={24} className="text-warm-light" /></div>
            <p className="text-warm-mid font-medium">Немає заявок на підтвердження</p>
            <p className="text-warm-light text-sm mt-1">Нові заявки з'являться тут</p>
          </div>
        ) : (
          <div className="max-w-2xl">
            {/* Confirm All button */}
            <div className="flex justify-end mb-4">
              <button
                onClick={handleConfirmAll}
                disabled={confirmingAll}
                className="flex items-center gap-2 bg-[#E8F5E9] hover:bg-[#C8E6C9] disabled:opacity-50 text-[#4CAF50] font-medium text-sm rounded-xl px-5 py-2.5 transition"
              >
                <CheckCircle size={16} />
                {confirmingAll ? 'Підтверджуємо...' : `Підтвердити все (${totalPending})`}
              </button>
            </div>

            {/* Supervisions */}
            {supervisions.length > 0 && (
              <div className="mb-5">
                <p className="text-xs text-warm-light uppercase tracking-widest font-medium mb-3">Супервізії</p>
                <div className="space-y-3">
                  {supervisions.map(s => (
                    <div key={s.id} className="bg-white rounded-2xl shadow-sm p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-warm-dark">{s.user.firstName} {s.user.lastName}</p>
                          <p className="text-xs text-warm-light mt-0.5">{TYPE_LABELS[s.type]}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-xs text-warm-mid">Сесія: {format(new Date(s.date), 'd MMM yyyy', { locale: uk })}</span>
                            <span className="text-warm-light text-xs">•</span>
                            <span className="text-xs text-warm-light">Подано: {format(new Date(s.createdAt), 'd MMM yyyy', { locale: uk })}</span>
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button onClick={() => handleSupervisionAction(s.id, 'approve')} disabled={processing === s.id}
                            className="flex items-center gap-1.5 bg-[#E8F5E9] hover:bg-[#C8E6C9] disabled:opacity-50 text-[#4CAF50] text-sm font-medium rounded-xl px-4 py-2 transition">
                            <CheckCircle size={15} />Підтвердити
                          </button>
                          <button onClick={() => handleSupervisionAction(s.id, 'reject')} disabled={processing === s.id}
                            className="flex items-center gap-1.5 bg-[#FFEBEE] hover:bg-[#FFCDD2] disabled:opacity-50 text-[#E53935] text-sm font-medium rounded-xl px-4 py-2 transition">
                            <XCircle size={15} />Відхилити
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Skills Groups */}
            {skillsGroups.length > 0 && (
              <div>
                <p className="text-xs text-warm-light uppercase tracking-widest font-medium mb-3">Групи навичок</p>
                <div className="space-y-3">
                  {skillsGroups.map(s => (
                    <div key={s.id} className="bg-white rounded-2xl shadow-sm p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <BookOpen size={14} className="text-rose shrink-0" />
                            <p className="text-sm font-medium text-warm-dark">{s.user.firstName} {s.user.lastName}</p>
                          </div>
                          <p className="text-xs text-warm-light mt-0.5">Група навичок • {formatHours(s.hours)}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-xs text-warm-mid">Дата: {format(new Date(s.date), 'd MMM yyyy', { locale: uk })}</span>
                            <span className="text-warm-light text-xs">•</span>
                            <span className="text-xs text-warm-light">Подано: {format(new Date(s.createdAt), 'd MMM yyyy', { locale: uk })}</span>
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button onClick={() => handleSkillsAction(s.id, 'approve')} disabled={processing === s.id}
                            className="flex items-center gap-1.5 bg-[#E8F5E9] hover:bg-[#C8E6C9] disabled:opacity-50 text-[#4CAF50] text-sm font-medium rounded-xl px-4 py-2 transition">
                            <CheckCircle size={15} />Підтвердити
                          </button>
                          <button onClick={() => handleSkillsAction(s.id, 'reject')} disabled={processing === s.id}
                            className="flex items-center gap-1.5 bg-[#FFEBEE] hover:bg-[#FFCDD2] disabled:opacity-50 text-[#E53935] text-sm font-medium rounded-xl px-4 py-2 transition">
                            <XCircle size={15} />Відхилити
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      )}

      {/* ── Slots ── */}
      {tab === 'slots' && (
        <div className="max-w-2xl">
          <div className="flex justify-end mb-4">
            <button onClick={() => setShowSlotModal(true)}
              className="flex items-center gap-2 bg-rose hover:bg-[#B5745A] text-white font-medium rounded-xl px-5 py-2.5 text-sm transition">
              <Plus size={16} />Додати слот
            </button>
          </div>
          {loadingSlots ? (
            <div className="flex justify-center py-16"><div className="w-7 h-7 border-4 border-sand border-t-rose rounded-full animate-spin" /></div>
          ) : slots.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-14 h-14 bg-beige rounded-2xl flex items-center justify-center mx-auto mb-4"><Calendar size={24} className="text-warm-light" /></div>
              <p className="text-warm-mid font-medium">Немає слотів</p>
              <p className="text-warm-light text-sm mt-1">Натисніть «Додати слот», щоб виставити вільний час</p>
            </div>
          ) : (
            <div className="space-y-4">
              {slots.map(slot => {
                const today = new Date().toISOString().slice(0, 10)
                const isPast = slot.date < today
                const activeBooking = slot.bookings.find(b => b.status === 'PENDING' || b.status === 'APPROVED')
                return (
                  <div key={slot.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    {/* Slot header */}
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusBadge[slot.status]}`}>{statusLabel[slot.status]}</span>
                            <span className="text-xs text-warm-light">{slot.type === 'INDIVIDUAL' ? 'Індивідуальна' : 'Групова'}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-4">
                            <div className="flex items-center gap-1.5 text-sm text-warm-dark font-medium"><Calendar size={13} className="text-warm-light" />{slot.date}</div>
                            <div className="flex items-center gap-1.5 text-sm text-warm-mid"><Clock size={13} className="text-warm-light" />{slot.time} · {slot.duration} хв</div>
                          </div>
                          {slot.notes && <p className="text-xs text-warm-light mt-2 italic">{slot.notes}</p>}
                        </div>
                        {(slot.status === 'AVAILABLE' || slot.status === 'PENDING') && (
                          <button onClick={() => handleCancelSlot(slot.id)} disabled={cancellingId === slot.id}
                            className="flex items-center gap-1.5 text-warm-light hover:text-[#E53935] text-sm rounded-xl px-3 py-1.5 hover:bg-[#FFEBEE] transition disabled:opacity-50 shrink-0">
                            <X size={14} />Скасувати
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Active booking card */}
                    {activeBooking && (
                      <div className="border-t border-sand mx-5 pt-4 pb-5">
                        <p className="text-xs text-warm-light uppercase tracking-widest font-medium mb-3">
                          {activeBooking.status === 'PENDING' ? 'Заявка на розгляд' : 'Підтверджена заявка'}
                        </p>
                        <div className="bg-beige rounded-xl p-4 space-y-2">
                          <div className="flex items-center gap-2">
                            <Users size={13} className="text-warm-light shrink-0" />
                            <span className="text-sm font-medium text-warm-dark">
                              {activeBooking.therapist.firstName} {activeBooking.therapist.lastName}
                            </span>
                            <span className="text-xs text-warm-light">{activeBooking.therapist.email}</span>
                          </div>
                          {activeBooking.therapist.phone && (
                            <p className="text-xs text-warm-mid pl-5">{activeBooking.therapist.phone}</p>
                          )}
                          {activeBooking.caseTitle ? (
                            <p className="text-sm font-medium text-warm-dark pt-1">📌 {activeBooking.caseTitle}</p>
                          ) : (
                            <p className="text-xs text-warm-light italic pt-1">Терапевт ще не заповнив деталі випадку</p>
                          )}
                          {activeBooking.description && (
                            <p className="text-xs text-warm-mid leading-relaxed">{activeBooking.description}</p>
                          )}
                          {activeBooking.videoUrl && (
                            <a href={activeBooking.videoUrl} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-rose hover:opacity-80 transition flex items-center gap-1">
                              🎥 Відео сесії
                            </a>
                          )}
                          {activeBooking.protocolFileUrl && (
                            <a href={activeBooking.protocolFileUrl} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-rose hover:opacity-80 transition flex items-center gap-1">
                              📄 Переглянути протокол
                            </a>
                          )}
                          {activeBooking.comment && (
                            <p className="text-xs text-warm-light italic">💬 {activeBooking.comment}</p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 mt-3">
                          {activeBooking.status === 'PENDING' && (
                            <>
                              <button onClick={() => handleApproveBooking(activeBooking.id, slot.id)}
                                disabled={bookingProcessing === activeBooking.id}
                                className="flex items-center gap-1.5 bg-[#E8F5E9] hover:bg-[#C8E6C9] disabled:opacity-50 text-[#4CAF50] text-sm font-medium rounded-xl px-4 py-2 transition">
                                <CheckCircle size={14} />Підтвердити
                              </button>
                              <button onClick={() => handleRejectBooking(activeBooking.id, slot.id)}
                                disabled={bookingProcessing === activeBooking.id}
                                className="flex items-center gap-1.5 bg-[#FFEBEE] hover:bg-[#FFCDD2] disabled:opacity-50 text-[#E53935] text-sm font-medium rounded-xl px-4 py-2 transition">
                                <XCircle size={14} />Відхилити
                              </button>
                            </>
                          )}
                          {activeBooking.status === 'APPROVED' && isPast && (
                            <button onClick={() => handleCompleteBooking(activeBooking.id, slot.id)}
                              disabled={bookingProcessing === activeBooking.id}
                              className="flex items-center gap-1.5 bg-[#E3F2FD] hover:bg-[#BBDEFB] disabled:opacity-50 text-[#1976D2] text-sm font-medium rounded-xl px-4 py-2 transition">
                              <CheckCircle size={14} />Завершити сесію
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Journal ── */}
      {tab === 'journal' && (
        <div className="max-w-3xl">
          {/* Filters */}
          <div className="bg-white rounded-2xl shadow-sm p-5 mb-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <div>
                <label className={labelClass}>Тип</label>
                <select value={filterType} onChange={e => setFilterType(e.target.value)} className={inputClass}>
                  <option value="">Усі типи</option>
                  <option value="INDIVIDUAL_PRESENTER">Індив. • Подання</option>
                  <option value="INDIVIDUAL_LISTENER">Індив. • Слухач</option>
                  <option value="GROUP_PRESENTER">Групова • Подання</option>
                  <option value="GROUP_LISTENER">Групова • Слухач</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Статус</label>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={inputClass}>
                  <option value="">Усі статуси</option>
                  <option value="PENDING">Очікує</option>
                  <option value="APPROVED">Підтверджено</option>
                  <option value="REJECTED">Відхилено</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Дата від</label>
                <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Дата до</label>
                <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className={inputClass} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-warm-light" />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Пошук за іменем або email..."
                  className={inputClass + ' pl-9'} />
              </div>
              <button onClick={applyFilters} className="bg-rose hover:bg-[#B5745A] text-white text-sm font-medium rounded-xl px-4 py-2.5 transition whitespace-nowrap">
                Застосувати
              </button>
              <button onClick={resetFilters} className="border border-sand text-warm-mid hover:bg-beige text-sm font-medium rounded-xl px-4 py-2.5 transition whitespace-nowrap">
                Скинути
              </button>
            </div>
          </div>

          {/* Results */}
          {loadingJournal ? (
            <div className="flex justify-center py-16"><div className="w-7 h-7 border-4 border-sand border-t-rose rounded-full animate-spin" /></div>
          ) : filteredJournal.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-14 h-14 bg-beige rounded-2xl flex items-center justify-center mx-auto mb-4"><Shield size={24} className="text-warm-light" /></div>
              <p className="text-warm-mid font-medium">Немає записів</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-warm-light mb-3">Знайдено: {filteredJournal.length} записів</p>
              <div className="space-y-3">
                {filteredJournal.map(s => {
                  const st = STATUS_STYLES[s.status]
                  return (
                    <div key={s.id} className="bg-white rounded-2xl shadow-sm p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-medium text-warm-dark">{s.user.firstName} {s.user.lastName}</p>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                          </div>
                          <p className="text-xs text-warm-light">{s.user.email}</p>
                          <p className="text-xs text-warm-mid mt-1">{TYPE_LABELS[s.type]}</p>
                          <div className="flex items-center gap-4 mt-2">
                            <span className="flex items-center gap-1 text-xs text-warm-light">
                              <Calendar size={11} />{format(new Date(s.date), 'd MMM yyyy', { locale: uk })}
                            </span>
                            {(s.type === 'GROUP_PRESENTER' || s.type === 'GROUP_LISTENER') && (
                              <span className="flex items-center gap-1 text-xs text-warm-light">
                                <Clock size={11} />{formatHours(s.hours)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Add Slot Modal ── */}
      {showSlotModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-cormorant text-2xl font-semibold text-warm-dark">Новий слот ♡</h3>
                <p className="font-cormorant italic text-warm-mid text-sm">Додайте вільний час</p>
              </div>
              <button onClick={() => setShowSlotModal(false)} className="text-warm-light hover:text-warm-mid transition"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateSlot} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelClass}>Дата</label><input type="date" value={slotForm.date} onChange={setSlotField('date')} required className={inputClass} /></div>
                <div><label className={labelClass}>Час</label><input type="time" value={slotForm.time} onChange={setSlotField('time')} required className={inputClass} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Тривалість</label>
                  <select value={slotForm.duration} onChange={setSlotField('duration')} className={inputClass}>
                    {[30, 45, 60, 90, 120].map(d => <option key={d} value={d}>{d} хв</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Тип</label>
                  <select value={slotForm.type} onChange={setSlotField('type')} className={inputClass}>
                    <option value="INDIVIDUAL">Індивідуальна</option>
                    <option value="GROUP">Групова</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={labelClass}>Нотатки (необов'язково)</label>
                <textarea value={slotForm.notes} onChange={setSlotField('notes')} rows={2} placeholder="Додаткова інформація..." className={inputClass + ' resize-none'} />
              </div>
              {slotError && <p className="text-red-500 text-sm bg-red-50 rounded-xl px-4 py-2.5">{slotError}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowSlotModal(false)} className="flex-1 border border-sand text-warm-mid hover:bg-beige font-medium rounded-xl py-2.5 text-sm transition">Скасувати</button>
                <button type="submit" disabled={slotSaving} className="flex-1 bg-rose hover:bg-[#B5745A] disabled:opacity-60 text-white font-medium rounded-xl py-2.5 text-sm transition">{slotSaving ? 'Зберігаємо...' : 'Створити'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}
