import { useState, useRef } from 'react'
import { Edit3, Lock, Check, X, Camera } from 'lucide-react'
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

const inputClass = 'w-full border border-sand rounded-xl px-4 py-2.5 text-warm-dark text-sm bg-white focus:outline-none focus:border-rose focus:ring-1 focus:ring-rose-light transition'
const labelClass = 'block text-sm font-medium text-warm-mid mb-1.5'

export default function ProfilePage() {
  const { user, refreshUser } = useAuth()

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
      // Do NOT set Content-Type manually — axios sets multipart/form-data with correct boundary
      await api.post('/auth/avatar', fd)
      await refreshUser()
    } catch (err: any) {
      setAvatarError(err.response?.data?.error || 'Помилка завантаження фото')
    } finally {
      setAvatarUploading(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }

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

  if (!user) return null

  const initials = `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()

  return (
    <Layout>
      <div className="max-w-lg">
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

        <div className="space-y-5">
          {/* Personal data card */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-medium text-warm-dark">Особисті дані</h3>
              {!isEditing ? (
                <button
                  onClick={startEdit}
                  className="flex items-center gap-1.5 text-warm-light hover:text-warm-mid text-sm transition"
                >
                  <Edit3 size={14} />
                  Редагувати
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="flex items-center gap-1.5 bg-rose-lighter text-rose hover:bg-rose-light text-sm font-medium rounded-xl px-3 py-1.5 transition"
                  >
                    <Check size={14} />
                    {saving ? 'Зберігаємо...' : 'Зберегти'}
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="flex items-center gap-1.5 text-warm-light hover:text-warm-mid text-sm rounded-xl px-3 py-1.5 transition"
                  >
                    <X size={14} />
                    Скасувати
                  </button>
                </div>
              )}
            </div>

            {profileSuccess && (
              <div className="text-emerald-700 text-sm bg-emerald-50 rounded-xl px-4 py-2.5 mb-4">
                Профіль оновлено успішно
              </div>
            )}
            {profileError && (
              <div className="text-red-500 text-sm bg-red-50 rounded-xl px-4 py-2.5 mb-4">{profileError}</div>
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
                <div>
                  <label className={labelClass}>Рівень EFT</label>
                  <select value={form.eftLevel} onChange={setField('eftLevel')} className={inputClass}>
                    {EFT_LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {[
                  ["Ім'я та прізвище", `${user.firstName} ${user.lastName}`],
                  ["Ім'я латиницею", user.latinName || '—'],
                  ['Email', user.email],
                  ['Телефон', user.phone || '—'],
                  ['Telegram', user.telegram || '—'],
                  ['Рівень EFT', EFT_LABELS[user.eftLevel] ?? user.eftLevel],
                ].map(([label, value]) => (
                  <div key={label} className="flex gap-4 py-1.5 border-b border-[#F9F5F1] last:border-0">
                    <span className="text-xs text-warm-light w-36 shrink-0 pt-0.5 uppercase tracking-wide">{label}</span>
                    <span className="text-sm text-warm-dark font-medium">{value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Password card */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <Lock size={15} className="text-warm-light" />
              <h3 className="font-medium text-warm-dark">Зміна пароля</h3>
            </div>

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

              {pwError && <p className="text-red-500 text-sm bg-red-50 rounded-xl px-4 py-2.5">{pwError}</p>}

              <button
                type="submit"
                disabled={pwSaving}
                className="bg-rose hover:bg-[#B5745A] disabled:opacity-60 text-white font-medium rounded-xl px-6 py-2.5 transition text-sm"
              >
                {pwSaving ? 'Зберігаємо...' : 'Змінити пароль'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  )
}
