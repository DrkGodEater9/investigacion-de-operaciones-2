# Plantilla de tema

Copia esta carpeta como `src/topics/<id-del-tema>/` (el `id` es el de `src/content/curriculum.js`)
y deja solo las piezas que vayas a construir. Luego súbelas al registro:

```js
// src/content/registry.js
'mi-tema': {
  teoria:   lazy(() => import('../topics/mi-tema/Teoria.jsx')),
  paso:     lazy(() => import('../topics/mi-tema/Paso.jsx')),
  resuelve: lazy(() => import('../topics/mi-tema/Resuelve.jsx')),
  practica: lazy(() => import('../topics/mi-tema/Practica.jsx')),
},
```

Cada archivo exporta un componente por defecto. Las carpetas que empiezan con `_` no se cargan.

- **Teoria.jsx**: modelo en `topics/redes-estructura/Teoria.jsx`.
- **Resuelve.jsx**: monta una herramienta de `src/tools/<herramienta>/`.
- La lógica de cálculo va en `tools/<herramienta>/domain/` (funciones puras, con pruebas), nunca dentro de componentes.
