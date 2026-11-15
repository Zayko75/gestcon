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
      keyframes: {
        // Confirmación de guardado: la marca aparece con un pequeño rebote
        marca: { '0%': { transform: 'scale(.4)', opacity: '0' }, '60%': { transform: 'scale(1.15)', opacity: '1' }, '100%': { transform: 'scale(1)' } },
        // Avisos: entran desde abajo
        entrar: { from: { transform: 'translateY(10px)', opacity: '0' }, to: { transform: 'none', opacity: '1' } },
        // Diálogos: aparecen con un leve acercamiento
        aparecer: { from: { transform: 'translateY(6px) scale(.98)', opacity: '0' }, to: { transform: 'none', opacity: '1' } },
        fundido: { from: { opacity: '0' }, to: { opacity: '1' } },
        // Paneles que se despliegan (más filtros)
        desplegar: { from: { transform: 'translateY(-6px)', opacity: '0' }, to: { transform: 'none', opacity: '1' } },
        // Filas del listado al abrir la pantalla
        fila: { from: { transform: 'translateY(6px)', opacity: '0' }, to: { transform: 'none', opacity: '1' } },
      },
      animation: {
        marca: 'marca 320ms cubic-bezier(.3,.7,.4,1) both',
        entrar: 'entrar 180ms ease-out both',
        aparecer: 'aparecer 200ms cubic-bezier(.2,.8,.3,1) both',
        fundido: 'fundido 160ms ease-out both',
        desplegar: 'desplegar 180ms ease-out both',
        fila: 'fila 260ms cubic-bezier(.2,.8,.3,1) both',
      },
    },
  },
  plugins: [],
}
