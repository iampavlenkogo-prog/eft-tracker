/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#FAF9F6',
        beige: '#F2F0EA',
        sand: '#E5DAD9',
        rose: { DEFAULT: '#D79A95', light: '#E8D0CE', lighter: '#F8EDEC' },
        warm: { dark: '#262E1B', mid: '#3E4437', light: '#6B7A57' },
      },
      fontFamily: {
        cormorant: ['Cormorant Garamond', 'serif'],
        inter: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
