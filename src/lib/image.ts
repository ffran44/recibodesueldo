/** Achica la foto para mandarla más rápido y barata sin perder legibilidad */
export async function prepararImagen(archivo: Blob, ladoMax = 2000, calidad = 0.88): Promise<{ base64: string; tipo: 'image/jpeg' }> {
  const bitmap = await createImageBitmap(archivo)
  const escala = Math.min(1, ladoMax / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * escala)
  canvas.height = Math.round(bitmap.height * escala)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob>((ok, mal) => canvas.toBlob((b) => (b ? ok(b) : mal(new Error('No se pudo procesar la imagen'))), 'image/jpeg', calidad))
  return { base64: await aBase64(blob), tipo: 'image/jpeg' }
}

export async function aBase64(blob: Blob): Promise<string> {
  const url = await new Promise<string>((ok, mal) => {
    const lector = new FileReader()
    lector.onload = () => ok(lector.result as string)
    lector.onerror = () => mal(lector.error)
    lector.readAsDataURL(blob)
  })
  return url.slice(url.indexOf(',') + 1)
}

export async function desdeBase64(base64: string, tipo: string): Promise<Blob> {
  const res = await fetch(`data:${tipo};base64,${base64}`)
  return res.blob()
}
