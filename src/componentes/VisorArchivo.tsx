import { useState } from 'react'
import { useObjectUrl } from '../lib/useObjectUrl'

/** Muestra la foto o el PDF original para comparar mientras se revisa; clic para ampliar */
export function VisorArchivo({ archivo }: { archivo: Blob }) {
  const url = useObjectUrl(archivo)
  const [ampliado, setAmpliado] = useState(false)
  if (!url) return null
  if (archivo.type === 'application/pdf') return <iframe className="visor visor-pdf hoja" src={url} title="Recibo original" />
  return (
    <div className={`visor hoja ${ampliado ? 'ampliado' : ''}`}>
      <button type="button" className="visor-boton" onClick={() => setAmpliado((a) => !a)} aria-label={ampliado ? 'Achicar la foto' : 'Ampliar la foto'}>
        <img src={url} alt="Recibo original" />
      </button>
    </div>
  )
}
