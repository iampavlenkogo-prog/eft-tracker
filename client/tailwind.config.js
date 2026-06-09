/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        /* ── Base palette (new tokens) ── */
        ivory:    '#FAF6F3',
        surface:  '#FCF8F5',
        blush:    '#F5E4E4',
        lavender: '#DDD4F0',
        peach:    '#F7D7C5',
        sage: {
          DEFAULT: '#DDE7DD',
          deep:    '#6E8A72',
        },
        lilac:  '#D7CCF3',
        coral:  '#F5C8BD',
        plum:   '#6E5A86',
        terra:  '#C57E66',

        /* ── Legacy aliases (updated to new values) ── */
        cream:  '#FAF6F3',
        beige:  '#FAF6F3',
        sand:   '#F6ECE8',

        rose: {
          DEFAULT: '#B06B7E',
          deep:    '#B06B7E',
          ink:     '#8E4F62',
          light:   '#EBCACA',
          lighter: '#F5E4E4',
        },

        warm: {
          dark:  '#4A3F45',
          mid:   '#7A6E73',
          light: '#A99CA1',
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
        'clay':       '-10px -10px 24px rgba(255,255,255,.85), 14px 16px 36px rgba(190,150,155,.30)',
        'clay-sm':    '-6px -6px 14px rgba(255,255,255,.80), 8px 10px 22px rgba(190,150,155,.24)',
        'clay-hover': '-12px -12px 28px rgba(255,255,255,.9), 20px 24px 50px rgba(190,150,155,.38)',
        'clay-inset': 'inset -5px -5px 12px rgba(255,255,255,.7), inset 6px 6px 14px rgba(190,150,155,.22)',
        'float':      '0 30px 60px -24px rgba(150,110,120,.40)',
      },
    },
  },
  plugins: [],
}
