import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, FileText, ExternalLink, Shield, Users, BarChart2, X } from 'lucide-react'
import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
import Layout from '../components/Layout'
import EventsTab from '../components/EventsTab'
import api from '../api/axios'

type Tab = 'overview' | 'approval' | 'users' | 'events'
type ApprovalSubTab = 'seminars' | 'supervisions'

interface Stats {
  totalUsers: number; activeTherapists: number
  monthSupervisions: number; monthSeminars: number
  pendingSeminars: number; pendingSupervisions: number
}

interface ActivityItem {
  id: string; type: 'supervision' | 'seminar'; description: string; status: string; createdAt: string
}

interface PendingSeminar {
  id: string; title: string; date: string; hours: number; points: number
  certificateUrl: string | null
  user: { id: string; firstName: string; lastName: string }
}

interface PendingSupervision {
  id: string; date: string; type: string; createdAt: string
  user: { id: string; firstName: string; lastName: string }
  supervisor: { id: string; firstName: string; lastName: string }
}

interface UserItem {
  id: string; email: string; firstName: string; lastName: string
  eftLevel: string; roles: string[]; createdAt: string
}

const EFT_LABELS: Record<string, string> = {
  BASIC: 'Базовий', ADVANCED: 'Поглиблений', STUDENT: 'Студент',
  CERTIFIED: 'Сертифікований', SUPERVISOR: 'Супервізор',
}
const ROLE_LABELS: Record<string, string> = {
  THERAPIST: 'Терапевт', SUPERVISOR_CANDIDATE: 'Кандидат у супервізори',
  SUPERVISOR: 'Супервізор', ADMIN: 'Адмін',
}
const TYPE_LABELS: Record<string, string> = {
  INDIVIDUAL_PRESENTER: 'Індивідуальна • Подання',
  INDIVIDUAL_LISTENER: 'Індивідуальна • Слухач',
  GROUP_PRESENTER: 'Групова • Подання',
  GROUP_LISTENER: 'Групова • Слухач',
}
const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'Очікує', cls: 'bg-[#FFF3E0] text-[#E6930A]' },
  APPROVED: { label: 'Підтверджено', cls: 'bg-[#E8F5E9] text-[#4CAF50]' },
  REJECTED: { label: 'Відхилено', cls: 'bg-[#FFEBEE] text-[#E53935]' },
}
const ALL_ROLES = ['THERAPIST', 'SUPERVISOR_CANDIDATE', 'SUPERVISOR', 'ADMIN'] as const

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 flex flex-col gap-1">
      <p className="font-cormorant text-4xl font-light text-warm-dark">{value}</p>
      <p className="text-sm text-warm-mid">{label}</p>
      {sub && <p className="text-xs text-warm-light italic">{sub}</p>}
    </div>
  )
}

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('overview')
  const [approvalSubTab, setApprovalSubTab] = useState<ApprovalSubTab>('seminars')

  // ── Overview ──────────────────────────────────────────────────────────────
  const [stats, setStats] = useState<Stats | null>(null)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loadingOverview, setLoadingOverview] = useState(true)

  useEffect(() => {
    Promise.all([api.get('/admin/stats'), api.get('/admin/activity')])
      .then(([s, a]) => { setStats(s.data); setActivity(a.data) })
      .finally(() => setLoadingOverview(false))
  }, [])

  // ── Approval ──────────────────────────────────────────────────────────────
  const [seminars, setSeminars] = useState<PendingSeminar[]>([])
  const [pendingSupervisions, setPendingSupervisions] = useState<PendingSupervision[]>([])
  const [loadingApproval, setLoadingApproval] = useState(false)
  const [approvalLoaded, setApprovalLoaded] = useState(false)
  const [processing, setProcessing] = useState<string | null>(null)

  useEffect(() => {
    if (tab === 'approval' && !approvalLoaded) {
      setLoadingApproval(true)
      Promise.all([api.get('/seminars/pending'), api.get('/admin/supervisions/pending')])
        .then(([s, sv]) => { setSeminars(s.data); setPendingSupervisions(sv.data); setApprovalLoaded(true) })
        .finally(() => setLoadingApproval(false))
    }
  }, [tab])

  const handleSeminarAction = async (id: string, action: 'approve' | 'reject') => {
    setProcessing(id)
    try { await api.patch(`/seminars/${id}/${action}`); setSeminars(prev => prev.filter(s => s.id !== id)) }
    catch (err: any) { alert(err.response?.data?.error || 'Помилка') }
    finally { setProcessing(null) }
  }

  const handleSupervisionAction = async (id: string, action: 'approve' | 'reject') => {
    setProcessing(id)
    try { await api.patch(`/admin/supervisions/${id}/${action}`); setPendingSupervisions(prev => prev.filter(s => s.id !== id)) }
    catch (err: any) { alert(err.response?.data?.error || 'Помилка') }
    finally { setProcessing(null) }
  }

  // ── Users ─────────────────────────────────────────────────────────────────
  const [users, setUsers] = useState<UserItem[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [usersLoaded, setUsersLoaded] = useState(false)
  const [roleModal, setRoleModal] = useState<UserItem | null>(null)
  const [editRoles, setEditRoles] = useState<string[]>([])
  const [roleSaving, setRoleSaving] = useState(false)
  const [roleError, setRoleError] = useState('')

  useEffect(() => {
    if (tab === 'users' && !usersLoaded) {
      setLoadingUsers(true)
      api.get('/users').then(res => { setUsers(res.data); setUsersLoaded(true) }).finally(() => setLoadingUsers(false))
    }
  }, [tab])

  const openRoleModal = (u: UserItem) => { setRoleModal(u); setEditRoles([...u.roles]); setRoleError('') }
  const toggleRole = (role: string) =>
    setEditRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role])

  const handleSaveRoles = async () => {
    if (!roleModal) return
    if (editRoles.length === 0) { setRoleError('Виберіть хоча б одну роль'); return }
    setRoleSaving(true); setRoleError('')
    try {
      const res = await api.patch(`/admin/users/${roleModal.id}/roles`, { roles: editRoles })
      setUsers(prev => prev.map(u => u.id === roleModal.id ? res.data : u))
      setRoleModal(null)
    } catch (err: any) { setRoleError(err.response?.data?.error || 'Помилка') }
    finally { setRoleSaving(false) }
  }

  // ── Tab config ────────────────────────────────────────────────────────────
  const tabItems: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Огляд' },
    {
      key: 'approval',
      label: stats
        ? `Підтвердження${stats.pendingSeminars + stats.pendingSupervisions > 0 ? ` (${stats.pendingSeminars + stats.pendingSupervisions})` : ''}`
        : 'Підтвердження',
    },
    { key: 'users', label: 'Користувачі' },
    { key: 'events', label: 'Заходи' },
  ]

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="font-cormorant text-3xl text-warm-dark font-semibold">Адміністрування ♡</h1>
        <p className="font-cormorant italic text-warm-mid mt-0.5">Управління спільнотою терапевтів</p>
      </div>

      <div className="flex gap-6 border-b border-sand mb-6">
        {tabItems.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`pb-3 text-sm font-medium transition whitespace-nowrap ${tab === key ? 'border-b-2 border-rose text-rose' : 'text-warm-mid hover:text-warm-dark'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {tab === 'overview' && (
        loadingOverview ? (
          <div className="flex justify-center py-16"><div className="w-7 h-7 border-4 border-sand border-t-rose rounded-full animate-spin" /></div>
        ) : (
          <div className="max-w-2xl space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <StatCard label="Всього користувачів" value={stats?.totalUsers ?? 0} />
              <StatCard label="Активних терапевтів" value={stats?.activeTherapists ?? 0} />
              <StatCard label="Супервізій цього місяця" value={stats?.monthSupervisions ?? 0} />
              <StatCard label="Семінарів цього місяця" value={stats?.monthSeminars ?? 0} />
              <StatCard label="Семінарів очікує" value={stats?.pendingSeminars ?? 0} sub="потребують підтвердження" />
              <StatCard label="Супервізій очікує" value={stats?.pendingSupervisions ?? 0} sub="потребують підтвердження" />
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart2 size={15} className="text-warm-light" />
                <h3 className="text-xs font-medium text-warm-light uppercase tracking-widest">Остання активність</h3>
              </div>
              {activity.length === 0 ? (
                <p className="text-sm text-warm-light italic text-center py-6">Немає записів</p>
              ) : (
                <div className="space-y-2">
                  {activity.map(item => {
                    const s = STATUS_LABELS[item.status] ?? { label: item.status, cls: 'bg-sand text-warm-mid' }
                    return (
                      <div key={item.id} className="flex items-center justify-between gap-4 py-2 border-b border-[#F9F5F1] last:border-0">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {item.type === 'supervision'
                            ? <Shield size={13} className="text-rose shrink-0" />
                            : <FileText size={13} className="text-warm-mid shrink-0" />}
                          <span className="text-sm text-warm-dark truncate">{item.description}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.cls}`}>{s.label}</span>
                          <span className="text-xs text-warm-light">{format(new Date(item.createdAt), 'd MMM', { locale: uk })}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )
      )}

      {/* ── Approval ── */}
      {tab === 'approval' && (
        <div className="max-w-2xl">
          <div className="flex gap-6 border-b border-sand mb-5">
            {([
              { key: 'seminars' as ApprovalSubTab, label: `Семінари${seminars.length > 0 ? ` (${seminars.length})` : ''}` },
              { key: 'supervisions' as ApprovalSubTab, label: `Супервізії${pendingSupervisions.length > 0 ? ` (${pendingSupervisions.length})` : ''}` },
            ]).map(({ key, label }) => (
              <button key={key} onClick={() => setApprovalSubTab(key)}
                className={`pb-3 text-sm font-medium transition whitespace-nowrap ${approvalSubTab === key ? 'border-b-2 border-rose text-rose' : 'text-warm-mid hover:text-warm-dark'}`}>
                {label}
              </button>
            ))}
          </div>

          {loadingApproval ? (
            <div className="flex justify-center py-16"><div className="w-7 h-7 border-4 border-sand border-t-rose rounded-full animate-spin" /></div>
          ) : approvalSubTab === 'seminars' ? (
            seminars.length === 0 ? (
              <div className="text-center py-16"><p className="text-warm-mid font-medium">Немає семінарів на підтвердження</p></div>
            ) : (
              <div className="space-y-3">
                {seminars.map(s => (
                  <div key={s.id} className="bg-white rounded-2xl shadow-sm p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-warm-dark truncate">{s.title}</p>
                        <p className="text-xs text-warm-light mt-0.5">{s.user.firstName} {s.user.lastName}</p>
                        <div className="flex flex-wrap items-center gap-x-3 mt-1.5">
                          <span className="text-xs text-warm-light">{format(new Date(s.date), 'd MMM yyyy', { locale: uk })}</span>
                          <span className="text-warm-light text-xs">•</span>
                          <span className="text-xs text-warm-light">{s.hours} год.</span>
                          <span className="text-warm-light text-xs">•</span>
                          <span className="text-xs text-warm-light">{s.points} балів</span>
                          {s.certificateUrl && (
                            <><span className="text-warm-light text-xs">•</span>
                              <a href={s.certificateUrl} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs text-rose hover:opacity-80 transition">
                                <FileText size={11} />Сертифікат<ExternalLink size={10} />
                              </a></>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => handleSeminarAction(s.id, 'approve')} disabled={processing === s.id}
                          className="flex items-center gap-1.5 bg-[#E8F5E9] hover:bg-[#C8E6C9] disabled:opacity-50 text-[#4CAF50] text-sm font-medium rounded-xl px-4 py-2 transition">
                          <CheckCircle size={15} />Підтвердити
                        </button>
                        <button onClick={() => handleSeminarAction(s.id, 'reject')} disabled={processing === s.id}
                          className="flex items-center gap-1.5 bg-[#FFEBEE] hover:bg-[#FFCDD2] disabled:opacity-50 text-[#E53935] text-sm font-medium rounded-xl px-4 py-2 transition">
                          <XCircle size={15} />Відхилити
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            pendingSupervisions.length === 0 ? (
              <div className="text-center py-16"><p className="text-warm-mid font-medium">Немає супервізій на підтвердження</p></div>
            ) : (
              <div className="space-y-3">
                {pendingSupervisions.map(s => (
                  <div key={s.id} className="bg-white rounded-2xl shadow-sm p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-warm-dark">{s.user.firstName} {s.user.lastName}</p>
                        <p className="text-xs text-warm-light mt-0.5">{TYPE_LABELS[s.type] ?? s.type}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs text-warm-mid">Сесія: {format(new Date(s.date), 'd MMM yyyy', { locale: uk })}</span>
                          <span className="text-warm-light text-xs">•</span>
                          <span className="text-xs text-warm-light">Супервізор: {s.supervisor.firstName} {s.supervisor.lastName}</span>
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
            )
          )}
        </div>
      )}

      {/* ── Users ── */}
      {tab === 'users' && (
        loadingUsers ? (
          <div className="flex justify-center py-16"><div className="w-7 h-7 border-4 border-sand border-t-rose rounded-full animate-spin" /></div>
        ) : (
          <div className="space-y-2 max-w-2xl">
            {users.map(u => (
              <div key={u.id} className="bg-white rounded-2xl shadow-sm p-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-warm-dark">{u.firstName} {u.lastName}</p>
                    <p className="text-xs text-warm-light mt-0.5">{u.email}</p>
                    <div className="flex items-center gap-2 flex-wrap mt-2">
                      <span className="text-xs bg-beige text-warm-mid px-2.5 py-1 rounded-full">{EFT_LABELS[u.eftLevel] ?? u.eftLevel}</span>
                      {u.roles.map(role => (
                        <span key={role} className="text-xs bg-rose-light text-rose px-2.5 py-1 rounded-full">{ROLE_LABELS[role] ?? role}</span>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => openRoleModal(u)}
                    className="shrink-0 flex items-center gap-1.5 border border-[#DDD5CC] bg-white text-warm-mid rounded-xl px-4 py-2.5 text-sm hover:bg-[#F5EFE9] hover:border-[#C08898]/30 transition">
                    <Users size={13} />Ролі
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── Events ── */}
      {tab === 'events' && <EventsTab />}

      {/* ── Role management modal ── */}
      {roleModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-cormorant text-2xl font-semibold text-warm-dark">Ролі користувача</h3>
              <button onClick={() => setRoleModal(null)} className="text-warm-light hover:text-warm-mid transition"><X size={20} /></button>
            </div>
            <p className="text-sm text-warm-light mb-5">{roleModal.firstName} {roleModal.lastName}</p>
            <div className="space-y-2 mb-5">
              {ALL_ROLES.map(role => (
                <label key={role} className="flex items-center gap-3 cursor-pointer group">
                  <div onClick={() => toggleRole(role)}
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition cursor-pointer ${editRoles.includes(role) ? 'bg-rose border-rose' : 'border-sand group-hover:border-warm-light'}`}>
                    {editRoles.includes(role) && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm text-warm-dark" onClick={() => toggleRole(role)}>{ROLE_LABELS[role]}</span>
                </label>
              ))}
            </div>
            {roleError && <p className="text-red-500 text-sm bg-red-50 rounded-xl px-4 py-2.5 mb-4">{roleError}</p>}
            <div className="flex gap-3">
              <button onClick={() => setRoleModal(null)}
                className="flex-1 border border-[#DDD5CC] bg-white text-warm-mid rounded-xl px-4 py-2.5 text-sm hover:bg-[#F5EFE9] hover:border-[#C08898]/30 transition">Скасувати</button>
              <button onClick={handleSaveRoles} disabled={roleSaving}
                className="flex-1 bg-gradient-to-br from-[#C08898] to-[#A8707E] text-white font-medium rounded-xl px-6 py-2.5 text-sm shadow-[0_2px_10px_rgba(196,133,106,0.25)] hover:opacity-90 transition disabled:opacity-50">
                {roleSaving ? 'Зберігаємо...' : 'Зберегти'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
