# Web de Cacharrear con Juan

La web que reúne los proyectos públicos de GitHub: una página por proyecto, una página de descargas y los enlaces a los canales.

**Se hace sola.** Cada hora lee los repositorios públicos de la cuenta y sus releases. Si hay un repositorio nuevo, le crea su página; si hay una versión nueva, actualiza las descargas. No hay que tocar nada.

## Ponerla en marcha (una sola vez)

1. Crea un repositorio **público** que se llame exactamente **`cacharrearconjuan.github.io`**.
2. Sube a ese repositorio todo el contenido de este zip (la carpeta `.github` también).
3. En el repositorio, entra en **Settings → Pages** y, en **Build and deployment → Source**, elige **GitHub Actions**.
4. Entra en **Actions → Web → Run workflow**. En un par de minutos la web está en <https://cacharrearconjuan.github.io>.

La página de `mis-payloads-ps5` sigue donde estaba (`cacharrearconjuan.github.io/mis-payloads-ps5/payloads.json`): la web nueva usa otras rutas y no la pisa.

## Cómo se actualiza

| Cuándo | Qué hace |
|---|---|
| Cada hora | Mira GitHub. Si algo ha cambiado, publica la web nueva; si no, no publica nada. |
| Al subir un cambio a este repositorio | Publica siempre. |
| **Actions → Web → Run workflow** | Publica en el momento, sin esperar a la hora. |

Antes de publicar pasa las pruebas. Si GitHub falla o una prueba no pasa, no publica y la web se queda como estaba.

> GitHub apaga las tareas programadas de un repositorio público cuando pasa **60 días sin actividad** en él. Si ocurre, avisa por correo: entra en **Actions → Web → Enable workflow**. Cualquier cambio en este repositorio (por ejemplo, editar una nota) cuenta como actividad.

## Qué sale en cada proyecto

- **Título:** el primer encabezado `#` del README. Si no hay, el nombre del repositorio arreglado (`mis-payloads-ps5` → «Mis payloads PS5»).
- **Resumen:** la descripción del repositorio (el apartado **About** de GitHub). Si está vacía, el primer párrafo del README.
- **Texto:** el README entero, con sus enlaces e imágenes arreglados para que funcionen fuera de GitHub.
- **Descarga:** los archivos de la última release. Si solo hay betas, la beta, marcada. Los borradores no salen nunca. Sin releases, el zip del código.
- **Novedades:** las notas de la última release.
- **Descargas:** cuántas veces se han bajado los archivos de sus releases (sin contar los `.txt` de sumas ni las firmas).
- **Vídeo:** si en la descripción de un vídeo del canal pones el enlace al repositorio (`github.com/cacharrearconjuan/<repo>`) o a su página en la web, sale solo el botón «Ver el vídeo» con su título. Si hay varios, el más nuevo. Lo que se ve se guarda en `datos/videos-proyectos.json` (lo guarda el propio workflow), porque YouTube solo enseña los últimos 15 vídeos. El `video:` de una nota manda sobre esto.
- **«Nuevo»:** los 14 primeros días de un repositorio.

Los proyectos salen del más nuevo al más antiguo.

## Notas: añadir o cambiar cosas de un proyecto

En la carpeta `notas/` puede haber un archivo por proyecto, con el nombre del repositorio: `notas/lanzador-scrcpy.md`. Todo es opcional:

```markdown
---
titulo: Otro título
resumen: Lo que sale en la portada, en una o dos frases.
video: https://www.youtube.com/watch?v=...
descarga: Manual en PDF | https://ejemplo.com/manual.pdf
orden: 1
oculto: no
---

Texto en Markdown que sale antes del README.
```

| Campo | Para qué |
|---|---|
| `titulo` | Cambia el título. |
| `resumen` | Cambia el resumen de la portada. |
| `video` | Pone un botón «Ver el vídeo» en la caja de descarga (si no, se busca solo en las descripciones de los vídeos). |
| `descarga` | Añade un botón de descarga más. Se puede repetir. Formato: `Texto \| dirección`. |
| `catalogo` | Dirección de un `payloads.json` de Payload Manager: enseña la lista de payloads. También se puede poner en `sitio.json`, en `"catalogos"`. |
| `orden` | Fija el proyecto arriba: `1` va antes que `2`, y los dos antes que los que no tienen orden. |
| `oculto` | Con `si`, el proyecto no sale en la web. |

