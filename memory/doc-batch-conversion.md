---
name: doc-batch-conversion
description: Decisiones de diseño para la conversión automática de expresiones $$/$$$ de documentos a SVG
metadata:
  type: project
---

Funcionalidad en desarrollo (decidida 2026-09-14): convertir automáticamente las
expresiones escritas en un documento a SVG, sustituyéndolas **en su sitio**.

- Delimitadores: `$$…$$` → LaTeX (`tex`), `$$$…$$$` → AsciiMath. Un solo `$` no se usa.
- Nombres: si la fórmula display lleva detrás su número escrito a mano (`$$ x $$ (1)`,
  `(3.2)`, `[4]`) ese número **es** el nombre; el resto reciben el contador automático
  `1…n`, saltando los valores ya ocupados por una etiqueta para que las dos
  numeraciones no colisionen. Solo las conversiones con éxito consumen número; un
  segundo pase reserva los nombres existentes y numera desde ahí.
- El `$$…$$` original **se borra**: los metadatos `lxs2-` del SVG son la única
  fuente para el camino inverso (ver [[word-svg-metadata]]).
- Display vs inline: se decide por lo que hay **delante** de la fórmula en su
  párrafo. Nada delante → display; texto delante → inline. Lo que va detrás se
  ignora a propósito, porque las fórmulas display suelen llevar su número de
  ecuación escrito a mano justo después (`$$ x^2 $$ (1)`).
- Round-trip en ambos sentidos: expresión → SVG y SVG → expresión.
- Nombres de salida (decidido 2026-09-15): `*_svg.docx`/`*_svg.odt` de ida y
  `*_code.docx`/`*_code.odt` de vuelta, **junto al archivo original**, no en la
  carpeta de descargas. El sufijo anterior se sustituye, no se acumula.
- Estado (versión 0.6.0, 2026-09-15): **hecho** los dos sentidos en Word (.docx)
  y Writer (.odt). **Pendiente**: PowerPoint (.pptx) e Impress (.odp).
- Ante un error de render: **no** se convierte, la expresión se deja tal cual y se
  añade un comentario del documento con el mensaje de error anclado a ella.

**Why:** son decisiones del usuario, no deducibles del código.

**How to apply:** el núcleo de detección está en `src/utils/docxMath.js` (funciones
puras, sin DOM, testeables en Node) y lo comparten ambos inyectores. ODT resultó el
más barato: sin PNG de respaldo, sin relaciones ni tipos de contenido, y los
comentarios van inline con `<office:annotation>`.

Las presentaciones (.pptx y .odp) son el caso caro y por eso van las últimas: **no
existe la imagen en línea dentro de un párrafo**, así que hay que borrar el texto y
colocar un marco flotante con coordenadas explícitas, y decidir esa posición no
tiene respuesta obvia. El detector y `assignNames` se reutilizan tal cual; lo que
hay que escribir entero es el colocador.
