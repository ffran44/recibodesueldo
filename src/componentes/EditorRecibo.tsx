import { useEffect, useMemo, useState } from 'react'
import type { Concepto, DatosRecibo, TipoConcepto, TipoLiquidacion } from '../lib/types'
import { auditar, sumaPorTipo } from '../lib/audit'
import { parsearMonto, pesos } from '../lib/format'
import { ListaChequeos } from './ListaChequeos'
import { Icono } from './Icono'

const fmt = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function CampoMonto({ valor, onCambio, etiqueta }: { valor: number | null; onCambio: (n: number | null) => void; etiqueta: string }) {
  const [texto, setTexto] = useState(valor == null ? '' : fmt.format(valor))
  const [editando, setEditando] = useState(false)
  useEffect(() => {
    if (!editando) setTexto(valor == null ? '' : fmt.format(valor))
  }, [valor, editando])
  return (
    <input
      className="entrada cifra"
      inputMode="decimal"
      aria-label={etiqueta}
      value={texto}
      onFocus={() => setEditando(true)}
      onChange={(e) => {
        setTexto(e.target.value)
        onCambio(parsearMonto(e.target.value))
      }}
      onBlur={() => setEditando(false)}
    />
  )
}

const TIPOS: { valor: TipoConcepto; nombre: string }[] = [
  { valor: 'remunerativo', nombre: 'Remunerativo' },
  { valor: 'no_remunerativo', nombre: 'No remunerativo' },
  { valor: 'retencion', nombre: 'Descuento' },
]

