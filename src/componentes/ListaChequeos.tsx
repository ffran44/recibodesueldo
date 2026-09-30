import type { Chequeo } from '../lib/audit'
import { Icono } from './Icono'

const ETIQUETA = { ok: 'Correcto', alerta: 'Revisar', error: 'No cierra', info: 'Dato' } as const

export function ListaChequeos({ chequeos }: { chequeos: Chequeo[] }) {
  if (!chequeos.length) return <p className="nota">Faltan totales impresos para verificar las cuentas.</p>
  // Primero lo que requiere atención
  const orden = { error: 0, alerta: 1, info: 2, ok: 3 }
  return (
    <ul className="chequeos">
      {[...chequeos]
        .sort((a, b) => orden[a.estado] - orden[b.estado])
        .map((c) => (
          <li key={c.id} className={`chequeo chequeo-${c.estado}`}>
            <span className="chequeo-marca">
              <Icono nombre={c.estado} tamaño={18} titulo={ETIQUETA[c.estado]} />
            </span>
            <div>
              <strong>{c.titulo}</strong>
              <p>{c.detalle}</p>
            </div>
          </li>
        ))}
    </ul>
  )
}
