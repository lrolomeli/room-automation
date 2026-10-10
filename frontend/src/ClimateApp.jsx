import { useState } from 'react';
import MonitorView from './views/MonitorView';
import ControlView from './views/ControlView';
import AutomationView from './views/AutomationView';

const TABS = [
  { id: 'monitor', label: 'Monitor' },
  { id: 'control', label: 'Control' },
  { id: 'auto', label: 'Automatización' },
];

export default function ClimateApp() {
  const [tab, setTab] = useState('control');

  return (
    <div className="cl-app">
      <div className="cl-header">
        <a href="/" className="cl-home">← Home</a>
        <h1>Aire</h1>
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
