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
import subprocess
import sys
import tempfile
import contextlib
import xml.etree.ElementTree as ET
from html.parser import HTMLParser

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(RAIZ, "web"))
import generar as g  # noqa: E402
import datos_pc as dpc  # noqa: E402

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


def generar(salida, datos="basico", ahora="2026-10-29", carpeta_datos=None, guias=None, enlaces=None, sitio=None, notas=None,
            pc_datos=None):
    notas = notas or os.path.join(DATOS, "notas")
    args = ["--salida", salida, "--datos", carpeta_datos or os.path.join(DATOS, datos), "--ahora", ahora,
            "--guias", guias or os.path.join(DATOS, "guias"),
            "--enlaces", enlaces or os.path.join(os.path.dirname(salida), "enlaces.json")]
    if sitio:
        args += ["--sitio", sitio]
    if pc_datos:
        args += ["--pc-datos", pc_datos]
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
        comprobar(pay.count('class="payload-fecha"') == 17 and 'Actualizado el <time datetime="2026-10-19">19 de octubre de 2026</time>' in pay,
                  "payloads: la fecha de cada uno")
        fechas = "Actualizados el 29 de octubre de 2026 · analizados por última vez el 18 de noviembre de 2026, a las 9:02."
        comprobar(f'<p class="catalogo-fechas">{fechas}</p>' in pay, "payloads: cuándo se actualizó la lista y cuándo se analizó (hora de Madrid)")

        desc = leer(salida, "descargas/index.html")
        comprobar(desc.count('class="descarga"') == 4, "descargas: 4 proyectos")
        comprobar(f"17 payloads para Payload Manager. {fechas}" in desc, "descargas: los payloads con sus dos fechas")
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
        comprobar(len(mapa) == 8, "sitemap: 8 páginas")

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
            texto = leer(salida, ruta)
            comprobar(texto.count('class="enlace-pc"') == 1 and "¿Qué le va a mi PC?" in texto.split("</header>", 1)[0],
                      f"{ruta}: enlace a la herramienta del PC arriba")
            r = revisar_html(texto)
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


# ------------------------------------------------------------ ¿Qué le va a mi PC?

OPENDB = os.path.join(DATOS, "opendb")


