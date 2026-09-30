import { useState } from 'react'
import { preguntar, SinApiKey } from '../lib/claude'
import { cotizacionAl } from '../lib/analysis'
import { useRecibos } from '../lib/useDatos'
import { useEconomia, type Economia } from '../lib/useEconomia'
import { obtenerApiKey } from '../lib/settings'

const SUGERENCIAS = [
  '¿Cuánto aumentó mi básico en el último año?',
  '¿Qué concepto creció más desde el primer recibo?',
  '¿Cuánto cobré en total este año?',
  '¿Mi sueldo le ganó a la inflación en los últimos 6 meses?',
  '¿Qué porcentaje de mi remunerativo se va en descuentos?',
]

function contextoEconomico(eco: Economia, desde: string) {
  const partes: string[] = []
  if (eco.ipc) {
    const meses = [...eco.ipc.entries()].filter(([p]) => p >= desde).sort(([a], [b]) => a.localeCompare(b))
    const variaciones = meses.slice(1).map(([p, v], i) => `${p}: ${(((v / meses[i][1]) - 1) * 100).toFixed(1)}%`)
    partes.push(`Inflación mensual (IPC INDEC): ${variaciones.join(', ')}.`)
  }
  const hoy = new Date().toISOString().slice(0, 10)
  if (eco.oficial) partes.push(`Dólar oficial hoy: $${cotizacionAl(eco.oficial, hoy)}.`)
  if (eco.blue) partes.push(`Dólar blue hoy: $${cotizacionAl(eco.blue, hoy)}.`)
  partes.push(`Fecha de hoy: ${hoy}.`)
  return partes.join(' ')
}

interface Intercambio {
  pregunta: string
  respuesta: string
  error?: boolean
}

export function Preguntar() {
  const recibos = useRecibos()
  const eco = useEconomia()
  const [texto, setTexto] = useState('')
  const [historial, setHistorial] = useState<Intercambio[]>([])
  const [pensando, setPensando] = useState(false)

  async function enviar(pregunta: string) {
    if (!pregunta.trim() || !recibos?.length || pensando) return
    setTexto('')
    setPensando(true)
    setHistorial((h) => [...h, { pregunta, respuesta: '' }])
    const actualizar = (respuesta: string, error = false) =>
      setHistorial((h) => h.map((x, i) => (i === h.length - 1 ? { ...x, respuesta, error } : x)))
    try {
      const desde = recibos[0].periodo
      const final = await preguntar(pregunta, recibos, contextoEconomico(eco, desde), (parcial) => actualizar(parcial))
      actualizar(final)
    } catch (e) {
      actualizar(e instanceof SinApiKey ? e.message : `No se pudo responder: ${e instanceof Error ? e.message : String(e)}`, true)
    } finally {
      setPensando(false)
    }
  }

  if (!recibos) return null

  return (
    <>
      <header className="encabezado">
        <h1 className="titulo">Preguntale a tus recibos</h1>
      </header>

      {!recibos.length ? (
        <p className="nota">Todavía no hay recibos para consultar.</p>
      ) : !obtenerApiKey() ? (
        <p className="aviso">
          Para hacer preguntas necesitás tu API key en <a href="#/ajustes">Ajustes</a>.
        </p>
      ) : (
        <>
          {historial.length === 0 && (
            <div className="sugerencias">
              {SUGERENCIAS.map((s) => (
                <button key={s} className="sugerencia" onClick={() => enviar(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}

          <div className="charla" aria-live="polite">
            {historial.map((x, i) => (
              <div key={i}>
                <p className="charla-pregunta">{x.pregunta}</p>
                <div className={`charla-respuesta hoja ${x.error ? 'error-texto' : ''}`}>{x.respuesta || <span className="nota">Pensando…</span>}</div>
              </div>
            ))}
          </div>

          <form
            className="preguntar"
            onSubmit={(e) => {
              e.preventDefault()
              enviar(texto)
            }}
          >
            <input className="entrada" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ej: ¿cuándo cobré más en dólares?" aria-label="Tu pregunta" />
            <button className="boton" disabled={pensando || !texto.trim()}>
              Preguntar
            </button>
          </form>
          <p className="nota">Se envían los números de tus recibos (sin fotos ni CUIL) a Anthropic para responder.</p>
        </>
      )}
    </>
  )
}
