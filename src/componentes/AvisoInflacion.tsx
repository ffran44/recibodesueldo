import { textoAvisoInflacion } from '../lib/avisoInflacion'
import { marcarInflacionVista, useAvisoInflacion } from '../lib/avisos'
import { Icono } from './Icono'

/** Cuando INDEC publica un mes nuevo de inflación, cuenta cómo le fue a tu sueldo */
export function AvisoInflacion() {
  const aviso = useAvisoInflacion()
  if (!aviso) return null
  const { titulo, cuerpo } = textoAvisoInflacion(aviso)
  return (
    <section className="aviso-cobro aviso-inflacion" role="status">
      <span className="ficha" aria-hidden>
        <Icono nombre="tendencia" tamaño={20} />
      </span>
      <div className="pila">
        <strong>{titulo}</strong>
        <p>{cuerpo}</p>
        <div className="acciones izquierda">
          <a className="boton" href="#/analisis" onClick={() => marcarInflacionVista(aviso.periodo)}>
            Ver análisis
          </a>
          <button className="boton secundario" onClick={() => marcarInflacionVista(aviso.periodo)}>
            Entendido
          </button>
        </div>
      </div>
    </section>
  )
}
