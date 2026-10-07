import { toMarkdown, saveFile } from '@/shared/files.js';
import { crudo, fmtNum } from '../domain/formato.js';
import { lineasResultado, tablasResultado } from '../domain/tablas.js';
import { palabrasObjetivo } from '../domain/notacion.js';

const TITULO = 'Teoría bayesiana de la decisión';

/** Texto sin los símbolos que la fuente del PDF no trae. */
export const plano = (s) => String(s)
  .replace(/[₀-₉]/g, (d) => '₀₁₂₃₄₅₆₇₈₉'.indexOf(d))
  .replace(/−/g, '-')
  .replace(/≤/g, '<=')
  .replace(/≥/g, '>=');

/** Descripción del problema en líneas de texto plano. */
export function lineasProblema(p) {
  const o = palabrasObjetivo(p.objetivo);
  const out = [
    `Los pagos son ${o.pagos}: se busca el ${o.mejor} valor esperado.`,
    `Alternativas: ${p.alternativas.join(', ')}.`,
    `Estados: ${p.estados.join(', ')}.`,
    `Probabilidades a priori: ${p.estados.map((e, j) => `${e} = ${fmtNum(p.priori[j])}`).join('; ')}.`,
  ];
  if (p.indicadores) out.push(`Resultados del indicador: ${p.indicadores.join(', ')}.`);
  return out;
}

/* ---------------- Markdown ---------------- */

export function construirMarkdown(p, a, fecha = new Date().toLocaleDateString('es-CO')) {
  const lines = [`# ${TITULO}: resultados`, `Fecha: ${fecha}`, '', '## Problema', ...lineasProblema(p).map((l) => '- ' + l), '', '## Resultado', ...lineasResultado(p, a).map((l) => '- ' + l)];
  for (const t of tablasResultado(p, a)) {
    lines.push('', `## ${t.titulo}`, '', toMarkdown(t.headers, t.rows));
  }
  return lines.join('\n');
}

export async function exportarMarkdown({ problema, analisis }) {
  return saveFile('teoria-bayesiana-decision.md', construirMarkdown(problema, analisis), 'text/markdown;charset=utf-8');
}

/* ---------------- CSV (punto decimal) ---------------- */

const esc = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

export function construirCSV(p, a) {
  const filas = [];
  for (const t of tablasResultado(p, a, crudo)) {
    filas.push([t.titulo], t.headers, ...t.rows, []);
  }
  return '﻿' + filas.map((r) => r.map(esc).join(',')).join('\n');
}

export async function exportarCSV({ problema, analisis }) {
  return saveFile('teoria-bayesiana-decision.csv', construirCSV(problema, analisis), 'text/csv;charset=utf-8');
}

/* ---------------- PDF ---------------- */

const FONT = 'Serif';

export async function exportarPDF({ problema: p, analisis: a }) {
  const [{ jsPDF }, autoTableMod, fonts] = await Promise.all([
    import('jspdf'),
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
  const seccion = (txt) => { y += 8; asegurar(40); parrafo(txt, 0, 12.5, 'bold'); y += 2; };

  parrafo(TITULO, 0, 17, 'bold');
  doc.setTextColor(80);
  parrafo(`Investigación de operaciones II — ${new Date().toLocaleDateString('es-CO')}`, 0, 10);
  doc.setTextColor(0);
  y += 4;
  doc.setLineWidth(0.8);
  doc.line(M, y, PW - M, y);
  y += 10;

  seccion('Problema');
  lineasProblema(p).forEach((l) => parrafo(l, 10));
  seccion('Resultado');
  lineasResultado(p, a).forEach((l) => parrafo(l, 10));

  for (const t of tablasResultado(p, a)) {
    seccion(t.titulo);
    const opt = new Set(t.resaltar.map(([i, j]) => `${i},${j}`));
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M, bottom: 40 },
      theme: 'plain',
      styles: { font: FONT, fontSize: 8.5, cellPadding: { top: 3, bottom: 3, left: 3, right: 3 }, textColor: 0, lineColor: [210, 210, 205], overflow: 'linebreak' },
      headStyles: { fontStyle: 'bold', lineWidth: { top: 1.2, bottom: 0.8 }, lineColor: 0 },
      bodyStyles: { lineWidth: { bottom: 0.3 } },
      head: [t.headers.map(plano)],
      body: t.rows.map((r) => r.map(plano)),
      didParseCell: (d) => {
        if (d.section !== 'body') return;
        if (opt.has(`${d.row.index},${d.column.index}`)) {
          d.cell.styles.fontStyle = 'bold';
          d.cell.styles.fillColor = [234, 238, 247];
          d.cell.styles.textColor = [29, 63, 143];
        } else if (d.row.index >= t.rows.length - t.totales && t.totales > 0) {
          d.cell.styles.fontStyle = 'bold';
        }
      },
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    const w2 = doc.internal.pageSize.getWidth();
    const h2 = doc.internal.pageSize.getHeight();
    doc.setFont(FONT, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(`${i} / ${total}`, w2 - M, h2 - 22, { align: 'right' });
    doc.setTextColor(0);
  }
  return saveFile('teoria-bayesiana-decision.pdf', doc.output('blob'), 'application/pdf');
}
