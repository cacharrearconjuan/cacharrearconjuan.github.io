#!/usr/bin/env python3
"""Genera la web a partir de los repositorios públicos de GitHub.

Uso:
    python3 web/generar.py --salida _site
    python3 web/generar.py --salida _site --datos tests/datos/basico --ahora 2026-10-29

Sin --datos lee la API de GitHub (con GITHUB_TOKEN si está definido).
Con --datos lee respuestas guardadas en una carpeta (para las pruebas).

Solo usa la biblioteca estándar de Python y el renderizador de Markdown
que va incluido en web/vendor (markdown-it-py, licencia MIT).
"""

import argparse
import base64
import datetime as dt
import hashlib
import html
import json
import os
import posixpath
import re
import shutil
import sys
import urllib.error
import urllib.parse
import urllib.request
from html.parser import HTMLParser

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
sys.path.insert(0, os.path.join(AQUI, "vendor"))

from markdown_it import MarkdownIt  # noqa: E402

try:
    from zoneinfo import ZoneInfo
    ZONA = ZoneInfo("Europe/Madrid")
except Exception:  # sin base de zonas horarias: se usa UTC
    ZONA = dt.timezone.utc

MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
         "agosto", "septiembre", "octubre", "noviembre", "diciembre"]


# identificadores que usa la propia página del proyecto
IDS_RESERVADOS = {"contenido", "descarga", "lista", "novedades"}


class ErrorWeb(Exception):
    pass


# ---------------------------------------------------------------- datos

class ApiGitHub:
    """Lee la API de GitHub y páginas públicas."""

    def __init__(self, token=None):
        self.token = token

    def _pedir(self, url, cabeceras):
        req = urllib.request.Request(url, headers=cabeceras)
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.status, r.read()
        except urllib.error.HTTPError as e:
            return e.code, e.read()

    def api(self, ruta):
        cab = {"Accept": "application/vnd.github+json",
               "X-GitHub-Api-Version": "2022-11-28",
               "User-Agent": "web-generador"}
        if self.token:
            cab["Authorization"] = "Bearer " + self.token
        estado, cuerpo = self._pedir("https://api.github.com" + ruta, cab)
        if estado == 404:
            return None
        if estado != 200:
            msg = cuerpo[:300].decode("utf-8", "replace")
            raise ErrorWeb(f"La API de GitHub respondió {estado} en {ruta}: {msg}")
        return json.loads(cuerpo)

    def url(self, url):
        estado, cuerpo = self._pedir(url, {"User-Agent": "web-generador"})
        if estado != 200:
            raise ErrorWeb(f"{url} respondió {estado}")
        return cuerpo


class ApiFalsa:
    """Respuestas guardadas: api.json ({ruta: respuesta}) y urls.json ({url: texto})."""

    def __init__(self, carpeta):
        with open(os.path.join(carpeta, "api.json"), encoding="utf-8") as f:
            self.respuestas = json.load(f)
        ruta_urls = os.path.join(carpeta, "urls.json")
        self.urls = {}
        if os.path.exists(ruta_urls):
            with open(ruta_urls, encoding="utf-8") as f:
                self.urls = json.load(f)
        self.pedidas = []

    def api(self, ruta):
        self.pedidas.append(ruta)
        if ruta not in self.respuestas:
            return None
        r = self.respuestas[ruta]
        if isinstance(r, dict) and "__estado" in r:
            if r["__estado"] == 404:
                return None
            raise ErrorWeb(f"La API de GitHub respondió {r['__estado']} en {ruta}")
        return r

    def url(self, url):
        if url not in self.urls:
            raise ErrorWeb(f"{url} no responde")
        v = self.urls[url]
        return v if isinstance(v, bytes) else (v if isinstance(v, str) else json.dumps(v)).encode("utf-8")


# ---------------------------------------------------------------- utilidades

def esc(t):
    return html.escape("" if t is None else str(t), quote=True)


def fecha_local(iso):
    if not iso:
        return None
    d = dt.datetime.fromisoformat(iso.replace("Z", "+00:00"))
    if d.tzinfo is None:
        d = d.replace(tzinfo=dt.timezone.utc)
    return d.astimezone(ZONA)


def fecha_texto(iso):
    d = fecha_local(iso)
    if not d:
        return ""
    return f"{d.day} de {MESES[d.month - 1]} de {d.year}"


def fecha_corta(iso):
    d = fecha_local(iso)
    return d.strftime("%Y-%m-%d") if d else ""


def tamano_texto(n):
    if n is None:
        return ""
    if n < 1024:
        return f"{n} B"
    if n < 1024 * 1024:
        return f"{round(n / 1024):d} KB"
    v = n / (1024 * 1024)
    t = f"{v:.1f}" if v < 100 else f"{v:.0f}"
    return t.replace(".", ",") + " MB"


