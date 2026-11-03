const TIMEZONE = process.env.CLIMATE_TZ || 'America/Mexico_City';
const PERIODS = [
  { id: 'night', label: 'Madrugada', from: 0, to: 5 },
  { id: 'morning', label: 'Mañana', from: 6, to: 11 },
  { id: 'afternoon', label: 'Tarde', from: 12, to: 17 },
  { id: 'evening', label: 'Noche', from: 18, to: 23 },
];

const hourFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TIMEZONE,
  hour: '2-digit',
  hourCycle: 'h23',
});

function periodFor(date) {
  const hour = Number(hourFormatter.format(date));
  return PERIODS.find((period) => hour >= period.from && hour <= period.to) || PERIODS[0];
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}

function summarize(rates) {
  const rate = median(rates);
  return {
    samples: rates.length,
    medianRateCPerMin: rate == null ? null : Number(rate.toFixed(3)),
    minutesFor3C: rate && rate > 0 ? Number((3 / rate).toFixed(1)) : null,
  };
}

/*
 * Calcula ritmos reales a partir de lecturas que ya incluyen el estado del AC.
 * - Enfriamiento: ac_power=1 y la temperatura baja.
 * - Calentamiento: ac_power=0 y la temperatura sube.
 * Se ignoran huecos grandes (> 10 min) y lecturas sin estado del AC.
 */
function computeRates(rows = []) {
  const valid = rows
    .filter((row) => row && row.timestamp && row.temperature != null)
    .map((row) => ({
      ...row,
      time: Date.parse(row.timestamp),
      power: row.ac_power == null ? null : Number(row.ac_power),
      temperature: Number(row.temperature),
    }))
    .filter((row) => Number.isFinite(row.time) && Number.isFinite(row.temperature))
    .sort((a, b) => a.time - b.time);

  const cooling = [];
  const warming = [];
  const byPeriod = new Map(
    PERIODS.map((period) => [period.id, { period: period.label, cooling: [], warming: [] }]),
  );

  for (let i = 1; i < valid.length; i += 1) {
    const previous = valid[i - 1];
    const current = valid[i];
    const dtMin = (current.time - previous.time) / 60000;
    if (dtMin < 0.5 || dtMin > 10) continue;
    if (current.power == null) continue;

    const delta = current.temperature - previous.temperature;
    const period = byPeriod.get(periodFor(new Date(current.time)).id);

    if (current.power === 1 && delta <= -0.1) {
      const rate = Math.abs(delta) / dtMin;
      cooling.push(rate);
      period?.cooling.push(rate);
    } else if (current.power === 0 && delta >= 0.05) {
      const rate = delta / dtMin;
      warming.push(rate);
      period?.warming.push(rate);
    }
  }

  return {
    totalSamples: valid.filter((row) => row.power != null).length,
    cooling: summarize(cooling),
    warming: summarize(warming),
    byPeriod: PERIODS.map((period) => {
      const entry = byPeriod.get(period.id);
      return {
        period: entry.period,
        cooling: summarize(entry.cooling),
        warming: summarize(entry.warming),
      };
    }),
  };
}

module.exports = { computeRates, PERIODS };
