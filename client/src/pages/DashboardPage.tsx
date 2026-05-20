import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'

interface Stats {
  supervisions: number
  seminars: number
  points: number
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [stats, setStats] = useState<Stats>({ supervisions: 0, seminars: 0, points: 0 })

  useEffect(() => {
    api.get('/dashboard/stats').then(res => setStats(res.data)).catch(() => {})
  }, [])

  return (
    <Layout>
      {/* ── Greeting ── */}
      <div className="mb-8">
        <h1 className="font-cormorant text-4xl text-warm-dark font-semibold leading-tight">
          Вітаємо, {user?.firstName} ♡
        </h1>
        <p className="font-cormorant italic text-warm-mid text-lg mt-1">
          Ваша база навчання в методі ЕФТ
        </p>
      </div>

      <div className="max-w-3xl space-y-5">
          {/* Stats cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl shadow-sm p-6 relative overflow-visible min-h-[240px] flex flex-col">
              <div className="max-w-[52%]">
                <p className="text-xs font-medium text-warm-light uppercase tracking-widest mb-1">Супервізії</p>
                <p className="text-xs text-warm-light mb-4">підтверджених сесій</p>
                <div className="flex items-baseline gap-2">
                  <span className="font-cormorant text-5xl font-light text-warm-dark">{stats.supervisions}</span>
                  <span className="text-sm text-warm-light">записів</span>
                </div>
              </div>
              <button
                onClick={() => navigate('/supervisions')}
                className="mt-auto text-sm text-rose hover:opacity-80 transition font-medium block pt-4 max-w-[52%]"
              >
                Переглянути записи →
              </button>
              <img
                src="/illustrations/chairs.png"
                alt=""
                className="absolute bottom-[-16px] right-[-12px] w-[220px] object-contain pointer-events-none"
              />
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-6 relative overflow-visible min-h-[240px] flex flex-col">
              <div className="max-w-[52%]">
                <p className="text-xs font-medium text-warm-light uppercase tracking-widest mb-1">Семінари</p>
                <p className="text-xs text-warm-light mb-4">пройдено навчань</p>
                <div className="flex items-baseline gap-2">
                  <span className="font-cormorant text-5xl font-light text-warm-dark">{stats.seminars}</span>
                  <span className="text-sm text-warm-light">записів</span>
                </div>
              </div>
              <button
                onClick={() => navigate('/seminars')}
                className="mt-auto text-sm text-rose hover:opacity-80 transition font-medium block pt-4 max-w-[52%]"
              >
                Переглянути записи →
              </button>
              <img
                src="/illustrations/books-coffee.png"
                alt=""
                className="absolute bottom-[-16px] right-[-12px] w-[220px] object-contain pointer-events-none"
              />
            </div>
          </div>

          {/* Quote block */}
          <div className="bg-rose-lighter rounded-2xl p-5 border border-rose-light">
            <p className="font-cormorant italic text-lg text-warm-mid leading-relaxed">
              ♡&nbsp;&nbsp;«Кожен крок у навчанні — це інвестиція у глибші стосунки та більшу присутність.»
            </p>
          </div>

          {/* Action cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { icon: '＋', title: 'Додати супервізію', sub: 'Записати нову сесію', path: '/supervisions' },
              { icon: '＋', title: 'Додати семінар', sub: 'Зафіксувати навчання', path: '/seminars' },
              { icon: '📄', title: 'Звіти', sub: 'Завантажити PDF', path: '/reports' },
            ].map(item => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="bg-white rounded-xl p-5 text-left hover:shadow-md transition group"
              >
                <div className="text-2xl text-rose mb-3">{item.icon}</div>
                <p className="text-sm font-medium text-warm-dark group-hover:text-rose transition">{item.title}</p>
                <p className="text-xs text-warm-light mt-0.5">{item.sub}</p>
              </button>
            ))}
          </div>

          {/* Пам'ятай */}
          <div className="bg-beige rounded-2xl overflow-hidden flex">
            <img src="/illustrations/therapist-duo.png" alt="" className="w-48 object-cover shrink-0" />
            <div className="px-6 py-6 flex flex-col justify-center">
              <h3 className="font-cormorant text-xl font-semibold text-warm-dark mb-4">Пам'ятай ♡</h3>
              <p className="font-cormorant italic text-warm-mid text-base leading-relaxed">
                Ти робиш важливу справу.<br />
                Твоя присутність має значення.<br />
                Ти допомагаєш іншим знаходити<br />
                себе через зв'язок.
              </p>
            </div>
          </div>
      </div>
    </Layout>
  )
}
