import { useContext, useEffect, useState } from 'react';
import { Plus, Pencil, CircleX, FileSpreadsheet, FileText, FileCheck2, Truck, BadgeCheck } from 'lucide-react';
import { Ctx } from '../context';
import { api, BASE, useApi } from '../api';
import { money, fdate, exportCsv, COLOR_ESTADO } from '../utils';
import DataTable from '../components/DataTable';
import Badge from '../components/Badge';
import Btn from '../components/Btn';
import Modal from '../components/Modal';
import FacturaForm from '../components/FacturaForm';

function DocLink({ id, title, Icon }) {
  return id ? (
    <a className="document-link" href={`${BASE}?r=documento&id=${encodeURIComponent(id)}`} target="_blank" rel="noreferrer" title={title} aria-label={title}>
      <Icon size={18} />
    </a>
  ) : <span className="document-missing" title={`${title} (sin archivo)`}><Icon size={18} /></span>;
}

function GuiaLink({ guias, tipo, title, Icon }) {
  const guia = guias.find((item) => Number(tipo === 'guia_original' ? item.has_doc_original : item.has_doc_sellada) === 1);
  return guia ? (
    <a className="document-link" href={`${BASE}?r=documento&guia_id=${guia.id}&tipo=${tipo}`} target="_blank" rel="noreferrer" title={`${title}: ${guia.numero_guia}`} aria-label={`${title}: ${guia.numero_guia}`}>
      <Icon size={18} />
    </a>
  ) : <span className="document-missing" title={`${title} (sin archivo)`}><Icon size={18} /></span>;
}

function guiaCorta(numero) {
  return String(numero).replace(/^(.*?[-])0*(\d+)$/, '$1$2');
}

