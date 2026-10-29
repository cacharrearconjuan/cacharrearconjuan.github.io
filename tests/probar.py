#!/usr/bin/env python3
"""Pruebas de la web con respuestas de GitHub guardadas. Solo biblioteca estándar.

    python3 tests/probar.py
"""

import copy
import io
import json
import os
import re
import shutil
import sys
import tempfile
import contextlib
import xml.etree.ElementTree as ET
from html.parser import HTMLParser

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(RAIZ, "web"))
import generar as g  # noqa: E402

DATOS = os.path.join(RAIZ, "tests", "datos")
U = "cacharrearconjuan"
fallos = []
hechas = 0


def comprobar(cond, texto):
    global hechas
    hechas += 1
    if not cond:
        fallos.append(texto)
        print("  FALLA:", texto)


def generar(salida, datos="basico", ahora="2026-10-29", carpeta_datos=None, guias=None, enlaces=None, sitio=None, notas=None):
    notas = notas or os.path.join(DATOS, "notas")
    args = ["--salida", salida, "--datos", carpeta_datos or os.path.join(DATOS, datos), "--ahora", ahora,
            "--guias", guias or os.path.join(DATOS, "guias"),
            "--enlaces", enlaces or os.path.join(os.path.dirname(salida), "enlaces.json")]
    if sitio:
        args += ["--sitio", sitio]
    args += ["--notas", notas]
    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()) as err:
        codigo = g.main(args)
    return codigo, err.getvalue()


def leer(base, ruta):
    with open(os.path.join(base, ruta), encoding="utf-8") as f:
        return f.read()


class Revisor(HTMLParser):
    """Cuenta ids, enlaces y etiquetas sin cerrar."""
    VACIAS = {"img", "br", "hr", "meta", "link", "source", "input"}
    OPCIONALES = {"p", "li", "tr", "td", "th", "thead", "tbody", "dt", "dd"}

    def __init__(self):
        super().__init__()
        self.ids, self.enlaces, self.pila, self.errores = [], [], [], []

    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        if "id" in d:
            self.ids.append(d["id"])
        for k in ("href", "src"):
            if d.get(k):
                self.enlaces.append(d[k])
        if tag not in self.VACIAS:
            self.pila.append(tag)

    def handle_endtag(self, tag):
        if tag in self.VACIAS:
            return
        while self.pila and self.pila[-1] != tag and self.pila[-1] in self.OPCIONALES:
            self.pila.pop()
        if self.pila and self.pila[-1] == tag:
            self.pila.pop()
        else:
            self.errores.append(f"</{tag}> sin abrir")


def revisar_html(texto):
    r = Revisor()
    r.feed(texto)
    r.close()
    return r


def paginas_html(base):
    for carpeta, _, ficheros in os.walk(base):
        for f in ficheros:
            if f.endswith(".html"):
                yield os.path.relpath(os.path.join(carpeta, f), base)


# ------------------------------------------------------------ unidades

