import type { ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts'
import { nombrePeriodo } from '../lib/format'
import { useTokens } from '../lib/useTokens'
import { Icono, type NombreIcono } from './Icono'

export interface Serie {
  clave: string
  nombre: string
  color: string
}

type Formato = (n: number) => string

const etiquetaEje = (v: string) => (/^\d{4}-\d{2}$/.test(v) ? nombrePeriodo(v, true) : v)

function Globo({ active, payload, label, formato }: TooltipContentProps & { formato: Formato }) {
  if (!active || !payload?.length) return null
  return (
    <div className="globo">
      <strong>{/^\d{4}-\d{2}$/.test(String(label)) ? nombrePeriodo(String(label)) : label}</strong>
      {payload
        .filter((p) => p.value != null)
        .map((p) => (
          <div key={String(p.dataKey)}>
            <span className="globo-marca" style={{ background: p.color ?? (p.payload as { color?: string })?.color }} />
            {p.name}: <span className="cifra">{formato(Number(p.value))}</span>
          </div>
        ))}
    </div>
  )
}

export function Leyenda({ series }: { series: Serie[] }) {
  if (series.length < 2) return null
  return (
    <ul className="leyenda">
      {series.map((s) => (
        <li key={s.clave}>
          <span className="globo-marca" style={{ background: s.color }} />
          {s.nombre}
        </li>
      ))}
    </ul>
  )
}

interface PropsBase {
  datos: object[]
  series: Serie[]
  formato: Formato
  formatoEje?: Formato
  eje?: string
  alto?: number
  referencia?: { y: number; etiqueta?: string }
}

export function Lineas({ datos, series, formato, formatoEje = formato, eje = 'periodo', alto = 240, referencia }: PropsBase) {
  const tk = useTokens()
  return (
    <div className="grafico hoja">
      <Leyenda series={series} />
      <ResponsiveContainer width="100%" height={alto}>
        <LineChart data={datos} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={tk['--regla']} vertical={false} />
          <XAxis dataKey={eje} tickFormatter={etiquetaEje} stroke={tk['--tinta-3']} tickLine={false} fontSize={11} minTickGap={16} />
          <YAxis tickFormatter={formatoEje} stroke={tk['--tinta-3']} tickLine={false} axisLine={false} fontSize={11} width={56} domain={['auto', 'auto']} />
          {referencia && (
            <ReferenceLine
              y={referencia.y}
              stroke={tk['--tinta-3']}
              label={referencia.etiqueta ? { value: referencia.etiqueta, position: 'insideTopLeft', fill: tk['--tinta-2'], fontSize: 11 } : undefined}
            />
          )}
          <Tooltip content={(p) => <Globo {...p} formato={formato} />} cursor={{ stroke: tk['--tinta-3'] }} />
          {series.map((s) => (
            <Line
              key={s.clave}
              dataKey={s.clave}
              name={s.nombre}
              stroke={s.color}
              strokeWidth={2}
              dot={{ r: 4, strokeWidth: 2, stroke: tk['--hoja'], fill: s.color }}
              activeDot={{ r: 6, stroke: tk['--hoja'], strokeWidth: 2 }}
              isAnimationActive={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Barra con el extremo de datos redondeado y la base recta, también para valores negativos */
function BarraRedondeada(props: { x?: number; y?: number; width?: number; height?: number; fill?: string; value?: number | number[] }) {
  let { x = 0, y = 0, width = 0, height = 0 } = props
  if (height < 0) {
    y += height
    height = -height
  }
  if (!height || !width) return null
  const valor = Array.isArray(props.value) ? props.value[1] - props.value[0] : (props.value ?? 0)
  const r = Math.min(4, width / 2, height)
  const d =
    valor >= 0
      ? `M${x},${y + height} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + height} Z`
      : `M${x},${y} V${y + height - r} Q${x},${y + height} ${x + r},${y + height} H${x + width - r} Q${x + width},${y + height} ${x + width},${y + height - r} V${y} Z`
  return <path d={d} fill={props.fill} />
}

export function Barras({
  datos,
  series,
  formato,
  formatoEje = formato,
  eje = 'periodo',
  alto = 240,
  modo = 'agrupadas',
  colorPorSigno,
  referencia,
}: PropsBase & { modo?: 'agrupadas' | 'apiladas'; colorPorSigno?: { positivo: string; negativo: string } }) {
  const tk = useTokens()
  return (
    <div className="grafico hoja">
      <Leyenda series={series} />
      <ResponsiveContainer width="100%" height={alto}>
        <BarChart data={datos} margin={{ top: 8, right: 16, bottom: 0, left: 0 }} barGap={2} barCategoryGap="22%">
          <CartesianGrid stroke={tk['--regla']} vertical={false} />
          <XAxis dataKey={eje} tickFormatter={etiquetaEje} stroke={tk['--tinta-3']} tickLine={false} fontSize={11} minTickGap={8} />
          <YAxis tickFormatter={formatoEje} stroke={tk['--tinta-3']} tickLine={false} axisLine={false} fontSize={11} width={56} />
          <ReferenceLine y={referencia?.y ?? 0} stroke={tk['--tinta-3']} />
          <Tooltip content={(p) => <Globo {...p} formato={formato} />} cursor={{ fill: tk['--regla'], fillOpacity: 0.35 }} />
          {series.map((s, i) => (
            <Bar
              key={s.clave}
              dataKey={s.clave}
              name={s.nombre}
              fill={s.color}
              stackId={modo === 'apiladas' ? 'pila' : undefined}
              maxBarSize={24}
              isAnimationActive={false}
              // En una pila solo el segmento de arriba lleva el extremo redondeado; el resto se separa con la luz de 2px
              shape={modo === 'apiladas' && i < series.length - 1 ? undefined : BarraRedondeada}
              stroke={modo === 'apiladas' ? tk['--hoja'] : undefined}
              strokeWidth={modo === 'apiladas' ? 2 : 0}
            >
              {colorPorSigno &&
                datos.map((d, j) => (
                  <Cell key={j} fill={Number((d as Record<string, unknown>)[s.clave]) >= 0 ? colorPorSigno.positivo : colorPorSigno.negativo} />
                ))}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function Tarjeta({
  titulo,
  valor,
  detalle,
  tono,
  color,
  icono,
}: {
  titulo: string
  valor: ReactNode
  detalle?: ReactNode
  tono?: 'bien' | 'mal'
  /** Variable CSS del color de la tarjeta, por ejemplo 'var(--turquesa)' */
  color?: string
  icono?: NombreIcono
}) {
  return (
    <div className="tarjeta-dato hoja" style={color ? ({ '--color': color } as React.CSSProperties) : undefined}>
      <span className="tarjeta-cabeza">
        {icono && (
          <span className="ficha" aria-hidden>
            <Icono nombre={icono} tamaño={18} />
          </span>
        )}
        <span className="rotulo">{titulo}</span>
      </span>
      <span className={`tarjeta-valor cifra ${tono === 'bien' ? 'haber' : tono === 'mal' ? 'descuento' : ''}`}>{valor}</span>
      {detalle && <span className="nota">{detalle}</span>}
    </div>
  )
}

export function SinDatos({ children }: { children: ReactNode }) {
  return <p className="sin-datos nota hoja">{children}</p>
}
