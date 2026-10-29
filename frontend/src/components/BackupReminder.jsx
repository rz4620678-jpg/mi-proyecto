import { useEffect, useState } from 'react';
import { DatabaseBackup, X } from 'lucide-react';
import { api } from '../api';
import { downloadBackup } from '../backup';

const SEMANA_MS = 7 * 24 * 60 * 60 * 1000;
const DESCRIPCION_SEMANAL = 'Ha pasado una semana desde tu último respaldo. Te recomendamos descargar una copia de seguridad de tu inventario y ventas actuales antes de continuar.';

export default function BackupReminder() {
  const [ultimoRespaldo, setUltimoRespaldo] = useState(null);
  const [error, setError] = useState('');
  const [oculto, setOculto] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [ahora, setAhora] = useState(Date.now());

  useEffect(() => {
    let active = true;
    api('respaldo_estado').then((data) => {
      if (active) setUltimoRespaldo(data.ultimo_respaldo);
    }).catch((failure) => {
      if (active) setError(failure.error || 'No se pudo verificar la fecha del último respaldo.');
    });
    const interval = setInterval(() => setAhora(Date.now()), 60 * 1000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const fechaRespaldo = ultimoRespaldo ? new Date(String(ultimoRespaldo).replace(' ', 'T')).getTime() : null;
  const respaldoVencido = !fechaRespaldo || ahora - fechaRespaldo >= SEMANA_MS;
  if (oculto || (!error && !respaldoVencido)) return null;

  const descargar = async () => {
    setDescargando(true);
    setError('');
    try {
      const estado = await downloadBackup();
      setUltimoRespaldo(estado.ultimo_respaldo);
      setOculto(false);
    } catch (failure) {
      setError(failure.message || 'No se pudo descargar el respaldo.');
    } finally {
      setDescargando(false);
    }
  };

  const descripcion = error
    ? error
    : fechaRespaldo
      ? DESCRIPCION_SEMANAL
      : 'Aún no hay un respaldo registrado. Te recomendamos descargar una copia de seguridad de tu inventario y ventas actuales antes de continuar.';

  return (
    <section className="backup-reminder" role="alert">
      <div className="backup-reminder-icon"><DatabaseBackup size={22} /></div>
      <div className="backup-reminder-copy">
        <b>🔒 ¡Mantén tus datos seguros!</b>
        <span>{descripcion}</span>
      </div>
      <button className="btn gr" onClick={descargar} disabled={descargando}>
        {descargando ? 'Preparando respaldo…' : 'Descargar respaldo'}
      </button>
      <button className="backup-reminder-close" aria-label="Cerrar aviso" onClick={() => setOculto(true)}><X size={18} /></button>
    </section>
  );
}
