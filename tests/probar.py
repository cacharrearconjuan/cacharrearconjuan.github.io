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


def generar(salida, datos="basico", ahora="2026-10-29", carpeta_datos=None):
    args = ["--salida", salida, "--datos", carpeta_datos or os.path.join(DATOS, datos), "--ahora", ahora]
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
        for malo in ("<script", "onerror", "javascript:", "alert("):
            comprobar(malo not in prueba, f"prueba: sin {malo}")
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
        comprobar(len(entradas) == 7 and len(set(ids)) == 7, f"feed: 7 entradas únicas ({len(entradas)})")
        comprobar(entradas[0].find("a:title", ns).text == "Lanzador de scrcpy v1.0.0", "feed: lo último primero")
        mapa = ET.fromstring(leer(salida, "sitemap.xml"))
        comprobar(len(mapa) == 6, "sitemap: 6 páginas")

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
        comprobar("Nuevo proyecto: Recien-Creado" in leer(salida, "feed.xml"), "repo vacío: entrada en el feed")
        # el catálogo externo cae: la web se genera igual
        os.remove(os.path.join(t, "d", "urls.json"))
        codigo, err = generar(salida, carpeta_datos=os.path.join(t, "d"))
        comprobar(codigo == 0 and "Aviso" in err, "catálogo caído: se genera con aviso")
        comprobar("Ahora mismo no se puede leer la lista" in leer(salida, "proyectos/mis-payloads-ps5/index.html"), "catálogo caído: mensaje")


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
    prueba_error()
    print(f"\n{hechas - len(fallos)} de {hechas} comprobaciones bien.")
    sys.exit(1 if fallos else 0)
