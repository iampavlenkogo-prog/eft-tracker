import { useState } from 'react'
import { X, Download, Loader2 } from 'lucide-react'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'

type ReportType = 'full' | 'summary'
type Sections = 'all' | 'supervisions' | 'seminars' | 'skills'

interface Props {
  defaultSections?: Sections
  onClose: () => void
}

const SECTION_OPTIONS: { value: Sections; label: string }[] = [
  { value: 'all',          label: 'Всі записи' },
  { value: 'supervisions', label: 'Тільки Супервізії' },
  { value: 'seminars',     label: 'Тільки Семінари' },
  { value: 'skills',       label: 'Тільки Групи навичок' },
]

export default function ReportModal({ defaultSections = 'all', onClose }: Props) {
  const { user } = useAuth()
  const [reportType, setReportType] = useState<ReportType>('full')
  const [sections, setSections] = useState<Sections>(defaultSections)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [allTime, setAllTime] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleGenerate = async () => {
    setError('')
    setIsLoading(true)
    try {
      const params: Record<string, string> = { type: reportType, sections }
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
      onClose()
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
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-[#FFF9F5] rounded-3xl shadow-[0_20px_60px_rgba(160,80,100,0.12)] w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#EBDDD0]/60">
          <div>
            <h2 className="font-cormorant text-2xl font-semibold text-warm-dark">Звіт ♡</h2>
            <p className="font-cormorant italic text-warm-mid text-sm">Завантажте PDF-звіт</p>
          </div>
          <button onClick={onClose} className="text-warm-light hover:text-warm-dark transition p-1">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Report type */}
          <div>
            <p className="text-xs font-medium text-warm-light uppercase tracking-widest mb-3">Тип звіту</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: 'full' as ReportType, label: 'Повний', desc: 'Детальні таблиці записів' },
                { value: 'summary' as ReportType, label: 'Зведений', desc: 'Компактне зведення' },
              ]).map(opt => (
                <label
                  key={opt.value}
                  className={`flex flex-col p-4 rounded-xl border-2 cursor-pointer transition ${
                    reportType === opt.value ? 'border-[#6A8C9A] bg-[#D9E6EA]/40' : 'border-sand hover:border-[#6A8C9A]/40'
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
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium text-warm-dark text-sm">{opt.label}</p>
                    {reportType === opt.value && (
                      <div className="w-3.5 h-3.5 rounded-full bg-[#6A8C9A] flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-warm-light">{opt.desc}</p>
                </label>
              ))}
            </div>
          </div>

          {/* Sections */}
          <div>
            <p className="text-xs font-medium text-warm-light uppercase tracking-widest mb-3">Включити до звіту</p>
            <div className="space-y-2">
              {SECTION_OPTIONS.map(opt => (
                <label
                  key={opt.value}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition ${
                    sections === opt.value ? 'border-[#6A8C9A] bg-[#D9E6EA]/40' : 'border-sand hover:border-[#6A8C9A]/40'
                  }`}
                >
                  <input
                    type="radio"
                    name="sections"
                    value={opt.value}
                    checked={sections === opt.value}
                    onChange={() => setSections(opt.value)}
                    className="sr-only"
                  />
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    sections === opt.value ? 'border-[#6A8C9A]' : 'border-[#EBDDD0]'
                  }`}>
                    {sections === opt.value && <div className="w-2 h-2 rounded-full bg-[#6A8C9A]" />}
                  </div>
                  <span className="text-sm text-warm-dark">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Period */}
          <div>
            <p className="text-xs font-medium text-warm-light uppercase tracking-widest mb-3">Період</p>
            <label className="flex items-center gap-3 cursor-pointer mb-4">
              <div
                onClick={() => setAllTime(!allTime)}
                className={`w-10 h-5 rounded-full transition relative ${allTime ? 'bg-[#6A8C9A]' : 'bg-sand'}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${allTime ? 'left-5' : 'left-0.5'}`} />
              </div>
              <span className="text-sm text-warm-mid">Весь час</span>
            </label>
            {!allTime && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-warm-mid mb-1.5">Від</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={e => setDateFrom(e.target.value)}
                    className="w-full bg-[#FFF9F5] border border-[#EDE5DE] rounded-xl px-3 py-2 text-sm text-warm-dark focus:outline-none focus:border-[#C07888]/60 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-warm-mid mb-1.5">До</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={e => setDateTo(e.target.value)}
                    className="w-full bg-[#FFF9F5] border border-[#EDE5DE] rounded-xl px-3 py-2 text-sm text-warm-dark focus:outline-none focus:border-[#C07888]/60 transition"
                  />
                </div>
              </div>
            )}
          </div>

          {error && <p className="text-[#A86060] text-sm bg-[#F8EEEE] rounded-2xl px-4 py-2.5">{error}</p>}

          <button
            onClick={handleGenerate}
            disabled={isLoading}
            className="flex items-center justify-center gap-2 w-full bg-gradient-to-br from-[#C07888] to-[#A06070] text-white font-medium rounded-xl px-8 py-3 neu-btn-primary hover:opacity-90 transition disabled:opacity-50"
          >
            {isLoading ? (
              <><Loader2 size={16} className="animate-spin" />Формуємо PDF...</>
            ) : (
              <><Download size={16} />Завантажити PDF</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