def prueba_pc_web():
    print("¿Qué le va a mi PC? en la web")
    with tempfile.TemporaryDirectory() as t:
        salida = os.path.join(t, "web")
        codigo, err = generar(salida)
        comprobar(codigo == 0, f"genera con la herramienta ({err.strip()[:200]})")
        if codigo:
            return
        portada = leer(salida, "index.html")
        cab = portada.split("</header>", 1)[0]
        comprobar('<div class="cabecera-izquierda">' in cab and cab.index('class="marca"') < cab.index('class="enlace-pc"') < cab.index("<nav"),
                  "portada: el enlace va arriba a la izquierda, junto al nombre")
        comprobar('<a class="enlace-pc" href="pc/">' in portada, "portada: enlace relativo a pc/")
        comprobar('<a class="enlace-pc" href="../../pc/">' in leer(salida, "proyectos/lanzador-scrcpy/index.html"), "proyecto: enlace a ../../pc/")
        comprobar('href="https://cacharrearconjuan.github.io/pc/"' in leer(salida, "404.html"), "404: enlace absoluto a la herramienta")
        comprobar('id="proyectos"' in portada and 'href="proyectos/lanzador-scrcpy/"' in portada, "la portada sigue en su sitio")
        pc = leer(salida, "pc/index.html")
        comprobar("<title>¿Qué le va a mi PC? | Cacharrear con Juan</title>" in pc, "pc: título")
        comprobar('<link rel="canonical" href="https://cacharrearconjuan.github.io/pc/">' in pc, "pc: dirección canónica")
        comprobar('<a class="enlace-pc" href="../pc/" aria-current="page">' in pc, "pc: el enlace marcado como página actual")
        comprobar('id="pc-app"' in pc and pc.index('src="logica.js"') < pc.index('src="app.js"'), "pc: contenedor y scripts en orden")
        comprobar("BuildCores OpenDB" in pc and "CC BY-NC-SA 4.0" in pc, "pc: créditos y licencia sin necesidad de JavaScript")
        for f in g.ARCHIVOS_PC:
            comprobar(os.path.exists(os.path.join(salida, "pc", f)), f"pc: copia {f}")
        for f in g.DATOS_PC:
            ruta = os.path.join(salida, "pc", "datos", f)
            try:
                with open(ruta, encoding="utf-8") as fh:
                    datos = json.load(fh)
                bien = "campos" in datos and len(datos["datos"]) > 10 if f != "meta.json" else datos.get("licencia") == "CC BY-NC-SA 4.0"
            except (OSError, ValueError):
                bien = False
            comprobar(bien, f"pc: datos {f}")
        comprobar("https://cacharrearconjuan.github.io/pc/" in leer(salida, "sitemap.xml"), "sitemap: /pc/")
        comprobar("<script" not in leer(salida, "descargas/index.html"), "descargas: sigue sin scripts")
        # sin las piezas, error claro y no se borra la web anterior
        huella = leer(salida, "huella.txt")
        codigo, err = generar(salida, pc_datos=os.path.join(t, "no-existe"))
        comprobar(codigo == 1 and "datos del PC" in err, "sin piezas del PC: error claro")
        comprobar(leer(salida, "huella.txt") == huella, "sin piezas del PC: la web anterior se queda")
        roto = os.path.join(t, "roto")
        shutil.copytree(os.path.join(RAIZ, "datos-pc"), roto)
        with open(os.path.join(roto, "cpu.json"), "w", encoding="utf-8") as f:
            f.write("{roto")
        codigo, err = generar(salida, pc_datos=roto)
        comprobar(codigo == 1 and "no es un JSON" in err, "piezas rotas: error claro")


def leer_tabla(ruta):
    with open(ruta, encoding="utf-8") as f:
        d = json.load(f)
    return {r[0]: dict(zip(d["campos"], r)) for r in d["datos"]}


