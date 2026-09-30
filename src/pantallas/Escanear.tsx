import { useEffect, useRef, useState } from 'react'
import { EditorRecibo } from '../componentes/EditorRecibo'
import { Icono } from '../componentes/Icono'
import { VisorArchivo } from '../componentes/VisorArchivo'
import { interpretarTexto, SinApiKey } from '../lib/ia'
import { leerArchivos } from '../lib/ocr'
import { ocultarDatosPersonales } from '../lib/ocultar'
import { db, guardarRecibo } from '../lib/db'
import { nombrePeriodo } from '../lib/format'
import { navegar } from '../lib/ruta'
import { obtenerApiKey, obtenerNombrePropio, obtenerProveedor, PROVEEDORES } from '../lib/settings'
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

type Paso =
  | { tipo: 'elegir' }
  | { tipo: 'leyendo'; etapa: string; fraccion: number }
  | { tipo: 'enviar'; texto: string; ocultos: string[] }
  | { tipo: 'interpretando' }
  | { tipo: 'revisar'; datos: DatosRecibo; advertencias: string[] }

/** Archivos que llegaron con "Compartir" desde otra app (los guarda el service worker) */
async function tomarCompartidos(): Promise<File[]> {
  if (!('caches' in window)) return []
  const cache = await caches.open('compartidos')
  const archivos: File[] = []
  for (const pedido of await cache.keys()) {
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
      <figcaption className="nota">{archivo.name}</figcaption>
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
  const [separados, setSeparados] = useState(false)
  // Grupos de archivos pendientes: cada grupo es un recibo
  const [cola, setCola] = useState<File[][]>([])
  const [paso, setPaso] = useState<Paso>({ tipo: 'elegir' })
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [duplicado, setDuplicado] = useState<string | null>(null)
  const [arrastrando, setArrastrando] = useState(false)
  const selector = useRef<HTMLInputElement>(null)

  const proveedor = obtenerProveedor()
  const servicio = PROVEEDORES[proveedor].nombre.replace(/ \(.*\)/, '')
  const tieneClave = Boolean(obtenerApiKey(proveedor))
  const actual = cola[0] ?? []

  const agregar = (nuevos: FileList | File[] | null) => {
    const validos = [...(nuevos ?? [])].filter((f) => f.type.startsWith('image/') || f.type === 'application/pdf')
    if (validos.length) setArchivos((a) => [...a, ...validos])
  }

  useEffect(() => {
    if (compartido) tomarCompartidos().then(agregar)
  }, [compartido])

  // Pegar una captura o una imagen copiada de WhatsApp Web con Ctrl+V
  useEffect(() => {
    const alPegar = (e: ClipboardEvent) => {
      if (paso.tipo === 'elegir') agregar(e.clipboardData ? [...e.clipboardData.files] : null)
    }
    window.addEventListener('paste', alPegar)
    return () => window.removeEventListener('paste', alPegar)
  }, [paso.tipo])

  async function leer(grupo: File[]) {
    setError(null)
    setPaso({ tipo: 'leyendo', etapa: 'Preparando', fraccion: 0 })
    try {
      const textoOcr = await leerArchivos(grupo, (etapa, fraccion = 0) => setPaso({ tipo: 'leyendo', etapa, fraccion }))
      const { texto, ocultos } = ocultarDatosPersonales(textoOcr, { nombre: obtenerNombrePropio() })
      setPaso({ tipo: 'enviar', texto, ocultos })
    } catch (e) {
      setPaso({ tipo: 'elegir' })
      setError(`No se pudo leer el archivo: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  function empezar() {
    const grupos = separados ? archivos.map((f) => [f]) : [archivos]
    setCola(grupos)
    setArchivos([])
    leer(grupos[0])
  }

  async function interpretar(texto: string) {
    setError(null)
    setPaso({ tipo: 'interpretando' })
    try {
      const { datos, advertencias } = await interpretarTexto(texto)
      await revisar(datos, advertencias)
    } catch (e) {
      setPaso({ tipo: 'enviar', texto, ocultos: [] })
      setError(e instanceof SinApiKey ? e.message : `${servicio} no pudo interpretar el recibo: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  async function revisar(datos: DatosRecibo, advertencias: string[]) {
    const mismos = await db.recibos.where('periodo').equals(datos.periodo).toArray()
    const dup = mismos.find((r) => r.tipoLiquidacion === datos.tipoLiquidacion && r.empleador.nombre.toLowerCase() === datos.empleador.nombre.toLowerCase())
    setDuplicado(dup ? `Ya tenés guardado un recibo de ${nombrePeriodo(datos.periodo)} de ${dup.empleador.nombre}. Si guardás, quedan los dos.` : null)
    setPaso({ tipo: 'revisar', datos, advertencias })
  }

  function siguiente(idGuardado?: string) {
    const resto = cola.slice(1)
    setCola(resto)
    if (resto.length) leer(resto[0])
    else if (idGuardado) navegar(`/recibo/${idGuardado}`)
    else setPaso({ tipo: 'elegir' })
  }

  const progresoCola = cola.length > 1 || (cola.length === 1 && separados) ? <span className="rotulo">Quedan {cola.length} recibos</span> : null

  if (paso.tipo === 'leyendo' || paso.tipo === 'interpretando') {
    const leyendo = paso.tipo === 'leyendo'
    return (
      <section className="leyendo" aria-live="polite">
        <h1 className="titulo">{leyendo ? 'Leyendo en tu computadora…' : `${servicio} está ordenando los datos…`}</h1>
        <p className="nota">{leyendo ? `${paso.etapa}. La foto no sale de tu equipo.` : 'Suele tardar entre 5 y 30 segundos.'}</p>
        <div className="progreso" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={leyendo ? Math.round(paso.fraccion * 100) : undefined}>
          <span style={{ width: leyendo ? `${Math.max(4, paso.fraccion * 100)}%` : undefined }} className={leyendo ? '' : 'indeterminado'} />
        </div>
        {progresoCola}
      </section>
    )
  }

  if (paso.tipo === 'enviar') {
    return (
      <>
        <header className="encabezado">
          <h1 className="titulo">Revisá lo que se envía</h1>
          {progresoCola}
        </header>
        <div className="dos-columnas">
          <div className="columna-fija">{actual[0] && <VisorArchivo archivo={actual[0]} />}</div>
          <div className="pila">
            <p className="nota">
              Esto es todo lo que va a recibir {servicio}: el texto leído en tu computadora, sin la foto.{' '}
              {paso.ocultos.length > 0 ? (
                <>
                  Se ocultaron {paso.ocultos.length} datos personales: <span className="ocultos">{paso.ocultos.join(' · ')}</span>.
                </>
              ) : (
                'No se detectaron datos personales para ocultar.'
              )}{' '}
              Si ves algo tuyo, borralo del texto. Para que tu nombre se oculte siempre, cargalo en <a href="#/ajustes">Ajustes</a>.
            </p>
            <textarea
              className="entrada texto-envio cifra"
              value={paso.texto}
              onChange={(e) => setPaso({ ...paso, texto: e.target.value })}
              spellCheck={false}
              aria-label="Texto que se envía"
            />
            {!tieneClave && (
              <p className="aviso">
                Falta tu API key de {servicio} (es gratis). Cargala en <a href="#/ajustes">Ajustes</a> o cargá el recibo a mano.
              </p>
            )}
            {error && (
              <p className="error-texto" role="alert">
                {error}
              </p>
            )}
            <div className="acciones">
              <button type="button" className="boton secundario" onClick={() => revisar(VACIO, [])}>
                Cargar a mano sin enviar
              </button>
              <button type="button" className="boton" disabled={!tieneClave || !paso.texto.trim()} onClick={() => interpretar(paso.texto)}>
                Enviar a {servicio}
              </button>
            </div>
          </div>
        </div>
      </>
    )
  }

  if (paso.tipo === 'revisar') {
    return (
      <>
        <header className="encabezado">
          <h1 className="titulo">Revisá y guardá</h1>
          {progresoCola}
        </header>
        <div className="dos-columnas">
          <div className="columna-fija">{actual[0] && <VisorArchivo archivo={actual[0]} />}</div>
          <div className="pila">
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
            <EditorRecibo
              key={actual[0]?.name ?? 'manual'}
              inicial={paso.datos}
              aviso={duplicado}
              guardando={guardando}
              onCancelar={() => siguiente()}
              textoCancelar={cola.length > 1 ? 'Saltear este' : 'Cancelar'}
              onGuardar={async ({ notas, ...datos }) => {
                setGuardando(true)
                const ahora = new Date().toISOString()
                const id = crypto.randomUUID()
                await guardarRecibo({ ...datos, id, notas, creadoEn: ahora, actualizadoEn: ahora, advertenciasLectura: paso.advertencias }, actual)
                setGuardando(false)
                siguiente(id)
              }}
            />
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <header className="encabezado">
        <h1 className="titulo">Cargar recibos</h1>
      </header>

      <input ref={selector} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => agregar(e.target.files)} />

      <div
        className={`zona-soltar ${arrastrando ? 'activa' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setArrastrando(true)
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => {
          e.preventDefault()
          setArrastrando(false)
          agregar(e.dataTransfer.files)
        }}
      >
        {archivos.length === 0 ? (
          <button type="button" className="zona-vacia" onClick={() => selector.current?.click()}>
            <Icono nombre="subir" tamaño={32} />
            <strong>Arrastrá acá las fotos o PDFs de tus recibos</strong>
            <span className="nota">
              o hacé clic para elegirlos · también podés copiar la imagen en WhatsApp Web y pegarla con <kbd>Ctrl</kbd>+<kbd>V</kbd>
            </span>
          </button>
        ) : (
          <div className="miniaturas">
            {archivos.map((f, i) => (
              <Miniatura key={`${f.name}-${i}`} archivo={f} onQuitar={() => setArchivos((a) => a.filter((_, j) => j !== i))} />
            ))}
            <button type="button" className="miniatura agregar" onClick={() => selector.current?.click()}>
              <Icono nombre="mas" />
              <span className="nota">Agregar</span>
            </button>
          </div>
        )}
      </div>

      {archivos.length > 1 && (
        <fieldset className="opciones-grupo">
          <legend className="rotulo">Estos {archivos.length} archivos son…</legend>
          <label>
            <input type="radio" name="grupo" checked={!separados} onChange={() => setSeparados(false)} /> Páginas de un mismo recibo
          </label>
          <label>
            <input type="radio" name="grupo" checked={separados} onChange={() => setSeparados(true)} /> Recibos distintos (se revisan uno por uno)
          </label>
        </fieldset>
      )}

      {archivos.length > 0 && (
        <div className="acciones">
          <button type="button" className="boton" onClick={empezar}>
            Leer {separados && archivos.length > 1 ? `${archivos.length} recibos` : 'recibo'}
          </button>
        </div>
      )}

      {error && (
        <p className="error-texto" role="alert">
          {error}
        </p>
      )}

      <p className="nota privacidad">
        Cómo se lee: primero tu computadora lee la foto (no se sube a ningún lado). Después se ocultan nombre, CUIL, CUIT y legajo, y solo ese texto se
        manda a {servicio} para ordenarlo. Antes de enviar ves exactamente qué se manda.
      </p>

      <p className="nota centro">
        <button type="button" className="enlace" onClick={() => revisar(VACIO, [])}>
          Cargar un recibo a mano
        </button>
      </p>
    </>
  )
}
