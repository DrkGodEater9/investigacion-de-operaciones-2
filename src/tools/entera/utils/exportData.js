import { toCSV, saveFile } from '@/shared/files.js';
import { getNodesData, describirIntegralidad, construirMarkdown } from './exportTexto.js';

export { describirIntegralidad };

export async function exportNodesCSV(result, filename = 'arbol-ramificacion.csv') {
  const { headers, rows } = getNodesData(result);
  const csvContent = toCSV(headers, rows);
  return await saveFile(filename, csvContent, 'text/csv;charset=utf-8');
}

export async function exportModelMarkdown(model, result, filename = 'modelo-y-resultados.md') {
  const mdContent = construirMarkdown(model, result);
  return await saveFile(filename, mdContent, 'text/markdown;charset=utf-8');
}