Las líneas que empiezan por `#` dentro de la cabecera no cuentan: sirven para dejar campos preparados, como el `# video:` de las notas que ya hay.

## Últimos vídeos

En la portada, entre los proyectos y los canales, salen los 3 últimos vídeos de [@CacharrearconJuan](https://www.youtube.com/@CacharrearconJuan), en una fila. Al pulsar uno se abre en YouTube.

- Se leen del feed público de YouTube en cada pasada (cada hora): no hace falta clave ni cuenta.
- No salen los Shorts ni los directos.
- Las miniaturas se copian dentro de la web, así quien entra no carga nada de YouTube hasta que pulsa.
- Si YouTube no responde, la web se publica igual sin la fila de vídeos, y vuelve en la pasada siguiente.
- El canal y cuántos vídeos salen se cambian en `sitio.json`, en `"youtube"` (`canal_id` y `cuantos`).

## Guías

Cada archivo de la carpeta `guias/` es una página de la web, en `/guias/<nombre-del-archivo>/`, y sale en la portada, en el apartado «Guías». Ya está `guias/limpiar-fire-tv.md`.

- Se escriben en Markdown, con la misma cabecera que las notas: `titulo`, `resumen`, `video`, `orden`, `oculto` y además `fecha` (`AAAA-MM-DD`, la de la última actualización).
- Cada `## apartado` sale en el índice «En esta guía».
- Los comandos van entre tres comillas invertidas (```` ```bash ````): en la web salen con un botón **Copiar**.
- Para hacer una nueva: **Add file → Create new file**, escribe `guias/nombre.md` como nombre y pega el texto.

## Que un repositorio no salga

Cualquiera de estas tres:

- Ponle el tema **`no-web`** en GitHub (**About → Topics**).
- Añade su nombre a `"ocultar"` en `sitio.json`.
- Crea su nota con `oculto: si`.

Nunca salen los repositorios privados, los forks, los archivados ni este mismo.

## Cambiar los textos o los canales

En `sitio.json`: el título, la frase de la portada, la dirección de la web y los canales (texto, detalle y enlace).

## Vista previa al compartir

Al pegar un enlace de la web en Telegram, WhatsApp o X sale una tarjeta con la imagen `plantilla/og.png`, el título y el resumen de esa página.

## Contador de visitas (opcional)

Con [GoatCounter](https://www.goatcounter.com), gratuito para webs como esta, sin cookies y sin aviso de cookies:

1. Crea una cuenta en goatcounter.com y elige un código (por ejemplo, `cacharrearconjuan`). Tus estadísticas quedarán en `https://cacharrearconjuan.goatcounter.com`.
2. En `sitio.json`, pon ese código en `"goatcounter"`: `"goatcounter": "cacharrearconjuan"`.

Mientras esté vacío, la web no cuenta nada. Cuando lo pongas, el pie de la web avisa de que las visitas se cuentan sin cookies.

## El feed

En `https://cacharrearconjuan.github.io/feed.xml` hay un feed Atom con cada proyecto nuevo y cada versión nueva. Vale para cualquier lector de feeds y para avisar en Telegram con un bot que lea feeds.

## Para quien mantiene el repositorio

- `web/generar.py` hace la web. Solo usa Python 3.11 o superior y lo que trae `web/vendor` ([markdown-it-py](https://github.com/executablebooks/markdown-it-py) y mdurl, licencia MIT): no instala nada.
- Probar en el PC: `python3 tests/probar.py`. Usa respuestas de GitHub guardadas en `tests/datos/` y las guías de prueba de `tests/datos/guias/`; también comprueba que las guías de `guias/` se generan.
- Ver la web en el PC sin GitHub: `python3 web/generar.py --salida _site --datos tests/datos/basico --enlaces _enlaces-prueba.json` y abrir `_site` con `python3 -m http.server -d _site`.
- `plantilla/` se copia tal cual: estilo, icono, imagen para compartir y fuentes.
- El workflow necesita permiso de escritura en el repositorio solo para guardar `datos/videos-proyectos.json`.
- Fuentes: Bricolage Grotesque y Atkinson Hyperlegible Next, con licencia SIL OFL (en `plantilla/fuentes/`). Van dentro de la web: no se cargan de Google ni de ningún otro sitio.
- Las acciones del workflow van fijadas por commit: checkout v7.0.1, upload-pages-artifact v5.0.0 y deploy-pages v5.0.1.
