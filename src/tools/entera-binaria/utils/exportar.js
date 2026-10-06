import { toMarkdown, saveFile } from '@/shared/files.js';
import { fmtNum, objetivoTexto, restriccionTexto, listaNombres } from '../domain/format.js';
import { nombreBalas } from '../domain/balas.js';

const TITULO = 'Programación entera binaria';
const SUBS = '₀₁₂₃₄₅₆₇₈₉';

/** Texto sin los símbolos que la fuente del PDF no trae (subíndices, ′, ∈). */
export const plano = (s) => String(s)
  .replace(/[₀-₉]/g, (d) => SUBS.indexOf(d))
  .replace(/′/g, "'")
  .replace(/ⱼ/g, 'j')
  .replace(/∈/g, 'en');

/** Número con punto decimal (CSV). */
export const crudo = (x) => {
  let r = Math.round(x * 1e4) / 1e4;
  if (r === 0) r = 0;
  return String(r);
};

const unos = (x) => x.map((v, j) => (v > 0.5 ? j : -1)).filter((j) => j >= 0);

/** «Se eligen x₁, x₂ y x₃» a partir de una solución 0/1. */
export function seEligen(model, x) {
  const u = unos(x);
  if (u.length === 0) return 'No se elige ninguna variable';
  return `${u.length === 1 ? 'Se elige' : 'Se eligen'} ${listaNombres(u, model.names)}`;
}

export function textoFactibles(f, total) {
  return `${f} de ${total} combinaciones ${f === 1 ? 'es factible' : 'son factibles'}`;
}

/** Líneas de resultado (texto plano) compartidas por Markdown y PDF. */
export function lineasResultado(model, metodo, data, f = fmtNum) {
  const out = [];
  if (metodo === 'enumeracion') {
    if (!data.best) out.push('El problema no tiene solución factible');
    else {
      out.push(`Óptimo: Z = ${f(data.best.z)}`);
      if (data.best.solutions.length === 1) out.push(seEligen(model, data.best.solutions[0]));
      else {
        out.push(`Hay ${data.best.solutions.length} soluciones óptimas (empate):`);
        data.best.solutions.forEach((s) => out.push('- ' + seEligen(model, s)));
      }
    }
    out.push(textoFactibles(data.feasibleCount, data.total));
  } else {
    if (data.status === 'limite') out.push('Se alcanzó el límite de nodos: el resultado puede no ser el óptimo.');
    if (!data.best) out.push(data.status === 'limite' ? 'No se encontró ninguna solución factible antes del límite' : 'El problema no tiene solución factible');
    else {
      out.push(`${data.status === 'limite' ? 'Mejor solución encontrada' : 'Óptimo'}: Z = ${f(data.best.z)}`);
      out.push(seEligen(model, data.best.x) + ' (variables originales)');
    }
    out.push(`Nodos explorados: ${data.trace.length}`);
  }
  return out;
}

export function avisosTransformacion(model, data) {
  const t = data.transform;
  const out = [];
  if (t.signo === -1 || t.comp.some(Boolean)) {
    out.push(`Se pasó a minimización con costos no negativos${t.comp.some(Boolean) ? '; las variables con ′ son complementos (1 − x)' : ''}. El Z de cada nodo es el del problema transformado (sin la constante); el Z del resultado es el del problema original.`);
  }
  if (t.A.length > model.constraints.length) {
    out.push(`Cada igualdad se escribe como dos desigualdades (≤ y ≥): el modelo transformado tiene ${t.A.length} restricciones.`);
  }
  return out;
}

export const decisionTexto = (nodo, transform) => (nodo.rama ? `${nombreBalas(transform, nodo.rama.j)} = ${nodo.rama.valor}` : 'raíz');

export function accionTexto(nodo, transform) {
  if (nodo.decision === 'ramifica') return `Ramifica en ${nombreBalas(transform, nodo.branchVar)}`;
  if (nodo.decision === 'factible') return 'Factible';
  return 'Podada';
}