def prueba_utilidades():
    print("Utilidades")
    comprobar(g.tamano_texto(90) == "90 B", "tamaño en bytes")
    comprobar(g.tamano_texto(31744) == "31 KB", "tamaño en KB")
    comprobar(g.tamano_texto(5_400_000) == "5,1 MB", "tamaño en MB con coma")
    comprobar(g.fecha_texto("2026-10-31T23:30:00Z") == "1 de noviembre de 2026", "fecha en hora de Madrid")
    comprobar(g.fecha_texto("2026-07-15T21:59:00Z") == "15 de julio de 2026", "fecha en verano (UTC+2)")
    usados = set()
    comprobar(g.slug_github("Qué hace", usados) == "qué-hace", "id con tilde")
    comprobar(g.slug_github("Qué hace", usados) == "qué-hace-1", "id repetido")
    comprobar(g.slug_github("Créditos y licencia!", set()) == "créditos-y-licencia", "id sin signos")
    comprobar(g.recortar("a " * 200, 20).endswith("…") and len(g.recortar("a " * 200, 20)) <= 21, "recortar")
    with tempfile.TemporaryDirectory() as t:
        with open(os.path.join(t, "Repo-X.md"), "w", encoding="utf-8") as f:
            f.write("---\ntitulo: Hola: mundo\n# comentario: fuera\nvideo: https://y/v\n"
                    "descarga: Manual | https://x/m.pdf\ndescarga: Mal sin barra\noculto: no\n---\n\nTexto.\n")
        datos, cuerpo = g.leer_nota(t, "repo-x")
        comprobar(datos.get("titulo") == "Hola: mundo", "nota: valor con dos puntos")
        comprobar("comentario" not in datos, "nota: comentarios fuera")
        comprobar(datos["descarga"] == [("Manual", "https://x/m.pdf")], "nota: descargas extra")
        comprobar(cuerpo == "Texto.", "nota: cuerpo")
        comprobar(g.leer_nota(t, "otro") == ({}, ""), "nota inexistente")
    arreglar = g.hacer_arreglar_url(U, "r", "main", "docs")
    comprobar(arreglar("javascript:alert(1)") is None, "javascript: fuera")
    comprobar(arreglar("data:text/html,x") is None, "data: fuera")
    comprobar(arreglar("a b.png", imagen=True) == f"https://raw.githubusercontent.com/{U}/r/main/docs/a%20b.png", "imagen relativa")
    comprobar(arreglar("/LICENSE") == f"https://github.com/{U}/r/blob/main/LICENSE", "enlace desde la raíz")
    comprobar(arreglar("x.md#y") == f"https://github.com/{U}/r/blob/main/docs/x.md#y", "enlace con ancla")
    comprobar(arreglar("//cdn.x/y") == "https://cdn.x/y", "enlace sin esquema")
    comprobar(g.elegir_release([{"draft": True, "tag_name": "a"}, {"prerelease": True, "tag_name": "b"},
                                {"tag_name": "c"}])["tag_name"] == "c", "release: estable antes que beta")
    comprobar(g.elegir_release([{"draft": True}]) is None, "release: solo borradores")


# ------------------------------------------------------------ web completa

