import Card from '../components/ui/Card';
import Banner from '../components/ui/Banner';
import Spinner from '../components/ui/Spinner';
import StatTile from '../components/ui/StatTile';
import { usePoll } from '../hooks/usePoll';

function fmtMinutes(value) {
  return value == null ? '—' : `${value} min`;
}

export default function RatesCard() {
  const { data, loading } = usePoll('/api/room/rates', 300000);

  if (loading && !data) return <Spinner label="Calculando tiempos…" />;

  const total = data?.totalSamples ?? 0;
  const cooling = data?.cooling;
  const warming = data?.warming;
  const periods = data?.byPeriod || [];
  const hasPeriods = periods.some(
    (period) => period.cooling.samples > 0 || period.warming.samples > 0,
  );

  return (
    <Card title="Tiempos medidos">
      {total < 5 ? (
        <Banner variant="info">
          Recopilando datos… {total} muestra{total === 1 ? '' : 's'} con estado del aire.
          Necesitamos al menos 5 para estimar.
        </Banner>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <StatTile
              label="Enfriar 3 °C"
              value={fmtMinutes(cooling?.minutesFor3C)}
              accent="text-hum"
            />
            <StatTile
              label="Calentar 3 °C"
              value={fmtMinutes(warming?.minutesFor3C)}
              accent="text-warn"
            />
          </div>

          <div className="text-center text-xs text-white/45">
            Enfriar: {cooling?.samples ?? 0} muestras · Calentar: {warming?.samples ?? 0} muestras
          </div>

          {hasPeriods && (
            <div className="flex flex-col gap-1.5 border-t border-white/10 pt-3">
              {periods.map((period) => (
                <div
                  key={period.period}
                  className="flex items-center justify-between gap-2 text-xs text-white/60"
                >
                  <span>{period.period}</span>
                  <span>
                    Frío {fmtMinutes(period.cooling.minutesFor3C)} · Calor{' '}
                    {fmtMinutes(period.warming.minutesFor3C)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
