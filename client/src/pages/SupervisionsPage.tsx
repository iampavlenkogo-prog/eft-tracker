import { useState, useEffect, useRef } from 'react'
import { X, Plus, User, Search, BookOpen, Calendar, Clock, FileText, ExternalLink, Upload, Award, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import ReportModal from '../components/ReportModal'
import api from '../api/axios'

// ── Types ──────────────────────────────────────────────────

type RecordStatus = 'PENDING' | 'APPROVED' | 'REJECTED'
type SupervisionType = 'INDIVIDUAL_PRESENTER' | 'INDIVIDUAL_LISTENER' | 'GROUP_PRESENTER' | 'GROUP_LISTENER'
type MainTab = 'supervisions' | 'seminars' | 'skills' | 'bookings'
type StatusChip = 'all' | 'pending' | 'confirmed'

// ── Interfaces ─────────────────────────────────────────────

interface BookingItem {
  id: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED'
  meetingLink: string | null
  slot: {
    date: string; time: string; duration: number
    type: 'INDIVIDUAL' | 'GROUP'
    supervisor: { firstName: string; lastName: string; telegram: string | null; meetingLink: string | null }
  }
}
interface Supervisor { id: string; firstName: string; lastName: string }
interface Supervision {
  id: string; date: string; type: SupervisionType; hours: number
  status: RecordStatus; supervisor: Supervisor
}
interface SkillsGroup {
  id: string; date: string; hours: number; status: RecordStatus; supervisor: Supervisor
}
interface MyGroupRegistration {
  id: string; title: string; description: string | null
  scheduledDate: string; scheduledTime: string; duration: number
  price: number; currency: string; status: string
  paymentInstructions: string | null; zoomLink: string | null; zoomPassword: string | null
  recordingUrl: string | null; recordingExpiresAt: string | null
  supervisor: { id: string; firstName: string; lastName: string }
  myParticipation: { id: string; isPresenter: boolean; paymentStatus: 'PENDING' | 'RECEIPT_UPLOADED' | 'CONFIRMED' | 'FREE' }
}
interface Seminar {
  id: string; title: string; date: string; hours: number
  points: number; certificateUrl: string | null; status: RecordStatus
}

// ── Constants ──────────────────────────────────────────────

const BOOKING_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING:   { label: 'Очікує підтвердження', cls: 'bg-[#F1E4CC] text-[#B98E45]' },
  APPROVED:  { label: '♡ Підтверджено',        cls: 'bg-[#DDE7DD] text-[#6E8A72]' },
  REJECTED:  { label: 'Відхилено',             cls: 'bg-[#F8EEEE] text-[#A86060]' },
  COMPLETED: { label: 'Завершено',             cls: 'bg-[#EEF2F8] text-[#7090B0]' },
  CANCELLED: { label: 'Скасовано',             cls: 'bg-[#F5F0EC] text-[#A99CA1]' },
}
const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  PENDING:  { label: 'Очікує',          cls: 'bg-[#F1E4CC] text-[#B98E45]' },
  APPROVED: { label: '♡ Підтверджено',  cls: 'bg-[#DDE7DD] text-[#6E8A72]' },
  REJECTED: { label: 'Відхилено',       cls: 'bg-[#F8EEEE] text-[#A86060]' },
}
const TYPE_LABELS: Record<SupervisionType, string> = {
  INDIVIDUAL_PRESENTER: 'Індивідуальна супервізія',
  INDIVIDUAL_LISTENER:  'Індивідуальна супервізія',
  GROUP_PRESENTER:      'Групова супервізія',
  GROUP_LISTENER:       'Групова супервізія',
}
const SUPERVISION_TYPES: { value: SupervisionType; label: string; sub: string }[] = [
  { value: 'INDIVIDUAL_PRESENTER', label: 'Індивідуальна', sub: 'Подання випадку' },
  { value: 'INDIVIDUAL_LISTENER',  label: 'Індивідуальна', sub: 'Слухач' },
  { value: 'GROUP_PRESENTER',      label: 'Групова',        sub: 'Подання випадку' },
  { value: 'GROUP_LISTENER',       label: 'Групова',        sub: 'Слухач' },
]
const PAYMENT_LABELS: Record<string, { label: string; cls: string }> = {
  PENDING:          { label: 'Очікує оплати',       cls: 'bg-[#F1E4CC] text-[#B98E45]' },
  RECEIPT_UPLOADED: { label: 'Квитанцію надіслано', cls: 'bg-[#EEF2F8] text-[#7090B0]' },
  CONFIRMED:        { label: 'Оплату підтверджено', cls: 'bg-[#DDE7DD] text-[#6E8A72]' },
  FREE:             { label: 'Безкоштовно',          cls: 'bg-[#F2EEF8] text-[#9080B0]' },
}
const GROUP_TYPES: SupervisionType[] = ['GROUP_PRESENTER', 'GROUP_LISTENER']
const GROUP_STATUS_LABELS: Record<string, string> = {
  WAITING_FOR_CASE:     'Очікує супервізанта',
  CASE_CONFIRMED:       'Супервізанта визначено',
  REGISTRATION_OPEN:    'Реєстрація відкрита',
  REGISTRATION_CLOSED:  'Реєстрація закрита',
  WAITING_FOR_RECORDING:'Очікує запис',
  RECORDING_AVAILABLE:  'Запис доступний',
}
const emptySvForm      = { date: '', supervisorId: '', type: 'INDIVIDUAL_PRESENTER' as SupervisionType, hours: '1', minutes: '0' }
const emptySkillsForm  = { date: '', supervisorId: '', hours: '1', minutes: '0' }
const emptySemForm     = { title: '', date: '', hours: '', points: '' }

// ── Helpers ────────────────────────────────────────────────