def recortar(texto, maximo=190):
    texto = re.sub(r"\s+", " ", texto or "").strip()
    if len(texto) <= maximo:
        return texto
    corte = texto[:maximo].rsplit(" ", 1)[0].rstrip(",;:.")
    return corte + "…"


def slug_github(texto, usados):
    """Identificador de encabezado como los de GitHub (qué-hace, uso…)."""
    s = texto.strip().lower()
    s = re.sub(r"[^\w\- ]", "", s)
    s = s.replace(" ", "-")
    base, n = s, 1
    while s in usados:
        s = f"{base}-{n}"
        n += 1
    usados.add(s)
    return s


def leer_nota(carpeta, nombre_repo):
    """notas/<repo>.md: cabecera clave: valor entre --- y texto en Markdown."""
    if not os.path.isdir(carpeta):
        return {}, ""
    for f in sorted(os.listdir(carpeta)):
        if f.lower() == nombre_repo.lower() + ".md":
            with open(os.path.join(carpeta, f), encoding="utf-8") as fh:
                texto = fh.read().replace("\r\n", "\n")
            break
    else:
        return {}, ""
    datos = {"descarga": []}
    m = re.match(r"^---\n(.*?)\n---\n?", texto, re.S)
    cuerpo = texto
    if m:
        cuerpo = texto[m.end():]
        for linea in m.group(1).split("\n"):
            linea = linea.strip()
            if not linea or linea.startswith("#") or ":" not in linea:
                continue
            clave, valor = linea.split(":", 1)
            clave, valor = clave.strip().lower(), valor.strip()
            if clave == "descarga":
                if "|" in valor:
                    texto_d, url_d = [x.strip() for x in valor.split("|", 1)]
                    datos["descarga"].append((texto_d, url_d))
            else:
                datos[clave] = valor
    return datos, cuerpo.strip()


def si(valor):
    return str(valor).strip().lower() in ("si", "sí", "yes", "true", "1")


# ---------------------------------------------------------------- Markdown

ETIQUETAS = {
    "p", "a", "img", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li",
    "pre", "code", "blockquote", "table", "thead", "tbody", "tr", "th", "td",
    "strong", "b", "em", "i", "del", "s", "br", "hr", "details", "summary",
    "kbd", "sup", "sub", "div", "span", "picture", "source", "dl", "dt", "dd",
}
VACIAS = {"img", "br", "hr", "source"}
FUERA_CON_CONTENIDO = {"script", "style", "iframe", "object", "embed", "form",
                       "textarea", "select", "button", "svg", "math", "noscript", "template"}
ATRIBUTOS = {"href", "src", "srcset", "alt", "title", "id", "align", "width",
             "height", "colspan", "rowspan", "start", "open", "class", "media", "type"}


class Limpiador(HTMLParser):
    """Deja solo HTML seguro y arregla los enlaces relativos del README."""

    def __init__(self, arreglar_url, prefijo_id="md-"):
        super().__init__(convert_charrefs=True)
        self.arreglar_url = arreglar_url
        self.salida = []
        self.saltando = 0
        self.prefijo_id = prefijo_id

    def _atributos(self, tag, attrs):
        partes = []
        for k, v in attrs:
            k = k.lower()
            if k not in ATRIBUTOS or v is None and k != "open":
                continue
            if k == "class":
                clases = [c for c in (v or "").split() if c.startswith("language-")]
                if not clases:
                    continue
                v = " ".join(clases)
            if k in ("href", "src"):
                v = self.arreglar_url(v, imagen=(k == "src"))
                if v is None:
                    continue
            if k == "srcset":
                trozos = []
                for t in v.split(","):
                    t = t.strip().split()
                    if not t:
                        continue
                    u = self.arreglar_url(t[0], imagen=True)
                    if u:
                        trozos.append(" ".join([u] + t[1:]))
                if not trozos:
                    continue
                v = ", ".join(trozos)
            if k == "open":
                partes.append(" open")
                continue
            partes.append(f' {k}="{esc(v)}"')
        if tag == "img":
            partes.append(' loading="lazy"')
        if tag == "a":
            href = dict(attrs).get("href") or ""
            if href.startswith(("http://", "https://")):
                partes.append(' rel="noopener"')
        return "".join(partes)

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag in FUERA_CON_CONTENIDO:
            self.saltando += 1
            return
        if self.saltando or tag not in ETIQUETAS:
            return
        self.salida.append(f"<{tag}{self._atributos(tag, attrs)}>")

    def handle_startendtag(self, tag, attrs):
        tag = tag.lower()
        if self.saltando or tag not in ETIQUETAS:
            return
        self.salida.append(f"<{tag}{self._atributos(tag, attrs)}>")
        if tag not in VACIAS:
            self.salida.append(f"</{tag}>")

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag in FUERA_CON_CONTENIDO:
            self.saltando = max(0, self.saltando - 1)
            return
        if self.saltando or tag not in ETIQUETAS or tag in VACIAS:
            return
        self.salida.append(f"</{tag}>")

    def handle_data(self, data):
        if not self.saltando:
            self.salida.append(esc(data).replace("&#x27;", "'").replace("&quot;", '"'))


