/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#F1F7F7',
        beige: '#EBF5F3',
        sand: '#D5E6E5',
        rose: { DEFAULT: '#F7CBCA', light: '#FBECE9', lighter: '#FEF7F6' },
        warm: { dark: '#2D4848', mid: '#4A6565', light: '#8AA5A5' },
        mint: { DEFAULT: '#6BC1B6', light: '#A8DDD9', dark: '#4DABA0' },
      },
      fontFamily: {
        cormorant: ['Cormorant Garamond', 'serif'],
        inter: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