/** Tabla de enumeración o traza del aditivo: { headers, rows } (null si no hay filas que mostrar). */
export function tablaDatos(model, metodo, data, f = fmtNum) {
  if (metodo === 'enumeracion') {
    if (!data.rows) return null;
    const optimas = new Set((data.best?.solutions || []).map((s) => s.join('')));
    return {
      headers: ['Combinación', ...model.constraints.map((r) => r.name), 'Z', 'Estado'],
      rows: data.rows.map((r) => [
        r.x.join(''), ...r.lhs.map(f), f(r.z),
        r.feasible ? (optimas.has(r.x.join('')) ? 'Óptima' : 'Factible') : 'No factible',
      ]),
      optimas: data.rows.map((r) => r.feasible && optimas.has(r.x.join(''))),
    };
  }
  const t = data.transform;
  return {
    headers: ['Nodo', 'Decisión que lo crea', 'Z', 'Holguras', 'Infactibilidad', 'Acción', 'Motivo'],
    rows: data.trace.map((n) => [
      'N' + n.id, decisionTexto(n, t), f(n.z), '(' + n.s.map(f).join('; ') + ')', f(n.I), accionTexto(n, t), n.motivo,
    ]),
    optimas: null,
  };
}

function modeloLineas(model) {
  return [
    objetivoTexto(model),
    ...model.constraints.map((_, i) => restriccionTexto(model, i)),
  ];
}

/* ---------------- CSV ---------------- */

function csv(headers, rows) {
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return '﻿' + [headers, ...rows].map((r) => r.map(esc).join(',')).join('\n');
}

export async function exportarCSV({ model, metodo, data }) {
  let t = tablaDatos(model, metodo, data, crudo);
  if (!t) {
    t = {
      headers: ['Dato', 'Valor'],
      rows: [
        ['Combinaciones', data.total],
        ['Factibles', data.feasibleCount],
        ['Z óptimo', data.best ? crudo(data.best.z) : ''],
        ...(data.best ? data.best.solutions.map((s, k) => ['Solución óptima ' + (k + 1), s.join('')]) : []),
      ],
    };
  }
  return saveFile('programacion-entera-binaria.csv', csv(t.headers, t.rows), 'text/csv;charset=utf-8');
}

/* ---------------- Markdown ---------------- */

export async function exportarMarkdown({ model, metodo, data }) {
  const t = tablaDatos(model, metodo, data);
  const [obj, ...rest] = modeloLineas(model);
  const lines = [
    `# ${TITULO}: resultados`,
    `Fecha: ${new Date().toLocaleDateString('es-CO')}`,
    `Método: ${metodo === 'enumeracion' ? 'Enumeración' : 'Aditivo de Balas'}`,
    '',
    '## Modelo',
    obj,
    '',
    'Sujeto a:',
    ...rest.map((l) => '- ' + l),
    '- xⱼ ∈ {0, 1} para todo j',
    '',
    '## Resultado',
    ...lineasResultado(model, metodo, data).map((l) => (l.startsWith('- ') ? l : '- ' + l)),
  ];
  if (metodo === 'balas') avisosTransformacion(model, data).forEach((a) => lines.push('- ' + a));
  lines.push('', metodo === 'enumeracion' ? '## Tabla de combinaciones' : '## Traza del método aditivo', '');
  lines.push(t ? toMarkdown(t.headers, t.rows) : 'Con más de 12 variables no se lista la tabla de combinaciones.');
  return saveFile('programacion-entera-binaria.md', lines.join('\n'), 'text/markdown;charset=utf-8');
}

/* ---------------- PDF ---------------- */

const PAGES = [[841.9, 595.3], [1190.6, 841.9], [1683.8, 1190.6]];
const FONT = 'Serif';

/** Copia del árbol adaptada a svg2pdf: una sola fuente, texto sin símbolos que falten y halos explícitos. */
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

