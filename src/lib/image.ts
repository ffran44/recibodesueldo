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
