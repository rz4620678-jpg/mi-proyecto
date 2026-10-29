import { api, BASE } from './api';

export async function downloadBackup() {
  const response = await fetch(`${BASE}?r=respaldo`);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'No se pudo generar el respaldo.');
  }
  const blob = await response.blob();
  if (blob.size === 0) throw new Error('El respaldo descargado está vacío.');

  const disposition = response.headers.get('Content-Disposition') || '';
  const filename = disposition.match(/filename="([^"]+)"/i)?.[1] || 'respaldo.sql';
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  return api('respaldo_estado');
}
