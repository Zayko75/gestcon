import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { renderAsync } from 'docx-preview'
import { ajustarMaquetacion, paginar } from '../lib/maquetacion'

export function VistaPrevia({ nombre, bytes, onCerrar }: { nombre: string; bytes: Uint8Array; onCerrar: () => void }) {
  const cont = useRef<HTMLDivElement>(null)
  const [error, setError] = useState('')
  const [listo, setListo] = useState(false)

  useEffect(() => {
    if (!cont.current) return
    cont.current.innerHTML = ''
    const destino = cont.current
    // experimental: activa las tabulaciones (títulos centrados con tabuladores, como «ANEXO I»)
    renderAsync(new Blob([bytes as unknown as BlobPart]), destino, undefined, { className: 'docx', inWrapper: true, breakPages: true, experimental: true })
      .then(async () => {
        ajustarMaquetacion(destino, bytes)
        // Se pagina con las fuentes ya cargadas y las tabulaciones ya calculadas, para medir bien cada línea
        await document.fonts.ready
        await new Promise((r) => setTimeout(r, 400))
        paginar(destino)
        setListo(true)
      })
      .catch((e) => setError('No se pudo mostrar la vista previa: ' + (e instanceof Error ? e.message : String(e))))
  }, [bytes])

  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [onCerrar])

  const imprimir = () => {
    const anterior = document.title
    document.title = nombre.replace(/\.docx$/i, '')
    const restaurar = () => { document.title = anterior; window.removeEventListener('afterprint', restaurar) }
    window.addEventListener('afterprint', restaurar)
    window.print()
  }

  const descargar = () => {
    const url = URL.createObjectURL(new Blob([bytes as unknown as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }))
    const a = document.createElement('a')
    a.href = url
    a.download = nombre
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }

  return createPortal(
    <div id="vista-previa" className="fixed inset-0 z-50 overflow-auto bg-papel" role="dialog" aria-modal="true" aria-label={'Vista previa de ' + nombre}>
      <div className="no-imprimir sticky top-0 z-10 flex flex-wrap items-center gap-2 bg-noche px-4 py-3 text-white sm:px-6">
        <span className="mr-auto min-w-0 truncate font-display text-[1.2rem] font-semibold" title={nombre}>{nombre}</span>
        <button className="btn bg-white text-noche hover:bg-white/90" onClick={imprimir} disabled={!listo}>Imprimir o guardar como PDF</button>
        <button className="btn border border-white/25 text-white hover:bg-white/10" onClick={descargar}>Descargar .docx</button>
        <button className="btn border border-white/25 text-white hover:bg-white/10" onClick={onCerrar}>Cerrar</button>
      </div>
      <p className="no-imprimir mx-auto mt-4 max-w-3xl px-4 text-center text-[0.84rem] text-tinta/60">
        Para obtener el PDF: pulsa «Imprimir o guardar como PDF» y en el destino elige «Guardar como PDF». La maquetación exacta es la del archivo Word guardado en la carpeta documentos.
      </p>
      {error && <p role="alert" className="no-imprimir mx-auto mt-4 max-w-3xl rounded-lg border border-error/30 bg-white p-3 text-[0.9rem] text-error">{error}</p>}
      <div ref={cont} />
    </div>,
    document.body,
  )
}
