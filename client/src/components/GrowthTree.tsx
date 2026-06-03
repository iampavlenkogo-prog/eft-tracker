import { useEffect, useState } from 'react'

// ── Stage SVGs ────────────────────────────────────────────────────────────────

const Stage1 = () => (
  <svg viewBox="0 0 200 220" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <ellipse cx="100" cy="185" rx="45" ry="12" fill="#3D7070" opacity="0.6"/>
    <path d="M95 183 Q80 190 70 200" stroke="#3D7070" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    <path d="M105 183 Q118 190 128 200" stroke="#3D7070" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    <path d="M100 183 Q98 160 100 130" stroke="#3D7070" strokeWidth="3" fill="none" strokeLinecap="round"/>
    <ellipse cx="88" cy="138" rx="14" ry="22" fill="#7BA05B" opacity="0.9" transform="rotate(-25 88 138)"/>
    <ellipse cx="112" cy="132" rx="14" ry="22" fill="#8FBC6E" opacity="0.9" transform="rotate(20 112 132)"/>
    <path d="M88 125 Q87 138 88 151" stroke="#5A8040" strokeWidth="0.8" fill="none"/>
    <path d="M112 120 Q111 132 112 145" stroke="#5A8040" strokeWidth="0.8" fill="none"/>
  </svg>
)

const Stage2 = () => (
  <svg viewBox="0 0 200 240" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <ellipse cx="100" cy="200" rx="50" ry="13" fill="#3D7070" opacity="0.6"/>
    <path d="M93 198 Q75 205 62 215" stroke="#3D7070" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    <path d="M100 200 Q100 210 100 218" stroke="#3D7070" strokeWidth="2" fill="none" strokeLinecap="round"/>
    <path d="M107 198 Q123 205 136 215" stroke="#3D7070" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    <path d="M100 198 Q97 165 100 110" stroke="#3D7070" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
    <ellipse cx="84" cy="148" rx="16" ry="26" fill="#7BA05B" opacity="0.9" transform="rotate(-30 84 148)"/>
    <ellipse cx="116" cy="140" rx="16" ry="26" fill="#8FBC6E" opacity="0.9" transform="rotate(25 116 140)"/>
    <ellipse cx="88" cy="118" rx="12" ry="20" fill="#A8CC7A" opacity="0.85" transform="rotate(-20 88 118)"/>
    <ellipse cx="113" cy="112" rx="12" ry="20" fill="#7BA05B" opacity="0.85" transform="rotate(15 113 112)"/>
  </svg>
)

const Stage3 = () => (
  <svg viewBox="0 0 240 280" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <ellipse cx="120" cy="248" rx="60" ry="14" fill="#3D7070" opacity="0.5"/>
    <path d="M108 246 Q85 255 68 265" stroke="#3D7070" strokeWidth="3" fill="none" strokeLinecap="round"/>
    <path d="M120 248 Q120 258 120 268" stroke="#3D7070" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    <path d="M132 246 Q153 255 170 265" stroke="#3D7070" strokeWidth="3" fill="none" strokeLinecap="round"/>
    <path d="M120 246 Q116 200 118 130" stroke="#3D7070" strokeWidth="5" fill="none" strokeLinecap="round"/>
    <path d="M117 175 Q95 160 75 148" stroke="#3D7070" strokeWidth="3" fill="none" strokeLinecap="round"/>
    <path d="M118 158 Q140 142 160 132" stroke="#3D7070" strokeWidth="3" fill="none" strokeLinecap="round"/>
    <path d="M118 140 Q100 125 85 112" stroke="#3D7070" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    <path d="M119 133 Q138 118 153 108" stroke="#3D7070" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    <ellipse cx="72" cy="144" rx="14" ry="20" fill="#7BA05B" transform="rotate(-40 72 144)"/>
    <ellipse cx="163" cy="128" rx="14" ry="20" fill="#8FBC6E" transform="rotate(35 163 128)"/>
    <ellipse cx="82" cy="108" rx="12" ry="18" fill="#A8CC7A" transform="rotate(-30 82 108)"/>
    <ellipse cx="156" cy="104" rx="12" ry="18" fill="#7BA05B" transform="rotate(25 156 104)"/>
    <ellipse cx="108" cy="120" rx="13" ry="20" fill="#8FBC6E" transform="rotate(-15 108 120)"/>
    <ellipse cx="130" cy="115" rx="13" ry="20" fill="#A8CC7A" transform="rotate(10 130 115)"/>
    <ellipse cx="118" cy="108" rx="11" ry="17" fill="#7BA05B" transform="rotate(0 118 108)"/>
  </svg>
)

