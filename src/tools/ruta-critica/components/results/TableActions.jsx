import { saveFile, copyText, toCSV, toMarkdown, slug } from '@/shared/files.js';

export default function TableActions({ headers, rows, name, notify }) {
  return (
    <div className="table-actions no-print">
      <button type="button" className="btn btn--sm btn--ghost" onClick={async () => notify((await copyText(toMarkdown(headers, rows))) ? 'Tabla copiada en Markdown' : 'No se pudo copiar')}>
        Copiar como Markdown
      </button>
      <button type="button" className="btn btn--sm btn--ghost" onClick={() => saveFile(`${slug(name)}.csv`, toCSV(headers, rows), 'text/csv')}>
        Descargar CSV
      </button>
    </div>
  );
}
