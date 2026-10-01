import { useSyncExternalStore } from 'react'
import { armarCsv, armarRespaldo, importarTextoRespaldo } from './backup'
import { escribirEnCarpeta, leerRespaldoDeCarpeta } from './carpeta'
import { borrarAjuste, db, guardarAjuste, leerAjuste } from './db'

/** Chrome y Edge de escritorio; Firefox y Safari no permiten escribir en carpetas */
export const respaldoSoportado = typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function'

const CLAVE_CARPETA = 'carpetaRespaldo'
const CLAVE_ULTIMO = 'ultimoRespaldo'

export interface EstadoRespaldo {
  carpeta: string | null
  permiso: PermissionState | null
  ultimo: { fecha: string; recibos: number } | null
  error: string | null
  guardando: boolean
}

let estado: EstadoRespaldo = { carpeta: null, permiso: null, ultimo: null, error: null, guardando: false }
const oyentes = new Set<() => void>()

function actualizar(cambios: Partial<EstadoRespaldo>) {
  estado = { ...estado, ...cambios }
  oyentes.forEach((f) => f())
}

export function useRespaldo() {
  return useSyncExternalStore(
    (f) => {
      oyentes.add(f)
      return () => oyentes.delete(f)
    },
    () => estado,
  )
}

const carpetaGuardada = () => leerAjuste<FileSystemDirectoryHandle>(CLAVE_CARPETA)

async function cargarEstado() {
  const carpeta = await carpetaGuardada()
  actualizar({
    carpeta: carpeta?.name ?? null,
    permiso: carpeta ? await carpeta.queryPermission({ mode: 'readwrite' }) : null,
    ultimo: (await leerAjuste<EstadoRespaldo['ultimo']>(CLAVE_ULTIMO)) ?? null,
  })
}

/** Abre el selector de carpetas. Si la app está vacía y la carpeta ya tiene un respaldo, avisa cuántos recibos trae. */
export async function elegirCarpeta(): Promise<{ recibosEnCarpeta: number | null }> {
  const carpeta = await window.showDirectoryPicker!({ id: 'recibos-respaldo', mode: 'readwrite', startIn: 'documents' })
  await guardarAjuste(CLAVE_CARPETA, carpeta)
  actualizar({ carpeta: carpeta.name, permiso: 'granted', error: null })

  let recibosEnCarpeta: number | null = null
  if ((await db.recibos.count()) === 0) {
    try {
      recibosEnCarpeta = (JSON.parse(await leerRespaldoDeCarpeta(carpeta)) as { recibos: unknown[] }).recibos.length
    } catch {
      // Carpeta nueva, sin respaldo previo
    }
  }
  await respaldarAhora()
  return { recibosEnCarpeta }
}

/** Después de reiniciar el navegador hay que volver a dar permiso (requiere un clic) */
export async function reactivarRespaldo() {
  const carpeta = await carpetaGuardada()
  if (!carpeta) return
  const permiso = await carpeta.requestPermission({ mode: 'readwrite' })
  actualizar({ permiso })
  if (permiso === 'granted') await respaldarAhora()
}

export async function dejarDeRespaldar() {
  await borrarAjuste(CLAVE_CARPETA)
  await borrarAjuste(CLAVE_ULTIMO)
  actualizar({ carpeta: null, permiso: null, ultimo: null, error: null })
}

let enCurso: Promise<void> | null = null
let pendiente = false

export async function respaldarAhora(): Promise<void> {
  // Si ya hay uno escribiendo, se hace otro al terminar para no perder cambios
  if (enCurso) {
    pendiente = true
    return enCurso
  }
  enCurso = (async () => {
    const carpeta = await carpetaGuardada()
    if (!carpeta) return
    const permiso = await carpeta.queryPermission({ mode: 'readwrite' })
    if (permiso !== 'granted') return actualizar({ permiso })
    actualizar({ guardando: true, permiso })
    try {
      const resultado = await escribirEnCarpeta(carpeta, await armarRespaldo(), await armarCsv(), new Date())
      if (resultado.escrito) {
        const ultimo = { fecha: new Date().toISOString(), recibos: resultado.recibos }
        await guardarAjuste(CLAVE_ULTIMO, ultimo)
        actualizar({ ultimo, error: null })
      }
    } catch (e) {
      actualizar({ error: e instanceof Error ? e.message : String(e) })
    } finally {
      actualizar({ guardando: false })
    }
  })()
  try {
    await enCurso
  } finally {
    enCurso = null
    if (pendiente) {
      pendiente = false
      await respaldarAhora()
    }
  }
}

let temporizador: ReturnType<typeof setTimeout> | undefined
const programarRespaldo = () => {
  clearTimeout(temporizador)
  temporizador = setTimeout(() => void respaldarAhora(), 1500)
}

export async function restaurarDesdeCarpeta() {
  const carpeta = await carpetaGuardada()
  if (!carpeta) throw new Error('Primero elegí la carpeta del respaldo.')
  if ((await carpeta.queryPermission({ mode: 'readwrite' })) !== 'granted') await carpeta.requestPermission({ mode: 'readwrite' })
  return importarTextoRespaldo(await leerRespaldoDeCarpeta(carpeta))
}

/** Cualquier recibo o foto que se crea, cambia o borra dispara un respaldo */
export function activarRespaldoAutomatico() {
  if (!respaldoSoportado) return
  for (const tabla of [db.recibos, db.adjuntos] as const) {
    tabla.hook('creating', programarRespaldo)
    tabla.hook('updating', programarRespaldo)
    tabla.hook('deleting', programarRespaldo)
  }
  void cargarEstado()
}
