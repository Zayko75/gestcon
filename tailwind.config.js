/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        tinta: '#17203d',
        indigo: { DEFAULT: '#2c3487', oscuro: '#1f2566', claro: '#e7e9f6' },
        noche: '#161b45',
        papel: '#eef0f5',
        linea: '#d6dae6',
        ok: '#1e7a52',
        aviso: '#a85f00',
        error: '#b4322b',
      },
      fontFamily: {
        sans: ['Barlow', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
        display: ['"Barlow Condensed"', 'Barlow', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
