import { useRef, useState } from 'react'
import { borrarTodo, exportarCsv, exportarRespaldo, importarRespaldo } from '../lib/backup'
import { guardarApiKey, guardarModelo, MODELOS, obtenerApiKey, obtenerModelo } from '../lib/settings'

export function Ajustes() {
  const [clave, setClave] = useState(obtenerApiKey() ?? '')
  const [modelo, setModelo] = useState(obtenerModelo())
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState(false)
  const archivo = useRef<HTMLInputElement>(null)

  return (
    <>
      <header className="encabezado">
        <h1 className="titulo">Ajustes</h1>
      </header>

      <section className="hoja tarjeta">
        <form
          className="campo"
          onSubmit={(e) => {
            e.preventDefault()
            guardarApiKey(clave)
            setMensaje(clave ? 'API key guardada en este dispositivo.' : 'API key borrada.')
          }}
        >
          <label className="campo">
            <span className="rotulo">API key de Anthropic</span>
            <input type="password" autoComplete="off" value={clave} onChange={(e) => setClave(e.target.value)} placeholder="sk-ant-…" />
          </label>
          <p className="nota">
            Se usa para leer las fotos y responder preguntas. Queda guardada solo en este navegador y se envía únicamente a Anthropic. Conseguila en{' '}
            <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
              console.anthropic.com
            </a>
            . Leer un recibo cuesta unos centavos de dólar.
          </p>
          <button className="boton">Guardar API key</button>
        </form>
      </section>

      <section className="seccion">
        <label className="campo">
          <span className="rotulo">Modelo</span>
          <select
            value={modelo}
            onChange={(e) => {
              setModelo(e.target.value)
              guardarModelo(e.target.value)
            }}
          >
            {MODELOS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="seccion">
        <span className="rotulo">Tus datos</span>
        <p className="nota">
          Todo se guarda en este dispositivo, no en un servidor. Si borrás los datos del navegador o cambiás de teléfono, los perdés: descargá un respaldo cada tanto.
        </p>
        <div className="acciones izquierda">
          <button className="boton" onClick={() => exportarRespaldo()}>
            Descargar respaldo
          </button>
          <button className="boton secundario" onClick={() => archivo.current?.click()}>
            Restaurar respaldo
          </button>
          <button className="boton secundario" onClick={() => exportarCsv()}>
            Exportar a Excel (CSV)
          </button>
        </div>
        <input
          ref={archivo}
          type="file"
          accept="application/json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (!f) return
            try {
              const n = await importarRespaldo(f)
              setMensaje(`Se restauraron ${n} recibos.`)
            } catch (err) {
              setMensaje(err instanceof Error ? err.message : 'No se pudo leer el respaldo.')
            }
            e.target.value = ''
          }}
        />
      </section>

      {mensaje && (
        <p className="aviso" role="status">
          {mensaje}
        </p>
      )}

      <section className="seccion">
        {confirmar ? (
          <div className="acciones izquierda">
            <span>Se borran todos los recibos y fotos de este dispositivo.</span>
            <button className="boton secundario" onClick={() => setConfirmar(false)}>
              Cancelar
            </button>
            <button
              className="boton peligro"
              onClick={async () => {
                await borrarTodo()
                setConfirmar(false)
                setMensaje('Se borraron todos los recibos.')
              }}
            >
              Borrar todo
            </button>
          </div>
        ) : (
          <button className="boton peligro" onClick={() => setConfirmar(true)}>
            Borrar todos los recibos
          </button>
        )}
      </section>

      <p className="nota seccion">
        Índices: IPC de INDEC (datos.gob.ar) · dólar y feriados de ArgentinaDatos. Los chequeos son orientativos y no reemplazan el asesoramiento de tu gremio o un contador.
      </p>
    </>
  )
}
