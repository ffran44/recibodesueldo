import { useState } from 'react'
import { matrizConceptos } from '../lib/indicadores'
import type { SerieMensual } from '../lib/analysis'
import { nombrePeriodo, porcentaje } from '../lib/format'
import type { DatosRecibo } from '../lib/types'

const compacto = new Intl.NumberFormat('es-AR', { notation: 'compact', maximumFractionDigits: 1 })
const TIPOS = { remunerativo: 'Remunerativos', no_remunerativo: 'No remunerativos', retencion: 'Descuentos' } as const

/** Intensidad del color: 20 puntos de diferencia contra la inflación ya es el máximo */
function fondo(diferencia: number | null) {
  if (diferencia == null || Math.abs(diferencia) < 0.002) return undefined
  const intensidad = Math.min(60, Math.round(Math.abs(diferencia) * 300))
  return `color-mix(in oklab, var(${diferencia > 0 ? '--div-pos' : '--div-neg'}) ${intensidad}%, var(--div-neutro))`
}

export function MapaConceptos({ recibos, ipc }: { recibos: DatosRecibo[]; ipc?: SerieMensual }) {
  const [vista, setVista] = useState<'variacion' | 'importe'>('variacion')
  const { periodos, filas } = matrizConceptos(recibos, ipc)
  if (periodos.length < 2) return null

  // En descuentos, subir más que la inflación no es bueno: se invierte el color
  const signo = (tipo: string) => (tipo === 'retencion' ? -1 : 1)

  return (
    <section className="seccion">
      <div className="fila-titulo">
        <span className="rotulo">Cada concepto, mes a mes</span>
        <div className="segmentos" role="group" aria-label="Qué mostrar">
          <button aria-pressed={vista === 'variacion'} onClick={() => setVista('variacion')}>
            Variación
          </button>
          <button aria-pressed={vista === 'importe'} onClick={() => setVista('importe')}>
            Importes
          </button>
        </div>
      </div>
      {vista === 'variacion' && ipc && (
        <p className="nota escala">
          <span className="escala-muestra" style={{ background: 'color-mix(in oklab, var(--div-neg) 60%, var(--div-neutro))' }} /> Subió menos que la inflación
          <span className="escala-muestra" style={{ background: 'var(--div-neutro)' }} /> Igual
          <span className="escala-muestra" style={{ background: 'color-mix(in oklab, var(--div-pos) 60%, var(--div-neutro))' }} /> Le ganó (en descuentos, al revés)
        </p>
      )}
      <div className="desplazable hoja">
        <table className="mapa">
          <thead>
            <tr>
              <th scope="col">Concepto</th>
              {periodos.map((p) => (
                <th scope="col" key={p}>
                  {nombrePeriodo(p, true)}
                </th>
              ))}
            </tr>
          </thead>
          {(['remunerativo', 'no_remunerativo', 'retencion'] as const).map((tipo) => {
            const delTipo = filas.filter((f) => f.tipo === tipo)
            if (!delTipo.length) return null
            return (
              <tbody key={tipo}>
                <tr className="mapa-grupo">
                  <th scope="rowgroup" colSpan={periodos.length + 1}>
                    {TIPOS[tipo]}
                  </th>
                </tr>
                {delTipo.map((f) => (
                  <tr key={f.nombre}>
                    <th scope="row">{f.nombre}</th>
                    {f.valores.map((v, i) => {
                      const variacion = f.variaciones[i]
                      const vsInf = f.vsInflacion[i]
                      const detalle =
                        v == null
                          ? 'No figura este mes'
                          : `${compacto.format(v)}${variacion != null ? ` · ${porcentaje(variacion, true)} vs mes anterior` : ''}${vsInf != null ? ` · ${porcentaje(vsInf, true)} contra la inflación` : ''}`
                      return (
                        <td
                          key={i}
                          className="cifra"
                          title={`${f.nombre}, ${nombrePeriodo(periodos[i])}: ${detalle}`}
                          style={{ background: vista === 'variacion' ? fondo(vsInf != null ? vsInf * signo(tipo) : null) : undefined }}
                        >
                          {v == null ? '—' : vista === 'importe' ? compacto.format(v) : variacion == null ? '·' : porcentaje(variacion, true)}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            )
          })}
        </table>
      </div>
    </section>
  )
}
