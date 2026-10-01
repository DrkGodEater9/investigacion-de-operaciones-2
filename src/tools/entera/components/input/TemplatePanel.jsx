import { useState } from 'react';
import Segmented from '@/ui/Segmented.jsx';
import { copyText } from '@/shared/files.js';

const TEMPLATES = {
  dos: `# Problema de 2 variables
Sentido: Maximizar

| Tipo | x1 | x2 | Op | b |
|---|---|---|---|---|
| FO | 5 | 4 | | |
| R1 | 1 | 1 | <= | 5 |
| R2 | 10 | 6 | <= | 45 |`,
  tres: `# Problema de 3 variables
Sentido: Maximizar

| Tipo | x1 | x2 | x3 | Op | b |
|---|---|---|---|---|---|
| FO | 4 | 8 | 7 | | |
| R1 | 3 | 4 | 2 | <= | 53 |
| R2 | 4 | 1 | 4 | <= | 80 |
| R3 | 4 | 7 | 4 | <= | 160 |`,
  min: `# Problema de Minimización
Sentido: Minimizar

| Tipo | x1 | x2 | Op | b |
|---|---|---|---|---|
| FO | 4 | 3 | | |
| R1 | 2 | 1 | >= | 5 |
| R2 | 1 | 3 | >= | 6 |`,
};

const PROMPT = (tpl) => `Convierte el enunciado o ejercicio que te adjunto (foto, PDF o texto) en una tabla Markdown con exactamente este formato, sin texto adicional antes ni después:

${tpl}

Reglas:
- La primera línea debe ser «# » seguido del título o resumen del ejercicio.
- La segunda línea debe indicar «Sentido: Maximizar» o «Sentido: Minimizar».
- La tabla debe tener la fila «FO» con los coeficientes c_j de la función objetivo.
- Cada restricción va en una fila «R1», «R2», etc., con sus coeficientes, el operador (<=, >= o =) y el término independiente b.
- Todas las variables se asumen no negativas (x_j >= 0) y enteras (x_j in Z).
- Si un coeficiente es fraccionario o decimal, usa números o fracciones (por ejemplo 5/2 o 2.5).`;

export function TemplatePanel({ notify }) {
  const [kind, setKind] = useState('dos');
  const tpl = TEMPLATES[kind];

  const copy = async (text, what) =>
    notify((await copyText(text)) ? `${what} copiada al portapapeles` : 'El navegador no permitió copiar.');

  return (
    <div className="template-panel">
      <p className="template-intro">
        Pásale a una inteligencia artificial (ChatGPT, Claude, etc.) la instrucción de abajo junto con el enunciado, fotografía o PDF de tu ejercicio. Pega su respuesta en la pestaña «Markdown» y el modelo se cargará automáticamente.
      </p>

      <Segmented
        size="sm"
        value={kind}
        onChange={setKind}
        options={[
          { id: 'dos', label: '2 variables' },
          { id: 'tres', label: '3 variables' },
          { id: 'min', label: 'Minimización' },
        ]}
      />

      <div className="code-block">
        <div className="code-head">
          <span>Plantilla Markdown</span>
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => copy(tpl, 'Plantilla')}
          >
            Copiar plantilla
          </button>
        </div>
        <pre>{tpl}</pre>
      </div>

      <div className="code-block">
        <div className="code-head">
          <span>Instrucción para la IA</span>
          <button
            type="button"
            className="btn btn--sm btn--primary"
            onClick={() => copy(PROMPT(tpl), 'Instrucción')}
          >
            Copiar instrucción
          </button>
        </div>
        <pre className="prompt">{PROMPT(tpl)}</pre>
      </div>
    </div>
  );
}
