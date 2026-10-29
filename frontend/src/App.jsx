import { useEffect, useState } from 'react';
import { api } from './api';
import { Ctx } from './context';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Dashboard from './views/Dashboard';
import Facturas from './views/Facturas';
import Detalle from './views/Detalle';
import Cobros from './views/Cobros';
import Clientes from './views/Clientes';
import Precios from './views/Precios';
import Reportes from './views/Reportes';
import Configuracion from './views/Configuracion';
import Listas from './views/Listas';
import BackupReminder from './components/BackupReminder';

const VIEWS = { dashboard: Dashboard, facturas: Facturas, detalle: Detalle, cobros: Cobros, clientes: Clientes, precios: Precios, reportes: Reportes, config: Configuracion, listas: Listas };

export default function App() {
  const [tab, setTab] = useState('dashboard');
  const [intent, setIntent] = useState(null);
  const [boot, setBoot] = useState(null);
  const [bootError, setBootError] = useState('');
  const reload = async () => {
    try {
      setBoot(await api('bootstrap'));
      setBootError('');
    } catch (error) {
      setBoot(null);
      setBootError(error.error || 'No se pudo conectar con el servidor.');
    }
  };
  useEffect(() => { reload(); }, []);
  useEffect(() => { if (boot?.config?.color) document.documentElement.style.setProperty('--nv', boot.config.color); }, [boot]);
  if (!boot) return (
    <div className={bootError ? 'connection-error' : 'loading'} role={bootError ? 'alert' : undefined}>
      {bootError ? (
        <>
          <h2>No se pudo conectar con el servidor</h2>
          <p>{bootError} Verifica que Apache y MySQL estén activos.</p>
          <button className="btn bl" onClick={reload}>Reintentar</button>
        </>
      ) : 'Cargando…'}
    </div>
  );

  const go = (k, i = null) => { setIntent(i); setTab(k); };
  const View = VIEWS[tab];
  return (
    <Ctx.Provider value={{ ...boot, reload, go, intent }}>
      <div className="app">
        <Sidebar tab={tab} go={go} empresa={boot.config.empresa_nombre} />
        <div className="main">
          <Topbar />
          <BackupReminder />
          <div className="content"><View key={tab + (intent || '')} /></div>
        </div>
      </div>
    </Ctx.Provider>
  );
}
