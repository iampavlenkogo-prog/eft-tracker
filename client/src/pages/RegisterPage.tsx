import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const EFT_LEVELS = [
  { value: 'BASIC', label: 'Базовий курс' },
  { value: 'ADVANCED', label: 'Поглиблений курс' },
  { value: 'STUDENT', label: 'Студент Інституту ЕФТ' },
  { value: 'CERTIFIED', label: 'Сертифікований терапевт' },
  { value: 'SUPERVISOR_CANDIDATE', label: 'Кандидат у супервізори' },
  { value: 'SUPERVISOR', label: 'Сертифікований супервізор' },
]

const inputCls = 'w-full border border-[#D5E6E5] rounded-2xl px-5 py-3.5 text-warm-dark placeholder-warm-light bg-white/75 focus:outline-none focus:border-[#4D8A85] focus:ring-1 focus:ring-rose-light transition neu-input text-sm font-inter'

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const [form, setForm] = useState({
    email: '', password: '', firstName: '', lastName: '',
    latinName: '', phone: '', telegram: '', eftLevel: 'BASIC',
  })

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }))

  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (form.password.length < 8) {
      setError('Пароль має містити щонайменше 8 символів')
      return
    }
    setStep(2)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      await register(form)
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Помилка реєстрації')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen font-inter relative overflow-hidden flex flex-col"
      style={{ background: 'linear-gradient(155deg, #F1F7F7 0%, #EEF0E8 45%, #D5E6E5 100%)' }}
    >
      {/* Decorative background blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full"
          style={{ background: 'radial-gradient(circle, #C5DFDE 0%, transparent 70%)', opacity: 0.5 }} />
        <div className="absolute -top-16 -right-16 w-96 h-96 rounded-full"
          style={{ background: 'radial-gradient(circle, #A8DDD9 0%, transparent 70%)', opacity: 0.35 }} />
        <div className="absolute bottom-24 -left-12 w-56 h-56 rounded-full"
          style={{ background: 'radial-gradient(circle, #C5DFDE 0%, transparent 70%)', opacity: 0.4 }} />
        <div className="absolute bottom-0 right-1/4 w-40 h-40 rounded-full"
          style={{ background: 'radial-gradient(circle, #D5E6E5 0%, transparent 70%)', opacity: 0.45 }} />
      </div>

      {/* Main scrollable content */}
      <div className="relative flex-1 flex flex-col items-center px-4 pt-2 pb-10">

        {/* Logo + Title */}
        <div className="text-center mb-3">
          <img src="/illustrations/Logo_obiymu.png" alt="Обійму" className="h-48 mx-auto object-contain" style={{ marginBottom: '-32px' }} />
          <h1 className="font-cormorant text-4xl md:text-5xl text-warm-dark font-semibold leading-tight">
            Простір для ЕФТ терапевтів
          </h1>
          <p className="font-cormorant italic text-warm-mid text-lg mt-2">
            Почни свій шлях у спільноті любові та глибинного зв'язку
          </p>
        </div>

        {/* Center circle illustration */}
        <div className="w-36 h-36 rounded-full overflow-hidden shadow-md border-[3px] border-white/70 mb-6 shrink-0">
          <img src="/illustrations/embrace.png" alt="" className="w-full h-full object-cover" />
        </div>

        {/* Form */}
        <div className="w-full max-w-sm">
          <h2 className="font-cormorant text-2xl text-warm-dark font-semibold text-center mb-5">
            {step === 1 ? 'Давай знайомитися' : 'Розкажи більше про себе'}
          </h2>

          {step === 1 ? (
            <form onSubmit={handleStep1} className="space-y-3">
              <input
                type="email"
                value={form.email}
                onChange={set('email')}
                required
                placeholder="Електронна пошта"
                className={inputCls}
              />
              <input
                type="password"
                value={form.password}
                onChange={set('password')}
                required
                minLength={8}
                placeholder="Створи пароль (мінімум 8 символів)"
                className={inputCls}
              />

              {error && (
                <p className="text-red-500 text-sm bg-red-50/80 rounded-xl px-4 py-2.5">{error}</p>
              )}

              <button
                type="submit"
                className="w-full bg-rose hover:bg-[#5AAEAA] text-white font-medium rounded-2xl py-3.5 transition text-sm mt-1 shadow-sm"
              >
                Далі →
              </button>

              <p className="text-center text-sm text-warm-mid pt-1">
                Вже маєш акаунт?{' '}
                <Link to="/login" className="text-warm-dark font-medium hover:text-rose transition">
                  Увійти
                </Link>
              </p>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Row 1: Прізвище + Ім'я */}
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={form.lastName}
                  onChange={set('lastName')}
                  required
                  placeholder="Прізвище *"
                  className={inputCls}
                />
                <input
                  type="text"
                  value={form.firstName}
                  onChange={set('firstName')}
                  required
                  placeholder="Ім'я *"
                  className={inputCls}
                />
              </div>

              {/* Row 2: Прізвище та ім'я латиницею */}
              <input
                type="text"
                value={form.latinName}
                onChange={set('latinName')}
                placeholder="Прізвище та ім'я латиницею (для сертифікатів)"
                className={inputCls}
              />

              <input
                type="tel"
                value={form.phone}
                onChange={set('phone')}
                placeholder="Телефон"
                className={inputCls}
              />
              <div>
                <input
                  type="text"
                  value={form.telegram}
                  onChange={set('telegram')}
                  required
                  placeholder="Telegram (@username) *"
                  className={inputCls}
                />
                <p className="text-xs text-warm-light mt-1 pl-1">
                  Потрібен для зв'язку з супервізором після бронювання
                </p>
              </div>
              <select value={form.eftLevel} onChange={set('eftLevel')} className={inputCls}>
                {EFT_LEVELS.map(l => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>

              {error && (
                <p className="text-red-500 text-sm bg-red-50/80 rounded-xl px-4 py-2.5">{error}</p>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-rose hover:bg-[#5AAEAA] disabled:opacity-60 text-white font-medium rounded-2xl py-3.5 transition text-sm mt-1 shadow-sm"
              >
                {isLoading ? 'Реєструємось...' : 'Завершити реєстрацію'}
              </button>

              <button
                type="button"
                onClick={() => { setStep(1); setError('') }}
                className="w-full text-center text-sm text-warm-light hover:text-warm-mid transition py-1"
              >
                ← Назад
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
