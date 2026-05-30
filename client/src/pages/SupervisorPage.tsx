import { useState, useEffect, useRef } from 'react'
import { Shield, CheckCircle, XCircle, Calendar, Plus, X, Clock, Users, Search, BookOpen, ChevronDown, ChevronUp } from 'lucide-react'
import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import api from '../api/axios'

type Tab = 'requests' | 'slots' | 'groups' | 'journal'
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

interface IncomingBooking {
  id: string
  status: 'PENDING' | 'APPROVED'
  therapist: { firstName: string; lastName: string; telegram: string | null }
  slot: { date: string; time: string; duration: number; type: 'INDIVIDUAL' | 'GROUP' }
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

  // ── Upcoming bookings (for supervisor) ────────────────
  const [upcomingBookings, setUpcomingBookings] = useState<IncomingBooking[]>([])

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    api.get('/bookings/incoming')
      .then(res => {
        const upcoming = (res.data as IncomingBooking[])
          .filter(b => b.slot.date >= today && (b.status === 'PENDING' || b.status === 'APPROVED'))
          .sort((a, b) => a.slot.date.localeCompare(b.slot.date) || a.slot.time.localeCompare(b.slot.time))
        setUpcomingBookings(upcoming)
      })
      .catch(() => {})
  }, [])

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


  // ── Group Supervisions ────────────────────────────────
  interface GroupParticipant {
    id: string; userId: string; isPresenter: boolean
    paymentStatus: 'PENDING' | 'RECEIPT_UPLOADED' | 'CONFIRMED' | 'FREE'
    paymentReceiptUrl: string | null
    user: { id: string; firstName: string; lastName: string; email: string; telegram: string | null }
  }
  interface GroupSupervision {
    id: string; title: string; description: string | null
    scheduledDate: string; scheduledTime: string; duration: number
    price: number; currency: string
    paymentInstructions: string | null; zoomLink: string | null; zoomPassword: string | null
    status: 'WAITING_FOR_CASE' | 'CASE_CONFIRMED' | 'REGISTRATION_OPEN' | 'REGISTRATION_CLOSED' | 'WAITING_FOR_RECORDING' | 'RECORDING_AVAILABLE' | 'COMPLETED'
    caseTitle: string | null; caseDescription: string | null
    protocolFileUrl: string | null; caseVideoUrl: string | null
    recordingUrl: string | null; recordingExpiresAt: string | null
    presenterUser: { id: string; firstName: string; lastName: string } | null
    participants: GroupParticipant[]
  }

  const [groups, setGroups] = useState<GroupSupervision[]>([])
  const [loadingGroups, setLoadingGroups] = useState(false)
  const [groupsLoaded, setGroupsLoaded] = useState(false)
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [groupSaving, setGroupSaving] = useState(false)
  const [groupError, setGroupError] = useState('')
  const [groupForm, setGroupForm] = useState({
    title: '', description: '', scheduledDate: '', scheduledTime: '', endTime: '',
    price: '0', currency: 'UAH',
    paymentInstructions: '', zoomLink: '',
  })
  const [openRegForm, setOpenRegForm] = useState<{ groupId: string; paymentInstructions: string; zoomLink: string; zoomPassword: string } | null>(null)
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)
  const [groupProcessing, setGroupProcessing] = useState<string | null>(null)
  const recordingInputRef = useRef<HTMLInputElement>(null)
  const [recordingForm, setRecordingForm] = useState<{ id: string; url: string; expiresAt: string } | null>(null)

  useEffect(() => {
    if (tab === 'groups' && !groupsLoaded) {
      setLoadingGroups(true)
      api.get('/group-supervisions')
        .then(res => { setGroups(res.data); setGroupsLoaded(true) })
        .catch(() => {})
        .finally(() => setLoadingGroups(false))
    }
  }, [tab])

  const setGroupField = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setGroupForm(prev => ({ ...prev, [f]: e.target.value }))

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault(); setGroupError(''); setGroupSaving(true)
    try {
      const [sh, sm] = groupForm.scheduledTime.split(':').map(Number)
      const [eh, em] = groupForm.endTime.split(':').map(Number)
      const duration = (eh * 60 + em) - (sh * 60 + sm)
      if (duration <= 0) { setGroupError('Час завершення має бути після часу початку'); setGroupSaving(false); return }
      const res = await api.post('/group-supervisions', {
        title: groupForm.title,
        description: groupForm.description || undefined,
        scheduledDate: groupForm.scheduledDate,
        scheduledTime: groupForm.scheduledTime,
        duration,
        price: Number(groupForm.price),
        currency: groupForm.currency,
        paymentInstructions: groupForm.paymentInstructions || undefined,
        zoomLink: groupForm.zoomLink || undefined,
      })
      setGroups(prev => [res.data, ...prev])
      setShowGroupModal(false)
      setGroupForm({ title: '', description: '', scheduledDate: '', scheduledTime: '', endTime: '', price: '0', currency: 'UAH', paymentInstructions: '', zoomLink: '' })
    } catch (err: any) { setGroupError(err.response?.data?.error || 'Помилка') }
    finally { setGroupSaving(false) }
  }

  const handleGroupStatusChange = async (groupId: string, action: string) => {
    setGroupProcessing(groupId)
    try {
      const res = await api.post(`/group-supervisions/${groupId}/${action}`)
      setGroups(prev => prev.map(g => g.id === groupId ? { ...g, status: res.data.status } : g))
    } catch (err: any) { alert(err.response?.data?.error || 'Помилка') }
    finally { setGroupProcessing(null) }
  }

  const handleOpenRegistration = async (groupId: string) => {
    if (!openRegForm) return
    setGroupProcessing(groupId)
    try {
      const res = await api.post(`/group-supervisions/${groupId}/open-registration`, {
        paymentInstructions: openRegForm.paymentInstructions || undefined,
        zoomLink: openRegForm.zoomLink || undefined,
        zoomPassword: openRegForm.zoomPassword || undefined,
      })
      setGroups(prev => prev.map(g => g.id === groupId
        ? { ...g, status: res.data.status, paymentInstructions: res.data.paymentInstructions, zoomLink: res.data.zoomLink }
        : g
      ))
      setOpenRegForm(null)
    } catch (err: any) { alert(err.response?.data?.error || 'Помилка') }
    finally { setGroupProcessing(null) }
  }


  const handleSetRecording = async () => {
    if (!recordingForm) return
    setGroupProcessing(recordingForm.id)
    try {
      const res = await api.post(`/group-supervisions/${recordingForm.id}/set-recording`, {
        recordingUrl: recordingForm.url,
        recordingExpiresAt: recordingForm.expiresAt || undefined,
      })
      setGroups(prev => prev.map(g => g.id === recordingForm.id ? { ...g, status: res.data.status, recordingUrl: res.data.recordingUrl, recordingExpiresAt: res.data.recordingExpiresAt } : g))
      setRecordingForm(null)
    } catch (err: any) { alert(err.response?.data?.error || 'Помилка') }
    finally { setGroupProcessing(null) }
  }

  const handleCompleteGroup = async (groupId: string) => {
    if (!confirm('Завершити групову супервізію та додати записи до журналів учасників?')) return
    setGroupProcessing(groupId)
    try {
      await api.post(`/group-supervisions/${groupId}/complete`)
      setGroups(prev => prev.map(g => g.id === groupId ? { ...g, status: 'COMPLETED' } : g))
    } catch (err: any) { alert(err.response?.data?.error || 'Помилка') }
    finally { setGroupProcessing(null) }
  }

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('Видалити цю групову супервізію?')) return
    setGroupProcessing(groupId)
    try {
      await api.delete(`/group-supervisions/${groupId}`)
      setGroups(prev => prev.filter(g => g.id !== groupId))
    } catch (err: any) { alert(err.response?.data?.error || 'Помилка') }
    finally { setGroupProcessing(null) }
  }

  const handleConfirmPayment = async (groupId: string, participantId: string) => {
    setGroupProcessing(participantId)
    try {
      const res = await api.post(`/group-supervisions/${groupId}/participants/${participantId}/confirm-payment`)
      setGroups(prev => prev.map(g => g.id === groupId
        ? { ...g, participants: g.participants.map(p => p.id === participantId ? { ...p, paymentStatus: res.data.paymentStatus } : p) }
        : g
      ))
    } catch (err: any) { alert(err.response?.data?.error || 'Помилка') }
    finally { setGroupProcessing(null) }
  }

  const handleRejectPayment = async (groupId: string, participantId: string) => {
    setGroupProcessing(participantId)
    try {
      const res = await api.post(`/group-supervisions/${groupId}/participants/${participantId}/reject-payment`)
      setGroups(prev => prev.map(g => g.id === groupId
        ? { ...g, participants: g.participants.map(p => p.id === participantId ? { ...p, paymentStatus: res.data.paymentStatus, paymentReceiptUrl: null } : p) }
        : g
      ))
    } catch (err: any) { alert(err.response?.data?.error || 'Помилка') }
    finally { setGroupProcessing(null) }
  }

  const GROUP_STATUS_LABELS: Record<string, string> = {
    WAITING_FOR_CASE: 'Очікує супервізанта',
    CASE_CONFIRMED: 'Супервізанта визначено',
    REGISTRATION_OPEN: 'Реєстрація відкрита',
    REGISTRATION_CLOSED: 'Реєстрація закрита',
    WAITING_FOR_RECORDING: 'Очікує запис',
    RECORDING_AVAILABLE: 'Запис доступний',
    COMPLETED: 'Завершено',
  }
  const GROUP_STATUS_BADGE: Record<string, string> = {
    WAITING_FOR_CASE: 'bg-[#FFF3E0] text-[#E6930A]',
    CASE_CONFIRMED: 'bg-[#E3F2FD] text-[#1976D2]',
    REGISTRATION_OPEN: 'bg-[#E8F5E9] text-[#4CAF50]',
    REGISTRATION_CLOSED: 'bg-sand text-warm-mid',
    WAITING_FOR_RECORDING: 'bg-[#FFF3E0] text-[#E6930A]',
    RECORDING_AVAILABLE: 'bg-[#E8F5E9] text-[#4CAF50]',
    COMPLETED: 'bg-[#E3F2FD] text-[#1976D2]',
  }
  const PAYMENT_BADGE: Record<string, { label: string; cls: string }> = {
    PENDING: { label: 'Очікує оплату', cls: 'bg-[#FFF3E0] text-[#E6930A]' },
    RECEIPT_UPLOADED: { label: 'Квитанція завантажена', cls: 'bg-[#E3F2FD] text-[#1976D2]' },
    CONFIRMED: { label: 'Оплачено', cls: 'bg-[#E8F5E9] text-[#4CAF50]' },
    FREE: { label: 'Безкоштовно', cls: 'bg-[#F3E5F5] text-[#7B1FA2]' },
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

      {/* Upcoming booked sessions */}
      {upcomingBookings.length > 0 && (
        <div className="max-w-2xl mb-6 space-y-2">
          <p className="text-xs text-warm-light uppercase tracking-widest font-medium">Заплановані сесії</p>
          {upcomingBookings.map(b => {
            const tgLink = b.therapist.telegram
              ? `https://t.me/${b.therapist.telegram.replace('@', '')}`
              : null
            return (
              <div key={b.id} className="bg-gradient-to-r from-[#FDF0EC] to-beige rounded-2xl p-4 border border-rose-light flex items-center justify-between gap-4">
                <div>
                  <div className="flex flex-wrap gap-3 text-xs text-warm-mid mb-1">
                    <span className="text-warm-dark font-medium">{b.slot.date}</span>
                    <span>{b.slot.time} · {b.slot.duration} хв</span>
                    <span className="bg-rose-light text-rose px-2 py-0.5 rounded-full">
                      {b.slot.type === 'INDIVIDUAL' ? 'Індивідуальна' : 'Групова'}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-warm-dark">
                    {b.therapist.firstName} {b.therapist.lastName}
                  </p>
                </div>
                {tgLink && (
                  <a href={tgLink} target="_blank" rel="noopener noreferrer"
                    className="shrink-0 flex items-center gap-1.5 bg-[#229ED9] hover:bg-[#1a8bc2] text-white text-xs font-medium px-3 py-1.5 rounded-xl transition">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.26 14.4l-2.95-.924c-.64-.203-.658-.64.135-.954l11.57-4.461c.537-.194 1.006.131.88.16z"/>
                    </svg>
                    Написати
                  </a>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-6 border-b border-sand mb-6 overflow-x-auto">
        {([
          { key: 'requests', label: totalPending > 0 ? `Заявки (${totalPending})` : 'Заявки' },
          { key: 'slots', label: 'Мої слоти' },
          { key: 'groups', label: 'Групові' },
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

      {/* ── Groups ── */}
      {tab === 'groups' && (
        <div className="max-w-2xl">
          <div className="flex justify-end mb-4">
            <button onClick={() => setShowGroupModal(true)}
              className="flex items-center gap-2 bg-rose hover:bg-[#B5745A] text-white font-medium rounded-xl px-5 py-2.5 text-sm transition">
              <Plus size={16} />Створити групову
            </button>
          </div>

          {loadingGroups ? (
            <div className="flex justify-center py-16"><div className="w-7 h-7 border-4 border-sand border-t-rose rounded-full animate-spin" /></div>
          ) : groups.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-14 h-14 bg-beige rounded-2xl flex items-center justify-center mx-auto mb-4"><Users size={24} className="text-warm-light" /></div>
              <p className="text-warm-mid font-medium">Немає групових супервізій</p>
              <p className="text-warm-light text-sm mt-1">Натисніть «Створити групову», щоб розпочати</p>
            </div>
          ) : (
            <div className="space-y-4">
              {groups.map(group => {
                const isExpanded = expandedGroup === group.id
                const today = new Date().toISOString().slice(0, 10)
                const isPast = group.scheduledDate < today
                return (
                  <div key={group.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    {/* Header */}
                    <div className="p-5">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${GROUP_STATUS_BADGE[group.status]}`}>
                              {GROUP_STATUS_LABELS[group.status]}
                            </span>
                            <span className="text-xs text-warm-light">{group.participants.length} учасників</span>
                          </div>
                          <h3 className="font-cormorant text-lg font-semibold text-warm-dark">{group.title}</h3>
                          <div className="flex flex-wrap gap-3 mt-1 text-xs text-warm-mid">
                            <span className="flex items-center gap-1"><Calendar size={11} />{group.scheduledDate}</span>
                            <span className="flex items-center gap-1"><Clock size={11} />{group.scheduledTime} · {group.duration} хв</span>
                            {group.price > 0 && <span>{group.price} {group.currency}</span>}
                          </div>
                          {group.caseTitle && (
                            <p className="text-xs text-warm-mid mt-1.5">📌 {group.caseTitle}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Link to={`/group-supervisions/${group.id}`}
                            className="text-xs text-rose hover:opacity-80 font-medium transition">
                            Деталі →
                          </Link>
                          <button onClick={() => setExpandedGroup(isExpanded ? null : group.id)}
                            className="text-warm-light hover:text-warm-mid transition">
                            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Expanded management panel */}
                    {isExpanded && (
                      <div className="border-t border-sand px-5 py-4 space-y-4">

                        {/* Status actions */}
                        <div className="flex flex-wrap gap-2">
                          {group.status === 'CASE_CONFIRMED' && openRegForm?.groupId !== group.id && (
                            <button onClick={() => setOpenRegForm({ groupId: group.id, paymentInstructions: group.paymentInstructions || '', zoomLink: group.zoomLink || '', zoomPassword: group.zoomPassword || '' })}
                              className="flex items-center gap-1.5 bg-[#E8F5E9] hover:bg-[#C8E6C9] text-[#4CAF50] text-xs font-medium rounded-xl px-3 py-2 transition">
                              <CheckCircle size={13} />Відкрити реєстрацію
                            </button>
                          )}
                          {group.status === 'REGISTRATION_OPEN' && (
                            <button onClick={() => handleGroupStatusChange(group.id, 'close-registration')}
                              disabled={groupProcessing === group.id}
                              className="flex items-center gap-1.5 bg-sand hover:bg-[#E8E0D8] text-warm-mid text-xs font-medium rounded-xl px-3 py-2 transition">
                              Закрити реєстрацію
                            </button>
                          )}
                          {(group.status === 'WAITING_FOR_RECORDING' || group.status === 'REGISTRATION_CLOSED') && (
                            <button onClick={() => setRecordingForm({ id: group.id, url: group.recordingUrl || '', expiresAt: '' })}
                              className="flex items-center gap-1.5 bg-[#E3F2FD] hover:bg-[#BBDEFB] text-[#1976D2] text-xs font-medium rounded-xl px-3 py-2 transition">
                              🎬 Додати запис
                            </button>
                          )}
                          {(group.status === 'RECORDING_AVAILABLE' || (isPast && group.status !== 'COMPLETED')) && (
                            <button onClick={() => handleCompleteGroup(group.id)}
                              disabled={groupProcessing === group.id}
                              className="flex items-center gap-1.5 bg-[#E8F5E9] hover:bg-[#C8E6C9] disabled:opacity-50 text-[#4CAF50] text-xs font-medium rounded-xl px-3 py-2 transition">
                              <CheckCircle size={13} />Завершити
                            </button>
                          )}
                          {group.status === 'WAITING_FOR_CASE' && (
                            <button onClick={() => handleDeleteGroup(group.id)}
                              disabled={groupProcessing === group.id}
                              className="flex items-center gap-1.5 bg-[#FFEBEE] hover:bg-[#FFCDD2] disabled:opacity-50 text-[#E53935] text-xs font-medium rounded-xl px-3 py-2 transition">
                              <X size={13} />Видалити
                            </button>
                          )}
                        </div>

                        {/* Inline open-registration form */}
                        {group.status === 'CASE_CONFIRMED' && openRegForm?.groupId === group.id && (
                          <div className="bg-beige rounded-xl p-4 space-y-3">
                            <p className="text-xs font-medium text-warm-mid uppercase tracking-widest">Відкрити реєстрацію</p>
                            {Number(group.price) > 0 && (
                              <div>
                                <label className={labelClass}>Реквізити для оплати</label>
                                <textarea rows={3} value={openRegForm.paymentInstructions}
                                  onChange={e => setOpenRegForm(prev => prev ? { ...prev, paymentInstructions: e.target.value } : null)}
                                  className={inputClass + ' resize-none text-xs'}
                                  placeholder="Номер картки, призначення платежу..." />
                              </div>
                            )}
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className={labelClass}>Zoom посилання</label>
                                <input type="url" value={openRegForm.zoomLink}
                                  onChange={e => setOpenRegForm(prev => prev ? { ...prev, zoomLink: e.target.value } : null)}
                                  placeholder="https://zoom.us/j/..."
                                  className={inputClass + ' text-xs'} />
                              </div>
                              <div>
                                <label className={labelClass}>Пароль (якщо є)</label>
                                <input type="text" value={openRegForm.zoomPassword}
                                  onChange={e => setOpenRegForm(prev => prev ? { ...prev, zoomPassword: e.target.value } : null)}
                                  placeholder="Пароль Zoom..."
                                  className={inputClass + ' text-xs'} />
                              </div>
                            </div>
                            <div className="flex gap-2 pt-1">
                              <button onClick={() => setOpenRegForm(null)}
                                className="flex-1 border border-sand text-warm-mid hover:bg-white text-xs font-medium rounded-xl py-2 transition">
                                Скасувати
                              </button>
                              <button onClick={() => handleOpenRegistration(group.id)}
                                disabled={groupProcessing === group.id}
                                className="flex-1 bg-[#4CAF50] hover:bg-[#388E3C] disabled:opacity-50 text-white text-xs font-medium rounded-xl py-2 transition">
                                {groupProcessing === group.id ? 'Зберігаємо...' : 'Відкрити реєстрацію'}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Zoom link edit */}
                        <div>
                          <p className="text-xs text-warm-light uppercase tracking-widest font-medium mb-2">Zoom</p>
                          <div className="grid grid-cols-2 gap-2 mb-2">
                            <input type="url" placeholder="https://zoom.us/j/..."
                              defaultValue={group.zoomLink || ''}
                              id={`zoom-${group.id}`}
                              className={inputClass + ' text-xs'} />
                            <input type="text" placeholder="Пароль (якщо є)"
                              defaultValue={group.zoomPassword || ''}
                              id={`zoom-pass-${group.id}`}
                              className={inputClass + ' text-xs'} />
                          </div>
                          <button onClick={() => {
                            const link = (document.getElementById(`zoom-${group.id}`) as HTMLInputElement).value
                            const pass = (document.getElementById(`zoom-pass-${group.id}`) as HTMLInputElement).value
                            api.patch(`/group-supervisions/${group.id}`, { zoomLink: link || null, zoomPassword: pass || null })
                              .then(res => setGroups(prev => prev.map(g => g.id === group.id ? { ...g, zoomLink: res.data.zoomLink, zoomPassword: res.data.zoomPassword } : g)))
                              .catch(err => alert(err.response?.data?.error || 'Помилка'))
                          }} className="bg-rose hover:bg-[#B5745A] text-white text-xs font-medium rounded-xl px-3 py-2 transition">
                            Зберегти Zoom
                          </button>
                        </div>

                        {/* Participants */}
                        {group.participants.length > 0 && (
                          <div>
                            <p className="text-xs text-warm-light uppercase tracking-widest font-medium mb-2">Учасники</p>
                            <div className="space-y-3">
                              {group.participants.map(p => {
                                const pb = PAYMENT_BADGE[p.paymentStatus]
                                const isImage = p.paymentReceiptUrl && /\.(jpe?g|png|gif|webp)($|\?)/i.test(p.paymentReceiptUrl)
                                return (
                                  <div key={p.id} className="bg-beige rounded-xl p-3">
                                    {/* Participant info row */}
                                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                      <span className="text-xs font-medium text-warm-dark">{p.user.firstName} {p.user.lastName}</span>
                                      {p.isPresenter && <span className="text-xs bg-rose-light text-rose px-1.5 py-0.5 rounded-full">Супервізант</span>}
                                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${pb.cls}`}>{pb.label}</span>
                                    </div>
                                    <p className="text-xs text-warm-light">{p.user.email}</p>

                                    {/* Receipt section — prominent when awaiting review */}
                                    {p.paymentStatus === 'RECEIPT_UPLOADED' && p.paymentReceiptUrl && (
                                      <div className="mt-3 pt-3 border-t border-sand">
                                        <p className="text-xs font-medium text-warm-mid mb-2">Квитанція оплати — перевірте перед підтвердженням</p>
                                        {isImage ? (
                                          <a href={p.paymentReceiptUrl} target="_blank" rel="noopener noreferrer" className="block mb-2">
                                            <img src={p.paymentReceiptUrl} alt="Квитанція" className="max-h-40 rounded-lg border border-sand object-contain hover:opacity-90 transition cursor-zoom-in" />
                                            <span className="text-xs text-warm-light mt-1 block">Натисніть для перегляду у повному розмірі</span>
                                          </a>
                                        ) : (
                                          <a href={p.paymentReceiptUrl} target="_blank" rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 text-xs text-rose hover:opacity-80 font-medium transition mb-2">
                                            📄 Відкрити квитанцію →
                                          </a>
                                        )}
                                        <div className="flex gap-2 mt-1">
                                          <button onClick={() => handleConfirmPayment(group.id, p.id)}
                                            disabled={groupProcessing === p.id}
                                            className="flex-1 flex items-center justify-center gap-1.5 bg-[#E8F5E9] hover:bg-[#C8E6C9] disabled:opacity-50 text-[#4CAF50] text-xs font-medium rounded-lg px-3 py-1.5 transition">
                                            <CheckCircle size={12} />Підтвердити оплату
                                          </button>
                                          <button onClick={() => handleRejectPayment(group.id, p.id)}
                                            disabled={groupProcessing === p.id}
                                            className="flex-1 flex items-center justify-center gap-1.5 bg-[#FFEBEE] hover:bg-[#FFCDD2] disabled:opacity-50 text-[#E53935] text-xs font-medium rounded-lg px-3 py-1.5 transition">
                                            <XCircle size={12} />Відхилити
                                          </button>
                                        </div>
                                      </div>
                                    )}

                                    {/* Receipt link for already confirmed/rejected */}
                                    {p.paymentStatus !== 'RECEIPT_UPLOADED' && p.paymentReceiptUrl && (
                                      <a href={p.paymentReceiptUrl} target="_blank" rel="noopener noreferrer"
                                        className="text-xs text-warm-light hover:text-rose transition mt-1 block">
                                        Квитанція →
                                      </a>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
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

      {/* ── Create Group Supervision Modal ── */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-cormorant text-2xl font-semibold text-warm-dark">Нова групова супервізія ♡</h3>
                <p className="font-cormorant italic text-warm-mid text-sm">Заповніть деталі</p>
              </div>
              <button onClick={() => setShowGroupModal(false)} className="text-warm-light hover:text-warm-mid transition"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className={labelClass}>Назва</label>
                <input type="text" value={groupForm.title} onChange={setGroupField('title')} required placeholder="Напр: Групова супервізія — травматичний досвід" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Опис (необов'язково)</label>
                <textarea value={groupForm.description} onChange={setGroupField('description')} rows={2} className={inputClass + ' resize-none'} placeholder="Додаткова інформація..." />
              </div>
              <div>
                <label className={labelClass}>Дата</label>
                <input type="date" value={groupForm.scheduledDate} onChange={setGroupField('scheduledDate')} required className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelClass}>Час початку</label><input type="time" value={groupForm.scheduledTime} onChange={setGroupField('scheduledTime')} required className={inputClass} /></div>
                <div><label className={labelClass}>Час завершення</label><input type="time" value={groupForm.endTime} onChange={setGroupField('endTime')} required className={inputClass} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Вартість (0 = безкоштовно)</label>
                  <input type="number" value={groupForm.price} onChange={setGroupField('price')} min={0} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Валюта</label>
                  <select value={groupForm.currency} onChange={setGroupField('currency')} className={inputClass}>
                    <option value="UAH">UAH</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </div>
              {Number(groupForm.price) > 0 && (
                <div>
                  <label className={labelClass}>Реквізити для оплати</label>
                  <textarea value={groupForm.paymentInstructions} onChange={setGroupField('paymentInstructions')} rows={3} className={inputClass + ' resize-none'} placeholder="Номер картки, призначення платежу..." />
                </div>
              )}
              <div>
                <label className={labelClass}>Zoom посилання (можна додати пізніше)</label>
                <input type="url" value={groupForm.zoomLink} onChange={setGroupField('zoomLink')} placeholder="https://zoom.us/j/..." className={inputClass} />
              </div>
              {groupError && <p className="text-red-500 text-sm bg-red-50 rounded-xl px-4 py-2.5">{groupError}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowGroupModal(false)} className="flex-1 border border-sand text-warm-mid hover:bg-beige font-medium rounded-xl py-2.5 text-sm transition">Скасувати</button>
                <button type="submit" disabled={groupSaving} className="flex-1 bg-rose hover:bg-[#B5745A] disabled:opacity-60 text-white font-medium rounded-xl py-2.5 text-sm transition">{groupSaving ? 'Зберігаємо...' : 'Створити'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Set Recording Modal ── */}
      {recordingForm && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-cormorant text-2xl font-semibold text-warm-dark">Додати запис ♡</h3>
              <button onClick={() => setRecordingForm(null)} className="text-warm-light hover:text-warm-mid transition"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Посилання на запис (Google Drive)</label>
                <input type="url" value={recordingForm.url} onChange={e => setRecordingForm(prev => prev ? { ...prev, url: e.target.value } : null)}
                  placeholder="https://drive.google.com/..." ref={recordingInputRef} className={inputClass} />
                <p className="text-xs text-warm-light mt-1">Переконайтесь, що доступ "Переглядач" для всіх з посиланням</p>
              </div>
              <div>
                <label className={labelClass}>Дата закінчення доступу (необов'язково)</label>
                <select className={inputClass} onChange={e => {
                  const days = Number(e.target.value)
                  if (!days) { setRecordingForm(prev => prev ? { ...prev, expiresAt: '' } : null); return }
                  const d = new Date(); d.setDate(d.getDate() + days)
                  setRecordingForm(prev => prev ? { ...prev, expiresAt: d.toISOString() } : null)
                }}>
                  <option value="">Без обмеження</option>
                  <option value="7">7 днів</option>
                  <option value="14">14 днів</option>
                  <option value="30">30 днів</option>
                </select>
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setRecordingForm(null)} className="flex-1 border border-sand text-warm-mid hover:bg-beige font-medium rounded-xl py-2.5 text-sm transition">Скасувати</button>
                <button onClick={handleSetRecording} disabled={!recordingForm.url || groupProcessing === recordingForm.id}
                  className="flex-1 bg-rose hover:bg-[#B5745A] disabled:opacity-60 text-white font-medium rounded-xl py-2.5 text-sm transition">
                  {groupProcessing === recordingForm.id ? 'Зберігаємо...' : 'Зберегти'}
                </button>
              </div>
            </div>
          </div>
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
