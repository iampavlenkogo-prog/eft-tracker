import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api/axios'

function HeartSvg() {
  return (
    <svg width="28" height="26" viewBox="0 0 24 22" fill="#B8A8A4" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
    </svg>
  )
}

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') ?? ''

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => navigate('/login'), 3000)
      return () => clearTimeout(t)
    }
  }, [success, navigate])

  if (!token) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center px-4 font-inter">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-md px-8 py-10 text-center">
            <p className="text-warm-mid mb-4">Посилання недійсне або прострочене.</p>
            <Link to="/forgot-password" className="text-rose hover:opacity-80 font-medium text-sm transition">
              Запросити нове посилання
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (newPassword !== confirmPassword) { setError('Паролі не збігаються'); return }
    setIsLoading(true)
    try {
      await api.post('/auth/reset-password', { token, newPassword })
      setSuccess(true)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Помилка. Спробуйте запросити нове посилання.')
    } finally {
      setIsLoading(false)
    }
  }

  const inputClass =
    'w-full border border-sand rounded-xl px-4 py-2.5 text-warm-dark placeholder-warm-light bg-white focus:outline-none focus:border-rose focus:ring-1 focus:ring-rose-light transition text-sm'

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4 font-inter">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-md px-8 py-10">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-3">
              <HeartSvg />
              <span className="font-cormorant text-3xl text-warm-dark font-semibold">Обійми ЕФТ</span>
            </div>
            <p className="font-cormorant italic text-warm-mid text-base">Система обліку навчання</p>
          </div>

          <h2 className="text-lg font-medium text-warm-dark mb-6">Новий пароль</h2>

          {success ? (
            <div>
              <div className="bg-emerald-50 rounded-xl px-4 py-4 mb-4">
                <p className="text-sm text-emerald-700 font-medium mb-1">Пароль змінено</p>
                <p className="text-sm text-emerald-600">Ваш пароль успішно оновлено. Перенаправляємо на сторінку входу...</p>
              </div>
              <p className="text-center">
                <Link to="/login" className="text-sm text-rose hover:opacity-80 font-medium transition">Увійти зараз</Link>
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-warm-light uppercase tracking-wider mb-2">Новий пароль</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={8} placeholder="Мінімум 8 символів" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-warm-light uppercase tracking-wider mb-2">Підтвердження пароля</label>
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required placeholder="••••••••" className={inputClass} />
              </div>

              {error && <p className="text-[#A86060] text-sm bg-[#F8EEEE] rounded-2xl px-4 py-2.5">{error}</p>}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-rose hover:bg-[#A06070] disabled:opacity-60 text-white font-medium rounded-xl py-3 transition text-sm"
              >
                {isLoading ? 'Зберігаємо...' : 'Зберегти новий пароль'}
              </button>

              <p className="text-center">
                <Link to="/login" className="text-sm text-warm-light hover:text-warm-mid transition">Повернутись до входу</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
