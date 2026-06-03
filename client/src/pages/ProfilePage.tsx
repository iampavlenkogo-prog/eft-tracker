import { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Edit3, Lock, Check, X, Camera, Plus, Trash2, Heart, Download } from 'lucide-react'
import Layout from '../components/Layout'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'

interface PhraseItem {
  id: string
  text: string
  author: { id: string; firstName: string; lastName: string; avatarUrl?: string | null }
  createdAt: string
}

interface SavedPhraseItem extends PhraseItem {
  savedAt: string
  savedId: string
}

interface Collection {
  own: PhraseItem[]
  saved: SavedPhraseItem[]
}

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

const inputClass = 'w-full bg-[#FFFFEB] border border-[#C8D0B8] rounded-xl px-4 py-2.5 text-sm text-warm-dark placeholder:text-[#9A8878] focus:outline-none focus:border-[#A2C2BE]/60 transition neu-input'
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

  // ── Phrases state ──
  const [myPhrases, setMyPhrases] = useState<PhraseItem[]>([])
  const [newPhraseText, setNewPhraseText] = useState('')
  const [addingPhrase, setAddingPhrase] = useState(false)
  const [phraseError, setPhraseError] = useState('')
  const [editingPhraseId, setEditingPhraseId] = useState<string | null>(null)
  const [editingPhraseText, setEditingPhraseText] = useState('')
  const [collection, setCollection] = useState<Collection>({ own: [], saved: [] })
  const [exportingPdf, setExportingPdf] = useState(false)
  const [collectionTab, setCollectionTab] = useState<'all' | 'own' | 'saved'>('all')
  const [collectionSearch, setCollectionSearch] = useState('')

  useEffect(() => {
    api.get('/phrases/my').then(r => setMyPhrases(r.data)).catch(() => {})
    api.get('/phrases/collection').then(r => setCollection(r.data)).catch(() => {})
  }, [])

  const handleAddPhrase = async () => {
    if (!newPhraseText.trim()) return
    setAddingPhrase(true)
    setPhraseError('')
    try {
      const { data } = await api.post('/phrases', { text: newPhraseText.trim() })
      setMyPhrases(prev => [data, ...prev])
      setCollection(prev => ({ ...prev, own: [data, ...prev.own] }))
      setNewPhraseText('')
    } catch (e: any) {
      setPhraseError(e.response?.data?.error || 'Помилка')
    } finally {
      setAddingPhrase(false)
    }
  }

  const handleSaveEditPhrase = async (id: string) => {
    if (!editingPhraseText.trim()) return
    try {
      const { data } = await api.patch(`/phrases/${id}`, { text: editingPhraseText.trim() })
      setMyPhrases(prev => prev.map(p => p.id === id ? { ...p, text: data.text } : p))
      setCollection(prev => ({ ...prev, own: prev.own.map(p => p.id === id ? { ...p, text: data.text } : p) }))
      setEditingPhraseId(null)
    } catch {}
  }

  const handleDeletePhrase = async (id: string) => {
    try {
      await api.delete(`/phrases/${id}`)
      setMyPhrases(prev => prev.filter(p => p.id !== id))
      setCollection(prev => ({ ...prev, own: prev.own.filter(p => p.id !== id) }))
    } catch {}
  }

  const handleUnsavePhrase = async (phraseId: string) => {
    try {
      await api.delete(`/phrases/${phraseId}/save`)
      setCollection(prev => ({ ...prev, saved: prev.saved.filter(p => p.id !== phraseId) }))
    } catch {}
  }

  const handleExportPDF = async () => {
    const allPhrases = [...collection.own, ...collection.saved]
    if (allPhrases.length === 0) return
    setExportingPdf(true)
    try {
      const { jsPDF } = await import('jspdf')
      const html2canvas = (await import('html2canvas')).default

      const today = new Date().toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })
      const logoUrl = `${window.location.origin}/illustrations/Logo_obiymu.png`

      const ownItems = collection.own
      const savedItems = collection.saved

      const container = document.createElement('div')
      container.style.cssText = 'position:absolute;left:-10000px;top:0;width:794px;background:#FAFAF8;box-sizing:border-box;font-family:Arial,sans-serif;'
      container.innerHTML = `
        <div style="padding:60px 56px;">
          <div style="font-size:20px;color:#A2C2BE;margin-bottom:18px;letter-spacing:4px;">♡</div>
          <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:36px;font-weight:400;color:#2C2C2C;line-height:1.2;margin-bottom:8px;">Словник ЕФТ терапевта</h1>
          <p style="font-size:12px;color:#A0A0A0;margin-bottom:24px;font-weight:300;">${user?.firstName} ${user?.lastName}</p>
          <hr style="border:none;border-top:1px solid #E0D9D0;margin-bottom:32px;">

          ${ownItems.length > 0 ? `
            <div style="font-size:11px;font-weight:500;letter-spacing:3px;text-transform:uppercase;color:#A2C2BE;margin-bottom:16px;">Мої записи</div>
            ${ownItems.map(p => `
              <div style="background:#F0EBE3;border-radius:12px;padding:20px 24px;margin-bottom:12px;">
                <div style="font-family:Georgia,serif;font-size:18px;font-style:italic;color:#2C2C2C;line-height:1.6;margin-bottom:8px;">«${p.text}»</div>
                <div style="font-size:11px;color:#A0A0A0;">Моя фраза</div>
              </div>
            `).join('')}
          ` : ''}

          ${savedItems.length > 0 ? `
            <div style="font-size:11px;font-weight:500;letter-spacing:3px;text-transform:uppercase;color:#A2C2BE;margin-bottom:16px;${ownItems.length > 0 ? 'margin-top:24px;' : ''}">Збережені записи</div>
            ${savedItems.map(p => `
              <div style="background:#F0EBE3;border-radius:12px;padding:20px 24px;margin-bottom:12px;">
                <div style="font-family:Georgia,serif;font-size:18px;font-style:italic;color:#2C2C2C;line-height:1.6;margin-bottom:8px;">«${p.text}»</div>
                <div style="font-size:11px;color:#A0A0A0;">${p.author.firstName} ${p.author.lastName}</div>
              </div>
            `).join('')}
          ` : ''}

          <div style="margin-top:48px;text-align:center;">
            <div style="font-family:Georgia,serif;font-style:italic;font-size:15px;color:#A2C2BE;margin-bottom:8px;">Навчання. Ріст. Зв'язок. ♡</div>
            <div style="font-size:10px;color:#A0A0A0;margin-bottom:14px;">OBIYMU EFT Space &nbsp;·&nbsp; ${today}</div>
            <img src="${logoUrl}" alt="OBIYMU" style="height:26px;width:auto;opacity:0.65;display:block;margin:0 auto;" crossorigin="anonymous">
          </div>
        </div>
      `
      document.body.appendChild(container)

      const canvas = await html2canvas(container, { scale: 2, useCORS: true })
      const pxPerMm = (96 / 25.4) * 2
      const pageHeightPx = 297 * pxPerMm
      const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })

      let y = 0
      while (y < canvas.height) {
        if (y > 0) doc.addPage()
        const sliceH = Math.min(pageHeightPx, canvas.height - y)
        const slice = document.createElement('canvas')
        slice.width = canvas.width
        slice.height = sliceH
        slice.getContext('2d')!.drawImage(canvas, 0, -y)
        doc.addImage(slice.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 210, (sliceH / pxPerMm))
        y += pageHeightPx
      }

      doc.save('eft-phrases.pdf')
      document.body.removeChild(container)
    } catch (e) {
      console.error(e)
    } finally {
      setExportingPdf(false)
    }
  }

  // ── Password state ──
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
                  <div key={label} className="flex gap-4 py-1.5 border-b border-[#F5F5DC] last:border-0">
                    <span className="text-xs text-warm-light w-36 shrink-0 pt-0.5 uppercase tracking-wide">{label}</span>
                    <span className="text-sm text-warm-dark font-medium break-all">{value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Мій словник ЕФТ */}
          <div id="eft-dictionary" className="bg-white rounded-2xl shadow-sm p-6 scroll-mt-20">
            <h3 className="font-medium text-warm-dark mb-4">Мій словник ЕФТ</h3>

            {/* Add new phrase */}
            <div className="mb-4">
              <textarea
                value={newPhraseText}
                onChange={e => setNewPhraseText(e.target.value)}
                rows={2}
                placeholder="Додайте термін, фразу або визначення…"
                className="w-full bg-[#FFFFEB] border border-[#C8D0B8] rounded-xl px-4 py-2.5 text-sm text-warm-dark placeholder:text-[#9A8878] focus:outline-none focus:border-[#A2C2BE]/60 transition neu-input resize-none"
              />
              {phraseError && <p className="text-red-500 text-xs mt-1">{phraseError}</p>}
              <button
                onClick={handleAddPhrase}
                disabled={addingPhrase || !newPhraseText.trim()}
                className="mt-2 flex items-center gap-1.5 bg-gradient-to-br from-[#EB4600] to-[#CC3A00] text-white font-medium rounded-xl px-6 py-2.5 text-sm neu-btn-primary hover:opacity-90 transition disabled:opacity-50"
              >
                <Plus size={14} />
                {addingPhrase ? 'Додаємо…' : 'Додати'}
              </button>
            </div>

            {/* My phrases list */}
            {myPhrases.length === 0 ? (
              <p className="text-sm text-warm-light italic">Ви ще не додали жодного запису</p>
            ) : (
              <div className="space-y-3">
                {myPhrases.map(phrase => (
                  <div key={phrase.id} className="bg-beige rounded-xl p-4">
                    {editingPhraseId === phrase.id ? (
                      <div>
                        <textarea
                          value={editingPhraseText}
                          onChange={e => setEditingPhraseText(e.target.value)}
                          rows={2}
                          className="w-full bg-[#FFFFEB] border border-[#C8D0B8] rounded-xl px-3 py-2 text-sm text-warm-dark placeholder:text-[#9A8878] focus:outline-none focus:border-[#A2C2BE]/60 transition neu-input resize-none"
                        />
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => handleSaveEditPhrase(phrase.id)}
                            className="flex items-center gap-1 bg-rose-lighter text-rose hover:bg-rose-light text-xs font-medium rounded-lg px-3 py-1.5 transition"
                          >
                            <Check size={12} /> Зберегти
                          </button>
                          <button
                            onClick={() => setEditingPhraseId(null)}
                            className="flex items-center gap-1 text-warm-light hover:text-warm-mid text-xs rounded-lg px-3 py-1.5 transition"
                          >
                            <X size={12} /> Скасувати
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-3 items-start">
                        <p className="font-cormorant italic text-warm-dark text-base leading-relaxed flex-1">«{phrase.text}»</p>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => { setEditingPhraseId(phrase.id); setEditingPhraseText(phrase.text) }}
                            className="text-warm-light hover:text-warm-mid transition"
                            title="Редагувати"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            onClick={() => handleDeletePhrase(phrase.id)}
                            className="text-warm-light hover:text-red-400 transition"
                            title="Видалити"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Моя колекція словника */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {/* Header with illustration */}
            <div className="relative bg-beige px-6 py-5 overflow-hidden min-h-[100px]">
              <div className="relative z-10">
                <div className="flex items-center gap-3">
                  <h3 className="font-medium text-warm-dark">Моя колекція словника</h3>
                  {(collection.own.length + collection.saved.length) > 0 && (
                    <button
                      onClick={handleExportPDF}
                      disabled={exportingPdf}
                      className="flex items-center gap-1 text-warm-light hover:text-warm-mid disabled:opacity-50 text-xs transition"
                      title="Завантажити PDF"
                    >
                      <Download size={13} />
                      {exportingPdf ? 'Генеруємо…' : 'PDF'}
                    </button>
                  )}
                </div>
                <p className="text-xs text-warm-light mt-0.5">
                  {collection.own.length + collection.saved.length} записів
                </p>
              </div>
              <img
                src="/illustrations/slovnyk_EFT.png"
                alt=""
                className="absolute right-0 bottom-0 h-28 w-auto object-contain pointer-events-none"
              />
            </div>

            <div className="px-6 pt-4 pb-6">
              {collection.own.length + collection.saved.length === 0 ? (
                <p className="text-sm text-warm-light italic">Колекція порожня — додайте записи або збережіть із словника спільноти</p>
              ) : (
                <>
                  {/* Tabs */}
                  <div className="flex gap-1 bg-beige rounded-xl p-1 mb-4">
                    {([
                      { key: 'all', label: `Всі (${collection.own.length + collection.saved.length})` },
                      { key: 'own', label: `Мої (${collection.own.length})` },
                      { key: 'saved', label: `Збережені (${collection.saved.length})` },
                    ] as { key: 'all' | 'own' | 'saved'; label: string }[]).map(({ key, label }) => (
                      <button
                        key={key}
                        onClick={() => { setCollectionTab(key); setCollectionSearch('') }}
                        className={`flex-1 text-xs font-medium py-1.5 rounded-lg transition ${
                          collectionTab === key
                            ? 'bg-white text-warm-dark shadow-sm'
                            : 'text-warm-light hover:text-warm-mid'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Search */}
                  <div className="relative mb-4">
                    <input
                      type="text"
                      value={collectionSearch}
                      onChange={e => setCollectionSearch(e.target.value)}
                      placeholder="Пошук у колекції…"
                      className="w-full bg-[#FFFFEB] border border-[#C8D0B8] rounded-xl pl-9 pr-4 py-2 text-sm text-warm-dark placeholder:text-[#9A8878] focus:outline-none focus:border-[#A2C2BE]/60 transition neu-input"
                    />
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-warm-light" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                  </div>

                  {/* List */}
                  {(() => {
                    const q = collectionSearch.toLowerCase()
                    const ownFiltered = collection.own.filter(p => p.text.toLowerCase().includes(q))
                    const savedFiltered = collection.saved.filter(p => p.text.toLowerCase().includes(q))

                    const showOwn = collectionTab === 'all' || collectionTab === 'own'
                    const showSaved = collectionTab === 'all' || collectionTab === 'saved'
                    const totalVisible = (showOwn ? ownFiltered.length : 0) + (showSaved ? savedFiltered.length : 0)

                    if (totalVisible === 0) return (
                      <p className="text-sm text-warm-light italic text-center py-4">
                        {collectionSearch ? 'Нічого не знайдено' : 'Тут поки порожньо'}
                      </p>
                    )

                    return (
                      <div className="space-y-3">
                        {showOwn && ownFiltered.map(phrase => (
                          <div key={`own-${phrase.id}`} className="bg-beige rounded-xl p-4">
                            <p className="font-cormorant italic text-warm-dark text-base leading-relaxed">«{phrase.text}»</p>
                            <p className="text-xs text-warm-light mt-1.5">Моя фраза</p>
                          </div>
                        ))}
                        {showSaved && savedFiltered.map(phrase => (
                          <div key={`saved-${phrase.id}`} className="bg-beige rounded-xl p-4 flex gap-3 items-start">
                            <div className="flex-1 min-w-0">
                              <p className="font-cormorant italic text-warm-dark text-base leading-relaxed">«{phrase.text}»</p>
                              <p className="text-xs text-warm-light mt-1.5">{phrase.author.firstName} {phrase.author.lastName}</p>
                            </div>
                            <button
                              onClick={() => handleUnsavePhrase(phrase.id)}
                              className="shrink-0 mt-1 text-rose hover:opacity-70 transition"
                              title="Прибрати з колекції"
                            >
                              <Heart size={16} fill="currentColor" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                </>
              )}
            </div>
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
                className="bg-gradient-to-br from-[#EB4600] to-[#CC3A00] text-white font-medium rounded-xl px-6 py-2.5 text-sm neu-btn-primary hover:opacity-90 transition disabled:opacity-50"
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
