import type { Estado } from '../types'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

// ---------- Avisos temporales ----------
interface Aviso { id: number; texto: string; tipo: 'ok' | 'error' | 'aviso' }
const ToastCtx = createContext<(texto: string, tipo?: Aviso['tipo']) => void>(() => {})
export const useAviso = () => useContext(ToastCtx)

export function AvisosProvider({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const n = useRef(0)
  const mostrar = useCallback((texto: string, tipo: Aviso['tipo'] = 'ok') => {
    const id = ++n.current
    setAvisos((a) => [...a, { id, texto, tipo }])
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), tipo === 'error' ? 9000 : 4500)
  }, [])
  return (
    <ToastCtx.Provider value={mostrar}>
      {children}
      <div className="fixed bottom-4 left-4 right-4 z-50 flex flex-col items-end gap-2 sm:left-auto sm:max-w-sm" aria-live="polite">
        {avisos.map((a) => (
          <div key={a.id} role="status"
            className="flex w-full items-start gap-3 rounded-xl bg-noche px-4 py-3 text-[0.9rem] leading-snug text-white shadow-[0_12px_32px_-12px_rgba(22,27,69,.6)]">
            <span aria-hidden="true" className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${a.tipo === 'error' ? 'bg-[#ff8a80]' : a.tipo === 'aviso' ? 'bg-[#ffc266]' : 'bg-[#6fd3a2]'}`} />
            <span>{a.texto}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

// ---------- Diálogo ----------
export function Dialogo({ titulo, children, acciones, onCerrar }: { titulo: string; children: ReactNode; acciones: ReactNode; onCerrar?: () => void }) {
  useEffect(() => {
    if (!onCerrar) return
    const f = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [onCerrar])
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-noche/50 p-4 backdrop-blur-[2px] sm:items-center" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-[0_24px_64px_-24px_rgba(22,27,69,.55)]">
        <h2 className="font-display text-[1.6rem] font-semibold leading-tight">{titulo}</h2>
        <div className="mt-3 space-y-2 text-[0.95rem] leading-relaxed text-tinta/80">{children}</div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">{acciones}</div>
      </div>
    </div>
  )
}

// ---------- Estado del expediente ----------
export const ESTADOS: { valor: Estado; texto: string }[] = [
  { valor: 'preparacion', texto: 'En preparación' },
  { valor: 'pendiente_firma', texto: 'Pendiente de firma' },
  { valor: 'firmado', texto: 'Firmado' },
  { valor: 'pendiente_factura', texto: 'Pendiente de factura' },
  { valor: 'tramitado', texto: 'Tramitado' },
  { valor: 'pagado', texto: 'Pagado' },
]
export const textoEstado = (e: Estado) => ESTADOS.find((x) => x.valor === e)?.texto ?? e

const COLOR_ESTADO: Record<Estado, string> = {
  preparacion: 'bg-aviso/10 text-aviso [--punto:theme(colors.aviso)]',
  pendiente_firma: 'bg-indigo-claro text-indigo [--punto:theme(colors.indigo.DEFAULT)]',
  firmado: 'bg-[#e3f1f6] text-[#0f6283] [--punto:#0f6283]',
  pendiente_factura: 'bg-[#f8e6f0] text-[#8c2a66] [--punto:#a3367a]',
  tramitado: 'bg-ok/10 text-ok [--punto:theme(colors.ok)]',
  pagado: 'bg-[#eceef2] text-[#3d4455] [--punto:#5b6478]',
}

/** Colores de cada estado para marcas de color (calendario, eventos) */
export const TONO_ESTADO: Record<Estado, { barra: string; fondo: string; texto: string }> = {
  preparacion: { barra: '#a85f00', fondo: '#fbefdf', texto: '#6f4000' },
  pendiente_firma: { barra: '#2c3487', fondo: '#e7e9f6', texto: '#1f2566' },
  firmado: { barra: '#0f6283', fondo: '#e0f0f6', texto: '#0b4a63' },
  pendiente_factura: { barra: '#a3367a', fondo: '#f8e6f0', texto: '#7a2259' },
  tramitado: { barra: '#1e7a52', fondo: '#e0f1e8', texto: '#145a3b' },
  pagado: { barra: '#5b6478', fondo: '#eceef2', texto: '#3d4455' },
}

export function EstadoChip({ estado }: { estado: Estado }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[0.8rem] font-semibold leading-none ${COLOR_ESTADO[estado]}`}>
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--punto)]" />
      {textoEstado(estado)}
    </span>
  )
}

// ---------- Dorsal (nº de contrato) ----------
const TAMANOS = {
  sm: 'h-[2.6rem] w-[3.4rem] pt-1 text-[1.35rem]',
  lg: 'h-[5.2rem] w-[6.6rem] pt-2 text-[2.9rem]',
}
export function Dorsal({ numero, tamano = 'sm' }: { numero: number | null; tamano?: keyof typeof TAMANOS }) {
  if (numero === null) {
    return (
      <span className={`dorsal dorsal-vacio ${TAMANOS[tamano]}`} title="Sin nº de contrato">
        <span className={tamano === 'lg' ? 'text-[1.1rem] font-semibold' : 'text-[0.8rem] font-semibold'}>s/n</span>
      </span>
    )
  }
  return (
    <span className={`dorsal ${TAMANOS[tamano]}`} aria-label={`Contrato ${numero}`}>
      {String(numero).padStart(3, '0')}
    </span>
  )
}
