import { useId } from 'react'
import type { EstadoChequeo } from '../lib/audit'
import { nombrePeriodo } from '../lib/format'

const LEYENDA: Record<EstadoChequeo, string> = {
  ok: 'CONFORME',
  alerta: 'REVISAR',
  error: 'OBSERVADO',
  info: 'CONFORME',
}

/** Sello de goma: el resultado de la auditoría, como el sello del establecimiento en el recibo */
export function Sello({ estado, periodo, tamaño = 104 }: { estado: EstadoChequeo; periodo: string; tamaño?: number }) {
  const id = useId().replace(/:/g, '')
  const circulo = `c${id}`
  const tinta = `t${id}`
  const leyenda = LEYENDA[estado]
  return (
    <svg
      className={`sello sello-${estado}`}
      viewBox="0 0 120 120"
      width={tamaño}
      height={tamaño}
      role="img"
      aria-label={`Auditoría del recibo: ${leyenda.toLowerCase()}`}
    >
      <defs>
        <path id={circulo} d="M60,60 m-45,0 a45,45 0 1,1 90,0 a45,45 0 1,1 -90,0" />
        {/* Grano de tinta: la goma nunca apoya parejo */}
        <filter id={tinta}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="ruido" />
          <feColorMatrix in="ruido" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.3 1.55" result="mascara" />
          <feComposite in="SourceGraphic" in2="mascara" operator="in" />
        </filter>
      </defs>
      <g filter={`url(#${tinta})`} fill="none" stroke="currentColor">
        <circle cx="60" cy="60" r="56" strokeWidth="3.5" />
        <circle cx="60" cy="60" r="38" strokeWidth="1.2" />
        <text fill="currentColor" stroke="none" fontSize="10.5" fontWeight="700" letterSpacing="1.6" style={{ fontFamily: 'var(--f-display)', fontStretch: '110%' }}>
          <textPath href={`#${circulo}`} startOffset="0">
            {`RECIBO AUDITADO · ${nombrePeriodo(periodo).toUpperCase()} ·`}
          </textPath>
        </text>
        <text
          x="60"
          y="66"
          textAnchor="middle"
          fill="currentColor"
          stroke="none"
          fontSize={leyenda.length > 8 ? 13 : 15}
          fontWeight="900"
          style={{ fontFamily: 'var(--f-display)', fontStretch: '72%' }}
        >
          {leyenda}
        </text>
      </g>
    </svg>
  )
}
