import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { renderAsync } from 'docx-preview'
import { ajustarMaquetacion } from '../lib/maquetacion'

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
      .then(() => {
        ajustarMaquetacion(destino, bytes)
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
      <div className="no-imprimir sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-linea bg-white px-4 py-2.5">
        <span className="mr-auto truncate text-sm font-medium" title={nombre}>{nombre}</span>
        <button className="btn-primario" onClick={imprimir} disabled={!listo}>Imprimir o guardar como PDF</button>
        <button className="btn-sec" onClick={descargar}>Descargar .docx</button>
        <button className="btn-sec" onClick={onCerrar}>Cerrar</button>
      </div>
      <p className="no-imprimir mx-auto mt-3 max-w-3xl px-4 text-xs text-tinta/60">
        Para obtener el PDF: pulsa «Imprimir o guardar como PDF» y en el destino elige «Guardar como PDF». La maquetación exacta es la del archivo Word guardado en la carpeta documentos.
      </p>
      {error && <p role="alert" className="no-imprimir mx-auto mt-4 max-w-3xl rounded-md border border-error/30 bg-white p-3 text-sm text-error">{error}</p>}
      <div ref={cont} />
    </div>,
    document.body,
  )
}
