import { useState, useRef, useEffect } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { Edit3, Lock, Check, X, Camera, Calendar, ChevronRight, User as UserIcon } from 'lucide-react'
import Layout from '../components/Layout'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'


const EFT_LEVELS = [
  { value: 'BASIC', label: 'Базовий курс' },
  { value: 'ADVANCED', label: 'Поглиблений курс' },
  { value: 'STUDENT', label: 'Студент Інституту ЕФТ' },
  { value: 'CERTIFIED', label: 'Сертифікований терапевт' },
  { value: 'SUPERVISOR_CANDIDATE', label: 'Кандидат у супервізори' },
  { value: 'SUPERVISOR', label: 'Сертифікований супервізор' },
]

const EFT_LABELS: Record<string, string> = Object.fromEntries(EFT_LEVELS.map(l => [l.value, l.label]))
const ROLE_LABELS: Record<string, string> = {
  THERAPIST: 'Терапевт',
  SUPERVISOR_CANDIDATE: 'Кандидат у супервізори',
  SUPERVISOR: 'Супервізор',
  ADMIN: 'Адмін',
}

const inputClass = 'w-full bg-white border border-sand/50 rounded-2xl px-4 py-3 text-sm text-warm-dark placeholder:text-warm-light/50 focus:outline-none focus:border-rose/40 focus:ring-2 focus:ring-rose/10 transition'
const labelClass = 'block text-xs font-medium text-warm-light uppercase tracking-wider mb-2'

interface ProfileStats { supervisions: number; seminars: number }

interface UnifiedActivity {
  key: string
  kind: 'event' | 'booking' | 'group'
  title: string
  dateLabel: string
  sortTs: number
  organizer: string
  statusLabel: string
  statusCls: string
  link: string
  coverUrl?: string | null
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  PENDING:           { label: 'Очікує',        cls: 'bg-[#FBF0E8] text-[#B07840]' },
  APPROVED:          { label: 'Підтверджено',  cls: 'bg-[#EEF2EE] text-[#6A9870]' },
  CONFIRMED:         { label: 'Підтверджено',  cls: 'bg-[#EEF2EE] text-[#6A9870]' },
  REJECTED:          { label: 'Відхилено',     cls: 'bg-[#F8EEEE] text-[#A86060]' },
  COMPLETED:         { label: 'Завершено',     cls: 'bg-[#EEF2F8] text-[#7090B0]' },
  CANCELLED:         { label: 'Скасовано',     cls: 'bg-sand text-warm-light' },
  ANNOUNCED:         { label: 'Оголошено',     cls: 'bg-[#F0EEF8] text-[#7060A0]' },
  REGISTRATION_OPEN: { label: 'Реєстрація',    cls: 'bg-[#EEF2EE] text-[#6A9870]' },
  FREE:              { label: 'Вільно',        cls: 'bg-[#EEF2EE] text-[#6A9870]' },
}

function fmtDate(isoOrDate: string, time?: string): { label: string; ts: number } {
  let d: Date
  if (time) {
    const [y, m, day] = isoOrDate.split('-').map(Number)
    const [h, min] = time.split(':').map(Number)
    d = new Date(y, m - 1, day, h, min)
  } else {
    d = new Date(isoOrDate)
  }
  const dayMonth = d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' }).replace(' р.', '')
  const hhmm = d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })
  return { label: `${dayMonth} · ${hhmm}`, ts: d.getTime() }
}

function formatDateBadge(ts: number): { day: string; mon: string; time: string } {
  if (!ts || isNaN(ts)) return { day: '?', mon: '—', time: '—' }
  const d = new Date(ts)
  return {
    day: d.getDate().toString(),
    mon: d.toLocaleDateString('uk-UA', { month: 'short' }).replace('.', ''),
    time: d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }),
  }
}