export default function Facturas() {
  const { intent, listas, config, reload } = useContext(Ctx);
  const [anio, setAnio] = useState('');
  const [estado, setEstado] = useState('');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);
  const [form, setForm] = useState(intent === 'nuevo' ? {} : null);
  const [anular, setAnular] = useState(null);
  const [t, setT] = useState(0);
  const rows = useApi('facturas', { anio, estado, q }, [t]);
  const anios = useApi('factura_anios', {}, [t]) || [];
  const pendientes = useApi('pendientes_importacion');
  const pendingId = typeof intent === 'string' && intent.startsWith('pendiente-') ? Number(intent.slice('pendiente-'.length)) : null;

  useEffect(() => {
    if (!pendingId || !pendientes) return;
    const pendiente = pendientes.find((p) => Number(p.id) === pendingId);
    if (pendiente) setForm({ pendiente });
  }, [pendingId, pendientes]);

  const cols = [
    { h: 'Factura', render: (r) => <><b>{r.numero}</b><br /><span className="muted">{fdate(r.emision)}</span></> },
    { h: 'Cliente / código SAP', render: (r) => <div className="client-cell"><span>{r.cliente}</span>{r.codigo_sap && <small>SAP {r.codigo_sap}</small>}</div>, cls: 'l' },
    { h: 'Guías', render: (r) => <div className="guide-list" title={(r.guias || []).map((g) => g.numero_guia).join(' · ')}>
      {(r.guias || []).slice(0, 3).map((g) => <span className="guide-chip" key={g.id}>{guiaCorta(g.numero_guia)}</span>)}
      {(r.guias || []).length > 3 && <span className="guide-chip extra" title={(r.guias || []).slice(3).map((g) => g.numero_guia).join(' · ')}>+{r.guias.length - 3}</span>}
    </div>, cls: 'guides-cell' },
    { h: 'O/C', k: 'nro_oc' },
    { h: 'Total / neto', render: (r) => <div className="amount-cell"><span>{money(r.total)}</span>
      {Number(r.aplica_penalidad) === 1 && <small className="penalty-badge">Pen. {r.porcentaje_penalidad}%: {money(r.monto_penalidad)}</small>}
      <small>Neto {money(r.total_neto)}</small></div>, cls: 'n' },
    { h: `Retención ${config.retencion}%`, render: (r) => money(r.retencion), cls: 'n' },
    { h: 'Vencimiento', render: (r) => r.vencimiento ? fdate(r.vencimiento) : '—' },
    { h: 'Documentos', render: (r) => {
      const guias = r.guias || [];
      return <div className="document-icons">
        <DocLink id={r.factura_original_id} title="Factura original" Icon={FileText} />
        <DocLink id={r.factura_sellada_id} title="Factura sellada" Icon={FileCheck2} />
        <GuiaLink guias={guias} tipo="guia_original" title="Guía original" Icon={Truck} />
        <GuiaLink guias={guias} tipo="guia_sellada" title="Guía sellada" Icon={BadgeCheck} />
      </div>;
    } },
    { h: 'Pago', render: (r) => {
      const estadoPago = r.estado === 'COBRADA' ? 'PAGADA' : ['PENDIENTE', 'VENCIDA'].includes(r.estado) ? 'PENDIENTE' : r.estado;
      const badgeEstado = estadoPago === 'PAGADA' ? 'COBRADA' : estadoPago;
      return <div className="payment-cell"><Badge e={badgeEstado} label={estadoPago} />
        <small>{r.fecha_pago ? `Pagó ${fdate(r.fecha_pago)}` : r.estado === 'ANULADA' ? 'Anulada' : `Vence ${fdate(r.vencimiento)}`}</small>
      </div>;
    } },
    { h: 'Subtotal', render: (r) => money(r.subtotal), cls: 'n' },
    { h: `IGV (${config.igv}%)`, render: (r) => money(r.igv), cls: 'n' },
    { h: 'Excedente', render: (r) => Number(r.excedente) > 0 ? money(r.excedente) : '—', cls: 'n' },
    { h: 'Estado', render: (r) => <Badge e={r.estado} /> },
    { h: 'Días pend.', render: (r) => r.estado === 'COBRADA' || r.estado === 'ANULADA' || r.dias == null ? '—' : <b className={r.dias < 0 ? 'neg' : ''}>{r.dias}</b> },
    { h: 'Banco', render: (r) => r.banco || '—' },
    { h: 'Utilidad', render: (r) => r.utilidad == null ? 'Sin dato' : money(r.utilidad), cls: 'n pos' },
  ];
  const editar = () => (sel ? setForm(sel) : alert('Selecciona una factura de la lista'));
  const eliminar = () => (sel ? setAnular({ id: sel.id, numero: sel.numero, motivo: listas.motivo[0]?.nombre || 'Anulada' }) : alert('Selecciona una factura de la lista'));
  const confirmarAnular = async () => { await api('factura_anular', {}, anular); setAnular(null); setSel(null); setT(t + 1); };
  const guardado = () => { setForm(null); setT(t + 1); reload(); };

  return (
    <>
      <div className="titlebar"><h2>LISTADO DE FACTURAS ({rows?.length ?? '…'})</h2>
        <div><Btn c="gr" icon={Plus} onClick={() => setForm({})}>NUEVA FACTURA</Btn><Btn c="bl" icon={Pencil} onClick={editar}>EDITAR</Btn><Btn c="rd" icon={CircleX} onClick={eliminar}>ANULAR</Btn><Btn c="gr" icon={FileSpreadsheet} onClick={() => exportCsv(rows, 'facturas')}>EXPORTAR</Btn></div>
      </div>
      <div className="filtros">
        <label>Filtrar por Año: <select value={anio} onChange={(e) => setAnio(e.target.value)}><option value="">TODOS</option>{anios.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
        <label>Filtrar por Estado: <select value={estado} onChange={(e) => setEstado(e.target.value)}><option value="">TODOS</option>{Object.keys(COLOR_ESTADO).map((x) => <option key={x}>{x}</option>)}</select></label>
        <label>Buscar: <input placeholder="Buscar por factura, guía, O/C, cliente o RUC..." value={q} onChange={(e) => setQ(e.target.value)} /></label>
      </div>
      <DataTable cols={cols} rows={rows} selected={sel} onSelect={setSel} />
      {pendingId && pendientes && !pendientes.some((p) => Number(p.id) === pendingId) && !form && <div className="import-alert" role="status">El registro pendiente ya no existe o fue completado.</div>}
      {form && <FacturaForm factura={form.id ? form : null} pendiente={form.pendiente} onClose={() => setForm(null)} onSaved={guardado} />}
      {anular && (
        <Modal title={`Anular ${anular.numero}`} onClose={() => setAnular(null)}>
          <p>La factura no se borrará: se conservará en el historial con estado ANULADA.</p>
          <label className="field">Motivo de anulación<select value={anular.motivo} onChange={(e) => setAnular({ ...anular, motivo: e.target.value })}>{listas.motivo.map((m) => <option key={m.id}>{m.nombre}</option>)}</select></label>
          <div className="bar"><Btn c="rd" onClick={confirmarAnular}>Anular factura</Btn><Btn c="nv" onClick={() => setAnular(null)}>Cancelar</Btn></div>
        </Modal>
      )}
    </>
  );
}
