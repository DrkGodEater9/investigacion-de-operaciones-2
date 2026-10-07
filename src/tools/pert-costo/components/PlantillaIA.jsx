import { copyText } from '@/shared/files.js';
import { PLANTILLA_IA } from '../domain/plantilla.js';

export default function PlantillaIA({ notify }) {
  const copiar = async () => notify((await copyText(PLANTILLA_IA)) ? 'Plantilla copiada al portapapeles' : 'El navegador no permitió copiar.');
  return (
    <div className="pc-bloque">
      <p className="pc-nota">
        Copia este texto, pégalo en una inteligencia artificial (ChatGPT, Claude, etc.) y reemplaza el final por tu enunciado.
        Pega su respuesta en el modo «Markdown» y el proyecto se cargará solo.
      </p>
      <div className="pc-codigo">
        <div className="pc-codigo-cab">
          <span>Plantilla para IA</span>
          <button type="button" className="btn btn--sm btn--primary" onClick={copiar}>Copiar</button>
        </div>
        <pre className="pc-pre" data-testid="plantilla-ia">{PLANTILLA_IA}</pre>
      </div>
    </div>
  );
}
