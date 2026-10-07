import { toCSV, toMarkdown, saveFile } from '@/shared/files.js';
import { reglaPorId } from '../domain/asignar.js';
import { lista, periodos } from '../domain/format.js';

const TITULO = 'Distribución de recursos';
const SUBS = '₀₁₂₃₄₅₆₇₈₉';

/** Texto sin los símbolos que la fuente del PDF no trae. */
export const plano = (s) => String(s)
  .replace(/[₀-₉]/g, (d) => SUBS.indexOf(d))
  .replace(/′/g, "'")
  .replace(/Σ/g, 'suma de')
  .replace(/→/g, '->')
  .replace(/≤/g, '<=')
  .replace(/≥/g, '>=')
  .replace(/−/g, '-');

const nombreMetodo = (a) => (a.metodo === 'nivelar' ? 'Nivelación (dentro de las holguras)' : `Recursos limitados (regla: ${reglaPorId(a.regla).nombre.toLowerCase()})`);

/** Líneas de resultado (texto plano) compartidas por Markdown y PDF. */
export function lineasResultado(a) {
  const out = [`Método: ${nombreMetodo(a)}`, `Duración sin límites (ruta crítica): ${periodos(a.base.T)}`];
  if (a.error) { out.push(a.error); return out; }
  out.push(`Duración resultante: ${periodos(a.despues.T)}${a.despues.T > a.base.T ? ` (+${a.despues.T - a.base.T})` : ''}`);
  a.antes.porRecurso.forEach((p, k) => {
    const d = a.despues.resumen.porRecurso[k];
    out.push(`${p.nombre}: pico ${p.pico} -> ${d.pico}${p.limite != null ? `; límite ${p.limite}; períodos sobre el límite: ${p.excesos.length} -> ${d.excesos.length}` : ''}`);
  });
  const movidas = a.red.nombres.map((nm, i) => (a.despues.starts[i] !== a.base.ES[i] ? `${nm} (${a.base.ES[i]} -> ${a.despues.starts[i]})` : null)).filter(Boolean);
  out.push(`Actividades que cambian de comienzo: ${movidas.length ? lista(movidas) : 'ninguna'}`);
  if (a.metodo === 'asignar') out.push(`Cota inferior de la duración: ${a.detalle.cota}`);
  return out;
}

/** Tabla de actividades con tiempos y comienzo nuevo. */
export function tablaActividades(a) {
  const { red, base, despues } = a;
  const headers = ['Actividad', 'Duración', 'Predecesoras', ...red.recursos, 'ES', 'EF', 'LS', 'LF', 'Holgura'];
  if (despues) headers.push('Comienzo nuevo', 'Cambio');
  const rows = red.nombres.map((nm, i) => [
    nm, red.d[i], red.preds[i].map((p) => red.nombres[p]).join(', ') || '-', ...red.r[i], base.ES[i], base.EF[i], base.LS[i], base.LF[i], base.H[i],
    ...(despues ? [despues.starts[i], despues.starts[i] - base.ES[i]] : []),
  ]);
  return { headers, rows };
}

/** Tabla del histograma: período, y por recurso el consumo antes y después y el límite. */
export function tablaHistograma(a) {
  const H = a.horizonte;
  const headers = ['Período'];
  a.red.recursos.forEach((nm) => headers.push(`${nm} antes`, ...(a.despues ? [`${nm} después`] : []), `${nm} límite`));
  const rows = [];
  for (let t = 0; t < H; t++) {
    const fila = [t + 1];
    a.red.recursos.forEach((_, k) => {
      fila.push(a.antes.uso[k][t] ?? 0);
      if (a.despues) fila.push(a.despues.resumen.uso[k][t] ?? 0);
      fila.push(a.red.limites[k] ?? '');
    });
    rows.push(fila);
  }
  return { headers, rows };
}

export async function exportarCSV({ analisis }) {
  const t1 = tablaActividades(analisis);
  const t2 = tablaHistograma(analisis);
  const bloques = toCSV(t1.headers, t1.rows) + '\n\n' + toCSV(t2.headers, t2.rows).replace(/^﻿/, '');
  return saveFile('distribucion-de-recursos.csv', bloques, 'text/csv;charset=utf-8');
}

export async function exportarMarkdown({ analisis, titulo }) {
  const t1 = tablaActividades(analisis);
  const t2 = tablaHistograma(analisis);
  const lines = [
    `# ${TITULO}: resultados${titulo ? ` (${titulo})` : ''}`,
    `Fecha: ${new Date().toLocaleDateString('es-CO')}`,
    '',
    '## Resultado',
    ...lineasResultado(analisis).map((l) => '- ' + l),
    '',
    '## Actividades y tiempos',
    '',
    toMarkdown(t1.headers, t1.rows),
    '',
    '## Histograma por período',
    '',
    toMarkdown(t2.headers, t2.rows),
  ];
  return saveFile('distribucion-de-recursos.md', lines.join('\n'), 'text/markdown;charset=utf-8');
}

