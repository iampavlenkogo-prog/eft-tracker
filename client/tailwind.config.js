/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        /* ── Base palette (new tokens) ── */
        ivory:    '#FAF6F3',
        surface:  '#FCF8F5',
        blush:    '#F3DDD1',
        lavender: '#C7D8DD',
        peach:    '#F7D7C5',
        sage: {
          DEFAULT: '#DCE7EA',
          deep:    '#5E828E',
        },
        lilac:  '#C7D8DD',
        coral:  '#F58468',
        plum:   '#5E828E',
        terra:  '#C57E66',

        /* ── Legacy aliases (updated to new values) ── */
        cream:  '#FAF6F3',
        beige:  '#FAF6F3',
        sand:   '#F6ECE8',

        rose: {
          DEFAULT: '#F45A34',
          deep:    '#F45A34',
          ink:     '#F45A34',
          light:   '#F5C0A0',
          lighter: '#F3DDD1',
        },

        warm: {
          dark:  '#1E1820',
          mid:   '#4A3F45',
          light: '#7A6E73',
        },

        ash: {
          DEFAULT: '#A99CA1',
          light:   '#C4BAB8',
          dark:    '#7A6E73',
        },
      },

      fontFamily: {
        cormorant: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        mulish:    ['Mulish', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        inter:     ['Mulish', '-apple-system', 'sans-serif'],
      },

      borderRadius: {
        'clay-sm': '18px',
        'clay':    '28px',
        'clay-lg': '36px',
        'clay-xl': '46px',
        'pill':    '999px',
      },

      boxShadow: {
        'clay':       '-10px -10px 24px rgba(255,255,255,.85), 14px 16px 36px rgba(180,140,120,.30)',
        'clay-sm':    '-6px -6px 14px rgba(255,255,255,.80), 8px 10px 22px rgba(180,140,120,.24)',
        'clay-hover': '-12px -12px 28px rgba(255,255,255,.9), 20px 24px 50px rgba(180,140,120,.38)',
        'clay-inset': 'inset -5px -5px 12px rgba(255,255,255,.7), inset 6px 6px 14px rgba(180,140,120,.22)',
        'float':      '0 30px 60px -24px rgba(150,120,100,.40)',
      },
    },
  },
  plugins: [],
}
