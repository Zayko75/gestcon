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

// ---------- Etiqueta de estado ----------
export function EstadoChip({ tramitado }: { tramitado: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[0.8rem] font-semibold leading-none ${tramitado ? 'bg-ok/10 text-ok' : 'bg-aviso/10 text-aviso'}`}>
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${tramitado ? 'bg-ok' : 'bg-aviso'}`} />
      {tramitado ? 'Tramitado' : 'Pendiente'}
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
