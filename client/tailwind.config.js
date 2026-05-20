/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#FAF7F4',
        beige: '#F2EBE3',
        sand: '#E8DDD0',
        rose: { DEFAULT: '#C4856A', light: '#F0D5C8', lighter: '#FFF8F5' },
        warm: { dark: '#3D3530', mid: '#7A6E68', light: '#A89E98' },
      },
      fontFamily: {
        cormorant: ['Cormorant Garamond', 'serif'],
        inter: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
