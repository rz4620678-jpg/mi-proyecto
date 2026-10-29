import { useCallback, useContext, useState } from 'react';
import { FileText, Wallet, Hourglass, TrendingUp, CircleX, CircleDollarSign, Percent, CircleAlert, Users, Package, Plus, Search, BarChart3, Settings } from 'lucide-react';
import { Ctx } from '../context';
import { useApi } from '../api';
import { money, MESES, COLOR_ESTADO, fdate } from '../utils';
import FacturaForm from '../components/FacturaForm';
import DataTable from '../components/DataTable';

const ETIQ = { COBRADA: 'Cobradas', PENDIENTE: 'Pendientes', VENCIDA: 'Vencidas', PARCIAL: 'Parciales', ANULADA: 'Anuladas' };
const NOMBRES_MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export default function Dashboard() {
  const { go } = useContext(Ctx);
  const [anio, setAnio] = useState(String(new Date().getFullYear()));
  const [mes, setMes] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [pendienteSeleccionado, setPendienteSeleccionado] = useState(null);
  const [apiError, setApiError] = useState(null);
  const [pendingError, setPendingError] = useState(null);
  const onError = useCallback(setApiError, []);
  const onPendingError = useCallback(setPendingError, []);
  const d = useApi('dashboard', { anio, mes }, [attempt], onError);
  const facturaRows = useApi('facturas', { anio: anio === 'todos' ? '' : anio, mes }, [attempt], onError);
  const facturas = facturaRows?.filter((invoice) => invoice.estado !== 'ANULADA');
  const pendientes = useApi('pendientes_importacion', {}, [attempt], onPendingError);
  if (apiError || (d && !Array.isArray(d.estados))) {
    return (
      <div className="connection-error" role="alert">
        <h2>No se pudo cargar el panel</h2>
        <p>{apiError?.error || 'El servidor devolvió una respuesta incompleta.'} Verifica que Apache y MySQL estén activos.</p>
        <button className="btn bl" onClick={() => { setApiError(null); setPendingError(null); setAttempt((n) => n + 1); }}>Reintentar</button>
      </div>
    );
  }
  if (!d) return <div className="loading">Cargando…</div>;

  const acciones = [
    ['gr', Plus, 'NUEVA FACTURA', 'Registrar nueva factura', () => go('facturas', 'nuevo')],
    ['bl', Wallet, 'REGISTRAR COBRO', 'Registrar pago recibido', () => go('cobros', 'nuevo')],
    ['nv', Search, 'BUSCAR FACTURA', 'Buscar por número', () => go('facturas')],
    ['or', BarChart3, 'REPORTES', 'Ver reportes y gráficos', () => go('reportes')],
    ['pu', Settings, 'CONFIGURACIÓN', 'Parámetros del sistema', () => go('config')],
  ];
  const pct = d.neto > 0 ? (d.cobrado / d.neto) * 100 : 0;
  const kpis = [
    [FileText, '#1d4fb5', 'TOTAL FACTURADO (con IGV)', money(d.facturado)], [Wallet, '#1e9e48', 'TOTAL COBRADO', money(d.cobrado)],
    [Hourglass, '#f07d00', 'PENDIENTE POR COBRAR', money(d.pendiente)],
    ...(Number(d.utilidad) !== 0 ? [[TrendingUp, '#6b3fa0', 'UTILIDAD TOTAL', money(d.utilidad)]] : []),
    [CircleX, '#d92d20', 'FACTURAS ANULADAS', d.anuladas],
    [CircleDollarSign, '#1e9e48', 'COBROS DEL PERÍODO', money(d.cobros_mes)], [Percent, '#1d4fb5', '% COBRANZA ACTUAL', pct.toFixed(2) + '%'],
    [CircleAlert, '#d92d20', 'FACTURAS VENCIDAS', d.vencidas], [Users, '#1d4fb5', 'CLIENTES ACTIVOS', d.clientes],
    [Package, '#1d4fb5', 'PRODUCTOS EN CATÁLOGO', Number(d.productos_catalogo).toLocaleString('es-PE')],
    [Package, '#6b3fa0', 'PRODUCTOS VENDIDOS (DISTINTOS)', Number(d.productos_distintos).toLocaleString('es-PE')],
    [Package, '#f07d00', 'LÍNEAS DE DETALLE', Number(d.lineas_venta).toLocaleString('es-PE')],
    [Package, '#1d4fb5', 'UNIDADES VENDIDAS', Number(d.unidades_vendidas).toLocaleString('es-PE')],
  ];
  const total = d.estados.reduce((s, x) => s + Number(x.n), 0) || 1;
  let acum = 0;
  const donut = d.estados.map((x) => { const p = (x.n / total) * 100; const s = `${COLOR_ESTADO[x.estado]} ${acum}% ${acum + p}%`; acum += p; return s; }).join(',');
  const mv = (i) => Number((d.meses.find((m) => m.m == i + 1) || {}).t || 0);
  const mx = Math.max(1, ...MESES.map((_, i) => mv(i)));
  const topMx = Math.max(1, ...d.top.map((t) => Number(t.deuda)));

  return (
    <>
      <div className="filtros">
        <label>Año: <select value={anio} onChange={(e) => { setApiError(null); setAnio(e.target.value); }}><option value="todos">Todos</option>{d.anios.map((year) => <option key={year} value={year}>{year}</option>)}{!d.anios.map(String).includes(anio) && anio !== 'todos' && <option value={anio}>{anio}</option>}</select></label>
        <label>Mes: <select value={mes} onChange={(e) => { setApiError(null); setMes(e.target.value); }}><option value="">Todos</option>{NOMBRES_MESES.map((name, index) => <option key={name} value={String(index + 1).padStart(2, '0')}>{name}</option>)}</select></label>
      </div>
      <div className="acciones">
        {acciones.map(([c, I, t, s, fn]) => (
          <button key={t} className={'accion ' + c} onClick={fn}><I size={26} /><span><b>{t}</b><small>{s}</small></span></button>
        ))}
      </div>
      {pendientes?.length > 0 && (
        <section className="import-alert" role="alert">
          <div>
            <b>Hay {pendientes.length} borrador(es) de Excel</b>
            {pendientes.map((p) => <p key={p.id}><strong>{p.numero}</strong> · Importe de referencia: {money(p.total_excel)} · Sin fecha, cliente ni detalle confirmados.</p>)}
            <span>Los borradores no son facturas y no se incluyen en el total facturado ni en el saldo por cobrar.</span>
          </div>
          {pendientes.map((p) => <button key={p.id} className="btn or" onClick={() => setPendienteSeleccionado(p)}>Completar {p.numero}</button>)}
        </section>
      )}
      {pendingError && (
        <section className="import-alert" role="alert">
          <b>No se pudieron cargar los registros incompletos.</b>
          <span>{pendingError.error || 'Revisa que la migración de pendientes se haya aplicado en MySQL.'}</span>
        </section>
      )}
      {pendienteSeleccionado && (
        <FacturaForm
          pendiente={pendienteSeleccionado}
          onClose={() => setPendienteSeleccionado(null)}
          onSaved={() => {
            setPendienteSeleccionado(null);
            setAttempt((n) => n + 1);
          }}
        />
      )}
      <div className="kpis">
        {kpis.map(([I, c, t, v]) => (
          <div className="kpi" key={t}><span className="ico" style={{ background: c }}><I size={20} /></span><div><small>{t}</small><b style={{ color: c === '#1d4fb5' ? 'var(--nv)' : c }}>{v}</b></div></div>
        ))}
      </div>
      <div className="graficos">
        <div className="card">
          <h4>ESTADO DE COBRANZA</h4>
          <div className="dona-wrap">
            <div className="dona" style={{ background: `conic-gradient(${donut})` }}><i /></div>
            <ul className="leyenda">{d.estados.map((x) => <li key={x.estado}><span style={{ background: COLOR_ESTADO[x.estado] }} />{ETIQ[x.estado]}: {x.n} ({((x.n / total) * 100).toFixed(1)}%)</li>)}</ul>
          </div>
        </div>
        <div className="card">
          <h4>COBROS POR MES (S/)</h4>
          <div className="cols">{MESES.map((m, i) => <div key={m} className="col"><em>{mv(i) ? Math.round(mv(i)).toLocaleString('es-PE') : ''}</em><span style={{ height: (mv(i) / mx) * 100 + '%' }} /><small>{m}</small></div>)}</div>
        </div>
        <div className="card">
          <h4>TOP 5 CLIENTES POR DEUDA (S/)</h4>
          {d.top.map((t) => <div className="hb" key={t.cliente}><em>{t.cliente}</em><span style={{ width: (t.deuda / topMx) * 100 + '%' }}>{Number(t.deuda).toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span></div>)}
        </div>
      </div>
      <div className="titlebar">
        <h2>LISTADO DE FACTURAS ({facturas?.length ?? '…'})</h2>
        <div>
          <button className="btn bl" onClick={() => go('facturas')}>GESTIONAR FACTURAS</button>
          <button className="btn gr" onClick={() => go('cobros', 'nuevo')}>REGISTRAR COBRO</button>
        </div>
      </div>
      <DataTable
        numbered={false}
        cols={[
          { h: 'Fecha Emision', render: (r) => fdate(r.emision) },
          { h: 'Factura', k: 'numero' },
          { h: 'Guia', k: 'nro_guia' },
          { h: 'O/C', k: 'nro_oc' },
          { h: 'Cliente', k: 'cliente', cls: 'l' },
          { h: 'Código SAP', render: (r) => r.codigo_sap || '—' },
          { h: 'RUC', k: 'ruc' },
          { h: 'Vencimiento', render: (r) => r.vencimiento ? fdate(r.vencimiento) : '—' },
        ]}
        rows={facturas}
      />
    </>
  );
}