/* ---------------- PDF ---------------- */

const FONT = 'Serif';

/** Copia del dibujo adaptada a svg2pdf: una sola fuente y texto sin símbolos que falten. */
function svgParaPdf(svg) {
  const clone = svg.cloneNode(true);
  clone.removeAttribute('class');
  clone.removeAttribute('style');
  clone.querySelectorAll('text').forEach((t) => {
    t.setAttribute('font-family', FONT);
    t.textContent = plano(t.textContent);
  });
  return clone;
}

/** svgs: [{ titulo, el }] en el orden en que se dibujan. */
export async function exportarPDF({ analisis, svgs = [], titulo }) {
  const [{ jsPDF }, , autoTableMod, fonts] = await Promise.all([
    import('jspdf'),
    import('svg2pdf.js'),
    import('jspdf-autotable'),
    import('@/tools/ruta-critica/assets/pdfFonts.js'),
  ]);
  const autoTable = autoTableMod.default;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  doc.addFileToVFS('serif-regular.ttf', fonts.SERIF_REGULAR);
  doc.addFont('serif-regular.ttf', FONT, 'normal');
  doc.addFileToVFS('serif-bold.ttf', fonts.SERIF_BOLD);
  doc.addFont('serif-bold.ttf', FONT, 'bold');
  doc.setFont(FONT, 'normal');

  const M = 40;
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  let y = M + 10;
  const asegurar = (h) => { if (y + h > PH - 50) { doc.addPage(); y = M + 10; } };
  const parrafo = (txt, sangria = 0, tam = 10.5, estilo = 'normal') => {
    doc.setFont(FONT, estilo);
    doc.setFontSize(tam);
    doc.splitTextToSize(plano(txt), PW - 2 * M - sangria).forEach((l) => {
      asegurar(tam + 4);
      doc.text(l, M + sangria, y);
      y += tam + 3.5;
    });
  };
  const seccion = (txt) => { y += 8; asegurar(30); parrafo(txt, 0, 12.5, 'bold'); y += 2; };

  parrafo(`${TITULO}${titulo ? `: ${titulo}` : ''}`, 0, 17, 'bold');
  doc.setTextColor(80);
  parrafo(`Investigación de operaciones II - ${new Date().toLocaleDateString('es-CO')}`, 0, 10);
  doc.setTextColor(0);
  y += 4;
  doc.setLineWidth(0.8);
  doc.line(M, y, PW - M, y);
  y += 10;

  seccion('Resultado');
  lineasResultado(analisis).forEach((l) => parrafo(l, 10));

  const opts = (extra) => ({
    margin: { left: M, right: M, bottom: 40 },
    theme: 'plain',
    styles: { font: FONT, fontSize: 8.5, cellPadding: 3, textColor: 0, lineColor: [210, 210, 205], overflow: 'linebreak' },
    headStyles: { fontStyle: 'bold', lineWidth: { top: 1.2, bottom: 0.8 }, lineColor: 0 },
    bodyStyles: { lineWidth: { bottom: 0.3 } },
    ...extra,
  });
  seccion('Actividades y tiempos');
  const t1 = tablaActividades(analisis);
  autoTable(doc, opts({ startY: y, head: [t1.headers.map(plano)], body: t1.rows.map((r) => r.map(plano)) }));
  y = doc.lastAutoTable.finalY + 6;

  seccion('Histograma por período');
  const t2 = tablaHistograma(analisis);
  autoTable(doc, opts({ startY: y, head: [t2.headers.map(plano)], body: t2.rows.map((r) => r.map(plano)) }));
  y = doc.lastAutoTable.finalY + 6;

  for (const { titulo: tit, el } of svgs) {
    if (!el) continue;
    const vb = el.getAttribute('viewBox').split(/\s+/).map(Number);
    const w = PW - 2 * M;
    const h = (vb[3] / vb[2]) * w;
    asegurar(h + 40);
    y += 6;
    parrafo(tit, 0, 12.5, 'bold');
    const clone = svgParaPdf(el);
    clone.style.position = 'absolute';
    clone.style.left = '-99999px';
    document.body.appendChild(clone);
    try {
      await doc.svg(clone, { x: M, y, width: w, height: h });
    } finally {
      clone.remove();
    }
    y += h + 4;
  }

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont(FONT, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(`${i} / ${total}`, PW - M, PH - 22, { align: 'right' });
    doc.setTextColor(0);
  }
  return saveFile('distribucion-de-recursos.pdf', doc.output('blob'), 'application/pdf');
}