def hacer_arreglar_url(usuario, repo, rama, carpeta_doc):
    def arreglar(url, imagen=False):
        url = (url or "").strip()
        if not url:
            return None
        if url.startswith("#"):
            return url
        if url.startswith("//"):
            url = "https:" + url
        esquema = urllib.parse.urlsplit(url).scheme.lower()
        if esquema in ("http", "https", "mailto"):
            return url
        if esquema:
            return None  # javascript:, data:, file:…
        partes = urllib.parse.urlsplit(url)
        ruta = urllib.parse.unquote(partes.path)
        if ruta.startswith("/"):
            completa = ruta.lstrip("/")
        else:
            completa = posixpath.normpath(posixpath.join(carpeta_doc, ruta))
        if completa in (".", ""):
            completa = ""
        completa = urllib.parse.quote(completa)
        if imagen:
            nueva = f"https://raw.githubusercontent.com/{usuario}/{repo}/{rama}/{completa}"
        else:
            nueva = f"https://github.com/{usuario}/{repo}/blob/{rama}/{completa}"
        if partes.query:
            nueva += "?" + partes.query
        if partes.fragment:
            nueva += "#" + partes.fragment
        return nueva
    return arreglar


def texto_inline(token):
    if token is None or not token.children:
        return (token.content if token else "") or ""
    trozos = []
    for c in token.children:
        if c.type in ("text", "code_inline"):
            trozos.append(c.content)
        elif c.type in ("softbreak", "hardbreak"):
            trozos.append(" ")
    return "".join(trozos)


def render_markdown(texto, arreglar_url, quitar_h1=True, nivel_minimo=2, usados=None):
    """Devuelve (html, primer_titulo, primer_parrafo)."""
    md = MarkdownIt("gfm-like", {"html": True, "linkify": False, "typographer": False})
    tokens = md.parse(texto or "")
    titulo = None
    parrafo = None
    usados = set() if usados is None else usados
    quitar = set()
    for i, t in enumerate(tokens):
        if t.type == "heading_open":
            contenido = texto_inline(tokens[i + 1])
            if t.tag == "h1" and titulo is None and quitar_h1:
                titulo = contenido.strip()
                quitar.update({i, i + 1, i + 2})
                continue
            t.attrSet("id", slug_github(contenido, usados))
            nivel = int(t.tag[1])
            if nivel < nivel_minimo:
                nuevo = f"h{nivel_minimo}"
                t.tag = nuevo
                tokens[i + 2].tag = nuevo
        elif t.type == "paragraph_open" and parrafo is None and t.level == 0:
            p = texto_inline(tokens[i + 1]).strip()
            if p and not p.startswith(("[!", "![")):
                parrafo = p
    tokens = [t for i, t in enumerate(tokens) if i not in quitar]
    crudo = md.renderer.render(tokens, md.options, {})
    limpio = Limpiador(arreglar_url)
    limpio.feed(crudo)
    limpio.close()
    return "".join(limpio.salida).strip(), titulo, parrafo


# ---------------------------------------------------------------- proyectos

def obtener_repos(api, usuario):
    repos, pagina = [], 1
    while True:
        lote = api.api(f"/users/{usuario}/repos?type=owner&sort=created&direction=desc&per_page=100&page={pagina}")
        if lote is None:
            raise ErrorWeb(f"No existe el usuario {usuario} en GitHub")
        repos.extend(lote)
        if len(lote) < 100:
            return repos
        pagina += 1


def elegir_release(releases):
    publicadas = [r for r in (releases or []) if not r.get("draft")]
    estables = [r for r in publicadas if not r.get("prerelease")]
    if estables:
        return estables[0]
    return publicadas[0] if publicadas else None


def leer_readme(api, usuario, nombre):
    r = api.api(f"/repos/{usuario}/{nombre}/readme")
    if not r or not r.get("content"):
        return None, ""
    texto = base64.b64decode(r["content"]).decode("utf-8", "replace")
    return texto, posixpath.dirname(r.get("path") or "README.md")


