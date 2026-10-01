import { useLiveQuery } from 'dexie-react-hooks'
import { Icono } from '../componentes/Icono'
import { estadoGeneral, totalesEfectivos } from '../lib/audit'
import { db } from '../lib/db'
import { fechaLarga, nombrePeriodo, pesos } from '../lib/format'
import { obtenerNombrePropio } from '../lib/settings'
import type { Adjunto } from '../lib/types'
import { useAuditoria, useRecibos } from '../lib/useDatos'
import { useObjectUrl } from '../lib/useObjectUrl'

const TIPOS = { remunerativo: 'Remunerativo', no_remunerativo: 'No remunerativo', retencion: 'Descuento' } as const

function Imagen({ adjunto }: { adjunto: Adjunto }) {
  const url = useObjectUrl(adjunto.blob)
  if (!url || adjunto.tipo === 'application/pdf') return null
  return <img src={url} alt={`Recibo original: ${adjunto.nombre}`} />
}

/** Informe imprimible para presentar al empleador, al gremio o a un abogado */
export function Informe({ id }: { id: string }) {
  const recibo = useLiveQuery(() => db.recibos.get(id), [id])
  const adjuntos = useLiveQuery(() => db.adjuntos.where('reciboId').equals(id).toArray(), [id])
  const recibos = useRecibos()
  const chequeos = useAuditoria(recibo, recibos)

  if (!recibo) return null
  const problemas = chequeos.filter((c) => c.estado === 'error' || c.estado === 'alerta')
  const t = totalesEfectivos(recibo)
  const nombre = obtenerNombrePropio()
  const estado = estadoGeneral(chequeos)

  return (
    <>
      <div className="informe-acciones no-imprimir">
        <a href={`#/recibo/${id}`} className="volver">
          <Icono nombre="atras" tamaño={18} /> Volver al recibo
        </a>
        <button className="boton" onClick={() => window.print()}>
          Imprimir o guardar PDF
        </button>
      </div>
      <p className="nota no-imprimir">En la ventana de impresión elegí «Guardar como PDF» para tener el archivo.</p>

      <article className="informe">
        <header>
          <h1>Informe de diferencias en recibo de sueldo</h1>
          <p>
            Recibo de {nombrePeriodo(recibo.periodo)} · emitido por {recibo.empleador.nombre || '__________'}
            {recibo.empleador.cuit ? ` (CUIT ${recibo.empleador.cuit})` : ''}
          </p>
        </header>

        <section>
          <h2>Datos</h2>
          <dl>
            <dt>Trabajador/a</dt>
            <dd>{nombre || '______________________________'}</dd>
            <dt>Categoría</dt>
            <dd>{recibo.empleado.categoria ?? '—'}</dd>
            <dt>Fecha de ingreso</dt>
            <dd>{fechaLarga(recibo.empleado.fechaIngreso)}</dd>
            <dt>Fecha de pago</dt>
            <dd>{fechaLarga(recibo.fechaPago)}</dd>
          </dl>
        </section>

        <section>
          <h2>Qué se observa</h2>
          {problemas.length ? (
            <ol>
              {problemas.map((c) => (
                <li key={c.id}>
                  <strong>{c.titulo}.</strong> {c.detalle}
                </li>
              ))}
            </ol>
          ) : (
            <p>La revisión automática no encontró diferencias en este recibo ({estado === 'ok' ? 'conforme' : 'revisar'}).</p>
          )}
        </section>

        <section>
          <h2>Totales del recibo</h2>
          <table>
            <tbody>
              <tr>
                <td>Remunerativo</td>
                <td>{pesos(t.remunerativo)}</td>
              </tr>
              <tr>
                <td>No remunerativo</td>
                <td>{pesos(t.noRemunerativo)}</td>
              </tr>
              <tr>
                <td>Descuentos</td>
                <td>{pesos(t.retenciones)}</td>
              </tr>
              <tr>
                <td>
                  <strong>Neto</strong>
                </td>
                <td>
                  <strong>{pesos(t.neto)}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2>Conceptos liquidados</h2>
          <table>
            <thead>
              <tr>
                <th>Concepto</th>
                <th>Tipo</th>
                <th>Importe</th>
              </tr>
            </thead>
            <tbody>
              {recibo.conceptos.map((c, i) => (
                <tr key={i}>
                  <td>{c.nombre}</td>
                  <td>{TIPOS[c.tipo]}</td>
                  <td>{pesos(c.importe)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {adjuntos && adjuntos.length > 0 && (
          <section className="informe-fotos">
            <h2>Recibo original</h2>
            {adjuntos.map((a) => (
              <Imagen key={a.id} adjunto={a} />
            ))}
          </section>
        )}

        <footer>
          Preparado el {fechaLarga(new Date().toISOString().slice(0, 10))} con la app Mis recibos. La revisión es automática y orientativa: verificá los datos
          con tu gremio o un profesional.
        </footer>
      </article>
    </>
  )
}
