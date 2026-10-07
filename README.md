# Investigación de operaciones II: sitio de estudio

Sitio en React (Vite) con un menú por módulos y temas. Cada tema tiene cuatro partes: Teoría, Paso a paso, Resuelve el tuyo y Práctica.

| Módulo | Temas (todos con las cuatro partes) |
|---|---|
| 1. Programación entera | 1.1 pura · 1.2 mixta · 1.3 binaria |
| 2. Decisión bajo incertidumbre | 2.1 Bayes · 2.2 árboles de decisión |
| 3. Redes de proyecto | 3.1 estructura · 3.2 tiempos · 3.3 costos · 3.4 recursos |

```bash
npm install
npm run dev     # desarrollo
npm run build   # genera dist/index.html (un solo archivo)
npm test        # corre todas las pruebas de lógica (descubre solas los *.test.js y verify.mjs)
```

Requiere Node 20 o superior. En cada push y pull request, GitHub Actions corre `npm test` y `npm run build`.

La estructura, el diseño y cómo agregar un tema están en **GUIA_DEL_PROYECTO.md**.
