import { saveFile } from '@/shared/files.js';
import { plano, objetivoTxt, lineasResultado, tablaNodos, lineasRiesgo, tablaRiesgo, lineasSensibilidad, construirCSV, construirMarkdown, TITULO } from '../domain/informe.js';

export { plano };

export const exportarCSV = async (datos) => saveFile('arbol-de-decision.csv', construirCSV(datos), 'text/csv;charset=utf-8');
export const exportarMarkdown = async (datos) => saveFile('arbol-de-decision.md', construirMarkdown(datos), 'text/markdown;charset=utf-8');

/* ---------------- PDF ---------------- */

const PAGES = [[841.9, 595.3], [1190.6, 841.9], [1683.8, 1190.6]];
const FONT = 'Serif';

/** Copia del SVG adaptada a svg2pdf: una sola fuente, texto sin símbolos que falten y halos explícitos. */
function svgParaPdf(svg) {
  const clone = svg.cloneNode(true);
  clone.removeAttribute('class');
  clone.removeAttribute('style');
  clone.querySelectorAll('text').forEach((t) => {
    t.setAttribute('font-family', FONT);
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

export async function exportarPDF({ arbol, ev, riesgo, sens, svg, svgSens }) {
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

  parrafo(TITULO, 0, 17, 'bold');
  doc.setTextColor(80);
  parrafo(`Investigación de operaciones II — ${new Date().toLocaleDateString('es-CO')}`, 0, 10);
  doc.setTextColor(0);
  y += 4;
  doc.setLineWidth(0.8);
  doc.line(M, y, PW - M, y);
  y += 10;

  seccion('Planteamiento');
  parrafo(`Objetivo: ${objetivoTxt(arbol)}${arbol.unidad ? `. Unidad: ${arbol.unidad}` : ''}`, 10);
  parrafo('Cuadrado: nodo de decisión. Círculo: nodo de azar. El valor de una rama es su pago más el valor del nodo al que llega.', 10, 10);

  seccion('Resultado');
  lineasResultado(arbol, ev).forEach((l, i) => parrafo(l, 10, 10.5, i === 0 ? 'bold' : 'normal'));

  const tablaOpts = (extra) => ({
    margin: { left: M, right: M, bottom: 40 },
    theme: 'plain',
    styles: { font: FONT, fontSize: 8.5, cellPadding: { top: 3, bottom: 3, left: 3, right: 3 }, textColor: 0, lineColor: [210, 210, 205], overflow: 'linebreak' },
    headStyles: { fontStyle: 'bold', lineWidth: { top: 1.2, bottom: 0.8 }, lineColor: 0 },
    bodyStyles: { lineWidth: { bottom: 0.3 } },
    ...extra,
  });
  const limpia = (rows) => rows.map((r) => r.map(plano));

  if (svg) {
    const vb = svg.getAttribute('viewBox').split(/\s+/).map(Number);
    const [bw, bh] = [vb[2], vb[3]];
    const HEAD = 60;
    const FOOT = 40;
    const ajuste = ([w, h]) => Math.min((w - 2 * M) / bw, (h - HEAD - FOOT) / bh, 1.25);
    const page = PAGES.find((p) => ajuste(p) >= 0.6) || PAGES[PAGES.length - 1];
    doc.addPage(page, 'landscape');
    doc.setFont(FONT, 'bold');
    doc.setFontSize(14);
    doc.text('Árbol resuelto', M, M + 10);
    const esc = ajuste(page);
    const w = bw * esc;
    const h = bh * esc;
    await dibujarSvg(doc, svg, (page[0] - w) / 2, HEAD + (page[1] - HEAD - FOOT - h) / 2, w, h);
    doc.setFont(FONT, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(90);
    doc.text('Azul: estrategia óptima. Doble raya roja: rama descartada. Cada nodo muestra su valor (VE en los de azar).', M, page[1] - 22);
    doc.setTextColor(0);
    doc.addPage('a4', 'portrait');
    y = M + 10;
  }

  seccion('Cálculo por nodo (de derecha a izquierda)');
  const t = tablaNodos(arbol, ev);
  autoTable(doc, tablaOpts({ startY: y, head: [t.headers.map(plano)], body: limpia(t.rows) }));
  y = doc.lastAutoTable.finalY + 6;

  if (riesgo) {
    seccion('Perfil de riesgo de la estrategia óptima');
    lineasRiesgo(riesgo).forEach((l) => parrafo(l, 10));
    const r = tablaRiesgo(riesgo);
    autoTable(doc, tablaOpts({ startY: y, head: [r.headers.map(plano)], body: limpia(r.rows) }));
    y = doc.lastAutoTable.finalY + 6;
  }

  if (sens) {
    seccion('Sensibilidad de una probabilidad');
    lineasSensibilidad(sens).forEach((l) => parrafo(l, 10));
    if (svgSens) {
      const ancho = Math.min(PW - 2 * M, 480);
      const alto = ancho * (320 / 640);
      asegurar(alto + 10);
      await dibujarSvg(doc, svgSens, M, y + 4, ancho, alto);
      y += alto + 12;
    }
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
  return saveFile('arbol-de-decision.pdf', doc.output('blob'), 'application/pdf');
}
