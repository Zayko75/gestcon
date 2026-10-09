import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { claveSoporte, nuevoSoporte, soportesDeTexto, textoDeSoportes, type Soporte } from '../lib/textos'

/** Soporte usado antes, con las veces que aparece en esta lista y en la otra */
export interface Sugerencia { texto: string; aqui: number; otra: number }

const MAX_SUGERENCIAS = 7

/** ¿Cada palabra escrita es el principio de alguna palabra del soporte? */
function encaja(escrito: string, soporte: string): boolean {
  const palabras = soporte.split(' ')
  return escrito.split(' ').filter(Boolean).every((t) => palabras.some((p) => p.startsWith(t)))
}

const Icono = ({ d }: { d: string }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
)

/**
 * Lista de soportes: se escribe uno y se pulsa Intro. Mientras se escribe, se proponen los soportes usados
 * en otros patrocinios. El texto se guarda con el formato de siempre («- Soporte.» por línea).
 */
export function ListaSoportes({ id, etiqueta, valor, onCambio, sugerencias, className = '' }: {
  className?: string; id: string; etiqueta: string; valor: string; onCambio: (texto: string) => void; sugerencias: Sugerencia[]
}) {
  const lista = useMemo(() => soportesDeTexto(valor), [valor])
  const [escrito, setEscrito] = useState('')
  const [abierta, setAbierta] = useState(false)
  const [activa, setActiva] = useState(0)
  const [editando, setEditando] = useState<{ i: number; texto: string } | null>(null)
  const [nota, setNota] = useState('')
  const entrada = useRef<HTMLInputElement>(null)
  const uid = useId()
  const idLista = `${uid}-opciones`

  const enLista = useMemo(() => new Set(lista.map((x) => claveSoporte(x.texto))), [lista])

  // Opciones: escribir uno nuevo (si no existe ya) y los usados antes que encajan con lo escrito
  const opcionesPara = (texto: string): { tipo: 'nuevo' | 'usado' | 'yaEsta'; texto: string }[] => {
    const k = claveSoporte(texto)
    if (!k) return []
    const propuestas = sugerencias
      .filter((s) => !enLista.has(claveSoporte(s.texto)) && encaja(k, claveSoporte(s.texto)))
      .sort((a, b) => Number(claveSoporte(b.texto) === k) - Number(claveSoporte(a.texto) === k)) // la exacta, primero
      .slice(0, MAX_SUGERENCIAS)
      .map((s) => ({ tipo: 'usado' as const, texto: s.texto }))
    const repetido = lista.find((x) => claveSoporte(x.texto) === k)
    if (repetido) return [{ tipo: 'yaEsta', texto: repetido.texto }, ...propuestas]
    const exacta = propuestas.some((s) => claveSoporte(s.texto) === k)
    return [...(exacta ? [] : [{ tipo: 'nuevo' as const, texto: texto.trim() }]), ...propuestas]
  }
  const opciones = opcionesPara(escrito)

  /** Por defecto se marca la primera sugerencia (Intro la añade); si no hay ninguna, escribir uno nuevo */
  const porDefecto = (texto: string) => Math.max(0, opcionesPara(texto).findIndex((o) => o.tipo !== 'nuevo'))

  const guardar = (nueva: Soporte[]) => onCambio(textoDeSoportes(nueva))

  const anadir = (textos: string[]) => {
    const vistos = new Set(enLista)
    const nuevos: Soporte[] = []
    let repetidos = 0
    for (const t of textos) {
      const s = nuevoSoporte(t)
      if (!s.texto) continue
      if (vistos.has(claveSoporte(s.texto))) { repetidos++; continue }
      vistos.add(claveSoporte(s.texto))
      nuevos.push(s)
    }
    if (nuevos.length) guardar([...lista, ...nuevos])
    setNota(repetidos ? (repetidos === 1 && !nuevos.length ? 'Ese soporte ya está en la lista.' : 'Los repetidos no se han añadido.') : nuevos.length ? `Añadido: ${nuevos.map((x) => x.texto).join('; ')}.` : '')
    setEscrito('')
    setAbierta(false)
  }

  const quitar = (i: number) => {
    const quitado = lista[i]
    guardar(lista.filter((_, j) => j !== i))
    setNota(`Quitado: ${quitado.texto}.`)
    entrada.current?.focus()
  }
  const mover = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= lista.length) return
    const nueva = [...lista];
    [nueva[i], nueva[j]] = [nueva[j], nueva[i]]
    guardar(nueva)
    // El foco sigue al soporte que se ha movido
    requestAnimationFrame(() => document.getElementById(`${uid}-${j}-${d < 0 ? 'subir' : 'bajar'}`)?.focus())
  }
  const terminarEdicion = (confirmar: boolean) => {
    if (!editando) return
    const { i, texto } = editando
    setEditando(null)
    if (!confirmar || claveSoporte(texto) === claveSoporte(lista[i].texto) && texto.trim() === lista[i].texto) return
    if (!texto.trim()) { quitar(i); return }
    guardar(lista.map((x, j) => (j === i ? nuevoSoporte(texto) : x)))
  }

  const teclas = (e: KeyboardEvent<HTMLInputElement>) => {
    const visibles = abierta && opciones.length > 0
    if (e.key === 'ArrowDown' && opciones.length) {
      e.preventDefault()
      if (!abierta) { setAbierta(true); return }
      setActiva((a) => (a + 1) % opciones.length)
    } else if (e.key === 'ArrowUp' && visibles) {
      e.preventDefault()
      setActiva((a) => (a - 1 + opciones.length) % opciones.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (visibles) anadir([opciones[activa].texto])
      else if (escrito.trim()) anadir([escrito])
    } else if (e.key === 'Escape' && visibles) {
      e.preventDefault()
      setAbierta(false)
    }
  }

  const visibles = abierta && opciones.length > 0

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="etiqueta">{etiqueta}</label>
        <span className="mb-1.5 whitespace-nowrap text-[0.8rem] text-tinta/50">{lista.length === 0 ? 'Ninguno' : lista.length === 1 ? '1 soporte' : `${lista.length} soportes`}</span>
      </div>

      <div className="rounded-lg border border-linea bg-white transition-colors focus-within:border-indigo focus-within:ring-[3px] focus-within:ring-indigo/15 hover:border-tinta/25">
        {lista.length > 0 && (
          <ol className="divide-y divide-linea/70 border-b border-linea" aria-label={etiqueta}>
            {lista.map((s, i) => (
              <li key={`${i}-${s.original}`} className="group flex items-start gap-2 py-1.5 pl-3 pr-1.5">
                <span aria-hidden="true" className="mt-[0.72rem] h-[2px] w-2.5 shrink-0 rounded bg-indigo" />
                {editando?.i === i ? (
                  <input
                    autoFocus aria-label={`Editar soporte ${i + 1}`}
                    className="min-w-0 flex-1 rounded border border-indigo/50 px-1.5 py-[3px] text-[0.93rem] leading-snug focus:outline-none"
                    value={editando.texto}
                    onChange={(e) => setEditando({ i, texto: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); terminarEdicion(true) }
                      if (e.key === 'Escape') { e.preventDefault(); terminarEdicion(false) }
                    }}
                    onBlur={() => terminarEdicion(true)}
                  />
                ) : (
                  <button type="button" title="Pulsa para corregir el texto"
                    onClick={() => setEditando({ i, texto: s.texto })}
                    className="min-w-0 flex-1 cursor-text rounded px-1.5 py-[3px] text-left text-[0.93rem] leading-snug hover:bg-indigo-claro/60">
                    {s.texto}
                  </button>
                )}
                <span className="flex shrink-0 items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
                  <button id={`${uid}-${i}-subir`} type="button" onClick={() => mover(i, -1)} disabled={i === 0}
                    aria-label={`Subir «${s.texto}»`} className="rounded p-1 text-tinta/55 hover:bg-indigo-claro hover:text-indigo disabled:invisible"><Icono d="m18 15-6-6-6 6" /></button>
                  <button id={`${uid}-${i}-bajar`} type="button" onClick={() => mover(i, 1)} disabled={i === lista.length - 1}
                    aria-label={`Bajar «${s.texto}»`} className="rounded p-1 text-tinta/55 hover:bg-indigo-claro hover:text-indigo disabled:invisible"><Icono d="m6 9 6 6 6-6" /></button>
                  <button type="button" onClick={() => quitar(i)}
                    aria-label={`Quitar «${s.texto}»`} className="rounded p-1 text-tinta/55 hover:bg-error/10 hover:text-error"><Icono d="M18 6 6 18M6 6l12 12" /></button>
                </span>
              </li>
            ))}
          </ol>
        )}

        <div className="relative">
          <input
            ref={entrada} id={id} type="text" autoComplete="off"
            role="combobox" aria-expanded={visibles} aria-controls={idLista} aria-autocomplete="list"
            aria-activedescendant={visibles ? `${idLista}-${activa}` : undefined}
            className="w-full rounded-b-lg bg-transparent px-3 py-2 text-[0.95rem] placeholder:text-tinta/40 focus:outline-none"
            placeholder={lista.length ? 'Añadir otro soporte…' : 'Escribe un soporte y pulsa Intro'}
            value={escrito}
            onChange={(e) => {
              const v = e.target.value
              setEscrito(v); setAbierta(true); setNota('')
              setActiva(porDefecto(v))
            }}
            onKeyDown={teclas}
            onBlur={() => setAbierta(false)}
            onPaste={(e) => {
              // Pegar varias líneas añade varios soportes
              const t = e.clipboardData.getData('text')
              if (/\n/.test(t.trim())) { e.preventDefault(); anadir(soportesDeTexto(t).map((x) => x.texto)) }
            }}
          />
          {visibles && (
            <ul id={idLista} role="listbox" aria-label="Sugerencias"
              className="absolute inset-x-0 top-full z-20 mt-1 max-h-80 overflow-auto rounded-lg border border-linea bg-white py-1 shadow-[0_12px_32px_-12px_rgba(23,32,61,.35)]">
              {opciones.map((o, i) => (
                <li key={o.tipo + o.texto} id={`${idLista}-${i}`} role="option" aria-selected={i === activa}
                  onMouseDown={(e) => { e.preventDefault(); anadir([o.texto]) }}
                  onMouseEnter={() => setActiva(i)}
                  className={`flex cursor-pointer items-baseline gap-2 px-3 py-1.5 text-[0.92rem] leading-snug ${i === activa ? 'bg-indigo-claro text-tinta' : 'text-tinta/85'}`}>
                  {o.tipo === 'nuevo' ? <span><span className="font-semibold text-indigo">Añadir</span> «{o.texto}»</span>
                    : o.tipo === 'yaEsta' ? <span className="text-tinta/60">«{o.texto}» ya está en la lista</span>
                      : <span className="min-w-0 flex-1">{o.texto}</span>}
                  {i === activa && <kbd className="ml-auto shrink-0 self-center rounded border border-indigo/25 bg-white px-1.5 text-[0.72rem] font-medium text-indigo">Intro</kbd>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <p className="mt-1.5 min-h-[1.15rem] text-[0.82rem] leading-snug text-tinta/55" aria-live="polite">
        {nota || (lista.length ? 'Pulsa un soporte para corregirlo.' : 'Mientras escribes verás los soportes usados en otros patrocinios.')}
      </p>
    </div>
  )
}

/** Soportes usados en todos los patrocinios, los más frecuentes primero (con la forma de escribirlos más usada) */
export function sugerenciasDeSoportes(listas: { aqui: string[]; otra: string[] }): Sugerencia[] {
  const mapa = new Map<string, { formas: Map<string, number>; aqui: number; otra: number }>()
  const contar = (textos: string[], campo: 'aqui' | 'otra') => {
    for (const t of textos) for (const s of soportesDeTexto(t)) {
      const k = claveSoporte(s.texto)
      if (!k) continue
      const e = mapa.get(k) ?? { formas: new Map(), aqui: 0, otra: 0 }
      e[campo]++
      e.formas.set(s.texto, (e.formas.get(s.texto) ?? 0) + 1)
      mapa.set(k, e)
    }
  }
  contar(listas.aqui, 'aqui')
  contar(listas.otra, 'otra')
  return [...mapa.values()]
    .map((e) => ({ texto: [...e.formas.entries()].sort((a, b) => b[1] - a[1])[0][0], aqui: e.aqui, otra: e.otra }))
    .sort((a, b) => (b.aqui * 2 + b.otra) - (a.aqui * 2 + a.otra) || a.texto.localeCompare(b.texto, 'es'))
}
