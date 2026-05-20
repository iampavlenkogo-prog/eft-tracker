import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const inputCls = 'w-full border border-[#E8DDD0] rounded-2xl px-5 py-3.5 text-warm-dark placeholder-warm-light bg-white/75 focus:outline-none focus:border-rose focus:ring-1 focus:ring-rose-light transition text-sm font-inter'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Помилка входу')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen font-inter relative overflow-hidden flex flex-col"
      style={{ background: 'linear-gradient(155deg, #FAF7F4 0%, #F5E6D8 45%, #EDD5C2 100%)' }}
    >
      {/* Decorative background blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full"
          style={{ background: 'radial-gradient(circle, #F0D5C8 0%, transparent 70%)', opacity: 0.5 }} />
        <div className="absolute -top-16 -right-16 w-96 h-96 rounded-full"
          style={{ background: 'radial-gradient(circle, #E8C4B0 0%, transparent 70%)', opacity: 0.35 }} />
        <div className="absolute bottom-24 -left-12 w-56 h-56 rounded-full"
          style={{ background: 'radial-gradient(circle, #F0D5C8 0%, transparent 70%)', opacity: 0.4 }} />
        <div className="absolute bottom-0 right-1/4 w-40 h-40 rounded-full"
          style={{ background: 'radial-gradient(circle, #EDD5C2 0%, transparent 70%)', opacity: 0.45 }} />
      </div>

      {/* Main content */}
      <div className="relative flex-1 flex flex-col items-center justify-center px-4 pt-2 pb-6">

        {/* Logo + Title */}
        <div className="text-center mb-3">
          <img src="/illustrations/Logo_obiymu.png" alt="Обійму" className="h-48 mx-auto object-contain" style={{ marginBottom: '-32px' }} />
          <h1 className="font-cormorant text-4xl md:text-5xl text-warm-dark font-semibold leading-tight">
            Простір для ЕФТ терапевтів
          </h1>
          <p className="font-cormorant italic text-warm-mid text-lg mt-1">
            З поверненням. Ми раді бачити тебе знову ♡
          </p>
        </div>

        {/* Center circle illustration */}
        <div className="w-32 h-32 rounded-full overflow-hidden shadow-md border-[3px] border-white/70 mb-4 shrink-0">
          <img src="/illustrations/embrace.png" alt="" className="w-full h-full object-cover" />
        </div>

        {/* Form */}
        <div className="w-full max-w-sm">
          <h2 className="font-cormorant text-2xl text-warm-dark font-semibold text-center mb-3">
            Давай увійдемо
          </h2>

          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="Електронна пошта"
              className={inputCls}
            />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="Пароль"
              className={inputCls}
            />

            {error && (
              <p className="text-red-500 text-sm bg-red-50/80 rounded-xl px-4 py-2.5">{error}</p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-rose hover:bg-[#B5745A] disabled:opacity-60 text-white font-medium rounded-2xl py-3.5 transition text-sm shadow-sm"
            >
              {isLoading ? 'Входимо...' : 'Увійти у свій простір'}
            </button>

            <p className="text-center text-sm text-warm-mid pt-1">
              <Link to="/forgot-password" className="hover:text-rose transition">
                Забули пароль?
              </Link>
            </p>

            <p className="text-center text-sm text-warm-mid">
              Ще немає акаунту?{' '}
              <Link to="/register" className="text-warm-dark font-medium hover:text-rose transition">
                Зареєструватись
              </Link>
            </p>
          </form>
        </div>
      </div>

      {/* Bottom strip */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/50 backdrop-blur-sm border-t border-[#E8DDD0]/60 py-3 z-10">
        <p className="text-center font-cormorant italic text-warm-mid text-base tracking-wide">
          ✦ Зв'язок — це цілюща сила. Присутність — це зміна. ✦
        </p>
      </div>
    </div>
  )
}
