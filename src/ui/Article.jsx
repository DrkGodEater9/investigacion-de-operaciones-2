/**
 * Piezas para escribir la pestaña «Teoría» (y textos largos) con el mismo estilo en todos los temas.
 *   <Article>        columna de lectura con ancho cómodo
 *   <Section title>  apartado con subtítulo
 *   <Callout title tone="nota|ojo|regla">  recuadro
 *   <Formula>        fórmula centrada (texto en serif)
 *   <Figure caption> figura con pie (SVG, imagen o componente)
 */
export function Article({ children }) {
  return <article className="article">{children}</article>;
}

export function Section({ title, children }) {
  return (
    <section className="article-section">
      {title && <h2>{title}</h2>}
      {children}
    </section>
  );
}

const TONE = { nota: 'Nota', ojo: 'Ojo', regla: 'Regla' };
export function Callout({ title, tone = 'nota', children }) {
  return (
    <aside className={'callout callout--' + tone}>
      <strong>{title || TONE[tone]}</strong>
      <div>{children}</div>
    </aside>
  );
}

export function Formula({ children }) {
  return <p className="formula-block">{children}</p>;
}

export function Figure({ caption, children }) {
  return (
    <figure className="figure">
      <div className="figure-body">{children}</div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}
