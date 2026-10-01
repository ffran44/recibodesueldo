import { useRef, useState } from 'react'
import { Titulo } from '../componentes/Titulo'
import { RespaldoAuto } from '../componentes/RespaldoAuto'
import { AjustesAvisos } from '../componentes/AjustesAvisos'
import { borrarTodo, exportarCsv, exportarRespaldo, importarRespaldo } from '../lib/backup'
import {
  guardarApiKey,
  guardarModelo,
  guardarNombrePropio,
  guardarProveedor,
  obtenerApiKey,
  obtenerModelo,
  obtenerNombrePropio,
  obtenerProveedor,
  PROVEEDORES,
  type Proveedor,
} from '../lib/settings'

export function Ajustes() {
  const [proveedor, setProveedor] = useState<Proveedor>(obtenerProveedor())
  const [clave, setClave] = useState(obtenerApiKey(proveedor) ?? '')
  const [modelo, setModelo] = useState(obtenerModelo(proveedor))
  const [nombre, setNombre] = useState(obtenerNombrePropio())
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState(false)
  const archivo = useRef<HTMLInputElement>(null)
  const info = PROVEEDORES[proveedor]

  const cambiarProveedor = (p: Proveedor) => {
    setProveedor(p)
    guardarProveedor(p)
    setClave(obtenerApiKey(p) ?? '')
    setModelo(obtenerModelo(p))
    setMensaje(null)
  }

  return (
    <>
      <header className="encabezado">
        <Titulo icono="ajustes">Ajustes</Titulo>
      </header>

      <div className="grilla-ajustes">
        <section className="hoja tarjeta pila">
          <span className="rotulo">Quién ordena los datos del recibo</span>
          <div className="segmentos" role="group" aria-label="Servicio">
            {(Object.keys(PROVEEDORES) as Proveedor[]).map((p) => (
              <button key={p} type="button" aria-pressed={proveedor === p} onClick={() => cambiarProveedor(p)}>
                {PROVEEDORES[p].nombre}
              </button>
            ))}
          </div>
          <p className="nota">{info.detalle}</p>

          <form
            className="pila"
            onSubmit={(e) => {
              e.preventDefault()
              guardarApiKey(proveedor, clave)
              setMensaje(clave ? `API key de ${info.nombre} guardada en esta computadora.` : 'API key borrada.')
            }}
          >
            <label className="campo">
              <span className="rotulo">API key</span>
              <input type="password" autoComplete="off" value={clave} onChange={(e) => setClave(e.target.value)} placeholder={proveedor === 'gemini' ? 'AIza…' : 'sk-ant-…'} />
            </label>
            <p className="nota">
              {proveedor === 'gemini' ? 'Es gratis y no pide tarjeta: ' : 'Conseguila en '}
              <a href={info.consola} target="_blank" rel="noreferrer">
                {new URL(info.consola).hostname}
              </a>
              {proveedor === 'gemini' ? ' → "Create API key".' : '.'} Queda guardada solo en este navegador.
            </p>
            <label className="campo">
              <span className="rotulo">Modelo</span>
              <select
                value={modelo}
                onChange={(e) => {
                  setModelo(e.target.value)
                  guardarModelo(proveedor, e.target.value)
                }}
              >
                {info.modelos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            </label>
            <button className="boton">Guardar API key</button>
          </form>
        </section>

        <section className="hoja tarjeta pila">
          <span className="rotulo">Privacidad</span>
          <form
            className="pila"
            onSubmit={(e) => {
              e.preventDefault()
              guardarNombrePropio(nombre)
              setMensaje(nombre ? 'Listo: tu nombre se va a ocultar de todo lo que se envíe.' : 'Nombre borrado.')
            }}
          >
            <label className="campo">
              <span className="rotulo">Tu nombre y apellido</span>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="name" />
            </label>
            <p className="nota">
              Se usa solo en esta computadora para borrarlo del texto antes de enviarlo, aunque la lectura lo haya escrito con errores. El CUIL, CUIT, DNI y
              legajo se ocultan siempre.
            </p>
            <button className="boton secundario">Guardar nombre</button>
          </form>
        </section>

        <section className="hoja tarjeta pila">
          <span className="rotulo">Avisos</span>
          <AjustesAvisos />
        </section>

        <section className="hoja tarjeta pila respaldo-auto">
          <span className="rotulo">Respaldo automático</span>
          <RespaldoAuto />
        </section>

        <section className="hoja tarjeta pila">
          <span className="rotulo">Tus datos</span>
          <p className="nota">
            Todo se guarda en este navegador, no en un servidor. Además del respaldo automático, podés descargar una copia o pasar tus recibos a Excel.
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
          {confirmar ? (
            <div className="acciones izquierda">
              <span>Se borran todos los recibos y fotos de este navegador.</span>
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
      </div>

      {mensaje && (
        <p className="aviso seccion" role="status">
          {mensaje}
        </p>
      )}

      <p className="nota seccion">
        Lectura local con Tesseract. Índices: IPC de INDEC (datos.gob.ar) · dólar y feriados de ArgentinaDatos. Los chequeos son orientativos y no reemplazan el
        asesoramiento de tu gremio o un contador.
      </p>
    </>
  )
}
