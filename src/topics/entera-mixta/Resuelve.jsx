import EnteraSolver from '@/tools/entera/EnteraSolver.jsx';
import { ejemplosMixta } from '@/tools/entera/domain/examplesMixta.js';

/**
 * Pestaña «Resuelve el tuyo» del tema 1.2: Programación entera mixta.
 * Mismo solucionador de la entera pura, pero cada variable se marca como entera o continua
 * (allowIntegerToggle) y arranca con el ejemplo del profesor (x2 entera, x1 continua).
 */
export default function Resuelve() {
  return (
    <EnteraSolver
      start="mixta-e1"
      examples={ejemplosMixta}
      allowIntegerToggle
      title="Programación entera mixta"
    />
  );
}