def leer_catalogo(api, url):
    try:
        datos = json.loads(api.url(url))
    except Exception as e:  # el catálogo es externo: si falla, solo se avisa
        print(f"Aviso: no se ha podido leer el catálogo {url}: {e}", file=sys.stderr)
        return None
    lista = datos.get("payloads") if isinstance(datos, dict) else datos
    if not isinstance(lista, list):
        return None
    salida = []
    for p in lista:
        if isinstance(p, dict) and p.get("url"):
            salida.append({k: p.get(k) for k in ("name", "author", "version", "category",
                                                   "description", "url", "source", "last_update")})
    return {"nombre": datos.get("name") if isinstance(datos, dict) else None, "payloads": salida}


def preparar_proyectos(api, sitio, carpeta_notas, ahora):
    usuario = sitio["usuario"]
    ocultar = {x.lower() for x in sitio.get("ocultar", [])}
    ocultar.add(f"{usuario}.github.io".lower())
    proyectos = []
    for repo in obtener_repos(api, usuario):
        nombre = repo["name"]
        if (repo.get("private") or repo.get("fork") or repo.get("archived")
                or nombre.lower() in ocultar or "no-web" in (repo.get("topics") or [])):
            continue
        nota, cuerpo_nota = leer_nota(carpeta_notas, nombre)
        if si(nota.get("oculto", "no")):
            continue
        rama = repo.get("default_branch") or "main"
        readme, carpeta_doc = leer_readme(api, usuario, nombre)
        arreglar = hacer_arreglar_url(usuario, nombre, rama, carpeta_doc)
        ids = set(IDS_RESERVADOS)
        html_readme, titulo_readme, parrafo = render_markdown(readme or "", arreglar, usados=ids)
        html_nota = ""
        if cuerpo_nota:
            html_nota, titulo_nota, parrafo_nota = render_markdown(
                cuerpo_nota, hacer_arreglar_url(usuario, nombre, rama, ""), usados=ids)
            titulo_readme = titulo_readme or titulo_nota
            parrafo = parrafo or parrafo_nota
        release = elegir_release(api.api(f"/repos/{usuario}/{nombre}/releases?per_page=20"))
        datos_release = None
        if release:
            html_notas_rel, _, _ = render_markdown(
                release.get("body") or "", hacer_arreglar_url(usuario, nombre, rama, ""), quitar_h1=False, nivel_minimo=3, usados=ids)
            datos_release = {
                "id": release.get("id"),
                "tag": release.get("tag_name") or "",
                "nombre": release.get("name") or release.get("tag_name") or "",
                "fecha": release.get("published_at") or release.get("created_at"),
                "beta": bool(release.get("prerelease")),
                "url": release.get("html_url"),
                "notas": html_notas_rel,
                "archivos": [
                    {"nombre": a["name"], "tamano": a.get("size"), "url": a["browser_download_url"],
                     "descargas": a.get("download_count", 0)}
                    for a in sorted(release.get("assets") or [], key=lambda a: a["name"].lower())
                ],
            }
        catalogo = leer_catalogo(api, nota["catalogo"]) if nota.get("catalogo") else None
        creado = repo.get("created_at")
        dias = (ahora - fecha_local(creado)).days if creado else 999
        proyectos.append({
            "repo": nombre,
            "slug": re.sub(r"[^a-z0-9._-]", "-", nombre.lower()),
            "titulo": nota.get("titulo") or titulo_readme or nombre,
            "resumen": recortar(nota.get("resumen") or repo.get("description") or parrafo or ""),
            "url_repo": repo["html_url"],
            "rama": rama,
            "creado": creado,
            "actualizado": repo.get("pushed_at") or repo.get("updated_at"),
            "nuevo": dias < int(sitio.get("dias_nuevo", 14)),
            "orden": int(nota["orden"]) if str(nota.get("orden", "")).lstrip("-").isdigit() else 1000,
            "video": nota.get("video"),
            "extra_descargas": nota.get("descarga", []),
            "catalogo_url": nota.get("catalogo"),
            "catalogo": catalogo,
            "html_nota": html_nota,
            "html_readme": html_readme,
            "release": datos_release,
            "lenguaje": repo.get("language"),
            "estrellas": repo.get("stargazers_count", 0),
        })
    proyectos.sort(key=lambda p: (p["orden"], -(fecha_local(p["creado"]).timestamp() if p["creado"] else 0), p["repo"].lower()))
    return proyectos


# ---------------------------------------------------------------- páginas

