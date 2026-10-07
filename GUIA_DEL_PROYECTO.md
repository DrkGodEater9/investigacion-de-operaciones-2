# Guía del proyecto: sitio de estudio de Investigación de operaciones II

Pega este archivo como instrucciones del proyecto de Claude. Cada conversación nueva construye UNA pieza de UN tema, siguiendo esto.

## 1. Qué es
Una página web (React + Vite) para estudiar el curso y resolver ejercicios, pensada para compartir con los compañeros. Cada tema tiene cuatro pestañas:

1. **Teoría**: explicación corta, con dibujos y un ejemplo.
2. **Paso a paso**: un ejemplo resuelto que avanza de a un paso, con el cálculo de cada paso a la vista y animación.
3. **Resuelve el tuyo**: calculadora donde el estudiante ingresa su ejercicio y obtiene el resultado, las tablas y el diagrama.
4. **Práctica**: ejercicios con corrección.

El índice del curso está en `src/content/curriculum.js` (sale del syllabus y del Moodle). El modelo de referencia ya terminado es el tema 3.1 (Teoría) y la herramienta `tools/ruta-critica` (Resuelve y Paso a paso de redes).

## 2. Diseño (no se negocia)
- Fondo blanco, líneas negras finas, aspecto de documento formal, como un PDF. Nada de gradientes, sombras fuertes ni decoración.
- Tipografías: texto de interfaz en Public Sans; títulos, fórmulas y dibujos en STIX Two Text (serif). Ya están en `index.html`.
- Color solo con función: azul `#1d3f8f` para lo interactivo y lo resaltado, rojo `#b3261e` para errores o para resaltar lo crítico. Todo lo demás es negro sobre blanco.
- Usa las variables de `src/styles/base.css` (`--ink`, `--rule`, `--accent`, `--serif`…) y los componentes de `src/ui/` (Tabs, Segmented, Toggle, Toast, Article, StatusMark). No inventes otros estilos de botón o de tabla.
- Los dibujos son SVG hechos a mano: círculo partido para eventos (número arriba), trazo negro, letra serif. Tienen que verse igual en pantalla, en PNG y en PDF.
- Todo en español de Colombia, tuteando, en tono claro y sin adornos. Sin emojis en la interfaz.
- Debe funcionar en celular (el menú es un cajón) y en escritorio.

## 3. Arquitectura
```
src/
  app/        carcasa: App, Sidebar, TopBar, router por hash, progreso (localStorage con try/catch)
  content/    curriculum.js (índice, única fuente de verdad) y registry.js (qué piezas están hechas)
  pages/      HomePage y TopicPage (no se tocan al agregar temas)
  ui/         componentes compartidos
  shared/     utilidades generales (guardar archivos, copiar, CSV, SVG→PNG)
  styles/     base.css (tokens y controles) y layout.css (carcasa)
  tools/      herramientas reutilizables, una carpeta por herramienta
    ruta-critica/  domain/ (lógica pura) · hooks/ · components/ · utils/ · test/ · solver.css
  topics/     contenido de cada tema: topics/<id>/{Teoria,Paso,Resuelve,Practica}.jsx
    _plantilla/  copiar para empezar un tema nuevo
```
Reglas:
- **La lógica de cálculo vive en `tools/<herramienta>/domain/` como funciones puras** (sin React, sin DOM), para poder probarla con Node. Los componentes solo muestran.
- Los temas en `topics/` componen: una pestaña `Resuelve.jsx` normalmente monta una herramienta. Una herramienta se puede usar en varios temas (por ejemplo, las dos primeras enteras comparten solucionador).
- Importa entre capas con el alias `@/` (`@/ui/Tabs.jsx`); dentro de una herramienta, rutas relativas.
- Nada de `localStorage` fuera del progreso de estudio. Nada de peticiones de red, salvo las tipografías de Google Fonts de `index.html`.
- `npm run build` produce un único `index.html` autocontenido. Las librerías nuevas se agregan con cuidado (peso) y se cargan con `import()` dinámico si son pesadas.

## 4. Cómo construir una pieza
1. Lee `curriculum.js` (el `plan` del tema dice qué debe tener cada pestaña) y el material que adjunte la persona.
2. Si hace falta cálculo: primero el `domain/` de la herramienta, con su prueba en `test/`.
3. Luego los componentes, copiando el patrón de `tools/ruta-critica` (entrada por tabla y por Markdown, validación con mensajes claros en español, resultados en tablas, exportar a PDF, pestaña «Plantilla para IA»).
4. Crea el archivo en `topics/<id>/` y agrega UNA línea en `content/registry.js`. No cambies nada más de la carcasa.
5. Si el tema cambia de nombre o de subtemas, solo se edita `curriculum.js`.

