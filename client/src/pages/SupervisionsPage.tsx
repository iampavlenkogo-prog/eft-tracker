import { useState, useEffect, useRef } from 'react'
import { X, Plus, Users, User, Search, ChevronDown, BookOpen, Calendar, Clock, CheckCircle, XCircle, Clock3, FileText, ExternalLink, Upload, Award } from 'lucide-react'
import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import ReportModal from '../components/ReportModal'
import api from '../api/axios'

// ── Types ──────────────────────────────────────────────────

type RecordStatus = 'PENDING' | 'APPROVED' | 'REJECTED'
type SupervisionType = 'INDIVIDUAL_PRESENTER' | 'INDIVIDUAL_LISTENER' | 'GROUP_PRESENTER' | 'GROUP_LISTENER'
type TabFilter = 'all' | 'pending' | 'approved' | 'rejected'
type SubTab = 'supervisions' | 'skills' | 'bookings'
type MainTab = 'supervisions' | 'seminars'

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

const BOOKING_STATUS: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  PENDING:   { label: 'Очікує підтвердження', cls: 'bg-[#FBF0E8] text-[#B07840]', icon: <Clock3 size={13} /> },
  APPROVED:  { label: 'Підтверджено',         cls: 'bg-[#EEF2EE] text-[#6A9870]',  icon: <CheckCircle size={13} /> },
  REJECTED:  { label: 'Відхилено',            cls: 'bg-[#F8EEEE] text-[#A86060]',  icon: <XCircle size={13} /> },
  COMPLETED: { label: 'Завершено',            cls: 'bg-[#EEF2F8] text-[#7090B0]',  icon: <CheckCircle size={13} /> },
  CANCELLED: { label: 'Скасовано',            cls: 'bg-sand text-warm-light',       icon: <XCircle size={13} /> },
}
const STATUS_STYLES: Record<RecordStatus, { label: string; cls: string }> = {
  PENDING:  { label: 'Очікує',       cls: 'bg-[#FBF0E8] text-[#B07840]' },
  APPROVED: { label: 'Підтверджено', cls: 'bg-[#EEF2EE] text-[#6A9870]' },
  REJECTED: { label: 'Відхилено',   cls: 'bg-[#F8EEEE] text-[#A86060]' },
}
const TYPE_LABELS: Record<SupervisionType, string> = {
  INDIVIDUAL_PRESENTER: 'Індивідуальна • Подання випадку',
  INDIVIDUAL_LISTENER: 'Індивідуальна • Слухач',
  GROUP_PRESENTER: 'Групова • Подання випадку',
  GROUP_LISTENER: 'Групова • Слухач',
}
const TYPE_SHORT: Record<SupervisionType, string> = {
  INDIVIDUAL_PRESENTER: 'Індив. (подача)',
  INDIVIDUAL_LISTENER: 'Індив. (слухач)',
  GROUP_PRESENTER: 'Групова (подача)',
  GROUP_LISTENER: 'Групова (слухач)',
}
const SUPERVISION_TYPES: { value: SupervisionType; label: string; sub: string }[] = [
  { value: 'INDIVIDUAL_PRESENTER', label: 'Індивідуальна', sub: 'Подання випадку' },
  { value: 'INDIVIDUAL_LISTENER', label: 'Індивідуальна', sub: 'Слухач' },
  { value: 'GROUP_PRESENTER',     label: 'Групова',        sub: 'Подання випадку' },
  { value: 'GROUP_LISTENER',      label: 'Групова',        sub: 'Слухач' },
]
const GROUP_STATUS_LABELS: Record<string, string> = {
  WAITING_FOR_CASE: 'Очікує супервізанта',
  CASE_CONFIRMED: 'Супервізанта визначено',
  REGISTRATION_OPEN: 'Реєстрація відкрита',
  REGISTRATION_CLOSED: 'Реєстрація закрита',
  WAITING_FOR_RECORDING: 'Очікує запис',
  RECORDING_AVAILABLE: 'Запис доступний',
}
const PAYMENT_LABELS: Record<string, { label: string; cls: string }> = {
  PENDING:          { label: 'Очікує оплати',       cls: 'bg-[#FBF0E8] text-[#B07840]' },
  RECEIPT_UPLOADED: { label: 'Квитанцію надіслано', cls: 'bg-[#EEF2F8] text-[#7090B0]' },
  CONFIRMED:        { label: 'Оплату підтверджено', cls: 'bg-[#EEF2EE] text-[#6A9870]' },
  FREE:             { label: 'Безкоштовно',          cls: 'bg-[#F2EEF8] text-[#9080B0]' },
}
const GROUP_TYPES: SupervisionType[] = ['GROUP_PRESENTER', 'GROUP_LISTENER']
const emptySvForm = { date: '', supervisorId: '', type: 'INDIVIDUAL_PRESENTER' as SupervisionType, hours: '1', minutes: '0' }
const emptySkillsForm = { date: '', supervisorId: '', hours: '1', minutes: '0' }
const emptySemForm = { title: '', date: '', hours: '', points: '' }

