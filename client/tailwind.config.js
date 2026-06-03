/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#FFF4EC',
        beige: '#FFF4EC',
        sand: '#EBDDD0',
        rose: { DEFAULT: '#C07888', light: '#EAD0D8', lighter: '#FDF0F3' },
        warm: { dark: '#2A1A08', mid: '#5A3A20', light: '#8A7060' },
        ash:  { DEFAULT: '#B8A8A4', light: '#D5C8C5', dark: '#9A8A88' },
      },
      fontFamily: {
        cormorant: ['Cormorant Garamond', 'serif'],
        inter: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
