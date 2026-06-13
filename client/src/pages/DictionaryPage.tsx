import { useState, useEffect, useMemo } from 'react'
import { Heart, Edit3, Check, X, Plus, Trash2, Download, Search, BookOpen, ChevronDown } from 'lucide-react'
import Layout from '../components/Layout'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'

interface Phrase {
  id: string
  text: string
  author: { id: string; firstName: string; lastName: string; avatarUrl?: string | null }
  createdAt: string
  savedByMe: boolean
}

interface PhraseItem {
  id: string
  text: string
  author: { id: string; firstName: string; lastName: string; avatarUrl?: string | null }
  createdAt: string
}

interface SavedPhraseItem extends PhraseItem {
  savedAt: string
  savedId: string
}

interface Collection {
  own: PhraseItem[]
  saved: SavedPhraseItem[]
}

type FeedTab = 'all' | 'saved'

function avatarGradient(name: string) {
  const gradients = [
    'linear-gradient(135deg,#E0A9B6,#C4778C)',
    'linear-gradient(135deg,#B9A9E0,#8A6BB0)',
    'linear-gradient(135deg,#A9C9B9,#6A9B82)',
    'linear-gradient(135deg,#E0C9A9,#C4978A)',
    'linear-gradient(135deg,#A9C2E0,#6A88B0)',
  ]
  const idx = (name.charCodeAt(0) + (name.charCodeAt(1) || 0)) % gradients.length
  return gradients[idx]
}

function initials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

