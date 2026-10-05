import { describirIntegralidad } from './exportData.js';
import { saveFile } from '@/shared/files.js';

export async function exportPdf({ model, result, title = 'Programación entera pura' }) {
  const mixtoPdf = Array.isArray(model.integer) && model.integer.some((v) => v === false);
  const [{ jsPDF }, autoTableMod, fonts] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
    import('@/tools/ruta-critica/assets/pdfFonts.js'),
  ]);
  const autoTable = autoTableMod.default;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const FONT = 'Serif';

  doc.addFileToVFS('serif-regular.ttf', fonts.SERIF_REGULAR);
  doc.addFont('serif-regular.ttf', FONT, 'normal');
  doc.addFileToVFS('serif-bold.ttf', fonts.SERIF_BOLD);
  doc.addFont('serif-bold.ttf', FONT, 'bold');
  doc.setFont(FONT, 'normal');

  const MARGIN = 40;
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  let y = MARGIN + 10;

  // Encabezado
  doc.setFont(FONT, 'bold');
  doc.setFontSize(16);
  doc.text(title, MARGIN, y);
  y += 18;

  doc.setFont(FONT, 'normal');
  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.text(`Investigación de operaciones II — ${new Date().toLocaleDateString('es-CO')}`, MARGIN, y);
  doc.setTextColor(0);
  y += 24;

  // Línea separadora
  doc.setLineWidth(0.8);
  doc.line(MARGIN, y, PW - MARGIN, y);
  y += 18;

  // Sección: Modelo
  doc.setFont(FONT, 'bold');
  doc.setFontSize(12);
  doc.text('Modelo planteado', MARGIN, y);
  y += 16;

  doc.setFont(FONT, 'normal');
  doc.setFontSize(10);
  const objText = `${model.sense === 'max' ? 'Maximizar' : 'Minimizar'} Z = ${model.c.map((coef, i) => `${coef}x${i + 1}`).join(' + ')}`;
  doc.text(objText, MARGIN + 12, y);
  y += 14;

  doc.text('Sujeto a:', MARGIN + 12, y);
  y += 14;

  model.constraints.forEach((ct) => {
    const op = ct.op === '<=' ? '<=' : ct.op === '>=' ? '>=' : '=';
    const lhs = ct.a.map((ai, j) => `${ai}x${j + 1}`).join(' + ');
    doc.text(`${lhs} ${op} ${ct.b}`, MARGIN + 24, y);
    y += 13;
  });
  doc.text(describirIntegralidad(model, 'pdf'), MARGIN + 24, y);
  y += 20;

  // Sección: Resumen de resultados
  doc.setFont(FONT, 'bold');
  doc.setFontSize(12);
  doc.text('Resumen de la solución (Branch & Bound)', MARGIN, y);
  y += 16;

  doc.setFont(FONT, 'normal');
  doc.setFontSize(10);

  let statusText = 'Solución óptima encontrada';
  if (result.status === 'infeasible') statusText = 'Infactible (sin solución entera)';
  else if (result.status === 'unbounded') statusText = 'No acotado';
  else if (result.status === 'nodeLimit') statusText = 'Límite de nodos alcanzado';

  doc.text(`Estado: ${statusText}`, MARGIN + 12, y);
  y += 14;

  if (result.relaxation?.z) {
    doc.text(`Relajación continua Z(P0): ${result.relaxation.z.toDual()}`, MARGIN + 12, y);
    y += 14;
  }

  if (result.best) {
    doc.text(`Valor óptimo ${mixtoPdf ? 'mixto' : 'entero'} Z*: ${result.best.z.toDual()}`, MARGIN + 12, y);
    y += 14;
    doc.text(`Punto óptimo X*: (${result.best.x.map((v) => v.toDual()).join('; ')})`, MARGIN + 12, y);
    y += 14;
  }

  const cNodes = result.counts?.nodes || 0;
  const cPruned = result.counts?.pruned || 0;
  doc.text(`Nodos explorados: ${cNodes}       Nodos podados: ${cPruned}`, MARGIN + 12, y);
  y += 24;

  // Tabla de nodos
  doc.setFont(FONT, 'bold');
  doc.setFontSize(12);
  doc.text('Tabla de nodos explorados', MARGIN, y);
  y += 12;

  const headers = ['Nodo', 'Padre', 'Restricción', 'Solución (X)', 'Z', 'Estado', 'Incumb. Z*', 'Acción'];
  const rows = (result.nodes || []).map((n) => {
    const nodo = n.label || `P${n.id}`;
    const padre = n.parentId !== null ? `P${n.parentId}` : '-';
    const op = n.branchOp === '<=' ? '<=' : n.branchOp === '>=' ? '>=' : n.branchOp || '';
    const restr = n.branchVar !== null ? `x${n.branchVar + 1} ${op} ${n.branchBound}` : 'Raíz';

    let solX = '-';
    if (n.status === 'infeasible') solX = 'Infactible';
    else if (n.status === 'unbounded') solX = 'No acotado';
    else if (n.x) solX = `(${n.x.map((v) => v.toDual()).join('; ')})`;

    const zVal = n.z ? n.z.toDual() : '-';

    let est = 'Frac.';
    if (n.status === 'integer') est = 'Entero';
    else if (n.status === 'infeasible') est = 'Infact.';
    else if (n.status === 'unbounded') est = 'No acot.';

    const inc = n.incumbentAfter
      ? (n.incumbentAfter.toDual ? n.incumbentAfter.toDual() : n.incumbentAfter.z ? n.incumbentAfter.z.toDual() : String(n.incumbentAfter))
      : '-';

    let acc = 'Ramificar';
    if (n.action === 'incumbent') acc = 'Nuevo incumbente';
    else if (n.action === 'pruned-bound') acc = 'Podado por cota';
    else if (n.action === 'pruned-infeasible') acc = 'Podado infactible';
    else if (n.action === 'pruned-worse-than-parent') acc = 'Podado (<= Z*)';

    return [nodo, padre, restr, solX, zVal, est, inc, acc];
  });

  autoTable(doc, {
    startY: y,
    head: [headers],
    body: rows,
    margin: { left: MARGIN, right: MARGIN, bottom: 40 },
    tableWidth: PW - 2 * MARGIN,
    theme: 'plain',
    styles: {
      font: FONT,
      fontSize: 8.5,
      cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 },
      textColor: 0,
      lineColor: [210, 210, 205],
      overflow: 'linebreak',
    },
    headStyles: {
      fontStyle: 'bold',
      lineWidth: { top: 1.2, bottom: 0.8 },
      lineColor: 0,
    },
    bodyStyles: {
      lineWidth: { bottom: 0.3 },
    },
    columnStyles: {
      0: { cellWidth: 30, halign: 'center' },
      1: { cellWidth: 30, halign: 'center' },
      2: { cellWidth: 65 },
      3: { cellWidth: 105 },
      4: { cellWidth: 60 },
      5: { cellWidth: 45 },
      6: { cellWidth: 60 },
      7: { cellWidth: 'auto' },
    },
  });

  // Numeración de páginas
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont(FONT, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(`${i} / ${total}`, PW - MARGIN, PH - 24, { align: 'right' });
    doc.setTextColor(0);
  }

  const blob = doc.output('blob');
  return await saveFile('programacion-entera.pdf', blob, 'application/pdf');
}
