/** Proyecto editable → tabla Markdown (misma forma que acepta el lector). */
export function projectToMarkdown({ title, mode, rows }) {
  const head = mode === 'pert' ? ['Actividad', 'Predecesoras', 'a', 'm', 'b'] : mode === 'cpm' ? ['Actividad', 'Predecesoras', 'Duración'] : ['Actividad', 'Predecesoras'];
  const body = rows
    .filter((r) => String(r.name).trim())
    .map((r) => {
      const preds = String(r.preds || '').trim() || '-';
      if (mode === 'pert') return [r.name, preds, r.a, r.m, r.b];
      if (mode === 'cpm') return [r.name, preds, r.d];
      return [r.name, preds];
    });
  const line = (cells) => '| ' + cells.join(' | ') + ' |';
  return [`# ${title}`, line(head), '|' + head.map(() => '---').join('|') + '|', ...body.map(line)].join('\n');
}