def pagina(sitio, titulo, descripcion, cuerpo, nivel, ruta, actual="", pre=None):
    if pre is None:
        pre = "../" * nivel
    url = sitio["url"].rstrip("/") + "/" + ruta
    nav = [("proyectos", "Proyectos", f"{pre}#proyectos"),
           ("descargas", "Descargas", f"{pre}descargas/"),
           ("canales", "Canales", f"{pre}#canales")]
    marca_actual = ' aria-current="page"'
    enlaces_nav = "".join(
        f'<a href="{href}"{marca_actual if clave == actual else ""}>{texto}</a>'
        for clave, texto, href in nav)
    titulo_completo = titulo if titulo == sitio["titulo"] else f"{titulo} | {sitio['titulo']}"
    return f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(titulo_completo)}</title>
<meta name="description" content="{esc(descripcion)}">
<link rel="canonical" href="{esc(url)}">
<meta property="og:title" content="{esc(titulo)}">
<meta property="og:description" content="{esc(descripcion)}">
<meta property="og:url" content="{esc(url)}">
<meta property="og:type" content="website">
<meta name="theme-color" content="#1d5a43">
<link rel="alternate" type="application/atom+xml" title="{esc(sitio['titulo'])}" href="{pre}feed.xml">
<link rel="icon" href="{pre}icono.svg" type="image/svg+xml">
<link rel="stylesheet" href="{pre}estilo.css">
</head>
<body>
<a class="saltar" href="#contenido">Ir al contenido</a>
<header class="cabecera">
  <div class="ancho cabecera-fila">
    <a class="marca" href="{pre or './'}">{esc(sitio['titulo'])}</a>
    <nav aria-label="Principal">{enlaces_nav}</nav>
  </div>
</header>
<main id="contenido">
{cuerpo}
</main>
<footer class="pie">
  <div class="ancho pie-fila">
    <p>Todo el código está en <a href="https://github.com/{esc(sitio['usuario'])}">GitHub</a>.
    Las novedades llegan también por <a href="{pre}feed.xml">el feed</a>.</p>
    <p class="pie-canales">{enlaces_canales(sitio, clase="")}</p>
  </div>
</footer>
</body>
</html>
"""


def enlaces_canales(sitio, clase="canal"):
    return "".join(
        f'<a class="{clase}" href="{esc(c["url"])}" rel="noopener">'
        f'<span class="canal-texto">{esc(c["texto"])}</span>'
        + (f'<span class="canal-detalle">{esc(c.get("detalle"))}</span>' if clase and c.get("detalle") else "")
        + "</a>"
        for c in sitio.get("canales", []))


def chip_proyecto(p, pre):
    rel = p["release"]
    if rel:
        estado = f'{esc(rel["tag"])}{" (beta)" if rel["beta"] else ""}, {esc(fecha_texto(rel["fecha"]))}'
    elif p["catalogo"]:
        estado = f'{len(p["catalogo"]["payloads"])} payloads'
    else:
        estado = f'Actualizado el {esc(fecha_texto(p["actualizado"]))}'
    nuevo = '<span class="sello">Nuevo</span>' if p["nuevo"] else ""
    return f"""<li class="chip">
  <a class="chip-enlace" href="{pre}proyectos/{esc(p['slug'])}/">
    <span class="chip-nombre">{esc(p['titulo'])}</span>{nuevo}
    <span class="chip-resumen">{esc(p['resumen']) or 'Sin descripción todavía.'}</span>
    <span class="chip-estado">{estado}</span>
  </a>
</li>"""


def portada(sitio, proyectos):
    if proyectos:
        lista = "\n".join(chip_proyecto(p, "") for p in proyectos)
        bloque = f'<ul class="chips" role="list">\n{lista}\n</ul>'
    else:
        bloque = '<p class="vacio">Aún no hay repositorios públicos. En cuanto haya uno, aparecerá aquí solo.</p>'
    cuerpo = f"""<section class="portada ancho">
  <div class="placa-titulo">
    <h1 class="portada-titulo">{esc(sitio['titulo'])}</h1>
    <p class="portada-lema">{esc(sitio.get('lema', ''))}</p>
  </div>
</section>
<section class="ancho seccion-proyectos" id="proyectos" aria-labelledby="t-proyectos">
  <h2 id="t-proyectos">Proyectos</h2>
  {bloque}
  <p class="a-descargas"><a href="descargas/">Ver todas las descargas en una página</a></p>
</section>
<section class="ancho seccion" id="canales" aria-labelledby="t-canales">
  <h2 id="t-canales">Canales</h2>
  <div class="canales">{enlaces_canales(sitio)}</div>
