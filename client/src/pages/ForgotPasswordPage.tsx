import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/axios'

function HeartSvg() {
  return (
    <svg width="28" height="26" viewBox="0 0 24 22" fill="#A2C2BE" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
    </svg>
  )
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      await api.post('/auth/forgot-password', { email })
      setSent(true)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Помилка. Спробуйте ще раз.')
    } finally {
      setIsLoading(false)
    }
  }

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

          <h2 className="text-lg font-medium text-warm-dark mb-2">Відновлення пароля</h2>

          {sent ? (
            <div>
              <div className="bg-emerald-50 rounded-xl px-4 py-4 mb-6">
                <p className="text-sm text-emerald-700 font-medium mb-1">Лист надіслано</p>
                <p className="text-sm text-emerald-600">
                  Якщо цей email зареєстрований, ви отримаєте лист з інструкціями для відновлення пароля.
                </p>
              </div>
              <p className="text-center">
                <Link to="/login" className="text-sm text-rose hover:opacity-80 font-medium transition">
                  Повернутись до входу
                </Link>
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-warm-light mb-6">
                Введіть email вашого облікового запису — ми надішлемо посилання для встановлення нового пароля.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-warm-mid mb-1.5">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    placeholder="your@email.com"
                    className="w-full border border-sand rounded-xl px-4 py-2.5 text-warm-dark placeholder-warm-light bg-white focus:outline-none focus:border-rose focus:ring-1 focus:ring-rose-light transition text-sm"
                  />
                </div>

                {error && <p className="text-red-500 text-sm bg-red-50 rounded-xl px-4 py-2.5">{error}</p>}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-rose hover:bg-[#CC3A00] disabled:opacity-60 text-white font-medium rounded-xl py-3 transition text-sm"
                >
                  {isLoading ? 'Надсилаємо...' : 'Надіслати посилання'}
                </button>
              </form>

              <p className="text-center text-sm text-warm-light mt-6">
                <Link to="/login" className="text-rose hover:opacity-80 font-medium transition">
                  Повернутись до входу
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