export default function DictionaryPage() {
  const { user } = useAuth()

  const [phrases, setPhrases] = useState<Phrase[]>([])
  const [feedSearch, setFeedSearch] = useState('')
  const [feedTab, setFeedTab] = useState<FeedTab>('all')
  const [feedLoading, setFeedLoading] = useState(true)

  const [myPhrases, setMyPhrases] = useState<PhraseItem[]>([])
  const [newPhraseText, setNewPhraseText] = useState('')
  const [addingPhrase, setAddingPhrase] = useState(false)
  const [phraseError, setPhraseError] = useState('')
  const [editingPhraseId, setEditingPhraseId] = useState<string | null>(null)
  const [editingPhraseText, setEditingPhraseText] = useState('')
  const [showMyPhrases, setShowMyPhrases] = useState(false)

  const [collection, setCollection] = useState<Collection>({ own: [], saved: [] })
  const [showCollection, setShowCollection] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)

  useEffect(() => {
    api.get('/phrases?limit=50').then(r => setPhrases(r.data)).catch(() => {}).finally(() => setFeedLoading(false))
    api.get('/phrases/my').then(r => setMyPhrases(r.data)).catch(() => {})
    api.get('/phrases/collection').then(r => setCollection(r.data)).catch(() => {})
  }, [])

  const toggleSave = async (phrase: Phrase) => {
    setPhrases(prev => prev.map(p => p.id === phrase.id ? { ...p, savedByMe: !p.savedByMe } : p))
    try {
      if (phrase.savedByMe) {
        await api.delete(`/phrases/${phrase.id}/save`)
        setCollection(prev => ({ ...prev, saved: prev.saved.filter(s => s.id !== phrase.id) }))
      } else {
        await api.post(`/phrases/${phrase.id}/save`)
        setCollection(prev => ({
          ...prev,
          saved: [{ ...phrase, savedAt: new Date().toISOString(), savedId: '' }, ...prev.saved],
        }))
      }
    } catch {
      setPhrases(prev => prev.map(p => p.id === phrase.id ? { ...p, savedByMe: phrase.savedByMe } : p))
    }
  }

  const handleAddPhrase = async () => {
    if (!newPhraseText.trim()) return
    setAddingPhrase(true); setPhraseError('')
    try {
      const { data } = await api.post('/phrases', { text: newPhraseText.trim() })
      setMyPhrases(prev => [data, ...prev])
      setCollection(prev => ({ ...prev, own: [data, ...prev.own] }))
      setPhrases(prev => [{ ...data, savedByMe: false }, ...prev])
      setNewPhraseText('')
    } catch (e: any) { setPhraseError(e.response?.data?.error || 'Помилка') }
    finally { setAddingPhrase(false) }
  }

  const handleSaveEditPhrase = async (id: string) => {
    if (!editingPhraseText.trim()) return
    try {
      const { data } = await api.patch(`/phrases/${id}`, { text: editingPhraseText.trim() })
      setMyPhrases(prev => prev.map(p => p.id === id ? { ...p, text: data.text } : p))
      setCollection(prev => ({ ...prev, own: prev.own.map(p => p.id === id ? { ...p, text: data.text } : p) }))
      setPhrases(prev => prev.map(p => p.id === id ? { ...p, text: data.text } : p))
      setEditingPhraseId(null)
    } catch {}
  }

  const handleDeletePhrase = async (id: string) => {
    try {
      await api.delete(`/phrases/${id}`)
      setMyPhrases(prev => prev.filter(p => p.id !== id))
      setCollection(prev => ({ ...prev, own: prev.own.filter(p => p.id !== id) }))
      setPhrases(prev => prev.filter(p => p.id !== id))
    } catch {}
  }

  const handleExportPDF = async () => {
    const allPhrases = [...collection.own, ...collection.saved]
    if (allPhrases.length === 0) return
    setExportingPdf(true)
    try {
      const { jsPDF } = await import('jspdf')
      const html2canvas = (await import('html2canvas')).default
      const today = new Date().toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })
      const logoUrl = `${window.location.origin}/illustrations/Logo_obiymu.png`
      const container = document.createElement('div')
      container.style.cssText = 'position:absolute;left:-10000px;top:0;width:794px;background:#FAFAF8;box-sizing:border-box;font-family:Arial,sans-serif;'
      container.innerHTML = `
        <div style="padding:60px 56px;">
          <h1 style="font-family:Georgia,serif;font-size:36px;font-weight:400;color:#2C2C2C;margin-bottom:8px;">Словник ЕФТ терапевта</h1>
          <p style="font-size:12px;color:#A0A0A0;margin-bottom:24px;">${user?.firstName} ${user?.lastName}</p>
          <hr style="border:none;border-top:1px solid #E0D9D0;margin-bottom:32px;">
          ${collection.own.length > 0 ? `
            <div style="font-size:11px;font-weight:500;letter-spacing:3px;text-transform:uppercase;color:#B8A8A4;margin-bottom:16px;">Мої записи</div>
            ${collection.own.map(p => `<div style="background:#F0EBE3;border-radius:12px;padding:20px 24px;margin-bottom:12px;"><div style="font-family:Georgia,serif;font-size:18px;font-style:italic;color:#2C2C2C;line-height:1.6;margin-bottom:8px;">«${p.text}»</div><div style="font-size:11px;color:#A0A0A0;">Моя фраза</div></div>`).join('')}
          ` : ''}
          ${collection.saved.length > 0 ? `
            <div style="font-size:11px;font-weight:500;letter-spacing:3px;text-transform:uppercase;color:#B8A8A4;margin-bottom:16px;${collection.own.length > 0 ? 'margin-top:24px;' : ''}">Збережені записи</div>
            ${collection.saved.map(p => `<div style="background:#F0EBE3;border-radius:12px;padding:20px 24px;margin-bottom:12px;"><div style="font-family:Georgia,serif;font-size:18px;font-style:italic;color:#2C2C2C;line-height:1.6;margin-bottom:8px;">«${p.text}»</div><div style="font-size:11px;color:#A0A0A0;">${p.author.firstName} ${p.author.lastName}</div></div>`).join('')}
          ` : ''}
          <div style="margin-top:48px;text-align:center;">
            <div style="font-family:Georgia,serif;font-style:italic;font-size:15px;color:#B8A8A4;margin-bottom:8px;">Навчання. Ріст. Звʼязок. ♡</div>
            <div style="font-size:10px;color:#A0A0A0;margin-bottom:14px;">OBIYMU EFT Space · ${today}</div>
            <img src="${logoUrl}" alt="OBIYMU" style="height:26px;width:auto;opacity:0.65;display:block;margin:0 auto;" crossorigin="anonymous">
          </div>
        </div>`
      document.body.appendChild(container)
      const canvas = await html2canvas(container, { scale: 2, useCORS: true })
      const pxPerMm = (96 / 25.4) * 2
      const pageHeightPx = 297 * pxPerMm
      const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
      let y = 0
      while (y < canvas.height) {
        if (y > 0) doc.addPage()
        const sliceH = Math.min(pageHeightPx, canvas.height - y)
        const slice = document.createElement('canvas')
        slice.width = canvas.width; slice.height = sliceH
        slice.getContext('2d')!.drawImage(canvas, 0, -y)
        doc.addImage(slice.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 210, (sliceH / pxPerMm))
        y += pageHeightPx
      }
      doc.save('eft-phrases.pdf')
      document.body.removeChild(container)
    } catch (e) { console.error(e) }
    finally { setExportingPdf(false) }
  }

  const savedCount = phrases.filter(p => p.savedByMe).length

  const filteredPhrases = useMemo(() => {
    let list = phrases
    if (feedTab === 'saved') list = list.filter(p => p.savedByMe)
    if (feedSearch.trim()) {
      const q = feedSearch.toLowerCase()
      list = list.filter(p =>
        p.text.toLowerCase().includes(q) ||
        `${p.author.firstName} ${p.author.lastName}`.toLowerCase().includes(q)
      )
    }
    return list
  }, [phrases, feedTab, feedSearch])

  const collectionTotal = collection.own.length + collection.saved.length

  return (
    <Layout>
      <div className="max-w-[1120px] mx-auto">

        {/* ── Hero band ── */}
        <section
          className="relative overflow-hidden rounded-[var(--r-xl)] shadow-clay mb-7"
          style={{ background: 'linear-gradient(150deg, #FBEFE9, #F4E2DE 55%, #EFE3E8)', padding: '38px 44px' }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8 items-center">
            <div>
              <span className="inline-flex items-center gap-2 text-[12px] font-extrabold tracking-[.14em] uppercase" style={{ color: 'var(--rose-ink)' }}>
                ♡ Спільнота · ЕФТ
              </span>
              <h1 className="font-cormorant text-[clamp(30px,3.8vw,44px)] font-semibold leading-[1.04] mt-3" style={{ color: 'var(--ink)' }}>
                Словник ЕФТ терапевта{' '}
                <span style={{ color: 'var(--coral)' }}>♡</span>
              </h1>
              <p className="font-cormorant italic text-[19px] mt-2 max-w-[440px]" style={{ color: 'var(--ink-2)' }}>
                Фрази, терміни та визначення, якими діляться терапевти спільноти
              </p>
            </div>
            <div
              className="hidden lg:block w-[150px] h-[150px] rounded-[var(--r-lg)] flex-shrink-0 relative overflow-hidden shadow-clay-sm"
              style={{
                background: 'radial-gradient(60% 55% at 35% 35%, rgba(225,180,170,.6), transparent 70%), radial-gradient(55% 50% at 70% 65%, rgba(206,140,158,.4), transparent 72%), var(--surface)',
              }}
            >
              <img
                src="/illustrations/slovnyk_EFT.png"
                alt=""
                className="absolute inset-0 w-full h-full object-cover opacity-70"
              />
            </div>
          </div>

          {/* Search */}
          <div
            className="flex items-center gap-3 mt-7 rounded-[var(--r-pill)] shadow-clay-sm"
            style={{ background: 'var(--surface)', padding: '8px 8px 8px 22px' }}
          >
            <Search size={20} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
            <input
              type="text"
              value={feedSearch}
              onChange={e => setFeedSearch(e.target.value)}
              placeholder="Пошук у словнику…"
              className="flex-1 min-w-0 border-none bg-transparent outline-none font-mulish text-[16px]"
              style={{ color: 'var(--ink)' }}
            />
          </div>

          {/* Filter tabs */}
          <div className="flex flex-wrap items-center gap-[10px] mt-[18px]">
            <button
              onClick={() => setFeedTab('all')}
              className="inline-flex items-center gap-[7px] px-4 py-[9px] rounded-[var(--r-pill)] font-bold text-[14px] border-none cursor-pointer transition-transform duration-200"
              style={
                feedTab === 'all'
                  ? { background: 'linear-gradient(135deg,#E0734F,#C24A28)', color: '#fff', boxShadow: '-3px -3px 8px rgba(255,255,255,.3), 8px 10px 22px rgba(194,74,40,.4)' }
                  : { background: 'var(--surface)', color: 'var(--ink-2)', boxShadow: 'var(--clay-sm)' }
              }
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h11"/></svg>
              Усі
            </button>
            <button
              onClick={() => setFeedTab('saved')}
              className="inline-flex items-center gap-[7px] px-4 py-[9px] rounded-[var(--r-pill)] font-bold text-[14px] border-none cursor-pointer transition-transform duration-200"
              style={
                feedTab === 'saved'
                  ? { background: 'linear-gradient(135deg,#E0734F,#C24A28)', color: '#fff', boxShadow: '-3px -3px 8px rgba(255,255,255,.3), 8px 10px 22px rgba(194,74,40,.4)' }
                  : { background: 'var(--surface)', color: 'var(--ink-2)', boxShadow: 'var(--clay-sm)' }
              }
            >
              <Heart size={15} />
              Збережені
              {savedCount > 0 && (
                <span className="text-[12px] font-extrabold opacity-80">{savedCount}</span>
              )}
            </button>
            <span className="ml-auto text-[13px] font-bold" style={{ color: 'var(--ink-3)' }}>
              {filteredPhrases.length} {filteredPhrases.length === 1 ? 'запис' : filteredPhrases.length < 5 ? 'записи' : 'записів'}
            </span>
          </div>
        </section>

        {/* ── Body: 2-col grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_332px] gap-8 items-start">

          {/* ════ Feed ════ */}
          <div>
            {feedLoading ? (
              <div className="space-y-[18px]">
                {[1, 2, 3].map(i => (
                  <div key={i} className="rounded-[var(--r-lg)] shadow-clay animate-pulse" style={{ background: 'var(--surface)', padding: '26px 30px' }}>
                    <div className="h-5 rounded-full mb-3" style={{ background: 'var(--surface-2)', width: '85%' }} />
                    <div className="h-5 rounded-full mb-3" style={{ background: 'var(--surface-2)', width: '65%' }} />
                    <div className="h-4 rounded-full" style={{ background: 'var(--surface-2)', width: '35%' }} />
                  </div>
                ))}
              </div>
            ) : filteredPhrases.length === 0 ? (
              <div className="text-center py-16 rounded-[var(--r-lg)] shadow-clay" style={{ background: 'var(--surface)' }}>
                <BookOpen size={44} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--ink-3)' }} />
                <p className="font-cormorant text-[22px]" style={{ color: 'var(--ink-3)' }}>
                  {feedSearch ? 'Нічого не знайдено' : feedTab === 'saved' ? 'Поки немає збережених ♡' : 'Словник ще порожній ♡'}
                </p>
                {!feedSearch && feedTab === 'all' && (
                  <p className="text-[14px] mt-1" style={{ color: 'var(--ink-3)' }}>Додайте першу фразу в правій панелі</p>
                )}
              </div>
            ) : (
              <div>
                {filteredPhrases.map(phrase => (
                  <PhraseCard
                    key={phrase.id}
                    phrase={phrase}
                    onToggleSave={() => toggleSave(phrase)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ════ Right rail ════ */}
          <div className="lg:sticky lg:top-24 flex flex-col gap-5">

            {/* Мій словник ЕФТ */}
            <div className="rounded-[var(--r-lg)] shadow-clay" style={{ background: 'var(--surface)', padding: '24px 26px' }}>
              <div className="flex items-center gap-[9px]">
                <BookOpen size={19} style={{ color: 'var(--rose-deep)', flexShrink: 0 }} />
                <h3 className="font-cormorant text-[20px] font-semibold" style={{ color: 'var(--ink)' }}>Мій словник ЕФТ</h3>
              </div>
              <p className="text-[13px] mt-[3px]" style={{ color: 'var(--ink-3)' }}>Ваші терміни та фрази</p>

              <textarea
                value={newPhraseText}
                onChange={e => setNewPhraseText(e.target.value)}
                rows={3}
                placeholder="Додайте термін, фразу або визначення…"
                className="w-full mt-4 resize-y rounded-[var(--r)] border-none outline-none font-mulish text-[14.5px]"
                style={{
                  minHeight: 88,
                  padding: '14px 16px',
                  background: 'var(--surface-2)',
                  color: 'var(--ink)',
                  boxShadow: 'var(--clay-inset)',
                }}
              />
              {phraseError && <p className="text-red-500 text-xs mt-1">{phraseError}</p>}

              <button
                onClick={handleAddPhrase}
                disabled={addingPhrase || !newPhraseText.trim()}
                className="w-full mt-[14px] flex items-center justify-center gap-2 rounded-[var(--r-pill)] font-bold text-[15px] text-white border-none cursor-pointer transition-all duration-200 disabled:opacity-50"
                style={{
                  padding: '14px 20px',
                  background: 'linear-gradient(135deg, #E0734F, #C24A28)',
                  boxShadow: '-4px -4px 12px rgba(255,255,255,.4), 10px 12px 26px rgba(194,74,40,.40)',
                }}
              >
                <Plus size={15} />
                {addingPhrase ? 'Додаємо…' : 'Додати запис'}
              </button>

              {myPhrases.length > 0 && (
                <>
                  <button
                    onClick={() => setShowMyPhrases(v => !v)}
                    className="w-full mt-[14px] flex items-center justify-between gap-2 rounded-[var(--r)] border-none cursor-pointer font-bold text-[14.5px] transition-colors duration-200"
                    style={{
                      padding: '14px 18px',
                      background: 'var(--surface-2)',
                      color: 'var(--ink)',
                    }}
                  >
                    <span>{showMyPhrases ? 'Згорнути' : `Переглянути записи (${myPhrases.length})`}</span>
                    <ChevronDown
                      size={18}
                      style={{ transition: 'transform .25s', transform: showMyPhrases ? 'rotate(180deg)' : 'none', flexShrink: 0 }}
                    />
                  </button>

                  {showMyPhrases && (
                    <div className="mt-[10px] space-y-2">
                      {myPhrases.map(phrase => (
                        <div key={phrase.id} className="rounded-[var(--r)] text-[14px] leading-snug" style={{ padding: '13px 16px', background: 'var(--surface-2)', color: 'var(--ink)' }}>
                          {editingPhraseId === phrase.id ? (
                            <div>
                              <textarea
                                value={editingPhraseText}
                                onChange={e => setEditingPhraseText(e.target.value)}
                                rows={2}
                                className="w-full rounded-[var(--r-sm)] border-none outline-none text-sm resize-none"
                                style={{ padding: '10px 12px', background: 'var(--surface)', color: 'var(--ink)', boxShadow: 'var(--clay-inset)' }}
                              />
                              <div className="flex gap-2 mt-2">
                                <button
                                  onClick={() => handleSaveEditPhrase(phrase.id)}
                                  className="flex items-center gap-1 text-xs font-bold rounded-lg px-3 py-1 transition"
                                  style={{ background: 'var(--blush)', color: 'var(--rose-ink)' }}
                                >
                                  <Check size={11} /> Зберегти
                                </button>
                                <button
                                  onClick={() => setEditingPhraseId(null)}
                                  className="flex items-center gap-1 text-xs rounded-lg px-3 py-1 transition"
                                  style={{ color: 'var(--ink-3)' }}
                                >
                                  <X size={11} /> Скасувати
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-2 items-start">
                              <p className="font-cormorant italic text-[15px] leading-relaxed flex-1" style={{ color: 'var(--ink)' }}>«{phrase.text}»</p>
                              <div className="flex gap-1.5 shrink-0 mt-0.5">
                                <button
                                  onClick={() => { setEditingPhraseId(phrase.id); setEditingPhraseText(phrase.text) }}
                                  className="transition" style={{ color: 'var(--ink-3)' }} title="Редагувати"
                                >
                                  <Edit3 size={13} />
                                </button>
                                <button
                                  onClick={() => handleDeletePhrase(phrase.id)}
                                  className="transition hover:text-red-400" style={{ color: 'var(--ink-3)' }} title="Видалити"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Моя колекція */}
            <div
              className="rounded-[var(--r-lg)] shadow-clay"
              style={{ background: 'linear-gradient(150deg, #FBEDE4, #F5DECF)', padding: '24px 26px' }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-cormorant text-[20px] font-semibold" style={{ color: 'var(--ink)' }}>Моя колекція</h3>
                  <p className="text-[13px] mt-[3px] font-semibold" style={{ color: 'var(--ink-2)' }}>
                    {collectionTotal} {collectionTotal === 1 ? 'запис' : collectionTotal < 5 ? 'записи' : 'записів'}
                  </p>
                </div>
                {collectionTotal > 0 && (
                  <button
                    onClick={handleExportPDF}
                    disabled={exportingPdf}
                    className="inline-flex items-center gap-[7px] rounded-[var(--r-pill)] font-bold text-[13px] border-none cursor-pointer transition-transform duration-200 disabled:opacity-50"
                    style={{
                      padding: '9px 14px',
                      background: 'rgba(255,255,255,.7)',
                      color: 'var(--rose-ink)',
                      boxShadow: 'var(--clay-sm)',
                    }}
                  >
                    <Download size={15} />
                    {exportingPdf ? 'Генеруємо…' : 'PDF'}
                  </button>
                )}
              </div>

              {collectionTotal === 0 ? (
                <p className="text-[13px] mt-4 italic" style={{ color: 'var(--ink-3)' }}>
                  Натискайте ♡ на фразах, щоб зберігати до колекції
                </p>
              ) : (
                <>
                  <button
                    onClick={() => setShowCollection(v => !v)}
                    className="w-full mt-4 flex items-center justify-between gap-2 rounded-[var(--r)] border-none cursor-pointer font-bold text-[14.5px] transition-colors duration-200"
                    style={{
                      padding: '14px 18px',
                      background: 'rgba(255,255,255,.55)',
                      color: 'var(--ink)',
                    }}
                  >
                    <span>{showCollection ? 'Згорнути' : `Переглянути записи (${collectionTotal})`}</span>
                    <ChevronDown
                      size={18}
                      style={{ transition: 'transform .25s', transform: showCollection ? 'rotate(180deg)' : 'none', flexShrink: 0 }}
                    />
                  </button>

                  {showCollection && (
                    <div className="mt-[10px] space-y-2">
                      {collection.own.map(p => (
                        <div key={`own-${p.id}`} className="rounded-[var(--r)] text-[14px]" style={{ padding: '13px 16px', background: 'rgba(255,255,255,.55)', color: 'var(--ink)' }}>
                          <p className="font-cormorant italic text-[15px] leading-relaxed" style={{ color: 'var(--ink)' }}>«{p.text}»</p>
                          <p className="text-xs mt-1" style={{ color: 'var(--ink-3)' }}>Моя фраза</p>
                        </div>
                      ))}
                      {collection.saved.map(p => (
                        <div key={`saved-${p.id}`} className="rounded-[var(--r)] text-[14px] flex gap-2 items-start" style={{ padding: '13px 16px', background: 'rgba(255,255,255,.55)', color: 'var(--ink)' }}>
                          <div className="flex-1 min-w-0">
                            <p className="font-cormorant italic text-[15px] leading-relaxed" style={{ color: 'var(--ink)' }}>«{p.text}»</p>
                            <p className="text-xs mt-1" style={{ color: 'var(--ink-3)' }}>{p.author.firstName} {p.author.lastName}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

          </div>
        </div>
      </div>
    </Layout>
  )
}

function PhraseCard({ phrase, onToggleSave }: { phrase: Phrase; onToggleSave: () => void }) {
  const name = `${phrase.author.firstName} ${phrase.author.lastName}`
  const init = initials(phrase.author.firstName, phrase.author.lastName)
  const grad = avatarGradient(name)

  return (
    <div
      className="flex gap-[18px] items-start rounded-[var(--r-lg)] shadow-clay mb-[18px] transition-all duration-300"
      style={{
        padding: '26px 30px',
        background: phrase.savedByMe
          ? 'linear-gradient(150deg, #FCEFF1, #F8E3E9 92%)'
          : 'var(--surface)',
        boxShadow: 'var(--clay)',
      }}
    >
      <div className="flex-1 min-w-0">
        {phrase.savedByMe && (
          <div className="text-[11px] font-extrabold tracking-[.12em] uppercase mb-3" style={{ color: 'var(--rose-deep)' }}>
            ♡ У колекції
          </div>
        )}
        <p className="font-cormorant italic text-[22px] leading-[1.46]" style={{ color: 'var(--ink)' }}>
          «{phrase.text}»
        </p>
        <div className="flex items-center gap-[10px] mt-[14px]">
          <span
            className="w-[30px] h-[30px] rounded-full flex-shrink-0 flex items-center justify-center text-white font-extrabold text-[11px]"
            style={{ background: grad, boxShadow: 'var(--clay-sm)' }}
          >
            {init}
          </span>
          <span className="text-[13.5px] font-bold" style={{ color: 'var(--ink-2)' }}>{name}</span>
        </div>
      </div>
      <button
        onClick={onToggleSave}
        className="w-[44px] h-[44px] rounded-full flex-shrink-0 flex items-center justify-center border-none cursor-pointer transition-transform duration-200 hover:scale-[1.08]"
        style={
          phrase.savedByMe
            ? {
                background: 'linear-gradient(135deg, #E0734F, #C24A28)',
                color: '#fff',
                boxShadow: '-3px -3px 8px rgba(255,255,255,.35), 8px 10px 22px rgba(194,74,40,.42)',
              }
            : {
                background: 'var(--surface-2)',
                color: 'var(--rose)',
                boxShadow: 'var(--clay-sm)',
              }
        }
        aria-label={phrase.savedByMe ? 'Прибрати з колекції' : 'Зберегти до колекції'}
      >
        <Heart size={20} fill={phrase.savedByMe ? 'currentColor' : 'none'} />
      </button>
    </div>
  )
}
