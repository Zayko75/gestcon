import type { Estado } from '../types'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

// ---------- Avisos temporales ----------
interface Aviso { id: number; texto: string; tipo: 'ok' | 'error' | 'aviso' }
const ToastCtx = createContext<(texto: string, tipo?: Aviso['tipo']) => void>(() => {})
export const useAviso = () => useContext(ToastCtx)

export function AvisosProvider({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const n = useRef(0)
  const cerrar = useCallback((id: number) => setAvisos((a) => a.filter((x) => x.id !== id)), [])
  const mostrar = useCallback((texto: string, tipo: Aviso['tipo'] = 'ok') => {
    const id = ++n.current
    setAvisos((a) => [...a, { id, texto, tipo }])
    // Los errores se quedan hasta que se cierran: así no pasan desapercibidos
    if (tipo !== 'error') setTimeout(() => cerrar(id), tipo === 'aviso' ? 7000 : 4500)
  }, [cerrar])
  return (
    <ToastCtx.Provider value={mostrar}>
      {children}
      <div className="no-imprimir fixed bottom-4 left-4 right-4 z-50 flex flex-col items-end gap-2 sm:left-auto sm:max-w-sm" aria-live="polite">
        {avisos.map((a) => (
          <div key={a.id} role={a.tipo === 'error' ? 'alert' : 'status'}
            className={`flex w-full animate-entrar items-start gap-3 rounded-xl bg-noche py-3 pl-4 pr-2 text-[0.9rem] leading-snug text-white shadow-[0_12px_32px_-12px_rgba(22,27,69,.6)] ${a.tipo === 'error' ? 'ring-2 ring-[#ff8a80]/70' : ''}`}>
            <span aria-hidden="true" className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${a.tipo === 'error' ? 'bg-[#ff8a80]' : a.tipo === 'aviso' ? 'bg-[#ffc266]' : 'bg-[#6fd3a2]'}`} />
            <span className="min-w-0 flex-1">{a.texto}</span>
            <button type="button" onClick={() => cerrar(a.id)} aria-label="Cerrar aviso"
              className="-my-1 grid size-7 shrink-0 place-items-center rounded-md text-white/55 transition-colors hover:bg-white/10 hover:text-white">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

// ---------- Incidencias sin subsanar ----------
/**
 * Señal de incidencias sin subsanar (Pendientes y Eventos): una banderita que ondea dentro de una
 * etiqueta roja con una onda que se expande. No cesa hasta que se subsanan todas (decisión de Bienve, 16/11/2026).
 * Con «reducir movimiento» queda quieta, pero se sigue viendo.
 */
export function SenalIncidencias({ n }: { n: number }) {
  if (n <= 0) return null
  const texto = n === 1 ? '1 incidencia' : `${n} incidencias`
  return (
    <span className="relative inline-flex shrink-0" title={`${texto} sin subsanar en la tramitación`}>
      <span aria-hidden="true" className="absolute inset-0 animate-onda rounded-full bg-error" />
      <span className="relative inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-error py-1 pl-2 pr-2.5 text-[0.78rem] font-bold leading-none text-white shadow-[0_2px_8px_-2px_rgba(180,50,43,.6)]">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
          className="origin-[20%_90%] animate-ondear"><path d="M5 21V4" /><path d="M5 4h12l-2 4 2 4H5" fill="currentColor" /></svg>
        {texto}<span className="sr-only"> sin subsanar</span>
      </span>
    </span>
  )
}

/** Franja roja que late en el borde izquierdo de la fila de un patrocinio con incidencias sin subsanar */
export const FranjaIncidencias = ({ n }: { n: number }) =>
  n > 0 ? <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 animate-latido bg-error" /> : null

// ---------- Indicador de trabajo ----------
/** Pequeño círculo que gira dentro de un botón mientras dura su acción (generar, crear copia…) */
export function Girando() {
  return (
    <svg className="size-[0.95em] shrink-0 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
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
    <div className="fixed inset-0 z-40 flex animate-fundido items-end justify-center bg-noche/50 p-4 backdrop-blur-[2px] sm:items-center" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="w-full max-w-md animate-aparecer rounded-2xl bg-white p-6 shadow-[0_24px_64px_-24px_rgba(22,27,69,.55)]">
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

// ---------- Recorrido del expediente ----------
/** Medio tramo de la pista entre dos puntos; el relleno se desliza con un pequeño retraso según su posición */
function Tramo({ lleno, lado, orden }: { lleno: boolean; lado: 'izq' | 'der'; orden: number }) {
  return (
    <span aria-hidden="true" className={`absolute top-[0.95rem] h-[3px] -translate-y-1/2 overflow-hidden bg-linea ${lado === 'izq' ? 'left-0 right-1/2' : 'left-1/2 right-0'}`}>
      <span className={`block h-full origin-left bg-indigo transition-transform duration-200 ease-out ${lleno ? 'scale-x-100' : 'scale-x-0'}`}
        style={{ transitionDelay: lleno ? `${orden * 35}ms` : '0ms' }} />
    </span>
  )
}

/** Las 6 etapas del expediente como los puntos de control de una carrera: las cumplidas, la actual y las que faltan */
export function RecorridoEstado({ estado, onCambiar, deshabilitado = false, etiquetaId }: { estado: Estado; onCambiar: (e: Estado) => void; deshabilitado?: boolean; etiquetaId: string }) {
  const actual = ESTADOS.findIndex((e) => e.valor === estado)
  const tono = TONO_ESTADO[estado]
  return (
    <>
    <ol role="group" aria-labelledby={etiquetaId} className="grid grid-cols-6">
      {ESTADOS.map((e, k) => {
        const hecho = k < actual, esActual = k === actual
        return (
          <li key={e.valor} className="relative flex justify-center">
            {/* Tramos de la pista: a la izquierda y a la derecha de cada punto */}
            {/* La pista se rellena de izquierda a derecha, tramo a tramo, al avanzar el expediente */}
            {k > 0 && <Tramo lleno={k <= actual} lado="izq" orden={2 * k - 1} />}
            {k < ESTADOS.length - 1 && <Tramo lleno={k < actual} lado="der" orden={2 * k} />}
            <button type="button" aria-pressed={esActual} disabled={deshabilitado} onClick={() => onCambiar(e.valor)}
              className="group relative z-10 flex flex-col items-center gap-1.5 rounded-lg px-0.5 pb-1 text-center disabled:cursor-default">
              <span aria-hidden="true" key={esActual ? 'actual' : hecho ? 'hecho' : 'falta'}
                style={esActual ? { backgroundColor: tono.barra, borderColor: tono.barra, boxShadow: `0 0 0 4px ${tono.fondo}` } : undefined}
                className={`grid size-[1.9rem] place-items-center rounded-full border-2 font-display text-[0.95rem] font-bold leading-none transition-[background-color,border-color,box-shadow,transform] duration-200 group-enabled:group-hover:-translate-y-0.5
                  ${hecho ? 'border-indigo bg-indigo text-white' : esActual ? 'animate-marca text-white' : 'border-linea bg-white text-tinta/40 group-enabled:group-hover:border-indigo/50 group-enabled:group-hover:text-indigo'}`}>
                {hecho
                  ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
                  : k + 1}
              </span>
              <span className={`max-w-[7.5rem] text-[0.8rem] leading-tight max-sm:sr-only ${esActual ? 'font-semibold text-tinta' : hecho ? 'text-tinta/65' : 'text-tinta/45'}`}>
                {e.texto}
                {hecho && <span className="sr-only"> (cumplido)</span>}
              </span>
            </button>
          </li>
        )
      })}
    </ol>
    {/* En el móvil no caben los nombres bajo cada punto: se muestra solo el de la etapa actual */}
    <p aria-hidden="true" className="mt-1 text-center text-[0.88rem] font-semibold sm:hidden" style={{ color: tono.texto }}>
      {actual + 1}. {textoEstado(estado)}
    </p>
    </>
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