def prueba_web():
    print("Web completa")
    with tempfile.TemporaryDirectory() as t:
        salida = os.path.join(t, "web")
        codigo, err = generar(salida)
        comprobar(codigo == 0, f"genera sin errores ({err.strip()})")
        if codigo:
            return
        portada = leer(salida, "index.html")
        orden = re.findall(r'href="proyectos/([^/]+)/"', portada)
        comprobar(orden == ["lanzador-scrcpy", "prueba-nueva", "ps5-autoupdaterpm", "mis-payloads-ps5"],
                  f"portada: proyectos y orden (sale {orden})")
        for fuera in ("un-fork", "archivado", "oculto-por-tema", f"{U}.github.io"):
            comprobar(f"proyectos/{fuera.lower()}/" not in portada and not os.path.exists(os.path.join(salida, "proyectos", fuera.lower())),
                      f"no sale {fuera}")
        for canal in ("https://www.youtube.com/@CacharrearconJuan", "https://www.youtube.com/@DirectoconJuan", "https://t.me/CacharrearconJuan"):
            comprobar(canal in portada, f"portada: canal {canal}")
        sellos = re.findall(r'proyectos/([^/]+)/">\s*<span class="chip-nombre">[^<]*</span>(<span class="sello">Nuevo</span>)?', portada)
        comprobar(dict(sellos) == {"lanzador-scrcpy": '<span class="sello">Nuevo</span>', "prueba-nueva": '<span class="sello">Nuevo</span>',
                                   "ps5-autoupdaterpm": "", "mis-payloads-ps5": ""}, f"sello Nuevo ({sellos})")
        comprobar("Repositorio de prueba con &lt;html&gt; &amp; enlaces raros" in portada, "portada: descripción escapada")
        comprobar("Resumen escrito en una nota de prueba." in portada, "notas: el resumen de la nota manda")
        comprobar("Mis payloads PS5" in portada, "sin README: nombre arreglado")
        comprobar(g.nombre_bonito("lanzador_scrcpy") == "Lanzador scrcpy" and g.nombre_bonito("micosa") == "micosa", "nombre arreglado: casos")

        # últimos vídeos
        vids = re.findall(r'href="https://www\.youtube\.com/watch\?v=([^"]+)" target="_blank" rel="noopener"', portada)
        comprobar(vids == ["vidCCCCCCCC", "vidBBBBBBBB", "vidAAAAAAAA"], f"vídeos: los 3 últimos, sin Shorts ({vids})")
        comprobar("shortAAAAAA" not in portada and "Vídeo viejo" not in portada, "vídeos: ni Shorts ni el cuarto")
        comprobar("Fire TV sin anuncios &amp; sin líos &lt;2026&gt;" in portada, "vídeos: título escapado")
        comprobar(os.path.exists(os.path.join(salida, "videos", "vidCCCCCCCC.jpg")) and
                  not os.path.exists(os.path.join(salida, "videos", "vidAAAAAAAA.jpg")), "vídeos: miniaturas propias")
        comprobar(portada.count('class="video-sin-imagen"') == 1, "vídeos: hueco si falta la miniatura")
        comprobar("i.ytimg.com" not in portada, "vídeos: sin imágenes de YouTube en la página")
        orden_secciones = [portada.find(f'id="{x}"') for x in ("proyectos", "videos", "canales")]
        comprobar(orden_secciones == sorted(orden_secciones) and -1 not in orden_secciones, "vídeos: entre proyectos y canales")
        comprobar("28 de octubre de 2026" in portada, "vídeos: fecha")

        # número de descargas (sin contar SHA256SUMS.txt)
        comprobar('<span class="chip-descargas">7 descargas</span>' in portada, "descargas: lanzador sin contar las sumas")
        comprobar('<span class="chip-descargas">42 descargas</span>' in portada, "descargas: PS5")
        comprobar("chip-descargas" not in portada.split('proyectos/prueba-nueva/', 1)[1].split("</li>", 1)[0], "descargas: con 0 no sale")

        # vídeo enlazado a su proyecto
        ps5v = leer(salida, "proyectos/ps5-autoupdaterpm/index.html")
        lanzv = leer(salida, "proyectos/lanzador-scrcpy/index.html")
        comprobar('href="https://www.youtube.com/watch?v=vidBBBBBBBB" target="_blank"' in ps5v and "Actualiza Payload Manager solo" in ps5v,
                  "vídeo: enlazado por el enlace al repo")
        comprobar("watch?v=vidAAAAAAAA" in lanzv and "vidZZZZZZZZ" not in lanzv, "vídeo: enlazado por la página de la web, gana el más nuevo")
        comprobar("Ver el vídeo" not in leer(salida, "proyectos/mis-payloads-ps5/index.html"), "vídeo: sin enlace no hay botón")
        enl = json.load(open(os.path.join(t, "enlaces.json"), encoding="utf-8"))
        comprobar(set(enl) == {"ps5-autoupdaterpm", "lanzador-scrcpy"}, f"vídeo: se guarda lo visto ({sorted(enl)})")

        # vista previa al compartir
        comprobar('<meta property="og:image" content="https://cacharrearconjuan.github.io/og.png">' in portada
                  and os.path.exists(os.path.join(salida, "og.png")), "vista previa: og.png")
        comprobar("goatcounter" not in portada, "visitas: sin código no hay contador")

        lanz = leer(salida, "proyectos/lanzador-scrcpy/index.html")
        comprobar(f"https://github.com/{U}/lanzador-scrcpy/releases/download/v1.0.0/Lanzador-scrcpy.bat" in lanz, "lanzador: .bat")
        comprobar("31 KB" in lanz and "SHA256SUMS.txt" in lanz, "lanzador: tamaño y sumas")
        comprobar('id="descarga-1"' in lanz and lanz.count('id="descarga"') == 1, "lanzador: ids sin choque con la caja")
        comprobar("<h1" in lanz and lanz.count("<h1") == 1, "lanzador: un solo h1")
        comprobar("Lanzador de scrcpy" in lanz.split("<h1", 1)[1][:200], "lanzador: título del README")
        comprobar('<table>' in lanz, "lanzador: tablas del README")

        ps5 = leer(salida, "proyectos/ps5-autoupdaterpm/index.html")
        comprobar("v3.1.0" in ps5 and "v9.9.9" not in ps5, "PS5: sin borradores")
        comprobar("Novedades de la v3.1.0" in ps5 and "99446e93" in ps5, "PS5: notas de la versión")
        comprobar("183 KB" in ps5, "PS5: tamaño")
        comprobar('<span class="sello">Beta</span>' not in ps5, "PS5: no es beta")

        prueba = leer(salida, "proyectos/prueba-nueva/index.html")
        contenido = prueba.split('<div class="texto">', 1)[1].split("</article>", 1)[0]
        for malo in ("<script", "onerror", "javascript:", "alert("):
            comprobar(malo not in contenido, f"prueba: sin {malo}")
        comprobar(prueba.count("<script") == 1 and "copiar-boton" in prueba, "prueba: solo el script de Copiar")
        comprobar("<script" not in leer(salida, "descargas/index.html"), "descargas: sin script (no hay código)")
        comprobar('<span class="sello">Beta</span>' in prueba, "prueba: beta marcada")
        comprobar(re.search(r"<details open>\s*<summary>Más</summary>", prueba) is not None, "prueba: details abierto")
        comprobar(f"https://raw.githubusercontent.com/{U}/prueba-nueva/main/docs/img/captura.png" in prueba, "prueba: imagen relativa")
        comprobar(f"https://github.com/{U}/prueba-nueva/blob/main/docs/scripts/a.sh" in prueba, "prueba: enlace relativo")
        comprobar(f"https://github.com/{U}/prueba-nueva/blob/main/otro.md" in prueba, "prueba: enlace ../")
        comprobar('id="qué-hace"' in prueba and 'id="qué-hace-1"' in prueba, "prueba: ids repetidos")
        comprobar("echo &quot;hola&quot; &amp; echo &lt;adios&gt;" in prueba or 'echo "hola" &amp; echo &lt;adios&gt;' in prueba, "prueba: código escapado")
        comprobar("Primer párrafo con código y negrita." in prueba.split('class="proyecto-resumen"', 1)[1][:200]
                  or "Repositorio de prueba" in prueba, "prueba: resumen")

        pay = leer(salida, "proyectos/mis-payloads-ps5/index.html")
        comprobar(pay.count('class="payload"') == 17, "payloads: los 17")
        comprobar(pay.count("https://cacharrearconjuan.github.io/mis-payloads-ps5/payloads.json") == 1, "payloads: dirección una sola vez")
        comprobar("Manage Sources" in pay, "payloads: texto de la nota")
        comprobar("17 payloads" in pay, "payloads: caja")

        desc = leer(salida, "descargas/index.html")
        comprobar(desc.count('class="descarga"') == 4, "descargas: 4 proyectos")
        comprobar("cosa con espacios.zip" in desc and "5,1 MB" in desc, "descargas: archivo de la beta")

        nf = leer(salida, "404.html")
        enl = revisar_html(nf).enlaces
        comprobar(all(e.startswith(("https://", "mailto:", "#")) for e in enl), f"404: enlaces absolutos ({[e for e in enl if not e.startswith('https://')]})")

        feed = ET.fromstring(leer(salida, "feed.xml"))
        ns = {"a": "http://www.w3.org/2005/Atom"}
        entradas = feed.findall("a:entry", ns)
        ids = [e.find("a:id", ns).text for e in entradas]
        comprobar(len(entradas) == 8 and len(set(ids)) == 8, f"feed: 8 entradas únicas ({len(entradas)})")
        comprobar(entradas[0].find("a:title", ns).text == "Lanzador de scrcpy v1.0.0", "feed: lo último primero")
        mapa = ET.fromstring(leer(salida, "sitemap.xml"))
        comprobar(len(mapa) == 7, "sitemap: 7 páginas")

        guia = leer(salida, "guias/guia-prueba/index.html")
        comprobar('href="guias/guia-prueba/"' in portada and 'id="guias"' in portada, "portada: sección de guías")
        comprobar("No sale" not in portada and not os.path.exists(os.path.join(salida, "guias", "oculta")), "guía oculta fuera")
        comprobar('<a href="#primer-paso">Primer paso</a>' in guia and '<a href="#segundo-paso-con-código">Segundo paso con código</a>' in guia,
                  "guía: índice de pasos")
        comprobar(re.search(r"(href|src)=\"\s*javascript:", guia, re.I) is None, "guía: ningún enlace javascript:")
        comprobar('href="../../descargas/"' in guia, "guía: enlace relativo intacto")
        comprobar("&lt;dos&gt;" in guia and "copiar-boton" in guia, "guía: código escapado y botón Copiar")
        comprobar('>Guías</a>' in portada.split("</header>", 1)[0], "menú: Guías")
        comprobar("2 apartados" in portada, "portada: número de apartados")

        for ruta in paginas_html(salida):
            r = revisar_html(leer(salida, ruta))
            comprobar(not r.errores and not r.pila, f"{ruta}: etiquetas equilibradas ({r.errores[:3]} {r.pila[:3]})")
            comprobar(len(r.ids) == len(set(r.ids)), f"{ruta}: ids únicos")
            if ruta == "404.html":
                continue
            base = os.path.dirname(os.path.join(salida, ruta))
            for e in r.enlaces:
                if re.match(r"^[a-z]+:", e) or e.startswith("#"):
                    continue
                destino = os.path.normpath(os.path.join(base, e.split("#")[0]))
                if e.split("#")[0].endswith("/") or e.split("#")[0] == "":
                    destino = os.path.join(destino, "index.html")
                comprobar(os.path.exists(destino), f"{ruta}: enlace interno {e}")
        css = leer(salida, "estilo.css")
        for fuente in re.findall(r'url\("([^"]+)"\)', css):
            comprobar(os.path.exists(os.path.join(salida, fuente)), f"fuente {fuente}")
        comprobar("googleapis" not in css and "gstatic" not in css, "sin fuentes de terceros")

        # misma entrada, misma web
        huella1 = leer(salida, "huella.txt")
        generar(salida)
        comprobar(leer(salida, "huella.txt") == huella1, "misma entrada, misma huella")
        generar(salida, ahora="2026-11-20")
        comprobar(leer(salida, "huella.txt") != huella1, "al caducar «Nuevo» cambia la huella")
        comprobar('class="sello">Nuevo' not in leer(salida, "index.html"), "sin «Nuevo» pasados 14 días")


