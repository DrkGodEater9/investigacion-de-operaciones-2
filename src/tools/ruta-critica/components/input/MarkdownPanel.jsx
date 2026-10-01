import { useEffect, useRef, useState } from 'react';
import { parseText } from '../../domain/parser.js';
import { projectToMarkdown } from '../../domain/markdown.js';
import { copyText } from '@/shared/files.js';

const MODE_NAME = { network: 'solo la red', cpm: 'CPM', pert: 'PERT' };

/** Editor Markdown en vivo: cada cambio reconstruye la red. */
export default function MarkdownPanel({ project, dispatch, notify }) {
  const [text, setText] = useState(() => projectToMarkdown(project));
  const [status, setStatus] = useState(null);
  const version = useRef(project.version);
  const dirty = useRef(false);

  // Si se carga un ejemplo o un ejercicio nuevo, el texto se regenera.
  useEffect(() => {
    if (project.version !== version.current) {
      version.current = project.version;
      dirty.current = false;
      setText(projectToMarkdown(project));
      setStatus(null);
    }
  }, [project]);

  useEffect(() => {
    if (!dirty.current) return undefined;
    const t = setTimeout(() => {
      const parsed = parseText(text);
      if (!parsed.activities.length) {
        setStatus({ kind: 'error', text: 'No encuentro actividades. La tabla necesita una columna «Actividad» y otra «Predecesoras».' });
        return;
      }
      dispatch({ type: 'replace', project: parsed });
      setStatus({ kind: 'ok', text: `${parsed.activities.length} actividades, ${MODE_NAME[parsed.mode]}. El diagrama ya está actualizado.` });
    }, 350);
    return () => clearTimeout(t);
  }, [text, dispatch]);

  const onChange = (v) => { dirty.current = true; setText(v); };

  const openFile = async (file) => {
    if (!file) return;
    onChange(await file.text());
  };

  return (
    <div className="md-panel">
      <p className="lead">Escribe o pega la tabla en Markdown. El diagrama se redibuja mientras escribes.</p>
      <textarea
        className="paste-area md-area"
        value={text}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Tabla del ejercicio en Markdown"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { if (e.dataTransfer.files[0]) { e.preventDefault(); openFile(e.dataTransfer.files[0]); } }}
      />
      {status && <p className={'import-msg import-msg--' + status.kind}>{status.text}</p>}
      <div className="row-gap">
        <label className="btn btn--sm">
          Abrir archivo .md
          <input type="file" accept=".md,.markdown,.txt" hidden onChange={(e) => openFile(e.target.files[0])} />
        </label>
        <button type="button" className="btn btn--sm btn--ghost" onClick={async () => notify((await copyText(text)) ? 'Markdown copiado' : 'No se pudo copiar')}>
          Copiar
        </button>
        <button type="button" className="btn btn--sm btn--ghost" onClick={() => onChange('# Nuevo ejercicio\n| Actividad | Predecesoras | Duración |\n|---|---|---|\n| A | - | |')}>
          Vaciar
        </button>
      </div>
      <details className="md-help">
        <summary>Formato que entiende</summary>
        <ul>
          <li>La línea con «#» es el título.</li>
          <li>Columnas «Actividad | Predecesoras | Duración» para CPM.</li>
          <li>Columnas «a | m | b» (optimista, más probable, pesimista) para PERT.</li>
          <li>Solo «Actividad | Predecesoras» para construir únicamente la red.</li>
          <li>Predecesoras separadas por comas; «-» si no tiene. También sirve una tabla copiada de Excel o de Word.</li>
        </ul>
      </details>
    </div>
  );
}
