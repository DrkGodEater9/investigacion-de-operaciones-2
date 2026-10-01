import { useState } from 'react';
import Tabs from '@/ui/Tabs.jsx';
import ModeSwitch from './ModeSwitch.jsx';
import ActivityTable from './ActivityTable.jsx';
import MarkdownPanel from './MarkdownPanel.jsx';
import TemplatePanel from './TemplatePanel.jsx';
import IssuesList from './IssuesList.jsx';

export default function InputPanel({ project, dispatch, analysis, hoveredAct, onHoverAct, notify }) {
  const [tab, setTab] = useState('markdown');
  const errorRows = new Set((analysis.errors || []).map((e) => e.row).filter((r) => r != null));

  return (
    <section className="panel input-panel" aria-label="Datos del ejercicio">
      <Tabs
        label="Entrada de datos"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'markdown', label: 'Markdown' },
          { id: 'table', label: 'Tabla', badge: project.rows.length },
          { id: 'template', label: 'Plantilla para IA' },
        ]}
      />
      <div className="panel-body">
        {tab === 'table' && (
          <>
            <ModeSwitch mode={project.mode} decimals={project.decimals} dispatch={dispatch} />
            <ActivityTable project={project} dispatch={dispatch} errorRows={errorRows} hoveredAct={hoveredAct} onHoverAct={onHoverAct} />
            <IssuesList errors={analysis.errors} warnings={analysis.warnings} />
          </>
        )}
        {tab === 'markdown' && (
          <>
            <MarkdownPanel project={project} dispatch={dispatch} notify={notify} />
            <IssuesList errors={analysis.errors} warnings={analysis.warnings} />
          </>
        )}
        {tab === 'template' && <TemplatePanel notify={notify} />}
      </div>
    </section>
  );
}
