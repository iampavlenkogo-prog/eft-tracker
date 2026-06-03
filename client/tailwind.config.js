/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#FFF4EC',
        beige: '#F5F5DC',
        sand: '#C8D0B8',
        rose: { DEFAULT: '#EB4600', light: '#F5956A', lighter: '#FDE8DC' },
        warm: { dark: '#2A1A08', mid: '#5A3A20', light: '#8A7060' },
        ash:  { DEFAULT: '#A2C2BE', light: '#C8D8D5', dark: '#7AADA8' },
      },
      fontFamily: {
        cormorant: ['Cormorant Garamond', 'serif'],
        inter: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
