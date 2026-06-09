import { useState, useRef, useEffect, useCallback } from 'react'
import { Upload, ZoomIn, ZoomOut, RotateCcw, Check, X, AlertTriangle } from 'lucide-react'

// ── Crop modal ────────────────────────────────────────────────────────────────

interface CropModalProps {
  src: string
  onConfirm: (file: File) => void
  onCancel: () => void
}

function CropModal({ src, onConfirm, onCancel }: CropModalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  const [nat, setNat] = useState({ w: 0, h: 0 })
  const [cSize, setCSize] = useState({ w: 0, h: 0 })
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const dragging = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })

  // Recompute container size
  const measure = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setCSize({ w: rect.width, h: rect.height })
  }, [])

  useEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure])

  const baseScale = cSize.w && nat.w
    ? Math.max(cSize.w / nat.w, cSize.h / nat.h)
    : 1
  const scale = baseScale * zoom
  const dispW = nat.w * scale
  const dispH = nat.h * scale
  const maxPanX = Math.max(0, (dispW - cSize.w) / 2)
  const maxPanY = Math.max(0, (dispH - cSize.h) / 2)
  const cx = Math.max(-maxPanX, Math.min(maxPanX, pan.x))
  const cy = Math.max(-maxPanY, Math.min(maxPanY, pan.y))

  const handleLoad = () => {
    const img = imgRef.current!
    setNat({ w: img.naturalWidth, h: img.naturalHeight })
    measure()
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  // Wheel zoom (non-passive)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      setZoom(z => Math.max(1, Math.min(5, z + (e.deltaY > 0 ? -0.08 : 0.08))))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true
    lastPos.current = { x: e.clientX, y: e.clientY }
  }
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current) return
    const dx = e.clientX - lastPos.current.x
    const dy = e.clientY - lastPos.current.y
    lastPos.current = { x: e.clientX, y: e.clientY }
    setPan(p => ({
      x: Math.max(-maxPanX, Math.min(maxPanX, p.x + dx)),
      y: Math.max(-maxPanY, Math.min(maxPanY, p.y + dy)),
    }))
  }
  const stopDrag = () => { dragging.current = false }

  // Touch support
  const lastTouch = useRef({ x: 0, y: 0 })
  const onTouchStart = (e: React.TouchEvent) => {
    lastTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const onTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - lastTouch.current.x
    const dy = e.touches[0].clientY - lastTouch.current.y
    lastTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    setPan(p => ({
      x: Math.max(-maxPanX, Math.min(maxPanX, p.x + dx)),
      y: Math.max(-maxPanY, Math.min(maxPanY, p.y + dy)),
    }))
  }

  const handleConfirm = () => {
    const img = imgRef.current!
    const imgLeft = cSize.w / 2 - dispW / 2 + cx
    const imgTop  = cSize.h / 2 - dispH / 2 + cy
    const cropX = Math.max(0, -imgLeft / scale)
    const cropY = Math.max(0, -imgTop  / scale)
    const cropW = Math.min(cSize.w / scale, nat.w - cropX)
    const cropH = Math.min(cSize.h / scale, nat.h - cropY)

    const canvas = document.createElement('canvas')
    canvas.width  = 1600
    canvas.height = 1200
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, 1600, 1200)
    canvas.toBlob(blob => {
      if (blob) onConfirm(new File([blob], 'cover.jpg', { type: 'image/jpeg' }))
    }, 'image/jpeg', 0.92)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[95vh]">

        {/* Header */}
        <div className="px-5 py-4 border-b border-[rgba(120,92,72,0.1)] flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-cormorant text-[18px] font-semibold text-[#3C2E27]">
              Кадрування 4:3
            </h3>
            <p className="text-xs text-[#9D8C80] mt-0.5">
              Перетягніть зображення · Колесо миші для масштабування
            </p>
          </div>
          <button onClick={onCancel} className="text-[#9D8C80] hover:text-[#6B584E] transition p-1">
            <X size={18} />
          </button>
        </div>

        {/* Crop area */}
        <div className="px-5 pt-4 flex-1 overflow-hidden">
          <div
            ref={containerRef}
            className="aspect-[4/3] w-full overflow-hidden relative rounded-xl bg-[#F3E2DA] cursor-grab active:cursor-grabbing select-none touch-none"
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={stopDrag}
            onMouseLeave={stopDrag}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
          >
            <img
              ref={imgRef}
              src={src}
              onLoad={handleLoad}
              draggable={false}
              alt=""
              style={{
                position: 'absolute',
                width: dispW,
                height: dispH,
                left: cSize.w / 2 - dispW / 2 + cx,
                top:  cSize.h / 2 - dispH / 2 + cy,
                maxWidth: 'none',
              }}
            />
            {/* Rule-of-thirds overlay */}
            {nat.w > 0 && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 bottom-0 border-r border-white/20" style={{ left: '33.3%' }} />
                <div className="absolute top-0 bottom-0 border-r border-white/20" style={{ left: '66.6%' }} />
                <div className="absolute left-0 right-0 border-b border-white/20" style={{ top: '33.3%' }} />
                <div className="absolute left-0 right-0 border-b border-white/20" style={{ top: '66.6%' }} />
                <div className="absolute inset-0 ring-2 ring-white/60 ring-inset rounded-xl" />
              </div>
            )}
          </div>

          {/* Zoom slider */}
          <div className="flex items-center gap-3 mt-3 mb-1">
            <button
              onClick={() => setZoom(z => Math.max(1, z - 0.15))}
              className="p-1.5 rounded-lg hover:bg-[#F5EDE8] transition text-[#9D8C80]"
            >
              <ZoomOut size={15} />
            </button>
            <input
              type="range" min="100" max="400"
              value={Math.round(zoom * 100)}
              onChange={e => setZoom(parseInt(e.target.value) / 100)}
              className="flex-1 accent-[#B05572]"
            />
            <button
              onClick={() => setZoom(z => Math.min(4, z + 0.15))}
              className="p-1.5 rounded-lg hover:bg-[#F5EDE8] transition text-[#9D8C80]"
            >
              <ZoomIn size={15} />
            </button>
            <button
              onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }}
              title="Скинути"
              className="p-1.5 rounded-lg hover:bg-[#F5EDE8] transition text-[#9D8C80]"
            >
              <RotateCcw size={13} />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 flex gap-3 shrink-0">
          <button
            onClick={onCancel}
            className="flex-1 border border-[#E4CFC0] text-[#9D8C80] hover:bg-[#FBF5ED] rounded-xl py-2.5 text-sm font-medium transition"
          >
            Скасувати
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 bg-[#B05572] text-white hover:bg-[#98415E] rounded-xl py-2.5 text-sm font-semibold transition flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(176,85,114,0.25)]"
          >
            <Check size={15} />
            Підтвердити кадрування
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Live preview ──────────────────────────────────────────────────────────────

function LivePreview({ src }: { src: string }) {
  return (
    <div className="space-y-2.5">
      <p className="text-[11px] font-bold text-[#9D8C80] uppercase tracking-widest">
        Попередній перегляд
      </p>

      <div className="grid grid-cols-1 gap-3">

        {/* 1. Hero event (dashboard) */}
        <div>
          <p className="text-[10px] text-[#9D8C80] mb-1 font-medium">1 · Hero-анонс (головна сторінка)</p>
          <div className="aspect-[4/3] w-full rounded-xl overflow-hidden bg-[#F3E2DA]">
            <img src={src} alt="" className="w-full h-full object-cover" />
          </div>
        </div>

        {/* 2 + 3 in a row */}
        <div className="grid grid-cols-2 gap-3">
          {/* Event card */}
          <div>
            <p className="text-[10px] text-[#9D8C80] mb-1 font-medium">2 · Картка події</p>
            <div className="bg-white rounded-xl overflow-hidden border border-[rgba(120,92,72,0.08)] shadow-sm">
              <div className="aspect-[4/3] overflow-hidden bg-[#F3E2DA]">
                <img src={src} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="p-2">
                <div className="h-2.5 bg-[#F3E2DA] rounded w-3/4 mb-1.5" />
                <div className="h-2 bg-[#F3E2DA] rounded w-1/2" />
              </div>
            </div>
          </div>

          {/* Event detail page */}
          <div>
            <p className="text-[10px] text-[#9D8C80] mb-1 font-medium">3 · Сторінка події</p>
            <div className="aspect-[4/3] rounded-xl overflow-hidden bg-[#F3E2DA]">
              <img src={src} alt="" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

// ── Guidelines panel ──────────────────────────────────────────────────────────

function Guidelines() {
  return (
    <div className="bg-[#FBF5ED] border border-[rgba(120,92,72,0.1)] rounded-xl p-4 space-y-3">
      <div className="flex items-start gap-3">
        {/* Visual 4:3 ratio example */}
        <div className="shrink-0 flex flex-col items-center gap-1">
          <div
            className="bg-white border-2 border-dashed border-[#E4CFC0] rounded-lg flex items-center justify-center text-[#9D8C80]"
            style={{ width: 60, height: 45 }}
          >
            <span className="text-[8px] font-bold tracking-wide text-center leading-tight">
              4:3
            </span>
          </div>
          <span className="text-[9px] text-[#9D8C80]">Формат 4:3</span>
        </div>

        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-[#3C2E27] mb-1.5">Обкладинка події</p>
          <p className="text-[11.5px] text-[#6B584E] leading-relaxed mb-2">
            Завантажте якісне горизонтальне зображення для анонсу події.
          </p>
          <div className="space-y-0.5 text-[11px] text-[#6B584E]">
            <p><span className="font-semibold text-[#3C2E27]">Рекомендований:</span> 1600 × 1200 px (4:3)</p>
            <p><span className="font-semibold text-[#3C2E27]">Мінімальний:</span> 1200 × 900 px</p>
            <p><span className="font-semibold text-[#3C2E27]">Формати:</span> JPG, PNG</p>
          </div>
          <ul className="mt-2 space-y-0.5 text-[11px] text-[#9D8C80]">
            <li>· Горизонтальні фото або ілюстрації</li>
            <li>· Основний об'єкт — ближче до центру</li>
            <li>· Уникайте деталей біля країв</li>
            <li>· Не розміщуйте текст на зображенні</li>
          </ul>
          <p className="mt-2 text-[10px] text-[#9D8C80] italic">
            Це зображення використовується скрізь: головна сторінка, список подій, сторінка події.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface EventImageUploadProps {
  currentImageUrl?: string | null
  hasCover: boolean
  onFile: (file: File | null) => void
}

export default function EventImageUpload({ currentImageUrl, hasCover, onFile }: EventImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [rawSrc, setRawSrc] = useState<string | null>(null)
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  const [showCrop, setShowCrop] = useState(false)
  const [warning, setWarning] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const displaySrc = previewSrc || currentImageUrl || null

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) return
    const src = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const ratio = img.width / img.height
      if (img.width < 1200 || img.height < 900) {
        setWarning(`Зображення ${img.width}×${img.height} px — менше мінімуму (1200×900 px). Може відображатися нечітко в анонсах.`)
      } else if (Math.abs(ratio - 4/3) > 0.15) {
        setWarning(`Зображення не є горизонтальним у форматі 4:3 (${img.width}×${img.height} px). Відкадруйте нижче для кращого відображення.`)
      } else {
        setWarning(null)
      }
      setRawSrc(src)
      setShowCrop(true)
    }
    img.src = src
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  const handleCropConfirm = (file: File) => {
    const url = URL.createObjectURL(file)
    setPreviewSrc(url)
    setShowCrop(false)
    onFile(file)
  }

  const handleChange = () => {
    inputRef.current?.click()
  }

  const handleRemove = () => {
    setPreviewSrc(null)
    setRawSrc(null)
    setWarning(null)
    onFile(null)
  }

  return (
    <div className="space-y-4">

      {/* Upload zone */}
      {!displaySrc ? (
        <div
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
          onDragLeave={() => setIsDragOver(false)}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
            isDragOver
              ? 'border-[#B05572] bg-[#FBEAEE]'
              : 'border-[#E4CFC0] hover:border-[#B05572]/60 hover:bg-[#FBF5ED]'
          }`}
        >
          <Upload size={22} className="mx-auto text-[#B05572]/50 mb-2" />
          <p className="text-[13.5px] text-[#6B584E] font-medium">
            Завантажте обкладинку події
          </p>
          <p className="text-[11.5px] text-[#9D8C80] mt-1">
            Перетягніть або натисніть · JPG, PNG · Рекомендовано 1600×1200 px (4:3)
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Current image preview with change/remove */}
          <div className="aspect-[4/3] w-full rounded-xl overflow-hidden bg-[#F3E2DA] relative group">
            <img src={displaySrc} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
              <button
                type="button"
                onClick={handleChange}
                className="bg-white text-[#3C2E27] text-xs font-bold px-3 py-1.5 rounded-full shadow hover:bg-[#FBF5ED] transition"
              >
                Замінити
              </button>
              {previewSrc && (
                <button
                  type="button"
                  onClick={handleRemove}
                  className="bg-white text-red-600 text-xs font-bold px-3 py-1.5 rounded-full shadow hover:bg-red-50 transition"
                >
                  Видалити
                </button>
              )}
            </div>
          </div>
          {hasCover && !previewSrc && (
            <button
              type="button"
              onClick={handleChange}
              className="text-[12px] text-[#B05572] font-medium hover:opacity-70 transition"
            >
              Замінити зображення →
            </button>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/jpg"
        className="hidden"
        onChange={handleInputChange}
      />

      {/* Warning */}
      {warning && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-3">
          <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-[12px] text-amber-800 leading-relaxed">{warning}</p>
        </div>
      )}

      {/* Live preview — shows immediately after upload */}
      {displaySrc && <LivePreview src={displaySrc} />}

      {/* Guidelines */}
      {!displaySrc && <Guidelines />}

      {/* Crop modal */}
      {showCrop && rawSrc && (
        <CropModal
          src={rawSrc}
          onConfirm={handleCropConfirm}
          onCancel={() => setShowCrop(false)}
        />
      )}
    </div>
  )
}
