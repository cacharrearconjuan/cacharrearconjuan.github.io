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

- **Título:** el primer encabezado `#` del README. Si no hay, el nombre del repositorio.
- **Resumen:** la descripción del repositorio (el apartado **About** de GitHub). Si está vacía, el primer párrafo del README.
- **Texto:** el README entero, con sus enlaces e imágenes arreglados para que funcionen fuera de GitHub.
- **Descarga:** los archivos de la última release. Si solo hay betas, la beta, marcada. Los borradores no salen nunca. Sin releases, el zip del código.
- **Novedades:** las notas de la última release.
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
| `video` | Pone un botón «Ver el vídeo» en la caja de descarga. |
| `descarga` | Añade un botón de descarga más. Se puede repetir. Formato: `Texto \| dirección`. |
| `catalogo` | Dirección de un `payloads.json` de Payload Manager: enseña la lista de payloads. |
| `orden` | Fija el proyecto arriba: `1` va antes que `2`, y los dos antes que los que no tienen orden. |
| `oculto` | Con `si`, el proyecto no sale en la web. |

Las líneas que empiezan por `#` dentro de la cabecera no cuentan: sirven para dejar campos preparados, como el `# video:` de las notas que ya hay.

## Que un repositorio no salga

Cualquiera de estas tres:

- Ponle el tema **`no-web`** en GitHub (**About → Topics**).
- Añade su nombre a `"ocultar"` en `sitio.json`.
- Crea su nota con `oculto: si`.

Nunca salen los repositorios privados, los forks, los archivados ni este mismo.

## Cambiar los textos o los canales

En `sitio.json`: el título, la frase de la portada, la dirección de la web y los canales (texto, detalle y enlace).

## El feed

En `https://cacharrearconjuan.github.io/feed.xml` hay un feed Atom con cada proyecto nuevo y cada versión nueva. Vale para cualquier lector de feeds y para avisar en Telegram con un bot que lea feeds.

## Para quien mantiene el repositorio

- `web/generar.py` hace la web. Solo usa Python 3.11 o superior y lo que trae `web/vendor` ([markdown-it-py](https://github.com/executablebooks/markdown-it-py) y mdurl, licencia MIT): no instala nada.
- Probar en el PC: `python3 tests/probar.py`. Usa respuestas de GitHub guardadas en `tests/datos/`.
- Ver la web en el PC sin GitHub: `python3 web/generar.py --salida _site --datos tests/datos/basico` y abrir `_site` con `python3 -m http.server -d _site`.
- `plantilla/` se copia tal cual: estilo, icono y fuentes.
- Fuentes: Bricolage Grotesque y Atkinson Hyperlegible Next, con licencia SIL OFL (en `plantilla/fuentes/`). Van dentro de la web: no se cargan de Google ni de ningún otro sitio.
- Las acciones del workflow van fijadas por commit: checkout v7.0.1, upload-pages-artifact v5.0.0 y deploy-pages v5.0.1.
