import { textoAviso } from '../lib/avisoCobro'
import { ocultarAviso, useAvisosCobro } from '../lib/avisos'
import { Icono } from './Icono'

/** Avisa si venció el plazo de pago y falta el recibo del mes */
export function AvisosCobro() {
  const avisos = useAvisosCobro()
  if (!avisos.length) return null
  return (
    <div className="avisos-cobro">
      {avisos.map((a) => {
        const { titulo, cuerpo } = textoAviso(a)
        return (
          <section key={`${a.periodo}-${a.empleador}`} className={`aviso-cobro aviso-${a.estado}`} role="status">
            <span className="ficha" aria-hidden>
              <Icono nombre="calendario" tamaño={20} />
            </span>
            <div className="pila">
              <strong>{titulo}</strong>
              <p>
                {cuerpo}
                {a.estado === 'atrasado' && ' Si no te pagaron, tu empleador está en mora (art. 128 LCT): podés reclamar el pago con intereses.'}
              </p>
              <div className="acciones izquierda">
                <a className="boton" href="#/escanear">
                  Cargar recibo
                </a>
                <button className="boton secundario" onClick={() => ocultarAviso(a)}>
                  Ya cobré
                </button>
                <button className="enlace" onClick={() => ocultarAviso(a, 3)}>
                  Recordame en 3 días
                </button>
              </div>
            </div>
          </section>
        )
      })}
    </div>
  )
}
