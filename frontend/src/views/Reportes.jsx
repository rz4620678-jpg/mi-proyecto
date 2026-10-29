import { useContext, useState } from 'react';
import { FileText, Landmark, UserSearch, FileX, Banknote, TrendingUp, Package, Tag, FileSpreadsheet, CalendarDays } from 'lucide-react';
import { Ctx } from '../context';
import { useApi } from '../api';
import { igvFactor, money, exportCsv } from '../utils';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import Btn from '../components/Btn';

const REPORTES = [
  ['general', FileText, '#1d4fb5', 'REPORTE GENERAL', 'Resumen general de facturas y cobros'],
  ['ventas_anio', CalendarDays, '#1d4fb5', 'VENTAS POR AÑO', 'Facturas, impuestos, cobros y saldos agrupados por año'],
  ['cobranza', Landmark, '#1e9e48', 'REPORTE DE COBRANZA', 'Análisis de cobranza por período'],
  ['clientes', UserSearch, '#6b3fa0', 'REPORTE POR CLIENTES', 'Deudas y pagos por cliente'],
  ['vencidas', FileX, '#d92d20', 'FACTURAS VENCIDAS', 'Listado de facturas vencidas'],
  ['banco', Banknote, '#1e9e48', 'COBROS POR BANCO', 'Resumen de cobros por banco'],
  ['utilidad', TrendingUp, '#1d4fb5', 'UTILIDAD POR PERÍODO', 'Utilidad generada por período'],
  ['productos', Package, '#6b8e23', 'PRODUCTOS MÁS VENDIDOS', 'Ranking de productos vendidos'],
  ['precios', Tag, '#6b3fa0', 'HISTORIAL DE PRECIOS', 'Análisis de precios por producto'],
];
const DINERO = ['total', 'total_neto', 'cobrado', 'excedente', 'saldo', 'utilidad', 'ventas', 'deuda', 'facturado', 'monto', 'minimo', 'maximo', 'promedio', 'subtotal', 'igv'];

function Resultado({ tipo, titulo, onClose }) {
  const { config } = useContext(Ctx);
  const rows = useApi('reporte', { tipo });
  const factor = igvFactor(config.igv);
  const rowsShown = rows?.map((row) => {
    if (tipo === 'productos') return { ...row, monto: Number(row.monto) * factor };
    return row;
  });
  const cols = rowsShown && rowsShown[0] ? Object.keys(rowsShown[0]).map((k) => ({ h: k.replace(/_/g, ' ').toUpperCase(), render: (r) => (k === 'utilidad' && r[k] == null ? 'Sin dato' : DINERO.includes(k) ? money(r[k]) : r[k]), cls: DINERO.includes(k) ? 'n' : '' })) : [];
  return (
    <Modal title={titulo} onClose={onClose} wide>
      <div className="bar"><Btn c="gr" icon={FileSpreadsheet} onClick={() => exportCsv(rowsShown, tipo)}>EXPORTAR</Btn></div>
      <DataTable cols={cols} rows={rowsShown} />
    </Modal>
  );
}

export default function Reportes() {
  const [r, setR] = useState(null);
  return (
    <>
      <div className="titlebar"><h2>REPORTES Y GRÁFICOS</h2></div>
      <div className="tarjetas">
        {REPORTES.map(([k, I, c, t, s]) => (
          <button key={k} className="tarjeta" onClick={() => setR({ k, t })}><I size={34} color={c} /><span><b>{t}</b><small>{s}</small></span></button>
        ))}
      </div>
      {r && <Resultado tipo={r.k} titulo={r.t} onClose={() => setR(null)} />}
    </>
  );
}
