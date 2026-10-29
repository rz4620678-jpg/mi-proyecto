import { HelpCircle } from 'lucide-react';
import { NAV } from '../nav';
import logo from '../assets/kb-clean-logo.jpeg';

export default function Sidebar({ tab, go, empresa }) {
  return (
    <aside className="side">
      <div className="logo">
        <img src={logo} alt="KB Clean, distribuidor de dispositivos médicos e insumos de limpieza" />
        <div>{empresa || 'KB CLEAN'}</div>
      </div>
      {NAV.map((n) => (
        <button key={n.k} className={'nav' + (tab === n.k ? ' on' : '')} onClick={() => go(n.k)}><n.i size={16} />{n.l}</button>
      ))}
      <button className="nav" onClick={() => alert('Ayuda:\n• Selecciona una fila para Editar o Eliminar.\n• Las facturas con retención 3% se calculan sobre el total.\n• Estados: Pendiente, Parcial, Vencida, Cobrada y Anulada se calculan solos.')}><HelpCircle size={16} />Ayuda</button>
    </aside>
  );
}
