import { LayoutDashboard, FileText, ListChecks, Wallet, Users, Tag, BarChart3, Settings, List } from 'lucide-react';

// k = clave interna, l = texto del menú
export const NAV = [
  { k: 'dashboard', l: 'Dashboard', i: LayoutDashboard },
  { k: 'facturas', l: 'Facturas', i: FileText },
  { k: 'detalle', l: 'Detalle Facturas', i: ListChecks },
  { k: 'cobros', l: 'Cobros', i: Wallet },
  { k: 'clientes', l: 'Clientes', i: Users },
  { k: 'precios', l: 'Historial Precios', i: Tag },
  { k: 'reportes', l: 'Reportes', i: BarChart3 },
  { k: 'config', l: 'Configuración', i: Settings },
  { k: 'listas', l: 'Listas', i: List },
];
