import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Ctx } from '../context';
import { api, useApi } from '../api';
import { money, fdate, priceWithIgv } from '../utils';
import DataTable from '../components/DataTable';

const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export default function Precios() {
  const { productos, clientes, config } = useContext(Ctx);
  const [p, setP] = useState(productos[0]?.id || 1);
  const [c, setC] = useState('');
  const [anio, setAnio] = useState('');
  const [mes, setMes] = useState('');
  const [codigo, setCodigo] = useState('');
  const [errorCodigo, setErrorCodigo] = useState('');
  const [errorHistorial, setErrorHistorial] = useState('');
  const [buscandoCodigo, setBuscandoCodigo] = useState(false);
  const solicitudCodigo = useRef(0);
  const anios = useApi('factura_anios') || [];
  const reportarErrorHistorial = useCallback((error) => {
    setErrorHistorial(error.error || 'No se pudo cargar el historial de precios.');
  }, []);
  const rows = useApi('precios', { producto_id: p, cliente_id: c, anio, mes }, [], reportarErrorHistorial);
  const producto = productos.find((item) => String(item.id) === String(p));
  const cliente = clientes.find((item) => String(item.id) === String(c));
  const filtrosActivos = [
    anio && `año ${anio}`,
    mes && meses[Number(mes) - 1]?.toLowerCase(),
    cliente && `cliente ${cliente.razon_social}`,
  ].filter(Boolean);
  const buscarCodigo = useCallback(async (valor = codigo, clienteId = c) => {
    const codigoBuscado = valor.trim();
    const solicitudActual = ++solicitudCodigo.current;
    if (!codigoBuscado) {
      setBuscandoCodigo(false);
      setErrorCodigo('');
      return;
    }
    setBuscandoCodigo(true);
    setErrorCodigo('');
    try {
      const product = await api('catalogo_por_codigo', { codigo: codigoBuscado, cliente_id: clienteId });
      if (solicitudActual !== solicitudCodigo.current) return;
      setP(String(product.id));
      setErrorHistorial('');
    } catch (error) {
      if (solicitudActual === solicitudCodigo.current)
        setErrorCodigo(error.error || 'No se encontró un producto con ese código SAP.');
    } finally {
      if (solicitudActual === solicitudCodigo.current) setBuscandoCodigo(false);
    }
  }, [codigo, c]);
  useEffect(() => {
    const valor = codigo.trim();
    if (!valor) {
      setErrorCodigo('');
      return undefined;
    }
    const timeout = setTimeout(() => buscarCodigo(valor, c), 350);
    return () => clearTimeout(timeout);
  }, [codigo, c, buscarCodigo]);
  const cols = [
    { h: 'Fecha', render: (r) => fdate(r.fecha) }, { h: 'Factura', k: 'factura' }, { h: 'Cliente', k: 'cliente', cls: 'l' },
    { h: 'Cantidad', render: (r) => Number(r.cantidad) }, { h: 'Precio Unit. c/IGV', render: (r) => money(r.precio), cls: 'n' }, { h: 'Precio Total c/IGV', render: (r) => money(priceWithIgv(r.total, config.igv)), cls: 'n' },
  ];
  return (
    <>
      <div className="titlebar"><h2>HISTORIAL DE PRECIOS POR PRODUCTO</h2></div>
      <div className="filtros">
        <label>Producto: <select value={p} onChange={(e) => { setP(e.target.value); setErrorHistorial(''); }}>{productos.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}</select></label>
        <label>Cliente (SAP general): <select value={c} onChange={(e) => { setC(e.target.value); setErrorHistorial(''); }}><option value="">TODOS</option>{clientes.map((x) => <option key={x.id} value={x.id}>{x.razon_social}{x.codigo_sap ? ` · SAP cliente ${x.codigo_sap}` : ''}</option>)}</select></label>
        <label>Código SAP del producto: <input aria-label="Código SAP del producto" placeholder="Escribe el código del producto" value={codigo} onChange={(e) => setCodigo(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); buscarCodigo(); } }} /></label>
        {buscandoCodigo && <small role="status">Buscando producto…</small>}
        {errorCodigo && <small className="lookup-missing">{errorCodigo}</small>}
        <label>Año: <select value={anio} onChange={(e) => { setAnio(e.target.value); setErrorHistorial(''); }}><option value="">Todos</option>{anios.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
        <label>Mes: <select value={mes} onChange={(e) => { setMes(e.target.value); setErrorHistorial(''); }}><option value="">Todos</option>{meses.map((name, index) => <option key={name} value={String(index + 1)}>{name}</option>)}</select></label>
      </div>
      <p className="history-code-help">El SAP general identifica al cliente; este campo busca el código SAP asignado al producto.</p>
      {errorHistorial && <p className="history-status error" role="alert">{errorHistorial}</p>}
      {rows?.length === 0 && !errorHistorial && (
        <p className="history-status">
          No hay compras registradas de {producto?.nombre || 'este producto'}{filtrosActivos.length ? ` para ${filtrosActivos.join(', ')}` : ''}.
        </p>
      )}
      <DataTable cols={cols} rows={rows} />
    </>
  );
}
