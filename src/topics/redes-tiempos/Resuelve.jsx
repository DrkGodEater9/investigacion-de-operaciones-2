import RutaCriticaSolver from '@/tools/ruta-critica/RutaCriticaSolver.jsx';

// Arranca con el ejercicio 1 (CPM). Con «a | m | b» en la tabla se resuelve por PERT.
export default function Resuelve() {
  return <RutaCriticaSolver start="ej1" />;
}