const SAKURA_POSITIONS: [number, number][] = [
  [70, 165], [85, 135], [105, 120], [130, 108],
  [155, 118], [175, 150], [183, 165],
  [60, 180], [95, 105], [165, 105],
]

const Stage4 = () => (
  <svg viewBox="0 0 260 300" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <ellipse cx="130" cy="272" rx="70" ry="15" fill="#C8A882" opacity="0.4"/>
    <path d="M130 270 Q125 230 128 175" stroke="#3D7070" strokeWidth="7" fill="none" strokeLinecap="round"/>
    <path d="M127 210 Q100 190 72 170" stroke="#3D7070" strokeWidth="4.5" fill="none" strokeLinecap="round"/>
    <path d="M128 195 Q155 175 182 158" stroke="#3D7070" strokeWidth="4.5" fill="none" strokeLinecap="round"/>
    <path d="M128 178 Q108 155 88 138" stroke="#3D7070" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
    <path d="M129 170 Q150 148 170 133" stroke="#3D7070" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
    <path d="M128 175 Q128 148 130 118" stroke="#3D7070" strokeWidth="3" fill="none" strokeLinecap="round"/>
    {SAKURA_POSITIONS.map(([cx, cy], i) => (
      <g key={i} transform={`translate(${cx},${cy})`}>
        <circle r="5" fill="#F8D7D0" opacity="0.9"/>
        <circle cx="0" cy="-7" r="4" fill="#F0C4BC" opacity="0.8"/>
        <circle cx="7" cy="-3" r="4" fill="#F8D7D0" opacity="0.8"/>
        <circle cx="4" cy="5" r="4" fill="#F0C4BC" opacity="0.8"/>
        <circle cx="-4" cy="5" r="4" fill="#F8D7D0" opacity="0.8"/>
        <circle cx="-7" cy="-3" r="4" fill="#F0C4BC" opacity="0.8"/>
        <circle r="2" fill="#F4A4A0"/>
      </g>
    ))}
    <ellipse cx="90" cy="240" rx="4" ry="6" fill="#F8D7D0" opacity="0.6" transform="rotate(30 90 240)"/>
    <ellipse cx="160" cy="255" rx="3" ry="5" fill="#F0C4BC" opacity="0.5" transform="rotate(-20 160 255)"/>
    <ellipse cx="115" cy="260" rx="3" ry="5" fill="#F8D7D0" opacity="0.4" transform="rotate(45 115 260)"/>
  </svg>
)

const FRUIT_POSITIONS: [number, number][] = [
  [108, 148], [130, 140], [155, 135], [178, 145],
  [120, 168], [148, 162], [172, 165],
  [95, 162], [195, 160], [140, 178],
]

