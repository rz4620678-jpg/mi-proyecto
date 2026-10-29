import { useContext, useState } from 'react';
import { Plus, Pencil, Trash2, FileSpreadsheet, Phone, Merge } from 'lucide-react';
import { Ctx } from '../context';
import { api, useApi } from '../api';
import { money, fdate, exportCsv } from '../utils';
import DataTable from '../components/DataTable';
import Btn from '../components/Btn';
import Modal from '../components/Modal';
import Field from '../components/Field';

const CAMPOS = [
  ['razon_social', 'Razón social'],
  ['ruc', 'RUC (11 dígitos)'],
  ['codigo_sap', 'Código SAP del cliente'],
  ['telefono', 'Teléfono'],
  ['email', 'Email'],
  ['direccion', 'Dirección'],
  ['contacto_nombre', 'Nombre de contacto'],
];

export default function Clientes() {
  const { reload } = useContext(Ctx);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [form, setForm] = useState(null);
  const [mostrarDuplicados, setMostrarDuplicados] = useState(false);
  const [seleccionDup, setSeleccionDup] = useState({});
  const [t, setT] = useState(0);
  const rows = useApi('clientes', { q }, [t]);
  const duplicados = useApi('cliente_duplicados', {}, [t]);

  const cols = [
    { h: 'Cliente', k: 'razon_social', cls: 'l' },
    { h: 'RUC', k: 'ruc' },
    { h: 'Código SAP', render: (r) => r.codigo_sap || '—' },
    { h: 'N° facturas', k: 'facturas' },
    { h: 'Última factura', render: (r) => fdate(r.ultima_factura) || '—' },
    { h: 'Saldo por cobrar', render: (r) => money(r.saldo), cls: 'n pos' },
  ];

  const seleccionar = (cliente) => {
    setSel(cliente);
    setExpandedId((current) => String(current) === String(cliente.id) ? null : cliente.id);
    setEditing(false);
    setEditForm({ ...cliente });
  };
  const editarPanel = () => {
    if (!sel) return alert('Selecciona un cliente');
    setExpandedId(sel.id);
    setEditForm({ ...sel });
    setEditing(true);
  };
  const guardarPanel = async () => {
    try {
      await api('cliente_guardar', {}, editForm);
      setEditing(false);
      setT((value) => value + 1);
      reload();
    } catch (error) {
      alert(error.error || 'No se pudo guardar el cliente');
    }
  };
  const guardarNuevo = async () => {
    try {
      await api('cliente_guardar', {}, form);
      setForm(null);
      setT((value) => value + 1);
      reload();
    } catch (error) {
      alert(error.error || 'No se pudo guardar el cliente');
    }
  };
  const eliminar = async () => {
    if (!sel) return alert('Selecciona un cliente');
    if (!confirm('¿Eliminar cliente?')) return;
    try {
      await api('cliente_eliminar', {}, { id: sel.id });
      setSel(null);
      setExpandedId(null);
      setT((value) => value + 1);
      reload();
    } catch (error) {
      alert(error.error || 'No se pudo eliminar el cliente');
    }
  };
  const unir = async (group) => {
    const choice = seleccionDup[group.ruc] || {};
    const origen = choice.origen || group.clientes[0]?.id;
    const destino = choice.destino || group.clientes[1]?.id;
    if (!confirm(`¿Unir el cliente ${group.clientes.find((c) => String(c.id) === String(origen))?.razon_social} con ${group.clientes.find((c) => String(c.id) === String(destino))?.razon_social}? Sus facturas pasarán al cliente destino.`)) return;
    try {
      await api('cliente_unir', {}, { origen_id: origen, destino_id: destino });
      setT((value) => value + 1);
      setSel(null);
      setExpandedId(null);
      reload();
    } catch (error) {
      alert(error.error || 'No se pudieron unir los clientes');
    }
  };

  const renderPanel = (cliente) => (
    <div className="client-panel">
      {editing ? (
        <>
          <div className="client-edit-grid">
            {CAMPOS.map(([key, label]) => (
              <Field key={key} label={label}>
                <input value={editForm[key] || ''} onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })} />
              </Field>
            ))}
          </div>
          <div className="bar"><Btn c="gr" onClick={guardarPanel}>Guardar datos</Btn><Btn c="nv" onClick={() => setEditing(false)}>Cancelar</Btn></div>
        </>
      ) : (
        <>
          <div className="client-details">
            <span><b>RUC</b> {cliente.ruc || '—'}</span>
            <span><b>Código SAP</b> {cliente.codigo_sap || '—'}</span>
            <span><b>Contacto</b> {cliente.contacto_nombre || '—'}</span>
            <span><b>Teléfono</b> {cliente.telefono || '—'} {cliente.telefono && <a className="contact-link" href={`tel:${cliente.telefono.replace(/[^\d+]/g, '')}`}><Phone size={14} /> Llamar</a>}</span>
            <span><b>Email</b> {cliente.email ? <a href={`mailto:${cliente.email}`}>{cliente.email}</a> : '—'}</span>
            <span><b>Dirección</b> {cliente.direccion || '—'}</span>
          </div>
          <div className="pending-invoices">
            <b>Facturas pendientes:</b>
            {cliente.pendientes?.length ? cliente.pendientes.map((invoice) => (
              <span className="pending-chip" key={invoice.numero}>
                {invoice.numero} · emitida {fdate(invoice.emision)} · {money(invoice.saldo)} · vence {fdate(invoice.vencimiento)}
              </span>
            )) : <span>Sin facturas pendientes</span>}
          </div>
          <div className="bar"><Btn c="bl s" onClick={editarPanel}>Editar datos</Btn></div>
        </>
      )}
    </div>
  );

  return (
    <>
      <div className="titlebar"><h2>LISTA DE CLIENTES</h2>
        <div>
          <Btn c="gr" icon={Plus} onClick={() => setForm({ razon_social: '', ruc: '' })}>NUEVO CLIENTE</Btn>
          <Btn c="bl" icon={Pencil} onClick={editarPanel}>EDITAR</Btn>
          <Btn c="rd" icon={Trash2} onClick={eliminar}>ELIMINAR</Btn>
          <Btn c="gr" icon={FileSpreadsheet} onClick={() => exportCsv(rows, 'clientes')}>EXPORTAR</Btn>
          <Btn c="nv" icon={Merge} onClick={() => setMostrarDuplicados(true)}>REVISAR RUC COMPARTIDOS ({duplicados?.length || 0})</Btn>
        </div>
      </div>
      <div className="filtros"><label>Buscar: <input placeholder="Buscar por cliente, RUC o código SAP..." value={q} onChange={(e) => setQ(e.target.value)} /></label></div>
      <DataTable cols={cols} rows={rows} selected={sel} onSelect={seleccionar} expandedId={expandedId} renderExpanded={renderPanel} />
      {form && (
        <Modal title="Nuevo cliente" onClose={() => setForm(null)}>
          <div className="frm">{CAMPOS.map(([key, label]) => <Field key={key} label={label}><input value={form[key] || ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></Field>)}</div>
          <div className="bar"><Btn c="gr" onClick={guardarNuevo}>Guardar</Btn><Btn c="rd" onClick={() => setForm(null)}>Cancelar</Btn></div>
        </Modal>
      )}
      {mostrarDuplicados && (
        <Modal title="Clientes que comparten RUC" onClose={() => setMostrarDuplicados(false)} wide>
          <p>Esta revisión es opcional y no modifica datos. Compartir RUC no significa necesariamente que sean duplicados: distintas sedes de EsSalud pueden tener el mismo RUC. Únelos solo si confirmas que son el mismo registro.</p>
          {duplicados?.length ? duplicados.map((group) => {
            const choice = seleccionDup[group.ruc] || {};
            const source = choice.origen || group.clientes[0]?.id;
            const destination = choice.destino || group.clientes.find((c) => String(c.id) !== String(source))?.id;
            return (
              <div className="duplicate-group" key={group.ruc}>
                <b>RUC {group.ruc}</b>
                <Field label="Cliente que se unirá">
                  <select value={source} onChange={(e) => {
                    const nextSource = e.target.value;
                    const nextDestination = String(destination) === String(nextSource)
                      ? group.clientes.find((c) => String(c.id) !== String(nextSource))?.id
                      : destination;
                    setSeleccionDup({ ...seleccionDup, [group.ruc]: { origen: nextSource, destino: nextDestination } });
                  }}>
                    {group.clientes.map((c) => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
                  </select>
                </Field>
                <Field label="Cliente que se conservará">
                  <select value={destination} onChange={(e) => setSeleccionDup({ ...seleccionDup, [group.ruc]: { origen: source, destino: e.target.value } })}>
                    {group.clientes.filter((c) => String(c.id) !== String(source)).map((c) => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
                  </select>
                </Field>
                <Btn c="or s" onClick={() => unir(group)}>Unir este grupo</Btn>
              </div>
            );
          }) : <p>No se encontraron RUC duplicados.</p>}
        </Modal>
      )}
    </>
  );
}
