import type { Recibo } from '../lib/types'
import { estadoGeneral, totalesEfectivos, type Chequeo } from '../lib/audit'
import { nombrePeriodo, numero, pesos } from '../lib/format'
import { Sello } from './Sello'

const TIPO: Record<Recibo['tipoLiquidacion'], string> = {
  mensual: 'Haberes mensuales',
  sac: 'Aguinaldo',
  vacaciones: 'Vacaciones',
  final: 'Liquidación final',
  otro: 'Liquidación',
}

/** El recibo como hoja: perforaciones, encabezado de formulario, columnas y sello */
export function HojaRecibo({ recibo, chequeos, enlace }: { recibo: Recibo; chequeos: Chequeo[]; enlace?: string }) {
  const t = totalesEfectivos(recibo)
  const contenido = (
    <>
      <div className="hoja-encabezado">
        <span className="rotulo">{TIPO[recibo.tipoLiquidacion]}</span>
      </div>
      <h2 className="hoja-periodo">{nombrePeriodo(recibo.periodo)}</h2>
      <p className="hoja-empleador nota">{recibo.empleador.nombre}</p>
      <div className="hoja-neto">
        <span className="rotulo">Sueldo neto</span>
        <span className="cifra">{pesos(t.neto)}</span>
      </div>
      <dl className="hoja-columnas">
        <div>
          <dt className="rotulo">Remunerativo</dt>
          <dd className="cifra haber">{numero(t.remunerativo)}</dd>
        </div>
        <div>
          <dt className="rotulo">No remun.</dt>
          <dd className="cifra norem">{numero(t.noRemunerativo)}</dd>
        </div>
        <div>
          <dt className="rotulo">Descuentos</dt>
          <dd className="cifra descuento">−{numero(t.retenciones)}</dd>
        </div>
      </dl>
      <div className="hoja-sello">
        <Sello estado={estadoGeneral(chequeos)} periodo={recibo.periodo} />
      </div>
    </>
  )
  return enlace ? (
    <a className="hoja hoja-recibo" href={enlace}>
      {contenido}
    </a>
  ) : (
    <article className="hoja hoja-recibo">{contenido}</article>
  )
}
