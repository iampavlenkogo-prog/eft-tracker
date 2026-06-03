import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Calendar, Clock, Users, ChevronLeft, AlertCircle, X } from 'lucide-react'
import Layout from '../components/Layout'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'

interface Participant {
  id: string; userId: string; isPresenter: boolean
  paymentStatus: 'PENDING' | 'RECEIPT_UPLOADED' | 'CONFIRMED' | 'FREE'
  paymentReceiptUrl: string | null
  user: { id: string; firstName: string; lastName: string }
}

interface GroupSupervision {
  id: string; title: string; description: string | null
  scheduledDate: string; scheduledTime: string; duration: number
  price: number; currency: string
  paymentInstructions: string | null; zoomLink: string | null; zoomPassword: string | null
  status: 'WAITING_FOR_CASE' | 'CASE_CONFIRMED' | 'REGISTRATION_OPEN' | 'REGISTRATION_CLOSED' | 'WAITING_FOR_RECORDING' | 'RECORDING_AVAILABLE' | 'COMPLETED'
  caseTitle: string | null; caseDescription: string | null; supervisionFocus: string | null
  protocolFileUrl: string | null; caseVideoUrl: string | null
  recordingUrl: string | null; recordingExpiresAt: string | null
  supervisor: { id: string; firstName: string; lastName: string; telegram: string | null }
  presenterUser: { id: string; firstName: string; lastName: string } | null
  participants: Participant[]
  myParticipation: Participant | null
  isSupervisor: boolean
}

const ETHICS_ITEMS = [
  'Дотримуватимуся конфіденційності щодо всіх матеріалів, озвучених на сесії',
  'Не буду записувати сесію без відома та згоди всіх учасників',
  'Не передаватиму матеріали сесії третім особам',
  'Дотримуватимуся етичних принципів спільноти ЕФТ-терапевтів України',
  'Використовуватиму отримані знання виключно з професійною та навчальною метою',
]

const inputClass = 'w-full bg-[#FAF9F6] border border-[#E5DAD9] rounded-xl px-4 py-2.5 text-sm text-warm-dark placeholder:text-[#8EA082] focus:outline-none focus:border-[#7B8E5C]/60 transition neu-input'
const labelClass = 'block text-sm font-medium text-warm-mid mb-1.5'

const STATUS_LABELS: Record<string, string> = {
  WAITING_FOR_CASE: 'Шукаємо супервізанта ♡',
  CASE_CONFIRMED: 'Випадок підтверджено ♡',
  REGISTRATION_OPEN: 'Реєстрацію відкрито ♡',
  REGISTRATION_CLOSED: 'Реєстрацію закрито',
  WAITING_FOR_RECORDING: 'Запис очікується...',
  RECORDING_AVAILABLE: 'Запис доступний ♡',
  COMPLETED: 'Сесію завершено ♡',
}

const STATUS_BADGE: Record<string, string> = {
  WAITING_FOR_CASE: 'bg-[#FFF3E0] text-[#E6930A]',
  CASE_CONFIRMED: 'bg-[#E3F2FD] text-[#1976D2]',
  REGISTRATION_OPEN: 'bg-[#E8F5E9] text-[#4CAF50]',
  REGISTRATION_CLOSED: 'bg-sand text-warm-mid',
  WAITING_FOR_RECORDING: 'bg-[#FFF3E0] text-[#E6930A]',
  RECORDING_AVAILABLE: 'bg-[#E8F5E9] text-[#4CAF50]',
  COMPLETED: 'bg-[#E3F2FD] text-[#1976D2]',
}

