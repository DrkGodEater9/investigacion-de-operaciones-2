import { timesTable, eventsTable, pertTable } from '../domain/tables.js';
import { fmt } from '../domain/format.js';
import { normalInv } from '../domain/pert.js';

const FONT = 'Serif';
const PAGES = [
  [841.9, 595.3], // A4 horizontal
  [1190.6, 841.9], // A3 horizontal
  [1683.8, 1190.6], // A2 horizontal
];

/** Copia del diagrama adaptada a svg2pdf: una sola fuente, sin elementos de interfaz y halos explícitos. */
function svgForPdf(svg, bounds) {
  const NS = 'http://www.w3.org/2000/svg';
  const clone = svg.cloneNode(true);
  clone.setAttribute('xmlns', NS);
  clone.setAttribute('viewBox', `${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`);
  clone.setAttribute('width', bounds.w);
  clone.setAttribute('height', bounds.h);
  clone.removeAttribute('class');
  clone.removeAttribute('style');
  clone.querySelectorAll('[data-ui]').forEach((n) => n.remove());
  clone.querySelectorAll('path').forEach((p) => { if (p.getAttribute('stroke') === 'transparent') p.remove(); });
  clone.querySelectorAll('text').forEach((t) => {
    t.setAttribute('font-family', FONT);
    t.removeAttribute('font-style');
    const size = parseFloat(t.getAttribute('font-size')) || 12;
    if (t.getAttribute('dominant-baseline') === 'central') {
      t.removeAttribute('dominant-baseline');
      t.setAttribute('y', (parseFloat(t.getAttribute('y')) || 0) + size * 0.34);
    }
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

export async function buildPdf({ svg, bounds, analysis, title, pertInfo }) {
  const [{ jsPDF }, , autoTableMod, fonts] = await Promise.all([
    import('jspdf'),
    import('svg2pdf.js'),
    import('jspdf-autotable'),
    import('../assets/pdfFonts.js'),
  ]);
  const autoTable = autoTableMod.default;

  // Página del diagrama: la más pequeña en la que se lea bien.
  const MARGIN = 36;
  const HEAD = 78;
  const FOOT = 40;
  const fitIn = ([w, h]) => Math.min((w - 2 * MARGIN) / bounds.w, (h - HEAD - FOOT) / bounds.h, 1.25);
  const page = PAGES.find((p) => fitIn(p) >= 0.62) || PAGES[PAGES.length - 1];

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: page });
  doc.addFileToVFS('serif-regular.ttf', fonts.SERIF_REGULAR);
  doc.addFont('serif-regular.ttf', FONT, 'normal');
  doc.addFileToVFS('serif-bold.ttf', fonts.SERIF_BOLD);
  doc.addFont('serif-bold.ttf', FONT, 'bold');
  doc.setFont(FONT, 'normal');

  const { times, decimals, critical } = analysis;
  const f = (x) => fmt(x, decimals);
  const [PW, PH] = page;

  // Encabezado
  doc.setFont(FONT, 'bold');
  doc.setFontSize(18);
  doc.text(title || 'Diagrama de red', MARGIN, MARGIN + 12);
  doc.setFont(FONT, 'normal');
  doc.setFontSize(11);
  const facts = [];
  if (times) facts.push(`Duración del proyecto: ${f(times.T)}`);
  if (pertInfo) facts.push(`σ del proyecto: ${fmt(pertInfo.sd, 4)}`);
  facts.push(`${analysis.activities.length} actividades`, `${analysis.net.nodes.length} eventos`, `${analysis.dummies} ${analysis.dummies === 1 ? 'ficticia' : 'ficticias'}`);
  doc.text(facts.join('     '), MARGIN, MARGIN + 32);
  if (times) {
    const routes = critical.routes.map((r) => r.acts.join(' – ')).join('   |   ');
    doc.text(doc.splitTextToSize(`${critical.routes.length === 1 ? 'Ruta crítica' : 'Rutas críticas'}: ${routes}`, PW - 2 * MARGIN), MARGIN, MARGIN + 48);
  }

  // Diagrama en vector
  const scale = fitIn(page);
  const w = bounds.w * scale;
  const h = bounds.h * scale;
  const x = (PW - w) / 2;
  const y = HEAD + (PH - HEAD - FOOT - h) / 2;
  const el = svgForPdf(svg, bounds);
  el.style.position = 'absolute';
  el.style.left = '-99999px';
  document.body.appendChild(el);
  try {
    await doc.svg(el, { x, y, width: w, height: h });
  } finally {
    el.remove();
  }
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(
    times
      ? 'Evento: número arriba; abajo a la izquierda el tiempo más temprano y a la derecha el más tardío. Línea discontinua: ficticia. Trazo grueso: actividad crítica.'
      : 'Evento: número arriba; las mitades de abajo son para los tiempos. Línea discontinua: actividad ficticia.',
    MARGIN,
    PH - 22,
  );
  doc.setTextColor(0);

  // Tablas
  const table = (heading, { headers, rows, critical: crit }, numericFrom = 3) => {
    doc.addPage(PAGES[0], 'landscape');
    doc.setFont(FONT, 'bold');
    doc.setFontSize(14);
    doc.text(heading, MARGIN, MARGIN + 10);
    autoTable(doc, {
      startY: MARGIN + 22,
      head: [headers],
      body: rows,
      margin: { left: MARGIN, right: MARGIN, bottom: 40 },
      theme: 'plain',
      styles: { font: FONT, fontSize: 9.5, cellPadding: { top: 3.5, bottom: 3.5, left: 5, right: 5 }, textColor: 0, lineColor: [210, 210, 205] },
      headStyles: { fontStyle: 'bold', lineWidth: { top: 1.2, bottom: 0.8 }, lineColor: 0 },
      bodyStyles: { lineWidth: { bottom: 0.3 } },
      columnStyles: Object.fromEntries(headers.map((_, i) => [i, { halign: i >= numericFrom ? 'right' : 'left' }])),
      didParseCell: (data) => {
        if (data.section === 'body' && crit?.[data.row.index]) data.cell.styles.fontStyle = 'bold';
        if (data.section === 'head' && data.column.index >= numericFrom) data.cell.styles.halign = 'right';
      },
    });
    return doc.lastAutoTable.finalY;
  };

  table(times ? 'Tabla de tiempos' : 'Actividades y eventos', timesTable(analysis));
  table('Eventos', eventsTable(analysis));

  if (pertInfo) {
    const endY = table('Análisis PERT', pertTable(analysis, new Set(pertInfo.route.acts)), 2);
    const z95 = normalInv(0.95);
    const lines = [
      `Ruta crítica usada: ${pertInfo.route.acts.join(' – ')}`,
      `σ²T = ${pertInfo.route.acts.map((a) => fmt(analysis.byName.get(a).var, 4)).join(' + ')} = ${fmt(pertInfo.variance, 4)}`,
      `σT = √${fmt(pertInfo.variance, 4)} = ${fmt(pertInfo.sd, 4)}        Te = ${f(times.T)}`,
      `P(T ≤ ${f(times.T)}) = 50 %        Plazo con 95 % de probabilidad: Te + 1,6449·σ = ${f(times.T + z95 * pertInfo.sd)}`,
    ];
    let yy = endY + 22;
    if (yy + lines.length * 16 > PAGES[0][1] - 40) { doc.addPage(PAGES[0], 'landscape'); yy = MARGIN + 10; }
    doc.setFont(FONT, 'normal');
    doc.setFontSize(11);
    lines.forEach((l) => { doc.text(doc.splitTextToSize(l, PAGES[0][0] - 2 * MARGIN), MARGIN, yy); yy += 16; });
  }

  if (times) {
    const LIMIT = 60;
    const routes = analysis.all.routes.slice(0, LIMIT).map((r, i) => [String(i + 1), r.acts.join(' – '), f(r.length), f(times.T - r.length)]);
    const crit = analysis.all.routes.slice(0, LIMIT).map((r) => Math.abs(times.T - r.length) < 1e-7);
    table(analysis.all.routes.length > LIMIT ? `Las ${LIMIT} rutas más largas (de ${analysis.all.routes.length}${analysis.all.truncated ? '+' : ''})` : `Rutas (${analysis.all.routes.length})`, { headers: ['N.º', 'Secuencia', 'Duración', 'Holgura de la ruta'], rows: routes, critical: crit }, 2);
  }

  // Numeración de páginas
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    const [w2, h2] = [doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight()];
    doc.setFont(FONT, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(`${i} / ${total}`, w2 - MARGIN, h2 - 22, { align: 'right' });
    doc.setTextColor(0);
  }
  return doc.output('blob');
}
