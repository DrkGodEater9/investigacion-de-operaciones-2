import { useState } from 'react';
import Tabs from '@/ui/Tabs.jsx';
import { ModelTable } from './ModelTable.jsx';
import { MarkdownInput } from './MarkdownInput.jsx';
import { TemplatePanel } from './TemplatePanel.jsx';
import { OptionsModal } from './OptionsModal.jsx';
import { ValidationAlert } from './ValidationAlert.jsx';

export function InputPanel({
  model,
  onSetSense,
  onSetNumVars,
  onSetC,
  onAddConstraint,
  onRemoveConstraint,
  onSetConstraintA,
  onSetConstraintOp,
  onSetConstraintB,
  onSetInteger,
  onSetOptions,
  onApplyMarkdown,
  allowIntegerToggle = false,
  errors = [],
  warnings = [],
  notify,
}) {
  const [tab, setTab] = useState('table');

  return (
    <section className="panel input-panel" aria-label="Entrada del modelo">
      <Tabs
        label="Modo de entrada"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'table', label: 'Tabla', badge: model.constraints.length },
          { id: 'markdown', label: 'Markdown' },
          { id: 'template', label: 'Plantilla para IA' },
        ]}
      />

      <div className="panel-body">
        {tab === 'table' && (
          <>
            <ModelTable
              model={model}
              onSetSense={onSetSense}
              onSetNumVars={onSetNumVars}
              onSetC={onSetC}
              onAddConstraint={onAddConstraint}
              onRemoveConstraint={onRemoveConstraint}
              onSetConstraintA={onSetConstraintA}
              onSetConstraintOp={onSetConstraintOp}
              onSetConstraintB={onSetConstraintB}
              allowIntegerToggle={allowIntegerToggle}
              onSetInteger={onSetInteger}
            />
            <OptionsModal options={model.options} onChange={onSetOptions} />
            <ValidationAlert errors={errors} warnings={warnings} />
          </>
        )}

        {tab === 'markdown' && (
          <>
            <MarkdownInput
              model={model}
              onApplyMarkdown={onApplyMarkdown}
              notify={notify}
            />
            <ValidationAlert errors={errors} warnings={warnings} />
          </>
        )}

        {tab === 'template' && <TemplatePanel notify={notify} />}
      </div>
    </section>
  );
}
