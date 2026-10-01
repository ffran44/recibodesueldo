import { useState } from 'react'
import { Titulo } from '../componentes/Titulo'
import { useLiveQuery } from 'dexie-react-hooks'
import { EditorRecibo } from '../componentes/EditorRecibo'
import { HojaRecibo } from '../componentes/HojaRecibo'
import { Icono } from '../componentes/Icono'
import { ListaChequeos } from '../componentes/ListaChequeos'
import { estadoGeneral, totalesEfectivos } from '../lib/audit'
import { antiguedad, cotizacionAl, fechaReferencia, ultimoPeriodo, valorIpc } from '../lib/analysis'
import { anteriorDe, borrarRecibo, db } from '../lib/db'
import { fechaLarga, nombrePeriodo, pesos, porcentaje } from '../lib/format'
import { navegar } from '../lib/ruta'
import type { Adjunto, Concepto, Recibo } from '../lib/types'
import { useAuditoria, useRecibos } from '../lib/useDatos'
import { useEconomia } from '../lib/useEconomia'
import { useObjectUrl } from '../lib/useObjectUrl'

function Foto({ adjunto }: { adjunto: Adjunto }) {
  const url = useObjectUrl(adjunto.blob)
  if (!url) return null
  return (
    <a href={url} target="_blank" rel="noreferrer" className="foto">
      {adjunto.tipo === 'application/pdf' ? (
        <span className="pdf rotulo">Abrir PDF</span>
      ) : (
        <img src={url} alt={`Foto del recibo: ${adjunto.nombre}`} loading="lazy" />
      )}
    </a>
  )
}

const COLUMNAS: { tipo: Concepto['tipo']; nombre: string; clase: string }[] = [
  { tipo: 'remunerativo', nombre: 'Remunerativos', clase: 'haber' },
  { tipo: 'no_remunerativo', nombre: 'No remunerativos', clase: 'norem' },
  { tipo: 'retencion', nombre: 'Descuentos', clase: 'descuento' },
]

const clave = (s: string) => s.toLowerCase().replace(/[^a-z0-9ñ]/g, '')

