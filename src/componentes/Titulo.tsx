import type { ReactNode } from 'react'
import { Icono, type NombreIcono } from './Icono'

/** Título de pantalla con el ícono de su sección en una ficha de color */
export function Titulo({ icono, children }: { icono: NombreIcono; children: ReactNode }) {
  return (
    <h1 className="titulo">
      <span className="ficha" aria-hidden>
        <Icono nombre={icono} />
      </span>
      {children}
    </h1>
  )
}