function tgLink(handle: string | null | undefined): string | null {
  if (!handle) return null
  const u = handle.replace('@', '').trim()
  return u ? `https://t.me/${u}` : null
}
function formatHours(h: number) {
  const hrs = Math.floor(h)
  const mins = Math.round((h - hrs) * 60)
  return mins === 0 ? `${hrs} год` : `${hrs} год ${mins} хв`
}

// ── Sub-components ─────────────────────────────────────────

function RecCard({
  dateStr, title, meta, status, hours, extra,
}: {
  dateStr: string
  title: string
  meta: { icon: React.ReactNode; text: string }[]
  status: { label: string; cls: string }
  hours?: string
  extra?: React.ReactNode
}) {
  const d = new Date(dateStr)
  return (
    <div
      className="flex items-start gap-[18px] rounded-[36px] p-[20px_24px] hover:-translate-y-[3px] transition cursor-pointer"
      style={{ background: 'var(--surface)', boxShadow: 'var(--clay)' }}
    >
      <div
        className="flex-shrink-0 w-[62px] h-[62px] rounded-[18px] bg-[#F5E4E4] flex flex-col items-center justify-center text-[#B06B7E]"
        style={{ boxShadow: 'var(--clay-sm)' }}
      >
        <b className="font-cormorant text-[24px] font-bold leading-none">{format(d, 'd', { locale: uk })}</b>
        <span className="text-[10px] font-extrabold tracking-[.08em] uppercase mt-0.5">{format(d, 'MMM', { locale: uk })}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-cormorant text-[21px] font-bold leading-tight text-warm-dark">{title}</div>
        <div className="flex flex-wrap gap-[14px] mt-[7px]">
          {meta.map((m, i) => (
            <span key={i} className="inline-flex items-center gap-[7px] text-[13.5px] text-warm-mid font-semibold">
              {m.icon}{m.text}
            </span>
          ))}
        </div>
        {extra && <div className="mt-2">{extra}</div>}
      </div>
      <div className="flex flex-col items-end gap-[10px] shrink-0">
        <span className={`inline-flex items-center gap-[6px] px-[13px] py-[6px] rounded-[999px] text-[12px] font-extrabold whitespace-nowrap ${status.cls}`}>
          {status.label}
        </span>
        {hours && (
          <span className="font-cormorant text-[18px] font-bold text-warm-dark">
            {hours}
          </span>
        )}
      </div>
    </div>
  )
}

