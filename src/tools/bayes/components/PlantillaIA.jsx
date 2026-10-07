import { copyText } from '@/shared/files.js';

import { PLANTILLA_IA } from '../domain/plantilla.js';

export default function PlantillaIA({ notify }) {
  const copiar = async () => notify((await copyText(PLANTILLA_IA)) ? 'Plantilla copiada al portapapeles' : 'El navegador no permitió copiar.');
  return (
    <div className="bz-bloque">
      <p className="bz-nota">
        Copia este texto, pégalo en una inteligencia artificial (ChatGPT, Claude, etc.) y reemplaza el final por tu enunciado.
        Pega sus tablas en el modo «Markdown» y el problema se cargará solo.
      </p>
      <div className="bz-codigo">
        <div className="bz-codigo-cab">
          <span>Plantilla para IA</span>
          <button type="button" className="btn btn--sm btn--primary" onClick={copiar}>Copiar</button>
        </div>
        <pre className="bz-pre" data-testid="plantilla-ia">{PLANTILLA_IA}</pre>
      </div>
    </div>
  );
}