## 5. Estándar de cada pestaña
- **Teoría**: usa `Article`, `Section`, `Callout`, `Formula`, `Figure` (mira `topics/redes-estructura/Teoria.jsx`). Corta, con ejemplo numérico y al menos una figura. Fiel al método del profesor, y más clara donde el material no lo es.
- **Paso a paso**: una lista de pasos generada por una función del `domain/` (texto con el cálculo + estado que el dibujo muestra), con controles anterior / siguiente / reproducir, como `StepBar`. Cada paso explica qué se hace y por qué.
- **Resuelve el tuyo**: el estudiante puede escribir una tabla o pegar Markdown y el resultado se actualiza solo. Incluye ejemplos cargables, errores comprensibles (qué falló y en qué fila), y exportar PDF/CSV/Markdown.
- **Práctica**: los ejercicios salen de datos (no texto fijo dentro del componente), el estudiante responde y recibe corrección con la explicación del error. Mezcla ejercicios con números que varían para que se pueda repetir.

## 6. Verificación antes de entregar (obligatoria)
1. `npm test` debe pasar. Las pruebas de dominio se comparan contra un cálculo independiente (otra forma de llegar al mismo resultado) y contra casos aleatorios, no solo contra ejemplos fijos.
2. Resolver a mano o con otra fuente al menos un ejercicio y comparar.
3. Abrir la página en un navegador de pruebas (Playwright): recorrer la pieza, forzar errores de entrada, cambiar de pestaña y volver, revisar la consola sin errores.
4. Mirar capturas en escritorio y en celular (390 px): sin desbordes horizontales ni texto cortado.
5. Si hay PDF: generarlo, abrirlo y revisarlo página por página (tildes, letras griegas, tablas).
6. Decir con honestidad qué se probó y qué no.

## 7. Contenido y fuentes
- Se sigue el material del profesor: su método, su notación, su terminología y el orden en que lo explica, porque es con lo que se evalúa.
- Si una explicación del profesor ya es clara, se usa tal cual (definiciones, fórmulas, pasos del método).
- Si está confusa, incompleta o salta pasos, se reescribe más claro y con un ejemplo, sin cambiar el método.
- Como el sitio se comparte con el curso, se transcribe lo necesario (definiciones, fórmulas, el método) y las figuras se redibujan; no se pegan diapositivas ni páginas del libro enteras como imagen.
- Si el material parece tener un error, se avisa a la persona antes de repetirlo.
- La bibliografía se cita (Taha; Hillier y Lieberman).
- Si la persona pasa videos, hace falta la transcripción o un resumen: Claude no puede ver videos.

## 8. Hoja de ruta por tema (qué herramienta necesita cada uno)
- **1.1 Entera pura**: simplex (tableau) + ramificación y acotamiento. Región factible en 2 variables con los puntos enteros, árbol B&B paso a paso. Después, planos de corte de Gomory.
- **1.2 Entera mixta**: mismo solucionador, marcando variables enteras y continuas (solo se ramifica en las enteras).
- **1.3 Entera binaria**: modelos clásicos (mochila, selección de proyectos, asignación, costo fijo) y restricciones lógicas; resolver por enumeración implícita / B&B.
- **2.1 Bayesiana**: tabla a priori, verosimilitud, conjunta, posterior; decisión óptima, VEIP y valor de la información muestral.
- **2.2 Árboles de decisión**: editor del árbol (nodos de decisión y de azar), inducción hacia atrás animada, sensibilidad de una probabilidad.
- **3.1 y 3.2 Estructura y tiempo**: hechos (`tools/ruta-critica`).
- **3.3 Costos (PERT/COSTO)**: duración y costo normal y límite, pendiente de costo, reducción paso a paso de la ruta crítica (ojo con varias rutas críticas simultáneas), curva costo-duración. Reutiliza `ruta-critica/domain` para la red.
- **3.4 Recursos**: histograma de recursos sobre el Gantt, detección de picos, programación con recursos limitados (reglas de prioridad por holgura), duración resultante. Reutiliza `ruta-critica/domain`.

## 9. Plantilla para abrir cada conversación
> Módulo X.Y, pestaña Z. Adjunto el código actual (zip) y el material del tema (PDF / diapositivas / ejercicios). Construye la pestaña siguiendo la guía del proyecto. Entrégame el zip actualizado y publica el sitio, y dime qué verificaste y qué no.

Al terminar cada tema, sube el zip nuevo al proyecto para que la siguiente conversación parta de él.
