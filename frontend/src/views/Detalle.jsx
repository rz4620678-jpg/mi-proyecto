import { useContext, useState } from 'react';
import { Ctx } from '../context';
import { useApi } from '../api';
import { money, priceWithIgv } from '../utils';
import DataTable from '../components/DataTable';

export default function Detalle() {
  const { config, clientes } = useContext(Ctx);
  const [fid, setFid] = useState('');
  const [anio, setAnio] = useState('todos');
  const [mes, setMes] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [sapCliente, setSapCliente] = useState('');
  const [q, setQ] = useState('');
  const anios = useApi('factura_anios') || [];
  const facturas = useApi('facturas') || [];
  const rows = useApi('detalle', { factura_id: fid, anio, mes, cliente_id: clienteId, cliente_sap: sapCliente, q });
  const f = facturas.find((x) => x.id == fid);
  const cols = [
    { h: 'Año', k: 'anio' }, { h: 'Factura', k: 'factura' }, { h: 'Código producto', render: (r) => r.codigo || 'Sin código asignado' }, { h: 'Producto', k: 'producto', cls: 'l' }, { h: 'Marca', k: 'marca' }, { h: 'Presentación', k: 'presentacion' },
    { h: 'Cantidad', render: (r) => Number(r.cantidad) }, { h: 'Unidad', k: 'unidad' },
    { h: 'Precio Unit. c/IGV', render: (r) => money(r.precio), cls: 'n' },
    { h: 'Descuento %', render: (r) => Number(r.descuento) + '%' }, { h: 'Total c/IGV', render: (r) => money(priceWithIgv(r.total, config.igv)), cls: 'n' },
  ];
  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return (
    <>
      <div className="titlebar"><h2>DETALLE DE PRODUCTOS POR FACTURA</h2></div>
      <div className="filtros">
        <label>Filtrar por Factura: <select value={fid} onChange={(e) => setFid(e.target.value)}><option value="">TODOS</option>{facturas.map((x) => <option key={x.id} value={x.id}>{x.numero}</option>)}</select></label>
        <label>Año: <select value={anio} onChange={(e) => setAnio(e.target.value)}><option value="todos">Todos</option>{anios.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
        <label>Mes: <select value={mes} onChange={(e) => setMes(e.target.value)}><option value="">Todos</option>{meses.map((name, index) => <option key={name} value={String(index + 1)}>{name}</option>)}</select></label>
        <label>Cliente: <select value={clienteId} onChange={(e) => setClienteId(e.target.value)}><option value="">Todos</option>{clientes.map((item) => <option key={item.id} value={item.id}>{item.razon_social}{item.codigo_sap ? ` · SAP ${item.codigo_sap}` : ''}</option>)}</select></label>
        <label>SAP cliente (exacto): <input placeholder="Ej. 12" value={sapCliente} onChange={(e) => setSapCliente(e.target.value)} /></label>
        <label>Producto o código de producto: <input placeholder="Nombre o código SAP de producto..." value={q} onChange={(e) => setQ(e.target.value)} /></label>
      </div>
      <DataTable cols={cols} rows={rows} />
      {f && (
        <div className="resumen caja">
          <b>RESUMEN DE LA FACTURA {f.numero}</b>
          <span>Subtotal: <b>{money(f.subtotal)}</b></span><span>IGV ({config.igv}%): <b>{money(f.igv)}</b></span><span>Total: <b>{money(f.total)}</b></span>
          <span>Retención {config.retencion}%: <b>{money(f.retencion)}</b></span><span>Total Neto: <b>{money(f.total_neto)}</b></span>
        </div>
      )}
    </>
  );
}