export function EditorRecibo({
  inicial,
  onGuardar,
  onCancelar,
  guardando,
  aviso,
}: {
  inicial: DatosRecibo & { notas?: string }
  onGuardar: (datos: DatosRecibo & { notas: string }) => void
  onCancelar: () => void
  guardando?: boolean
  aviso?: string | null
}) {
  const [d, setD] = useState<DatosRecibo & { notas: string }>(() => ({ notas: '', ...structuredClone(inicial) }))
  const chequeos = useMemo(() => auditar(d).filter((c) => c.id.startsWith('suma') || c.id === 'neto' || c.id === 'letras'), [d])

  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => setD((p) => ({ ...p, [k]: v }))
  const setConcepto = (i: number, cambios: Partial<Concepto>) =>
    setD((p) => ({ ...p, conceptos: p.conceptos.map((c, j) => (j === i ? { ...c, ...cambios } : c)) }))

  const valido = /^\d{4}-\d{2}$/.test(d.periodo) && d.empleador.nombre.trim() !== ''

  return (
    <form
      className="editor"
      onSubmit={(e) => {
        e.preventDefault()
        if (valido) onGuardar(d)
      }}
    >
      {aviso && <p className="aviso">{aviso}</p>}

      <fieldset className="hoja grilla">
        <legend className="rotulo">Datos del recibo</legend>
        <label className="campo">
          <span className="rotulo">Período</span>
          <input type="month" required value={d.periodo} onChange={(e) => set('periodo', e.target.value)} />
        </label>
        <label className="campo">
          <span className="rotulo">Tipo</span>
          <select value={d.tipoLiquidacion} onChange={(e) => set('tipoLiquidacion', e.target.value as TipoLiquidacion)}>
            <option value="mensual">Mensual</option>
            <option value="sac">Aguinaldo (SAC)</option>
            <option value="vacaciones">Vacaciones</option>
            <option value="final">Liquidación final</option>
            <option value="otro">Otro</option>
          </select>
        </label>
        <label className="campo doble">
          <span className="rotulo">Empleador</span>
          <input required value={d.empleador.nombre} onChange={(e) => set('empleador', { ...d.empleador, nombre: e.target.value })} />
        </label>
        <label className="campo">
          <span className="rotulo">Fecha de pago</span>
          <input type="date" value={d.fechaPago ?? ''} onChange={(e) => set('fechaPago', e.target.value || null)} />
        </label>
        <label className="campo">
          <span className="rotulo">Fecha de ingreso</span>
          <input type="date" value={d.empleado.fechaIngreso ?? ''} onChange={(e) => set('empleado', { ...d.empleado, fechaIngreso: e.target.value || null })} />
        </label>
        <label className="campo">
          <span className="rotulo">Categoría</span>
          <input value={d.empleado.categoria ?? ''} onChange={(e) => set('empleado', { ...d.empleado, categoria: e.target.value || null })} />
        </label>
        <label className="campo">
          <span className="rotulo">Últ. aportes depositados</span>
          <input
            type="month"
            value={d.sussUltimoDeposito?.periodo ?? ''}
            onChange={(e) => set('sussUltimoDeposito', { fecha: d.sussUltimoDeposito?.fecha ?? null, periodo: e.target.value || null })}
          />
        </label>
      </fieldset>

      <fieldset className="hoja conceptos">
        <legend className="rotulo">Conceptos</legend>
        {d.conceptos.map((c, i) => (
          <div className={`fila-concepto tipo-${c.tipo}`} key={i}>
            <input className="entrada" aria-label="Concepto" value={c.nombre} onChange={(e) => setConcepto(i, { nombre: e.target.value })} />
            <select className="entrada" aria-label="Columna" value={c.tipo} onChange={(e) => setConcepto(i, { tipo: e.target.value as TipoConcepto })}>
              {TIPOS.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.nombre}
                </option>
              ))}
            </select>
            <CampoMonto etiqueta={`Importe de ${c.nombre}`} valor={c.importe} onCambio={(n) => setConcepto(i, { importe: n ?? 0 })} />
            <button type="button" className="icono-boton" aria-label={`Quitar ${c.nombre}`} onClick={() => set('conceptos', d.conceptos.filter((_, j) => j !== i))}>
              <Icono nombre="basura" tamaño={18} />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="boton secundario"
          onClick={() => set('conceptos', [...d.conceptos, { codigo: null, nombre: '', cantidad: null, tipo: 'remunerativo', importe: 0 }])}
        >
          <Icono nombre="mas" tamaño={18} /> Agregar concepto
        </button>
      </fieldset>

      <fieldset className="hoja grilla">
        <legend className="rotulo">Totales impresos</legend>
        {(
          [
            ['remunerativo', 'Remunerativo', 'remunerativo'],
            ['noRemunerativo', 'No remunerativo', 'no_remunerativo'],
            ['retenciones', 'Descuentos', 'retencion'],
          ] as const
        ).map(([k, nombre, tipo]) => (
          <label className="campo" key={k}>
            <span className="rotulo">
              {nombre} <span className="nota cifra">(suma {pesos(sumaPorTipo(d, tipo))})</span>
            </span>
            <CampoMonto etiqueta={nombre} valor={d.totales[k]} onCambio={(n) => set('totales', { ...d.totales, [k]: n })} />
          </label>
        ))}
        <label className="campo">
          <span className="rotulo">Neto</span>
          <CampoMonto etiqueta="Neto" valor={d.totales.neto} onCambio={(n) => set('totales', { ...d.totales, neto: n })} />
        </label>
        <label className="campo">
          <span className="rotulo">Neto en letras</span>
          <CampoMonto etiqueta="Neto en letras" valor={d.totales.netoEnLetras} onCambio={(n) => set('totales', { ...d.totales, netoEnLetras: n })} />
        </label>
      </fieldset>

      <section>
        <span className="rotulo">¿Cierran las cuentas?</span>
        <ListaChequeos chequeos={chequeos} />
      </section>

      <label className="campo">
        <span className="rotulo">Notas</span>
        <textarea rows={2} value={d.notas} onChange={(e) => set('notas', e.target.value)} placeholder="Ej: incluye aumento paritario de julio" />
      </label>

      <div className="acciones">
        {!valido && <span className="nota">Completá período y empleador para guardar.</span>}
        <button type="button" className="boton secundario" onClick={onCancelar}>
          Cancelar
        </button>
        <button className="boton" disabled={!valido || guardando}>
          {guardando ? 'Guardando…' : 'Guardar recibo'}
        </button>
      </div>
    </form>
  )
}