export default function GroupSupervisionPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [group, setGroup] = useState<GroupSupervision | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Presenter booking form (immediate, combined)
  const [presenterForm, setPresenterForm] = useState({ caseTitle: '', caseDescription: '', supervisionFocus: '' })
  const [booking, setBooking] = useState(false)
  const [bookError, setBookError] = useState('')

  // Presenter case details update form (PATCH)
  const [showCaseForm, setShowCaseForm] = useState(false)
  const [caseForm, setCaseForm] = useState({ caseTitle: '', caseDescription: '', supervisionFocus: '', caseVideoUrl: '' })
  const [caseFile, setCaseFile] = useState<File | null>(null)
  const [savingCase, setSavingCase] = useState(false)
  const [caseError, setCaseError] = useState('')
  const [caseSaved, setCaseSaved] = useState(false)

  // Ethics modal for listeners
  const [showEthicsModal, setShowEthicsModal] = useState(false)
  const [ethicsChecks, setEthicsChecks] = useState([false, false, false, false, false])
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')

  // Receipt upload
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [uploadingReceipt, setUploadingReceipt] = useState(false)
  const [receiptError, setReceiptError] = useState('')

  useEffect(() => {
    if (!id) return
    api.get(`/group-supervisions/${id}`)
      .then(res => {
        setGroup(res.data)
        if (res.data.caseTitle) {
          setCaseForm({
            caseTitle: res.data.caseTitle || '',
            caseDescription: res.data.caseDescription || '',
            supervisionFocus: res.data.supervisionFocus || '',
            caseVideoUrl: res.data.caseVideoUrl || '',
          })
        }
      })
      .catch(err => setError(err.response?.data?.error || 'Помилка завантаження'))
      .finally(() => setLoading(false))
  }, [id])

  const handleBookPresenter = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!presenterForm.caseTitle.trim() || !presenterForm.caseDescription.trim() || !presenterForm.supervisionFocus.trim()) {
      setBookError('Будь ласка, заповніть усі поля'); return
    }
    setBooking(true); setBookError('')
    try {
      const res = await api.post(`/group-supervisions/${id}/book-presenter`, presenterForm)
      setGroup(prev => prev ? {
        ...prev,
        status: 'CASE_CONFIRMED',
        presenterUser: { id: user!.id, firstName: user!.firstName, lastName: user!.lastName },
        myParticipation: {
          id: 'new', userId: user!.id, isPresenter: true,
          paymentStatus: prev.price === 0 ? 'FREE' : 'PENDING',
          paymentReceiptUrl: null,
          user: { id: user!.id, firstName: user!.firstName, lastName: user!.lastName },
        },
        ...res.data,
      } : prev)
    } catch (err: any) { setBookError(err.response?.data?.error || 'Помилка') }
    finally { setBooking(false) }
  }

  const handleSaveCaseDetails = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!caseForm.caseTitle) { setCaseError('Назва випадку обовʼязкова'); return }
    setSavingCase(true); setCaseError(''); setCaseSaved(false)
    try {
      const fd = new FormData()
      fd.append('caseTitle', caseForm.caseTitle)
      fd.append('caseDescription', caseForm.caseDescription)
      fd.append('supervisionFocus', caseForm.supervisionFocus)
      fd.append('caseVideoUrl', caseForm.caseVideoUrl)
      if (caseFile) fd.append('protocolFile', caseFile)
      const res = await api.patch(`/group-supervisions/${id}/case-details`, fd)
      setGroup(prev => prev ? { ...prev, ...res.data } : prev)
      setCaseSaved(true)
      setShowCaseForm(false)
    } catch (err: any) { setCaseError(err.response?.data?.error || 'Помилка') }
    finally { setSavingCase(false) }
  }

  const handleJoin = async () => {
    setJoining(true); setJoinError('')
    try {
      const res = await api.post(`/group-supervisions/${id}/join`, { ethicsConfirmed: true })
      setGroup(prev => prev ? {
        ...prev,
        myParticipation: { ...res.data, user: { id: user!.id, firstName: user!.firstName, lastName: user!.lastName } },
        participants: [...prev.participants, { ...res.data, user: { id: user!.id, firstName: user!.firstName, lastName: user!.lastName } }],
      } : prev)
      setShowEthicsModal(false)
    } catch (err: any) {
      setJoinError(err.response?.data?.error || 'Помилка')
      setJoining(false)
    }
  }

  const handleUploadReceipt = async () => {
    if (!receiptFile) return
    setUploadingReceipt(true); setReceiptError('')
    try {
      const fd = new FormData()
      fd.append('receiptFile', receiptFile)
      const res = await api.post(`/group-supervisions/${id}/upload-receipt`, fd)
      setGroup(prev => prev ? {
        ...prev,
        myParticipation: prev.myParticipation ? { ...prev.myParticipation, ...res.data } : null,
        participants: prev.participants.map(p => p.userId === user!.id ? { ...p, ...res.data } : p),
      } : prev)
      setReceiptFile(null)
    } catch (err: any) { setReceiptError(err.response?.data?.error || 'Помилка') }
    finally { setUploadingReceipt(false) }
  }

  if (loading) return (
    <Layout>
      <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-sand border-t-rose rounded-full animate-spin" /></div>
    </Layout>
  )

  if (error || !group) return (
    <Layout>
      <div className="max-w-lg">
        <Link to="/dashboard" className="flex items-center gap-1 text-sm text-warm-light hover:text-warm-mid mb-6 transition">
          <ChevronLeft size={14} />Назад
        </Link>
        <div className="bg-red-50 text-red-500 rounded-2xl px-5 py-4 text-sm">{error || 'Не знайдено'}</div>
      </div>
    </Layout>
  )

  const my = group.myParticipation
  const amPresenter = my?.isPresenter || group.presenterUser?.id === user?.id
  const canSeeZoom = group.isSupervisor || my?.paymentStatus === 'CONFIRMED' || my?.paymentStatus === 'FREE'
  const confirmedCount = group.participants.filter(p => p.paymentStatus === 'CONFIRMED' || p.paymentStatus === 'FREE').length

  const sessionDt = new Date(`${group.scheduledDate}T${group.scheduledTime}`)
  const threeDaysBefore = new Date(sessionDt.getTime() - 3 * 24 * 60 * 60 * 1000)
  const now = new Date()
  const presenterDeadlinePassed = now > threeDaysBefore
  const caseDetailsComplete = !!(group.caseTitle && group.protocolFileUrl)
  const allEthicsChecked = ethicsChecks.every(Boolean)

  return (
    <Layout>
      <div className="max-w-2xl">
        <button onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm text-warm-mid hover:text-warm-dark border border-sand hover:border-warm-mid bg-white rounded-xl px-4 py-2 mb-6 transition">
          <ChevronLeft size={15} />Назад
        </button>

        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-4">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_BADGE[group.status]}`}>
              {STATUS_LABELS[group.status]}
            </span>
            <div className="flex flex-wrap gap-3 text-xs text-warm-mid">
              {group.isSupervisor && <span className="flex items-center gap-1"><Users size={11} />{confirmedCount} учасників</span>}
              {group.price > 0 && <span>💰 {group.price} {group.currency}</span>}
            </div>
          </div>

          <h1 className="font-cormorant text-3xl font-semibold text-warm-dark mb-3">{group.title}</h1>

          <div className="flex flex-wrap gap-4 text-sm text-warm-mid mb-3">
            <span className="flex items-center gap-1.5 text-warm-dark font-medium">
              <Calendar size={13} className="text-warm-light" />{group.scheduledDate}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock size={13} className="text-warm-light" />{group.scheduledTime}
              <span className="text-xs text-warm-light">Київський час</span> · {group.duration} хв
            </span>
            <span>👤 {group.supervisor.firstName} {group.supervisor.lastName}</span>
          </div>

          {group.description && (
            <p className="font-cormorant italic text-warm-mid text-base leading-relaxed">{group.description}</p>
          )}
        </div>

        {/* Case info — backend controls access */}
        {group.caseTitle && (
          <div className="bg-beige rounded-2xl p-5 mb-4">
            <p className="text-xs font-medium text-warm-light uppercase tracking-widest mb-3">Матеріали для супервізії</p>
            <p className="font-cormorant text-lg font-semibold text-warm-dark mb-1">📌 {group.caseTitle}</p>
            {group.presenterUser && (
              <p className="text-xs text-warm-light mb-3">
                Супервізант: {group.presenterUser.firstName} {group.presenterUser.lastName}
              </p>
            )}
            {group.caseDescription && (
              <div className="mb-2">
                <p className="text-xs font-medium text-warm-light mb-1">Опис випадку</p>
                <p className="text-sm text-warm-mid leading-relaxed italic">«{group.caseDescription}»</p>
              </div>
            )}
            {group.supervisionFocus && (
              <div className="mb-3">
                <p className="text-xs font-medium text-warm-light mb-1">Фокус супервізії</p>
                <p className="text-sm text-warm-mid leading-relaxed italic">«{group.supervisionFocus}»</p>
              </div>
            )}
            <div className="flex gap-4">
              {group.protocolFileUrl && (
                <a href={group.protocolFileUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-rose hover:opacity-80 transition">📄 Протокол</a>
              )}
              {group.caseVideoUrl && (
                <a href={group.caseVideoUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-rose hover:opacity-80 transition">🎥 Запис роботи</a>
              )}
            </div>
          </div>
        )}

        {/* Zoom link (confirmed participants + supervisor only) */}
        {canSeeZoom && group.zoomLink && (
          <div className="bg-gradient-to-r from-[#EEF0E8] to-beige rounded-2xl p-5 border border-rose-light mb-4">
            <p className="text-xs font-medium text-warm-light uppercase tracking-widest mb-2">Посилання на сесію</p>
            <a href={group.zoomLink} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-gradient-to-br from-[#D79A95] to-[#C8857F] text-white font-medium text-sm px-5 py-2.5 rounded-xl neu-btn-primary hover:opacity-90 transition">
              🎥 Приєднатися до Zoom
            </a>
            {group.zoomPassword && (
              <p className="text-xs text-warm-mid mt-2">Пароль: <span className="font-mono font-medium text-warm-dark">{group.zoomPassword}</span></p>
            )}
          </div>
        )}

        {/* Recording */}
        {group.recordingUrl && (group.status === 'RECORDING_AVAILABLE' || group.status === 'COMPLETED') && canSeeZoom && (
          <div className="bg-gradient-to-r from-[#E3F2FD] to-beige rounded-2xl p-5 border border-[#BBDEFB] mb-4">
            <p className="text-xs font-medium text-warm-light uppercase tracking-widest mb-2">Запис супервізії</p>
            <a href={group.recordingUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#1976D2] hover:bg-[#1565C0] text-white font-medium text-sm px-5 py-2.5 rounded-xl transition">
              🎬 Переглянути запис
            </a>
            {group.recordingExpiresAt && (
              <p className="text-xs text-warm-light mt-2">
                Доступний до: {new Date(group.recordingExpiresAt).toLocaleDateString('uk-UA')}
              </p>
            )}
          </div>
        )}

        {/* ── ACTION SECTION ── */}

        {/* 1. Book presenter — immediate inline form */}
        {group.status === 'WAITING_FOR_CASE' && !group.isSupervisor && !my && (
          <div className="bg-white rounded-2xl shadow-sm p-6 mb-4">
            <h3 className="font-cormorant text-xl font-semibold text-warm-dark mb-1">Стати супервізантом ♡</h3>
            <p className="text-sm text-warm-mid mb-5 leading-relaxed">
              Поділіться своїм випадком з колегами — разом ми знаходимо нові грані розуміння ♡
            </p>

            <form onSubmit={handleBookPresenter} className="space-y-4">
              <div>
                <label className={labelClass}>Назва випадку *</label>
                <input type="text"
                  value={presenterForm.caseTitle}
                  onChange={e => setPresenterForm(p => ({ ...p, caseTitle: e.target.value }))}
                  placeholder="Стисла назва ситуації клієнта"
                  required
                  className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Короткий опис випадку *</label>
                <textarea
                  value={presenterForm.caseDescription}
                  onChange={e => setPresenterForm(p => ({ ...p, caseDescription: e.target.value }))}
                  rows={3}
                  required
                  placeholder="Що відбувається в терапії? Який запит клієнта?"
                  className={inputClass + ' resize-none'} />
              </div>
              <div>
                <label className={labelClass}>Фокус супервізії *</label>
                <textarea
                  value={presenterForm.supervisionFocus}
                  onChange={e => setPresenterForm(p => ({ ...p, supervisionFocus: e.target.value }))}
                  rows={2}
                  required
                  placeholder="З яким питанням ви звертаєтесь до групи? Що хочете дослідити?"
                  className={inputClass + ' resize-none'} />
              </div>

              <p className="text-xs text-warm-light leading-relaxed italic">
                Подаючи випадок, ви підтверджуєте, що матеріали деперсоналізовані та клієнт дав згоду на їх використання в навчальних цілях.
              </p>

              {bookError && (
                <div className="flex items-start gap-2 bg-red-50 text-red-500 rounded-xl px-4 py-3 text-sm">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />{bookError}
                </div>
              )}

              <button type="submit" disabled={booking}
                className="w-full bg-gradient-to-br from-[#D79A95] to-[#C8857F] text-white font-medium text-sm px-6 py-2.5 rounded-xl neu-btn-primary hover:opacity-90 transition disabled:opacity-50">
                {booking ? 'Подаємо випадок...' : 'Подати випадок ♡'}
              </button>
            </form>
          </div>
        )}

        {/* 2. Presenter case details update form */}
        {amPresenter && now < sessionDt && (
          <div className="bg-white rounded-2xl shadow-sm p-6 mb-4">
            <div className="flex items-start justify-between gap-3 mb-1">
              <h3 className="font-cormorant text-xl font-semibold text-warm-dark">Матеріали для супервізії ♡</h3>
              {caseDetailsComplete && !showCaseForm && (
                <span className="text-xs bg-[#E8F5E9] text-[#4CAF50] px-2 py-0.5 rounded-full shrink-0">✓ Заповнено</span>
              )}
            </div>
            {presenterDeadlinePassed && !caseDetailsComplete && (
              <div className="flex items-start gap-2 bg-[#FFF3E0] text-[#E6930A] rounded-xl px-4 py-3 text-sm mb-3">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                Матеріали потрібно надати якомога скоріше — до сесії менше 3 днів!
              </div>
            )}
            {!presenterDeadlinePassed && (
              <p className="text-xs text-warm-light mb-3">Надайте матеріали не пізніше ніж за 3 дні до сесії</p>
            )}

            {!showCaseForm ? (
              <button onClick={() => setShowCaseForm(true)}
                className="text-sm text-rose hover:opacity-80 font-medium transition">
                {caseDetailsComplete ? 'Редагувати матеріали →' : 'Завантажити матеріали →'}
              </button>
            ) : (
              <form onSubmit={handleSaveCaseDetails} className="space-y-4 mt-3">
                <div>
                  <label className={labelClass}>Назва випадку *</label>
                  <input type="text" value={caseForm.caseTitle}
                    onChange={e => setCaseForm(p => ({ ...p, caseTitle: e.target.value }))}
                    required placeholder="Стисла назва ситуації клієнта" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Опис випадку</label>
                  <textarea value={caseForm.caseDescription}
                    onChange={e => setCaseForm(p => ({ ...p, caseDescription: e.target.value }))}
                    rows={3} placeholder="Що відбувається в терапії?" className={inputClass + ' resize-none'} />
                </div>
                <div>
                  <label className={labelClass}>Фокус супервізії</label>
                  <textarea value={caseForm.supervisionFocus}
                    onChange={e => setCaseForm(p => ({ ...p, supervisionFocus: e.target.value }))}
                    rows={2} placeholder="З яким питанням ви звертаєтесь до групи?" className={inputClass + ' resize-none'} />
                </div>
                <div>
                  <label className={labelClass}>Протокол сесії (PDF/DOCX)</label>
                  <input type="file" accept=".pdf,.docx,.doc"
                    onChange={e => setCaseFile(e.target.files?.[0] || null)}
                    className="w-full text-sm text-warm-mid file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-rose-light file:text-rose hover:file:bg-[#F5D6CE] transition" />
                  {group.protocolFileUrl && !caseFile && (
                    <p className="text-xs text-warm-light mt-1">
                      Поточний файл: <a href={group.protocolFileUrl} target="_blank" rel="noopener noreferrer" className="text-rose hover:opacity-80">переглянути</a>
                    </p>
                  )}
                </div>
                <div>
                  <label className={labelClass}>Посилання на запис роботи з клієнтом</label>
                  <input type="url" value={caseForm.caseVideoUrl}
                    onChange={e => setCaseForm(p => ({ ...p, caseVideoUrl: e.target.value }))}
                    placeholder="https://..." className={inputClass} />
                </div>
                {caseError && (
                  <div className="flex items-start gap-2 bg-red-50 text-red-500 rounded-xl px-4 py-3 text-sm">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" />{caseError}
                  </div>
                )}
                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowCaseForm(false)}
                    className="flex-1 border border-[#E5DAD9] bg-white text-warm-mid rounded-xl py-2.5 text-sm font-medium hover:bg-[#F2F0EA] hover:border-[#D79A95]/30 transition neu-btn">
                    Скасувати
                  </button>
                  <button type="submit" disabled={savingCase}
                    className="flex-1 bg-gradient-to-br from-[#D79A95] to-[#C8857F] text-white font-medium rounded-xl py-2.5 text-sm neu-btn-primary hover:opacity-90 transition disabled:opacity-50">
                    {savingCase ? 'Зберігаємо...' : 'Зберегти'}
                  </button>
                </div>
              </form>
            )}
            {caseSaved && !showCaseForm && (
              <p className="text-sm text-[#4CAF50] mt-2">✓ Матеріали збережено</p>
            )}
          </div>
        )}

        {/* 3. My participation status */}
        {my && (
          <div className="mb-4">
            {(my.paymentStatus === 'CONFIRMED' || my.paymentStatus === 'FREE') && (
              <div className="bg-[#F1F8E9] border border-[#C8E6C9] rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">✅</span>
                  <p className="text-sm font-semibold text-[#2E7D32]">
                    {my.paymentStatus === 'FREE' ? 'Участь підтверджена — безкоштовно' : 'Участь підтверджена — оплату отримано'}
                  </p>
                </div>
                <p className="text-xs text-[#4CAF50] pl-6">
                  {canSeeZoom && group.zoomLink ? 'Посилання на Zoom доступне вище ↑' : 'Ви зареєстровані на подію'}
                </p>
              </div>
            )}

            {my.paymentStatus === 'RECEIPT_UPLOADED' && (
              <div className="bg-[#E3F2FD] border border-[#90CAF9] rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">📎</span>
                  <p className="text-sm font-semibold text-[#1565C0]">Квитанцію надіслано — очікує перевірки</p>
                </div>
                <p className="text-xs text-[#1976D2] pl-6">
                  Супервізор перевірить оплату та підтвердить вашу участь. Після підтвердження ви отримаєте посилання на Zoom.
                </p>
              </div>
            )}

            {my.paymentStatus === 'PENDING' && (
              <div className="bg-gradient-to-r from-[#EEF0E8] to-beige border border-rose-light rounded-2xl p-5">
                <p className="text-xs font-medium text-warm-light uppercase tracking-widest mb-3">Ваша реєстрація</p>

                {group.price === 0 ? (
                  <div className="flex items-center gap-2">
                    <span className="text-base">🎉</span>
                    <p className="text-sm font-medium text-warm-dark">Ви зареєстровані — участь безкоштовна ♡</p>
                  </div>
                ) : group.paymentInstructions ? (
                  <>
                    <div className="flex items-start gap-2 bg-[#FFF3E0] border border-[#FFE082] rounded-xl px-4 py-3 mb-4">
                      <span className="text-base leading-none mt-0.5">⚠️</span>
                      <div>
                        <p className="text-sm font-semibold text-[#E65100]">Необхідна оплата</p>
                        <p className="text-xs text-[#E6930A] mt-0.5">
                          Переказайте {group.price} {group.currency} за реквізитами нижче та надішліть скрін — після перевірки ви отримаєте Zoom-посилання
                        </p>
                      </div>
                    </div>
                    <div className="bg-white rounded-xl p-3 text-sm text-warm-dark whitespace-pre-wrap mb-4 leading-relaxed border border-sand">
                      {group.paymentInstructions}
                    </div>
                    <div className="space-y-2">
                      <label className={labelClass}>Скрін підтвердження оплати</label>
                      <input type="file" accept="image/*,.pdf"
                        onChange={e => setReceiptFile(e.target.files?.[0] || null)}
                        className="w-full text-sm text-warm-mid file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-rose-light file:text-rose hover:file:bg-[#F5D6CE] transition" />
                      {receiptError && <p className="text-red-500 text-xs">{receiptError}</p>}
                      <button onClick={handleUploadReceipt} disabled={!receiptFile || uploadingReceipt}
                        className="bg-gradient-to-br from-[#D79A95] to-[#C8857F] text-white font-medium text-sm px-5 py-2 rounded-xl shadow-[0_2px_8px_rgba(215,154,149,0.25)] hover:opacity-90 transition disabled:opacity-50">
                        {uploadingReceipt ? 'Завантажуємо...' : 'Надіслати скрін оплати'}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex items-start gap-2">
                    <span className="text-base leading-none mt-0.5">🕐</span>
                    <div>
                      <p className="text-sm font-medium text-warm-dark">Ви зареєстровані</p>
                      <p className="text-xs text-warm-mid mt-1">
                        Реквізити для оплати ({group.price} {group.currency}) з'являться тут після того, як супервізор відкриє реєстрацію
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 4. Join as listener */}
        {group.status === 'REGISTRATION_OPEN' && !group.isSupervisor && !my && (
          <div className="bg-white rounded-2xl shadow-sm p-6 mb-4">
            <h3 className="font-cormorant text-xl font-semibold text-warm-dark mb-1">Приєднатися як слухач ♡</h3>
            <p className="text-sm text-warm-mid mb-4 leading-relaxed">
              {group.price > 0
                ? `Вартість участі: ${group.price} ${group.currency}. Реквізити для оплати ви отримаєте після реєстрації.`
                : 'Участь безкоштовна ♡'}
            </p>

            <button onClick={() => { setJoinError(''); setShowEthicsModal(true) }}
              className="bg-gradient-to-br from-[#D79A95] to-[#C8857F] text-white font-medium text-sm px-6 py-2.5 rounded-xl neu-btn-primary hover:opacity-90 transition">
              Зареєструватися
            </button>
          </div>
        )}

        {/* Status info messages */}
        {group.status === 'CASE_CONFIRMED' && !my && !group.isSupervisor && (
          <div className="bg-beige rounded-2xl p-5 mb-4">
            <p className="font-cormorant italic text-warm-mid leading-relaxed">
              Реєстрацію ще не відкрито ♡<br />
              Слідкуйте за оновленнями — реквізити для оплати з'являться тут.
            </p>
          </div>
        )}
        {group.status === 'REGISTRATION_CLOSED' && !canSeeZoom && (
          <div className="bg-beige rounded-2xl p-5 mb-4">
            <p className="font-cormorant italic text-warm-mid">Реєстрація закрита. Сесія скоро відбудеться ♡</p>
          </div>
        )}
        {group.status === 'WAITING_FOR_RECORDING' && (
          <div className="bg-beige rounded-2xl p-5 mb-4">
            <p className="font-cormorant italic text-warm-mid">Запис сесії скоро з'явиться тут ♡</p>
          </div>
        )}
        {group.status === 'COMPLETED' && (
          <div className="bg-beige rounded-2xl p-5 mb-4">
            <p className="font-cormorant text-lg font-semibold text-warm-dark mb-1">Супервізію завершено ♡</p>
            <p className="text-sm text-warm-mid">Запис про участь додано до вашого журналу.</p>
          </div>
        )}
      </div>

      {/* Ethics confirmation modal for listeners */}
      {showEthicsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-cormorant text-xl font-semibold text-warm-dark leading-snug">
                Етичні зобов'язання учасника ♡
              </h3>
              <button onClick={() => setShowEthicsModal(false)}
                className="text-warm-light hover:text-warm-mid transition ml-3 shrink-0">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-warm-mid mb-4 leading-relaxed">
              Будь ласка, ознайомтесь та підтвердіть кожен пункт, щоб продовжити реєстрацію.
            </p>
            <div className="space-y-3 mb-5">
              {ETHICS_ITEMS.map((item, i) => (
                <label key={i} className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={ethicsChecks[i]}
                    onChange={e => {
                      const next = [...ethicsChecks]
                      next[i] = e.target.checked
                      setEthicsChecks(next)
                    }}
                    className="mt-0.5 w-4 h-4 rounded accent-rose shrink-0"
                  />
                  <span className="text-sm text-warm-mid leading-relaxed group-hover:text-warm-dark transition">{item}</span>
                </label>
              ))}
            </div>
            {joinError && (
              <div className="flex items-start gap-2 bg-red-50 text-red-500 rounded-xl px-4 py-3 text-sm mb-3">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />{joinError}
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setShowEthicsModal(false)}
                className="flex-1 border border-[#E5DAD9] bg-white text-warm-mid rounded-xl py-2.5 text-sm font-medium hover:bg-[#F2F0EA] hover:border-[#D79A95]/30 transition neu-btn">
                Скасувати
              </button>
              <button onClick={handleJoin} disabled={!allEthicsChecked || joining}
                className="flex-1 bg-gradient-to-br from-[#D79A95] to-[#C8857F] text-white font-medium rounded-xl py-2.5 text-sm neu-btn-primary hover:opacity-90 transition disabled:opacity-50">
                {joining ? 'Реєструємось...' : 'Підтвердити та зареєструватись'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
