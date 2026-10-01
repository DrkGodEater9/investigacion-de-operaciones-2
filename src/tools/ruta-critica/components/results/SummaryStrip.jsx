import { fmt } from '../../domain/format.js';

export default function SummaryStrip({ analysis, pertInfo }) {
  const { times, net, critical, decimals, activities, dummies } = analysis;
  const items = [];
  if (times) items.push({ value: fmt(times.T, decimals), label: 'Duración del proyecto', main: true });
  if (times) items.push({ value: critical.routes.length, label: critical.routes.length === 1 ? 'Ruta crítica' : 'Rutas críticas' });
  if (pertInfo) items.push({ value: fmt(pertInfo.sd, 3), label: 'Desviación estándar del proyecto' });
  items.push({ value: activities.length, label: 'Actividades' });
  items.push({ value: net.nodes.length, label: 'Eventos' });
  items.push({ value: dummies, label: dummies === 1 ? 'Ficticia' : 'Ficticias' });
  return (
    <dl className="summary">
      {items.map((it) => (
        <div key={it.label} className={'summary-item' + (it.main ? ' is-main' : '')}>
          <dt>{it.label}</dt>
          <dd>{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}