</section>"""
    return pagina(sitio, sitio["titulo"], sitio.get("lema", ""), cuerpo, 0, "", actual="")


def boton_archivo(a):
    return (f'<a class="pad" href="{esc(a["url"])}" download>'
            f'<span class="pad-nombre">{esc(a["nombre"])}</span>'
            f'<span class="pad-tamano">{esc(tamano_texto(a["tamano"]))}</span></a>')


def caja_descarga(p):
    rel = p["release"]
    filas = []
    if rel:
        beta = ' <span class="sello">Beta</span>' if rel["beta"] else ""
        filas.append(f'<p class="caja-version">{esc(rel["tag"])}{beta}</p>')
        filas.append(f'<p class="caja-fecha">Publicada el {esc(fecha_texto(rel["fecha"]))}</p>')
        if rel["archivos"]:
            filas.append('<div class="pads">' + "".join(boton_archivo(a) for a in rel["archivos"]) + "</div>")
        else:
            filas.append(f'<div class="pads"><a class="pad" href="{esc(p["url_repo"])}/archive/refs/tags/{esc(urllib.parse.quote(rel["tag"]))}.zip">'
                         '<span class="pad-nombre">Código de esta versión (zip)</span></a></div>')
        filas.append(f'<p class="caja-mas"><a href="{esc(p["url_repo"])}/releases">Versiones anteriores</a></p>')
    for texto, url in p["extra_descargas"]:
        filas.append(f'<div class="pads"><a class="pad" href="{esc(url)}"><span class="pad-nombre">{esc(texto)}</span></a></div>')
    if not rel and not p["extra_descargas"]:
        if p["catalogo"]:
            filas.append(f'<p class="caja-version">{len(p["catalogo"]["payloads"])} payloads</p>')
            filas.append('<p class="caja-fecha">La lista completa está más abajo.</p>')
        else:
            filas.append('<p class="caja-fecha">Todavía no tiene versiones publicadas.</p>')
            filas.append(f'<div class="pads"><a class="pad" href="{esc(p["url_repo"])}/archive/refs/heads/{esc(p["rama"])}.zip">'
                         '<span class="pad-nombre">Código (zip)</span></a></div>')
    if p["video"]:
        filas.append(f'<p class="caja-video"><a href="{esc(p["video"])}" rel="noopener">Ver el vídeo</a></p>')
    filas.append(f'<p class="caja-mas"><a href="{esc(p["url_repo"])}">Código en GitHub</a></p>')
    return '<aside class="caja chip-caja" id="descarga" aria-label="Descarga">\n<h2 class="caja-titulo">Descarga</h2>\n' + "\n".join(filas) + "\n</aside>"


def tabla_catalogo(p):
    cat = p["catalogo"]
    if cat is None:
        if p["catalogo_url"]:
            return (f'<section class="catalogo"><h2 id="lista">Lista de payloads</h2>'
                    f'<p>Ahora mismo no se puede leer la lista. Está en <a href="{esc(p["catalogo_url"])}">{esc(p["catalogo_url"])}</a>.</p></section>')
        return ""
    grupos = {}
    for x in cat["payloads"]:
        grupos.setdefault(x.get("category") or "Otros", []).append(x)
    partes = ['<section class="catalogo"><h2 id="lista">Lista de payloads</h2>']
    if esc(p["catalogo_url"]) not in p["html_nota"]:
        partes.append(f'<p>Dirección del repositorio para Payload Manager:</p>'
                      f'<p class="copiar"><code>{esc(p["catalogo_url"])}</code></p>')
    for grupo in sorted(grupos, key=str.lower):
        partes.append(f"<h3>{esc(grupo)}</h3><ul class=\"payloads\" role=\"list\">")
        for x in sorted(grupos[grupo], key=lambda x: (x.get("name") or "").lower()):
            ver = f' <span class="payload-version">{esc(x.get("version"))}</span>' if x.get("version") else ""
            autor = f'<span class="payload-autor">de {esc(x.get("author"))}</span>' if x.get("author") else ""
            origen = f' <a href="{esc(x["source"])}" rel="noopener">Proyecto original</a>' if x.get("source") else ""
            partes.append(
                f'<li class="payload"><p class="payload-nombre">{esc(x.get("name"))}{ver} {autor}</p>'
                f'<p class="payload-desc">{esc(x.get("description") or "")}</p>'
                f'<p class="payload-enlaces"><a class="pad pad-peque" href="{esc(x["url"])}"><span class="pad-nombre">Descargar .elf</span></a>{origen}</p></li>')
        partes.append("</ul>")
    partes.append("</section>")
    return "".join(partes)


def pagina_proyecto(sitio, p):
    rel = p["release"]
    novedades = ""
    if rel and rel["notas"]:
        novedades = f'<section class="novedades"><h2 id="novedades">Novedades de la {esc(rel["tag"])}</h2>{rel["notas"]}</section>'
    sello = ' <span class="sello">Nuevo</span>' if p["nuevo"] else ""
    contenido = p["html_nota"] + p["html_readme"]
    if not contenido and not p["catalogo"]:
        contenido = f'<p>Este proyecto aún no tiene explicación. Mientras tanto, el código está en <a href="{esc(p["url_repo"])}">GitHub</a>.</p>'
    cuerpo = f"""<article class="ancho proyecto">
  <p class="migas"><a href="../../#proyectos">Proyectos</a></p>
  <h1 class="proyecto-titulo">{esc(p['titulo'])}{sello}</h1>
  <p class="proyecto-resumen">{esc(p['resumen'])}</p>
  <div class="proyecto-rejilla">
    {caja_descarga(p)}
    <div class="texto">
{contenido}
{tabla_catalogo(p)}
{novedades}
    </div>
  </div>