// ── Helpers ────────────────────────────────────────────────

function tgLink(handle: string | null | undefined): string | null {
  if (!handle) return null
  const u = handle.replace('@', '').trim()
  return u ? `https://t.me/${u}` : null
}
function initials(f: string, l: string) { return `${f[0] ?? ''}${l[0] ?? ''}`.toUpperCase() }
function formatHours(h: number) {
  const hrs = Math.floor(h)
  const mins = Math.round((h - hrs) * 60)
  return mins === 0 ? `${hrs} год` : `${hrs} год ${mins} хв`
}

// ── Component ──────────────────────────────────────────────

export default function SupervisionsPage({ defaultTab = 'supervisions' }: { defaultTab?: MainTab }) {
  const [mainTab, setMainTab] = useState<MainTab>(defaultTab)
  const [showReport, setShowReport] = useState(false)

  // ── Input styles ──
  const inputClass = 'w-full bg-white border border-sand/50 rounded-2xl px-4 py-3 text-sm text-warm-dark placeholder:text-warm-light/50 focus:outline-none focus:border-rose/40 focus:ring-2 focus:ring-rose/10 transition'
  const iconInputClass = 'w-full bg-white border border-sand/50 rounded-2xl pl-9 pr-4 py-2.5 text-sm text-warm-dark placeholder:text-warm-light/50 focus:outline-none focus:border-rose/40 focus:ring-2 focus:ring-rose/10 transition'
  const labelClass = 'block text-xs font-medium text-warm-light uppercase tracking-wider mb-2'

  // ════════════════════════════════════════════════
  // SUPERVISIONS STATE
  // ════════════════════════════════════════════════
  const [subTab, setSubTab] = useState<SubTab>('supervisions')
  const [supervisions, setSupervisions] = useState<Supervision[]>([])
  const [supervisors, setSupervisors] = useState<Supervisor[]>([])
  const [svLoading, setSvLoading] = useState(true)
  const [svModalOpen, setSvModalOpen] = useState(false)
  const [svSubmitting, setSvSubmitting] = useState(false)
  const [svError, setSvError] = useState('')
  const [svForm, setSvForm] = useState(emptySvForm)
  const [svSearch, setSvSearch] = useState('')
  const [svStatusFilter, setSvStatusFilter] = useState<RecordStatus | 'all'>('all')
  const [svTypeFilter, setSvTypeFilter] = useState<SupervisionType | 'all'>('all')
  const [svTab, setSvTab] = useState<TabFilter>('all')
  const [myGroups, setMyGroups] = useState<MyGroupRegistration[]>([])
  const [bookings, setBookings] = useState<BookingItem[]>([])
  const [bookingsLoaded, setBookingsLoaded] = useState(false)

  // Skills Groups
  const [skills, setSkills] = useState<SkillsGroup[]>([])
  const [skillsLoading, setSkillsLoading] = useState(false)
  const [skillsLoaded, setSkillsLoaded] = useState(false)
  const [skillsModalOpen, setSkillsModalOpen] = useState(false)
  const [skillsSubmitting, setSkillsSubmitting] = useState(false)
  const [skillsError, setSkillsError] = useState('')
  const [skillsForm, setSkillsForm] = useState(emptySkillsForm)
  const [skillsTab, setSkillsTab] = useState<TabFilter>('all')

  useEffect(() => {
    api.get('/supervisions').then(res => setSupervisions(res.data)).finally(() => setSvLoading(false))
    api.get('/group-supervisions/mine').then(res => setMyGroups(res.data)).catch(() => {})
  }, [])

  useEffect(() => {
    if (subTab === 'bookings' && !bookingsLoaded) {
      api.get('/bookings/my').then(res => { setBookings(res.data); setBookingsLoaded(true) }).catch(() => {})
    }
  }, [subTab])

  useEffect(() => {
    if (subTab === 'skills' && !skillsLoaded) {
      setSkillsLoading(true)
      api.get('/skills-groups').then(res => { setSkills(res.data); setSkillsLoaded(true) }).finally(() => setSkillsLoading(false))
    }
  }, [subTab])

  const loadSupervisors = async () => {
    if (supervisors.length === 0) {
      const res = await api.get('/users/supervisors')
      setSupervisors(res.data)
    }
  }

  const setSvField = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setSvForm(prev => ({ ...prev, [field]: e.target.value }))
  const setSkillsField = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setSkillsForm(prev => ({ ...prev, [field]: e.target.value }))

  const isGroupType = GROUP_TYPES.includes(svForm.type)

  const handleSvSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSvError(''); setSvSubmitting(true)
    try {
      const totalHours = isGroupType ? Number(svForm.hours) + Number(svForm.minutes) / 60 : 1
      const res = await api.post('/supervisions', { ...svForm, hours: totalHours })
      setSupervisions(prev => [res.data, ...prev])
      setSvModalOpen(false); setSvError(''); setSvForm(emptySvForm)
    } catch (err: any) { setSvError(err.response?.data?.error || 'Помилка') }
    finally { setSvSubmitting(false) }
  }

  const handleSkillsSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSkillsError(''); setSkillsSubmitting(true)
    try {
      const totalHours = Number(skillsForm.hours) + Number(skillsForm.minutes) / 60
      const res = await api.post('/skills-groups', { ...skillsForm, hours: Math.max(0.5, totalHours) })
      setSkills(prev => [res.data, ...prev])
      setSkillsModalOpen(false); setSkillsError(''); setSkillsForm(emptySkillsForm)
    } catch (err: any) { setSkillsError(err.response?.data?.error || 'Помилка') }
    finally { setSkillsSubmitting(false) }
  }

  const svPending = supervisions.filter(s => s.status === 'PENDING')
  const skillsPending = skills.filter(s => s.status === 'PENDING')
  const filteredSv = supervisions.filter(s => {
    const tabOk = svTab === 'all' || s.status === svTab.toUpperCase()
    const statusOk = svStatusFilter === 'all' || s.status === svStatusFilter
    const typeOk = svTypeFilter === 'all' || s.type === svTypeFilter
    const searchOk = svSearch === '' ||
      `${s.supervisor.firstName} ${s.supervisor.lastName}`.toLowerCase().includes(svSearch.toLowerCase()) ||
      TYPE_LABELS[s.type].toLowerCase().includes(svSearch.toLowerCase())
    return tabOk && statusOk && typeOk && searchOk
  })
  const filteredSkills = skills.filter(s => skillsTab === 'all' || s.status === skillsTab.toUpperCase())

  // ════════════════════════════════════════════════
  // SEMINARS STATE
  // ════════════════════════════════════════════════
  const [seminars, setSeminars] = useState<Seminar[]>([])
  const [semLoading, setSemLoading] = useState(false)
  const [semLoaded, setSemLoaded] = useState(false)
  const [semModalOpen, setSemModalOpen] = useState(false)
  const [semSubmitting, setSemSubmitting] = useState(false)
  const [semError, setSemError] = useState('')
  const [semForm, setSemForm] = useState(emptySemForm)
  const [semFile, setSemFile] = useState<File | null>(null)
  const [semDragOver, setSemDragOver] = useState(false)
  const semFileRef = useRef<HTMLInputElement>(null)
  const [semSearch, setSemSearch] = useState('')
  const [semStatusFilter, setSemStatusFilter] = useState<RecordStatus | 'all'>('all')

  useEffect(() => {
    if (mainTab === 'seminars' && !semLoaded) {
      setSemLoading(true)
      api.get('/seminars').then(res => { setSeminars(res.data); setSemLoaded(true) }).finally(() => setSemLoading(false))
    }
  }, [mainTab])

  const setSemField = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setSemForm(prev => ({ ...prev, [field]: e.target.value }))

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

  const semApproved = seminars.filter(s => s.status === 'APPROVED')
  const semTotalHours = semApproved.reduce((sum, s) => sum + s.hours, 0)
  const semTotalCerts = semApproved.filter(s => s.certificateUrl).length

  const filteredSem = seminars.filter(s => {
    const statusOk = semStatusFilter === 'all' || s.status === semStatusFilter
    const searchOk = semSearch === '' || s.title.toLowerCase().includes(semSearch.toLowerCase())
    return statusOk && searchOk
  })

  // ════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════
  return (
    <Layout>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">

          {/* ── Header ── */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <h1 className="font-cormorant text-3xl text-warm-dark font-semibold">
                {mainTab === 'supervisions' ? 'Супервізії ♡' : 'Семінари ♡'}
              </h1>
              <p className="font-cormorant italic text-warm-mid mt-0.5">
                {mainTab === 'supervisions' ? 'Ваші супервізійні зустрічі та групи навичок' : 'Ваші навчальні заходи'}
              </p>
            </div>
            <button
              onClick={() => setShowReport(true)}
              className="flex items-center gap-2 border border-[#EBDDD0] bg-white text-warm-mid rounded-xl px-4 py-2.5 text-sm hover:bg-[#FFF4EC] hover:border-[#C07888]/30 transition neu-btn shrink-0 mt-1"
            >
              <FileText size={14} />Звіт
            </button>
          </div>

          {/* ── Main tabs ── */}
          <div className="flex gap-1.5 mb-6">
            {([
              { key: 'supervisions' as MainTab, label: 'Супервізії', count: svPending.length },
              { key: 'seminars'     as MainTab, label: 'Семінари',   count: null },
            ]).map(t => (
              <button
                key={t.key}
                onClick={() => setMainTab(t.key)}
                className={`flex items-center gap-1.5 px-5 py-2.5 rounded-2xl text-sm font-medium transition-all ${
                  mainTab === t.key
                    ? 'bg-gradient-to-br from-[#C07888] to-[#A06070] text-white shadow-sm'
                    : 'bg-white border border-sand text-warm-mid hover:border-rose/30 hover:text-warm-dark'
                }`}
              >
                {t.label}
                {t.count != null && t.count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${mainTab === t.key ? 'bg-white/25 text-white' : 'bg-rose-light text-rose'}`}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ════ SUPERVISIONS SECTION ════ */}
          {mainTab === 'supervisions' && (
            <>
              {/* My Group Supervisions */}
              {myGroups.length > 0 && (
                <div className="mb-6">
                  <p className="text-xs text-warm-light uppercase tracking-widest font-medium mb-3">Мої групові супервізії</p>
                  <div className="space-y-3">
                    {myGroups.map(g => {
                      const p = g.myParticipation
                      const pb = PAYMENT_LABELS[p.paymentStatus]
                      const isPast = new Date(`${g.scheduledDate}T${g.scheduledTime}`) < new Date()
                      return (
                        <div key={g.id} className="bg-white rounded-2xl shadow-sm overflow-hidden p-5">
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
                          {p.paymentStatus === 'RECEIPT_UPLOADED' && (
                            <p className="text-xs text-[#7090B0] mb-3">📎 Квитанцію надіслано — очікуйте підтвердження</p>
                          )}
                          {g.zoomLink && !isPast && (
                            <div className="flex items-center gap-3 mb-3">
                              <a href={g.zoomLink} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 bg-gradient-to-br from-[#C07888] to-[#A06070] text-white text-xs font-medium px-4 py-2 rounded-xl neu-btn-primary hover:opacity-90 transition">
                                🎥 Приєднатися до Zoom
                              </a>
                              {g.zoomPassword && <span className="text-xs text-warm-mid">Пароль: <span className="font-mono font-medium text-warm-dark">{g.zoomPassword}</span></span>}
                            </div>
                          )}
                          {g.recordingUrl && (
                            <div className="mb-3">
                              <a href={g.recordingUrl} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 bg-[#E3F2FD] hover:bg-[#BBDEFB] text-[#7090B0] text-xs font-medium px-4 py-2 rounded-xl transition">
                                🎬 Переглянути запис
                              </a>
                              {g.recordingExpiresAt && <span className="text-xs text-warm-light ml-2">до {new Date(g.recordingExpiresAt).toLocaleDateString('uk-UA')}</span>}
                            </div>
                          )}
                          <Link to={`/group-supervisions/${g.id}`} className="text-xs text-rose hover:opacity-80 font-medium transition">Детальніше →</Link>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Sub-tabs */}
              <div className="flex gap-6 border-b border-sand mb-5">
                <button onClick={() => setSubTab('supervisions')}
                  className={`pb-3 text-sm font-medium transition ${subTab === 'supervisions' ? 'border-b-2 border-rose text-rose' : 'text-warm-mid hover:text-warm-dark'}`}>
                  Супервізії
                  {svPending.length > 0 && <span className="ml-1.5 text-xs bg-rose-light text-rose px-1.5 py-0.5 rounded-full">{svPending.length}</span>}
                </button>
                <button onClick={() => setSubTab('skills')}
                  className={`pb-3 text-sm font-medium transition ${subTab === 'skills' ? 'border-b-2 border-rose text-rose' : 'text-warm-mid hover:text-warm-dark'}`}>
                  Група навичок
                  {skillsPending.length > 0 && <span className="ml-1.5 text-xs bg-rose-light text-rose px-1.5 py-0.5 rounded-full">{skillsPending.length}</span>}
                </button>
                <button onClick={() => setSubTab('bookings')}
                  className={`pb-3 text-sm font-medium transition ${subTab === 'bookings' ? 'border-b-2 border-rose text-rose' : 'text-warm-mid hover:text-warm-dark'}`}>
                  Бронювання
                </button>
              </div>

              {/* ── Sub: Supervisions ── */}
              {subTab === 'supervisions' && (
                <>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <div className="relative flex-1 min-w-[180px]">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-warm-light" />
                      <input value={svSearch} onChange={e => setSvSearch(e.target.value)} placeholder="Пошук..."
                        className="w-full bg-[#FFF9F5] border border-[#EDE5DE] rounded-xl pl-9 pr-4 py-2.5 text-sm text-warm-dark placeholder:text-[#9A8878] focus:outline-none focus:border-[#B8A8A4]/60 transition" />
                    </div>
                    <div className="relative">
                      <select value={svStatusFilter} onChange={e => setSvStatusFilter(e.target.value as RecordStatus | 'all')}
                        className="appearance-none bg-[#FFF9F5] border border-[#EDE5DE] rounded-xl px-4 py-2.5 pr-8 text-sm text-warm-dark focus:outline-none focus:border-[#B8A8A4]/60 transition">
                        <option value="all">Статус: Усі</option>
                        <option value="PENDING">Очікує</option>
                        <option value="APPROVED">Підтверджено</option>
                      </select>
                      <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-warm-light pointer-events-none" />
                    </div>
                    <div className="relative">
                      <select value={svTypeFilter} onChange={e => setSvTypeFilter(e.target.value as SupervisionType | 'all')}
                        className="appearance-none bg-[#FFF9F5] border border-[#EDE5DE] rounded-xl px-4 py-2.5 pr-8 text-sm text-warm-dark focus:outline-none focus:border-[#B8A8A4]/60 transition">
                        <option value="all">Тип: Усі</option>
                        {SUPERVISION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                      <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-warm-light pointer-events-none" />
                    </div>
                    <button onClick={async () => { setSvModalOpen(true); await loadSupervisors() }}
                      className="flex items-center gap-2 bg-gradient-to-br from-[#C07888] to-[#A06070] text-white font-medium rounded-xl px-5 py-2.5 text-sm neu-btn-primary hover:opacity-90 transition">
                      <Plus size={15} />Додати
                    </button>
                  </div>

                  <div className="flex gap-6 border-b border-sand mb-5">
                    {([
                      { key: 'all' as TabFilter, label: 'Усі записи', count: supervisions.length },
                      { key: 'pending' as TabFilter, label: 'Очікують', count: svPending.length },
                      { key: 'approved' as TabFilter, label: 'Підтверджено', count: null },
                    ]).map(t => (
                      <button key={t.key} onClick={() => setSvTab(t.key)}
                        className={`pb-3 text-sm font-medium transition whitespace-nowrap ${svTab === t.key ? 'border-b-2 border-rose text-rose' : 'text-warm-mid hover:text-warm-dark'}`}>
                        {t.label}
                        {t.count != null && t.count > 0 && <span className="ml-1.5 text-xs bg-rose-light text-rose px-1.5 py-0.5 rounded-full">{t.count}</span>}
                      </button>
                    ))}
                  </div>

                  {svLoading ? (
                    <div className="flex justify-center py-16"><div className="w-7 h-7 border-4 border-sand border-t-rose rounded-full animate-spin" /></div>
                  ) : filteredSv.length === 0 ? (
                    <div className="text-center py-16">
                      <div className="w-14 h-14 bg-beige rounded-2xl flex items-center justify-center mx-auto mb-4"><Users size={24} className="text-warm-light" /></div>
                      <p className="text-warm-mid font-medium">Немає записів</p>
                      <p className="text-warm-light text-sm mt-1">Додайте першу супервізію</p>
                    </div>
                  ) : (
                    <>
                      <div className="sm:hidden space-y-2">
                        {filteredSv.map(s => {
                          const st = STATUS_STYLES[s.status]
                          const isGroup = s.type.startsWith('GROUP')
                          return (
                            <div key={s.id} className="bg-white rounded-2xl shadow-sm p-4">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-rose-light text-rose text-xs font-medium flex items-center justify-center shrink-0">{initials(s.supervisor.firstName, s.supervisor.lastName)}</div>
                                  <span className="text-sm font-medium text-warm-dark">{s.supervisor.firstName} {s.supervisor.lastName}</span>
                                </div>
                                <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${st.cls}`}>{st.label}</span>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-warm-light pl-10">
                                <span>{format(new Date(s.date), 'd MMM yyyy', { locale: uk })}</span>
                                <span>·</span>
                                <span className="flex items-center gap-1">{isGroup ? <Users size={11} /> : <User size={11} />}{TYPE_SHORT[s.type]}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      <div className="hidden sm:block bg-white rounded-2xl overflow-hidden shadow-sm">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-sand">
                              {['Дата', 'Супервізор', 'Тип', 'Статус'].map(h => (
                                <th key={h} className="text-left px-5 py-3 text-[11px] font-medium text-warm-light uppercase tracking-widest">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {filteredSv.map(s => {
                              const st = STATUS_STYLES[s.status]
                              const isGroup = s.type.startsWith('GROUP')
                              return (
                                <tr key={s.id} className="border-b border-[#FFF4EC] hover:bg-cream transition last:border-0">
                                  <td className="px-5 py-3.5 text-sm text-warm-mid whitespace-nowrap">{format(new Date(s.date), 'd MMM yyyy', { locale: uk })}</td>
                                  <td className="px-5 py-3.5">
                                    <div className="flex items-center gap-2">
                                      <div className="w-8 h-8 rounded-full bg-rose-light text-rose text-xs font-medium flex items-center justify-center shrink-0">{initials(s.supervisor.firstName, s.supervisor.lastName)}</div>
                                      <span className="text-sm text-warm-dark">{s.supervisor.firstName} {s.supervisor.lastName}</span>
                                    </div>
                                  </td>
                                  <td className="px-5 py-3.5">
                                    <div className="flex items-center gap-1.5 text-sm text-warm-mid">
                                      {isGroup ? <Users size={14} className="text-rose" /> : <User size={14} className="text-rose" />}
                                      {TYPE_SHORT[s.type]}
                                    </div>
                                  </td>
                                  <td className="px-5 py-3.5"><span className={`text-xs font-medium px-3 py-1 rounded-full ${st.cls}`}>{st.label}</span></td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* ── Sub: Skills Groups ── */}
              {subTab === 'skills' && (
                <>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <button onClick={async () => { setSkillsModalOpen(true); await loadSupervisors() }}
                      className="flex items-center gap-2 bg-gradient-to-br from-[#C07888] to-[#A06070] text-white font-medium rounded-xl px-5 py-2.5 text-sm neu-btn-primary hover:opacity-90 transition ml-auto">
                      <Plus size={15} />Додати участь у групі
                    </button>
                  </div>
                  <div className="flex gap-6 border-b border-sand mb-5">
                    {([
                      { key: 'all' as TabFilter, label: 'Усі записи', count: skills.length },
                      { key: 'pending' as TabFilter, label: 'Очікують', count: skillsPending.length },
                      { key: 'approved' as TabFilter, label: 'Підтверджено', count: null },
                    ]).map(t => (
                      <button key={t.key} onClick={() => setSkillsTab(t.key)}
                        className={`pb-3 text-sm font-medium transition whitespace-nowrap ${skillsTab === t.key ? 'border-b-2 border-rose text-rose' : 'text-warm-mid hover:text-warm-dark'}`}>
                        {t.label}
                        {t.count != null && t.count > 0 && <span className="ml-1.5 text-xs bg-rose-light text-rose px-1.5 py-0.5 rounded-full">{t.count}</span>}
                      </button>
                    ))}
                  </div>
                  {skillsLoading ? (
                    <div className="flex justify-center py-16"><div className="w-7 h-7 border-4 border-sand border-t-rose rounded-full animate-spin" /></div>
                  ) : filteredSkills.length === 0 ? (
                    <div className="text-center py-16">
                      <div className="w-14 h-14 bg-beige rounded-2xl flex items-center justify-center mx-auto mb-4"><BookOpen size={24} className="text-warm-light" /></div>
                      <p className="text-warm-mid font-medium">Немає записів</p>
                      <p className="text-warm-light text-sm mt-1">Додайте першу участь у групі навичок</p>
                    </div>
                  ) : (
                    <>
                      <div className="sm:hidden space-y-2">
                        {filteredSkills.map(s => {
                          const st = STATUS_STYLES[s.status]
                          return (
                            <div key={s.id} className="bg-white rounded-2xl shadow-sm p-4">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-rose-light text-rose text-xs font-medium flex items-center justify-center shrink-0">{initials(s.supervisor.firstName, s.supervisor.lastName)}</div>
                                  <span className="text-sm font-medium text-warm-dark">{s.supervisor.firstName} {s.supervisor.lastName}</span>
                                </div>
                                <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${st.cls}`}>{st.label}</span>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-warm-light pl-10">
                                <span>{format(new Date(s.date), 'd MMM yyyy', { locale: uk })}</span>
                                <span>·</span>
                                <span>{formatHours(s.hours)}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      <div className="hidden sm:block bg-white rounded-2xl overflow-hidden shadow-sm">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-sand">
                              {['Дата', 'Супервізор', 'Тривалість', 'Статус'].map(h => (
                                <th key={h} className="text-left px-5 py-3 text-[11px] font-medium text-warm-light uppercase tracking-widest">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {filteredSkills.map(s => {
                              const st = STATUS_STYLES[s.status]
                              return (
                                <tr key={s.id} className="border-b border-[#FFF4EC] hover:bg-cream transition last:border-0">
                                  <td className="px-5 py-3.5 text-sm text-warm-mid whitespace-nowrap">{format(new Date(s.date), 'd MMM yyyy', { locale: uk })}</td>
                                  <td className="px-5 py-3.5">
                                    <div className="flex items-center gap-2">
                                      <div className="w-8 h-8 rounded-full bg-rose-light text-rose text-xs font-medium flex items-center justify-center shrink-0">{initials(s.supervisor.firstName, s.supervisor.lastName)}</div>
                                      <span className="text-sm text-warm-dark">{s.supervisor.firstName} {s.supervisor.lastName}</span>
                                    </div>
                                  </td>
                                  <td className="px-5 py-3.5 text-sm text-warm-mid">{formatHours(s.hours)}</td>
                                  <td className="px-5 py-3.5"><span className={`text-xs font-medium px-3 py-1 rounded-full ${st.cls}`}>{st.label}</span></td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* ── Sub: Bookings ── */}
              {subTab === 'bookings' && (
                bookings.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-14 h-14 bg-beige rounded-2xl flex items-center justify-center mx-auto mb-4"><Calendar size={24} className="text-warm-light" /></div>
                    <p className="text-warm-mid font-medium">Немає бронювань</p>
                    <p className="text-warm-light text-sm mt-1">Оберіть зручний слот і подайте заявку</p>
                    <Link to="/slots" className="mt-4 inline-flex items-center gap-1.5 bg-gradient-to-br from-[#C07888] to-[#A06070] text-white font-medium rounded-xl px-6 py-2.5 text-sm neu-btn-primary hover:opacity-90 transition">
                      Переглянути слоти →
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {bookings.map(b => {
                      const cfg = BOOKING_STATUS[b.status]
                      const zoom = b.meetingLink || b.slot.supervisor.meetingLink
                      const tg = tgLink(b.slot.supervisor.telegram)
                      return (
                        <div key={b.id} className="bg-white rounded-2xl shadow-sm p-5">
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <div>
                              <div className="flex flex-wrap gap-3 text-xs text-warm-mid mb-1.5">
                                <span className="flex items-center gap-1"><Calendar size={11} className="text-warm-light" />{b.slot.date}</span>
                                <span className="flex items-center gap-1"><Clock size={11} className="text-warm-light" />{b.slot.time} · {b.slot.duration} хв</span>
                                <span className="flex items-center gap-1"><User size={11} className="text-warm-light" />{b.slot.supervisor.firstName} {b.slot.supervisor.lastName}</span>
                              </div>
                              <span className="text-xs text-warm-light">{b.slot.type === 'INDIVIDUAL' ? 'Індивідуальна' : 'Групова'}</span>
                            </div>
                            <span className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${cfg.cls}`}>{cfg.icon}{cfg.label}</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {b.status === 'APPROVED' && zoom && (
                              <a href={zoom} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 bg-gradient-to-br from-[#C07888] to-[#A06070] text-white text-xs font-medium rounded-xl px-3 py-1.5 neu-btn-primary hover:opacity-90 transition">
                                🎥 Приєднатися до зустрічі
                              </a>
                            )}
                            {(b.status === 'PENDING' || b.status === 'APPROVED') && tg && (
                              <a href={tg} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 bg-[#229ED9] hover:bg-[#1a8bc2] text-white text-xs font-medium rounded-xl px-3 py-1.5 transition">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.26 14.4l-2.95-.924c-.64-.203-.658-.64.135-.954l11.57-4.461c.537-.194 1.006.131.88.16z"/></svg>
                                Написати супервізору
                              </a>
                            )}
                          </div>
                          {b.status === 'COMPLETED' && (
                            <p className="text-xs text-[#7090B0] mt-2 bg-[#E3F2FD] rounded-xl px-3 py-2">✅ Завершено — запис додано до журналу</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              )}
            </>
          )}

          {/* ════ SEMINARS SECTION ════ */}
          {mainTab === 'seminars' && (
            <>
              <div className="flex flex-wrap gap-2 mb-4">
                <div className="relative flex-1 min-w-[180px]">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-warm-light" />
                  <input value={semSearch} onChange={e => setSemSearch(e.target.value)} placeholder="Пошук..."
                    className="w-full bg-[#FFF9F5] border border-[#EDE5DE] rounded-xl pl-9 pr-4 py-2.5 text-sm text-warm-dark placeholder:text-[#9A8878] focus:outline-none focus:border-[#B8A8A4]/60 transition" />
                </div>
                <div className="relative">
                  <select value={semStatusFilter} onChange={e => setSemStatusFilter(e.target.value as RecordStatus | 'all')}
                    className="appearance-none bg-[#FFF9F5] border border-[#EDE5DE] rounded-xl px-4 py-2.5 pr-8 text-sm text-warm-dark focus:outline-none focus:border-[#B8A8A4]/60 transition">
                    <option value="all">Статус: Усі</option>
                    <option value="PENDING">Очікує</option>
                    <option value="APPROVED">Підтверджено</option>
                    <option value="REJECTED">Відхилено</option>
                  </select>
                  <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-warm-light pointer-events-none" />
                </div>
                <button onClick={() => setSemModalOpen(true)}
                  className="flex items-center gap-2 bg-gradient-to-br from-[#C07888] to-[#A06070] text-white font-medium rounded-2xl px-5 py-2.5 text-sm neu-btn-primary hover:opacity-90 transition">
                  <Plus size={15} />Додати
                </button>
              </div>

              {semLoading ? (
                <div className="flex justify-center py-16"><div className="w-7 h-7 border-4 border-sand border-t-rose rounded-full animate-spin" /></div>
              ) : seminars.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-14 h-14 bg-beige rounded-2xl flex items-center justify-center mx-auto mb-4"><BookOpen size={24} className="text-warm-light" /></div>
                  <p className="text-warm-mid font-medium">Ще немає семінарів</p>
                  <p className="text-warm-light text-sm mt-1">Додайте перший запис після навчання</p>
                </div>
              ) : filteredSem.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-14 h-14 bg-beige rounded-2xl flex items-center justify-center mx-auto mb-4"><BookOpen size={24} className="text-warm-light" /></div>
                  <p className="text-warm-mid font-medium">Нічого не знайдено</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredSem.map(s => {
                    const st = STATUS_STYLES[s.status]
                    return (
                      <div key={s.id} className="bg-white rounded-2xl shadow-sm p-5 flex items-center gap-4">
                        <div className="w-20 h-20 bg-beige rounded-xl flex items-center justify-center shrink-0 p-2">
                          <img src="/illustrations/books-coffee.png" alt="" className="w-full h-full object-contain" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <p className="text-sm font-medium text-warm-dark leading-snug">{s.title}</p>
                            <span className={`shrink-0 text-xs font-medium px-3 py-1 rounded-full ${st.cls}`}>{st.label}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="text-xs text-warm-light">🕐 {s.hours} год.</span>
                            {s.points > 0 && <span className="text-xs text-warm-light">⭐ {s.points} балів</span>}
                            <span className="text-xs text-warm-light">{format(new Date(s.date), 'd MMM yyyy', { locale: uk })}</span>
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
                                <FileText size={11} />Сертифікат<ExternalLink size={10} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}

        </div>

        {/* ── Right sidebar ── */}
        <div className="space-y-4">
          {mainTab === 'supervisions' ? (
            <div className="bg-beige rounded-2xl overflow-hidden">
              <img src="/illustrations/chairs.png" alt="" className="w-full -mt-24 -mb-24" />
              <div className="px-6 pb-6 pt-2">
                <h3 className="font-cormorant text-xl font-semibold text-warm-dark mb-3">Безпечний простір для росту ♡</h3>
                <p className="font-cormorant italic text-warm-mid text-sm leading-relaxed">
                  Супервізія — це місце, де ви можете бути собою, ділитися сумнівами та відкриттями. Кожна зустріч наближає вас до майстерності.
                </p>
                <div className="mt-4 text-3xl text-rose-light text-center">♡</div>
              </div>
            </div>
          ) : (
            <>
              <div className="bg-beige rounded-2xl p-6">
                <p className="text-xs text-warm-light uppercase tracking-widest mb-4 font-medium">Статистика навчання</p>
                <div className="space-y-3">
                  {[
                    { icon: BookOpen, label: 'Пройдено семінарів', value: semApproved.length },
                    { icon: Clock,    label: 'Годин навчання',     value: semTotalHours },
                    { icon: Award,    label: 'Сертифікатів',       value: semTotalCerts },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-3 py-2 border-b border-sand/50 last:border-0">
                      <item.icon size={16} strokeWidth={1.75} className="text-warm-light shrink-0" />
                      <div className="flex-1"><p className="text-xs text-warm-light leading-tight">{item.label}</p></div>
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
            </>
          )}
        </div>
      </div>

      {/* ═══ MODALS ═══ */}

      {/* Add Supervision */}
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
                    <input type="date" value={svForm.date} onChange={setSvField('date')} required placeholder="дд.мм.рр" className={iconInputClass} />
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
                  className="flex-1 border border-[#EBDDD0] bg-white text-warm-mid rounded-2xl px-4 py-3 text-sm hover:bg-cream hover:border-rose/30 transition">
                  Скасувати
                </button>
                <button type="submit" disabled={svSubmitting}
                  className="flex-1 bg-gradient-to-br from-[#C07888] to-[#A06070] text-white font-medium rounded-2xl px-6 py-3 text-sm neu-btn-primary hover:opacity-90 transition disabled:opacity-50">
                  {svSubmitting ? 'Зберігаємо...' : 'Зберегти та відправити'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Skills Group */}
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
                  <input type="date" value={skillsForm.date} onChange={setSkillsField('date')} required placeholder="дд.мм.рр" className={iconInputClass} />
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  className="flex-1 border border-[#EBDDD0] bg-white text-warm-mid rounded-2xl px-4 py-3 text-sm hover:bg-cream hover:border-rose/30 transition">
                  Скасувати
                </button>
                <button type="submit" disabled={skillsSubmitting}
                  className="flex-1 bg-gradient-to-br from-[#C07888] to-[#A06070] text-white font-medium rounded-2xl px-6 py-3 text-sm neu-btn-primary hover:opacity-90 transition disabled:opacity-50">
                  {skillsSubmitting ? 'Зберігаємо...' : 'Зберегти та відправити'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Seminar */}
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
                  <input type="date" value={semForm.date} onChange={setSemField('date')} required placeholder="дд.мм.рр" className={iconInputClass} />
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
                  {semFile ? (
                    <p className="text-sm text-warm-dark font-medium">{semFile.name}</p>
                  ) : (
                    <>
                      <p className="text-sm text-warm-mid">Завантажте файл сертифікату</p>
                      <p className="text-xs text-warm-light mt-0.5">PDF, JPG або PNG · до 10 МБ</p>
                    </>
                  )}
                </div>
                <input ref={semFileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={e => setSemFile(e.target.files?.[0] ?? null)} className="hidden" />
              </div>
              {semError && <p className="text-[#A86060] text-sm bg-[#F8EEEE] rounded-2xl px-4 py-2.5">{semError}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={closeSemModal}
                  className="flex-1 border border-[#EBDDD0] bg-white text-warm-mid rounded-2xl px-4 py-3 text-sm hover:bg-cream hover:border-rose/30 transition">
                  Скасувати
                </button>
                <button type="submit" disabled={semSubmitting}
                  className="flex-1 bg-gradient-to-br from-[#C07888] to-[#A06070] text-white font-medium rounded-2xl px-6 py-3 text-sm neu-btn-primary hover:opacity-90 transition disabled:opacity-50">
                  {semSubmitting ? 'Додаємо...' : 'Додати'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showReport && (
        <ReportModal
          defaultSections={mainTab === 'seminars' ? 'seminars' : 'all'}
          onClose={() => setShowReport(false)}
        />
      )}
    </Layout>
  )
}
