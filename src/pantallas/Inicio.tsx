import { HojaRecibo } from '../componentes/HojaRecibo'
import { Titulo } from '../componentes/Titulo'
import { Icono } from '../componentes/Icono'
import { totalesEfectivos } from '../lib/audit'
import { anteriorDe } from '../lib/db'
import { nombrePeriodo, pesos, porcentaje } from '../lib/format'
import { useAuditoria, useRecibos } from '../lib/useDatos'
import { respaldoSoportado, useRespaldo } from '../lib/respaldoAuto'

/** Cada mes con un color de la paleta, para que el historial se lea de un vistazo */
const COLORES_MES = ['var(--agua)', 'var(--celeste)', 'var(--rosa)', 'var(--ambar)', 'var(--lavanda)']

export function Inicio() {
  const recibos = useRecibos()
  const ultimo = recibos?.at(-1)
  const chequeos = useAuditoria(ultimo, recibos)
  const respaldo = useRespaldo()

  if (!recibos) return null

  if (!ultimo) {
    return (
      <section className="vacio">
        <h1 className="titulo">Tus recibos, en orden y auditados</h1>
        <p className="nota">
          Subí la foto o el PDF de tu recibo de sueldo. La app lee cada concepto, verifica que las cuentas cierren y te muestra cuánto vale tu sueldo contra la
          inflación.
        </p>
        <a className="boton" href="#/escanear">
          <Icono nombre="subir" /> Cargar mi primer recibo
        </a>
      </section>
    )
  }

  const porAnio = new Map<string, typeof recibos>()
  for (const r of [...recibos].reverse()) {
    const anio = r.periodo.slice(0, 4)
    porAnio.set(anio, [...(porAnio.get(anio) ?? []), r])
  }

  return (
    <>
      <header className="encabezado">
        <Titulo icono="recibos">Mis recibos</Titulo>
        <span className="rotulo">{recibos.length} guardados</span>
      </header>

      {respaldoSoportado && !respaldo.carpeta && (
        <p className="aviso aviso-global">
          Tus recibos viven solo en este navegador. <a href="#/ajustes">Activá el respaldo automático</a> para tener siempre una copia en una carpeta (por
          ejemplo, de Google Drive).
        </p>
      )}

      <div className="dos-columnas inicio">
        <div className="columna-fija">
          <HojaRecibo recibo={ultimo} chequeos={chequeos} enlace={`#/recibo/${ultimo.id}`} />
          <a className="boton ancho cargar-otro" href="#/escanear">
            Cargar otro recibo
          </a>
        </div>
        <div>
          {[...porAnio.entries()].map(([anio, lista]) => (
            <section className="seccion" key={anio}>
              <span className="rotulo">
                {anio} · cobrado {pesos(lista.reduce((s, r) => s + totalesEfectivos(r).neto, 0))}
              </span>
              <ol className="libro hoja">
                {lista.map((r) => {
                  const neto = totalesEfectivos(r).neto
                  const ant = anteriorDe(r, recibos)
                  const variacion = ant ? neto / totalesEfectivos(ant).neto - 1 : null
                  return (
                    <li key={r.id}>
                      <a href={`#/recibo/${r.id}`}>
                        <span>
                          <span className="mes-burbuja" style={{ '--color': COLORES_MES[Number(r.periodo.slice(5)) % COLORES_MES.length] } as React.CSSProperties}>
                            {nombrePeriodo(r.periodo, true).slice(0, 3)}
                          </span>
                          <span className="libro-texto">
                            <span className="libro-periodo">{nombrePeriodo(r.periodo)}</span>
                            <span className="nota">
                              {r.tipoLiquidacion !== 'mensual' ? `${r.tipoLiquidacion.toUpperCase()} · ` : ''}
                              {r.empleador.nombre}
                            </span>
                          </span>
                        </span>
                        <span className="libro-cifras">
                          <span className="cifra">{pesos(neto)}</span>
                          {variacion != null && <span className={`variacion cifra ${variacion < 0 ? 'baja' : ''}`}>{porcentaje(variacion, true)}</span>}
                        </span>
                      </a>
                    </li>
                  )
                })}
              </ol>
            </section>
          ))}
        </div>
      </div>
    </>
  )
}