export function Detalle({ id, editando }: { id: string; editando: boolean }) {
  const recibo = useLiveQuery(() => db.recibos.get(id), [id])
  const adjuntos = useLiveQuery(() => db.adjuntos.where('reciboId').equals(id).toArray(), [id])
  const recibos = useRecibos()
  const chequeos = useAuditoria(recibo, recibos)
  const eco = useEconomia()
  const [confirmarBorrado, setConfirmarBorrado] = useState(false)

  if (recibo === undefined) return null
  if (recibo === null || !recibo) {
    return (
      <p className="nota">
        Este recibo ya no existe. <a href="#/">Volver a mis recibos</a>
      </p>
    )
  }

  if (editando) {
    return (
      <>
        <header className="encabezado">
          <Titulo icono="lapiz">Editar {nombrePeriodo(recibo.periodo)}</Titulo>
        </header>
        <EditorRecibo
          inicial={recibo}
          onCancelar={() => navegar(`/recibo/${id}`)}
          onGuardar={async (datos) => {
            await db.recibos.put({ ...recibo, ...datos, actualizadoEn: new Date().toISOString() } satisfies Recibo)
            navegar(`/recibo/${id}`)
          }}
        />
      </>
    )
  }

  const t = totalesEfectivos(recibo)
  const anterior = recibos ? anteriorDe(recibo, recibos) : null
  const previos = new Map(anterior?.conceptos.map((c) => [clave(c.nombre), c.importe]))

  const ultimoIpc = eco.ipc ? ultimoPeriodo(eco.ipc) : null
  const ipcRecibo = eco.ipc ? valorIpc(eco.ipc, recibo.periodo) : null
  const netoHoy = eco.ipc && ultimoIpc && ipcRecibo ? (t.neto * valorIpc(eco.ipc, ultimoIpc)!) / ipcRecibo : null
  const oficial = eco.oficial ? cotizacionAl(eco.oficial, fechaReferencia(recibo)) : null
  const blue = eco.blue ? cotizacionAl(eco.blue, fechaReferencia(recibo)) : null

  return (
    <>
      <header className="encabezado">
        <a href="#/" className="volver">
          <Icono nombre="atras" tamaño={18} /> Recibos
        </a>
        <a href={`#/recibo/${id}/editar`} className="boton secundario">
          <Icono nombre="lapiz" tamaño={18} /> Editar
        </a>
      </header>

      <div className="dos-columnas">
        <div>
          <HojaRecibo recibo={recibo} chequeos={chequeos} />

          <section className="seccion">
            <span className="rotulo">Auditoría</span>
            <ListaChequeos chequeos={chequeos} />
            {estadoGeneral(chequeos) !== 'ok' && (
              <a className="boton secundario informe-boton" href={`#/recibo/${id}/informe`}>
                <Icono nombre="escudo" tamaño={18} /> Armar informe para reclamar
              </a>
            )}
          </section>

          {(netoHoy || oficial) && (
            <section className="seccion">
              <span className="rotulo">Cuánto vale este sueldo</span>
              <dl className="valores hoja">
                {netoHoy != null && ultimoIpc && ultimoIpc !== recibo.periodo && (
                  <div>
                    <dt>En pesos de {nombrePeriodo(ultimoIpc)}</dt>
                    <dd className="cifra">{pesos(netoHoy)}</dd>
                  </div>
                )}
                {oficial && (
                  <div>
                    <dt>Dólar oficial ({pesos(oficial)})</dt>
                    <dd className="cifra">US$ {(t.neto / oficial).toFixed(0)}</dd>
                  </div>
                )}
                {blue && (
                  <div>
                    <dt>Dólar blue ({pesos(blue)})</dt>
                    <dd className="cifra">US$ {(t.neto / blue).toFixed(0)}</dd>
                  </div>
                )}
                {recibo.costoEmpleador && (
                  <div>
                    <dt>Le costás a tu empleador</dt>
                    <dd className="cifra">
                      {pesos(recibo.costoEmpleador)} <span className="nota">· cobrás el {porcentaje(t.neto / recibo.costoEmpleador)}</span>
                    </dd>
                  </div>
                )}
              </dl>
            </section>
          )}
        </div>
        <div>
          {COLUMNAS.map(({ tipo, nombre, clase }) => {
            const lista = recibo.conceptos.filter((c) => c.tipo === tipo)
            if (!lista.length) return null
            return (
              <section className="seccion" key={tipo}>
                <span className="rotulo">{nombre}</span>
                <table className="tabla hoja">
                  <thead>
                    <tr>
                      <th scope="col">Concepto</th>
                      <th scope="col">Importe</th>
                      {anterior && <th scope="col">vs {nombrePeriodo(anterior.periodo, true)}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {lista.map((c, i) => {
                      const antes = previos.get(clave(c.nombre))
                      return (
                        <tr key={i}>
                          <td>{c.nombre}</td>
                          <td className={`cifra ${clase}`}>{pesos(c.importe)}</td>
                          {anterior && <td className="cifra nota">{antes ? porcentaje(c.importe / antes - 1, true) : 'nuevo'}</td>}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </section>
            )
          })}

          <section className="seccion">
            <span className="rotulo">Datos</span>
            <dl className="valores hoja">
              <div>
                <dt>Fecha de pago</dt>
                <dd>{fechaLarga(recibo.fechaPago)}</dd>
              </div>
              {recibo.banco && (
                <div>
                  <dt>Banco</dt>
                  <dd>{recibo.banco}</dd>
                </div>
              )}
              {recibo.empleado.categoria && (
                <div>
                  <dt>Categoría</dt>
                  <dd>{recibo.empleado.categoria}</dd>
                </div>
              )}
              {recibo.empleado.fechaIngreso && (
                <div>
                  <dt>Ingreso</dt>
                  <dd>
                    {fechaLarga(recibo.empleado.fechaIngreso)}
                    <span className="nota">
                      {' '}
                      · hoy {antiguedad(recibo.empleado.fechaIngreso).anios} años y {antiguedad(recibo.empleado.fechaIngreso).meses} meses
                    </span>
                  </dd>
                </div>
              )}
              {recibo.empleado.obraSocial && (
                <div>
                  <dt>Obra social</dt>
                  <dd>{recibo.empleado.obraSocial}</dd>
                </div>
              )}
            </dl>
            {recibo.notas && <p className="nota">{recibo.notas}</p>}
          </section>

          {adjuntos && adjuntos.length > 0 && (
            <section className="seccion">
              <span className="rotulo">Original</span>
              <div className="fotos">
                {adjuntos.map((a) => (
                  <Foto key={a.id} adjunto={a} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      <section className="seccion">
        {confirmarBorrado ? (
          <div className="acciones">
            <span>¿Borrar este recibo y su foto?</span>
            <button className="boton secundario" onClick={() => setConfirmarBorrado(false)}>
              Cancelar
            </button>
            <button
              className="boton peligro"
              onClick={async () => {
                await borrarRecibo(id)
                navegar('/')
              }}
            >
              Borrar recibo
            </button>
          </div>
        ) : (
          <button className="boton peligro" onClick={() => setConfirmarBorrado(true)}>
            <Icono nombre="basura" tamaño={18} /> Borrar recibo
          </button>
        )}
      </section>
    </>
  )
}
