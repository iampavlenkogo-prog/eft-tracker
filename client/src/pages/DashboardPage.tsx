import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart } from 'lucide-react'
import Layout from '../components/Layout'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'

interface Stats {
  supervisions: number
  seminars: number
  points: number
}

interface Phrase {
  id: string
  text: string
  author: { id: string; firstName: string; lastName: string }
  savedByMe: boolean
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [stats, setStats] = useState<Stats>({ supervisions: 0, seminars: 0, points: 0 })
  const [phrases, setPhrases] = useState<Phrase[]>([])

  useEffect(() => {
    api.get('/dashboard/stats').then(res => setStats(res.data)).catch(() => {})
    api.get('/phrases?limit=5&random=true').then(res => setPhrases(res.data)).catch(() => {})
  }, [])

  const toggleSave = async (phrase: Phrase) => {
    setPhrases(prev => prev.map(p => p.id === phrase.id ? { ...p, savedByMe: !p.savedByMe } : p))
    try {
      if (phrase.savedByMe) {
        await api.delete(`/phrases/${phrase.id}/save`)
      } else {
        await api.post(`/phrases/${phrase.id}/save`)
      }
    } catch {
      setPhrases(prev => prev.map(p => p.id === phrase.id ? { ...p, savedByMe: phrase.savedByMe } : p))
    }
  }

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

          {/* EFT Phrases block */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h3 className="font-cormorant text-xl font-semibold text-warm-dark mb-4">Словник ЕФТ терапевта</h3>
            {phrases.length === 0 ? (
              <p className="font-cormorant italic text-warm-light text-base">
                Словник ще порожній. Додайте свій перший запис у профілі ♡
              </p>
            ) : (
              <div className="space-y-3">
                {phrases.map(phrase => (
                  <div key={phrase.id} className="bg-beige rounded-xl p-4 flex gap-3 items-start">
                    <div className="flex-1 min-w-0">
                      <p className="font-cormorant italic text-warm-dark text-base leading-relaxed">«{phrase.text}»</p>
                      <p className="text-xs text-warm-light mt-1.5">{phrase.author.firstName} {phrase.author.lastName}</p>
                    </div>
                    <button
                      onClick={() => toggleSave(phrase)}
                      className={`shrink-0 mt-1 transition-colors ${phrase.savedByMe ? 'text-rose' : 'text-warm-light hover:text-rose'}`}
                      title={phrase.savedByMe ? 'Видалити з колекції' : 'Зберегти до колекції'}
                    >
                      <Heart size={18} fill={phrase.savedByMe ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quote block */}
          <div className="bg-rose-lighter rounded-2xl p-5 border border-rose-light">
            <p className="font-cormorant italic text-lg text-warm-mid leading-relaxed">
              ♡&nbsp;&nbsp;«Кожен крок у навчанні — це інвестиція у глибші стосунки та більшу присутність.»
            </p>
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