export default function ProfilePage() {
  const { user, refreshUser } = useAuth()
  const [stats, setStats] = useState<ProfileStats>({ supervisions: 0, seminars: 0 })
  const [showMyData, setShowMyData] = useState(false)
  const [activities, setActivities] = useState<UnifiedActivity[]>([])
  const [activitiesLoading, setActivitiesLoading] = useState(true)

  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [profileSuccess, setProfileSuccess] = useState(false)

  const [form, setForm] = useState({
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    latinName: user?.latinName ?? '',
    phone: user?.phone ?? '',
    telegram: user?.telegram ?? '',
    meetingLink: user?.meetingLink ?? '',
    eftLevel: user?.eftLevel ?? 'BASIC',
  })

  const setField = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [f]: e.target.value }))

  const startEdit = () => {
    setForm({
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      latinName: user?.latinName ?? '',
      phone: user?.phone ?? '',
      telegram: user?.telegram ?? '',
      meetingLink: user?.meetingLink ?? '',
      eftLevel: user?.eftLevel ?? 'BASIC',
    })
    setProfileError('')
    setProfileSuccess(false)
    setIsEditing(true)
  }

  const cancelEdit = () => { setIsEditing(false); setProfileError('') }

  const handleSaveProfile = async () => {
    setSaving(true)
    setProfileError('')
    try {
      await api.patch('/auth/me', form)
      await refreshUser()
      setIsEditing(false)
      setProfileSuccess(true)
      setTimeout(() => setProfileSuccess(false), 3000)
    } catch (err: any) {
      setProfileError(err.response?.data?.error || 'Помилка збереження')
    } finally {
      setSaving(false)
    }
  }

  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarError, setAvatarError] = useState('')
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarUploading(true)
    setAvatarError('')
    try {
      const fd = new FormData()
      fd.append('avatar', file)
      await api.post('/auth/avatar', fd)
      await refreshUser()
    } catch (err: any) {
      setAvatarError(err.response?.data?.error || 'Помилка завантаження фото')
    } finally {
      setAvatarUploading(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }

  useEffect(() => {
    api.get('/dashboard/stats').then(r => setStats(r.data)).catch(() => {})

    Promise.allSettled([
      api.get('/events/my-registrations'),
      api.get('/bookings/my'),
      api.get('/group-supervisions/mine'),
    ]).then(([evRes, bkRes, gsRes]) => {
      const items: UnifiedActivity[] = []

      if (evRes.status === 'fulfilled') {
        for (const reg of evRes.value.data) {
          const ev = reg.event
          if (!ev) continue
          const { label, ts } = fmtDate(ev.startDate)
          const cfg = STATUS_MAP[reg.status] ?? { label: reg.status, cls: 'bg-sand text-warm-light' }
          items.push({
            key: `ev-${reg.id}`,
            kind: 'event',
            title: ev.title,
            dateLabel: label,
            sortTs: ts,
            organizer: `${ev.organizer.firstName} ${ev.organizer.lastName}`,
            statusLabel: cfg.label,
            statusCls: cfg.cls,
            link: `/events/${ev.id}`,
            coverUrl: ev.coverImageUrl,
          })
        }
      }

      if (bkRes.status === 'fulfilled') {
        for (const bk of bkRes.value.data) {
          const { label, ts } = fmtDate(bk.slot.date, bk.slot.time)
          const cfg = STATUS_MAP[bk.status] ?? { label: bk.status, cls: 'bg-sand text-warm-light' }
          items.push({
            key: `bk-${bk.id}`,
            kind: 'booking',
            title: `Супервізія · ${bk.slot.type === 'GROUP' ? 'групова' : 'індивідуальна'}`,
            dateLabel: label,
            sortTs: ts,
            organizer: `${bk.slot.supervisor.firstName} ${bk.slot.supervisor.lastName}`,
            statusLabel: cfg.label,
            statusCls: cfg.cls,
            link: '/my-bookings',
          })
        }
      }

      if (gsRes.status === 'fulfilled') {
        for (const gs of gsRes.value.data) {
          const { label, ts } = fmtDate(gs.scheduledDate, gs.scheduledTime)
          const payStatus = gs.myParticipation?.paymentStatus ?? gs.status
          const cfg = STATUS_MAP[payStatus] ?? STATUS_MAP[gs.status] ?? { label: gs.status, cls: 'bg-sand text-warm-light' }
          items.push({
            key: `gs-${gs.id}`,
            kind: 'group',
            title: gs.title,
            dateLabel: label,
            sortTs: ts,
            organizer: `${gs.supervisor.firstName} ${gs.supervisor.lastName}`,
            statusLabel: cfg.label,
            statusCls: cfg.cls,
            link: `/group-supervisions/${gs.id}`,
          })
        }
      }

      items.sort((a, b) => b.sortTs - a.sortTs)
      setActivities(items)
    }).finally(() => setActivitiesLoading(false))
  }, [])

  // ── Password / Settings state ──
  const [showSettings, setShowSettings] = useState(false)
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [pwSaving, setPwSaving] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)

  const setPwField = (f: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setPwForm(prev => ({ ...prev, [f]: e.target.value }))

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwError('')
    if (pwForm.newPassword !== pwForm.confirmPassword) { setPwError('Паролі не збігаються'); return }
    setPwSaving(true)
    try {
      await api.patch('/auth/password', {
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      })
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setPwSuccess(true)
      setTimeout(() => setPwSuccess(false), 3000)
    } catch (err: any) {
      setPwError(err.response?.data?.error || 'Помилка зміни пароля')
    } finally {
      setPwSaving(false)
    }
  }

  const location = useLocation()
  useEffect(() => {
    if (location.hash === '#eft-dictionary') {
      setTimeout(() => {
        const el = document.getElementById('eft-dictionary')
        if (!el) return
        const top = el.getBoundingClientRect().top + window.scrollY - 80
        window.scrollTo({ top, behavior: 'smooth' })
      }, 100)
    }
  }, [location.hash])

  if (!user) return null

  const initials = `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()

  // Split activities into upcoming / past
  const now = Date.now()
  const upcoming = [...activities].filter(a => a.sortTs >= now).sort((a, b) => a.sortTs - b.sortTs)
  const past = [...activities].filter(a => a.sortTs < now).sort((a, b) => b.sortTs - a.sortTs)

  const renderActivityRow = (act: UnifiedActivity, muted = false) => {
    const badge = formatDateBadge(act.sortTs)
    const kindLabel = act.kind === 'event' ? 'Подія' : act.kind === 'booking' ? 'Супервізія' : 'Групова'
    const kindCls = act.kind === 'event'
      ? 'bg-[#F0EEF8] text-[#7060A0]'
      : act.kind === 'booking'
      ? 'bg-[#EEF2F8] text-[#7090B0]'
      : 'bg-[#EEF5EE] text-[#5A8A6A]'

    return (
      <Link
        key={act.key}
        to={act.link}
        className={`flex items-center gap-3.5 px-5 py-3.5 hover:bg-[#FFF9F5] transition group ${muted ? 'opacity-55' : ''}`}
      >
        {/* Date badge */}
        <div
          className="shrink-0 w-12 h-[58px] flex flex-col items-center justify-center rounded-xl text-center"
          style={{
            background: muted
              ? 'var(--surface-2)'
              : 'linear-gradient(145deg, #FBF0EE, #F2DDE0)',
            boxShadow: muted ? 'none' : 'var(--clay-sm)',
          }}
        >
          <span
            className="font-cormorant text-2xl font-bold leading-none"
            style={{ color: muted ? 'var(--ink-3)' : 'var(--rose-ink)' }}
          >
            {badge.day}
          </span>
          <span
            className="text-[9px] font-bold uppercase tracking-wide leading-tight mt-0.5"
            style={{ color: muted ? 'var(--ink-3)' : 'var(--rose-deep)' }}
          >
            {badge.mon}
          </span>
          <span
            className="text-[10px] font-semibold leading-tight mt-0.5"
            style={{ color: muted ? 'var(--ink-3)' : 'var(--ink-2)' }}
          >
            {badge.time}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${kindCls}`}>{kindLabel}</span>
          </div>
          <p className="text-sm font-semibold leading-snug line-clamp-1 group-hover:text-rose transition" style={{ color: 'var(--ink)' }}>
            {act.title}
          </p>
          <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: 'var(--ink-3)' }}>
            <UserIcon size={9} className="shrink-0" />
            {act.organizer}
          </p>
        </div>

        {/* Status */}
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 self-center ${act.statusCls}`}>
          {act.statusLabel}
        </span>
      </Link>
    )
  }

  const statCardCls = 'block rounded-[20px] p-4 relative overflow-hidden border border-[rgba(120,92,72,0.08)] shadow-[0_1px_2px_rgba(70,45,30,.05),0_6px_18px_rgba(130,90,60,.05)] hover:shadow-[0_4px_12px_rgba(70,45,30,.08)] hover:-translate-y-0.5 transition-all duration-200 flex flex-col min-h-[200px] bg-white'

  return (
    <Layout>
      <div className="max-w-4xl">
        {/* Avatar block */}
        <div className="flex items-center gap-5 mb-8">
          <div className="relative group">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt="Фото профілю"
                className="w-20 h-20 rounded-full object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-rose text-white flex items-center justify-center font-cormorant text-3xl font-semibold">
                {initials}
              </div>
            )}
            <button
              onClick={() => avatarInputRef.current?.click()}
              disabled={avatarUploading}
              className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:cursor-wait"
            >
              {avatarUploading
                ? <span className="text-white text-xs">...</span>
                : <Camera size={20} className="text-white" />}
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
          <div>
            <h1 className="font-cormorant text-2xl font-semibold text-warm-dark">
              {user.firstName} {user.lastName}
            </h1>
            <p className="text-sm text-warm-light">{user.email}</p>
            {avatarError && <p className="text-xs text-red-500 mt-1">{avatarError}</p>}
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {user.roles.map(r => (
                <span key={r} className="text-xs bg-rose-light text-rose px-2.5 py-1 rounded-full">
                  {ROLE_LABELS[r] ?? r}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="lg:grid lg:grid-cols-[1fr_300px] lg:gap-7 lg:items-start">

          {/* ── Left column ── */}
          <div className="flex flex-col gap-5">

            {/* Stats — mobile only */}
            <div className="grid grid-cols-2 gap-3 lg:hidden">
              <Link to="/supervisions" className={statCardCls}>
                <p className="text-[10px] text-[#9D8C80] uppercase tracking-widest font-bold mb-1">Супервізії</p>
                <div className="flex items-baseline gap-1.5 mb-auto">
                  <span className="font-cormorant text-5xl font-semibold text-[#3C2E27]">{stats.supervisions}</span>
                  <span className="text-xs text-[#9D8C80]">записів</span>
                </div>
                <span className="text-sm text-[#B05572] font-bold mt-3">Переглянути →</span>
                <img src="/illustrations/chairs.png" alt="" className="absolute bottom-[-10px] right-[-8px] w-[80px] object-contain pointer-events-none opacity-80" />
              </Link>
              <Link to="/seminars" className={statCardCls}>
                <p className="text-[10px] text-[#9D8C80] uppercase tracking-widest font-bold mb-1">Семінари</p>
                <div className="flex items-baseline gap-1.5 mb-auto">
                  <span className="font-cormorant text-5xl font-semibold text-[#3C2E27]">{stats.seminars}</span>
                  <span className="text-xs text-[#9D8C80]">записів</span>
                </div>
                <span className="text-sm text-[#B05572] font-bold mt-3">Переглянути →</span>
                <img src="/illustrations/books-coffee.png" alt="" className="absolute bottom-[-10px] right-[-8px] w-[80px] object-contain pointer-events-none opacity-80" />
              </Link>
            </div>

            {/* Мої події */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-sand/40">
                <div className="flex items-center gap-2">
                  <Calendar size={15} className="text-warm-light" />
                  <span className="font-medium text-warm-dark text-sm">Мої події</span>
                  {upcoming.length > 0 && (
                    <span className="ml-auto text-[11px] font-bold bg-rose-lighter text-rose px-2 py-0.5 rounded-full">
                      {upcoming.length} майбутніх
                    </span>
                  )}
                </div>
              </div>

              {activitiesLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-5 h-5 border-[3px] border-sand border-t-rose rounded-full animate-spin" />
                </div>
              ) : activities.length === 0 ? (
                <div className="px-6 py-8 text-center">
                  <p className="text-warm-light text-sm">Ви ще не зареєстровані на жодну подію</p>
                  <Link to="/events" className="inline-flex items-center gap-1.5 text-rose text-sm font-medium mt-3 hover:underline">
                    Переглянути події <ChevronRight size={14} />
                  </Link>
                </div>
              ) : (
                <div>
                  {/* Upcoming events */}
                  {upcoming.length > 0 && (
                    <>
                      <div className="px-5 pt-4 pb-2 flex items-center gap-2">
                        <span
                          className="text-[10px] font-black uppercase tracking-widest"
                          style={{ color: 'var(--rose-ink)' }}
                        >
                          Майбутні
                        </span>
                      </div>
                      <div className="divide-y divide-[#FFF4EC]">
                        {upcoming.map(act => renderActivityRow(act, false))}
                      </div>
                    </>
                  )}

                  {/* Past events */}
                  {past.length > 0 && (
                    <>
                      <div
                        className="px-5 pt-4 pb-2"
                        style={{ borderTop: upcoming.length > 0 ? '1px solid var(--line)' : 'none' }}
                      >
                        <span
                          className="text-[10px] font-black uppercase tracking-widest"
                          style={{ color: 'var(--ink-3)' }}
                        >
                          Минулі
                        </span>
                      </div>
                      <div className="divide-y divide-[#FFF4EC]">
                        {past.map(act => renderActivityRow(act, true))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Мої дані — collapsible */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <button
                onClick={() => setShowMyData(v => !v)}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-[#FFF9F5] transition"
              >
                <div className="flex items-center gap-2">
                  <UserIcon size={15} className="text-warm-light" />
                  <span className="font-medium text-warm-dark text-sm">Мої дані</span>
                </div>
                <svg
                  className={`w-4 h-4 text-warm-light transition-transform duration-200 ${showMyData ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showMyData && (
                <div className="px-6 pb-6 pt-2 border-t border-sand/40">
                  <div className="flex items-center justify-between mb-5">
                    <p className="text-xs font-medium text-warm-light uppercase tracking-widest">Особисті дані</p>
                    {!isEditing ? (
                      <button
                        onClick={startEdit}
                        className="flex items-center gap-1.5 text-warm-light hover:text-warm-mid text-sm transition"
                      >
                        <Edit3 size={14} /> Редагувати
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveProfile}
                          disabled={saving}
                          className="flex items-center gap-1.5 bg-rose-lighter text-rose hover:bg-rose-light text-sm font-medium rounded-xl px-3 py-1.5 transition"
                        >
                          <Check size={14} /> {saving ? 'Зберігаємо...' : 'Зберегти'}
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="flex items-center gap-1.5 text-warm-light hover:text-warm-mid text-sm rounded-xl px-3 py-1.5 transition"
                        >
                          <X size={14} /> Скасувати
                        </button>
                      </div>
                    )}
                  </div>

                  {profileSuccess && (
                    <div className="text-emerald-700 text-sm bg-emerald-50 rounded-xl px-4 py-2.5 mb-4">Профіль оновлено успішно</div>
                  )}
                  {profileError && (
                    <div className="text-[#A86060] text-sm bg-[#F8EEEE] rounded-2xl px-4 py-2.5 mb-4">{profileError}</div>
                  )}

                  {isEditing ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className={labelClass}>Ім'я</label>
                          <input type="text" value={form.firstName} onChange={setField('firstName')} className={inputClass} />
                        </div>
                        <div>
                          <label className={labelClass}>Прізвище</label>
                          <input type="text" value={form.lastName} onChange={setField('lastName')} className={inputClass} />
                        </div>
                      </div>
                      <div>
                        <label className={labelClass}>Ім'я латиницею</label>
                        <input type="text" value={form.latinName} onChange={setField('latinName')} placeholder="Ім'я Прізвище" className={inputClass} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className={labelClass}>Телефон</label>
                          <input type="tel" value={form.phone} onChange={setField('phone')} placeholder="+380..." className={inputClass} />
                        </div>
                        <div>
                          <label className={labelClass}>Telegram</label>
                          <input type="text" value={form.telegram} onChange={setField('telegram')} placeholder="@username" className={inputClass} />
                        </div>
                      </div>
                      {(user?.roles?.includes('SUPERVISOR') || user?.roles?.includes('SUPERVISOR_CANDIDATE')) && (
                        <div>
                          <label className={labelClass}>Посилання на зустріч (Zoom)</label>
                          <input type="url" value={form.meetingLink} onChange={setField('meetingLink')} placeholder="https://zoom.us/j/..." className={inputClass} />
                        </div>
                      )}
                      <div>
                        <label className={labelClass}>Рівень EFT</label>
                        <select value={form.eftLevel} onChange={setField('eftLevel')} className={inputClass}>
                          {EFT_LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                        </select>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {([
                        ["Ім'я та прізвище", `${user.firstName} ${user.lastName}`],
                        ["Ім'я латиницею", user.latinName || '—'],
                        ['Email', user.email],
                        ['Телефон', user.phone || '—'],
                        ['Telegram', user.telegram || '—'],
                        ...((user.roles?.includes('SUPERVISOR') || user.roles?.includes('SUPERVISOR_CANDIDATE'))
                          ? [['Zoom-посилання', user.meetingLink || '—']]
                          : []),
                        ['Рівень EFT', EFT_LABELS[user.eftLevel] ?? user.eftLevel],
                      ] as [string, string][]).map(([label, value]) => (
                        <div key={label} className="flex gap-4 py-1.5 border-b border-[#FFF4EC] last:border-0">
                          <span className="text-xs text-warm-light w-36 shrink-0 pt-0.5 uppercase tracking-wide">{label}</span>
                          <span className="text-sm text-warm-dark font-medium break-all">{value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Settings toggle */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <button
                onClick={() => setShowSettings(v => !v)}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-[#FFF9F5] transition"
              >
                <div className="flex items-center gap-2">
                  <Lock size={15} className="text-warm-light" />
                  <span className="font-medium text-warm-dark text-sm">Налаштування</span>
                </div>
                <svg
                  className={`w-4 h-4 text-warm-light transition-transform duration-200 ${showSettings ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showSettings && (
                <div className="px-6 pb-6 pt-2 border-t border-sand/40">
                  <p className="text-xs font-medium text-warm-light uppercase tracking-widest mb-4">Зміна пароля</p>

                  {pwSuccess && (
                    <div className="text-emerald-700 text-sm bg-emerald-50 rounded-xl px-4 py-2.5 mb-4">
                      Пароль змінено успішно
                    </div>
                  )}

                  <form onSubmit={handleChangePassword} className="space-y-4">
                    <div>
                      <label className={labelClass}>Поточний пароль</label>
                      <input type="password" value={pwForm.currentPassword} onChange={setPwField('currentPassword')} required className={inputClass} placeholder="••••••••" />
                    </div>
                    <div>
                      <label className={labelClass}>Новий пароль</label>
                      <input type="password" value={pwForm.newPassword} onChange={setPwField('newPassword')} required minLength={8} className={inputClass} placeholder="Мінімум 8 символів" />
                    </div>
                    <div>
                      <label className={labelClass}>Підтвердження нового пароля</label>
                      <input type="password" value={pwForm.confirmPassword} onChange={setPwField('confirmPassword')} required className={inputClass} placeholder="••••••••" />
                    </div>

                    {pwError && <p className="text-[#A86060] text-sm bg-[#F8EEEE] rounded-2xl px-4 py-2.5">{pwError}</p>}

                    <button
                      type="submit"
                      disabled={pwSaving}
                      className="bg-gradient-to-br from-[#C07888] to-[#A06070] text-white font-medium rounded-xl px-6 py-2.5 text-sm neu-btn-primary hover:opacity-90 transition disabled:opacity-50"
                    >
                      {pwSaving ? 'Зберігаємо...' : 'Змінити пароль'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>{/* end left column */}

          {/* ── Right column — desktop only, stats side by side ── */}
          <div className="hidden lg:flex lg:flex-col sticky top-24 self-start">
            <div className="grid grid-cols-2 gap-3">
              <Link to="/supervisions" className={statCardCls}>
                <p className="text-[10px] text-[#9D8C80] uppercase tracking-widest font-bold mb-1">Супервізії</p>
                <div className="flex items-baseline gap-1 mb-auto">
                  <span className="font-cormorant text-5xl font-semibold text-[#3C2E27]">{stats.supervisions}</span>
                  <span className="text-[10px] text-[#9D8C80]">записів</span>
                </div>
                <span className="text-xs text-[#B05572] font-bold mt-3">Переглянути →</span>
                <img src="/illustrations/chairs.png" alt="" className="absolute bottom-0 right-0 w-[90px] object-contain pointer-events-none opacity-85" />
              </Link>
              <Link to="/seminars" className={statCardCls}>
                <p className="text-[10px] text-[#9D8C80] uppercase tracking-widest font-bold mb-1">Семінари</p>
                <div className="flex items-baseline gap-1 mb-auto">
                  <span className="font-cormorant text-5xl font-semibold text-[#3C2E27]">{stats.seminars}</span>
                  <span className="text-[10px] text-[#9D8C80]">записів</span>
                </div>
                <span className="text-xs text-[#B05572] font-bold mt-3">Переглянути →</span>
                <img src="/illustrations/books-coffee.png" alt="" className="absolute bottom-0 right-0 w-[90px] object-contain pointer-events-none opacity-85" />
              </Link>
            </div>
          </div>

        </div>{/* end two-column grid */}
      </div>
    </Layout>
  )
}
