import { describe, expect, it } from 'vitest'
import { ocultarDatosPersonales } from './ocultar'

// Datos inventados
describe('ocultarDatosPersonales', () => {
  it('oculta el nombre después de la etiqueta y respeta lo que sigue en la línea', () => {
    const { texto } = ocultarDatosPersonales('Beneficiario: PEREZ JUAN CARLOS   O.S.: OSDE')
    expect(texto).toBe('Beneficiario: [NOMBRE]   O.S.: OSDE')
  })

  it('reconoce otras etiquetas de nombre', () => {
    expect(ocultarDatosPersonales('Apellido y Nombre: GOMEZ, ANA').texto).toBe('Apellido y Nombre: [NOMBRE]')
    expect(ocultarDatosPersonales('Empleado: LOPEZ MARIA | Categoría: A').texto).toBe('Empleado: [NOMBRE] | Categoría: A')
  })

  it('no toma un encabezado de columna como etiqueta ni cruza de línea', () => {
    const texto = 'Concepto   Empleador   Trabajador\nAP JUBILATORIO   74.030,18'
    expect(ocultarDatosPersonales(texto).texto).toBe(texto)
  })

  it('corta el nombre en "O.S." aunque el OCR lo lea como "0.5."', () => {
    expect(ocultarDatosPersonales('Beneficiario: PEREZ JUAN 0.5.:OSDE').texto).toBe('Beneficiario: [NOMBRE] 0.5.:OSDE')
    expect(ocultarDatosPersonales('Beneficiario: PEREZ JUAN 0S.:OSDE').texto).toBe('Beneficiario: [NOMBRE] 0S.:OSDE')
    expect(ocultarDatosPersonales('Beneficiario: PEREZ JUAN OS.:OSDE').texto).toBe('Beneficiario: [NOMBRE] OS.:OSDE')
  })

  it('no confunde Empleador con Empleado', () => {
    expect(ocultarDatosPersonales('Empleador: ESCUELA DEL SOL').texto).toBe('Empleador: ESCUELA DEL SOL')
  })

  it('oculta CUIL, CUIT, DNI y legajo', () => {
    const { texto, ocultos } = ocultarDatosPersonales('CUIL: 20-12345678-9  CUIT: 30712345678\nDNI 30.123.456  Legajo Nro.: 220')
    expect(texto).toBe('CUIL: [CUIL/CUIT]  CUIT: [CUIL/CUIT]\nDNI [DNI]  Legajo Nro.: [LEGAJO]')
    expect(ocultos).toEqual(expect.arrayContaining(['20-12345678-9', '30712345678', '30.123.456', '220']))
  })

  it('no toca importes', () => {
    const linea = 'ASIG BASICA   191.549,66   Jubilacion 11%   74.030,18   1210000'
    expect(ocultarDatosPersonales(linea).texto).toBe(linea)
  })

  it('oculta el nombre configurado aunque el OCR lo haya leído con errores', () => {
    const { texto } = ocultarDatosPersonales('Benaficro: PERES JUAN.   firma Juan Perez', { nombre: 'Juan Pérez' })
    expect(texto).not.toMatch(/PERES|JUAN|Juan|Perez/)
  })

  it('no oculta palabras parecidas cortas que no son el nombre', () => {
    const { texto } = ocultarDatosPersonales('ANTIGUEDAD  LEY 10.724', { nombre: 'Ana Ley' })
    // "LEY" coincide exacto con el apellido: se oculta; "ANTIGUEDAD" no
    expect(texto).toContain('ANTIGUEDAD')
  })
})
