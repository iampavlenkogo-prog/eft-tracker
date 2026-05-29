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
  maxParticipants: number; price: number; currency: string
  paymentInstructions: string | null; zoomLink: string | null
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
  WAITING_FOR_CASE: 'Очікує випадок',
  CASE_CONFIRMED: 'Випадок підтверджено',
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

  // Submit case form
  const [showCaseForm, setShowCaseForm] = useState(false)
  const [caseForm, setCaseForm] = useState({ caseTitle: '', caseDescription: '', caseVideoUrl: '' })
  const [caseFile, setCaseFile] = useState<File | null>(null)
  const [ethicsChecked, setEthicsChecked] = useState(false)
  const [caseSubmitting, setCaseSubmitting] = useState(false)
  const [caseError, setCaseError] = useState('')

  // Join form
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
      .then(res => setGroup(res.data))
      .catch(err => setError(err.response?.data?.error || 'Помилка завантаження'))
      .finally(() => setLoading(false))
  }, [id])

  const handleSubmitCase = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ethicsChecked) { setCaseError('Підтвердіть дотримання етичних норм'); return }
    if (!caseForm.caseTitle) { setCaseError('Назва випадку обовʼязкова'); return }
    setCaseSubmitting(true); setCaseError('')
    try {
      const fd = new FormData()
      fd.append('caseTitle', caseForm.caseTitle)
      fd.append('caseDescription', caseForm.caseDescription)
      fd.append('caseVideoUrl', caseForm.caseVideoUrl)
      fd.append('ethicsConfirmed', 'true')
      if (caseFile) fd.append('protocolFile', caseFile)
      const res = await api.post(`/group-supervisions/${id}/submit-case`, fd)
      setGroup(prev => prev ? { ...prev, ...res.data, myParticipation: { id: 'presenter', userId: user!.id, isPresenter: true, paymentStatus: 'FREE', paymentReceiptUrl: null, user: { id: user!.id, firstName: user!.firstName, lastName: user!.lastName } } } : prev)
      setShowCaseForm(false)
    } catch (err: any) { setCaseError(err.response?.data?.error || 'Помилка') }
    finally { setCaseSubmitting(false) }
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
  const canSeeZoom = group.isSupervisor || my?.isPresenter || my?.paymentStatus === 'CONFIRMED' || my?.paymentStatus === 'FREE'
  const confirmedCount = group.participants.filter(p => p.paymentStatus === 'CONFIRMED' || p.paymentStatus === 'FREE').length

  return (
    <Layout>
      <div className="max-w-2xl">
        <Link to="/dashboard" className="flex items-center gap-1 text-sm text-warm-light hover:text-warm-mid mb-6 transition">
          <ChevronLeft size={14} />Назад на головну
        </Link>

        {/* Header card */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-4">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_BADGE[group.status]}`}>
              {STATUS_LABELS[group.status]}
            </span>
            <div className="flex flex-wrap gap-3 text-xs text-warm-mid">
              <span className="flex items-center gap-1"><Users size={11} />{confirmedCount}/{group.maxParticipants} учасників</span>
              {group.price > 0 && <span>💰 {group.price} {group.currency}</span>}
            </div>
          </div>

          <h1 className="font-cormorant text-3xl font-semibold text-warm-dark mb-3">{group.title}</h1>

          <div className="flex flex-wrap gap-4 text-sm text-warm-mid mb-3">
            <span className="flex items-center gap-1.5 text-warm-dark font-medium"><Calendar size={13} className="text-warm-light" />{group.scheduledDate}</span>
            <span className="flex items-center gap-1.5"><Clock size={13} className="text-warm-light" />{group.scheduledTime} · {group.duration} хв</span>
            <span className="flex items-center gap-1.5">👤 {group.supervisor.firstName} {group.supervisor.lastName}</span>
          </div>

          {group.description && (
            <p className="font-cormorant italic text-warm-mid text-base leading-relaxed">{group.description}</p>
          )}
        </div>

        {/* Case info */}
        {group.caseTitle && (
          <div className="bg-beige rounded-2xl p-5 mb-4">
            <p className="text-xs font-medium text-warm-light uppercase tracking-widest mb-2">Випадок для супервізії</p>
            <p className="font-cormorant text-lg font-semibold text-warm-dark mb-1">📌 {group.caseTitle}</p>
            {group.presenterUser && (
              <p className="text-xs text-warm-light">Доповідач: {group.presenterUser.firstName} {group.presenterUser.lastName}</p>
            )}
            {group.caseDescription && (
              <p className="text-sm text-warm-mid mt-2 leading-relaxed">{group.caseDescription}</p>
            )}
            <div className="flex gap-4 mt-3">
              {group.protocolFileUrl && (
                <a href={group.protocolFileUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-rose hover:opacity-80 transition flex items-center gap-1">📄 Протокол</a>
              )}
              {group.caseVideoUrl && (
                <a href={group.caseVideoUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-rose hover:opacity-80 transition flex items-center gap-1">🎥 Відео</a>
              )}
            </div>
          </div>
        )}

        {/* Zoom link (if confirmed) */}
        {canSeeZoom && group.zoomLink && (
          <div className="bg-gradient-to-r from-[#FDF0EC] to-beige rounded-2xl p-5 border border-rose-light mb-4">
            <p className="text-xs font-medium text-warm-light uppercase tracking-widest mb-2">Zoom посилання</p>
            <a href={group.zoomLink} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-rose hover:bg-[#B5745A] text-white font-medium text-sm px-5 py-2.5 rounded-xl transition">
              🎥 Приєднатися до Zoom
            </a>
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

        {/* ── Action section ── */}

        {/* Submit case (WAITING_FOR_CASE, not supervisor, not already presenter) */}
        {group.status === 'WAITING_FOR_CASE' && !group.isSupervisor && !my && (
          <div className="bg-white rounded-2xl shadow-sm p-6 mb-4">
            <h3 className="font-cormorant text-xl font-semibold text-warm-dark mb-1">Подати свій випадок ♡</h3>
            <p className="text-sm text-warm-mid mb-4">Якщо ви хочете отримати супервізію — подайте свій випадок. Перший терапевт стає доповідачем і отримує безкоштовну участь.</p>

            {!showCaseForm ? (
              <button onClick={() => setShowCaseForm(true)}
                className="bg-rose hover:bg-[#B5745A] text-white font-medium text-sm px-6 py-2.5 rounded-xl transition">
                Подати випадок
              </button>
            ) : (
              <form onSubmit={handleSubmitCase} className="space-y-4">
                <div>
                  <label className={labelClass}>Назва випадку *</label>
                  <input type="text" value={caseForm.caseTitle} onChange={e => setCaseForm(p => ({ ...p, caseTitle: e.target.value }))}
                    required placeholder="Стислий опис ситуації клієнта" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Опис випадку (необов'язково)</label>
                  <textarea value={caseForm.caseDescription} onChange={e => setCaseForm(p => ({ ...p, caseDescription: e.target.value }))}
                    rows={3} placeholder="Що відбувається в терапії, яке питання до супервізора..." className={inputClass + ' resize-none'} />
                </div>
                <div>
                  <label className={labelClass}>Протокол сесії (PDF, DOCX, необов'язково)</label>
                  <input type="file" accept=".pdf,.docx,.doc" onChange={e => setCaseFile(e.target.files?.[0] || null)}
                    className="w-full text-sm text-warm-mid file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-rose-light file:text-rose hover:file:bg-[#F5D6CE] transition" />
                </div>
                <div>
                  <label className={labelClass}>Відео (посилання, необов'язково)</label>
                  <input type="url" value={caseForm.caseVideoUrl} onChange={e => setCaseForm(p => ({ ...p, caseVideoUrl: e.target.value }))}
                    placeholder="https://youtube.com/..." className={inputClass} />
                </div>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={ethicsChecked} onChange={e => setEthicsChecked(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded accent-rose" />
                  <span className="text-sm text-warm-mid leading-relaxed">
                    Підтверджую, що матеріали деперсоналізовані та відповідають етичному кодексу ЕФТ-терапевта. Клієнт дав згоду на використання матеріалів у навчальних цілях.
                  </span>
                </label>

                {caseError && (
                  <div className="flex items-start gap-2 bg-red-50 text-red-500 rounded-xl px-4 py-3 text-sm">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" />{caseError}
                  </div>
                )}

                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowCaseForm(false)} className="flex-1 border border-sand text-warm-mid hover:bg-beige font-medium rounded-xl py-2.5 text-sm transition">Скасувати</button>
                  <button type="submit" disabled={caseSubmitting} className="flex-1 bg-rose hover:bg-[#B5745A] disabled:opacity-60 text-white font-medium rounded-xl py-2.5 text-sm transition">
                    {caseSubmitting ? 'Надсилаємо...' : 'Подати випадок'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* My participation status */}
        {my && (
          <div className="bg-gradient-to-r from-[#FDF0EC] to-beige rounded-2xl p-5 border border-rose-light mb-4">
            <p className="text-xs font-medium text-warm-light uppercase tracking-widest mb-2">
              {my.isPresenter ? 'Ви — доповідач' : 'Ваша реєстрація'}
            </p>
            {my.isPresenter && (
              <p className="text-sm text-warm-mid font-cormorant italic">Дякуємо за подання випадку! Участь безкоштовна ♡</p>
            )}
            {!my.isPresenter && (
              <>
                {my.paymentStatus === 'FREE' && <p className="text-sm text-warm-mid">Участь безкоштовна ✓</p>}
                {my.paymentStatus === 'CONFIRMED' && <p className="text-sm text-[#4CAF50] font-medium">✅ Оплату підтверджено — посилання на Zoom доступне</p>}
                {my.paymentStatus === 'RECEIPT_UPLOADED' && <p className="text-sm text-[#1976D2]">📎 Квитанцію надіслано — очікуйте підтвердження</p>}
                {my.paymentStatus === 'PENDING' && group.price > 0 && (
                  <div className="mt-2">
                    <p className="text-sm text-warm-mid mb-3">Для участі необхідно сплатити {group.price} {group.currency}</p>
                    {group.paymentInstructions && (
                      <div className="bg-white rounded-xl p-3 text-sm text-warm-mid whitespace-pre-wrap mb-3 leading-relaxed">{group.paymentInstructions}</div>
                    )}
                    <div className="space-y-2">
                      <label className={labelClass}>Завантажте квитанцію про оплату</label>
                      <input type="file" accept="image/*,.pdf" onChange={e => setReceiptFile(e.target.files?.[0] || null)}
                        className="w-full text-sm text-warm-mid file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-rose-light file:text-rose hover:file:bg-[#F5D6CE] transition" />
                      {receiptError && <p className="text-red-500 text-xs">{receiptError}</p>}
                      <button onClick={handleUploadReceipt} disabled={!receiptFile || uploadingReceipt}
                        className="bg-rose hover:bg-[#B5745A] disabled:opacity-60 text-white font-medium text-sm px-5 py-2 rounded-xl transition">
                        {uploadingReceipt ? 'Завантажуємо...' : 'Надіслати квитанцію'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Join as listener (REGISTRATION_OPEN, not supervisor, not already joined) */}
        {group.status === 'REGISTRATION_OPEN' && !group.isSupervisor && !my && (
          <div className="bg-white rounded-2xl shadow-sm p-6 mb-4">
            <h3 className="font-cormorant text-xl font-semibold text-warm-dark mb-1">Приєднатися як слухач ♡</h3>
            <p className="text-sm text-warm-mid mb-4">
              {group.price > 0
                ? `Вартість участі: ${group.price} ${group.currency}. Після реєстрації ви отримаєте реквізити для оплати.`
                : 'Участь безкоштовна ♡'}
            </p>

            <label className="flex items-start gap-3 cursor-pointer mb-4">
              <input type="checkbox" checked={joinEthics} onChange={e => setJoinEthics(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded accent-rose" />
              <span className="text-sm text-warm-mid leading-relaxed">
                Підтверджую дотримання етичних норм: зберігання конфіденційності щодо матеріалів, які будуть представлені.
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

        {/* Status-based info messages */}
        {group.status === 'CASE_CONFIRMED' && !my && !group.isSupervisor && (
          <div className="bg-beige rounded-2xl p-5 mb-4">
            <p className="font-cormorant italic text-warm-mid">Реєстрація скоро відкриється ♡ Слідкуйте за оновленнями.</p>
          </div>
        )}
        {group.status === 'REGISTRATION_CLOSED' && !canSeeZoom && (
          <div className="bg-beige rounded-2xl p-5 mb-4">
            <p className="font-cormorant italic text-warm-mid">Реєстрація закрита. Скоро відбудеться сесія ♡</p>
          </div>
        )}
        {group.status === 'WAITING_FOR_RECORDING' && (
          <div className="bg-beige rounded-2xl p-5 mb-4">
            <p className="font-cormorant italic text-warm-mid">Запис супервізії скоро з'явиться тут ♡</p>
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
