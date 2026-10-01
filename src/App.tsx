import { lazy, Suspense } from 'react'
import { Icono, type NombreIcono } from './componentes/Icono'
import { useRuta } from './lib/ruta'
import { reactivarRespaldo, useRespaldo } from './lib/respaldoAuto'
import { Inicio } from './pantallas/Inicio'
import { Detalle } from './pantallas/Detalle'
import { Ajustes } from './pantallas/Ajustes'
import './componentes.css'

// Gráficos y SDK de Claude pesan: se cargan recién al entrar a esas pantallas
const Escanear = lazy(() => import('./pantallas/Escanear').then((m) => ({ default: m.Escanear })))
const Analisis = lazy(() => import('./pantallas/Analisis').then((m) => ({ default: m.Analisis })))
const Preguntar = lazy(() => import('./pantallas/Preguntar').then((m) => ({ default: m.Preguntar })))

const PESTAÑAS: { ruta: string; seccion: string; nombre: string; icono: NombreIcono; color: string; clase?: string }[] = [
  { ruta: '', seccion: 'recibos', nombre: 'Recibos', icono: 'recibos', color: 'var(--agua)' },
  { ruta: 'analisis', seccion: 'analisis', nombre: 'Análisis', icono: 'grafico', color: 'var(--celeste)' },
  { ruta: 'escanear', seccion: 'escanear', nombre: 'Cargar', icono: 'subir', color: 'var(--rosa)', clase: 'escanear' },
  { ruta: 'preguntar', seccion: 'preguntar', nombre: 'Preguntar', icono: 'preguntar', color: 'var(--ambar)' },
  { ruta: 'ajustes', seccion: 'ajustes', nombre: 'Ajustes', icono: 'ajustes', color: 'var(--lavanda)' },
]

export default function App() {
  const { partes, consulta } = useRuta()
  const respaldo = useRespaldo()
  const [seccion = '', id] = partes
  const colorSeccion = PESTAÑAS.find((p) => p.ruta === seccion)?.seccion ?? 'recibos'

  let pantalla
  switch (seccion) {
    case 'escanear':
      pantalla = <Escanear compartido={consulta.has('compartido')} />
      break
    case 'recibo':
      pantalla = id ? <Detalle id={id} editando={partes[2] === 'editar'} /> : <Inicio />
      break
    case 'analisis':
      pantalla = <Analisis />
      break
    case 'preguntar':
      pantalla = <Preguntar />
      break
    case 'ajustes':
      pantalla = <Ajustes />
      break
    default:
      pantalla = <Inicio />
  }

  return (
    <>
      <main className="app" data-seccion={colorSeccion}>
        {respaldo.carpeta && respaldo.permiso && respaldo.permiso !== 'granted' && (
          <p className="aviso aviso-global">
            El respaldo automático está en pausa: el navegador pide permiso de nuevo para escribir en la carpeta «{respaldo.carpeta}».{' '}
            <button className="enlace" onClick={() => reactivarRespaldo().catch(() => {})}>
              Reactivar
            </button>
          </p>
        )}
        <Suspense fallback={<p className="nota">Cargando…</p>}>{pantalla}</Suspense>
      </main>
      <nav className="barra" aria-label="Secciones">
        <a href="#/" className="marca">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width={28} height={28} />
          <span>Mis recibos</span>
        </a>
        {PESTAÑAS.map((p) => (
          <a
            key={p.ruta}
            href={`#/${p.ruta}`}
            className={p.clase}
            aria-current={seccion === p.ruta || (p.ruta === '' && seccion === 'recibo') ? 'page' : undefined}
          >
            <span className="ficha" style={{ '--color': p.color } as React.CSSProperties}>
              <Icono nombre={p.icono} />
            </span>
            <span>{p.nombre}</span>
          </a>
        ))}
      </nav>
    </>
  )
}
