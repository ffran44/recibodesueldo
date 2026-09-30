import type { Worker } from 'tesseract.js'

/** Lectura local: la foto nunca sale de la computadora */

export type Progreso = (etapa: string, fraccion?: number) => void

let trabajador: Promise<Worker> | null = null
let avisar: Progreso = () => {}

async function obtenerTrabajador() {
  trabajador ??= (async () => {
    const { createWorker } = await import('tesseract.js')
    // La primera vez descarga el idioma español (~2 MB); después queda en caché
    const w = await createWorker('spa', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') avisar('Leyendo el texto', m.progress)
        else if (m.status.startsWith('loading')) avisar('Preparando el lector', m.progress)
      },
    })
    await w.setParameters({ preserve_interword_spaces: '1' })
    return w
  })()
  return trabajador
}

/**
 * Las fotos de WhatsApp vienen muy comprimidas: agrandarlas y subir el contraste
 * mejora muchísimo la lectura (medido: de ~60% a casi todos los importes correctos).
 */
export async function prepararParaOcr(archivo: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(archivo)
  const escala = Math.min(3, 4800 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * Math.max(1, escala))
  canvas.height = Math.round(bitmap.height * Math.max(1, escala))
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  autocontraste(ctx, canvas.width, canvas.height)
  return canvas
}

/** Escala de grises y estiramiento de contraste descartando el 2% de extremos */
function autocontraste(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const img = ctx.getImageData(0, 0, w, h)
  const px = img.data
  const histograma = new Uint32Array(256)
  for (let i = 0; i < px.length; i += 4) {
    const gris = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000
    px[i] = gris
    histograma[gris | 0]++
  }
  const total = w * h
  const percentil = (desde: number, paso: number) => {
    let i = desde
    for (let acum = histograma[i]; acum < total * 0.02 && i > 0 && i < 255; acum += histograma[i]) i += paso
    return i
  }
  const bajo = percentil(0, 1)
  const alto = percentil(255, -1)
  const rango = Math.max(1, alto - bajo)
  const gris = new Float32Array(w * h)
  for (let i = 0, j = 0; i < px.length; i += 4, j++) gris[j] = Math.max(0, Math.min(255, ((px[i] - bajo) * 255) / rango))

  // Máscara de enfoque: separa dígitos que el agrandado dejó pegados (1.2 × detalle, radio ~2 px)
  const borroso = desenfocar(desenfocar(gris, w, h, 2), w, h, 2)
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    const v = Math.max(0, Math.min(255, gris[j] + 1.2 * (gris[j] - borroso[j])))
    px[i] = px[i + 1] = px[i + 2] = v
  }
  ctx.putImageData(img, 0, 0)
}

/** Desenfoque de caja separable (horizontal y vertical), O(n) por píxel sin importar el radio */
function desenfocar(origen: Float32Array, w: number, h: number, r: number) {
  const tmp = new Float32Array(origen.length)
  const out = new Float32Array(origen.length)
  const n = 2 * r + 1
  for (let y = 0; y < h; y++) {
    const fila = y * w
    let suma = 0
    for (let x = -r; x <= r; x++) suma += origen[fila + Math.min(w - 1, Math.max(0, x))]
    for (let x = 0; x < w; x++) {
      tmp[fila + x] = suma / n
      suma += origen[fila + Math.min(w - 1, x + r + 1)] - origen[fila + Math.max(0, x - r)]
    }
  }
  for (let x = 0; x < w; x++) {
    let suma = 0
    for (let y = -r; y <= r; y++) suma += tmp[Math.min(h - 1, Math.max(0, y)) * w + x]
    for (let y = 0; y < h; y++) {
      out[y * w + x] = suma / n
      suma += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x]
    }
  }
  return out
}

async function leerImagen(fuente: Blob | HTMLCanvasElement) {
  const w = await obtenerTrabajador()
  const lienzo = fuente instanceof HTMLCanvasElement ? fuente : await prepararParaOcr(fuente)
  const { data } = await w.recognize(lienzo)
  return data.text
}

/** PDF: si trae texto (recibo digital) se usa directo; si es un escaneo, se pasa por OCR */
async function leerPdf(archivo: Blob, progreso: Progreso) {
  const pdfjs = await import('pdfjs-dist')
  const { default: urlTrabajador } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = urlTrabajador
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await archivo.arrayBuffer()) }).promise
  const paginas: string[] = []
  for (let n = 1; n <= doc.numPages; n++) {
    progreso(`Leyendo página ${n} de ${doc.numPages}`, (n - 1) / doc.numPages)
    const pagina = await doc.getPage(n)
    const contenido = await pagina.getTextContent()
    const items = contenido.items.filter((i): i is typeof i & { str: string; transform: number[] } => 'str' in i && i.str.trim() !== '')
    if (items.length > 20) {
      paginas.push(textoConColumnas(items.map((i) => ({ texto: i.str, x: i.transform[4], y: i.transform[5] }))))
    } else {
      const vista = pagina.getViewport({ scale: 3 })
      const canvas = document.createElement('canvas')
      canvas.width = vista.width
      canvas.height = vista.height
      await pagina.render({ canvas, viewport: vista }).promise
      paginas.push(await leerImagen(canvas))
    }
  }
  return paginas.join('\n\n')
}

/** Reconstruye las filas del PDF respetando columnas (el modelo entiende mejor la tabla) */
export function textoConColumnas(items: { texto: string; x: number; y: number }[]) {
  const filas = new Map<number, { texto: string; x: number }[]>()
  for (const it of items) {
    const clave = [...filas.keys()].find((y) => Math.abs(y - it.y) < 3) ?? it.y
    filas.set(clave, [...(filas.get(clave) ?? []), it])
  }
  return [...filas.entries()]
    .sort(([a], [b]) => b - a)
    .map(([, fila]) => {
      let linea = ''
      for (const it of fila.sort((a, b) => a.x - b.x)) {
        const columna = Math.round(it.x / 5)
        linea += (linea.length < columna ? ' '.repeat(columna - linea.length) : ' ') + it.texto
      }
      return linea.trimEnd()
    })
    .join('\n')
}

export async function leerArchivos(archivos: Blob[], progreso: Progreso): Promise<string> {
  const textos: string[] = []
  for (const [i, archivo] of archivos.entries()) {
    const pagina = archivos.length > 1 ? ` (${i + 1}/${archivos.length})` : ''
    avisar = (etapa, f) => progreso(etapa + pagina, f)
    textos.push(archivo.type === 'application/pdf' ? await leerPdf(archivo, avisar) : await leerImagen(archivo))
  }
  return textos.join('\n\n--- página siguiente ---\n\n')
}
