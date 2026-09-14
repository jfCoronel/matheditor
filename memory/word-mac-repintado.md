---
name: word-mac-repintado
description: Word para Mac no repinta las imágenes en línea al abrir un documento en arranque en frío
metadata:
  type: project
---

Word para Mac (comprobado en 16.112.4) **no repinta las imágenes incrustadas la
primera vez que se abre un documento tras arrancar la aplicación**. La ecuación se
ve en blanco hasta que se hace clic encima, se hace scroll o algo invalida la
región. Con Word ya abierto, el mismo fichero se ve perfecto.

**Why:** costó una tarde entera de bisección. Se probaron y descartaron: el modo
AsciiMath, el modo inline, `w:jc center`, el `w:position` de la línea base, el
tamaño del PNG de respaldo, la falta de `useLocalDpi`, el contexto del párrafo
(texto delante/detrás) y el documento de origen. Ninguna era la causa: la variable
descontrolada era si Word se había arrancado de cero.

**How to apply:** ante un informe de "la ecuación se ve en blanco en Word",
preguntar PRIMERO si Word ya estaba abierto antes de hacer nada más. El documento
generado es correcto: se ve al imprimir, al exportar a PDF y en LibreOffice.

Comprobado además que Word abre y reescribe nuestro .docx conservándolo todo
(`svgBlip`, `useLocalDpi`, `w:position`, comentarios) y que el id `lxs2-` sobrevive
al ciclo completo abrir+guardar — ver [[word-svg-metadata]] y [[doc-batch-conversion]].
