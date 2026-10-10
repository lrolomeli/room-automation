import { useState } from 'react';
import MonitorView from './views/MonitorView';
import ControlView from './views/ControlView';
import AutomationView from './views/AutomationView';

const TABS = [
  { id: 'monitor', label: 'Monitor' },
  { id: 'control', label: 'Control' },
  { id: 'auto', label: 'Automatización' },
];

export default function ClimateApp({ user, onLogout }) {
  const [tab, setTab] = useState('control');

  return (
    <div className="cl-app">
      <div className="cl-header">
        <a href="https://luisrlp.com" className="cl-home">← Home</a>
        <h1>Aire</h1>
        {onLogout && (
          <button
            type="button"
            className="cl-logout"
            onClick={onLogout}
            title={user?.username ? `Sesión de ${user.username}` : 'Cerrar sesión'}
          >
            Salir
          </button>
        )}
      </div>

      <div className="cl-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`cl-tab ${tab === t.id ? 'cl-tab-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'monitor' && <MonitorView />}
      {tab === 'control' && <ControlView />}
      {tab === 'auto' && <AutomationView />}
    </div>
  );
}