const Stage5 = () => (
  <svg viewBox="0 0 300 320" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <ellipse cx="150" cy="295" rx="90" ry="18" fill="#7BA05B" opacity="0.3"/>
    <path d="M150 293 Q142 245 145 185" stroke="#6B4F3A" strokeWidth="16" fill="none" strokeLinecap="round"/>
    <path d="M150 293 Q158 245 155 185" stroke="#7A5C42" strokeWidth="10" fill="none" strokeLinecap="round"/>
    <path d="M146 235 Q112 210 78 190" stroke="#6B4F3A" strokeWidth="8" fill="none" strokeLinecap="round"/>
    <path d="M147 218 Q180 195 212 178" stroke="#6B4F3A" strokeWidth="8" fill="none" strokeLinecap="round"/>
    <path d="M146 200 Q118 175 92 155" stroke="#6B4F3A" strokeWidth="6" fill="none" strokeLinecap="round"/>
    <path d="M148 192 Q175 168 200 150" stroke="#6B4F3A" strokeWidth="6" fill="none" strokeLinecap="round"/>
    <path d="M147 185 Q147 155 150 120" stroke="#6B4F3A" strokeWidth="5" fill="none" strokeLinecap="round"/>
    <circle cx="150" cy="130" r="65" fill="#7BA05B" opacity="0.85"/>
    <circle cx="105" cy="155" r="48" fill="#8FBC6E" opacity="0.8"/>
    <circle cx="195" cy="152" r="48" fill="#7BA05B" opacity="0.8"/>
    <circle cx="130" cy="105" r="40" fill="#A8CC7A" opacity="0.75"/>
    <circle cx="170" cy="108" r="38" fill="#8FBC6E" opacity="0.75"/>
    <circle cx="150" cy="95" r="32" fill="#A8CC7A" opacity="0.7"/>
    <circle cx="118" cy="125" r="20" fill="#6A9B4A" opacity="0.4"/>
    <circle cx="175" cy="130" r="22" fill="#6A9B4A" opacity="0.35"/>
    {FRUIT_POSITIONS.map(([cx, cy], i) => (
      <g key={i}>
        <circle cx={cx} cy={cy} r="8" fill="#4D8A85"/>
        <circle cx={cx} cy={cy} r="8" fill="#D4654A" opacity="0.7"/>
        <circle cx={cx - 2} cy={cy - 2} r="3" fill="#E8855A" opacity="0.5"/>
        <path d={`M${cx} ${cy - 8} Q${cx + 3} ${cy - 12} ${cx + 1} ${cy - 14}`} stroke="#5A8040" strokeWidth="1.5" fill="none"/>
      </g>
    ))}
  </svg>
)

// ── Stage metadata ────────────────────────────────────────────────────────────

const STAGE_LABELS: Record<number, string> = {
  1: 'Ваш шлях тільки починається 🌱',
  2: 'Паросток тягнеться до світла ✨',
  3: 'Дерево набирає силу 🌿',
  4: 'Дерево починає цвісти 🌸',
  5: 'Ваше дерево у повному розквіті 🍎',
}

const STAGE_COMPONENTS = [Stage1, Stage2, Stage3, Stage4, Stage5]

// ── Main component ────────────────────────────────────────────────────────────

interface GrowthTreeProps {
  supervisions: number
  seminars: number
}

export function GrowthTree({ supervisions, seminars }: GrowthTreeProps) {
  const [animated, setAnimated] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100)
    return () => clearTimeout(t)
  }, [])

  const total = supervisions + seminars

  const stage = total <= 5 ? 1 : total <= 15 ? 2 : total <= 25 ? 3 : total <= 40 ? 4 : 5
  const progress = Math.min((total / 50) * 100, 100)

  const StageTree = STAGE_COMPONENTS[stage - 1]

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-sand/40">
      {/* Header */}
      <div className="mb-4">
        <h3 className="font-cormorant text-2xl font-semibold text-warm-dark">Ваше дерево росту ♡</h3>
        <p className="text-warm-mid text-sm mt-1">
          Кожна супервізія і семінар — це новий листочок на вашому дереві
        </p>
      </div>

      {/* Tree */}
      <div
        className="flex justify-center items-end mx-auto"
        style={{
          height: 220,
          maxWidth: 240,
          transition: 'transform 1.5s ease-in-out, opacity 1.5s ease-in-out',
          transform: animated ? 'scale(1)' : 'scale(0.85)',
          opacity: animated ? 1 : 0,
        }}
      >
        <StageTree />
      </div>

      {/* Progress */}
      <div className="mt-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-warm-mid">{STAGE_LABELS[stage]}</span>
          <span className="text-sm font-medium text-rose">{total} / 50</span>
        </div>
        <div className="h-2 bg-sand rounded-full overflow-hidden">
          <div
            className="h-full bg-rose rounded-full"
            style={{
              width: `${progress}%`,
              transition: 'width 1.5s ease-in-out',
            }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[11px] text-warm-light">🌱 Початок</span>
          <span className="text-[11px] text-warm-light">🍎 Розквіт</span>
        </div>
      </div>
    </div>
  )
}
