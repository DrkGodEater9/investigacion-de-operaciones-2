import EnteraSolver from '@/tools/entera/EnteraSolver.jsx';

/**
 * Pestaña «Resuelve el tuyo» del tema 1.1: Programación entera pura.
 * Todas las variables de decisión están restringidas a ser enteras (allowIntegerToggle=false).
 * Arranca por defecto con el modelo del tema (Z = 5x₁ + 4x₂).
 */
export default function Resuelve() {
  return (
    <EnteraSolver
      start="tema"
      allowIntegerToggle={false}
      title="Programación entera pura"
    />
  );
}