export async function exportarPDF({ model, metodo, data, svg }) {
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

  seccion('Modelo');
  const [obj, ...rest] = modeloLineas(model);
  parrafo(obj, 10);
  parrafo('Sujeto a:', 10);
  rest.forEach((l, i) => parrafo(`${l}    (${model.constraints[i].name})`, 22));
  parrafo('Todas las variables valen 0 o 1.', 22);

  seccion(`Resultado (${metodo === 'enumeracion' ? 'enumeración' : 'aditivo de Balas'})`);
  lineasResultado(model, metodo, data).forEach((l) => parrafo(l, 10, 10.5, l.startsWith('Óptimo') ? 'bold' : 'normal'));
  if (metodo === 'balas') avisosTransformacion(model, data).forEach((a) => parrafo(a, 10));

  const tablaOpts = (extra) => ({
    margin: { left: M, right: M, bottom: 40 },
    theme: 'plain',
    styles: { font: FONT, fontSize: 8.5, cellPadding: { top: 3, bottom: 3, left: 3, right: 3 }, textColor: 0, lineColor: [210, 210, 205], overflow: 'linebreak' },
    headStyles: { fontStyle: 'bold', lineWidth: { top: 1.2, bottom: 0.8 }, lineColor: 0 },
    bodyStyles: { lineWidth: { bottom: 0.3 } },
    ...extra,
  });
  const limpia = (rows) => rows.map((r) => r.map(plano));

  if (metodo === 'enumeracion') {
    const t = tablaDatos(model, metodo, data);
    if (t) {
      seccion('Tabla de combinaciones');
      let idx = t.rows.map((_, i) => i);
      if (idx.length > 256) {
        idx = idx.filter((i) => data.rows[i].feasible).slice(0, 1000);
        parrafo(`La tabla completa tiene ${t.rows.length} filas; aquí solo se listan las combinaciones factibles (máximo 1000).`, 0, 9.5);
      }
      autoTable(doc, tablaOpts({
        startY: y,
        head: [t.headers.map(plano)],
        body: limpia(idx.map((i) => t.rows[i])),
        didParseCell: (d) => {
          if (d.section !== 'body') return;
          const i = idx[d.row.index];
          if (t.optimas[i]) {
            d.cell.styles.fontStyle = 'bold';
            d.cell.styles.fillColor = [234, 238, 247];
            d.cell.styles.textColor = [29, 63, 143];
          } else if (d.column.index > 0 && d.column.index <= model.constraints.length && !data.rows[i].satisfied[d.column.index - 1]) {
            d.cell.styles.textColor = [179, 38, 30];
          }
        },
      }));
    } else {
      y += 4;
      parrafo('Con más de 12 variables no se lista la tabla de combinaciones; solo los conteos y el óptimo.', 0, 10);
    }
  } else {
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
      doc.text('Árbol del método aditivo de Balas', M, M + 10);
      const esc = ajuste(page);
      const w = bw * esc;
      const h = bh * esc;
      const el = svgParaPdf(svg);
      el.style.position = 'absolute';
      el.style.left = '-99999px';
      document.body.appendChild(el);
      try {
        await doc.svg(el, { x: (page[0] - w) / 2, y: HEAD + (page[1] - HEAD - FOOT - h) / 2, width: w, height: h });
      } finally {
        el.remove();
      }
      doc.setFont(FONT, 'normal');
      doc.setFontSize(9);
      doc.setTextColor(90);
      doc.text('Azul: solución factible. Rojo: rama podada. Cada arista indica el valor fijado a la variable.', M, page[1] - 22);
      doc.setTextColor(0);
      doc.addPage('a4', 'portrait');
      y = M + 10;
    } else {
      y += 4;
      parrafo('El árbol es demasiado grande para dibujarlo; consulta la tabla de la traza.', 0, 10);
    }
    seccion('Traza del método');
    const t = tablaDatos(model, metodo, data);
    autoTable(doc, tablaOpts({
      startY: y,
      head: [t.headers.map(plano)],
      body: limpia(t.rows),
      columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 62 }, 2: { cellWidth: 36 }, 3: { cellWidth: 100 }, 4: { cellWidth: 48 }, 5: { cellWidth: 66 } },
    }));
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
  return saveFile('programacion-entera-binaria.pdf', doc.output('blob'), 'application/pdf');
}
