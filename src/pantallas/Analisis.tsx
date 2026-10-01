import { useMemo, useState } from 'react'
import { Titulo } from '../componentes/Titulo'
import { Barras, Lineas, SinDatos, Tarjeta } from '../componentes/graficos'
import { MapaConceptos } from '../componentes/MapaConceptos'
import { contraInflacion, estimarAguinaldo, serieConcepto, serieSalarial, ultimoPeriodo, valorIpc, type PuntoSerie } from '../lib/analysis'
import { nombrePeriodo, pesos, pesosCorto, porcentaje } from '../lib/format'
import {
  aumentosVsInflacion,
  brechaInflacion,
  composicion,
  conceptoBasico,
  desdeUltimoAumento,
  detectarAumentos,
  filtrarPorRango,
  indiceBase100,
  netoParaMantener,
  resumenAnual,
  soloMensuales,
  type Rango,
} from '../lib/indicadores'
import type { Recibo } from '../lib/types'
import { useRecibos } from '../lib/useDatos'
import { useEconomia, type Economia } from '../lib/useEconomia'
import { useTokens } from '../lib/useTokens'

const compacto = new Intl.NumberFormat('es-AR', { notation: 'compact', maximumFractionDigits: 1 })
const pct = (n: number) => porcentaje(n / 100 - 1, true)

type Pestaña = 'resumen' | 'inflacion' | 'composicion' | 'conceptos'
const PESTAÑAS: { id: Pestaña; nombre: string }[] = [
  { id: 'resumen', nombre: 'Resumen' },
  { id: 'inflacion', nombre: 'Inflación y dólar' },
  { id: 'composicion', nombre: 'Composición' },
  { id: 'conceptos', nombre: 'Conceptos' },
]

