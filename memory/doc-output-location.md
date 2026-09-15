---
name: doc-output-location
description: El documento convertido se guarda junto al original con sufijo _svg / _code, no en Descargas
metadata:
  type: project
---

Decidido el 2026-09-15: el resultado de convertir un documento va **al mismo
directorio que el original**, llamado `*_svg.docx`/`*_svg.odt` (expresiones →
imágenes) o `*_code.docx`/`*_code.odt` (imágenes → expresiones). Un sufijo previo
se sustituye en vez de acumularse.

**Why:** un `<a download>` siempre cae en la carpeta de descargas, lejos del
documento sobre el que se trabaja, y es el usuario quien pidió lo contrario.

**How to apply:** `src/utils/docFile.js`. La única forma de que el diálogo de
guardado se abra ya en la carpeta del original es la File System Access API con
`startIn: <handle del archivo de entrada>`, así que el archivo se elige con
`showOpenFilePicker` (no con `<input type=file>`) y el handle viaja hasta el
guardado. Dos límites que no se pueden esquivar:

- **Firefox y Safari no tienen los selectores** (Safari los declara pero no
  pregunta el nombre), así que allí es descarga normal y el directorio no se
  puede elegir: solo se garantiza el nombre.
- **Los selectores exigen activación de usuario reciente** y convertir cien
  ecuaciones la agota. Cuando eso pasa `saveDocument` devuelve `'gesture'` y
  `ConvertDoc` deja el documento en espera detrás de un botón «Guardar
  documento» en vez de soltarlo en Descargas.

Ver [[doc-batch-conversion]].
