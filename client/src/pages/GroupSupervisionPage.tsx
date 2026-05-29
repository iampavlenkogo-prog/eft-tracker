import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Calendar, Clock, Users, ChevronLeft, AlertCircle } from 'lucide-react'
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
  caseTitle: string | null; caseDescription: string | null
  protocolFileUrl: string | null; caseVideoUrl: string | null
  recordingUrl: string | null; recordingExpiresAt: string | null
  supervisor: { id: string; firstName: string; lastName: string; telegram: string | null }
  presenterUser: { id: string; firstName: string; lastName: string } | null
  participants: Participant[]
  myParticipation: Participant | null
  isSupervisor: boolean
}

const inputClass = 'w-full border border-sand rounded-xl px-4 py-2.5 text-warm-dark text-sm focus:outline-none focus:border-rose focus:ring-1 focus:ring-rose-light transition bg-white'
const labelClass = 'block text-sm font-medium text-warm-mid mb-1.5'

const STATUS_LABELS: Record<string, string> = {
  WAITING_FOR_CASE: 'Очікує супервізанта',
  CASE_CONFIRMED: 'Супервізанта визначено',
  REGISTRATION_OPEN: 'Реєстрація відкрита',
  REGISTRATION_CLOSED: 'Реєстрація закрита',
  WAITING_FOR_RECORDING: 'Очікує запис',
  RECORDING_AVAILABLE: 'Запис доступний',
  COMPLETED: 'Завершено',
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
  const [group, setGroup] = useState<GroupSupervision | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Book presenter
  const [presenterEthics, setPresenterEthics] = useState(false)
  const [booking, setBooking] = useState(false)
  const [bookError, setBookError] = useState('')

  // Presenter case details form
  const [showCaseForm, setShowCaseForm] = useState(false)
  const [caseForm, setCaseForm] = useState({ caseTitle: '', caseDescription: '', caseVideoUrl: '' })
  const [caseFile, setCaseFile] = useState<File | null>(null)
  const [savingCase, setSavingCase] = useState(false)
  const [caseError, setCaseError] = useState('')
  const [caseSaved, setCaseSaved] = useState(false)

  // Join as listener
  const [joinEthics, setJoinEthics] = useState(false)
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
        // Pre-fill case form if presenter has already submitted details
        if (res.data.caseTitle) {
          setCaseForm({
            caseTitle: res.data.caseTitle || '',
            caseDescription: res.data.caseDescription || '',
            caseVideoUrl: res.data.caseVideoUrl || '',
          })
        }
      })
      .catch(err => setError(err.response?.data?.error || 'Помилка завантаження'))
      .finally(() => setLoading(false))
  }, [id])

  const handleBookPresenter = async () => {
    if (!presenterEthics) { setBookError('Підтвердіть дотримання етичних норм'); return }
    setBooking(true); setBookError('')
    try {
      const res = await api.post(`/group-supervisions/${id}/book-presenter`, { ethicsConfirmed: true })
      setGroup(prev => prev ? {
        ...prev,
        status: 'CASE_CONFIRMED',
        presenterUserId: user!.id,
        presenterUser: { id: user!.id, firstName: user!.firstName, lastName: user!.lastName },
        myParticipation: { id: 'new', userId: user!.id, isPresenter: true, paymentStatus: 'PENDING', paymentReceiptUrl: null, user: { id: user!.id, firstName: user!.firstName, lastName: user!.lastName } },
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
    if (!joinEthics) { setJoinError('Підтвердіть дотримання етичних норм'); return }
    setJoining(true); setJoinError('')
    try {
      const res = await api.post(`/group-supervisions/${id}/join`, { ethicsConfirmed: true })
      setGroup(prev => prev ? {
        ...prev,
        myParticipation: { ...res.data, user: { id: user!.id, firstName: user!.firstName, lastName: user!.lastName } },
        participants: [...prev.participants, { ...res.data, user: { id: user!.id, firstName: user!.firstName, lastName: user!.lastName } }],
      } : prev)
    } catch (err: any) { setJoinError(err.response?.data?.error || 'Помилка') }
    finally { setJoining(false) }
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

  // 3 days before check for presenter case details deadline
  const sessionDt = new Date(`${group.scheduledDate}T${group.scheduledTime}`)
  const threeDaysBefore = new Date(sessionDt.getTime() - 3 * 24 * 60 * 60 * 1000)
  const now = new Date()
  const presenterDeadlinePassed = now > threeDaysBefore
  const caseDetailsComplete = !!(group.caseTitle && group.protocolFileUrl)

  return (
    <Layout>
      <div className="max-w-2xl">
        <Link to="/dashboard" className="flex items-center gap-1 text-sm text-warm-light hover:text-warm-mid mb-6 transition">
          <ChevronLeft size={14} />Назад на головну
        </Link>

        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-4">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_BADGE[group.status]}`}>
              {STATUS_LABELS[group.status]}
            </span>
            <div className="flex flex-wrap gap-3 text-xs text-warm-mid">
              <span className="flex items-center gap-1"><Users size={11} />{confirmedCount} учасників</span>
              {group.price > 0 && <span>💰 {group.price} {group.currency}</span>}
            </div>
          </div>

          <h1 className="font-cormorant text-3xl font-semibold text-warm-dark mb-3">{group.title}</h1>

          <div className="flex flex-wrap gap-4 text-sm text-warm-mid mb-3">
            <span className="flex items-center gap-1.5 text-warm-dark font-medium"><Calendar size={13} className="text-warm-light" />{group.scheduledDate}</span>
            <span className="flex items-center gap-1.5"><Clock size={13} className="text-warm-light" />{group.scheduledTime} · {group.duration} хв</span>
            <span>👤 {group.supervisor.firstName} {group.supervisor.lastName}</span>
          </div>

          {group.description && (
            <p className="font-cormorant italic text-warm-mid text-base leading-relaxed">{group.description}</p>
          )}
        </div>

        {/* Case info — supervisor + confirmed participants (backend controls access) */}
        {group.caseTitle && (
          <div className="bg-beige rounded-2xl p-5 mb-4">
            <p className="text-xs font-medium text-warm-light uppercase tracking-widest mb-2">Матеріали для супервізії</p>
            <p className="font-cormorant text-lg font-semibold text-warm-dark mb-1">📌 {group.caseTitle}</p>
            {group.presenterUser && (
              <p className="text-xs text-warm-light">Супервізант: {group.presenterUser.firstName} {group.presenterUser.lastName}</p>
            )}
            {group.caseDescription && (
              <p className="text-sm text-warm-mid mt-2 leading-relaxed italic">«{group.caseDescription}»</p>
            )}
            <div className="flex gap-4 mt-3">
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

        {/* Zoom link (visible only to confirmed participants + supervisor) */}
        {canSeeZoom && group.zoomLink && (
          <div className="bg-gradient-to-r from-[#FDF0EC] to-beige rounded-2xl p-5 border border-rose-light mb-4">
            <p className="text-xs font-medium text-warm-light uppercase tracking-widest mb-2">Посилання на сесію</p>
            <a href={group.zoomLink} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-rose hover:bg-[#B5745A] text-white font-medium text-sm px-5 py-2.5 rounded-xl transition">
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
              <p className="text-xs text-warm-light mt-2">Доступний до: {new Date(group.recordingExpiresAt).toLocaleDateString('uk-UA')}</p>
            )}
          </div>
        )}

        {/* ── ACTION SECTION ── */}

        {/* Registration not yet open notice (for non-supervisors, non-presenters who haven't joined) */}
        {(group.status === 'CASE_CONFIRMED') && !group.isSupervisor && !my && (
          <div className="bg-beige rounded-2xl p-5 mb-4 text-center">
            <p className="text-sm font-medium text-warm-dark mb-1">Реєстрацію ще не відкрито</p>
            <p className="text-xs text-warm-light">Супервізор відкриє реєстрацію для учасників після підтвердження супервізанта</p>
          </div>
        )}

        {/* 1. Book presenter spot (WAITING_FOR_CASE, not supervisor, not already joined) */}
        {group.status === 'WAITING_FOR_CASE' && !group.isSupervisor && !my && (
          <div className="bg-white rounded-2xl shadow-sm p-6 mb-4">
            <h3 className="font-cormorant text-xl font-semibold text-warm-dark mb-1">Стати супервізантом ♡</h3>
            <p className="text-sm text-warm-mid mb-5 leading-relaxed">
              Заброньуйте місце супервізанта — деталі свого випадку (протокол, запис, запит) ви зможете заповнити після підтвердження, не пізніше ніж за 3 дні до сесії.
            </p>

            <label className="flex items-start gap-3 cursor-pointer mb-5">
              <input type="checkbox" checked={presenterEthics} onChange={e => setPresenterEthics(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded accent-rose" />
              <span className="text-sm text-warm-mid leading-relaxed">
                Підтверджую, що матеріали будуть деперсоналізовані та відповідатимуть етичному кодексу ЕФТ-терапевта. Клієнт дасть згоду на використання матеріалів у навчальних цілях.
              </span>
            </label>

            {bookError && (
              <div className="flex items-start gap-2 bg-red-50 text-red-500 rounded-xl px-4 py-3 text-sm mb-3">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />{bookError}
              </div>
            )}

            <button onClick={handleBookPresenter} disabled={booking}
              className="bg-rose hover:bg-[#B5745A] disabled:opacity-60 text-white font-medium text-sm px-6 py-2.5 rounded-xl transition">
              {booking ? 'Бронюємо...' : 'Забронювати місце супервізанта'}
            </button>
          </div>
        )}

        {/* 2. Presenter case details form (shown if I'm presenter, session not yet started) */}
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
                {caseDetailsComplete ? 'Редагувати матеріали →' : 'Заповнити матеріали →'}
              </button>
            ) : (
              <form onSubmit={handleSaveCaseDetails} className="space-y-4 mt-3">
                <div>
                  <label className={labelClass}>Назва випадку *</label>
                  <input type="text" value={caseForm.caseTitle} onChange={e => setCaseForm(p => ({ ...p, caseTitle: e.target.value }))}
                    required placeholder="Стисла назва ситуації клієнта" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Запит на супервізію</label>
                  <textarea value={caseForm.caseDescription} onChange={e => setCaseForm(p => ({ ...p, caseDescription: e.target.value }))}
                    rows={3} placeholder="Що відбувається в терапії? З яким питанням ви звертаєтесь до групи?" className={inputClass + ' resize-none'} />
                </div>
                <div>
                  <label className={labelClass}>Протокол сесії (PDF/DOCX)</label>
                  <input type="file" accept=".pdf,.docx,.doc" onChange={e => setCaseFile(e.target.files?.[0] || null)}
                    className="w-full text-sm text-warm-mid file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-rose-light file:text-rose hover:file:bg-[#F5D6CE] transition" />
                  {group.protocolFileUrl && !caseFile && (
                    <p className="text-xs text-warm-light mt-1">Поточний файл: <a href={group.protocolFileUrl} target="_blank" rel="noopener noreferrer" className="text-rose hover:opacity-80">переглянути</a></p>
                  )}
                </div>
                <div>
                  <label className={labelClass}>Посилання на запис роботи з клієнтом</label>
                  <input type="url" value={caseForm.caseVideoUrl} onChange={e => setCaseForm(p => ({ ...p, caseVideoUrl: e.target.value }))}
                    placeholder="https://..." className={inputClass} />
                </div>
                {caseError && (
                  <div className="flex items-start gap-2 bg-red-50 text-red-500 rounded-xl px-4 py-3 text-sm">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" />{caseError}
                  </div>
                )}
                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowCaseForm(false)} className="flex-1 border border-sand text-warm-mid hover:bg-beige font-medium rounded-xl py-2.5 text-sm transition">Скасувати</button>
                  <button type="submit" disabled={savingCase} className="flex-1 bg-rose hover:bg-[#B5745A] disabled:opacity-60 text-white font-medium rounded-xl py-2.5 text-sm transition">
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

        {/* 3. My participation status (presenter or listener) */}
        {my && (
          <div className="bg-gradient-to-r from-[#FDF0EC] to-beige rounded-2xl p-5 border border-rose-light mb-4">
            <p className="text-xs font-medium text-warm-light uppercase tracking-widest mb-2">Ваша реєстрація</p>
            {my.paymentStatus === 'FREE' && <p className="text-sm text-warm-mid">Участь безкоштовна ✓</p>}
            {my.paymentStatus === 'CONFIRMED' && (
              <p className="text-sm text-[#4CAF50] font-medium">✅ Оплату підтверджено — посилання на Zoom доступне вище</p>
            )}
            {my.paymentStatus === 'RECEIPT_UPLOADED' && (
              <p className="text-sm text-[#1976D2]">📎 Скрін надіслано — очікуйте підтвердження від супервізора</p>
            )}
            {my.paymentStatus === 'PENDING' && group.price > 0 && (
              <div className="mt-1">
                {group.paymentInstructions ? (
                  <>
                    <p className="text-sm text-warm-mid mb-3">Для участі оплатіть {group.price} {group.currency} та надішліть скрін оплати</p>
                    <div className="bg-white rounded-xl p-3 text-sm text-warm-dark whitespace-pre-wrap mb-3 leading-relaxed border border-sand">{group.paymentInstructions}</div>
                    <div className="space-y-2">
                      <label className={labelClass}>Скрін підтвердження оплати</label>
                      <input type="file" accept="image/*,.pdf" onChange={e => setReceiptFile(e.target.files?.[0] || null)}
                        className="w-full text-sm text-warm-mid file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-rose-light file:text-rose hover:file:bg-[#F5D6CE] transition" />
                      {receiptError && <p className="text-red-500 text-xs">{receiptError}</p>}
                      <button onClick={handleUploadReceipt} disabled={!receiptFile || uploadingReceipt}
                        className="bg-rose hover:bg-[#B5745A] disabled:opacity-60 text-white font-medium text-sm px-5 py-2 rounded-xl transition">
                        {uploadingReceipt ? 'Завантажуємо...' : 'Надіслати скрін'}
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-warm-mid">Реквізити для оплати з'являться тут після того, як супервізор відкриє реєстрацію ♡</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* 4. Join as listener (REGISTRATION_OPEN, not supervisor, not presenter, not joined) */}
        {group.status === 'REGISTRATION_OPEN' && !group.isSupervisor && !my && (
          <div className="bg-white rounded-2xl shadow-sm p-6 mb-4">
            <h3 className="font-cormorant text-xl font-semibold text-warm-dark mb-1">Приєднатися як слухач ♡</h3>
            <p className="text-sm text-warm-mid mb-4 leading-relaxed">
              {group.price > 0
                ? `Вартість участі: ${group.price} ${group.currency}. Реквізити для оплати ви отримаєте після реєстрації.`
                : 'Участь безкоштовна ♡'}
            </p>

            <label className="flex items-start gap-3 cursor-pointer mb-4">
              <input type="checkbox" checked={joinEthics} onChange={e => setJoinEthics(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded accent-rose" />
              <span className="text-sm text-warm-mid leading-relaxed">
                Підтверджую збереження конфіденційності щодо матеріалів, які будуть представлені на сесії.
              </span>
            </label>

            {joinError && (
              <div className="flex items-start gap-2 bg-red-50 text-red-500 rounded-xl px-4 py-3 text-sm mb-3">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />{joinError}
              </div>
            )}

            <button onClick={handleJoin} disabled={joining}
              className="bg-rose hover:bg-[#B5745A] disabled:opacity-60 text-white font-medium text-sm px-6 py-2.5 rounded-xl transition">
              {joining ? 'Реєструємось...' : 'Зареєструватися'}
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
    </Layout>
  )
}