def prueba_repo_nuevo():
    print("Repo nuevo sin nada")
    with tempfile.TemporaryDirectory() as t:
        with open(os.path.join(DATOS, "basico", "api.json"), encoding="utf-8") as f:
            api = json.load(f)
        clave = next(k for k in api if k.startswith(f"/users/{U}/repos"))
        nuevo = copy.deepcopy(api[clave][0])
        nuevo.update({"name": "Recien-Creado", "html_url": f"https://github.com/{U}/Recien-Creado",
                      "created_at": "2026-10-29T16:00:00Z", "pushed_at": "2026-10-29T16:00:00Z", "default_branch": "master"})
        api[clave].insert(0, nuevo)
        os.makedirs(os.path.join(t, "d"))
        with open(os.path.join(t, "d", "api.json"), "w", encoding="utf-8") as f:
            json.dump(api, f)
        shutil.copy(os.path.join(DATOS, "basico", "urls.json"), os.path.join(t, "d", "urls.json"))
        salida = os.path.join(t, "web")
        codigo, _ = generar(salida, carpeta_datos=os.path.join(t, "d"))
        comprobar(codigo == 0, "genera con un repo vacío")
        portada = leer(salida, "index.html")
        comprobar(re.findall(r'href="proyectos/([^/]+)/"', portada)[0] == "recien-creado", "el repo nuevo sale el primero")
        p = leer(salida, "proyectos/recien-creado/index.html")
        comprobar(f"https://github.com/{U}/Recien-Creado/archive/refs/heads/master.zip" in p, "repo vacío: zip del código")
        comprobar("aún no tiene explicación" in p, "repo vacío: aviso sin README")
        comprobar("recien-creado" not in leer(salida, "descargas/index.html"), "repo vacío: no sale en descargas")
        comprobar("Nuevo proyecto: Recien Creado" in leer(salida, "feed.xml"), "repo vacío: entrada en el feed")
        # el catálogo externo cae: la web se genera igual
        os.remove(os.path.join(t, "d", "urls.json"))
        codigo, err = generar(salida, carpeta_datos=os.path.join(t, "d"))
        comprobar(codigo == 0 and "Aviso" in err, "catálogo caído: se genera con aviso")
        comprobar("Ahora mismo no se puede leer la lista" in leer(salida, "proyectos/mis-payloads-ps5/index.html"), "catálogo caído: mensaje")


