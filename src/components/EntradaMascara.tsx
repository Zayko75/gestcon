import { useLayoutEffect, useRef, type InputHTMLAttributes } from 'react'

/** Caracteres que escribe el usuario; el resto (puntos, guiones, barras) los pone la máscara */
const SIGNIFICATIVO = /[0-9A-Za-z]/

const contar = (s: string) => [...s].filter((c) => SIGNIFICATIVO.test(c)).length

/** Posición en el texto con formato después de n caracteres significativos */
function posicionTras(s: string, n: number): number {
  if (n === 0) return 0
  let vistos = 0
  for (let i = 0; i < s.length; i++) if (SIGNIFICATIVO.test(s[i]) && ++vistos === n) return i + 1
  return s.length
}

/**
 * Campo con máscara: da formato mientras se escribe (por ejemplo 12.345.678-Z o 2026/1301/3411/22608)
 * sin que el cursor salte al final, y el borrado salta por encima de los separadores.
 */
export function EntradaMascara({ valor, onCambio, formatear, ...resto }: {
  valor: string; onCambio: (v: string) => void; formatear: (v: string) => string
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const ref = useRef<HTMLInputElement>(null)
  const cursor = useRef<number | null>(null)

  useLayoutEffect(() => {
    if (cursor.current !== null && ref.current && document.activeElement === ref.current) {
      ref.current.setSelectionRange(cursor.current, cursor.current)
    }
    cursor.current = null
  })

  return (
    <input
      {...resto}
      ref={ref}
      value={valor}
      onChange={(e) => {
        const el = e.target
        const pos = el.selectionStart ?? el.value.length
        const alFinal = pos === el.value.length
        const nuevo = formatear(el.value)
        cursor.current = alFinal ? nuevo.length : posicionTras(nuevo, contar(el.value.slice(0, pos)))
        onCambio(nuevo)
      }}
      onKeyDown={(e) => {
        const el = e.currentTarget
        const a = el.selectionStart ?? 0
        if (a !== el.selectionEnd) return
        // Borrar justo detrás de un separador borra la cifra anterior, no el separador
        if (e.key === 'Backspace' && a > 0 && !SIGNIFICATIVO.test(el.value[a - 1])) el.setSelectionRange(a - 1, a - 1)
        if (e.key === 'Delete' && a < el.value.length && !SIGNIFICATIVO.test(el.value[a])) el.setSelectionRange(a + 1, a + 1)
        resto.onKeyDown?.(e)
      }}
    />
  )
}
