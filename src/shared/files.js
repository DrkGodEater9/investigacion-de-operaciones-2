/** Guarda un archivo: usa la capacidad de descargas del visor de Claude si existe; si no, un enlace normal. */
export async function saveFile(filename, data, mime = 'application/octet-stream') {
  try {
    if (window.claude?.use) {
      const downloads = await window.claude.use('downloads');
      if (downloads) {
        await downloads.save({ filename, data });
        return true;
      }
    }
  } catch (err) {
    if (err?.code === 'declined') return false;
  }
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return true;
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

export function slug(s) {
  return String(s || 'red')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'red';
}

/** SVG del diagrama listo para exportar, con fondo blanco y la vista completa. */
export function serializeSvg(svg, bounds) {
  const clone = svg.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('viewBox', `${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`);
  clone.setAttribute('width', Math.round(bounds.w));
  clone.setAttribute('height', Math.round(bounds.h));
  clone.removeAttribute('class');
  clone.removeAttribute('style');
  clone.querySelectorAll('[data-ui]').forEach((n) => n.remove());
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('x', bounds.x);
  bg.setAttribute('y', bounds.y);
  bg.setAttribute('width', bounds.w);
  bg.setAttribute('height', bounds.h);
  bg.setAttribute('fill', '#ffffff');
  clone.insertBefore(bg, clone.firstChild);
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
}

export function svgToPng(svgText, width, height, scale = 2) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo generar la imagen'))), 'image/png');
    };
    img.onerror = () => reject(new Error('No se pudo leer el SVG'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
  });
}

export function toCSV(headers, rows) {
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return '\ufeff' + [headers, ...rows].map((r) => r.map(esc).join(';')).join('\n');
}

export function toMarkdown(headers, rows) {
  const line = (r) => '| ' + r.map((c) => String(c ?? '')).join(' | ') + ' |';
  return [line(headers), '|' + headers.map(() => '---').join('|') + '|', ...rows.map(line)].join('\n');
}
