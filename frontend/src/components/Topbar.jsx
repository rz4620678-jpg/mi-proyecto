import { useEffect, useState } from 'react';
import { CalendarDays } from 'lucide-react';

export default function Topbar() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);
  return (
    <header className="topbar">
      <h1>SISTEMA DE FACTURAS POR COBRAR</h1>
      <div className="hoy">
        <span>Hoy es: <CalendarDays size={14} /> {now.toLocaleDateString('es-PE')}</span>
        <span>{now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </header>
  );
}
