/**
 * Quita del texto del recibo lo que te identifica antes de mandarlo a un servicio externo.
 * Se queda: montos, conceptos, fechas, empleador. Se va: nombre, CUIL/CUIT, DNI, legajo.
 */

export interface ResultadoOcultar {
  texto: string
  /** Lo que se ocultó, para mostrárselo a la persona */
  ocultos: string[]
}

const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()

function distancia(a: string, b: string) {
  const fila = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let previo = fila[0]
    fila[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = fila[j]
      fila[j] = Math.min(fila[j] + 1, fila[j - 1] + 1, previo + (a[i - 1] === b[j - 1] ? 0 : 1))
      previo = tmp
    }
  }
  return fila[b.length]
}

/** Tolerancia a errores del OCR: más larga la palabra, más letras mal leídas se aceptan */
const toleranciaPara = (largo: number) => (largo >= 7 ? 2 : largo >= 5 ? 1 : 0)

// Hasta el final de la línea, un separador de columna (2+ espacios o |) o la próxima etiqueta.
// "O.S." suele salir del OCR como "0.5."
const HASTA_FIN = String.raw`[^\n|]*?(?=[ \t]{2,}|[ \t]*\||[ \t]+(?:[O0]\.?[ ]?[S5]\.|O\.?S\b|CUIL\b|CUIT\b|DNI\b|Legajo\b|Cat\w*\b)|$)`

// "Beneficiario" es inequívoco; las demás podrían ser encabezados de columna, así que exigen ":"
const ETIQUETAS_NOMBRE = [
  String.raw`benef\w*[ \t]*[:.]?`,
  String.raw`(?:apellidos?[ \t]*y[ \t]*nombres?|nombres?[ \t]*y[ \t]*apellidos?|empleado|trabajador(?:a)?|agente)[ \t]*:`,
]

export function ocultarDatosPersonales(texto: string, { nombre }: { nombre?: string | null } = {}): ResultadoOcultar {
  const ocultos: string[] = []
  const reemplazar = (patron: RegExp, marca: string, grupo = 0) => {
    texto = texto.replace(patron, (...m) => {
      const completo = m[0] as string
      const valor = (m[grupo] as string) ?? completo
      if (!valor.trim() || valor.includes('[')) return completo
      ocultos.push(valor.trim())
      return grupo === 0 ? marca : completo.replace(valor, marca)
    })
  }

  // Nombre detrás de una etiqueta ("Beneficiario:", "Apellido y Nombre:", ...)
  reemplazar(new RegExp(String.raw`\b(?:${ETIQUETAS_NOMBRE.join('|')})[ \t]*(${HASTA_FIN})`, 'gim'), '[NOMBRE]', 1)

  // CUIL / CUIT: 11 dígitos, con o sin guiones
  reemplazar(/\b\d{2}[-\s.]?\d{8}[-\s.]?\d\b/g, '[CUIL/CUIT]')

  // DNI: solo si está rotulado, para no tocar importes
  reemplazar(/\b(?:DNI|D\.N\.I\.|Documento)\s*(?:N[°ºro.]*)?\s*[:.]?\s*(\d{1,2}\.?\d{3}\.?\d{3})\b/gi, '[DNI]', 1)

  // Legajo
  reemplazar(/\bLegajo\s*(?:N[°ºro.]*)?\s*[:.=]?\s*(\w+)/gi, '[LEGAJO]', 1)

  // El nombre configurado por la persona, aunque el OCR lo haya leído con errores
  const partes = normalizar(nombre ?? '')
    .split(/[^A-ZÑ]+/)
    .filter((p) => p.length >= 3)
  if (partes.length) {
    texto = texto.replace(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{3,}/g, (palabra) => {
      const n = normalizar(palabra)
      const coincide = partes.some((p) => Math.abs(p.length - n.length) <= 2 && distancia(p, n) <= toleranciaPara(p.length))
      if (!coincide) return palabra
      ocultos.push(palabra)
      return '[NOMBRE]'
    })
  }

  return { texto, ocultos: [...new Set(ocultos)] }
}
