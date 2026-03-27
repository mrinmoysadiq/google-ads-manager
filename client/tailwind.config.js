/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#1b1b1b',
          surface: '#242424',
          border: 'rgba(255,255,255,0.08)',
          text: '#c5c1b9',
          muted: '#8a8680',
          accent: '#575ECF',
          'accent-hover': '#6B72D8',
        }
      }
    },
  },
  plugins: [],
}
