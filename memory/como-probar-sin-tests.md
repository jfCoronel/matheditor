---
name: como-probar-sin-tests
description: El proyecto no tiene framework de tests; cómo ejercitar el renderizado y la conversión de documentos
metadata:
  type: project
---

No hay framework de tests. Dos formas de probar de verdad, ambas usadas con éxito
el 2026-09-15 y reproducibles en el scratchpad:

**Conversión de documentos (sin navegador).** `convertDocx`/`convertOdt` reciben
`render` inyectado, así que en Node basta jsdom + un renderizador falso que
devuelva un SVG con el id `lxs2-`, y `outputType: 'nodebuffer'`. Permite el ciclo
completo ida→vuelta y comparar el texto carácter a carácter. Dos trampas: los
imports del proyecto no llevan extensión (hace falta un hook `registerHooks` que
añada `.js`) y a JSZip hay que pasarle el Buffer, no un Blob.

**Renderizado con MathJax (hace falta navegador de verdad).** jsdom NO sirve: la
carga dinámica de fuentes deja el `tex2svgPromise` sin resolver para siempre. Lo
que funciona es `npx vite --port …` sirviendo una página suelta en la raíz que
importe `/src/utils/mathRender.js` como módulo, y abrirla con

    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
      --headless --disable-gpu --virtual-time-budget=90000 --dump-dom URL

volcando los resultados en un `<pre>` que se lee del DOM. Ojo: `startup.js` va con
`async`, así que hay que esperar a que exista `MathJax.startup.promise` antes de
hacerle `await` (si no, `await undefined` resuelve al instante y parece que
MathJax no tiene métodos). Y el rasterizado a PNG es lento: para barridos de
muchas ecuaciones, comprobar solo lo que interesa sin pasar por `svgToPngBlob`.

Ver [[doc-batch-conversion]].
