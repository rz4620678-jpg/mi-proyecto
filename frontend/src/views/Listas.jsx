import { useContext, useState } from 'react';
import { Package, ClipboardList, FileX, Landmark, CreditCard } from 'lucide-react';
import { Ctx } from '../context';
import { api } from '../api';
import { money, priceWithoutIgv, COLOR_ESTADO } from '../utils';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import Field from '../components/Field';
import Btn from '../components/Btn';

// Lista simple (bancos, formas de pago, motivos): agregar y eliminar
function ListaSimple({ tipo, titulo, onClose }) {
  const { listas, reload } = useContext(Ctx);
  const [n, setN] = useState('');
  const add = async () => { if (!n) return; await api('lista_guardar', {}, { tipo, nombre: n }); setN(''); reload(); };
  const del = async (id) => { await api('lista_eliminar', {}, { id }); reload(); };
  return (
    <Modal title={titulo} onClose={onClose}>
      <DataTable cols={[{ h: 'Nombre', k: 'nombre', cls: 'l' }, { h: '', render: (r) => <Btn c="rd s" onClick={() => del(r.id)}>✕</Btn> }]} rows={listas[tipo]} />
      <div className="bar"><input placeholder="Nuevo valor…" value={n} onChange={(e) => setN(e.target.value)} /><Btn c="gr" onClick={add}>Agregar</Btn></div>
    </Modal>
  );
}

function Productos({ onClose }) {
  const { productos, reload, config } = useContext(Ctx);
  const [f, setF] = useState({ nombre: '', marca: 'MP', presentacion: '', unidad: 'UND', costo: '' });
  const add = async () => { try { await api('producto_guardar', {}, f); reload(); } catch (e) { alert(e.error); } };
  const del = async (id) => { try { await api('producto_eliminar', {}, { id }); reload(); } catch (e) { alert(e.error); } };
  const cols = [{ h: 'Producto', k: 'nombre', cls: 'l' }, { h: 'Marca', k: 'marca' }, { h: 'Presentación', k: 'presentacion' }, { h: 'Unidad', k: 'unidad' }, { h: 'Precio con IGV', render: (r) => r.precio == null ? 'Sin historial' : money(r.precio), cls: 'n' }, { h: 'Precio sin IGV', render: (r) => r.precio == null ? 'Sin historial' : money(priceWithoutIgv(r.precio, config.igv)), cls: 'n' }, { h: 'Costo', render: (r) => r.costo == null ? 'Sin dato' : money(r.costo), cls: 'n' }, { h: '', render: (r) => <Btn c="rd s" onClick={() => del(r.id)}>✕</Btn> }];
  return (
    <Modal title={`Lista de productos (${productos.length})`} onClose={onClose} wide>
      <DataTable cols={cols} rows={productos} />
      <div className="frm">
        {['nombre', 'marca', 'presentacion', 'unidad'].map((k) => <Field key={k} label={k.toUpperCase()}><input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></Field>)}
        <Field label="COSTO UNITARIO"><input type="number" step="0.0001" value={f.costo} onChange={(e) => setF({ ...f, costo: e.target.value })} /></Field>
      </div>
      <small>El precio con IGV se toma de la última factura no anulada; el precio sin IGV se calcula con la tasa configurada. Si no hay historial, ingrésalo al facturar.</small>
      <div className="bar"><Btn c="gr" onClick={add}>Agregar producto</Btn></div>
    </Modal>
  );
}

export default function Listas() {
  const [m, setM] = useState(null);
  const tarjetas = [
    ['productos', Package, '#f07d00', 'LISTA DE PRODUCTOS', 'Catálogo de productos'], ['banco', Landmark, '#1e9e48', 'LISTA DE BANCOS', 'Bancos disponibles'],
    ['estados', ClipboardList, '#1e9e48', 'ESTADOS DE COBRANZA', 'Estados de cobranza'], ['forma_pago', CreditCard, '#1d4fb5', 'FORMAS DE PAGO', 'Formas de pago disponibles'],
    ['motivo', FileX, '#6b3fa0', 'MOTIVOS DE ANULACIÓN', 'Motivos de anulación'],
  ];
  const titulo = Object.fromEntries(tarjetas.map((t) => [t[0], t[3]]));
  return (
    <>
      <div className="titlebar"><h2>LISTAS DEL SISTEMA</h2></div>
      <div className="tarjetas">
        {tarjetas.map(([k, I, c, t, s]) => <button key={k} className="tarjeta" onClick={() => setM(k)}><I size={34} color={c} /><span><b>{t}</b><small>{s}</small></span></button>)}
      </div>
      {m === 'productos' && <Productos onClose={() => setM(null)} />}
      {['banco', 'forma_pago', 'motivo'].includes(m) && <ListaSimple tipo={m} titulo={titulo[m]} onClose={() => setM(null)} />}
      {m === 'estados' && (
        <Modal title="Estados de cobranza" onClose={() => setM(null)}>
          <p>Los estados se calculan automáticamente según cobros y fecha de vencimiento:</p>
          {Object.entries(COLOR_ESTADO).map(([e, c]) => <p key={e}><span className={'badge ' + e}>{e}</span></p>)}
        </Modal>
      )}
    </>
  );
}
