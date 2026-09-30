import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts'
import { contraInflacion, estimarAguinaldo, serieConcepto, serieSalarial, ultimoPeriodo, type PuntoSerie } from '../lib/analysis'
import { nombrePeriodo, pesos, pesosCorto, porcentaje } from '../lib/format'
import { useRecibos } from '../lib/useDatos'
import { useEconomia } from '../lib/useEconomia'
import { useTokens } from '../lib/useTokens'

const compacto = new Intl.NumberFormat('es-AR', { notation: 'compact', maximumFractionDigits: 1 })

function Globo({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="globo">
      <strong>{nombrePeriodo(String(label))}</strong>
      {payload.map((p) => (
        <div key={String(p.dataKey)}>
          <span className="globo-marca" style={{ background: p.color }} />
          {p.name}: <span className="cifra">{String(p.dataKey).startsWith('usd') ? `US$ ${Math.round(Number(p.value))}` : pesos(Number(p.value))}</span>
        </div>
      ))}
    </div>
  )
}

function Grafico({ datos, series, formato }: { datos: object[]; series: { clave: string; nombre: string; color: string }[]; formato: (n: number) => string }) {
  const tk = useTokens()
  return (
    <div className="grafico hoja">
      {series.length > 1 && (
        <ul className="leyenda">
          {series.map((s) => (
            <li key={s.clave}>
              <span className="globo-marca" style={{ background: s.color }} />
              {s.nombre}
            </li>
          ))}
        </ul>
      )}
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={datos} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={tk['--regla']} vertical={false} />
          <XAxis
            dataKey="periodo"
            tickFormatter={(p: string) => nombrePeriodo(p, true)}
            stroke={tk['--tinta-3']}
            tickLine={false}
            fontSize={11}
            minTickGap={16}
          />
          <YAxis tickFormatter={formato} stroke={tk['--tinta-3']} tickLine={false} axisLine={false} fontSize={11} width={52} />
          <Tooltip content={Globo} cursor={{ stroke: tk['--tinta-3'], strokeDasharray: '3 3' }} />
          {series.map((s) => (
            <Line
              key={s.clave}
              dataKey={s.clave}
              name={s.nombre}
              stroke={s.color}
              strokeWidth={2}
              dot={{ r: 3, strokeWidth: 2, fill: tk['--hoja'] }}
              activeDot={{ r: 5, stroke: tk['--hoja'], strokeWidth: 2 }}
              isAnimationActive={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function TablaSerie({ serie }: { serie: PuntoSerie[] }) {
  return (
    <details className="ver-tabla">
      <summary className="nota">Ver como tabla</summary>
      <div className="desplazable">
        <table className="tabla hoja">
          <thead>
            <tr>
              <th scope="col">Mes</th>
              <th scope="col">Neto</th>
              <th scope="col">En pesos de hoy</th>
              <th scope="col">US$ oficial</th>
            </tr>
          </thead>
          <tbody>
            {serie.map((p) => (
              <tr key={p.periodo}>
                <td>{nombrePeriodo(p.periodo, true)}</td>
                <td className="cifra">{pesosCorto(p.neto)}</td>
                <td className="cifra">{pesosCorto(p.netoReal)}</td>
                <td className="cifra">{p.usdOficial ? Math.round(p.usdOficial) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

export function Analisis() {
  const recibos = useRecibos()
  const eco = useEconomia()
  const tk = useTokens()
  const [dolar, setDolar] = useState<'usdOficial' | 'usdBlue'>('usdOficial')
  const [concepto, setConcepto] = useState('')

  const serie = useMemo(() => (recibos ? serieSalarial(recibos, eco) : []), [recibos, eco])
  const nombresConceptos = useMemo(
    () => [...new Set((recibos ?? []).flatMap((r) => r.conceptos.filter((c) => c.tipo !== 'retencion').map((c) => c.nombre)))].sort(),
    [recibos],
  )

  if (!recibos) return null
  if (!recibos.length) {
    return (
      <section className="vacio">
        <h1 className="titulo">Análisis</h1>
        <p className="nota">Cuando tengas al menos dos recibos vas a ver cómo evoluciona tu sueldo contra la inflación y el dólar.</p>
        <a className="boton" href="#/escanear">
          Escanear un recibo
        </a>
      </section>
    )
  }

  const ultimoIpc = eco.ipc ? ultimoPeriodo(eco.ipc) : null
  const anual = eco.ipc ? contraInflacion(serie, eco.ipc, 12) : null
  const total = eco.ipc ? contraInflacion(serie, eco.ipc) : null
  const ultimo = recibos.at(-1)!
  const sac = estimarAguinaldo(recibos, ultimo.periodo, ultimo.empleado.fechaIngreso)
  const elegido = concepto || nombresConceptos[0] || ''
  const evolucion = elegido ? serieConcepto(recibos, elegido) : []
  const ultimoMensual = recibos.filter((r) => r.tipoLiquidacion === 'mensual').at(-1)

  return (
    <>
      <header className="encabezado">
        <h1 className="titulo">Análisis</h1>
        {eco.cargando && <span className="nota">Actualizando índices…</span>}
      </header>

      {eco.errores > 0 && !eco.cargando && (
        <p className="aviso">No se pudieron descargar algunos índices (INDEC o dólar). Se muestran los últimos guardados, si hay.</p>
      )}

      {(anual ?? total) && (
        <section className="veredicto hoja">
          {[anual, total && total.desde !== anual?.desde ? total : null]
            .filter((c) => c != null)
            .map((c) => (
              <div key={c.desde}>
                <span className="rotulo">
                  {nombrePeriodo(c.desde, true)} → {nombrePeriodo(c.hasta, true)}
                </span>
                <p className={`veredicto-cifra cifra ${c.variacionReal < 0 ? 'descuento' : 'haber'}`}>{porcentaje(c.variacionReal, true)}</p>
                <p className="nota">
                  {c.variacionReal >= 0 ? 'Le ganaste a la inflación' : 'Perdiste contra la inflación'}: tu neto subió {porcentaje(c.variacionNominal)} y los
                  precios {porcentaje(c.inflacion)}.
                </p>
              </div>
            ))}
        </section>
      )}

      <div className="analisis-grilla">
        {serie.length > 1 && (
          <section className="seccion">
            <span className="rotulo">Neto: lo que cobraste vs. lo que vale hoy</span>
            <Grafico
              datos={serie}
              formato={(n) => compacto.format(n)}
              series={[
                { clave: 'neto', nombre: 'Cobrado', color: tk['--serie-nominal'] },
                ...(eco.ipc
                  ? [{ clave: 'netoReal', nombre: `En pesos de ${ultimoIpc ? nombrePeriodo(ultimoIpc, true) : 'hoy'}`, color: tk['--serie-real'] }]
                  : []),
              ]}
            />
            <p className="nota">Ajustado por IPC nacional (INDEC). Si la línea violeta baja, tu sueldo compra menos que antes.</p>
            <TablaSerie serie={serie} />
          </section>
        )}

        {serie.length > 1 && (eco.oficial || eco.blue) && (
          <section className="seccion">
            <div className="fila-titulo">
              <span className="rotulo">Neto en dólares</span>
              <div className="segmentos" role="group" aria-label="Tipo de dólar">
                <button aria-pressed={dolar === 'usdOficial'} onClick={() => setDolar('usdOficial')}>
                  Oficial
                </button>
                <button aria-pressed={dolar === 'usdBlue'} onClick={() => setDolar('usdBlue')}>
                  Blue
                </button>
              </div>
            </div>
            <Grafico
              datos={serie}
              formato={(n) => `${Math.round(n)}`}
              series={[{ clave: dolar, nombre: dolar === 'usdOficial' ? 'Oficial' : 'Blue', color: tk['--serie-nominal'] }]}
            />
            <p className="nota">Cotización de venta del día de cobro (ArgentinaDatos).</p>
          </section>
        )}

        {sac && (
          <section className="seccion">
            <span className="rotulo">Aguinaldo estimado · {sac.semestre}</span>
            <div className="hoja tarjeta">
              <p className="cifra grande">{pesos(sac.netoEstimado)}</p>
              <p className="nota">
                Bruto {pesos(sac.bruto)}: la mitad de tu mejor remunerativo del semestre ({pesos(sac.mejorRemuneracion)}, {nombrePeriodo(sac.mejorPeriodo)})
                {sac.meses < 6 ? `, proporcional a ${sac.meses} meses` : ''}. Neto estimado con tus descuentos habituales. Se paga con los haberes de{' '}
                {nombrePeriodo(sac.mesDePago)}.
              </p>
            </div>
          </section>
        )}

        {nombresConceptos.length > 0 && (
          <section className="seccion">
            <div className="fila-titulo">
              <span className="rotulo">Evolución de un concepto</span>
              <select className="entrada compacta" value={elegido} onChange={(e) => setConcepto(e.target.value)} aria-label="Concepto">
                {nombresConceptos.map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </div>
            {evolucion.length > 1 ? (
              <>
                <Grafico datos={evolucion} formato={(n) => compacto.format(n)} series={[{ clave: 'importe', nombre: elegido, color: tk['--serie-nominal'] }]} />
                <p className="nota">
                  De {pesos(evolucion[0].importe)} a {pesos(evolucion.at(-1)!.importe)} (
                  {porcentaje(evolucion.at(-1)!.importe / evolucion[0].importe - 1, true)}).
                </p>
              </>
            ) : (
              <p className="nota">Hace falta más de un recibo con este concepto para ver su evolución.</p>
            )}
          </section>
        )}
      </div>

      {ultimoMensual && (
        <section className="seccion">
          <span className="rotulo">A dónde van tus descuentos · {nombrePeriodo(ultimoMensual.periodo)}</span>
          <ul className="barras hoja">
            {ultimoMensual.conceptos
              .filter((c) => c.tipo === 'retencion')
              .sort((a, b) => b.importe - a.importe)
              .map((c, i, lista) => {
                const max = lista[0].importe
                const rem = ultimoMensual.totales.remunerativo ?? 0
                return (
                  <li key={i}>
                    <span>{c.nombre}</span>
                    <span className="barra-pista">
                      <span className="barra-relleno" style={{ width: `${(c.importe / max) * 100}%` }} />
                    </span>
                    <span className="cifra">
                      {pesosCorto(c.importe)}
                      {rem > 0 && <span className="nota"> · {porcentaje(c.importe / rem)}</span>}
                    </span>
                  </li>
                )
              })}
          </ul>
        </section>
      )}
    </>
  )
}
