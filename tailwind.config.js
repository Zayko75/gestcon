/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        tinta: '#1b1f3b',
        indigo: { DEFAULT: '#33378f', oscuro: '#272a73', claro: '#e8eaf8' },
        papel: '#f5f6fa',
        linea: '#d9dcea',
        ok: '#2b7a57',
        aviso: '#a8650d',
        error: '#b3312b',
      },
      fontFamily: {
        sans: ['"Segoe UI"', 'system-ui', '-apple-system', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
