import { saveFile, toCSV, toMarkdown, slug } from '@/shared/files.js';
import { NOTACION } from '../domain/notacion.js';
import { num } from '../domain/formato.js';
import { resumen, tablaActividades, tablaReducciones, tablaCurva, tablaDuracionOptima } from '../domain/analizar.js';

const FONT = 'Serif';

/** La fuente del PDF (Liberation Serif recortada) trae −, →, ≤, ≥, Σ y las letras griegas: el texto pasa tal cual. */
export const plano = (s) => String(s);

const nombreArchivo = (titulo, ext) => `${slug(titulo) || 'pert-costo'}.${ext}`;

/** Datos del proyecto en texto, para Markdown y PDF. */
function lineasParametros(a) {
  const { m } = a;
  return [
    `${NOTACION.lineaIndirecto}: ${num(m.ci)}`,
    ...(m.fijo ? [`${NOTACION.lineaFijo}: ${num(m.fijo)}`] : []),
    NOTACION.formulaPendiente,
  ];
}

/* ---------------- CSV ---------------- */

/** Un solo archivo con tres bloques (actividades, reducciones y curva) separados por una línea en blanco. */
export function textoCSV(a) {
  const limpio = (t) => ({ ...t, rows: t.rows.map((r) => r.map((c) => String(c).replace(/−/g, '-'))) });
  const bloque = (nombre, t) => nombre + '\n' + toCSV(t.headers, t.rows).replace('﻿', '');
  return '﻿' + [
    bloque('Actividades', limpio(tablaActividades(a))),
    bloque('Reducciones', limpio(tablaReducciones(a))),
    bloque('Curva costo-duracion', limpio(tablaCurva(a))),
  ].join('\n\n');
}

export async function exportarCSV(a, titulo) {
  return saveFile(nombreArchivo(titulo, 'csv'), textoCSV(a), 'text/csv;charset=utf-8');
}

/* ---------------- Markdown ---------------- */

export function textoMarkdown(a, titulo) {
  const act = tablaActividades(a);
  const red = tablaReducciones(a);
  const cur = tablaCurva(a);
  const opt = tablaDuracionOptima(a);
  return [
    `# ${titulo}: análisis de costos (PERT/COSTO)`,
    `Fecha: ${new Date().toLocaleDateString('es-CO')}`,
    '',
    '## Datos',
    ...lineasParametros(a).map((l) => '- ' + l),
    '',
    toMarkdown(act.headers, act.rows),
    '',
    '## Resultado',
    ...resumen(a).map((l) => '- ' + l),
    ...(a.objetivo && a.objetivo.mensaje ? [`- ${a.objetivo.mensaje}`] : []),
    '',
    '## Reducciones paso a paso',
    '',
    red.rows.length ? toMarkdown(red.headers, red.rows) : 'Ninguna actividad se puede acortar.',
    '',
    '## Duraciones de cada actividad en el óptimo',
    '',
    toMarkdown(opt.headers, opt.rows),
    '',
    '## Curva costo-duración',
    '',
    toMarkdown(cur.headers, cur.rows),
  ].join('\n');
}

export async function exportarMarkdown(a, titulo) {
  return saveFile(nombreArchivo(titulo, 'md'), textoMarkdown(a, titulo), 'text/markdown;charset=utf-8');
}

/* ---------------- PDF ---------------- */

/** Copia del SVG adaptada a svg2pdf: una sola fuente, texto sin símbolos que falten y halos explícitos. */
function svgParaPdf(svg) {
  const clone = svg.cloneNode(true);
  clone.removeAttribute('class');
  clone.removeAttribute('style');
  clone.querySelectorAll('[data-ui]').forEach((n) => n.remove());
  clone.querySelectorAll('text').forEach((t) => {
    t.setAttribute('font-family', FONT);
    const peso = t.getAttribute('font-weight');
    if (peso) t.setAttribute('font-weight', Number(peso) >= 600 || peso === 'bold' ? 'bold' : 'normal');
    t.textContent = plano(t.textContent);
    if (t.getAttribute('paint-order')) {
      const halo = t.cloneNode(true);
      halo.setAttribute('fill', '#ffffff');
      halo.setAttribute('stroke', '#ffffff');
      halo.removeAttribute('paint-order');
      t.parentNode.insertBefore(halo, t);
      t.removeAttribute('stroke');
      t.removeAttribute('stroke-width');
      t.removeAttribute('paint-order');
    }
  });
  return clone;
}

async function dibujarSvg(doc, svg, x, y, w, h) {
  const el = svgParaPdf(svg);
  el.style.position = 'absolute';
  el.style.left = '-99999px';
  document.body.appendChild(el);
  try {
    await doc.svg(el, { x, y, width: w, height: h });
  } finally {
    el.remove();
  }
}

const tamanoSvg = (svg) => {
  const vb = svg.getAttribute('viewBox').split(/\s+/).map(Number);
  return { w: vb[2], h: vb[3] };
};

