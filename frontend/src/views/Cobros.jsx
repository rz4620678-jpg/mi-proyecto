import { useContext, useState } from 'react';
import { Plus, Pencil, Trash2, FileSpreadsheet } from 'lucide-react';
import { Ctx } from '../context';
import { api, useApi } from '../api';
import { money, fdate, today, exportCsv } from '../utils';
import DataTable from '../components/DataTable';
import Btn from '../components/Btn';
import Modal from '../components/Modal';
import Field from '../components/Field';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export default function Cobros() {
  const { intent, listas, clientes } = useContext(Ctx);
  const [anio, setAnio] = useState(String(new Date().getFullYear()));
  const [mes, setMes] = useState('');
  const [banco, setBanco] = useState('');
  const [q, setQ] = useState('');
  const [busquedaFactura, setBusquedaFactura] = useState('');
  const [sel, setSel] = useState(null);
  const [form, setForm] = useState(intent === 'nuevo' ? { fecha: today(), banco: listas.banco[0]?.nombre, forma_pago: listas.forma_pago[0]?.nombre, observaciones: '' } : null);
  const [t, setT] = useState(0);
  const anios = useApi('cobro_anios', {}, [t]) || [];
  const rows = useApi('cobros', { anio, mes, banco, q }, [t]);
  const facturas = (useApi('facturas', {}, [t]) || []).filter((f) => f.estado !== 'ANULADA' && (f.saldo > 0 || f.id == form?.factura_id));
  const sapBuscado = busquedaFactura.trim().toLocaleLowerCase();
  const coincidenciasSap = clientes.filter((cliente) =>
    String(cliente.codigo_sap || '').trim().toLocaleLowerCase() === sapBuscado);
  const sapGeneralEnBusqueda = q.trim() !== '' && clientes.some((cliente) =>
    String(cliente.codigo_sap || '').trim().toLocaleLowerCase() === q.trim().toLocaleLowerCase());
  const facturasFiltradas = facturas.filter((f) => coincidenciasSap.length
    ? coincidenciasSap.some((cliente) => String(cliente.id) === String(f.cliente_id))
    : [f.numero, f.cliente, f.ruc].some((value) =>
      String(value || '').toLocaleLowerCase().includes(sapBuscado)));
  const sumaCentimos = (campo) => (rows || []).reduce((sum, row) => sum + Math.round(Number(row[campo] || 0) * 100), 0) / 100;
  const resumen = { subtotal: sumaCentimos('subtotal'), igv: sumaCentimos('igv'), total: sumaCentimos('monto') };

  const cols = [
    { h: 'Fecha', render: (r) => r.fecha ? fdate(r.fecha) : 'Sin fecha registrada' },
    { h: 'Factura', k: 'factura' },
    { h: 'Cliente', k: 'cliente', cls: 'l' },
    { h: 'Banco', render: (r) => r.banco || '—' },
    { h: 'Forma de pago', render: (r) => r.forma_pago || '—' },
    { h: 'Subtotal', render: (r) => money(r.subtotal), cls: 'n' },
    { h: 'IGV 18%', render: (r) => money(r.igv), cls: 'n' },
    { h: 'Total', render: (r) => money(r.monto), cls: 'n' },
    { h: 'Observaciones', render: (r) => {
      if (!r.observaciones) return '—';
      const text = r.observaciones.replace(/\bimportad[oa]s? (?:del|desde(?: el)?) Excel\b/gi, 'registro histórico');
      return text.charAt(0).toUpperCase() + text.slice(1);
    }, cls: 'l' },
  ];
  const nuevo = () => {
    setBusquedaFactura('');
    setForm({ fecha: today(), banco: listas.banco[0]?.nombre || '', forma_pago: listas.forma_pago[0]?.nombre || '', observaciones: '' });
  };
  const editar = () => {
    if (!sel) return alert('Selecciona un cobro');
    setBusquedaFactura('');
    setForm({ ...sel, monto: +sel.monto });
  };
  const eliminar = async () => {
    if (!sel) return alert('Selecciona un cobro');
    if (confirm('¿Eliminar este cobro?')) {
      await api('cobro_eliminar', {}, { id: sel.id });
      setSel(null);
      setT(t + 1);
    }
  };
  const guardar = async () => {
    try {
      await api('cobro_guardar', {}, form);
      setForm(null);
      setT(t + 1);
    } catch (error) {
      alert(error.error || 'No se pudo guardar el cobro');
    }
  };
  const set = (key, value) => setForm({ ...form, [key]: value });

  return (
    <>
      <div className="titlebar"><h2>REGISTRO DE COBROS</h2>
        <div><Btn c="gr" icon={Plus} onClick={nuevo}>NUEVO COBRO</Btn><Btn c="bl" icon={Pencil} onClick={editar}>EDITAR</Btn><Btn c="rd" icon={Trash2} onClick={eliminar}>ELIMINAR</Btn><Btn c="gr" icon={FileSpreadsheet} onClick={() => exportCsv(rows, 'cobros')}>EXPORTAR</Btn></div>
      </div>
      <div className="filters-grid">
        <label>Año<select value={anio} onChange={(e) => setAnio(e.target.value)}><option value="todos">Todos</option>{!anios.map((year) => String(year)).includes(anio) && <option value={anio}>{anio}</option>}{anios.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
        <label>Mes<select value={mes} onChange={(e) => setMes(e.target.value)}><option value="">Todos</option>{MESES.map((name, index) => <option key={name} value={String(index + 1).padStart(2, '0')}>{name}</option>)}</select></label>
        <label>Banco<select value={banco} onChange={(e) => setBanco(e.target.value)}><option value="">Todos</option><option value="__sin_banco__">Sin banco registrado</option>{listas.banco.map((item) => <option key={item.id} value={item.nombre}>{item.nombre}</option>)}</select></label>
        <label>Buscar<input placeholder="Factura, cliente, RUC o SAP" value={q} onChange={(e) => setQ(e.target.value)} /></label>
      </div>
      <div className="collection-cards">
        <div><small>Subtotal cobrado</small><b>{money(resumen.subtotal)}</b></div>
        <div><small>IGV 18%</small><b>{money(resumen.igv)}</b></div>
        <div><small>Total cobrado</small><b>{money(resumen.total)}</b></div>
      </div>
      {rows?.length === 0 && sapGeneralEnBusqueda && (
        <p className="history-status">No hay cobros registrados para el SAP general {q.trim()} con estos filtros. Puedes registrar un pago de sus facturas pendientes en «Nuevo cobro».</p>
      )}
      <DataTable cols={cols} rows={rows} selected={sel} onSelect={setSel} />
      {rows?.length > 0 && <div className="collection-total"><b>Totales del filtro</b><span>{money(resumen.subtotal)}</span><span>{money(resumen.igv)}</span><span>{money(resumen.total)}</span></div>}
      {form && (
        <Modal title={form.id ? 'Editar cobro' : 'Registrar cobro'} onClose={() => setForm(null)}>
          <div className="frm">
            <Field label="Buscar factura, cliente/RUC o SAP exacto"><input placeholder="Factura o cliente; SAP exacto (ej. 12)" value={busquedaFactura} onChange={(e) => setBusquedaFactura(e.target.value)} /></Field>
            <Field label="Factura"><select value={form.factura_id || ''} onChange={(e) => { const f = facturas.find((x) => x.id == e.target.value); setForm({ ...form, factura_id: e.target.value, monto: f ? +f.saldo : '' }); }}><option value="">— Seleccione —</option>{facturasFiltradas.map((f) => <option key={f.id} value={f.id}>{f.numero} · {f.cliente}{f.codigo_sap ? ` · SAP ${f.codigo_sap}` : ''} · saldo {money(f.saldo)}</option>)}</select></Field>
            <Field label="Fecha de cobro"><input type="date" value={form.fecha || ''} onChange={(e) => set('fecha', e.target.value)} /></Field>
            <Field label="Total cobrado"><input type="number" step="0.01" value={form.monto || ''} onChange={(e) => set('monto', +e.target.value)} /></Field>
            <Field label="Banco (obligatorio)"><select required value={form.banco || ''} onChange={(e) => set('banco', e.target.value)}><option value="">— Seleccione banco —</option>{listas.banco.map((item) => <option key={item.id} value={item.nombre}>{item.nombre}</option>)}</select></Field>
            <Field label="Forma de pago"><select value={form.forma_pago || ''} onChange={(e) => set('forma_pago', e.target.value)}><option value="">— Sin registrar —</option>{listas.forma_pago.map((item) => <option key={item.id} value={item.nombre}>{item.nombre}</option>)}</select></Field>
            <Field label="Observaciones"><input value={form.observaciones || ''} onChange={(e) => set('observaciones', e.target.value)} /></Field>
          </div>
          <div className="bar"><Btn c="gr" onClick={guardar}>Guardar</Btn><Btn c="rd" onClick={() => setForm(null)}>Cancelar</Btn></div>
        </Modal>
      )}
    </>
  );
}