</article>"""
    return pagina(sitio, p["titulo"], p["resumen"] or p["titulo"], cuerpo, 2, f"proyectos/{p['slug']}/", actual="proyectos")


def pagina_descargas(sitio, proyectos):
    bloques = []
    for p in proyectos:
        rel = p["release"]
        enlace = f'../proyectos/{esc(p["slug"])}/'
        if rel and rel["archivos"]:
            detalle = f'{esc(rel["tag"])}{" (beta)" if rel["beta"] else ""}, {esc(fecha_texto(rel["fecha"]))}'
            pads = "".join(boton_archivo(a) for a in rel["archivos"])
        elif p["catalogo"]:
            detalle = f'{len(p["catalogo"]["payloads"])} payloads para Payload Manager'
            pads = f'<a class="pad" href="{enlace}#lista"><span class="pad-nombre">Ver la lista</span></a>'
        elif p["extra_descargas"]:
            detalle = ""
            pads = ""
        else:
            continue
        pads += "".join(f'<a class="pad" href="{esc(u)}"><span class="pad-nombre">{esc(t)}</span></a>' for t, u in p["extra_descargas"])
        bloques.append(f"""<li class="descarga">
  <div class="descarga-info"><h2><a href="{enlace}">{esc(p['titulo'])}</a></h2><p>{detalle}</p></div>
  <div class="pads">{pads}</div>
</li>""")
    lista = ('<ul class="descargas" role="list">' + "\n".join(bloques) + "</ul>") if bloques else \
        '<p class="vacio">Todavía no hay nada para descargar. Cuando un proyecto publique una versión, saldrá aquí.</p>'
    cuerpo = f"""<section class="ancho seccion">
  <h1 class="pagina-titulo">Descargas</h1>
  <p class="pagina-lema">La última versión de cada proyecto. Cada archivo viene de las releases de GitHub.</p>
  {lista}
</section>"""
    return pagina(sitio, "Descargas", "La última versión de cada proyecto.", cuerpo, 1, "descargas/", actual="descargas")


def pagina_404(sitio):
    base = esc(sitio["url"].rstrip("/") + "/")
    cuerpo = f"""<section class="ancho seccion">
  <h1 class="pagina-titulo">Esta página no existe</h1>
  <p class="pagina-lema">Puede que el proyecto haya cambiado de nombre. Todos están en la portada.</p>
  <p><a class="pad" href="{base}"><span class="pad-nombre">Ir a la portada</span></a></p>
