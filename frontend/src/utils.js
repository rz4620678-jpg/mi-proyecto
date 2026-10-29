export const money = (n) => 'S/ ' + Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const money4 = (n) => 'S/ ' + Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
export const fdate = (d) => (d ? d.split('-').reverse().join('/') : '');
export const today = () => new Date().toISOString().slice(0, 10);
export const igvFactor = (igv) => 1 + Number(igv ?? 18) / 100;
export const priceWithIgv = (price, igv) => Number(price || 0) * igvFactor(igv);
export const priceWithoutIgv = (price, igv) => Number(price || 0) / igvFactor(igv);
export const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
export const COLOR_ESTADO = { COBRADA: '#1e9e48', PENDIENTE: '#f5b400', VENCIDA: '#d92d20', PARCIAL: '#f07d00', ANULADA: '#8a93a8' };

export function exportCsv(rows, name) {
  if (!rows || !rows.length) return alert('No hay datos para exportar');
  const k = Object.keys(rows[0]);
  const txt = [k.join(','), ...rows.map((r) => k.map((c) => '"' + String(r[c] ?? '').replace(/"/g, '""') + '"').join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\ufeff' + txt], { type: 'text/csv' }));
  a.download = name + '.csv';
  a.click();
}