def prueba_guias():
    print("Guías")
    with tempfile.TemporaryDirectory() as t:
        salida = os.path.join(t, "web")
        codigo, err = generar(salida, guias=os.path.join(RAIZ, "guias"))
        comprobar(codigo == 0, f"las guías del repositorio se generan ({err.strip()})")
        vacia = os.path.join(t, "sin-guias")
        os.makedirs(vacia)
        generar(salida, guias=vacia)
        portada = leer(salida, "index.html")
        comprobar('id="guias"' not in portada and ">Guías</a>" not in portada, "sin guías no hay sección ni menú")
        mala = os.path.join(t, "mala")
        os.makedirs(mala)
        with open(os.path.join(mala, "x.md"), "w", encoding="utf-8") as f:
            f.write("---\nfecha: 29/10/2026\n---\nHola\n")
        codigo, err = generar(salida, guias=mala)
        comprobar(codigo == 1 and "AAAA-MM-DD" in err, "fecha mal escrita: error claro")


def prueba_enlaces_guardados():
    print("Vídeos guardados y contador de visitas")
    with tempfile.TemporaryDirectory() as t:
        enlaces = os.path.join(t, "enlaces.json")
        with open(enlaces, "w", encoding="utf-8") as f:
            json.dump({"prueba-nueva": {"id": "vidVIEJO123", "titulo": "Vídeo que ya no está en el feed", "fecha": "2026-01-01T00:00:00+00:00"}}, f)
        sitio = os.path.join(t, "sitio.json")
        with open(os.path.join(RAIZ, "sitio.json"), encoding="utf-8") as f:
            datos = json.load(f)
        datos["goatcounter"] = "mi-contador"
        with open(sitio, "w", encoding="utf-8") as f:
            json.dump(datos, f)
        salida = os.path.join(t, "web")
        codigo, _ = generar(salida, enlaces=enlaces, sitio=sitio)
        comprobar(codigo == 0, "genera con vídeos guardados")
        comprobar("watch?v=vidVIEJO123" in leer(salida, "proyectos/prueba-nueva/index.html"), "vídeo guardado: sigue saliendo")
        comprobar("prueba-nueva" in json.load(open(enlaces, encoding="utf-8")), "vídeo guardado: no se borra")
        portada = leer(salida, "index.html")
        comprobar('data-goatcounter="https://mi-contador.goatcounter.com/count"' in portada and "sin cookies" in portada, "visitas: contador y aviso")
        datos["goatcounter"] = "malo\"><script>"
        with open(sitio, "w", encoding="utf-8") as f:
            json.dump(datos, f)
        generar(salida, enlaces=enlaces, sitio=sitio)
        comprobar("goatcounter" not in leer(salida, "index.html"), "visitas: código raro, sin contador")
        # la nota manda sobre el vídeo detectado
        notas = os.path.join(t, "notas")
        os.makedirs(notas)
        with open(os.path.join(notas, "PS5-AutoupdaterPM.md"), "w", encoding="utf-8") as f:
            f.write("---\nvideo: https://www.youtube.com/watch?v=MANUAL12345\n---\n")
        generar(salida, enlaces=enlaces, notas=notas)
        ps5 = leer(salida, "proyectos/ps5-autoupdaterpm/index.html")
        comprobar("watch?v=MANUAL12345" in ps5 and "watch?v=vidBBBBBBBB" not in ps5.split('id="descarga"', 1)[1].split("</aside>", 1)[0],
                  "vídeo: el de la nota manda")


