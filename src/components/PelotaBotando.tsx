import { createPortal } from 'react-dom'

// Pelota de baloncesto botando: el indicador de espera de toda la aplicación (decisión de Bienve, 16/11/2026).
// Dura lo que dura la espera. Solo SVG y CSS, sin librerías. Con «reducir movimiento» queda quieta.
//  - PelotaBotando: cruza por encima de un título dando cuatro botes (carga de datos, pantallas de espera).
//  - Pelotita: la misma pelota, pequeña y botando en el sitio, dentro de botones y textos de estado.
//  - PantallaEspera: capa sobre la aplicación con un título y la pelota cruzándolo (esperas largas).

/** La pelota, girando sobre sí misma */
function Balon() {
  return (
    <svg viewBox="0 0 24 24" className="block size-full animate-[spin_900ms_linear_infinite] drop-shadow-[0_2px_2px_rgba(23,32,61,.25)]">
      <circle cx="12" cy="12" r="11" fill="#e8792b" stroke="#7a3510" strokeWidth="1.2" />
      <g fill="none" stroke="#7a3510" strokeWidth="1.1" strokeLinecap="round">
        <path d="M12 1v22M1 12h22" />
        <path d="M4.2 4.2c3.6 3.4 3.6 12.2 0 15.6M19.8 4.2c-3.6 3.4-3.6 12.2 0 15.6" />
      </g>
    </svg>
  )
}

/**
 * Cruza por encima del elemento que la contiene (con `relative`) de izquierda a derecha, dando cuatro botes
 * sobre él. Capas: «cruzar» la lleva de lado a lado, «botar» la sube y la baja y «aplastar» la achata al tocar.
 */
export function PelotaBotando() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-[calc(100%-0.35em)] h-16">
      <div className="h-full w-full animate-cruzar">
        <div className="absolute bottom-0 left-0 -ml-3.5 size-7">
          <div className="size-full animate-botar">
            <div className="size-full origin-bottom animate-aplastar"><Balon /></div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Pelota pequeña botando en el sitio, del tamaño del texto que la acompaña («Guardando…», «Generando…») */
export function Pelotita() {
  return (
    <span aria-hidden="true" className="inline-flex h-[1.3em] w-[0.95em] shrink-0 items-end">
      <span className="block size-[0.85em] animate-botecito">
        <span className="block size-full origin-bottom animate-aplastar"><Balon /></span>
      </span>
    </span>
  )
}

/** Espera larga (restaurar, eliminar, crear…): tapa la aplicación con un título y la pelota cruzándolo */
export function PantallaEspera({ titulo, detalle }: { titulo: string; detalle?: string }) {
  return createPortal(
    <div role="status" aria-live="polite" className="no-imprimir fixed inset-0 z-[60] grid animate-fundido place-items-center bg-papel/85 px-6 backdrop-blur-[2px]">
      <div className="text-center">
        <div className="relative mx-auto mt-16 w-fit">
          <PelotaBotando />
          <p className="titulo">{titulo}</p>
        </div>
        {detalle && <p className="mt-3 text-tinta/65">{detalle}</p>}
      </div>
    </div>,
    document.body,
  )
}
