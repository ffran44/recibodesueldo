import { useEffect, useState } from 'react'

/** URL temporal para mostrar un Blob; se libera al desmontar */
export function useObjectUrl(blob: Blob | null | undefined) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!blob) return setUrl(undefined)
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url
}
