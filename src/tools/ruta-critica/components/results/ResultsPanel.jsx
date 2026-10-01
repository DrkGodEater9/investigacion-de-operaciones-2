import { useEffect, useState } from 'react';
import Tabs from '@/ui/Tabs.jsx';
import SummaryStrip from './SummaryStrip.jsx';
import TimesTable from './TimesTable.jsx';
import EventsTable from './EventsTable.jsx';
import RoutesView from './RoutesView.jsx';
import PertView from './PertView.jsx';
import GanttView from './GanttView.jsx';

export default function ResultsPanel({ analysis, title, hoveredAct, onHoverAct, selectedRoute, onSelectRoute, pertInfo, routeIdx, setRouteIdx, notify }) {
  const hasTimes = !!analysis.times;
  const tabs = [
    { id: 'times', label: hasTimes ? 'Tabla de tiempos' : 'Actividades y eventos' },
    { id: 'events', label: 'Eventos' },
    { id: 'routes', label: 'Rutas', badge: analysis.all.routes.length + (analysis.all.truncated ? '+' : '') },
    ...(analysis.mode === 'pert' && pertInfo ? [{ id: 'pert', label: 'Análisis PERT' }] : []),
    ...(hasTimes ? [{ id: 'gantt', label: 'Gantt' }] : []),
  ];
  const [tab, setTab] = useState('times');
  useEffect(() => {
    if (!tabs.some((t) => t.id === tab)) setTab('times');
  });

  return (
    <section className="panel results-panel print-area" aria-label="Resultados">
      <SummaryStrip analysis={analysis} pertInfo={pertInfo} />
      <div className="no-print">
        <Tabs label="Resultados" tabs={tabs} value={tab} onChange={setTab} />
      </div>
      <div className="panel-body">
        {tab === 'times' && <TimesTable analysis={analysis} hoveredAct={hoveredAct} onHoverAct={onHoverAct} title={title} notify={notify} />}
        {tab === 'events' && <EventsTable analysis={analysis} title={title} notify={notify} />}
        {tab === 'routes' && <RoutesView analysis={analysis} selectedRoute={selectedRoute} onSelectRoute={onSelectRoute} />}
        {tab === 'pert' && pertInfo && <PertView analysis={analysis} pertInfo={pertInfo} routeIdx={routeIdx} setRouteIdx={setRouteIdx} title={title} notify={notify} />}
        {tab === 'gantt' && hasTimes && <GanttView analysis={analysis} hoveredAct={hoveredAct} onHoverAct={onHoverAct} />}
      </div>
    </section>
  );
}
