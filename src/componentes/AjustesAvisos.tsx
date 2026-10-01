import { useState } from 'react'
import { activarNotificaciones, desactivarNotificaciones, notificacionesSoportadas, useAvisosActivos } from '../lib/avisos'

export function AjustesAvisos() {
  const activos = useAvisosActivos()
  const [mensaje, setMensaje] = useState<string | null>(null)

  if (!notificacionesSoportadas) {
    return <p className="nota">Este navegador no muestra notificaciones. El aviso igual aparece en Inicio cuando abrís la app.</p>
  }

  const permiso = Notification.permission
  return (
    <div className="pila">
      <p className="nota">
        Si pasa el 4° día hábil del mes y no cargaste el recibo del mes anterior, te avisamos: puede ser que no te hayan pagado o que te olvidaste de
        cargarlo. El aviso siempre aparece en Inicio; acá podés sumar una notificación de Windows.
      </p>
      <label className="opcion">
        <input
          type="checkbox"
          checked={Boolean(activos) && permiso === 'granted'}
          onChange={async (e) => {
            setMensaje(null)
            try {
              if (e.target.checked) {
                await activarNotificaciones()
                setMensaje('Listo: te vamos a avisar con una notificación.')
              } else {
                await desactivarNotificaciones()
              }
            } catch (err) {
              setMensaje(err instanceof Error ? err.message : String(err))
            }
          }}
        />
        <span>Avisarme con una notificación de Windows</span>
      </label>
      {permiso === 'denied' && (
        <p className="aviso">El navegador tiene bloqueadas las notificaciones de esta app. Habilitalas desde el candado de la barra de direcciones.</p>
      )}
      {mensaje && <p className="nota">{mensaje}</p>}
      <p className="nota">
        Con la app abierta (aunque sea en otra pestaña) revisa cada hora. Si además la instalás desde Chrome o Edge (ícono de instalar en la barra de
        direcciones), el navegador puede revisar también con la app cerrada, cuando él lo decida.
      </p>
    </div>
  )
}