</section>"""
    # el 404 se sirve en cualquier ruta: enlaces absolutos
    return pagina(sitio, "Página no encontrada", "", cuerpo, 0, "404.html", pre=sitio["url"].rstrip("/") + "/")


def feed(sitio, proyectos):
    base = sitio["url"].rstrip("/")
    dominio = urllib.parse.urlsplit(base).netloc
    entradas = []
    for p in proyectos:
        url = f"{base}/proyectos/{p['slug']}/"
        if p["creado"]:
            entradas.append((p["creado"], f"tag:{dominio},2026:repo-{p['repo'].lower()}",
                             f"Nuevo proyecto: {p['titulo']}", url, p["resumen"]))
        r = p["release"]
        if r and r["fecha"]:
            entradas.append((r["fecha"], f"tag:{dominio},2026:release-{r['id']}",
                             f"{p['titulo']} {r['tag']}", url + "#descarga", f"Nueva versión de {p['titulo']}."))
    entradas.sort(key=lambda e: (fecha_local(e[0]), e[1]), reverse=True)
    entradas = entradas[:30]
    actualizado = entradas[0][0] if entradas else "2026-01-01T00:00:00Z"
    xml = [f'<?xml version="1.0" encoding="utf-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="es">',
           f"<title>{esc(sitio['titulo'])}</title>",
           f'<link href="{esc(base)}/"/>', f'<link rel="self" href="{esc(base)}/feed.xml"/>',
           f"<id>{esc(base)}/</id>", f"<updated>{esc(actualizado)}</updated>",
           f"<author><name>{esc(sitio['titulo'])}</name></author>"]
    for fecha, ident, titulo, url, resumen in entradas:
        xml.append(f'<entry><title>{esc(titulo)}</title><link href="{esc(url)}"/><id>{esc(ident)}</id>'
                   f"<updated>{esc(fecha)}</updated><summary>{esc(resumen)}</summary></entry>")
    xml.append("</feed>\n")
    return "\n".join(xml)


def mapa_sitio(sitio, proyectos):
    base = sitio["url"].rstrip("/")
    urls = [f"{base}/", f"{base}/descargas/"] + [f"{base}/proyectos/{p['slug']}/" for p in proyectos]
    filas = "".join(f"<url><loc>{esc(u)}</loc></url>" for u in urls)
    return f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{filas}</urlset>\n'


# ---------------------------------------------------------------- todo junto

def generar(api, sitio, salida, carpeta_notas, ahora):
    proyectos = preparar_proyectos(api, sitio, carpeta_notas, ahora)
    if os.path.exists(salida):
        shutil.rmtree(salida)
    archivos = {
        "index.html": portada(sitio, proyectos),
        "descargas/index.html": pagina_descargas(sitio, proyectos),
        "404.html": pagina_404(sitio),
        "feed.xml": feed(sitio, proyectos),
        "sitemap.xml": mapa_sitio(sitio, proyectos),
        "robots.txt": f"User-agent: *\nAllow: /\nSitemap: {sitio['url'].rstrip('/')}/sitemap.xml\n",
        ".nojekyll": "",
    }
    for p in proyectos:
        archivos[f"proyectos/{p['slug']}/index.html"] = pagina_proyecto(sitio, p)
    for ruta, texto in archivos.items():
        destino = os.path.join(salida, ruta)
        os.makedirs(os.path.dirname(destino), exist_ok=True)
        with open(destino, "w", encoding="utf-8", newline="\n") as f:
            f.write(texto)
    plantilla = os.path.join(RAIZ, "plantilla")
    for carpeta, _, ficheros in os.walk(plantilla):
        for f in ficheros:
            origen = os.path.join(carpeta, f)
            destino = os.path.join(salida, os.path.relpath(origen, plantilla))
            os.makedirs(os.path.dirname(destino), exist_ok=True)
            shutil.copyfile(origen, destino)
    # huella: cambia solo si cambia algo de la web
    h = hashlib.sha256()
    for carpeta, _, ficheros in sorted(os.walk(salida)):
        for f in sorted(ficheros):
            ruta = os.path.join(carpeta, f)
            rel = os.path.relpath(ruta, salida).replace(os.sep, "/")
            h.update(rel.encode() + b"\0")
            with open(ruta, "rb") as fh:
                h.update(fh.read())
    huella = h.hexdigest()
    with open(os.path.join(salida, "huella.txt"), "w", encoding="utf-8") as f:
        f.write(huella + "\n")
    return proyectos, huella


def main(argv=None):
    ap = argparse.ArgumentParser(description="Genera la web desde los repos públicos de GitHub.")
    ap.add_argument("--salida", default="_site")
    ap.add_argument("--sitio", default=os.path.join(RAIZ, "sitio.json"))
    ap.add_argument("--notas", default=os.path.join(RAIZ, "notas"))
    ap.add_argument("--datos", help="carpeta con respuestas guardadas (pruebas)")
    ap.add_argument("--ahora", help="fecha AAAA-MM-DD para las pruebas")
    a = ap.parse_args(argv)
    with open(a.sitio, encoding="utf-8") as f:
        sitio = json.load(f)
    api = ApiFalsa(a.datos) if a.datos else ApiGitHub(os.environ.get("GITHUB_TOKEN"))
    ahora = dt.datetime.now(ZONA) if not a.ahora else dt.datetime.fromisoformat(a.ahora).replace(tzinfo=ZONA)
    try:
        proyectos, huella = generar(api, sitio, a.salida, a.notas, ahora)
    except ErrorWeb as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1
    for p in proyectos:
        r = p["release"]
        print(f"- {p['repo']}: {r['tag'] if r else 'sin versiones'}"
              f"{', ' + str(len(r['archivos'])) + ' archivos' if r else ''}"
              f"{', catálogo de ' + str(len(p['catalogo']['payloads'])) if p['catalogo'] else ''}")
    print(f"{len(proyectos)} proyectos. Huella {huella[:12]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
