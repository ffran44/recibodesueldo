import { useState } from 'react'
import {
  dejarDeRespaldar,
  elegirCarpeta,
  reactivarRespaldo,
  respaldarAhora,
  respaldoSoportado,
  restaurarDesdeCarpeta,
  useRespaldo,
} from '../lib/respaldoAuto'

const relativo = new Intl.RelativeTimeFormat('es-AR', { numeric: 'auto' })

export function haceCuanto(iso: string) {
  const segundos = (new Date(iso).getTime() - Date.now()) / 1000
  if (segundos > -60) return 'recién'
  if (segundos > -3600) return relativo.format(Math.round(segundos / 60), 'minute')
  if (segundos > -86400) return relativo.format(Math.round(segundos / 3600), 'hour')
  return relativo.format(Math.round(segundos / 86400), 'day')
}

const cancelado = (e: unknown) => e instanceof DOMException && e.name === 'AbortError'

export function RespaldoAuto() {
  const estado = useRespaldo()
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [paraRestaurar, setParaRestaurar] = useState<number | null>(null)

  if (!respaldoSoportado) {
    return (
      <p className="nota">
        Este navegador no permite guardar en una carpeta. Abrí la app en Chrome o Edge para activar el respaldo automático, o descargá el respaldo a mano.
      </p>
    )
  }

  const accion = (fn: () => Promise<unknown>, exito?: string) => async () => {
    setMensaje(null)
    try {
      await fn()
      if (exito) setMensaje(exito)
    } catch (e) {
      if (!cancelado(e)) setMensaje(e instanceof Error ? e.message : String(e))
    }
  }

  const elegir = accion(async () => {
    const { recibosEnCarpeta } = await elegirCarpeta()
    setParaRestaurar(recibosEnCarpeta)
  })

  if (!estado.carpeta) {
    return (
      <div className="pila">
        <p className="nota">
          Elegí una carpeta y la app guarda ahí una copia cada vez que cargás, editás o borrás un recibo. Si es una carpeta de Google Drive o OneDrive, la copia
          queda también en la nube. Incluye las fotos: elegí una carpeta tuya.
        </p>
        <button className="boton" onClick={elegir}>
          Elegir carpeta
        </button>
        {mensaje && <p className="error-texto">{mensaje}</p>}
      </div>
    )
  }

  return (
    <div className="pila">
      <p className="estado-respaldo">
        <span className={`punto ${estado.permiso === 'granted' && !estado.error ? 'activo' : 'pausa'}`} aria-hidden />
        <span>
          Guardando en la carpeta <strong>{estado.carpeta}</strong>
          <br />
          <span className="nota">
            {estado.guardando
              ? 'Guardando…'
              : estado.ultimo
                ? `Último respaldo ${haceCuanto(estado.ultimo.fecha)} · ${estado.ultimo.recibos} recibos`
                : 'Todavía no hay recibos para respaldar.'}
          </span>
        </span>
      </p>

      {estado.permiso !== 'granted' && (
        <div className="aviso">
          El navegador pide permiso de nuevo para escribir en la carpeta (pasa después de cerrarlo). Si te ofrece «Permitir en cada visita», elegilo y no vuelve a
          preguntar.
          <div className="acciones izquierda">
            <button className="boton" onClick={accion(reactivarRespaldo)}>
              Reactivar respaldo
            </button>
          </div>
        </div>
      )}

      {estado.error && <p className="error-texto">No se pudo guardar el respaldo: {estado.error}</p>}

      {paraRestaurar != null && (
        <div className="aviso">
          En esa carpeta hay un respaldo con {paraRestaurar} recibos y esta app está vacía. ¿Lo restauro?
          <div className="acciones izquierda">
            <button
              className="boton"
              onClick={accion(async () => {
                const n = await restaurarDesdeCarpeta()
                setParaRestaurar(null)
                setMensaje(`Se restauraron ${n} recibos.`)
              })}
            >
              Restaurar {paraRestaurar} recibos
            </button>
            <button className="boton secundario" onClick={() => setParaRestaurar(null)}>
              No, gracias
            </button>
          </div>
        </div>
      )}

      <div className="acciones izquierda">
        <button className="boton secundario" disabled={estado.guardando} onClick={accion(respaldarAhora, 'Respaldo guardado.')}>
          Respaldar ahora
        </button>
        <button className="boton secundario" onClick={elegir}>
          Cambiar carpeta
        </button>
        <button
          className="boton secundario"
          onClick={accion(async () => {
            const n = await restaurarDesdeCarpeta()
            setMensaje(`Se restauraron ${n} recibos desde la carpeta.`)
          })}
        >
          Restaurar desde la carpeta
        </button>
        <button className="boton peligro" onClick={accion(dejarDeRespaldar, 'Respaldo automático desactivado. Los archivos de la carpeta quedan como estaban.')}>
          Dejar de respaldar
        </button>
      </div>
      {mensaje && <p className="nota">{mensaje}</p>}
      <p className="nota">
        En la carpeta quedan: <code>recibos-respaldo.json</code> (todo, con fotos), <code>recibos.csv</code> (para Excel) y <code>copias-diarias/</code> (una por
        día, las últimas 14). Si la app queda vacía, el respaldo anterior no se pisa.
      </p>
    </div>
  )
}
