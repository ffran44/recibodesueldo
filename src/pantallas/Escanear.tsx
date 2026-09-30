import { useEffect, useRef, useState } from 'react'
import { EditorRecibo } from '../componentes/EditorRecibo'
import { Icono } from '../componentes/Icono'
import { extraerRecibo, SinApiKey } from '../lib/claude'
import { db, guardarRecibo } from '../lib/db'
import { nombrePeriodo } from '../lib/format'
import { navegar } from '../lib/ruta'
import { obtenerApiKey } from '../lib/settings'
import type { DatosRecibo } from '../lib/types'
import { useObjectUrl } from '../lib/useObjectUrl'

const VACIO: DatosRecibo = {
  periodo: new Date().toISOString().slice(0, 7),
  tipoLiquidacion: 'mensual',
  empleador: { nombre: '', cuit: null },
  empleado: { nombre: '', cuil: null, legajo: null, categoria: null, fechaIngreso: null, obraSocial: null },
  fechaPago: null,
  banco: null,
  sussUltimoDeposito: null,
  conceptos: [],
  totales: { remunerativo: null, noRemunerativo: null, retenciones: null, neto: null, netoEnLetras: null },
  costoEmpleador: null,
}

type Paso = { tipo: 'elegir' } | { tipo: 'leyendo'; desde: number } | { tipo: 'revisar'; datos: DatosRecibo; advertencias: string[] }

/** Archivos que llegaron con "Compartir" desde otra app (los guarda el service worker) */
async function tomarCompartidos(): Promise<File[]> {
  if (!('caches' in window)) return []
  const cache = await caches.open('compartidos')
  const pedidos = await cache.keys()
  const archivos: File[] = []
  for (const pedido of pedidos) {
    const res = await cache.match(pedido)
    if (res) {
      const nombre = decodeURIComponent(res.headers.get('X-Nombre') ?? 'compartido')
      archivos.push(new File([await res.blob()], nombre, { type: res.headers.get('Content-Type') ?? '' }))
    }
    await cache.delete(pedido)
  }
  return archivos
}

function Miniatura({ archivo, onQuitar }: { archivo: File; onQuitar?: () => void }) {
  const url = useObjectUrl(archivo)
  return (
    <figure className="miniatura">
      {archivo.type === 'application/pdf' ? <div className="pdf rotulo">PDF</div> : <img src={url} alt={archivo.name} />}
      {onQuitar && (
        <button type="button" className="icono-boton" aria-label={`Quitar ${archivo.name}`} onClick={onQuitar}>
          <Icono nombre="error" tamaño={16} />
        </button>
      )}
    </figure>
  )
}