function EmptyCard({
  label, sub, onAdd, linkTo, linkLabel,
}: {
  label: string; sub: string
  onAdd?: () => void; linkTo?: string; linkLabel?: string
}) {
  return (
    <div className="text-center py-14 rounded-[36px]" style={{ background: 'var(--surface)', boxShadow: 'var(--clay)' }}>
      <div className="w-[70px] h-[70px] rounded-[22px] bg-[#F5E4E4] flex items-center justify-center mx-auto mb-[18px]"
        style={{ boxShadow: 'var(--clay-sm)' }}>
        <BookOpen size={34} className="text-[#B06B7E]" />
      </div>
      <h3 className="font-cormorant text-[24px] font-semibold text-warm-dark">{label}</h3>
      <p className="text-[15px] text-warm-light mt-2">{sub}</p>
      {onAdd && (
        <button onClick={onAdd}
          className="mt-5 inline-flex items-center gap-2 text-white font-bold text-[15px] rounded-[999px] px-6 py-3 transition"
          style={{ background: 'linear-gradient(135deg,#C77E91,#A85E73)' }}>
          <Plus size={17} />Додати запис
        </button>
      )}
      {linkTo && (
        <Link to={linkTo}
          className="mt-5 inline-flex items-center gap-2 text-white font-bold text-[15px] rounded-[999px] px-6 py-3 transition"
          style={{ background: 'linear-gradient(135deg,#C77E91,#A85E73)' }}>
          {linkLabel}
        </Link>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────

export default function SupervisionsPage({ defaultTab = 'supervisions' }: { defaultTab?: 'supervisions' | 'seminars' }) {
  const [activeTab, setActiveTab]   = useState<MainTab>(defaultTab)
  const [statusChip, setStatusChip] = useState<StatusChip>('all')
  const [search, setSearch]         = useState('')
  const [showReport, setShowReport] = useState(false)

  const inputClass     = 'w-full bg-white border border-sand/50 rounded-2xl px-4 py-3 text-sm text-warm-dark placeholder:text-warm-light/50 focus:outline-none focus:border-rose/40 focus:ring-2 focus:ring-rose/10 transition'
  const iconInputClass = 'w-full bg-white border border-sand/50 rounded-2xl pl-9 pr-4 py-2.5 text-sm text-warm-dark placeholder:text-warm-light/50 focus:outline-none focus:border-rose/40 focus:ring-2 focus:ring-rose/10 transition'
  const labelClass     = 'block text-xs font-medium text-warm-light uppercase tracking-wider mb-2'

  // ── Supervisions state ──
  const [supervisions, setSupervisions] = useState<Supervision[]>([])
  const [supervisors, setSupervisors]   = useState<Supervisor[]>([])
  const [svLoading, setSvLoading]       = useState(true)
  const [svModalOpen, setSvModalOpen]   = useState(false)
  const [svSubmitting, setSvSubmitting] = useState(false)
  const [svError, setSvError]           = useState('')
  const [svForm, setSvForm]             = useState(emptySvForm)
  const [myGroups, setMyGroups]         = useState<MyGroupRegistration[]>([])

  // ── Skills state ──
  const [skills, setSkills]               = useState<SkillsGroup[]>([])
  const [skillsLoading, setSkillsLoading] = useState(false)
  const [skillsLoaded, setSkillsLoaded]   = useState(false)
  const [skillsModalOpen, setSkillsModalOpen] = useState(false)
  const [skillsSubmitting, setSkillsSubmitting] = useState(false)
  const [skillsError, setSkillsError]     = useState('')
  const [skillsForm, setSkillsForm]       = useState(emptySkillsForm)

  // ── Bookings state ──
  const [bookings, setBookings]           = useState<BookingItem[]>([])
  const [bookingsLoaded, setBookingsLoaded] = useState(false)

  // ── Seminars state ──
  const [seminars, setSeminars]           = useState<Seminar[]>([])
  const [semLoading, setSemLoading]       = useState(false)
  const [, setSemLoaded]                  = useState(false)
  const [semModalOpen, setSemModalOpen]   = useState(false)
  const [semSubmitting, setSemSubmitting] = useState(false)
  const [semError, setSemError]           = useState('')
  const [semForm, setSemForm]             = useState(emptySemForm)
  const [semFile, setSemFile]             = useState<File | null>(null)
  const [semDragOver, setSemDragOver]     = useState(false)
  const semFileRef = useRef<HTMLInputElement>(null)

  // ── Load on mount ──
  useEffect(() => {
    api.get('/supervisions').then(res => setSupervisions(res.data)).finally(() => setSvLoading(false))
    api.get('/group-supervisions/mine').then(res => setMyGroups(res.data)).catch(() => {})
    setSemLoading(true)
    api.get('/seminars').then(res => { setSeminars(res.data); setSemLoaded(true) }).finally(() => setSemLoading(false))
  }, [])

  // ── Lazy load skills / bookings ──
  useEffect(() => {
    if (activeTab === 'skills' && !skillsLoaded) {
      setSkillsLoading(true)
      api.get('/skills-groups').then(res => { setSkills(res.data); setSkillsLoaded(true) }).finally(() => setSkillsLoading(false))
    }
    if (activeTab === 'bookings' && !bookingsLoaded) {
      api.get('/bookings/my').then(res => { setBookings(res.data); setBookingsLoaded(true) }).catch(() => {})
    }
  }, [activeTab])

  const loadSupervisors = async () => {
    if (supervisors.length === 0) {
      const res = await api.get('/users/supervisors')
      setSupervisors(res.data)
    }
  }

  const setSvField     = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setSvForm(p => ({ ...p, [f]: e.target.value }))
  const setSkillsField = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setSkillsForm(p => ({ ...p, [f]: e.target.value }))
  const setSemField    = (f: string) => (e: React.ChangeEvent<HTMLInputElement>) => setSemForm(p => ({ ...p, [f]: e.target.value }))

  const isGroupType = GROUP_TYPES.includes(svForm.type)

  const handleSvSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSvError(''); setSvSubmitting(true)
    try {
      const totalHours = isGroupType ? Number(svForm.hours) + Number(svForm.minutes) / 60 : 1
      const res = await api.post('/supervisions', { ...svForm, hours: totalHours })
      setSupervisions(prev => [res.data, ...prev])
      setSvModalOpen(false); setSvForm(emptySvForm)
    } catch (err: any) { setSvError(err.response?.data?.error || 'Помилка') }
    finally { setSvSubmitting(false) }
  }

  const handleSkillsSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSkillsError(''); setSkillsSubmitting(true)
    try {
      const totalHours = Number(skillsForm.hours) + Number(skillsForm.minutes) / 60
      const res = await api.post('/skills-groups', { ...skillsForm, hours: Math.max(0.5, totalHours) })
      setSkills(prev => [res.data, ...prev])
      setSkillsModalOpen(false); setSkillsForm(emptySkillsForm)
    } catch (err: any) { setSkillsError(err.response?.data?.error || 'Помилка') }
    finally { setSkillsSubmitting(false) }
  }

  const closeSemModal = () => {
    setSemModalOpen(false); setSemError(''); setSemForm(emptySemForm)
    setSemFile(null); setSemDragOver(false)
    if (semFileRef.current) semFileRef.current.value = ''
  }

  const handleSemDrop = (e: React.DragEvent) => {
    e.preventDefault(); setSemDragOver(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) setSemFile(dropped)
  }

  const handleSemSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSemError(''); setSemSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('title', semForm.title)
      fd.append('date', semForm.date)
      fd.append('hours', semForm.hours)
      fd.append('points', semForm.points)
      if (semFile) fd.append('certificate', semFile)
      const res = await api.post('/seminars', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setSeminars(prev => [res.data, ...prev])
      closeSemModal()
    } catch (err: any) { setSemError(err.response?.data?.error || 'Помилка') }
    finally { setSemSubmitting(false) }
  }

  const openAddModal = async () => {
    if (activeTab === 'supervisions') { setSvModalOpen(true); await loadSupervisors() }
    else if (activeTab === 'seminars') { setSemModalOpen(true) }
    else if (activeTab === 'skills')   { setSkillsModalOpen(true); await loadSupervisors() }
  }

  // ── Stats ──
  const svApproved    = supervisions.filter(s => s.status === 'APPROVED')
  const svTotalHours  = Math.round(svApproved.reduce((acc, s) => acc + s.hours, 0) * 10) / 10
  const semApproved   = seminars.filter(s => s.status === 'APPROVED')
  const skillsApproved = skills.filter(s => s.status === 'APPROVED')

  // ── Filters ──
  const matchesChip   = (status: string) => statusChip === 'all' || (statusChip === 'pending' ? status === 'PENDING' : status === 'APPROVED')
  const matchesSearch = (text: string)   => !search || text.toLowerCase().includes(search.toLowerCase())

  const filteredSv = supervisions.filter(s =>
    matchesChip(s.status) && matchesSearch(`${TYPE_LABELS[s.type]} ${s.supervisor.firstName} ${s.supervisor.lastName}`)
  )
  const filteredSem = seminars.filter(s =>
    matchesChip(s.status) && matchesSearch(s.title)
  )
  const filteredSkills = skills.filter(s =>
    matchesChip(s.status) && matchesSearch(`${s.supervisor.firstName} ${s.supervisor.lastName}`)
  )
  const filteredBookings = bookings.filter(b => matchesChip(b.status))

  // Right rail: most recent approved seminars
  const recentSeminars = semApproved
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3)

  const isLoading =
    (activeTab === 'supervisions' && svLoading) ||
    (activeTab === 'seminars' && semLoading) ||
    (activeTab === 'skills' && skillsLoading)

  const TABS: { key: MainTab; label: string }[] = [
    { key: 'supervisions', label: 'Супервізії' },
    { key: 'seminars',     label: 'Семінари' },
    { key: 'skills',       label: 'Групи навичок' },
    { key: 'bookings',     label: 'Бронювання' },
  ]

  return (
    <Layout>

      {/* ── Hero ── */}
      <section className="flex items-start justify-between gap-6">
        <div>
          <h1 className="font-cormorant font-semibold text-warm-dark leading-tight" style={{ fontSize: 'clamp(30px,3.6vw,42px)' }}>
            Моє навчання <span style={{ color: '#F5C8BD' }}>♡</span>
          </h1>
          <p className="font-cormorant italic text-lg text-warm-mid mt-2">Супервізійні зустрічі, семінари та ваш прогрес</p>
        </div>
        <button
          onClick={() => setShowReport(true)}
          className="flex items-center gap-2 font-semibold text-sm rounded-[999px] px-6 py-3.5 shrink-0 hover:-translate-y-0.5 transition"
          style={{ background: 'var(--surface)', color: 'var(--rose-ink)', boxShadow: 'var(--clay-sm)' }}
        >
          <FileText size={17} />Звіт
        </button>
      </section>

      {/* ── Progress band ── */}
      <section
        className="relative overflow-hidden rounded-[46px] p-[30px_34px] mt-7"
        style={{ background: 'linear-gradient(150deg,#FBEFE9,#F3DEE6 55%,#ECE0F2)', boxShadow: 'var(--clay)' }}
      >
        <span className="flex items-center gap-2 text-[12px] font-extrabold tracking-[.14em] uppercase" style={{ color: 'var(--rose-ink)' }}>♡ Ваш шлях у ЕФТ</span>
        <h2 className="font-cormorant text-[26px] font-semibold text-warm-dark mt-2">Ваш прогрес росту</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-[18px] mt-[22px]">
          {[
            { value: svTotalHours, unit: 'год', label: 'Годин супервізії' },
            { value: svApproved.length,      unit: '',    label: 'Відвідано зустрічей' },
            { value: semApproved.length,     unit: '',    label: 'Семінарів пройдено' },
            { value: skillsApproved.length,  unit: '',    label: 'Групи навичок' },
          ].map(stat => (
            <div key={stat.label} className="rounded-[28px] p-[18px_20px]"
              style={{ background: 'rgba(255,255,255,.7)', boxShadow: '-4px -4px 10px rgba(255,255,255,.5),6px 8px 18px rgba(190,150,155,.18)' }}>
              <div className="font-cormorant text-[34px] font-bold leading-none flex items-baseline gap-[5px]" style={{ color: 'var(--rose-deep)' }}>
                {stat.value}
                {stat.unit && <small className="text-[16px] text-warm-light font-semibold font-mulish">{stat.unit}</small>}
              </div>
              <span className="block text-[13px] text-warm-mid font-semibold mt-2">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Tabs ── */}
      <div
        className="flex gap-2 mt-7 p-[7px] rounded-[999px] w-fit max-w-full overflow-x-auto"
        style={{ background: 'var(--surface)', boxShadow: 'var(--clay-sm)', scrollbarWidth: 'none' }}
      >
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => { setActiveTab(t.key); setSearch(''); setStatusChip('all') }}
            className="flex items-center gap-2 px-[22px] py-[11px] rounded-[999px] text-[15px] font-bold whitespace-nowrap transition-all"
            style={activeTab === t.key
              ? { background: 'linear-gradient(135deg,#C77E91,#A85E73)', color: '#fff', boxShadow: '-3px -3px 8px rgba(255,255,255,.3),6px 8px 18px rgba(168,94,115,.4)' }
              : { color: 'var(--ink-2)' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Body ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 mt-3">
        <div>

          {/* Toolbar */}
          <div className="flex items-center gap-3 flex-wrap mt-[22px]">
            {activeTab !== 'bookings' && (
              <div
                className="flex items-center gap-[11px] rounded-[999px] px-[18px] py-[11px] flex-1 min-w-[220px]"
                style={{ background: 'var(--surface)', boxShadow: 'var(--clay-sm)' }}
              >
                <Search size={18} className="text-warm-light shrink-0" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Пошук за темою або супервізором…"
                  className="flex-1 min-w-0 bg-transparent border-none outline-none text-[15px] text-warm-dark placeholder:text-warm-light"
                />
              </div>
            )}
            <div className="flex gap-2">
              {(['all', 'pending', 'confirmed'] as StatusChip[]).map(s => (
                <button
                  key={s}
                  onClick={() => setStatusChip(s)}
                  className="px-[16px] py-[10px] rounded-[999px] font-bold text-[13.5px] transition-all"
                  style={statusChip === s
                    ? { background: 'var(--rose-ink)', color: '#fff' }
                    : { background: 'var(--surface)', boxShadow: 'var(--clay-sm)', color: 'var(--ink-2)' }}
                >
                  {s === 'all' ? 'Усі' : s === 'pending' ? 'Очікують' : 'Підтверджено'}
                </button>
              ))}
            </div>
            {activeTab !== 'bookings' ? (
              <button
                onClick={openAddModal}
                className="flex items-center gap-2 text-white font-bold text-[15px] rounded-[999px] px-[24px] py-[13px] transition hover:-translate-y-0.5"
                style={{ background: 'linear-gradient(135deg,#C77E91,#A85E73)', boxShadow: '-4px -4px 12px rgba(255,255,255,.4),10px 12px 26px rgba(168,94,115,.40)' }}
              >
                <Plus size={17} />Додати
              </button>
            ) : (
              <Link to="/slots"
                className="flex items-center gap-2 text-white font-bold text-[15px] rounded-[999px] px-[24px] py-[13px] transition hover:-translate-y-0.5 ml-auto"
                style={{ background: 'linear-gradient(135deg,#C77E91,#A85E73)', boxShadow: '-4px -4px 12px rgba(255,255,255,.4),10px 12px 26px rgba(168,94,115,.40)' }}>
                <Calendar size={17} />Записатись на слот
              </Link>
            )}
          </div>

          {/* Feed */}
          {isLoading ? (
            <div className="flex justify-center py-16 mt-4">
              <div className="w-7 h-7 border-4 border-sand border-t-rose rounded-full animate-spin" />
            </div>
          ) : (
            <div className="mt-[18px] space-y-[14px]">

              {/* ── SUPERVISIONS ── */}
              {activeTab === 'supervisions' && (
                <>
                  {myGroups.length > 0 && (
                    <div className="mb-2">
                      <p className="text-xs text-warm-light uppercase tracking-widest font-medium mb-3">Мої групові супервізії</p>
                      {myGroups.map(g => {
                        const p  = g.myParticipation
                        const pb = PAYMENT_LABELS[p.paymentStatus]
                        const isPast = new Date(`${g.scheduledDate}T${g.scheduledTime}`) < new Date()
                        return (
                          <div key={g.id} className="rounded-[28px] p-5 mb-3" style={{ background: 'var(--surface)', boxShadow: 'var(--clay-sm)' }}>
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <span className="text-xs text-warm-light bg-beige px-2.5 py-1 rounded-full">{GROUP_STATUS_LABELS[g.status] ?? g.status}</span>
                              {p.isPresenter && <span className="text-xs bg-rose-light text-rose px-2.5 py-1 rounded-full">Супервізант</span>}
                              <span className={`text-xs px-2.5 py-1 rounded-full ${pb.cls}`}>{pb.label}</span>
                            </div>
                            <h3 className="font-cormorant text-lg font-semibold text-warm-dark mb-1">{g.title}</h3>
                            <div className="flex flex-wrap gap-3 text-xs text-warm-mid mb-3">
                              <span className="flex items-center gap-1"><Calendar size={11} />{g.scheduledDate}</span>
                              <span className="flex items-center gap-1"><Clock size={11} />{g.scheduledTime} · {g.duration} хв</span>
                              <span>{g.supervisor.firstName} {g.supervisor.lastName}</span>
                              {g.price > 0 && <span>{g.price} {g.currency}</span>}
                            </div>
                            {p.paymentStatus === 'PENDING' && g.paymentInstructions && (
                              <div className="bg-beige rounded-xl p-3 text-sm text-warm-dark whitespace-pre-wrap mb-3 leading-relaxed border border-sand">{g.paymentInstructions}</div>
                            )}
                            {g.zoomLink && !isPast && (
                              <a href={g.zoomLink} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 text-white text-xs font-medium px-4 py-2 rounded-xl mb-3 transition"
                                style={{ background: 'linear-gradient(135deg,#C77E91,#A85E73)' }}>
                                🎥 Приєднатися до Zoom
                                {g.zoomPassword && <span className="opacity-80">· Пароль: {g.zoomPassword}</span>}
                              </a>
                            )}
                            {g.recordingUrl && (
                              <a href={g.recordingUrl} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 bg-[#E3F2FD] hover:bg-[#BBDEFB] text-[#7090B0] text-xs font-medium px-4 py-2 rounded-xl transition mb-3">
                                🎬 Переглянути запис
                              </a>
                            )}
                            <Link to={`/group-supervisions/${g.id}`} className="text-xs text-rose hover:opacity-80 font-medium transition">Детальніше →</Link>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {filteredSv.length === 0
                    ? <EmptyCard label="Немає записів" sub="Додайте першу супервізію" onAdd={() => { setSvModalOpen(true); loadSupervisors() }} />
                    : filteredSv.map(s => (
                        <RecCard key={s.id}
                          dateStr={s.date}
                          title={TYPE_LABELS[s.type]}
                          meta={[{ icon: <User size={15} style={{ color: 'var(--rose-deep)' }} />, text: `${s.supervisor.firstName} ${s.supervisor.lastName}` }]}
                          status={STATUS_BADGE[s.status] ?? STATUS_BADGE.PENDING}
                          hours={s.hours > 0 ? formatHours(s.hours) : undefined}
                        />
                      ))
                  }
                </>
              )}

              {/* ── SEMINARS ── */}
              {activeTab === 'seminars' && (
                filteredSem.length === 0
                  ? <EmptyCard label="Немає семінарів" sub="Додайте перший запис після навчання" onAdd={() => setSemModalOpen(true)} />
                  : filteredSem.map(s => (
                      <RecCard key={s.id}
                        dateStr={s.date}
                        title={s.title}
                        meta={[
                          { icon: <Clock size={15} style={{ color: 'var(--rose-deep)' }} />, text: `${s.hours} год` },
                          ...(s.points > 0 ? [{ icon: <Award size={15} style={{ color: 'var(--rose-deep)' }} />, text: `${s.points} балів` }] : []),
                        ]}
                        status={STATUS_BADGE[s.status] ?? STATUS_BADGE.PENDING}
                        extra={s.certificateUrl ? (
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
                            className="flex items-center gap-1 text-xs font-semibold hover:opacity-80 transition"
                            style={{ color: 'var(--rose-ink)' }}
                          >
                            <FileText size={12} />Сертифікат<ExternalLink size={11} />
                          </button>
                        ) : undefined}
                      />
                    ))
              )}

              {/* ── SKILLS ── */}
              {activeTab === 'skills' && (
                filteredSkills.length === 0
                  ? <EmptyCard label="Немає записів" sub="Додайте першу участь у групі навичок" onAdd={() => { setSkillsModalOpen(true); loadSupervisors() }} />
                  : filteredSkills.map(s => (
                      <RecCard key={s.id}
                        dateStr={s.date}
                        title="Група навичок"
                        meta={[
                          { icon: <User size={15} style={{ color: 'var(--rose-deep)' }} />, text: `${s.supervisor.firstName} ${s.supervisor.lastName}` },
                          { icon: <Clock size={15} style={{ color: 'var(--rose-deep)' }} />, text: formatHours(s.hours) },
                        ]}
                        status={STATUS_BADGE[s.status] ?? STATUS_BADGE.PENDING}
                      />
                    ))
              )}

              {/* ── BOOKINGS ── */}
              {activeTab === 'bookings' && (
                filteredBookings.length === 0
                  ? <EmptyCard label="Немає бронювань" sub="Оберіть зручний слот і подайте заявку" linkTo="/slots" linkLabel="Переглянути слоти →" />
                  : filteredBookings.map(b => {
                      const cfg  = BOOKING_STATUS[b.status]
                      const zoom = b.meetingLink || b.slot.supervisor.meetingLink
                      const tg   = tgLink(b.slot.supervisor.telegram)
                      return (
                        <RecCard key={b.id}
                          dateStr={b.slot.date}
                          title={`Слот: ${b.slot.type === 'INDIVIDUAL' ? 'Інд. супервізія' : 'Групова супервізія'}`}
                          meta={[
                            { icon: <User size={15} style={{ color: 'var(--rose-deep)' }} />, text: `${b.slot.supervisor.firstName} ${b.slot.supervisor.lastName}` },
                            { icon: <Clock size={15} style={{ color: 'var(--rose-deep)' }} />, text: `${b.slot.time} · ${b.slot.duration} хв` },
                          ]}
                          status={{ label: cfg.label, cls: cfg.cls }}
                          extra={
                            (b.status === 'APPROVED' && zoom) || ((b.status === 'PENDING' || b.status === 'APPROVED') && tg) ? (
                              <div className="flex flex-wrap gap-2 mt-1">
                                {b.status === 'APPROVED' && zoom && (
                                  <a href={zoom} target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-white text-xs font-medium rounded-xl px-3 py-1.5 transition"
                                    style={{ background: 'linear-gradient(135deg,#C77E91,#A85E73)' }}>
                                    🎥 Приєднатися
                                  </a>
                                )}
                                {(b.status === 'PENDING' || b.status === 'APPROVED') && tg && (
                                  <a href={tg} target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 bg-[#229ED9] hover:bg-[#1a8bc2] text-white text-xs font-medium rounded-xl px-3 py-1.5 transition">
                                    Telegram
                                  </a>
                                )}
                              </div>
                            ) : undefined
                          }
                        />
                      )
                    })
              )}

            </div>
          )}
        </div>

        {/* ── Right rail ── */}
        <aside className="hidden lg:flex flex-col gap-5 sticky top-[92px]">

          {/* Seminars widget */}
          <div className="rounded-[36px] p-[24px_26px]" style={{ background: 'var(--surface)', boxShadow: 'var(--clay)' }}>
            <span className="text-[11.5px] font-extrabold tracking-[.14em] uppercase" style={{ color: 'var(--rose-ink)' }}>♡ Мої семінари</span>
            <h3 className="font-cormorant text-[21px] font-semibold text-warm-dark mt-1.5">Останні семінари</h3>
            <p className="text-[13px] text-warm-light mt-0.5">Підтверджені записи</p>
            <div className="flex flex-col gap-[10px] mt-4">
              {recentSeminars.length === 0 ? (
                <p className="text-[13px] text-warm-light">Поки немає підтверджених семінарів</p>
              ) : recentSeminars.map(s => (
                <div key={s.id}
                  className="flex items-center gap-[13px] px-3 py-3 rounded-[28px] cursor-pointer hover:translate-x-[3px] transition"
                  style={{ background: 'var(--surface-2)' }}
                  onClick={() => setActiveTab('seminars')}
                >
                  <div
                    className="w-[46px] h-[46px] rounded-[14px] bg-[#F5E4E4] flex flex-col items-center justify-center text-[#B06B7E] shrink-0"
                    style={{ boxShadow: 'var(--clay-sm)' }}
                  >
                    <b className="font-cormorant text-[19px] font-bold leading-none">{format(new Date(s.date), 'd', { locale: uk })}</b>
                    <span className="text-[9px] font-extrabold tracking-[.08em] uppercase mt-0.5">{format(new Date(s.date), 'MMM', { locale: uk })}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-bold text-warm-dark leading-snug truncate">{s.title}</div>
                    <div className="text-[12px] text-warm-light mt-0.5">{s.hours} год</div>
                  </div>
                  <ChevronRight size={16} className="text-warm-light shrink-0" />
                </div>
              ))}
            </div>
            <button onClick={() => setActiveTab('seminars')}
              className="flex items-center gap-1 font-bold text-[14px] mt-4 hover:opacity-80 transition"
              style={{ color: 'var(--rose-ink)' }}>
              Всі семінари <ChevronRight size={14} />
            </button>
          </div>

          {/* Slots widget */}
          <div className="rounded-[36px] p-[24px_26px]" style={{ background: 'var(--surface)', boxShadow: 'var(--clay)' }}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11.5px] font-extrabold tracking-[.14em] uppercase" style={{ color: 'var(--rose-ink)' }}>♡ Супервізія</span>
              <Link to="/slots" className="text-[13px] text-warm-mid hover:opacity-80 font-bold flex items-center gap-0.5 transition">
                Усі <ChevronRight size={14} />
              </Link>
            </div>
            <h3 className="font-cormorant text-[21px] font-semibold text-warm-dark mt-1.5">Найближчі слоти</h3>
            <p className="text-[13px] text-warm-light mt-0.5">Вільні слоти для запису</p>
            <Link to="/slots"
              className="mt-5 flex items-center justify-center gap-2 text-white text-[14px] font-bold rounded-[999px] px-5 py-3 hover:-translate-y-0.5 transition"
              style={{ background: 'linear-gradient(135deg,#C77E91,#A85E73)', boxShadow: 'var(--clay-sm)' }}>
              Переглянути слоти →
            </Link>
          </div>

          {/* Inspire card */}
          <div className="rounded-[36px] p-[26px_28px]"
            style={{ background: 'linear-gradient(150deg,#FBEDE4,#F5DECF)', boxShadow: 'var(--clay)' }}>
            <div className="h-[130px] rounded-[28px] overflow-hidden"
              style={{ background: 'radial-gradient(50% 60% at 30% 45%,rgba(247,200,189,.7),transparent 70%),radial-gradient(45% 55% at 72% 50%,rgba(221,231,221,.7),transparent 72%),var(--surface)', boxShadow: 'var(--clay-sm)' }} />
            <h3 className="font-cormorant text-[22px] font-semibold text-warm-dark mt-4 flex items-center gap-2">
              Безпечний простір для росту <span style={{ color: '#F5C8BD' }}>♡</span>
            </h3>
            <p className="font-cormorant italic text-[17px] text-warm-mid leading-relaxed mt-2.5">
              Супервізія — це місце, де ви можете бути собою, ділитися сумнівами та відкриттями. Кожна зустріч наближає вас до майстерності.
            </p>
          </div>

        </aside>
      </div>

      {/* ═══ MODALS ═══ */}

      {svModalOpen && (
        <div className="fixed inset-0 bg-black/25 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-[#FFF9F5] rounded-3xl shadow-[0_20px_60px_rgba(160,80,100,0.12)] w-full max-w-lg p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-cormorant text-2xl font-semibold text-warm-dark">Додати супервізію ♡</h3>
                <p className="font-cormorant italic text-warm-mid text-sm">Заповніть інформацію про зустріч</p>
              </div>
              <button onClick={() => { setSvModalOpen(false); setSvError(''); setSvForm(emptySvForm) }} className="text-warm-light hover:text-warm-mid transition"><X size={20} /></button>
            </div>
            <form onSubmit={handleSvSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Дата зустрічі</label>
                  <div className="relative">
                    <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-warm-light pointer-events-none z-10" />
                    <input type="date" value={svForm.date} onChange={setSvField('date')} required className={iconInputClass} />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Супервізор</label>
                  <select value={svForm.supervisorId} onChange={setSvField('supervisorId')} required className={inputClass}>
                    <option value="">Оберіть...</option>
                    {supervisors.map(sup => <option key={sup.id} value={sup.id}>{sup.firstName} {sup.lastName}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-warm-light uppercase tracking-widest mb-3">Тип супервізії</p>
                <div className="grid grid-cols-2 gap-2">
                  {SUPERVISION_TYPES.map(t => (
                    <label key={t.value} className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition ${svForm.type === t.value ? 'border-rose bg-rose-lighter' : 'border-sand bg-[#FFF9F5] hover:border-rose-light'}`}>
                      <input type="radio" name="type" value={t.value} checked={svForm.type === t.value} onChange={setSvField('type')} className="sr-only" />
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${svForm.type === t.value ? 'border-rose' : 'border-sand'}`}>
                        {svForm.type === t.value && <div className="w-2 h-2 rounded-full bg-rose" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-warm-dark leading-tight">{t.label}</p>
                        <p className="text-xs text-warm-light mt-0.5">{t.sub}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              {isGroupType && (
                <div>
                  <p className="text-xs font-medium text-warm-light uppercase tracking-widest mb-3">Тривалість</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <select value={svForm.hours} onChange={setSvField('hours')} className={inputClass}>
                      {[0,1,2,3,4,5,6,7,8].map(h => <option key={h} value={h}>{h} год</option>)}
                    </select>
                    <select value={svForm.minutes} onChange={setSvField('minutes')} className={inputClass}>
                      {[0,15,30,45].map(m => <option key={m} value={m}>{m} хв</option>)}
                    </select>
                  </div>
                </div>
              )}
              {svError && <p className="text-[#A86060] text-sm bg-[#F8EEEE] rounded-2xl px-4 py-2.5">{svError}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setSvModalOpen(false); setSvError(''); setSvForm(emptySvForm) }}
                  className="flex-1 border border-[#EBDDD0] bg-white text-warm-mid rounded-2xl px-4 py-3 text-sm hover:bg-cream transition">Скасувати</button>
                <button type="submit" disabled={svSubmitting}
                  className="flex-1 text-white font-medium rounded-2xl px-6 py-3 text-sm transition disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#C77E91,#A85E73)' }}>
                  {svSubmitting ? 'Зберігаємо...' : 'Зберегти та відправити'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {skillsModalOpen && (
        <div className="fixed inset-0 bg-black/25 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-[#FFF9F5] rounded-3xl shadow-[0_20px_60px_rgba(160,80,100,0.12)] w-full max-w-md p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-cormorant text-2xl font-semibold text-warm-dark">Група навичок ♡</h3>
                <p className="font-cormorant italic text-warm-mid text-sm">Заповніть інформацію про участь у групі</p>
              </div>
              <button onClick={() => { setSkillsModalOpen(false); setSkillsError(''); setSkillsForm(emptySkillsForm) }} className="text-warm-light hover:text-warm-mid transition"><X size={20} /></button>
            </div>
            <form onSubmit={handleSkillsSubmit} className="space-y-5">
              <div>
                <label className={labelClass}>Дата зустрічі</label>
                <div className="relative">
                  <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-warm-light pointer-events-none z-10" />
                  <input type="date" value={skillsForm.date} onChange={setSkillsField('date')} required className={iconInputClass} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Супервізор</label>
                <select value={skillsForm.supervisorId} onChange={setSkillsField('supervisorId')} required className={inputClass}>
                  <option value="">Оберіть...</option>
                  {supervisors.map(sup => <option key={sup.id} value={sup.id}>{sup.firstName} {sup.lastName}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Тривалість</label>
                <div className="grid grid-cols-2 gap-3">
                  <select value={skillsForm.hours} onChange={setSkillsField('hours')} className={inputClass}>
                    {[0,1,2,3,4,5,6,7,8].map(h => <option key={h} value={h}>{h} год</option>)}
                  </select>
                  <select value={skillsForm.minutes} onChange={setSkillsField('minutes')} className={inputClass}>
                    {[0,15,30,45].map(m => <option key={m} value={m}>{m} хв</option>)}
                  </select>
                </div>
              </div>
              {skillsError && <p className="text-[#A86060] text-sm bg-[#F8EEEE] rounded-2xl px-4 py-2.5">{skillsError}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setSkillsModalOpen(false); setSkillsError(''); setSkillsForm(emptySkillsForm) }}
                  className="flex-1 border border-[#EBDDD0] bg-white text-warm-mid rounded-2xl px-4 py-3 text-sm hover:bg-cream transition">Скасувати</button>
                <button type="submit" disabled={skillsSubmitting}
                  className="flex-1 text-white font-medium rounded-2xl px-6 py-3 text-sm transition disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#C77E91,#A85E73)' }}>
                  {skillsSubmitting ? 'Зберігаємо...' : 'Зберегти та відправити'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {semModalOpen && (
        <div className="fixed inset-0 bg-black/25 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-[#FFF9F5] rounded-3xl shadow-[0_20px_60px_rgba(160,80,100,0.12)] w-full max-w-lg p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-cormorant text-2xl font-semibold text-warm-dark">Додати семінар ♡</h3>
                <p className="font-cormorant italic text-warm-mid text-sm">Заповніть інформацію про навчальний захід</p>
              </div>
              <button onClick={closeSemModal} className="text-warm-light hover:text-warm-mid transition"><X size={20} /></button>
            </div>
            <form onSubmit={handleSemSubmit} className="space-y-4">
              <div>
                <label className={labelClass}>Назва семінару *</label>
                <input type="text" value={semForm.title} onChange={setSemField('title')} required placeholder="Введіть назву..." className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Дата *</label>
                <div className="relative">
                  <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-warm-light pointer-events-none z-10" />
                  <input type="date" value={semForm.date} onChange={setSemField('date')} required className={iconInputClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Годин *</label>
                  <input type="number" value={semForm.hours} onChange={setSemField('hours')} required min="0.5" step="0.5" placeholder="8" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Балів</label>
                  <input type="number" value={semForm.points} onChange={setSemField('points')} min="0" step="0.5" placeholder="3" className={inputClass} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Сертифікат</label>
                <div
                  onClick={() => semFileRef.current?.click()}
                  onDrop={handleSemDrop}
                  onDragOver={e => { e.preventDefault(); setSemDragOver(true) }}
                  onDragLeave={() => setSemDragOver(false)}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition ${semDragOver ? 'border-rose bg-rose-lighter' : 'border-sand hover:border-rose-light'}`}
                >
                  <Upload size={18} className={`mx-auto mb-2 ${semFile ? 'text-rose' : 'text-warm-light'}`} />
                  {semFile
                    ? <p className="text-sm text-warm-dark font-medium">{semFile.name}</p>
                    : <>
                        <p className="text-sm text-warm-mid">Завантажте файл сертифікату</p>
                        <p className="text-xs text-warm-light mt-0.5">PDF, JPG або PNG · до 10 МБ</p>
                      </>
                  }
                </div>
                <input ref={semFileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={e => setSemFile(e.target.files?.[0] ?? null)} className="hidden" />
              </div>
              {semError && <p className="text-[#A86060] text-sm bg-[#F8EEEE] rounded-2xl px-4 py-2.5">{semError}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={closeSemModal}
                  className="flex-1 border border-[#EBDDD0] bg-white text-warm-mid rounded-2xl px-4 py-3 text-sm hover:bg-cream transition">Скасувати</button>
                <button type="submit" disabled={semSubmitting}
                  className="flex-1 text-white font-medium rounded-2xl px-6 py-3 text-sm transition disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#C77E91,#A85E73)' }}>
                  {semSubmitting ? 'Додаємо...' : 'Додати'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showReport && (
        <ReportModal
          defaultSections={activeTab === 'seminars' ? 'seminars' : 'all'}
          onClose={() => setShowReport(false)}
        />
      )}
    </Layout>
  )
}
