import { useMemo, useState } from 'react'
import { Titulo } from '../componentes/Titulo'
import { basesDesdeRecibos, calcularLiquidacion, type Rubro } from '../lib/derechos'
import { fechaLarga, nombrePeriodo, pesos, pesosCorto } from '../lib/format'
import { useRecibos } from '../lib/useDatos'

const hoy = () => new Date().toISOString().slice(0, 10)

function textoAntiguedad({ anios, meses, dias }: { anios: number; meses: number; dias: number }) {
  const partes = [anios && `${anios} ${anios === 1 ? 'año' : 'años'}`, meses && `${meses} ${meses === 1 ? 'mes' : 'meses'}`, dias && `${dias} ${dias === 1 ? 'día' : 'días'}`].filter(Boolean)
  return partes.length ? partes.join(', ').replace(/, ([^,]*)$/, ' y $1') : 'menos de un día'
}

function Escenario({ titulo, total, rubros, color, nota }: { titulo: string; total: number; rubros: Rubro[]; color: string; nota: string }) {
  return (
    <section className="escenario hoja" style={{ '--color': color } as React.CSSProperties}>
      <span className="rotulo">{titulo}</span>
      <p className="escenario-total cifra">{pesos(total)}</p>
      <p className="nota">{nota}</p>
      <table className="tabla">
        <tbody>
          {rubros
            .filter((r) => r.monto > 0 || r.id === 'indemnizacion')
            .map((r) => (
              <tr key={r.id}>
                <td>
                  {r.nombre}
                  <span className="nota rubro-detalle">{r.detalle}</span>
                </td>
                <td className="cifra">{pesos(r.monto)}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </section>
  )
}

export function Derechos() {
  const recibos = useRecibos()
  const ultimo = recibos?.filter((r) => r.tipoLiquidacion === 'mensual').at(-1)
  const [ingreso, setIngreso] = useState<string | null>(null)
  const [egreso, setEgreso] = useState(hoy())
  const [incluirNoRem, setIncluirNoRem] = useState(false)

  const fechaIngreso = ingreso ?? ultimo?.empleado.fechaIngreso ?? ''
  const bases = useMemo(() => (recibos && egreso ? basesDesdeRecibos(recibos, egreso) : null), [recibos, egreso])
  const resultado = useMemo(
    () => (bases && fechaIngreso && egreso >= fechaIngreso ? calcularLiquidacion({ ingreso: fechaIngreso, egreso, bases, incluirNoRemunerativo: incluirNoRem }) : null),
    [bases, fechaIngreso, egreso, incluirNoRem],
  )

  if (!recibos) return null
  if (!ultimo || !bases) {
    return (
      <section className="vacio">
        <Titulo icono="escudo">Mis derechos</Titulo>
        <p className="nota">Cargá al menos un recibo mensual para calcular cuánto te corresponde si te despiden o si renunciás.</p>
        <a className="boton" href="#/escanear">
          Cargar un recibo
        </a>
      </section>
    )
  }

  return (
    <>
      <header className="encabezado">
        <Titulo icono="escudo">Mis derechos</Titulo>
      </header>

      <div className="dos-columnas derechos">
        <div className="pila columna-fija">
          <section className="hoja tarjeta pila">
            <span className="rotulo">Tus datos</span>
            <label className="campo">
              <span className="rotulo">Fecha de ingreso</span>
              <input type="date" value={fechaIngreso} onChange={(e) => setIngreso(e.target.value)} />
            </label>
            <label className="campo">
              <span className="rotulo">Fecha de salida a simular</span>
              <input type="date" value={egreso} min={fechaIngreso || undefined} onChange={(e) => setEgreso(e.target.value || hoy())} />
            </label>
            {resultado && (
              <p className="antiguedad">
                Antigüedad: <strong>{textoAntiguedad(resultado.antiguedad)}</strong>
                {resultado.enPrueba && <span className="nota"> · todavía en período de prueba (6 meses)</span>}
              </p>
            )}
          </section>

          <section className="hoja tarjeta pila">
            <span className="rotulo">Con qué se calcula</span>
            <dl className="valores sin-borde">
              <div>
                <dt>Mejor sueldo del último año</dt>
                <dd className="cifra">{pesos(bases.mejorRemunerativa + (incluirNoRem ? bases.noRemunerativaMensual : 0))}</dd>
              </div>
              <div>
                <dt>Último mes completo</dt>
                <dd className="cifra">{pesos(bases.ultimaTotal)}</dd>
              </div>
              <div>
                <dt>Mejor remunerativo del semestre</dt>
                <dd className="cifra">{pesos(bases.mejorRemSemestre)}</dd>
              </div>
            </dl>
            <label className="opcion">
              <input type="checkbox" checked={incluirNoRem} onChange={(e) => setIncluirNoRem(e.target.checked)} />
              <span>
                Incluir las sumas no remunerativas en la indemnización
                <span className="nota"> ({pesosCorto(bases.noRemunerativaMensual)} por mes). La ley las excluye, pero muchos tribunales las suman.</span>
              </span>
            </label>
            <p className="nota">Sale de tus recibos; el último cargado es de {nombrePeriodo(ultimo.periodo)}. Si cobrás distinto ahora, cargá el recibo nuevo.</p>
          </section>
        </div>

        <div className="pila">
          {!fechaIngreso ? (
            <p className="aviso">Completá tu fecha de ingreso para hacer el cálculo.</p>
          ) : !resultado ? (
            <p className="aviso">La fecha de salida tiene que ser posterior al ingreso.</p>
          ) : (
            <>
              <Escenario
                titulo="Si te despiden sin causa"
                total={resultado.totalDespido}
                rubros={resultado.despido}
                color="var(--rosa)"
                nota={`Al ${fechaLarga(egreso)}. Te lo tienen que pagar dentro de los 4 días hábiles.`}
              />
              <Escenario
                titulo="Si renunciás"
                total={resultado.totalRenuncia}
                rubros={resultado.renuncia}
                color="var(--celeste)"
                nota="Sin indemnización. Tenés que avisar con 15 días de anticipación (o te pueden descontar ese preaviso)."
              />
            </>
          )}

          <section className="hoja tarjeta pila letra-chica">
            <span className="rotulo">Tené en cuenta</span>
            <ul>
              <li>Es una estimación con la Ley de Contrato de Trabajo y las reformas de 2024 (ley 27.742) y 2026 (ley 27.802). No es asesoramiento legal.</li>
              <li>Montos brutos: a los días trabajados y al aguinaldo se les descuentan aportes; la indemnización, el preaviso, la integración y las vacaciones no gozadas no tienen descuentos.</li>
              <li>
                No se aplica el tope de tu convenio (3 veces el sueldo promedio del convenio). Si cobrás bien por encima del promedio, la indemnización puede ser
                menor, aunque nunca menos del 67% de lo calculado.
              </li>
              <li>Si sos docente, tu estatuto puede darte derechos adicionales. Ante un despido, no firmes nada sin consultar a tu gremio o a un abogado. Tenés 2 años para reclamar.</li>
            </ul>
          </section>
        </div>
      </div>
    </>
  )
}
