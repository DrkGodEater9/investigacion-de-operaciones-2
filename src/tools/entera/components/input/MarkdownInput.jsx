import { useState, useEffect } from 'react';
import { modelToMarkdown } from '../../domain/parser.js';
import { copyText } from '@/shared/files.js';

const MAX_MD = 20000;

export function MarkdownInput({ model, onApplyMarkdown, notify }) {
  const [text, setText] = useState('');

  useEffect(() => {
    setText(modelToMarkdown(model, model.title));
  }, [model]);

  const handleApply = () => {
    const ok = onApplyMarkdown(text);
    if (ok) {
      notify('Modelo cargado desde Markdown');
    } else {
      notify('No se pudo interpretar el formato Markdown. Revisa la sintaxis.');
    }
  };

  const handleCopy = async () => {
    const ok = await copyText(text);
    notify(ok ? 'Markdown copiado al portapapeles' : 'Error al copiar');
  };

  return (
    <div className="markdown-input-container">
      <p className="markdown-hint">
        Puedes editar o pegar directamente una tabla Markdown con el formato del modelo. Al hacer clic en «Cargar al modelo», los cambios se sincronizarán en la tabla y en los cálculos.
      </p>
      <div className="code-block">
        <div className="code-head">
          <span>Tabla Markdown</span>
          <div className="code-actions">
            <button type="button" className="btn btn--sm" onClick={handleCopy}>
              Copiar
            </button>
            <button
              type="button"
              className="btn btn--sm btn--primary"
              onClick={handleApply}
            >
              Cargar al modelo
            </button>
          </div>
        </div>
        <textarea
          className="markdown-textarea"
          value={text}
          rows={12}
          spellCheck={false}
          aria-label="Editor de Markdown del modelo"
          maxLength={MAX_MD}
          onChange={(e) => setText(e.target.value.slice(0, MAX_MD))}
        />
      </div>
    </div>
  );
}
