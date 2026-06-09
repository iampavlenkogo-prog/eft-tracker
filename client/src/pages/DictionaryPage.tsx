import { useState, useEffect } from 'react'
import { Heart, Edit3, Check, X, Plus, Trash2, Download, Search } from 'lucide-react'
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

export default function DictionaryPage() {
  const { user } = useAuth()

  // ── Community phrases (main feed) ──
  const [phrases, setPhrases] = useState<Phrase[]>([])
  const [feedSearch, setFeedSearch] = useState('')
  const [feedLoading, setFeedLoading] = useState(true)

  // ── My phrases (sidebar) ──
  const [myPhrases, setMyPhrases] = useState<PhraseItem[]>([])
  const [newPhraseText, setNewPhraseText] = useState('')
  const [addingPhrase, setAddingPhrase] = useState(false)
  const [phraseError, setPhraseError] = useState('')
  const [editingPhraseId, setEditingPhraseId] = useState<string | null>(null)
  const [editingPhraseText, setEditingPhraseText] = useState('')

  // ── My collection (sidebar) ──
  const [collection, setCollection] = useState<Collection>({ own: [], saved: [] })
  const [collectionTab, setCollectionTab] = useState<'all' | 'own' | 'saved'>('all')
  const [collectionSearch, setCollectionSearch] = useState('')
  const [exportingPdf, setExportingPdf] = useState(false)

  useEffect(() => {
    api.get('/phrases?limit=50').then(r => setPhrases(r.data)).catch(() => {}).finally(() => setFeedLoading(false))
    api.get('/phrases/my').then(r => setMyPhrases(r.data)).catch(() => {})
    api.get('/phrases/collection').then(r => setCollection(r.data)).catch(() => {})
  }, [])

  // ── Handlers: save/unsave ──
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

  const handleUnsavePhrase = async (phraseId: string) => {
    try {
      await api.delete(`/phrases/${phraseId}/save`)
      setCollection(prev => ({ ...prev, saved: prev.saved.filter(p => p.id !== phraseId) }))
      setPhrases(prev => prev.map(p => p.id === phraseId ? { ...p, savedByMe: false } : p))
    } catch {}
  }

  // ── Handlers: my phrases ──
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

  // ── PDF export ──
  const handleExportPDF = async () => {
    const allPhrases = [...collection.own, ...collection.saved]
    if (allPhrases.length === 0) return
    setExportingPdf(true)
    try {
      const { jsPDF } = await import('jspdf')
      const html2canvas = (await import('html2canvas')).default
      const today = new Date().toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })
      const logoUrl = `${window.location.origin}/illustrations/Logo_obiymu.png`
      const ownItems = collection.own
      const savedItems = collection.saved
      const container = document.createElement('div')
      container.style.cssText = 'position:absolute;left:-10000px;top:0;width:794px;background:#FAFAF8;box-sizing:border-box;font-family:Arial,sans-serif;'
      container.innerHTML = `
        <div style="padding:60px 56px;">
          <h1 style="font-family:Georgia,serif;font-size:36px;font-weight:400;color:#2C2C2C;margin-bottom:8px;">Словник ЕФТ терапевта</h1>
          <p style="font-size:12px;color:#A0A0A0;margin-bottom:24px;">${user?.firstName} ${user?.lastName}</p>
          <hr style="border:none;border-top:1px solid #E0D9D0;margin-bottom:32px;">
          ${ownItems.length > 0 ? `
            <div style="font-size:11px;font-weight:500;letter-spacing:3px;text-transform:uppercase;color:#B8A8A4;margin-bottom:16px;">Мої записи</div>
            ${ownItems.map(p => `<div style="background:#F0EBE3;border-radius:12px;padding:20px 24px;margin-bottom:12px;"><div style="font-family:Georgia,serif;font-size:18px;font-style:italic;color:#2C2C2C;line-height:1.6;margin-bottom:8px;">«${p.text}»</div><div style="font-size:11px;color:#A0A0A0;">Моя фраза</div></div>`).join('')}
          ` : ''}
          ${savedItems.length > 0 ? `
            <div style="font-size:11px;font-weight:500;letter-spacing:3px;text-transform:uppercase;color:#B8A8A4;margin-bottom:16px;${ownItems.length > 0 ? 'margin-top:24px;' : ''}">Збережені записи</div>
            ${savedItems.map(p => `<div style="background:#F0EBE3;border-radius:12px;padding:20px 24px;margin-bottom:12px;"><div style="font-family:Georgia,serif;font-size:18px;font-style:italic;color:#2C2C2C;line-height:1.6;margin-bottom:8px;">«${p.text}»</div><div style="font-size:11px;color:#A0A0A0;">${p.author.firstName} ${p.author.lastName}</div></div>`).join('')}
          ` : ''}
          <div style="margin-top:48px;text-align:center;">
            <div style="font-family:Georgia,serif;font-style:italic;font-size:15px;color:#B8A8A4;margin-bottom:8px;">Навчання. Ріст. Зв'язок. ♡</div>
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

  // ── Filtered community feed ──
  const filteredPhrases = feedSearch.trim()
    ? phrases.filter(p =>
        p.text.toLowerCase().includes(feedSearch.toLowerCase()) ||
        `${p.author.firstName} ${p.author.lastName}`.toLowerCase().includes(feedSearch.toLowerCase())
      )
    : phrases

  // ── Sidebar expand state ──
  const [showMyPhrases, setShowMyPhrases] = useState(false)
  const [showCollection, setShowCollection] = useState(false)

  // ── Collection list helper ──
  const collectionList = (() => {
    const q = collectionSearch.toLowerCase()
    const ownF  = collection.own.filter(p => p.text.toLowerCase().includes(q))
    const savedF = collection.saved.filter(p => p.text.toLowerCase().includes(q))
    const showOwn   = collectionTab === 'all' || collectionTab === 'own'
    const showSaved = collectionTab === 'all' || collectionTab === 'saved'
    return [
      ...(showOwn   ? ownF.map(p   => ({ kind: 'own'   as const, phrase: p })) : []),
      ...(showSaved ? savedF.map(p => ({ kind: 'saved' as const, phrase: p })) : []),
    ]
  })()

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">

        {/* ── Page header ── */}
        <div className="bg-gradient-to-br from-[#EEF0E8] via-[#F0EDE8] to-[#F5EDEA] rounded-2xl px-6 pt-6 pb-5 mb-6 flex items-end justify-between gap-4 overflow-hidden relative">
          <div>
            <p className="text-[10px] font-medium text-warm-light uppercase tracking-widest mb-1">Спільнота · ЕФТ</p>
            <h1 className="font-cormorant text-[28px] sm:text-[32px] font-semibold text-warm-dark leading-tight">
              Словник ЕФТ терапевта ♡
            </h1>
            <p className="text-sm text-warm-mid mt-1.5 max-w-sm">
              Фрази, терміни та визначення, якими діляться терапевти спільноти
            </p>
          </div>
          <img src="/illustrations/slovnyk_EFT.png" alt="" className="w-24 sm:w-28 h-auto object-contain shrink-0 drop-shadow-sm" />
        </div>

        {/* ── Two-column layout ── */}
        <div className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-6 lg:items-start">

          {/* ════ LEFT: Community feed ════ */}
          <div className="mb-6 lg:mb-0">

            {/* Search */}
            <div className="relative mb-5">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-warm-light pointer-events-none" />
              <input
                type="text"
                value={feedSearch}
                onChange={e => setFeedSearch(e.target.value)}
                placeholder="Пошук у словнику…"
                className="w-full bg-white border border-sand/50 rounded-2xl pl-10 pr-4 py-3 text-sm text-warm-dark placeholder:text-warm-light/50 focus:outline-none focus:border-rose/40 focus:ring-2 focus:ring-rose/10 transition"
              />
            </div>

            {/* Phrases */}
            {feedLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-white rounded-2xl p-6 animate-pulse border border-sand/30">
                    <div className="h-4 bg-beige rounded w-full mb-2" />
                    <div className="h-4 bg-beige rounded w-3/4 mb-3" />
                    <div className="h-3 bg-beige rounded w-1/3" />
                  </div>
                ))}
              </div>
            ) : filteredPhrases.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-sand/30">
                <p className="font-cormorant text-xl text-warm-mid">
                  {feedSearch ? 'Нічого не знайдено' : 'Словник ще порожній ♡'}
                </p>
                {!feedSearch && (
                  <p className="text-sm text-warm-light mt-1">
                    Додайте першу фразу в правій панелі
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredPhrases.map(phrase => (
                  <div key={phrase.id} className="bg-white rounded-2xl border border-sand/30 p-5 group hover:border-rose-light hover:shadow-[0_2px_12px_rgba(176,85,114,0.08)] transition-all duration-200">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0 pl-4 border-l-2 border-rose-light group-hover:border-rose transition-colors duration-200">
                        <p className="font-cormorant italic text-warm-dark text-[17px] leading-relaxed">
                          «{phrase.text}»
                        </p>
                        <p className="text-xs text-warm-light mt-2">
                          — {phrase.author.firstName} {phrase.author.lastName}
                        </p>
                      </div>
                      <button
                        onClick={() => toggleSave(phrase)}
                        className={`shrink-0 mt-1 transition-all duration-200 ${
                          phrase.savedByMe
                            ? 'text-rose scale-110'
                            : 'text-warm-light hover:text-rose hover:scale-110'
                        }`}
                        title={phrase.savedByMe ? 'Видалити з колекції' : 'Зберегти до колекції'}
                      >
                        <Heart size={18} fill={phrase.savedByMe ? 'currentColor' : 'none'} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ════ RIGHT: Sticky sidebar ════ */}
          <div className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto space-y-4 pb-4 scrollbar-hide">

            {/* ── Мій словник ЕФТ ── */}
            <div className="bg-white rounded-2xl border border-sand/30 shadow-sm overflow-hidden">
              <div className="px-5 pt-5 pb-4 border-b border-sand/30 bg-gradient-to-br from-[#EEF0E8] to-[#F5EDEA]">
                <h2 className="font-cormorant text-xl font-semibold text-warm-dark">Мій словник ЕФТ</h2>
                <p className="text-xs text-warm-mid mt-0.5">Ваші терміни та фрази</p>
              </div>

              <div className="p-5">
                {/* Add phrase */}
                <div className="mb-4">
                  <textarea
                    value={newPhraseText}
                    onChange={e => setNewPhraseText(e.target.value)}
                    rows={2}
                    placeholder="Додайте термін, фразу або визначення…"
                    className="w-full bg-[#FFF9F5] border border-[#EDE5DE] rounded-xl px-4 py-2.5 text-sm text-warm-dark placeholder:text-[#9A8878] focus:outline-none focus:border-[#B8A8A4]/60 transition resize-none"
                  />
                  {phraseError && <p className="text-red-500 text-xs mt-1">{phraseError}</p>}
                  <button
                    onClick={handleAddPhrase}
                    disabled={addingPhrase || !newPhraseText.trim()}
                    className="mt-2 flex items-center gap-1.5 bg-gradient-to-br from-[#C07888] to-[#A06070] text-white font-medium rounded-xl px-5 py-2 text-sm hover:opacity-90 transition disabled:opacity-50"
                  >
                    <Plus size={14} />
                    {addingPhrase ? 'Додаємо…' : 'Додати'}
                  </button>
                </div>

                {/* My phrases — toggled list */}
                {myPhrases.length === 0 ? (
                  <p className="text-sm text-warm-light italic">Ви ще не додали жодного запису</p>
                ) : (
                  <>
                    <button
                      onClick={() => setShowMyPhrases(v => !v)}
                      className="w-full flex items-center justify-between text-sm font-medium text-warm-mid hover:text-warm-dark bg-beige hover:bg-sand/50 rounded-xl px-4 py-2.5 transition"
                    >
                      <span>{showMyPhrases ? 'Згорнути' : `Переглянути записи (${myPhrases.length})`}</span>
                      <svg className={`w-4 h-4 transition-transform duration-200 ${showMyPhrases ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {showMyPhrases && (
                      <div className="space-y-2 mt-3">
                        {myPhrases.map(phrase => (
                          <div key={phrase.id} className="bg-beige rounded-xl p-3">
                            {editingPhraseId === phrase.id ? (
                              <div>
                                <textarea
                                  value={editingPhraseText}
                                  onChange={e => setEditingPhraseText(e.target.value)}
                                  rows={2}
                                  className="w-full bg-[#FFF9F5] border border-[#EDE5DE] rounded-xl px-3 py-2 text-sm text-warm-dark focus:outline-none focus:border-[#B8A8A4]/60 transition resize-none"
                                />
                                <div className="flex gap-2 mt-1.5">
                                  <button
                                    onClick={() => handleSaveEditPhrase(phrase.id)}
                                    className="flex items-center gap-1 bg-rose-lighter text-rose hover:bg-rose-light text-xs font-medium rounded-lg px-3 py-1 transition"
                                  >
                                    <Check size={11} /> Зберегти
                                  </button>
                                  <button
                                    onClick={() => setEditingPhraseId(null)}
                                    className="flex items-center gap-1 text-warm-light hover:text-warm-mid text-xs rounded-lg px-3 py-1 transition"
                                  >
                                    <X size={11} /> Скасувати
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex gap-2 items-start">
                                <p className="font-cormorant italic text-warm-dark text-[15px] leading-relaxed flex-1">«{phrase.text}»</p>
                                <div className="flex gap-1.5 shrink-0 mt-0.5">
                                  <button
                                    onClick={() => { setEditingPhraseId(phrase.id); setEditingPhraseText(phrase.text) }}
                                    className="text-warm-light hover:text-warm-mid transition" title="Редагувати"
                                  >
                                    <Edit3 size={13} />
                                  </button>
                                  <button
                                    onClick={() => handleDeletePhrase(phrase.id)}
                                    className="text-warm-light hover:text-red-400 transition" title="Видалити"
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
            </div>

            {/* ── Моя колекція словника ── */}
            <div className="bg-white rounded-2xl border border-sand/30 shadow-sm overflow-hidden">
              {/* Header */}
              <div className="relative bg-beige px-5 py-4 overflow-hidden">
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h2 className="font-cormorant text-xl font-semibold text-warm-dark">Моя колекція</h2>
                    {(collection.own.length + collection.saved.length) > 0 && (
                      <button
                        onClick={handleExportPDF}
                        disabled={exportingPdf}
                        className="flex items-center gap-1 text-warm-light hover:text-warm-mid disabled:opacity-50 text-xs transition ml-auto"
                        title="Завантажити PDF"
                      >
                        <Download size={13} />
                        {exportingPdf ? 'Генеруємо…' : 'PDF'}
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-warm-light">{collection.own.length + collection.saved.length} записів</p>
                </div>
                <img
                  src="/illustrations/slovnyk_EFT.png"
                  alt=""
                  className="absolute right-0 bottom-0 h-20 w-auto object-contain pointer-events-none opacity-60"
                />
              </div>

              <div className="p-5">
                {collection.own.length + collection.saved.length === 0 ? (
                  <p className="text-sm text-warm-light italic">
                    Натискайте ♡ на фразах, щоб зберігати до колекції
                  </p>
                ) : (
                  <>
                    {/* Toggle button */}
                    <button
                      onClick={() => setShowCollection(v => !v)}
                      className="w-full flex items-center justify-between text-sm font-medium text-warm-mid hover:text-warm-dark bg-beige hover:bg-sand/50 rounded-xl px-4 py-2.5 transition"
                    >
                      <span>{showCollection ? 'Згорнути' : `Переглянути записи (${collection.own.length + collection.saved.length})`}</span>
                      <svg className={`w-4 h-4 transition-transform duration-200 ${showCollection ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {showCollection && (
                      <div className="mt-3 space-y-3">
                        {/* Tabs */}
                        <div className="flex gap-1 bg-beige rounded-xl p-1">
                          {([
                            { key: 'all',   label: `Всі (${collection.own.length + collection.saved.length})` },
                            { key: 'own',   label: `Мої (${collection.own.length})` },
                            { key: 'saved', label: `Збережені (${collection.saved.length})` },
                          ] as { key: 'all' | 'own' | 'saved'; label: string }[]).map(({ key, label }) => (
                            <button
                              key={key}
                              onClick={() => { setCollectionTab(key); setCollectionSearch('') }}
                              className={`flex-1 text-xs font-medium py-1.5 rounded-lg transition ${
                                collectionTab === key
                                  ? 'bg-white text-warm-dark shadow-sm'
                                  : 'text-warm-light hover:text-warm-mid'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>

                        {/* Search */}
                        <div className="relative">
                          <input
                            type="text"
                            value={collectionSearch}
                            onChange={e => setCollectionSearch(e.target.value)}
                            placeholder="Пошук…"
                            className="w-full bg-[#FFF9F5] border border-[#EDE5DE] rounded-xl pl-8 pr-4 py-2 text-sm text-warm-dark placeholder:text-[#9A8878] focus:outline-none focus:border-[#B8A8A4]/60 transition"
                          />
                          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-warm-light" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                        </div>

                        {/* List */}
                        {collectionList.length === 0 ? (
                          <p className="text-sm text-warm-light italic text-center py-3">
                            {collectionSearch ? 'Нічого не знайдено' : 'Тут поки порожньо'}
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {collectionList.map(item =>
                              item.kind === 'own' ? (
                                <div key={`own-${item.phrase.id}`} className="bg-beige rounded-xl p-3">
                                  <p className="font-cormorant italic text-warm-dark text-[15px] leading-relaxed">«{item.phrase.text}»</p>
                                  <p className="text-xs text-warm-light mt-1">Моя фраза</p>
                                </div>
                              ) : (
                                <div key={`saved-${item.phrase.id}`} className="bg-beige rounded-xl p-3 flex gap-2 items-start">
                                  <div className="flex-1 min-w-0">
                                    <p className="font-cormorant italic text-warm-dark text-[15px] leading-relaxed">«{item.phrase.text}»</p>
                                    <p className="text-xs text-warm-light mt-1">{item.phrase.author.firstName} {item.phrase.author.lastName}</p>
                                  </div>
                                  <button
                                    onClick={() => handleUnsavePhrase(item.phrase.id)}
                                    className="shrink-0 mt-0.5 text-rose hover:opacity-70 transition"
                                    title="Прибрати з колекції"
                                  >
                                    <Heart size={15} fill="currentColor" />
                                  </button>
                                </div>
                              )
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

          </div>{/* end sidebar */}

        </div>{/* end grid */}
      </div>
    </Layout>
  )
}