function leerPreferencia<T extends string>(clave: string, porDefecto: T): T {
  try {
    return (localStorage.getItem(clave) as T) ?? porDefecto
  } catch {
    return porDefecto
  }
}
function guardarPreferencia(clave: string, valor: string) {
  try {
    localStorage.setItem(clave, valor)
  } catch {
    // Sin almacenamiento: la preferencia dura la sesión
  }
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
              <th scope="col">US$ blue</th>
            </tr>
          </thead>
          <tbody>
            {serie.map((p) => (
              <tr key={p.periodo}>
                <td>{nombrePeriodo(p.periodo, true)}</td>
                <td className="cifra">{pesosCorto(p.neto)}</td>
                <td className="cifra">{pesosCorto(p.netoReal)}</td>
                <td className="cifra">{p.usdOficial ? Math.round(p.usdOficial) : '—'}</td>
                <td className="cifra">{p.usdBlue ? Math.round(p.usdBlue) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

function Resumen({ recibos, todos, eco, serie }: { recibos: Recibo[]; todos: Recibo[]; eco: Economia; serie: PuntoSerie[] }) {
  const tk = useTokens()
  const ultimoIpc = eco.ipc ? ultimoPeriodo(eco.ipc) : null
  const comparacion = eco.ipc ? contraInflacion(serie, eco.ipc) : null
  const brecha = eco.ipc ? brechaInflacion(serie, eco.ipc) : []
  const acumulado = brecha.at(-1)?.acumulado ?? null
  const ultimoAumento = eco.ipc ? desdeUltimoAumento(todos, eco.ipc) : null
  const mantener = eco.ipc ? netoParaMantener(serie, eco.ipc) : null
  const anual = resumenAnual(recibos)
  const ultimo = todos.at(-1)!
  const sac = estimarAguinaldo(todos, ultimo.periodo, ultimo.empleado.fechaIngreso)
  const anterior = serie.at(-2)
  const actual = serie.at(-1)

  return (
    <>
      <div className="tarjetas">
        {actual && (
          <Tarjeta
            color="var(--agua)"
            icono="plata"
            titulo={`Último neto · ${nombrePeriodo(actual.periodo, true)}`}
            valor={pesosCorto(actual.neto)}
            detalle={anterior ? `${porcentaje(actual.neto / anterior.neto - 1, true)} vs ${nombrePeriodo(anterior.periodo, true)}` : undefined}
          />
        )}
        {comparacion && (
          <Tarjeta
            color="var(--celeste)"
            icono="tendencia"
            titulo="Poder de compra"
            valor={porcentaje(comparacion.variacionReal, true)}
            tono={comparacion.variacionReal >= 0 ? 'bien' : 'mal'}
            detalle={`${nombrePeriodo(comparacion.desde, true)} → ${nombrePeriodo(comparacion.hasta, true)}: sueldo ${porcentaje(comparacion.variacionNominal, true)}, precios ${porcentaje(comparacion.inflacion, true)}`}
          />
        )}
        {acumulado != null && brecha.length > 1 && (
          <Tarjeta
            color={acumulado < 0 ? 'var(--descuento)' : 'var(--haber)'}
            icono={acumulado < 0 ? 'baja' : 'tendencia'}
            titulo={acumulado < 0 ? 'Lo que te comió la inflación' : 'Lo que le ganaste a la inflación'}
            valor={pesosCorto(Math.abs(acumulado))}
            tono={acumulado < 0 ? 'mal' : 'bien'}
            detalle={`Sumando cada mes contra el poder de compra de ${nombrePeriodo(brecha[0].periodo, true)}`}
          />
        )}
        {ultimoAumento && ultimoAumento.periodo >= ultimoAumento.hasta && (
          <Tarjeta
            color="var(--rosa)"
            icono="calendario"
            titulo="Último aumento"
            valor={porcentaje(ultimoAumento.variacion, true)}
            tono="bien"
            detalle={`en ${nombrePeriodo(ultimoAumento.periodo, true)}. INDEC todavía no publicó la inflación de los meses siguientes.`}
          />
        )}
        {ultimoAumento && ultimoAumento.periodo < ultimoAumento.hasta && (
          <Tarjeta
            color="var(--rosa)"
            icono="calendario"
            titulo="Desde tu último aumento"
            valor={porcentaje(ultimoAumento.inflacion, true)}
            tono={ultimoAumento.inflacion > 0.02 ? 'mal' : undefined}
            detalle={`de inflación desde ${nombrePeriodo(ultimoAumento.periodo, true)} (aumento de ${porcentaje(ultimoAumento.variacion)}). Tu sueldo compra ${porcentaje(ultimoAumento.perdidaPoderCompra)} menos.`}
          />
        )}
        {mantener && mantener.faltante > 0 && (
          <Tarjeta
            color="var(--celeste)"
            icono="objetivo"
            titulo="Para igualar tu mejor mes"
            valor={pesosCorto(mantener.monto)}
            detalle={`Es lo que valdría hoy tu neto de ${nombrePeriodo(mantener.mejorPeriodo, true)}: te faltan ${pesosCorto(mantener.faltante)} por mes.`}
          />
        )}
        {sac && (
          <Tarjeta
            color="var(--ambar)"
            icono="regalo"
            titulo={`Aguinaldo estimado · ${sac.semestre}`}
            valor={pesosCorto(sac.netoEstimado)}
            detalle={`Bruto ${pesosCorto(sac.bruto)}: la mitad de tu mejor remunerativo (${nombrePeriodo(sac.mejorPeriodo, true)})${sac.meses < 6 ? `, proporcional a ${sac.meses} meses` : ''}.`}
          />
        )}
      </div>

      {serie.length > 1 ? (
        <section className="seccion">
          <span className="rotulo">Lo que cobraste vs. lo que vale hoy</span>
          <Lineas
            datos={serie}
            formato={pesos}
            formatoEje={(n) => compacto.format(n)}
            series={[
              { clave: 'neto', nombre: 'Cobrado', color: tk['--serie-nominal'] },
              ...(eco.ipc ? [{ clave: 'netoReal', nombre: `En pesos de ${ultimoIpc ? nombrePeriodo(ultimoIpc, true) : 'hoy'}`, color: tk['--serie-real'] }] : []),
            ]}
          />
          <p className="nota">Ajustado por IPC nacional (INDEC). Si la línea violeta baja, tu sueldo compra menos que antes.</p>
          <TablaSerie serie={serie} />
        </section>
      ) : (
        <SinDatos>Con dos o más recibos vas a ver cómo evoluciona tu sueldo contra la inflación.</SinDatos>
      )}

      {anual.length > 0 && (
        <section className="seccion">
          <span className="rotulo">Cobrado por año</span>
          {anual.length > 1 && (
            <Barras
              datos={anual}
              eje="anio"
              formato={pesos}
              formatoEje={(n) => compacto.format(n)}
              series={[{ clave: 'total', nombre: 'Total cobrado', color: tk['--serie-nominal'] }]}
              alto={200}
            />
          )}
          <table className="tabla hoja">
            <thead>
              <tr>
                <th scope="col">Año</th>
                <th scope="col">Cobrado</th>
                <th scope="col">Aguinaldo</th>
                <th scope="col">Promedio mensual</th>
              </tr>
            </thead>
            <tbody>
              {anual.map((a) => (
                <tr key={a.anio}>
                  <td>
                    {a.anio} <span className="nota">({a.meses} meses)</span>
                  </td>
                  <td className="cifra">{pesosCorto(a.total)}</td>
                  <td className="cifra">{a.aguinaldo ? pesosCorto(a.aguinaldo) : '—'}</td>
                  <td className="cifra">{pesosCorto(a.promedioMensual)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  )
}

function Inflacion({ todos, eco, serie }: { todos: Recibo[]; eco: Economia; serie: PuntoSerie[] }) {
  const tk = useTokens()
  const [dolar, setDolar] = useState<'usdOficial' | 'usdBlue'>('usdOficial')
  if (serie.length < 2) return <SinDatos>Cargá al menos dos recibos para comparar tu sueldo con la inflación y el dólar.</SinDatos>
  if (!eco.ipc) return <SinDatos>No se pudo descargar la inflación de INDEC. Revisá la conexión y volvé a entrar.</SinDatos>

  const ipc = eco.ipc
  const indice = indiceBase100(serie)
  const brecha = brechaInflacion(serie, ipc)
  const mes = aumentosVsInflacion(serie, ipc).map((a) => ({ ...a, aumento: a.aumento * 100, inflacion: a.inflacion * 100 }))
  const aumentos = detectarAumentos(todos)
  const basico = conceptoBasico(todos)
  const ultimoIpc = ultimoPeriodo(ipc)!

  return (
    <>
      <section className="seccion">
        <span className="rotulo">Poder de compra · {nombrePeriodo(serie[0].periodo, true)} = 100</span>
        <Lineas
          datos={indice}
          formato={pct}
          formatoEje={(n) => String(Math.round(n))}
          referencia={{ y: 100 }}
          series={[
            { clave: 'real', nombre: 'Contra los precios (IPC)', color: tk['--serie-real'] },
            ...(eco.oficial ? [{ clave: 'oficial', nombre: 'En dólar oficial', color: tk['--serie-nominal'] }] : []),
            ...(eco.blue ? [{ clave: 'blue', nombre: 'En dólar blue', color: tk['--serie-blue'] }] : []),
          ]}
        />
        <p className="nota">Arriba de 100, tu sueldo rinde más que en el primer mes; abajo, rinde menos. Las tres miradas en la misma escala.</p>
      </section>

      <div className="analisis-grilla">
        <section className="seccion">
          <span className="rotulo">Cada mes: tu sueldo vs. la inflación</span>
          <Barras
            datos={mes}
            formato={(n) => porcentaje(n / 100, true)}
            formatoEje={(n) => `${n}%`}
            series={[
              { clave: 'aumento', nombre: 'Variación de tu neto', color: tk['--serie-nominal'] },
              { clave: 'inflacion', nombre: 'Inflación del mes', color: tk['--serie-ref'] },
            ]}
          />
          <p className="nota">Cuando la barra gris supera a la verde, ese mes perdiste poder de compra.</p>
        </section>

        <section className="seccion">
          <span className="rotulo">Ganado o perdido por mes contra {nombrePeriodo(serie[0].periodo, true)}</span>
          <Barras
            datos={brecha}
            formato={pesos}
            formatoEje={(n) => compacto.format(n)}
            series={[{ clave: 'diferencia', nombre: 'Diferencia', color: tk['--div-pos'] }]}
            colorPorSigno={{ positivo: tk['--div-pos'], negativo: tk['--div-neg'] }}
          />
          <p className="nota">
            Lo que cobraste menos lo que hubieras necesitado para comprar lo mismo que en {nombrePeriodo(serie[0].periodo, true)}. Acumulado:{' '}
            <strong className={`cifra ${(brecha.at(-1)?.acumulado ?? 0) < 0 ? 'descuento' : 'haber'}`}>{pesos(brecha.at(-1)?.acumulado ?? 0)}</strong>.
          </p>
        </section>
      </div>

      <div className="analisis-grilla">
        <section className="seccion">
          <span className="rotulo">Aumentos detectados{basico ? ` · ${basico}` : ''}</span>
          {aumentos.length ? (
            <ol className="linea-tiempo hoja">
              {aumentos.map((a, i) => {
                const hasta = aumentos[i + 1]?.periodo ?? ultimoIpc
                const i0 = valorIpc(ipc, a.periodo)
                const i1 = valorIpc(ipc, hasta)
                const inflacion = i0 && i1 ? i1 / i0 - 1 : null
                return (
                  <li key={a.periodo}>
                    <span className="libro-periodo">{nombrePeriodo(a.periodo)}</span>
                    <span className="cifra haber">{porcentaje(a.variacion, true)}</span>
                    {inflacion != null && (
                      <span className="nota">
                        {i + 1 < aumentos.length ? 'Hasta el siguiente aumento' : 'Desde entonces'}, la inflación fue {porcentaje(inflacion)}
                      </span>
                    )}
                  </li>
                )
              })}
            </ol>
          ) : (
            <SinDatos>No se detectaron aumentos del básico en este período.</SinDatos>
          )}
        </section>

        {(eco.oficial || eco.blue) && (
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
            <Lineas
              datos={serie}
              formato={(n) => `US$ ${Math.round(n)}`}
              formatoEje={(n) => `${Math.round(n)}`}
              series={[{ clave: dolar, nombre: dolar === 'usdOficial' ? 'Oficial' : 'Blue', color: dolar === 'usdOficial' ? tk['--serie-nominal'] : tk['--serie-blue'] }]}
              alto={200}
            />
            <p className="nota">Cotización de venta del día de cobro (ArgentinaDatos).</p>
          </section>
        )}
      </div>
    </>
  )
}

function Composicion({ recibos }: { recibos: Recibo[] }) {
  const tk = useTokens()
  const mensuales = soloMensuales(recibos)
  const comp = composicion(mensuales)
  const ultimo = comp.at(-1)
  const ultimoRecibo = mensuales.at(-1)
  if (!ultimo || !ultimoRecibo) return <SinDatos>Todavía no hay recibos mensuales en este período.</SinDatos>

  const porcentajes = comp.map((c) => ({ periodo: c.periodo, noRem: c.pctNoRemunerativo * 100, desc: c.pctDescuentos * 100 }))
  const costo = mensuales.filter((r) => r.costoEmpleador).at(-1)?.costoEmpleador ?? null
  const aguinaldoPerdido = ultimo.noRemunerativo / 2

  return (
    <>
      <div className="tarjetas">
        <Tarjeta
          color="var(--ambar)"
          icono="escudo"
          titulo="No remunerativo"
          valor={porcentaje(ultimo.pctNoRemunerativo)}
          detalle={`de tu bruto en ${nombrePeriodo(ultimo.periodo, true)} (${pesosCorto(ultimo.noRemunerativo)}). No suma para jubilación ni aguinaldo${aguinaldoPerdido > 0 ? `: si fuera remunerativo, tu aguinaldo sería unos ${pesosCorto(aguinaldoPerdido)} más` : ''}.`}
        />
        <Tarjeta color="var(--rosa)" icono="baja" titulo="Descuentos" valor={porcentaje(ultimo.pctDescuentos)} detalle={`de tu remunerativo (${pesosCorto(ultimo.retenciones)}).`} />
        {costo && (
          <Tarjeta color="var(--celeste)" icono="plata" titulo="De lo que le costás a tu empleador" valor={porcentaje(ultimo.neto / costo)} detalle={`te llega en mano. Costo total: ${pesosCorto(costo)}.`} />
        )}
      </div>

      {comp.length > 1 && (
        <div className="analisis-grilla">
          <section className="seccion">
            <span className="rotulo">Cómo se arma tu bruto</span>
            <Barras
              datos={comp}
              modo="apiladas"
              formato={pesos}
              formatoEje={(n) => compacto.format(n)}
              series={[
                { clave: 'remunerativo', nombre: 'Remunerativo', color: tk['--g-rem'] },
                { clave: 'noRemunerativo', nombre: 'No remunerativo', color: tk['--g-norem'] },
              ]}
            />
          </section>
          <section className="seccion">
            <span className="rotulo">Peso del no remunerativo y de los descuentos</span>
            <Lineas
              datos={porcentajes}
              formato={(n) => `${n.toFixed(1).replace('.', ',')}%`}
              formatoEje={(n) => `${Math.round(n)}%`}
              series={[
                { clave: 'noRem', nombre: 'No remunerativo / bruto', color: tk['--g-norem'] },
                { clave: 'desc', nombre: 'Descuentos / remunerativo', color: tk['--g-desc'] },
              ]}
            />
          </section>
        </div>
      )}

      <section className="seccion">
        <span className="rotulo">A dónde van tus descuentos · {nombrePeriodo(ultimoRecibo.periodo)}</span>
        <ul className="barras hoja">
          {ultimoRecibo.conceptos
            .filter((c) => c.tipo === 'retencion')
            .sort((a, b) => b.importe - a.importe)
            .map((c, i, lista) => (
              <li key={i}>
                <span>{c.nombre}</span>
                <span className="barra-pista">
                  <span className="barra-relleno" style={{ width: `${(c.importe / lista[0].importe) * 100}%` }} />
                </span>
                <span className="cifra">
                  {pesosCorto(c.importe)}
                  {ultimo.remunerativo > 0 && <span className="nota"> · {porcentaje(c.importe / ultimo.remunerativo)}</span>}
                </span>
              </li>
            ))}
        </ul>
      </section>
    </>
  )
}

function Conceptos({ recibos, eco }: { recibos: Recibo[]; eco: Economia }) {
  const tk = useTokens()
  const nombres = useMemo(
    () => [...new Set(recibos.flatMap((r) => r.conceptos.filter((c) => c.tipo !== 'retencion').map((c) => c.nombre)))].sort(),
    [recibos],
  )
  const [concepto, setConcepto] = useState('')

  if (soloMensuales(recibos).length < 2) return <SinDatos>Con dos o más recibos vas a ver cómo cambia cada concepto mes a mes.</SinDatos>

  const elegido = nombres.includes(concepto) ? concepto : (conceptoBasico(recibos) ?? nombres[0] ?? '')
  const evolucion = elegido ? serieConcepto(recibos, elegido) : []
  const base = evolucion[0]
  const i0 = base && eco.ipc ? valorIpc(eco.ipc, base.periodo) : null
  const conInflacion = evolucion.map((p) => {
    const i1 = eco.ipc ? valorIpc(eco.ipc, p.periodo) : null
    return { ...p, siguiendoInflacion: i0 && i1 ? (base.importe * i1) / i0 : null }
  })

  return (
    <>
      <MapaConceptos recibos={recibos} ipc={eco.ipc} />

      <section className="seccion">
        <div className="fila-titulo">
          <span className="rotulo">Evolución de un concepto</span>
          <select className="entrada compacta" value={elegido} onChange={(e) => setConcepto(e.target.value)} aria-label="Concepto">
            {nombres.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </div>
        {evolucion.length > 1 ? (
          <>
            <Lineas
              datos={conInflacion}
              formato={pesos}
              formatoEje={(n) => compacto.format(n)}
              series={[
                { clave: 'importe', nombre: elegido, color: tk['--serie-nominal'] },
                ...(eco.ipc ? [{ clave: 'siguiendoInflacion', nombre: 'Si hubiera seguido a la inflación', color: tk['--serie-ref'] }] : []),
              ]}
            />
            <p className="nota">
              De {pesos(evolucion[0].importe)} a {pesos(evolucion.at(-1)!.importe)} ({porcentaje(evolucion.at(-1)!.importe / evolucion[0].importe - 1, true)}).
            </p>
          </>
        ) : (
          <SinDatos>Hace falta más de un recibo con este concepto para ver su evolución.</SinDatos>
        )}
      </section>
    </>
  )
}

export function Analisis() {
  const todos = useRecibos()
  const eco = useEconomia()
  const [pestaña, setPestaña] = useState<Pestaña>(() => leerPreferencia('recibos.analisis.pestaña', 'resumen'))
  const [rango, setRango] = useState<Rango>(() => leerPreferencia<Rango>('recibos.analisis.rango', 'todo'))

  const recibos = useMemo(() => filtrarPorRango(todos ?? [], rango), [todos, rango])
  const serie = useMemo(() => serieSalarial(soloMensuales(recibos), eco), [recibos, eco])
  const anios = useMemo(() => [...new Set((todos ?? []).map((r) => r.periodo.slice(0, 4)))].sort().reverse(), [todos])

  if (!todos) return null
  if (!todos.length) {
    return (
      <section className="vacio">
        <h1 className="titulo">Análisis</h1>
        <p className="nota">Cuando cargues tus recibos vas a ver cómo evoluciona tu sueldo contra la inflación y el dólar.</p>
        <a className="boton" href="#/escanear">
          Cargar un recibo
        </a>
      </section>
    )
  }

  const elegirPestaña = (p: Pestaña) => {
    setPestaña(p)
    guardarPreferencia('recibos.analisis.pestaña', p)
  }

  return (
    <>
      <header className="encabezado">
        <Titulo icono="grafico">Análisis</Titulo>
        <label className="rango">
          <span className="rotulo">Período</span>
          <select
            className="entrada compacta"
            value={rango}
            onChange={(e) => {
              setRango(e.target.value as Rango)
              guardarPreferencia('recibos.analisis.rango', e.target.value)
            }}
          >
            <option value="todo">Todo</option>
            <option value="u12">Últimos 12 meses</option>
            <option value="u6">Últimos 6 meses</option>
            {anios.map((a) => (
              <option key={a} value={`a${a}`}>
                {a}
              </option>
            ))}
          </select>
        </label>
      </header>

      <div className="pestañas" role="tablist" aria-label="Tipo de análisis">
        {PESTAÑAS.map((p) => (
          <button key={p.id} role="tab" aria-selected={pestaña === p.id} onClick={() => elegirPestaña(p.id)}>
            {p.nombre}
          </button>
        ))}
        {eco.cargando && <span className="nota">Actualizando índices…</span>}
      </div>

      {eco.errores > 0 && !eco.cargando && <p className="aviso">No se pudieron descargar algunos índices (INDEC o dólar). Se muestran los últimos guardados, si hay.</p>}

      {todos.length === 1 && (
        <p className="aviso">Tenés un solo recibo cargado. Subí los de meses anteriores para ver la evolución: en Cargar podés arrastrar varios juntos.</p>
      )}

      {!recibos.length ? (
        <SinDatos>No hay recibos en este período.</SinDatos>
      ) : (
        <div role="tabpanel">
          {pestaña === 'resumen' && <Resumen recibos={recibos} todos={todos} eco={eco} serie={serie} />}
          {pestaña === 'inflacion' && <Inflacion todos={recibos} eco={eco} serie={serie} />}
          {pestaña === 'composicion' && <Composicion recibos={recibos} />}
          {pestaña === 'conceptos' && <Conceptos recibos={recibos} eco={eco} />}
        </div>
      )}
    </>
  )
}
