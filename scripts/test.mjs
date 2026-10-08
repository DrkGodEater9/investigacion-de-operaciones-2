// Corre todas las pruebas del proyecto: los verify.mjs (scripts sueltos) y cada *.test.js / *.test.mjs.
// Así una prueba nueva entra sola, sin editar package.json.
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('../src', import.meta.url));
const archivos = [];
(function recorrer(dir) {
  for (const nombre of readdirSync(dir).sort()) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) recorrer(ruta);
    else archivos.push(ruta);
  }
})(raiz);

const verifies = archivos.filter((f) => f.replaceAll("\\", "/").endsWith("/test/verify.mjs"));
const pruebas = archivos.filter((f) => /\.test\.m?js$/.test(f));

let fallos = 0;
const correr = (args, etiqueta) => {
  console.log(`\n▶ ${etiqueta}`);
  const r = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if (r.status !== 0) fallos++;
};

for (const f of verifies) correr([f], relative(raiz, f));
if (pruebas.length) correr(['--test', ...pruebas], `${pruebas.length} archivos de prueba (node --test)`);
correr(['scripts/humo.mjs'], 'prueba de humo de la interfaz');

if (fallos) { console.error(`\n✖ ${fallos} grupo(s) de pruebas fallaron`); process.exit(1); }
console.log('\n✔ Todas las pruebas pasaron');
