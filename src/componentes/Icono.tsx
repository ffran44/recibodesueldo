const trazos = {
  recibos: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3zM9 8h6M9 12h6M9 16h3',
  camara: 'M4 8h3l2-3h6l2 3h3v11H4V8zM12 17a4 4 0 100-8 4 4 0 000 8z',
  grafico: 'M4 20V4M4 20h16M8 16l4-5 3 3 5-7',
  preguntar: 'M4 5h16v11H9l-5 4V5zM9.5 9a2.5 2.5 0 015 0c0 1.5-2.5 1.8-2.5 3M12 14.5v.01',
  ajustes: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19 12l2-1-1-3-2.3.2-1.5-1.6.2-2.3-3-1-1 2h-1.8l-1-2-3 1 .2 2.3L6.3 7.2 4 7l-1 3 2 1v2l-2 1 1 3 2.3-.2 1.5 1.6-.2 2.3 3 1 1-2h1.8l1 2 3-1-.2-2.3 1.5-1.6 2.3.2 1-3-2-1z',
  ok: 'M5 12.5l4.5 4.5L19 7.5',
  alerta: 'M12 4l9 16H3l9-16zM12 10v4M12 17v.01',
  error: 'M6 6l12 12M18 6L6 18',
  info: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 11v6M12 7.5v.01',
  atras: 'M15 5l-7 7 7 7',
  mas: 'M12 5v14M5 12h14',
  basura: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',
  lapiz: 'M4 20l4-1 11-11-3-3L5 16l-1 4z',
  subir: 'M12 16V4M7 9l5-5 5 5M5 20h14',
  plata: 'M3 7h18v10H3V7zM12 15a3 3 0 100-6 3 3 0 000 6zM6 10v4M18 10v4',
  tendencia: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  baja: 'M3 7l6 6 4-4 8 8M15 17h6v-6',
  regalo: 'M4 11h16v9H4v-9zM3 7h18v4H3V7zM12 7v13M12 7c-1.5-3-5-3-5-1s3 1 5 1zM12 7c1.5-3 5-3 5-1s-3 1-5 1z',
  calendario: 'M4 6h16v14H4V6zM4 10h16M8 3v5M16 3v5',
  objetivo: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 16a4 4 0 100-8 4 4 0 000 8zM12 12h.01',
  dolar: 'M12 3v18M16 7.5c0-1.9-1.8-3-4-3s-4 1.1-4 3 1.8 2.6 4 3 4 1.1 4 3-1.8 3-4 3-4-1.1-4-3',
  escudo: 'M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3z',
} as const

export type NombreIcono = keyof typeof trazos

export function Icono({ nombre, tamaño = 22, titulo }: { nombre: NombreIcono; tamaño?: number; titulo?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={tamaño}
      height={tamaño}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={titulo ? undefined : true}
      role={titulo ? 'img' : undefined}
    >
      {titulo && <title>{titulo}</title>}
      <path d={trazos[nombre]} />
    </svg>
  )
}
