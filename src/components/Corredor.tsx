/**
 * Silueta de un atleta corriendo sobre una pista que avanza: se muestra en la cabecera de entrada mientras
 * se cargan los datos (indicador de trabajo: dura lo que dura la carga). Solo SVG y CSS, sin librerías.
 * Las piernas y los brazos giran en la cadera, la rodilla y el hombro; el cuerpo sube y baja a cada zancada.
 * Con «reducir movimiento» queda quieto (de pie sobre la pista).
 */
const ZANCADA = '720ms' // una zancada completa (las dos piernas)
const MEDIA = '-360ms' // la otra pierna y el otro brazo van media zancada desfasados

/** Pierna: muslo que gira en la cadera y espinilla que gira en la rodilla */
function Pierna({ desfase, atras = false }: { desfase?: string; atras?: boolean }) {
  return (
    <g className="animate-zancada" style={{ transformOrigin: '47px 50px', animationDelay: desfase }} opacity={atras ? 0.55 : 1}>
      <line x1="47" y1="50" x2="47" y2="69" />
      <g className="animate-rodilla" style={{ transformOrigin: '47px 69px', animationDelay: desfase }}>
        <line x1="47" y1="69" x2="47" y2="87" />
        <line x1="47" y1="87" x2="53" y2="87" strokeWidth="5" />
      </g>
    </g>
  )
}

/** Brazo: gira en el hombro, con el codo doblado */
function Brazo({ desfase, atras = false }: { desfase?: string; atras?: boolean }) {
  return (
    <g className="animate-braceo" style={{ transformOrigin: '54px 29px', animationDelay: desfase }} opacity={atras ? 0.55 : 1}>
      <line x1="54" y1="29" x2="54" y2="45" />
      <line x1="54" y1="45" x2="65" y2="39" />
    </g>
  )
}

export function Corredor({ className = '' }: { className?: string }) {
  return (
    <div className={`relative w-[9.5rem] select-none ${className}`} aria-hidden="true" style={{ ['--zancada' as string]: ZANCADA }}>
      <svg viewBox="0 0 100 100" className="relative z-10 h-auto w-full overflow-visible text-white">
        {/* Sombra en el suelo: se estrecha cuando el cuerpo sube */}
        <ellipse cx="50" cy="94" rx="15" ry="2.2" className="animate-sombra fill-black/30" style={{ transformOrigin: '50px 94px' }} />
        <g className="animate-trote" stroke="currentColor" strokeWidth="7.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
          {/* Lo que queda detrás del cuerpo, más tenue */}
          <Pierna desfase={MEDIA} atras />
          <Brazo atras />
          {/* Tronco, inclinado hacia delante, y cabeza */}
          <line x1="55" y1="27" x2="47" y2="50" strokeWidth="9" />
          <circle cx="60" cy="15" r="7" fill="currentColor" stroke="none" />
          <Pierna />
          <Brazo desfase={MEDIA} />
        </g>
      </svg>
      {/* Pista: las líneas de calle pasan hacia atrás */}
      <div className="relative -mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="absolute inset-y-0 -left-8 right-0 animate-pista bg-[repeating-linear-gradient(90deg,rgba(255,255,255,.55)_0_14px,transparent_14px_32px)]" />
      </div>
    </div>
  )
}
