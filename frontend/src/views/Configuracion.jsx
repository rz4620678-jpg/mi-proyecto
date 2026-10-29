import { useContext, useState } from 'react';
import { Building2, DatabaseBackup, SlidersHorizontal, Palette, ShieldCheck } from 'lucide-react';
import { Ctx } from '../context';
import { api } from '../api';
import { downloadBackup } from '../backup';
import Modal from '../components/Modal';
import Field from '../components/Field';
import Btn from '../components/Btn';

const EMPRESA = [['empresa_nombre', 'Razón social'], ['empresa_ruc', 'RUC'], ['empresa_direccion', 'Dirección'], ['empresa_telefono', 'Teléfono'], ['empresa_email', 'Email']];
const PARAMS = [['igv', 'IGV (%)'], ['retencion', 'Retención (%)'], ['dias_credito', 'Días de crédito por defecto']];

// Formulario genérico que guarda pares clave/valor en la tabla configuracion
function ConfigForm({ titulo, campos, tipo = 'text', onClose }) {
  const { config, reload } = useContext(Ctx);
  const [v, setV] = useState(Object.fromEntries(campos.map(([k]) => [k, config[k] || ''])));
  const guardar = async () => { await api('config_guardar', {}, { valores: v }); await reload(); onClose(); };
  return (
    <Modal title={titulo} onClose={onClose}>
      <div className="frm">{campos.map(([k, l]) => <Field key={k} label={l}><input type={tipo} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></Field>)}</div>
      <div className="bar"><Btn c="gr" onClick={guardar}>Guardar</Btn><Btn c="rd" onClick={onClose}>Cancelar</Btn></div>
    </Modal>
  );
}

export default function Configuracion() {
  const [m, setM] = useState(null);
  const [errorRespaldo, setErrorRespaldo] = useState('');
  const cerrar = () => setM(null);
  const { config, reload } = useContext(Ctx);
  const tarjetas = [
    ['empresa', Building2, '#1d4fb5', 'DATOS DE LA EMPRESA', 'Editar información de la empresa'],
    ['respaldo', DatabaseBackup, '#1e9e48', 'RESPALDO DE DATOS', config.ultimo_respaldo ? `Último respaldo: ${config.ultimo_respaldo}` : 'Aún no se ha descargado un respaldo'],
    ['params', SlidersHorizontal, '#f07d00', 'PARÁMETROS GENERALES', 'Configurar parámetros del sistema'],
    ['color', Palette, '#1d4fb5', 'DISEÑO Y APARIENCIA', 'Personalizar colores y diseño'],
  ];
  const abrir = async (k) => {
    if (k !== 'respaldo') {
      setM(k);
      return;
    }
    try {
      setErrorRespaldo('');
      await downloadBackup();
      await reload();
    } catch (error) {
      setErrorRespaldo(error.message || 'No se pudo descargar el respaldo.');
    }
  };
  return (
    <>
      <div className="titlebar"><h2>CONFIGURACIÓN DEL SISTEMA</h2></div>
      <div className="tarjetas">
        {tarjetas.map(([k, I, c, t, s]) => <button key={k} className="tarjeta" onClick={() => abrir(k)}><I size={34} color={c} /><span><b>{t}</b><small>{s}</small></span></button>)}
      </div>
      <div className="backup-security-note"><ShieldCheck size={18} /> El sistema recuerda la fecha del último respaldo descargado. Descarga y guarda la copia fuera de este equipo.</div>
      {errorRespaldo && <p className="history-status error" role="alert">{errorRespaldo}</p>}
      {m === 'empresa' && <ConfigForm titulo="Datos de la empresa" campos={EMPRESA} onClose={cerrar} />}
      {m === 'params' && <ConfigForm titulo="Parámetros generales" campos={PARAMS} tipo="number" onClose={cerrar} />}
      {m === 'color' && <ConfigForm titulo="Color principal del sistema" campos={[['color', 'Color']]} tipo="color" onClose={cerrar} />}
    </>
  );
}