export function Escanear({ compartido }: { compartido: boolean }) {
  const [archivos, setArchivos] = useState<File[]>([])
  const [paso, setPaso] = useState<Paso>({ tipo: 'elegir' })
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [segundos, setSegundos] = useState(0)
  const [duplicado, setDuplicado] = useState<string | null>(null)
  const camara = useRef<HTMLInputElement>(null)
  const galeria = useRef<HTMLInputElement>(null)
  const tieneClave = Boolean(obtenerApiKey())
  const vistaPrevia = useObjectUrl(archivos.find((f) => f.type.startsWith('image/')))

  const agregar = (nuevos: FileList | File[] | null) => {
    const validos = [...(nuevos ?? [])].filter((f) => f.type.startsWith('image/') || f.type === 'application/pdf')
    if (validos.length) setArchivos((a) => [...a, ...validos])
  }

  useEffect(() => {
    if (compartido) tomarCompartidos().then(agregar)
  }, [compartido])

  // Pegar una captura con Ctrl+V
  useEffect(() => {
    const alPegar = (e: ClipboardEvent) => agregar(e.clipboardData ? [...e.clipboardData.files] : null)
    window.addEventListener('paste', alPegar)
    return () => window.removeEventListener('paste', alPegar)
  }, [])

  useEffect(() => {
    if (paso.tipo !== 'leyendo') return
    const t = setInterval(() => setSegundos(Math.round((Date.now() - paso.desde) / 1000)), 1000)
    return () => clearInterval(t)
  }, [paso])

  async function leer() {
    setError(null)
    setSegundos(0)
    setPaso({ tipo: 'leyendo', desde: Date.now() })
    try {
      const { datos, advertencias } = await extraerRecibo(archivos)
      await revisar(datos, advertencias)
    } catch (e) {
      setPaso({ tipo: 'elegir' })
      setError(e instanceof SinApiKey ? e.message : `No se pudo leer el recibo: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  async function revisar(datos: DatosRecibo, advertencias: string[]) {
    const mismos = await db.recibos.where('periodo').equals(datos.periodo).toArray()
    const dup = mismos.find((r) => r.tipoLiquidacion === datos.tipoLiquidacion && r.empleador.nombre.toLowerCase() === datos.empleador.nombre.toLowerCase())
    setDuplicado(dup ? `Ya tenés guardado un recibo de ${nombrePeriodo(datos.periodo)} de ${dup.empleador.nombre}. Si guardás, quedan los dos.` : null)
    setPaso({ tipo: 'revisar', datos, advertencias })
  }

  if (paso.tipo === 'revisar') {
    return (
      <>
        <header className="encabezado">
          <h1 className="titulo">Revisá lo leído</h1>
        </header>
        {paso.advertencias.length > 0 && (
          <div className="aviso">
            <strong>Conviene revisar:</strong>
            <ul>
              {paso.advertencias.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
        )}
        {archivos.length > 0 && (
          <details className="foto-referencia hoja">
            <summary className="rotulo">Ver la foto para comparar</summary>
            {archivos.map((f, i) => (
              <Miniatura key={i} archivo={f} />
            ))}
          </details>
        )}
        <EditorRecibo
          inicial={paso.datos}
          aviso={duplicado}
          guardando={guardando}
          onCancelar={() => setPaso({ tipo: 'elegir' })}
          onGuardar={async ({ notas, ...datos }) => {
            setGuardando(true)
            const ahora = new Date().toISOString()
            const id = crypto.randomUUID()
            await guardarRecibo({ ...datos, id, notas, creadoEn: ahora, actualizadoEn: ahora, advertenciasLectura: paso.advertencias }, archivos)
            navegar(`/recibo/${id}`)
          }}
        />
      </>
    )
  }

  if (paso.tipo === 'leyendo') {
    return (
      <section className="leyendo" aria-live="polite">
        <div className="leyendo-hoja">
          {vistaPrevia && <img src={vistaPrevia} alt="" />}
          <span className="leyendo-linea" />
        </div>
        <h1 className="titulo">Leyendo el recibo…</h1>
        <p className="nota">
          Transcribiendo cada concepto y verificando totales. Suele tardar entre 20 y 60 segundos. <span className="cifra">{segundos}s</span>
        </p>
      </section>
    )
  }

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        agregar(e.dataTransfer.files)
      }}
    >
      <header className="encabezado">
        <h1 className="titulo">Escanear recibo</h1>
      </header>

      {!tieneClave && (
        <p className="aviso">
          Para leer fotos automáticamente necesitás cargar tu API key de Anthropic en <a href="#/ajustes">Ajustes</a>. Mientras tanto podés cargarlo a mano.
        </p>
      )}

      <input ref={camara} type="file" accept="image/*" capture="environment" hidden onChange={(e) => agregar(e.target.files)} />
      <input ref={galeria} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => agregar(e.target.files)} />

      {archivos.length === 0 ? (
        <div className="origenes">
          <button type="button" className="origen hoja" onClick={() => camara.current?.click()}>
            <Icono nombre="camara" tamaño={28} />
            <strong>Sacar foto</strong>
            <span className="nota">Con buena luz, el recibo plano y entero en cuadro</span>
          </button>
          <button type="button" className="origen hoja" onClick={() => galeria.current?.click()}>
            <Icono nombre="subir" tamaño={28} />
            <strong>Elegir foto o PDF</strong>
            <span className="nota">También podés arrastrarlo, pegarlo o compartirlo desde WhatsApp</span>
          </button>
        </div>
      ) : (
        <>
          <div className="miniaturas">
            {archivos.map((f, i) => (
              <Miniatura key={`${f.name}-${i}`} archivo={f} onQuitar={() => setArchivos((a) => a.filter((_, j) => j !== i))} />
            ))}
            <button type="button" className="miniatura agregar" onClick={() => galeria.current?.click()} aria-label="Agregar otra página">
              <Icono nombre="mas" />
              <span className="nota">Otra página</span>
            </button>
          </div>
          <button type="button" className="boton ancho" disabled={!tieneClave} onClick={leer}>
            Leer recibo
          </button>
        </>
      )}

      {error && (
        <p className="error-texto" role="alert">
          {error}
        </p>
      )}

      <p className="nota centro">
        <button type="button" className="enlace" onClick={() => revisar(VACIO, [])}>
          Cargar a mano
        </button>
      </p>
    </div>
  )
}