def prueba_videos_caidos():
    print("YouTube no responde")
    with tempfile.TemporaryDirectory() as t:
        d = os.path.join(t, "d")
        shutil.copytree(os.path.join(DATOS, "basico"), d)
        with open(os.path.join(d, "urls.json"), encoding="utf-8") as f:
            urls = json.load(f)
        urls = {k: v for k, v in urls.items() if "youtube.com" not in k}
        with open(os.path.join(d, "urls.json"), "w", encoding="utf-8") as f:
            json.dump(urls, f)
        salida = os.path.join(t, "web")
        codigo, err = generar(salida, carpeta_datos=d)
        portada = leer(salida, "index.html")
        comprobar(codigo == 0 and 'id="videos"' not in portada, "sin YouTube: la web sale sin vídeos")
        comprobar("Aviso" in err, "sin YouTube: avisa")


def prueba_error():
    print("GitHub falla")
    with tempfile.TemporaryDirectory() as t:
        salida = os.path.join(t, "web")
        os.makedirs(salida)
        with open(os.path.join(salida, "testigo"), "w") as f:
            f.write("x")
        codigo, err = generar(salida, datos="error")
        comprobar(codigo == 1 and "403" in err, "error de la API: sale con código 1")
        comprobar(os.path.exists(os.path.join(salida, "testigo")), "error de la API: no borra la web anterior")


if __name__ == "__main__":
    prueba_utilidades()
    prueba_web()
    prueba_repo_nuevo()
    prueba_guias()
    prueba_enlaces_guardados()
    prueba_videos_caidos()
    prueba_error()
    print(f"\n{hechas - len(fallos)} de {hechas} comprobaciones bien.")
    sys.exit(1 if fallos else 0)