def prueba_datos_pc():
    print("Piezas desde BuildCores (datos_pc.py)")
    with tempfile.TemporaryDirectory() as t:
        salida = os.path.join(t, "datos")
        reglas = os.path.join(RAIZ, "pc", "reglas.json")
        with contextlib.redirect_stdout(io.StringIO()):
            codigo = dpc.main(["--opendb", OPENDB, "--salida", salida, "--reglas", reglas, "--correcciones", ""])
        comprobar(codigo == 0, "convierte la copia de prueba")
        cpus = leer_tabla(os.path.join(salida, "cpu.json"))
        comprobar(set(cpus) == {"ryzen-5-7500f", "core-i5-12400f", "core-i5-12400", "ryzen-5-5600g", "ryzen-7-5700",
                                "core-ultra-7-270k-plus", "celeron-g3930", "ryzen-5-3600", "core-i9-14900k", "core-ultra-5-999x"},
                  f"cpu: los que tocan, sin Xeon, EPYC ni AM3+ ({sorted(cpus)})")
        c = cpus.get("ryzen-5-7500f", {})
        comprobar(c.get("nombre") == "AMD Ryzen 5 7500F" and c.get("familia") == "raphael" and c.get("igpu") is False,
                  "cpu: 7500F limpio («™» y OEM fuera), sin gráfica aunque la ficha diga «0»")
        comprobar(cpus.get("ryzen-5-3600", {}).get("nombre") == "AMD Ryzen 5 3600", "cpu: «3600 OEM/Tray» se queda en 3600")
        comprobar(cpus.get("core-i5-12400f", {}).get("igpu") is False and cpus.get("core-i5-12400", {}).get("igpu_modelo") == "Intel UHD Graphics 730",
                  "cpu: la F sin gráfica; «UHD 730» arreglado")
        comprobar(cpus.get("ryzen-5-5600g", {}).get("familia") == "cezanne" and cpus.get("ryzen-7-5700", {}).get("familia") == "cezanne"
                  and cpus["ryzen-7-5700"]["igpu"] is False, "cpu: 5600G y 5700 son Cezanne; el 5700, sin gráfica")
        comprobar(cpus.get("core-ultra-7-270k-plus", {}).get("familia") == "arrow_r", "cpu: los Plus son Arrow Lake Refresh")
        comprobar(cpus.get("celeron-g3930", {}).get("familia") == "kaby", "cpu: Celeron G3930 es Kaby Lake")
        comprobar(cpus.get("core-i9-14900k", {}).get("zocalo") == "LGA 1700", "cpu: zócalo mal en la ficha, manda la familia")
        nuevo = cpus.get("core-ultra-5-999x", {})
        comprobar(nuevo.get("zocalo") == "LGA 1954" and nuevo.get("familia") is None, "cpu: zócalo nuevo entra solo, sin familia")

        placas = {p["nombre"]: p for p in leer_tabla(os.path.join(salida, "placas.json")).values()}
        comprobar(set(placas) == {"MSI MAG B550 TOMAHAWK", "MSI Z270 MORTAR DDR4 Micro ATX", "Gigabyte B450 AORUS ELITE",
                                  "ASRock B365M Pro4 DDR4", "ASUS PRIME Z990-P", "ASUS TUF GAMING X570-PLUS"},
                  f"placas: sin servidor ni AM3+, con el fabricante delante ({sorted(placas)})")
        b550 = placas.get("MSI MAG B550 TOMAHAWK", {})
        comprobar(b550.get("m2") == [["2242,2260,2280,22110", 4, 4, "p"], ["2242,2260,2280", 3, 4, "ps"]],
                  f"placas: huecos M.2 leídos, «2242-2280» incluye 2260 y sin el de Wi-Fi ({b550.get('m2')})")
        comprobar(b550.get("revisada") == "2026-04-27" and b550.get("flashback") is True and b550.get("video") == ["HDMI", "DisplayPort"],
                  "placas: revisada, Flashback y salidas de vídeo")
        comprobar(placas.get("MSI Z270 MORTAR DDR4 Micro ATX", {}).get("m2_nota") == "plantilla", "placas: M.2 de plantilla fuera")
        comprobar(placas.get("Gigabyte B450 AORUS ELITE", {}).get("m2_nota") == "imposible", "placas: PCIe 4.0 en una B450, fuera")
        b365 = placas.get("ASRock B365M Pro4 DDR4", {})
        comprobar(b365.get("zocalo") == "LGA 1151" and b365.get("ram") == "DDR4" and b365.get("m2_nota") == "sin_datos",
                  "placas: 1151v2 es 1151 y el DDR4 del nombre manda")
        comprobar(placas.get("ASUS TUF GAMING X570-PLUS", {}).get("chipset") == "X570"
                  and placas["ASUS TUF GAMING X570-PLUS"]["m2"][1][3] == "s", "placas: «570X» es X570; hueco solo SATA")
        comprobar(placas.get("ASUS PRIME Z990-P", {}).get("zocalo") == "LGA 1954", "placas: zócalo nuevo entra solo")

        ram = {r["nombre"]: r for r in leer_tabla(os.path.join(salida, "ram.json")).values()}
        comprobar(len(ram) == 3, f"ram: sin SO-DIMM, DDR3 ni ECC ({sorted(ram)})")
        z5 = ram.get("G.Skill Trident Z5 Neo DDR5-6000 CL30 32GB (2x16GB)", {})
        comprobar(z5.get("tipo") == "DDR5" and z5.get("velocidad") == 6000 and z5.get("cl") == 30 and z5.get("modulos") == 2
                  and z5.get("gb") == 16 and z5.get("perfil") == "XMP+EXPO", "ram: kit DDR5 bien leído")
        ssd = {x["nombre"]: x for x in leer_tabla(os.path.join(salida, "ssd.json")).values()}
        comprobar(len(ssd) == 4 and not any("2.5" in n for n in ssd), "ssd: solo M.2")
        comprobar(ssd.get("Crucial MX500 1TB M.2-2280 SATA", {}).get("protocolo") == "sata"
                  and ssd.get("Crucial T705 2TB M.2-2280 PCIe 5.0 X4 NVME", {}).get("gen") == 5
                  and ssd.get("WD Black SN770M 1TB M.2-2230 PCIe 4.0 X4 NVME", {}).get("largo") == "2230", "ssd: SATA, PCIe 5.0 y 2230")
        with open(os.path.join(salida, "meta.json"), encoding="utf-8") as f:
            meta = json.load(f)
        comprobar(meta["licencia"] == "CC BY-NC-SA 4.0" and meta["piezas"] == {"cpu": 10, "placas": 6, "ram": 3, "ssd": 4, "graficas": 3,
                                                                                "fuentes": 2, "cajas": 2, "disipadores": 3},
                  f"meta: licencia y cuentas ({meta['piezas']})")

        # gráficas: la ficha más completa de cada nombre, sin medidas imposibles ni «conectores a cero»
        gpus = {x["nombre"]: x for x in leer_tabla(os.path.join(salida, "graficas.json")).values()}
        comprobar(set(gpus) == {"Asus DUAL GeForce RTX 4060 8GB", "Gigabyte AORUS MASTER GeForce RTX 4090 24GB GDDR6X",
                                "Sapphire PULSE Radeon RX 6500 XT 4GB"}, f"gráficas: sin la que no tiene chip ({sorted(gpus)})")
        g4060 = gpus.get("Asus DUAL GeForce RTX 4060 8GB", {})
        comprobar(g4060.get("largo") == 227 and g4060.get("ranuras") == 2.5 and g4060.get("conectores") == [0, 1, 0]
                  and g4060.get("amazon") == "B0C7W1HNNX" and g4060.get("pcie") is None,
                  f"gráficas: de dos fichas iguales, la completa (con el código de Amazon de la otra) ({g4060})")
        g4090 = gpus.get("Gigabyte AORUS MASTER GeForce RTX 4090 24GB GDDR6X", {})
        comprobar(g4090.get("conectores") == [0, 0, 1] and g4090.get("pcie") == [4, 16] and g4090.get("chip") == "GeForce RTX 4090",
                  "gráficas: 16 pines e interfaz con versión y carriles")
        g6500 = gpus.get("Sapphire PULSE Radeon RX 6500 XT 4GB", {})
        comprobar(g6500.get("conectores") is None and g6500.get("largo") is None and g6500.get("pcie") == [4, 4],
                  "gráficas: conectores a cero y largo 0, sin dato")
        fuentes = {x["nombre"]: x for x in leer_tabla(os.path.join(salida, "fuentes.json")).values()}
        comprobar(set(fuentes) == {"Corsair RM750e 750W 80+ Gold Fully Modular ATX", "Montech APX 750W Non-Modular"},
                  f"fuentes: sin la de 0 W ({sorted(fuentes)})")
        rm = fuentes.get("Corsair RM750e 750W 80+ Gold Fully Modular ATX", {})
        comprobar(rm.get("vatios") == 750 and rm.get("pcie") == [3, 1] and rm.get("formato") == "ATX" and rm.get("modular") == "total"
                  and rm.get("eficiencia") == "80+ Gold" and rm.get("amazon") == "B0CGXRYNDK", f"fuentes: bien leída ({rm})")
        apx = fuentes.get("Montech APX 750W Non-Modular", {})
        comprobar(apx.get("pcie") is None and apx.get("formato") is None and apx.get("largo") is None and apx.get("eficiencia") is None,
                  "fuentes: conectores a cero, formato «Mini-ITX» y largo 0, sin dato")
        cajas = {x["nombre"]: x for x in leer_tabla(os.path.join(salida, "cajas.json")).values()}
        comprobar(set(cajas) == {"Lian Li LANCOOL 216 ATX Mid Tower Black", "Genérica Caja Micro con fuente"}, f"cajas: sin la que no tiene formatos ({sorted(cajas)})")
        lc = cajas.get("Lian Li LANCOOL 216 ATX Mid Tower Black", {})
        comprobar(lc.get("placas") == ["Mini-ITX", "Micro ATX", "ATX", "EATX"] and lc.get("psu") == ["ATX"] and lc.get("gpu_max") == 392
                  and lc.get("disipador_max") == 180 and lc.get("psu_max") is None and lc.get("ranuras") == 7 and lc.get("incluida") is None,
                  f"cajas: bien leída, largo de fuente 0 sin dato ({lc})")
        mc = cajas.get("Genérica Caja Micro con fuente", {})
        comprobar(mc.get("incluida") == 500 and mc.get("gpu_max") is None and mc.get("ranuras") is None and mc.get("psu") is None,
                  "cajas: con fuente de 500 W; 0 mm y 0 ranuras, sin dato")
        dis = {x["nombre"]: x for x in leer_tabla(os.path.join(salida, "disipadores.json")).values()}
        comprobar(set(dis) == {"Thermalright Peerless Assassin 120 SE 66.17 CFM CPU Cooler", "ARCTIC Liquid Freezer III 360 A-RGB 48.82 CFM Water 360mm Black",
                               "Otro Disipador 1151v2"}, f"disipadores: sin el que solo vale para zócalos viejos ({sorted(dis)})")
        pa = dis.get("Thermalright Peerless Assassin 120 SE 66.17 CFM CPU Cooler", {})
        comprobar(pa.get("zocalos") == ["AM5", "AM4", "LGA 1851", "LGA 1700", "LGA 1200", "LGA 1151", "LGA 115x"] and pa.get("alto") == 155
                  and pa.get("liquida") == 0 and pa.get("radiador") is None, f"disipadores: zócalos en orden y 1150 como 115x ({pa})")
        lf = dis.get("ARCTIC Liquid Freezer III 360 A-RGB 48.82 CFM Water 360mm Black", {})
        comprobar(lf.get("liquida") == 1 and lf.get("radiador") == 360 and lf.get("alto") is None, "disipadores: líquida, con radiador y sin altura")
        comprobar(dis.get("Otro Disipador 1151v2", {}).get("zocalos") == ["LGA 1151"] and dis["Otro Disipador 1151v2"]["alto"] is None,
                  "disipadores: 1151v2 es 1151; altura 0, sin dato")
        comprobar(all(p.get("x16") is None for p in placas.values()), "placas: sin ranuras en la ficha, x16 sin dato")
        with open(os.path.join(OPENDB, "open-db", "Motherboard", "p1.json"), encoding="utf-8") as f:
            base_x16 = json.load(f)
        reglas_plat = dpc.leer_reglas(reglas)
        con = dict(base_x16, pcie_slots=[{"gen": "4.0", "lanes": 16, "quantity": 1}, {"gen": "3.0", "lanes": 1, "quantity": 2}])
        sin = dict(base_x16, pcie_slots=[{"gen": "3.0", "lanes": 1, "quantity": 2}])
        comprobar(dpc.preparar_placas([con], reglas_plat, dpc.Avisos())[0]["x16"] == 1
                  and dpc.preparar_placas([sin], reglas_plat, dpc.Avisos())[0]["x16"] == 0, "placas: con ranura x16 (1) y sin ella (0)")

        # salidas de vídeo: las que hay, ninguna (solo si BuildCores lo confirma) o no se sabe
        comprobar(dpc.salidas_video({"back_panel_ports": ["1x HDMI port", "1x Display port", "2x USB 2.0"]}) == ["HDMI", "DisplayPort"],
                  "vídeo: salidas leídas de los puertos")
        lista_sin_video = ["2 x USB 10Gbps ports", "2 x USB 5Gbps ports", "4 x USB 2.0 ports", "1 x Wi-Fi Module",
                           "1 x Realtek 2.5Gb Ethernet port", "3 x Audio jacks"]
        comprobar(dpc.salidas_video({"back_panel_ports": lista_sin_video}) is None,
                  "vídeo: si la lista no trae ninguna, no se sabe (la B650M-AYW WIFI sí tiene HDMI)")
        comprobar(dpc.salidas_video({"display_outputs": [{"connector": "usb_c", "video_signal": "displayport", "graphics_route": "discrete"}],
                                     "back_panel_ports": ["2 x Thunderbolt 4 USB Type-C port(s)"]}) == [],
                  "vídeo: el USB-C que saca la imagen de la tarjeta no vale para la integrada")
        comprobar(dpc.salidas_video({"display_outputs": [{"connector": "hdmi", "graphics_route": "integrated"},
                                                         {"connector": "usb_c", "video_signal": "displayport", "graphics_route": "integrated"}]})
                  == ["HDMI", "USB-C"], "vídeo: mandan las salidas confirmadas")
        # Amazon.es: solo el código que BuildCores da por comprobado
        anuncios = {"identifiers": {"retailer_listings": [
            {"source": "amazon", "channel": "us", "source_product_id": "B000000US1", "verified": True},
            {"source": "amazon", "channel": "es", "source_product_id": "B09VCHR1VH", "verified": True}]}}
        comprobar(dpc.asin_es(anuncios) == "B09VCHR1VH", "amazon: el código de España")
        anuncios["identifiers"]["retailer_listings"][1]["verified"] = False
        comprobar(dpc.asin_es(anuncios) == "", "amazon: sin comprobar, nada")
        comprobar(dpc.asin_es({}) == "", "amazon: sin anuncios, nada")

        # listas de M.2 repetidas: con cuatro o más, son la mitad; con dos iguales, se quedan
        with open(os.path.join(OPENDB, "open-db", "Motherboard", "p1.json"), encoding="utf-8") as f:
            base = json.load(f)
        a = {"size": "2280", "key": "M", "interface": "PCIe 4.0 x4"}
        b = {"size": "22110", "key": "M", "interface": "PCIe 3.0 x4"}
        repetida = dict(base, opendb_id="r1", metadata=dict(base["metadata"], name="Prueba Repetida"), m2_slots=[a, b, a, b])
        doble = dict(base, opendb_id="r2", metadata=dict(base["metadata"], name="Prueba Doble"), m2_slots=[a, a])
        av = dpc.Avisos()
        hechas = {x["nombre"]: x for x in dpc.preparar_placas([repetida, doble], json.load(open(reglas, encoding="utf-8"))["plataformas"], av)}
        rep = next((x for n, x in hechas.items() if n.endswith("Repetida")), {})
        dob = next((x for n, x in hechas.items() if n.endswith("Doble")), {})
        comprobar(len(rep.get("m2") or []) == 2 and len(dob.get("m2") or []) == 2, f"M.2 repetidos: 4 → 2, y 2 iguales se quedan ({rep.get('m2')}, {dob.get('m2')})")

        # placas revisadas a mano: mandan sobre BuildCores, y avisa si una ya no está
        corr = os.path.join(t, "correcciones.json")
        with open(corr, "w", encoding="utf-8") as f:
            json.dump({"placas": [
                {"nombre": "MSI MAG B550 TOMAHAWK", "fuente": "https://www.msi.com/x", "m2": [["2280", 4, 4, "ps"]],
                 "video": [], "flashback": True, "notas_m2": ["Nota de prueba."], "notas_grafica": ["Ranura de prueba."]},
                {"nombre": "Placa que ya no existe", "fuente": "https://example.com", "flashback": True}],
                "graficas": [{"nombre": "Sapphire PULSE Radeon RX 6500 XT 4GB", "fuente": "https://www.sapphiretech.com/x",
                              "largo": 194, "conectores": [1, 0, 0]}],
                "fuentes": [{"nombre": "Montech APX 750W Non-Modular", "fuente": "https://www.montech.com/x", "pcie": [4, 0], "formato": "ATX"}],
                "cajas": [{"nombre": "Lian Li LANCOOL 216 ATX Mid Tower Black", "fuente": "https://lian-li.com/x", "disipador_max": 180, "psu_max": 220}],
                "disipadores": [{"nombre": "Otro Disipador 1151v2", "fuente": "https://example.com/d", "alto": 150}]}, f)
        salida2 = os.path.join(t, "datos2")
        with contextlib.redirect_stdout(io.StringIO()):
            dpc.main(["--opendb", OPENDB, "--salida", salida2, "--reglas", reglas, "--correcciones", corr])
        placas2 = {p["nombre"]: p for p in leer_tabla(os.path.join(salida2, "placas.json")).values()}
        b5 = placas2.get("MSI MAG B550 TOMAHAWK", {})
        comprobar(b5.get("m2") == [["2280", 4, 4, "ps"]] and b5.get("video") == [] and b5.get("notas_m2") == ["Nota de prueba."]
                  and b5.get("fuente") == "https://www.msi.com/x" and b5.get("m2_nota") == "", "correcciones: mandan sobre la ficha")
        with open(os.path.join(salida2, "meta.json"), encoding="utf-8") as f:
            avisos2 = json.load(f)["avisos"]
        comprobar(avisos2.get("placa: corregida a mano con la ficha del fabricante") == 1
                  and any("ya no está" in k for k in avisos2), f"correcciones: cuenta las hechas y avisa de las que no casan ({avisos2})")
        comprobar(b5.get("notas_grafica") == ["Ranura de prueba."], "correcciones: notas de la ranura de la gráfica")
        g2 = {x["nombre"]: x for x in leer_tabla(os.path.join(salida2, "graficas.json")).values()}.get("Sapphire PULSE Radeon RX 6500 XT 4GB", {})
        f2 = {x["nombre"]: x for x in leer_tabla(os.path.join(salida2, "fuentes.json")).values()}.get("Montech APX 750W Non-Modular", {})
        k2 = {x["nombre"]: x for x in leer_tabla(os.path.join(salida2, "cajas.json")).values()}.get("Lian Li LANCOOL 216 ATX Mid Tower Black", {})
        d2 = {x["nombre"]: x for x in leer_tabla(os.path.join(salida2, "disipadores.json")).values()}.get("Otro Disipador 1151v2", {})
        comprobar(g2.get("largo") == 194 and g2.get("conectores") == [1, 0, 0] and g2.get("fuente") == "https://www.sapphiretech.com/x"
                  and f2.get("pcie") == [4, 0] and f2.get("formato") == "ATX" and k2.get("disipador_max") == 180 and k2.get("psu_max") == 220
                  and d2.get("alto") == 150 and d2.get("fuente") == "https://example.com/d",
                  "correcciones: también gráficas, fuentes, cajas y disipadores")
        comprobar(all(avisos2.get(f"{p}: corregida a mano con la ficha del fabricante") == 1 for p in ("gráfica", "fuente", "caja", "disipador")),
                  "correcciones: cuenta las de cada tipo")

        av = dpc.Avisos()
        raros = {x["nombre"]: x for x in dpc.preparar_ssd([
            {"opendb_id": "a", "form_factor": "M.2-2280", "interface": "M.2 PCIe 4.0 x8", "capacity": 1000,
             "metadata": {"name": "Raro 1TB SSD", "manufacturer": "Raro"}},
            {"opendb_id": "b", "form_factor": "M.2-2280", "interface": "M.2 PCIe 4.0 x4", "capacity": 1000,
             "metadata": {"name": "Samsung 990 Pro w/Heatsink 1TB", "manufacturer": "Samsung"}}], av)}
        comprobar(raros.get("Raro 1TB SSD", {}).get("gen") == 0 and raros["Raro 1TB SSD"]["carriles"] == 0,
                  "ssd: x8 es imposible en M.2, así que velocidad sin dato")
        comprobar(raros.get("Samsung 990 Pro w/Heatsink 1TB", {}).get("disipador") == 1 and raros["Raro 1TB SSD"]["disipador"] == 0,
                  "ssd: el disipador sale del nombre")

        # misma entrada, mismos archivos
        antes = {f: open(os.path.join(salida, f), "rb").read() for f in os.listdir(salida)}
        with contextlib.redirect_stdout(io.StringIO()):
            dpc.main(["--opendb", OPENDB, "--salida", salida, "--reglas", reglas, "--correcciones", ""])
        comprobar(antes == {f: open(os.path.join(salida, f), "rb").read() for f in os.listdir(salida)}, "misma entrada, mismos datos")

        # si de repente salen muchas menos piezas, no se toca nada
        anterior = os.path.join(t, "anterior")
        os.makedirs(anterior)
        with open(os.path.join(anterior, "meta.json"), "w", encoding="utf-8") as f:
            json.dump({"piezas": {"cpu": 100, "placas": 6, "ram": 3, "ssd": 4}}, f)
        otra = os.path.join(t, "otra")
        try:
            with contextlib.redirect_stdout(io.StringIO()):
                dpc.main(["--opendb", OPENDB, "--salida", otra, "--reglas", reglas, "--anterior", anterior])
            paro = False
        except SystemExit as e:
            paro = "antes había 100" in str(e)
        comprobar(paro and not os.path.exists(otra), "caída de piezas: para y no escribe nada")
        try:
            dpc.main(["--opendb", os.path.join(t, "nada"), "--salida", otra])
            paro = False
        except SystemExit as e:
            paro = "No encuentro" in str(e)
        comprobar(paro, "sin copia de BuildCores: error claro")

    # las piezas del repositorio son las que saldrían de esta versión del conversor (formato al día)
    with open(os.path.join(RAIZ, "datos-pc", "placas.json"), encoding="utf-8") as f:
        campos = json.load(f)["campos"]
    comprobar(campos == dpc.CAMPOS["placas"], "datos-pc/: mismo formato que el conversor")
    with open(os.path.join(RAIZ, "datos-pc", "ssd.json"), encoding="utf-8") as f:
        comprobar(json.load(f)["campos"] == dpc.CAMPOS["ssd"], "datos-pc/: SSD con el formato del conversor")


def prueba_logica_pc():
    print("Lógica del PC (Node)")
    node = shutil.which("node")
    if not node:
        print("  (sin Node: no se prueba la lógica de la página)")
        return
    r = subprocess.run([node, os.path.join(RAIZ, "tests", "probar_pc.js")], capture_output=True, text=True, timeout=120)
    resumen = (r.stdout.strip().splitlines() or [""])[-1]
    fallas = [l for l in r.stdout.splitlines() if "FALLA" in l]
    for l in fallas:
        print(l)
    comprobar(r.returncode == 0, f"lógica del PC: {resumen} {r.stderr.strip()[:300]}")


if __name__ == "__main__":
    prueba_utilidades()
    prueba_web()
    prueba_repo_nuevo()
    prueba_guias()
    prueba_enlaces_guardados()
    prueba_videos_caidos()
    prueba_error()
    prueba_pc_web()
    prueba_datos_pc()
    prueba_logica_pc()
    print(f"\n{hechas - len(fallos)} de {hechas} comprobaciones bien.")
    sys.exit(1 if fallos else 0)
