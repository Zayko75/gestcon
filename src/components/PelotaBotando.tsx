/**
 * Pelota de baloncesto que cruza por encima de un título botando sobre él (pantalla de carga, «Abriendo los
 * datos…»). Indicador de trabajo: dura lo que dura la carga. Solo SVG y CSS, sin librerías.
 * Capas: «cruzar» la lleva de izquierda a derecha, «botar» la sube y la baja (4 botes por pasada),
 * «aplastar» la achata al tocar el título y «spin» la hace girar. Con «reducir movimiento» queda quieta.
 */
export function PelotaBotando() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-[calc(100%-0.35em)] h-16">
      <div className="h-full w-full animate-cruzar">
        <div className="absolute bottom-0 left-0 -ml-3.5 size-7">
          <div className="size-full animate-botar">
            <div className="size-full origin-bottom animate-aplastar">
              <svg viewBox="0 0 24 24" className="size-full animate-[spin_900ms_linear_infinite] drop-shadow-[0_2px_2px_rgba(23,32,61,.25)]">
                <circle cx="12" cy="12" r="11" fill="#e8792b" stroke="#7a3510" strokeWidth="1.2" />
                <g fill="none" stroke="#7a3510" strokeWidth="1.1" strokeLinecap="round">
                  <path d="M12 1v22M1 12h22" />
                  <path d="M4.2 4.2c3.6 3.4 3.6 12.2 0 15.6M19.8 4.2c-3.6 3.4-3.6 12.2 0 15.6" />
                </g>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
