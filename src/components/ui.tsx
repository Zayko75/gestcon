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
      <div className="fixed bottom-4 right-4 z-50 flex max-w-sm flex-col gap-2" aria-live="polite">
        {avisos.map((a) => (
          <div key={a.id} role="status"
            className={`rounded-md border px-4 py-3 text-sm shadow-lg ${a.tipo === 'error' ? 'border-error/40 bg-white text-error' : a.tipo === 'aviso' ? 'border-aviso/40 bg-white text-aviso' : 'border-ok/40 bg-white text-tinta'}`}>
            {a.texto}
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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-tinta/40 p-4" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold">{titulo}</h2>
        <div className="mt-2 space-y-2 text-sm text-tinta/80">{children}</div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">{acciones}</div>
      </div>
    </div>
  )
}

// ---------- Etiqueta de estado ----------
export function EstadoChip({ tramitado }: { tramitado: boolean }) {
  return tramitado ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-ok/10 px-2.5 py-0.5 text-xs font-medium text-ok">
      <span className="h-1.5 w-1.5 rounded-full bg-ok" /> Tramitado
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-aviso/10 px-2.5 py-0.5 text-xs font-medium text-aviso">
      <span className="h-1.5 w-1.5 rounded-full bg-aviso" /> Pendiente
    </span>
  )
}
