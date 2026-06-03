import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import Layout from '../components/Layout'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'

type ReportType = 'full' | 'summary'

const REPORT_OPTIONS: { value: ReportType; title: string; desc: string; items: string[] }[] = [
  {
    value: 'full',
    title: 'Повний звіт',
    desc: 'Детальний звіт з усіма записами',
    items: ['Всі підтверджені супервізії', 'Всі підтверджені семінари', 'Детальні таблиці записів', 'Підсумкова статистика'],
  },
  {
    value: 'summary',
    title: 'Зведений звіт',
    desc: 'Коротке зведення без деталей',
    items: ['Кількість супервізій по типах', 'Кількість та бали семінарів', 'Загальні підсумки', 'Компактний формат'],
  },
]

export default function ReportsPage() {
  const { user } = useAuth()
  const [reportType, setReportType] = useState<ReportType>('full')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [allTime, setAllTime] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleGenerate = async () => {
    setError('')
    setIsLoading(true)
    try {
      const params: Record<string, string> = { type: reportType }
      if (!allTime) {
        if (dateFrom) params.dateFrom = dateFrom
        if (dateTo) params.dateTo = dateTo
      }

      const res = await api.get('/reports/pdf', { params, responseType: 'blob' })

      const dateStr = new Date().toISOString().slice(0, 10)
      const lastName = user?.lastName || ''
      const firstName = user?.firstName || ''
      const filename = `EFT_Report_${lastName}_${firstName}_${dateStr}.pdf`

      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err: any) {
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text()
          const json = JSON.parse(text)
          setError(json.error || 'Помилка формування звіту')
        } catch {
          setError('Помилка формування звіту')
        }
      } else {
        setError(err.response?.data?.error || 'Помилка формування звіту')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Layout>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="mb-6">
            <h1 className="font-cormorant text-3xl text-warm-dark font-semibold">Звіти ♡</h1>
            <p className="font-cormorant italic text-warm-mid mt-0.5">Завантажте PDF-звіт вашого навчання</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-8">
            {/* Report type selection */}
            <p className="text-xs font-medium text-warm-light uppercase tracking-widest mb-4">Тип звіту</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-7">
              {REPORT_OPTIONS.map(opt => (
                <label
                  key={opt.value}
                  className={`relative flex flex-col p-5 rounded-xl border-2 cursor-pointer transition ${
                    reportType === opt.value
                      ? 'border-rose bg-rose-lighter'
                      : 'border-sand bg-white hover:border-rose-light'
                  }`}
                >
                  <input
                    type="radio"
                    name="reportType"
                    value={opt.value}
                    checked={reportType === opt.value}
                    onChange={() => setReportType(opt.value)}
                    className="sr-only"
                  />
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-warm-dark text-sm">{opt.title}</p>
                    {reportType === opt.value && (
                      <div className="w-4 h-4 rounded-full bg-rose flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-warm-light mb-3">{opt.desc}</p>
                  <ul className="space-y-1">
                    {opt.items.map(item => (
                      <li key={item} className="text-xs text-warm-mid flex items-center gap-1.5">
                        <span className="text-rose">◦</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </label>
              ))}
            </div>

            {/* Period */}
            <p className="text-xs font-medium text-warm-light uppercase tracking-widest mb-3">Період</p>
            <div className="flex items-center gap-3 mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <div
                  onClick={() => setAllTime(!allTime)}
                  className={`w-10 h-5 rounded-full transition relative ${allTime ? 'bg-rose' : 'bg-sand'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${allTime ? 'left-5' : 'left-0.5'}`} />
                </div>
                <span className="text-sm text-warm-mid">Весь час</span>
              </label>
            </div>

            {!allTime && (
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-warm-mid mb-1.5">Від</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={e => setDateFrom(e.target.value)}
                    className="w-full bg-[#FFF4EC] border border-[#EBDDD0] rounded-xl px-4 py-2.5 text-sm text-warm-dark focus:outline-none focus:border-[#A2C2BE]/60 transition neu-input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-warm-mid mb-1.5">До</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={e => setDateTo(e.target.value)}
                    className="w-full bg-[#FFF4EC] border border-[#EBDDD0] rounded-xl px-4 py-2.5 text-sm text-warm-dark focus:outline-none focus:border-[#A2C2BE]/60 transition neu-input"
                  />
                </div>
              </div>
            )}

            {error && <p className="text-red-500 text-sm bg-red-50 rounded-xl px-4 py-2.5 mb-4">{error}</p>}

            <button
              onClick={handleGenerate}
              disabled={isLoading}
              className="flex items-center justify-center gap-2 w-full bg-gradient-to-br from-[#EB4600] to-[#CC3A00] text-white font-medium rounded-xl px-8 py-3 neu-btn-primary hover:opacity-90 transition disabled:opacity-50"
            >
              {isLoading ? (
                <><Loader2 size={16} className="animate-spin" />Формуємо PDF...</>
              ) : (
                <><Download size={16} />Завантажити PDF</>
              )}
            </button>
          </div>
        </div>

        {/* ── Right sidebar ── */}
        <div className="space-y-4">
          <div className="bg-rose-lighter rounded-2xl p-5 border border-rose-light">
            <p className="font-cormorant italic text-lg text-warm-mid leading-relaxed">
              ♡&nbsp;&nbsp;«Кожен крок у навчанні — це інвестиція у глибші стосунки та більшу присутність.»
            </p>
          </div>
          <div>
            <div className="bg-beige rounded-2xl p-6">
              <h3 className="font-cormorant text-xl font-semibold text-warm-dark mb-3">Звіт ♡</h3>
              <p className="font-cormorant italic text-warm-mid text-sm leading-relaxed mb-4">
                Ваш звіт формується з підтверджених супервізій та семінарів за вказаний період.
              </p>
              <div className="space-y-2 text-xs text-warm-mid">
                <p className="flex items-start gap-2"><span className="text-rose mt-0.5">◦</span>Тільки підтверджені записи включаються у звіт</p>
                <p className="flex items-start gap-2"><span className="text-rose mt-0.5">◦</span>PDF завантажується автоматично</p>
                <p className="flex items-start gap-2"><span className="text-rose mt-0.5">◦</span>Назва файлу: EFT_Report_[Прізвище]_[Ім'я]_[дата].pdf</p>
              </div>
            </div>
            <div className="overflow-hidden">
              <img
                src="/illustrations/candle_flowers.png"
                alt=""
                className="w-full object-contain opacity-90 -mt-[38%]"
              />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
