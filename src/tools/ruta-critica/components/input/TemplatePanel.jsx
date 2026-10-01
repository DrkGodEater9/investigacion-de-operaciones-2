import { useState } from 'react';
import Segmented from '@/ui/Segmented.jsx';
import { copyText } from '@/shared/files.js';

const TEMPLATES = {
  cpm: `# Título del ejercicio
| Actividad | Predecesoras | Duración |
|---|---|---|
| A | - | 2 |
| B | - | 5 |
| C | A | 6 |
| D | A,B | 3 |`,
  pert: `# Título del ejercicio
| Actividad | Predecesoras | a | m | b |
|---|---|---|---|---|
| A | - | 18 | 28 | 32 |
| B | - | 18 | 22 | 38 |
| C | A,B | 15 | 19 | 29 |`,
  network: `# Título del ejercicio
| Actividad | Predecesoras |
|---|---|
| A | - |
| B | - |
| C | A |
| D | A,B |`,
};

const PROMPT = (tpl) => `Convierte el ejercicio que te adjunto (imagen, PDF o texto) en una tabla Markdown con exactamente este formato, sin texto adicional antes ni después:

${tpl}

Reglas:
- Una fila por actividad, con el mismo nombre que aparece en el ejercicio (letras, números o letras griegas).
- En «Predecesoras» separa con comas y sin espacios; escribe «-» si la actividad no tiene predecesoras.
- Usa punto decimal.
- Si el ejercicio da tres tiempos (optimista, más probable, pesimista), usa las columnas a, m, b.
- Si solo pide construir la red, deja solo las columnas Actividad y Predecesoras.
- En la primera línea pon «# » y el título del ejercicio.`;

export default function TemplatePanel({ notify }) {
  const [kind, setKind] = useState('cpm');
  const tpl = TEMPLATES[kind];
  const copy = async (text, what) => notify((await copyText(text)) ? `${what} copiada` : 'El navegador no permitió copiar; selecciónala a mano.');

  return (
    <div className="template-panel">
      <p className="lead">
        Pásale a una IA la instrucción de abajo junto con la foto o el PDF del ejercicio. Pega su respuesta en la pestaña «Markdown» y la red se arma sola.
      </p>
      <Segmented
        size="sm"
        label="Tipo de plantilla"
        value={kind}
        onChange={setKind}
        options={[
          { id: 'cpm', label: 'CPM' },
          { id: 'pert', label: 'PERT' },
          { id: 'network', label: 'Solo red' },
        ]}
      />
      <div className="code-block">
        <div className="code-head">
          <span>Plantilla Markdown</span>
          <button type="button" className="btn btn--sm" onClick={() => copy(tpl, 'Plantilla')}>
            Copiar plantilla
          </button>
        </div>
        <pre>{tpl}</pre>
      </div>
      <div className="code-block">
        <div className="code-head">
          <span>Instrucción para la IA</span>
          <button type="button" className="btn btn--sm btn--primary" onClick={() => copy(PROMPT(tpl), 'Instrucción')}>
            Copiar instrucción
          </button>
        </div>
        <pre className="prompt">{PROMPT(tpl)}</pre>
      </div>
    </div>
  );
}
