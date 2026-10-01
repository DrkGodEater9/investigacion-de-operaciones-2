import { Article, Section, Callout, Formula, Figure } from '@/ui/Article.jsx';

// Escribe la explicación con tus propias palabras: corta, con ejemplos y dibujos.
export default function Teoria() {
  return (
    <Article>
      <Section title="Qué es">
        <p>Definición en dos o tres frases y para qué sirve.</p>
      </Section>
      <Section title="Cómo se resuelve">
        <Formula>z = c₁x₁ + c₂x₂</Formula>
        <Callout tone="regla" title="Regla">Lo que hay que recordar.</Callout>
        <Figure caption="Pie de figura.">{/* SVG o componente */}</Figure>
      </Section>
    </Article>
  );
}
