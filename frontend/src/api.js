import { useEffect, useState } from 'react';

export const BASE = import.meta.env.DEV
  ? '/api'
  : new URL('./backend/api.php', window.location.href).pathname;

export async function api(r, params = {}, body) {
  const res = await fetch(`${BASE}?r=${r}&${new URLSearchParams(params)}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw data;
  return data;
}

export async function uploadApi(r, fields, file) {
  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => form.append(key, value));
  form.append('archivo', file);
  const res = await fetch(`${BASE}?r=${r}`, { method: 'POST', body: form });
  const data = await res.json();
  if (!res.ok) throw data;
  return data;
}

// Hook: carga datos de una ruta y recarga cuando cambian los parámetros o deps
export function useApi(route, params = {}, deps = [], onError) {
  const [data, setData] = useState(null);
  useEffect(() => {
    let vivo = true;
    const load = () => api(route, params)
      .then((d) => {
        if (vivo) setData(d);
      })
      .catch((error) => {
        if (!vivo) return;
        setData([]);
        onError?.(error);
      });
    load();
    return () => {
      vivo = false;
    };
  }, [route, JSON.stringify(params), ...deps, onError]);
  return data;
}
