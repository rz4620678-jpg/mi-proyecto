import { useContext, useEffect, useRef, useState } from 'react';
import { Ctx } from '../context';
import { api, uploadApi } from '../api';
import { money, priceWithoutIgv, today } from '../utils';
import Modal from './Modal';
import Field from './Field';
import Btn from './Btn';

const blank = { codigo: '', producto_id: '', cantidad: 1, precio: '', descuento: 0 };
const TIPOS_DOCUMENTO = [
  ['factura_original', 'Factura original'],
  ['factura_sellada', 'Factura sellada'],
];

export default function FacturaForm({ factura, pendiente, onClose, onSaved }) {
  const { clientes, productos, config, reload } = useContext(Ctx);
  const [f, setF] = useState({
    id: factura?.id, pendiente_id: pendiente?.id, numero: pendiente?.numero,
    cliente_id: factura?.cliente_id || '', emision: factura?.emision || (pendiente ? '' : today()),
    guias: factura?.guias?.map((guia) => guia.numero_guia) || (factura?.nro_guia ? factura.nro_guia.split('/') : []),
    nro_oc: factura?.nro_oc || '',
    dias: factura ? (factura.vencimiento ? Math.round((new Date(factura.vencimiento) - new Date(factura.emision)) / 864e5) : '') : pendiente ? '' : config.dias_credito,
    retencion: factura ? Number(factura.retencion) > 0 : pendiente ? null : true,
    aplica_penalidad: Number(factura?.aplica_penalidad) === 1,
    porcentaje_penalidad: Number(factura?.porcentaje_penalidad || 10),
    items: [{ ...blank }],
  });
  const [guiaInput, setGuiaInput] = useState('');
  const [documentos, setDocumentos] = useState({});
  const [archivosGuia, setArchivosGuia] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [cargandoDetalle, setCargandoDetalle] = useState(Boolean(factura));
  const [errorDetalle, setErrorDetalle] = useState('');
  const [codigoSapCliente, setCodigoSapCliente] = useState('');
  const [estadoSapCliente, setEstadoSapCliente] = useState('');
  const codigoRefs = useRef({});
  const cantidadRefs = useRef({});
  const cliente = clientes.find((item) => String(item.id) === String(f.cliente_id));

  useEffect(() => {
    setCodigoSapCliente(cliente?.codigo_sap || '');
    setEstadoSapCliente('');
  }, [f.cliente_id, cliente?.codigo_sap]);

  useEffect(() => {
    if (!factura) return undefined;
    let active = true;
    setCargandoDetalle(true);
    setErrorDetalle('');
    api('detalle', { factura_id: factura.id }).then((d) => {
      if (!active) return;
      setF((current) => ({ ...current, items: d.map((i) => ({
        ...blank, codigo: i.codigo || '', producto_id: i.producto_id, cantidad: +i.cantidad, precio: +i.precio,
        descuento: +i.descuento, es_ajuste: Number(i.es_ajuste) === 1,
      })) }));
    }).catch((error) => {
      if (active) setErrorDetalle(error.error || 'No se pudo cargar el detalle de la factura.');
    }).finally(() => {
      if (active) setCargandoDetalle(false);
    });
    return () => { active = false; };
  }, [factura]);

  const setItem = (index, key, value) => {
    setF((current) => {
      const items = [...current.items];
      items[index] = { ...items[index], [key]: value };
      if (key === 'codigo') items[index].lookupStatus = '';
      if (key === 'producto_id') {
        const product = productos.find((item) => String(item.id) === String(value));
        if (product) items[index] = {
          ...items[index],
          precio: product.precio == null ? '' : +product.precio,
        };
      }
      return { ...current, items };
    });
  };

  const buscarCodigo = async (index) => {
    const codigo = String(f.items[index]?.codigo || '').trim();
    if (!codigo) return;
    try {
      const product = await api('catalogo_por_codigo', { codigo, cliente_id: f.cliente_id });
      setF((current) => {
        if (String(current.items[index]?.codigo || '').trim() !== codigo) return current;
        const items = [...current.items];
        items[index] = {
          ...items[index], producto_id: product.id, precio: product.precio == null ? '' : +product.precio,
          lookupStatus: 'found',
        };
        return { ...current, items };
      });
      cantidadRefs.current[index]?.focus();
    } catch (error) {
      setF((current) => {
        if (String(current.items[index]?.codigo || '').trim() !== codigo) return current;
        const items = [...current.items];
        items[index] = {
          ...items[index],
          lookupStatus: error.error === 'Código no encontrado' ? 'missing' : 'error',
        };
        return { ...current, items };
      });
      if (error.error !== 'Código no encontrado') alert(error.error || 'No se pudo buscar el código');
    }
  };

  const buscarClienteSap = async () => {
    const codigo = codigoSapCliente.trim().toLocaleLowerCase();
    if (!codigo) {
      setEstadoSapCliente('');
      return;
    }
    const coincidencias = clientes.filter((item) =>
      String(item.codigo_sap || '').trim().toLocaleLowerCase() === codigo);
    if (coincidencias.length === 1) {
      const encontrado = coincidencias[0];
      setF((current) => ({ ...current, cliente_id: String(encontrado.id) }));
      setCodigoSapCliente(encontrado.codigo_sap);
      setEstadoSapCliente(`Cliente encontrado: ${encontrado.razon_social}`);
    } else if (coincidencias.length > 1) {
      setEstadoSapCliente('Hay varios clientes con ese SAP; selecciónalo en la lista.');
    } else {
      if (!cliente) {
        setEstadoSapCliente('Primero elige el cliente al que pertenece este código.');
        return;
      }
      try {
        await api('cliente_codigo_sap_guardar', {}, {
          cliente_id: cliente.id,
          codigo_sap: codigoSapCliente.trim(),
        });
        await reload();
        setEstadoSapCliente('Código SAP guardado para este cliente.');
      } catch (error) {
        setEstadoSapCliente(error.error || 'No se pudo guardar el código SAP.');
      }
    }
  };

  const guardarCodigo = async (item, index) => {
    try {
      await api('codigo_guardar', {}, {
        producto_id: item.producto_id,
        cliente_id: null,
        codigo: item.codigo,
        tipo: 'sap',
      });
      setF((current) => {
        const items = [...current.items];
        if (items[index]) items[index] = { ...items[index], lookupStatus: 'saved' };
        return { ...current, items };
      });
    } catch (error) {
      alert(error.error || 'No se pudo guardar el código');
    }
  };

  const agregarGuia = () => {
    const guia = guiaInput.trim();
    if (!guia || f.guias.includes(guia)) {
      setGuiaInput('');
      return;
    }
    setF({ ...f, guias: [...f.guias, guia] });
    setGuiaInput('');
  };

  const quitarGuia = (guia) => {
    setF({ ...f, guias: f.guias.filter((item) => item !== guia) });
  };

  const sub = f.items.reduce((sum, item) =>
    sum + Math.round(priceWithoutIgv(item.cantidad * item.precio * (1 - item.descuento / 100), config.igv) * 100) / 100, 0);
  const igv = Math.round(sub * Number(config.igv || 18)) / 100;
  const total = Math.round((sub + igv) * 100) / 100;
  const retencion = f.retencion ? Math.round(total * Number(config.retencion || 3)) / 100 : 0;
  const penalidad = f.aplica_penalidad ? Math.round(total * Number(f.porcentaje_penalidad || 10)) / 100 : 0;
  const neto = Math.max(0, Math.round((total - retencion - penalidad) * 100) / 100);

  const agregarFila = () => {
    const next = f.items.length;
    setF({ ...f, items: [...f.items, { ...blank }] });
    setTimeout(() => codigoRefs.current[next]?.focus(), 0);
  };

  const comprobarArchivo = (file) => {
    if (!file) return false;
    if (file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf')) {
      alert('Solo se permiten archivos PDF');
      return false;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('El PDF debe pesar como máximo 10 MB');
      return false;
    }
    return true;
  };

  const save = async () => {
    if (cargandoDetalle || errorDetalle) return;
    setGuardando(true);
    try {
      const saved = await api('factura_guardar', {}, {
        ...f, codigo_sap_cliente: codigoSapCliente.trim(),
        porcentaje_penalidad: Number(f.porcentaje_penalidad),
      });
      setF((current) => ({ ...current, id: saved.id, pendiente_id: undefined }));
      for (const [tipo, file] of Object.entries(documentos)) {
        if (file) await uploadApi('documento_subir', { factura_id: saved.id, tipo }, file);
      }
      for (const guia of saved.guias || []) {
        for (const tipo of ['guia_original', 'guia_sellada']) {
          const file = archivosGuia[`${guia.numero_guia}:${tipo}`];
          if (file) await uploadApi('documento_subir', { factura_id: saved.id, guia_id: guia.id, tipo }, file);
        }
      }
      onSaved();
    } catch (error) {
      alert(error.error || 'No se pudo guardar la factura o sus documentos');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal title={factura ? `Editar factura ${factura.numero}` : pendiente ? `Completar borrador ${pendiente.numero}` : 'Nueva factura'} onClose={onClose} wide>
      {cargandoDetalle && <p role="status">Cargando el detalle de la factura…</p>}
      {errorDetalle && <p className="history-status error" role="alert">{errorDetalle} No se puede guardar hasta que se cargue correctamente.</p>}
      {pendiente && (
        <div className="import-alert" role="alert">
          <b>Registro incompleto importado de Excel</b>
          <span>Completa fecha, cliente, retención y detalle. No se inventaron esos datos.</span>
          <span>Importes de referencia: subtotal {money(pendiente.subtotal_excel)}, IGV {money(pendiente.igv_excel)}, total {money(pendiente.total_excel)}.</span>
        </div>
      )}
      <div className="frm">
        <Field label="Cliente">
          <select value={f.cliente_id} onChange={(e) => {
            setF({ ...f, cliente_id: e.target.value });
            setCodigoSapCliente(clientes.find((item) => String(item.id) === e.target.value)?.codigo_sap || '');
            setEstadoSapCliente('');
          }}>
            <option value="">— Seleccione —</option>{clientes.map((item) => <option key={item.id} value={item.id}>{item.razon_social}</option>)}
          </select>
        </Field>
        <Field label="Código SAP del cliente">
          <input value={codigoSapCliente} maxLength={40} placeholder="Escribe el SAP y presiona Enter"
            onChange={(e) => { setCodigoSapCliente(e.target.value); setEstadoSapCliente(''); }}
            onBlur={buscarClienteSap} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); buscarClienteSap(); } }} />
          {estadoSapCliente && <small>{estadoSapCliente}</small>}
        </Field>
        <Field label="Fecha de emisión"><input type="date" value={f.emision} onChange={(e) => setF({ ...f, emision: e.target.value })} /></Field>
        <Field label="Días de crédito"><input type="number" min="0" max="3650" value={f.dias} onChange={(e) => setF({ ...f, dias: e.target.value })} /></Field>
        <Field label="N° de guías (Enter para agregar)">
          <div className="tag-field">
            {f.guias.map((guia) => <span className="tag" key={guia}>{guia}<button type="button" onClick={() => quitarGuia(guia)} aria-label={`Quitar guía ${guia}`}>×</button></span>)}
            <input value={guiaInput} onChange={(e) => setGuiaInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarGuia(); } }} placeholder="Escribe número de guía" />
          </div>
        </Field>
        <Field label="N° de orden de compra"><input maxLength={60} value={f.nro_oc} onChange={(e) => setF({ ...f, nro_oc: e.target.value })} /></Field>
        <Field label={`Retención ${config.retencion}%`}>
          <select value={f.retencion === null ? '' : f.retencion ? 1 : 0} onChange={(e) => setF({ ...f, retencion: e.target.value === '' ? null : e.target.value === '1' })}>
            <option value="">— Seleccione —</option><option value="1">Sí</option><option value="0">No</option>
          </select>
        </Field>
      </div>
      <div className="tablewrap form-table">
        <table className="tbl">
          <thead><tr><th>Código SAP predeterminado del producto</th><th>Producto</th><th>Marca</th><th>Presentación</th><th>Cantidad</th><th>Unidad</th><th>Precio unit. c/IGV</th><th>Dscto %</th><th>Total c/IGV</th><th></th></tr></thead>
          <tbody>
            {f.items.map((item, index) => (
              <tr key={index}>
                {item.es_ajuste ? (
                  <>
                    <td>—</td><td className="l"><b>Ajuste de conciliación (no es producto)</b></td><td colSpan="2">—</td>
                    <td>{item.cantidad}</td><td>AJUSTE</td><td>{money(item.precio)}</td><td>—</td>
                    <td className="n">{money(item.cantidad * item.precio)}</td><td></td>
                  </>
                ) : (
                  <>
                    <td>
                      <input ref={(node) => { codigoRefs.current[index] = node; }} value={item.codigo || ''}
                        aria-label={`Código fila ${index + 1}`}
                        placeholder="Código SAP predeterminado"
                        onChange={(e) => setItem(index, 'codigo', e.target.value)}
                        onBlur={() => buscarCodigo(index)}
                        onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === 'Tab') && item.codigo?.trim()) { e.preventDefault(); buscarCodigo(index); } }} />
                        {item.lookupStatus === 'missing' && <small className="lookup-missing">Código nuevo: asígnalo al producto y guárdalo como predeterminado.</small>}
                      {item.lookupStatus === 'found' && <small className="lookup-found">Encontrado</small>}
                      {item.lookupStatus === 'saved' && <small className="lookup-found">Código guardado</small>}
                    </td>
                    <td className="l">
                      <select value={item.producto_id} onChange={(e) => setItem(index, 'producto_id', e.target.value)}>
                        <option value="">— Elegir producto —</option>{productos.map((product) => <option key={product.id} value={product.id}>{product.nombre}</option>)}
                      </select>
                      {item.producto_id && item.codigo?.trim() && item.lookupStatus !== 'found' && item.lookupStatus !== 'saved' && (
                          <Btn c="gr s" onClick={() => guardarCodigo(item, index)}>Guardar como predeterminado</Btn>
                      )}
                    </td>
                    <td>{productos.find((product) => String(product.id) === String(item.producto_id))?.marca || '—'}</td>
                    <td>{productos.find((product) => String(product.id) === String(item.producto_id))?.presentacion || '—'}</td>
                    <td><input ref={(node) => { cantidadRefs.current[index] = node; }} type="number" min="0.001" step="0.001"
                      value={item.cantidad} onChange={(e) => setItem(index, 'cantidad', +e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && index === f.items.length - 1) { e.preventDefault(); agregarFila(); } }} /></td>
                    <td>{productos.find((product) => String(product.id) === String(item.producto_id))?.unidad || '—'}</td>
                    <td><input type="number" step="0.01" placeholder="Sin historial" value={item.precio} onChange={(e) => setItem(index, 'precio', e.target.value === '' ? '' : +e.target.value)} /></td>
                    <td><input type="number" min="0" max="100" step="0.01" value={item.descuento} onChange={(e) => setItem(index, 'descuento', +e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && index === f.items.length - 1) { e.preventDefault(); agregarFila(); } }} /></td>
                    <td className="n">{money(item.cantidad * item.precio * (1 - item.descuento / 100))}</td>
                    <td><Btn c="rd s" onClick={() => setF({ ...f, items: f.items.filter((_, row) => row !== index) })}>×</Btn></td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="bar">
        <Btn c="bl s" onClick={agregarFila}>+ Agregar ítem</Btn>
        {f.items.some((item) => item.es_ajuste) && <small>La línea de ajuste se conserva para cuadrar el subtotal original.</small>}
      </div>
      <label className="penalty-check">
        <input type="checkbox" checked={f.aplica_penalidad} onChange={(e) => setF({ ...f, aplica_penalidad: e.target.checked })} />
        Aplicar penalidad {f.porcentaje_penalidad}% del monto total
      </label>
      <div className="resumen invoice-summary">
        <span>Subtotal: <b>{money(sub)}</b></span><span>IGV {config.igv}%: <b>{money(igv)}</b></span>
        <span>Total: <b>{money(total)}</b></span><span>Penalidad: <b>{money(penalidad)}</b></span>
        <span>Retención {config.retencion}%: <b>{money(retencion)}</b></span><span>Neto a cobrar: <b>{money(neto)}</b></span>
      </div>
      <div className="frm upload-grid">
        {TIPOS_DOCUMENTO.map(([tipo, label]) => (
          <Field key={tipo} label={`${label} (PDF)`}>
            <input type="file" accept="application/pdf,.pdf" onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file || comprobarArchivo(file)) setDocumentos({ ...documentos, [tipo]: file });
              else e.target.value = '';
            }} />
          </Field>
        ))}
        {f.guias.map((guia) => ['guia_original', 'guia_sellada'].map((tipo) => (
          <Field key={`${guia}:${tipo}`} label={`Guía ${guia} ${tipo === 'guia_original' ? 'original' : 'sellada'} (PDF)`}>
            <input type="file" accept="application/pdf,.pdf" onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file || comprobarArchivo(file)) setArchivosGuia({ ...archivosGuia, [`${guia}:${tipo}`]: file });
              else e.target.value = '';
            }} />
          </Field>
        )))}
      </div>
      <div className="bar">
        <Btn c="gr" disabled={guardando || cargandoDetalle || Boolean(errorDetalle)} onClick={save}>{guardando ? 'Guardando…' : 'Guardar'}</Btn>
        <Btn c="rd" disabled={guardando} onClick={onClose}>Cancelar</Btn>
      </div>
    </Modal>
  );
}