export async function exportarPDF(a, titulo, { svgRed, svgCurva, duracionRed } = {}) {
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
  const seccion = (txt) => { y += 8; asegurar(40); parrafo(txt, 0, 12.5, 'bold'); y += 2; };
  const opciones = (extra) => ({
    margin: { left: M, right: M, bottom: 40 },
    theme: 'plain',
    styles: { font: FONT, fontSize: 8.5, cellPadding: { top: 3, bottom: 3, left: 3, right: 3 }, textColor: 0, lineColor: [210, 210, 205], overflow: 'linebreak' },
    headStyles: { fontStyle: 'bold', lineWidth: { top: 1.2, bottom: 0.8 }, lineColor: 0 },
    bodyStyles: { lineWidth: { bottom: 0.3 } },
    ...extra,
  });
  const limpia = (rows) => rows.map((r) => r.map(plano));
  const tabla = (t, resaltar = null, extra = {}) => {
    autoTable(doc, opciones({
      startY: y,
      head: [t.headers.map(plano)],
      body: limpia(t.rows),
      didParseCell: (d) => {
        if (d.section === 'body' && resaltar && resaltar[d.row.index]) {
          d.cell.styles.fontStyle = 'bold';
          d.cell.styles.fillColor = [234, 238, 247];
          d.cell.styles.textColor = [29, 63, 143];
        }
      },
      ...extra,
    }));
    y = doc.lastAutoTable.finalY + 8;
  };

  parrafo(`${titulo}`, 0, 17, 'bold');
  doc.setTextColor(80);
  parrafo(`Análisis de costos (PERT/COSTO) — Investigación de operaciones II — ${new Date().toLocaleDateString('es-CO')}`, 0, 10);
  doc.setTextColor(0);
  y += 4;
  doc.setLineWidth(0.8);
  doc.line(M, y, PW - M, y);
  y += 10;

  seccion('Datos');
  lineasParametros(a).forEach((l) => parrafo(l, 10));
  y += 2;
  const act = tablaActividades(a);
  tabla(act, act.criticas);
  parrafo('En azul: actividades de la ruta crítica con las duraciones normales.', 0, 9);

  seccion('Resultado');
  resumen(a).forEach((l, i) => parrafo(l, 10, 10.5, i === 2 ? 'bold' : 'normal'));
  if (a.objetivo && a.objetivo.mensaje) parrafo(a.objetivo.mensaje, 10);

  seccion('Reducciones paso a paso');
  const red = tablaReducciones(a);
  if (red.rows.length) {
    tabla(red, red.optimas, { columnStyles: { 0: { cellWidth: 28 }, 1: { cellWidth: 52 } } });
    parrafo('Entre paréntesis, las unidades de tiempo del paso. En azul, el paso que llega a la duración óptima.', 0, 9);
  } else parrafo('Ninguna actividad se puede acortar.', 10);

  seccion('Duraciones de cada actividad en el óptimo');
  tabla(tablaDuracionOptima(a));

  const cur = tablaCurva(a);
  if (svgCurva) {
    const { h } = tamanoSvg(svgCurva);
    asegurar(h * 0.9 + 60); // el título no queda solo al final de una página
  }
  seccion('Curva costo-duración');
  if (svgCurva) {
    const { w, h } = tamanoSvg(svgCurva);
    const esc = Math.min((PW - 2 * M) / w, 1);
    asegurar(h * esc + 10);
    await dibujarSvg(doc, svgCurva, M, y, w * esc, h * esc);
    y += h * esc + 8;
  }
  tabla(cur, cur.optimas);

  if (svgRed) {
    const { w, h } = tamanoSvg(svgRed);
    const paginas = [[841.9, 595.3], [1190.6, 841.9], [1683.8, 1190.6]];
    const ajuste = ([pw, ph]) => Math.min((pw - 2 * M) / w, (ph - 100) / h, 1.25);
    const pag = paginas.find((p) => ajuste(p) >= 0.6) || paginas[paginas.length - 1];
    doc.addPage(pag, 'landscape');
    doc.setFont(FONT, 'bold');
    doc.setFontSize(14);
    doc.text(plano(`Red del proyecto con duración ${duracionRed ?? a.res.optimo.T}`), M, M + 10);
    const esc = ajuste(pag);
    await dibujarSvg(doc, svgRed, (pag[0] - w * esc) / 2, 70 + (pag[1] - 100 - h * esc) / 2, w * esc, h * esc);
    doc.setFont(FONT, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(90);
    doc.text(plano('Rojo: ruta crítica. Bajo cada flecha, la duración (entre paréntesis, la normal si fue acortada). En cada evento: número, tiempo temprano (izquierda) y tardío (derecha).'), M, pag[1] - 22);
    doc.setTextColor(0);
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
  return saveFile(nombreArchivo(titulo, 'pdf'), doc.output('blob'), 'application/pdf');
}
