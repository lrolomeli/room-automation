import Card from '../components/ui/Card';
import Gauge from '../components/ui/Gauge';
import Banner from '../components/ui/Banner';
import Spinner from '../components/ui/Spinner';
import { usePoll } from '../hooks/usePoll';

function tempColor(t) {
  if (t > 35) return '#ff4757';
  if (t > 28) return '#ffa502';
  if (t > 20) return '#2ed573';
  return '#1e90ff';
}

function humColor(h) {
  if (h > 80) return '#ff6b81';
  if (h > 60) return '#ffa502';
  return '#2ed573';
}

export default function NowSection() {
  const sensor = usePoll('/api/sensors/current', 60000);
  const ac = usePoll('/api/ir/status', 60000);

  if (sensor.loading) return <Spinner label="Conectando con el sensor…" />;

  const data = sensor.data;
  const stale = data?.status === 'stale';
  const acState = ac.data;
  const acOn = acState?.valid && acState?.power;

  return (
    <Card title="Ahora">
      {!data && <Banner variant="warn" className="mb-3">Sensor sin conexión — sin lecturas recientes</Banner>}
      {stale && <Banner variant="warn" className="mb-3">Sensor sin conexión — mostrando la última lectura</Banner>}

      <div className="flex gap-3">
        <Gauge
          label="Temperatura"
          value={data ? Number(data.temperature).toFixed(1) : '--'}
          unit="°C"
          color={data ? tempColor(data.temperature) : 'rgba(255,255,255,0.3)'}
          pct={data ? ((data.temperature + 10) / 60) * 100 : 0}
        />
        <Gauge
          label="Humedad"
          value={data ? Number(data.humidity).toFixed(1) : '--'}
          unit="%"
          color={data ? humColor(data.humidity) : 'rgba(255,255,255,0.3)'}
          pct={data ? data.humidity : 0}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-white/60">
        <span className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${!data || stale ? 'bg-danger' : 'bg-ok'}`}
          />
          {!data ? 'Desconectado' : stale ? 'Sin conexión' : 'En vivo'}
        </span>
        <span>
          Aire:{' '}
          <b className="text-white">{acOn ? `Encendido · ${acState.temp}°C` : 'Apagado'}</b>
        </span>
        {data?.timestamp && (
          <span className="text-white/40">
            · {new Date(data.timestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
    </Card>
  );
}
