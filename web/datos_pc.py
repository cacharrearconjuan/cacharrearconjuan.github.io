#!/usr/bin/env python3
"""Prepara los datos de «¿Qué le va a mi PC?» a partir de BuildCores OpenDB.

Uso:
    python3 web/datos_pc.py --opendb /ruta/a/buildcores-open-db --salida datos-pc

Lee open-db/CPU, Motherboard, RAM y Storage (un JSON por pieza), se queda con
lo que usa la herramienta y escribe cpu.json, placas.json, ram.json, ssd.json y
meta.json en --salida. Solo usa la biblioteca estándar.

Los datos son de BuildCores OpenDB (https://github.com/buildcores/buildcores-open-db),
con licencia CC BY-NC-SA 4.0. Lo que sale de aquí es una adaptación (menos
campos, nombres limpios y datos dudosos descartados) con la misma licencia.

Qué se queda fuera, a propósito:
- Zócalos antiguos o de servidor que la herramienta no cubre (ZOCALOS_FUERA).
  Un zócalo nuevo que no esté en esa lista entra solo, aunque aún no tenga reglas.
- Xeon, EPYC y placas con chipset de servidor (C2xx).
- Memoria SO-DIMM (portátil), registrada o ECC, y DDR3 o anterior.
- Discos que no son M.2.
- Los huecos M.2 de una placa cuando su ficha es la plantilla repetida de
  BuildCores o dice algo imposible para su chipset (p. ej. PCIe 4.0 en una Z270).
"""

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import unicodedata

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)

# Zócalos que ya existían al escribir esto y que la herramienta no cubre.
ZOCALOS_FUERA = {
    "AM3+", "AM3", "AM2+", "AM2", "AM1", "FM2+", "FM2", "FM1",
    "sWRX8", "sTR5", "sTRX4", "sTR4", "TR4",
    "LGA 1150", "LGA 1155", "LGA 1156", "LGA 2066", "LGA 2011-3", "LGA 2011-3 Narrow",
    "LGA 2011", "LGA 1366", "LGA 1356", "LGA 775", "LGA 7529", "LGA 4710", "LGA 4677",
    "LGA 4189", "LGA 3647", "LGA 1121", "G34", "SP6", "SP5", "SP3",
    "2 x LGA 2011", "2 x LGA 2011-3", "2 x LGA 2011-3 Narrow", "2 x LGA 1366", "2 x G34",
    "Integrated Atom", "Integrated Xeon D", "Integrated Pentium", "Integrated AMD",
}
# mismo zócalo físico con otro nombre
ZOCALO_ALIAS = {"LGA 1151v2": "LGA 1151"}

# familia de CPU -> zócalo
FAMILIA_ZOCALO = {
    "bristol": "AM4", "summit": "AM4", "pinnacle": "AM4", "raven": "AM4", "picasso": "AM4",
    "matisse": "AM4", "renoir": "AM4", "vermeer": "AM4", "cezanne": "AM4",
    "raphael": "AM5", "phoenix": "AM5", "granite": "AM5", "gorgon": "AM5",
    "skylake": "LGA 1151", "kaby": "LGA 1151", "coffee": "LGA 1151", "coffee_r": "LGA 1151",
    "comet": "LGA 1200", "rocket": "LGA 1200",
    "alder": "LGA 1700", "raptor": "LGA 1700", "raptor_r": "LGA 1700",
    "arrow": "LGA 1851", "arrow_r": "LGA 1851",
}

CHIPSET_ALIAS = {"570X": "X570"}

LONGITUDES_M2 = ("22110", "25110", "2230", "2242", "2260", "2280", "2580")
# en orden, por anchura (22 o 25 mm): «2242-2280» quiere decir también 2260
LARGOS_22 = ["2230", "2242", "2260", "2280", "22110"]
LARGOS_25 = ["2580", "25110"]

# Las fichas que BuildCores pone a muchas placas cuando no tiene el dato: todos los huecos
# «PCIe 4.0 x4» y alguno con un largo raro («2242-2260», «2260-2280», «2230-2242»). Salen igual
# en placas Z170 o H310, donde el PCIe 4.0 ni existe. Un hueco «2280 PCIe 4.0 x4» solo sí puede ser real.
PLANTILLA_M2 = {("2242-2260", "PCIe 4.0 x4"), ("2260-2280", "PCIe 4.0 x4"), ("2230-2242", "PCIe 4.0 x4"),
                ("2280", "PCIe 4.0 x4")}
PLANTILLA_RARAS = {"2242-2260", "2260-2280", "2230-2242"}


class Avisos:
    def __init__(self):
        self.cuenta = {}

    def __call__(self, clave):
        self.cuenta[clave] = self.cuenta.get(clave, 0) + 1


# ---------------------------------------------------------------- utilidades

def limpiar(texto):
    # antes de normalizar: NFKC convierte «™» en «TM» («RyzenTM»)
    t = str(texto or "").replace("™", "").replace("®", "").replace("(R)", "").replace("(TM)", "")
    t = unicodedata.normalize("NFKC", t)
    return re.sub(r"\s+", " ", t).strip()


def slug(texto):
    t = unicodedata.normalize("NFKD", texto.lower())
    t = "".join(c for c in t if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")


def entero(v):
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return int(f) if f == int(f) and f > 0 else None


def numero(v):
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return round(f, 2) if f > 0 else None


def leer_categoria(opendb, categoria, avisos):
    carpeta = os.path.join(opendb, "open-db", categoria)
    if not os.path.isdir(carpeta):
        raise SystemExit(f"No encuentro {carpeta}: ¿es una copia de buildcores-open-db?")
    piezas = []
    for f in sorted(os.listdir(carpeta)):
        if not f.endswith(".json"):
            continue
        try:
            with open(os.path.join(carpeta, f), encoding="utf-8") as fh:
                d = json.load(fh)
        except (OSError, ValueError):
            avisos(f"{categoria}: archivo ilegible")
            continue
        if isinstance(d, dict) and isinstance(d.get("metadata"), dict) and d["metadata"].get("name"):
            piezas.append(d)
    return piezas


def zocalo_de(valor):
    z = ZOCALO_ALIAS.get(valor, valor)
    if not z or z in ZOCALOS_FUERA:
        return None
    return z


def asin_es(pieza):
    """Código de producto en Amazon.es que BuildCores da por comprobado (para enlazar la ficha exacta, sin afiliados)."""
    for anuncio in ((pieza.get("identifiers") or {}).get("retailer_listings") or []):
        codigo = str(anuncio.get("source_product_id") or "")
        if (anuncio.get("source") == "amazon" and anuncio.get("channel") == "es" and anuncio.get("verified") is True
                and re.fullmatch(r"[A-Z0-9]{10}", codigo)):
            return codigo
    return ""


def ids_cortos(registros):
    """id corto y estable: las primeras cifras del SHA-1 del nombre (más si chocan).

    Sale del nombre y no del uuid de BuildCores porque de cada pieza repetida se queda la mejor
    ficha, y esa puede cambiar de un día a otro: así los enlaces compartidos siguen valiendo.
    """
    for r in registros:
        r["_uuid"] = hashlib.sha1(r["nombre"].lower().encode("utf-8")).hexdigest()
    largo = 8
    while True:
        usados = {}
        for r in registros:
            usados.setdefault(r["_uuid"][:largo], []).append(r)
        if all(len(v) == 1 for v in usados.values()) or largo >= 32:
            break
        largo += 2
    for r in registros:
        r["id"] = r["_uuid"][:largo]


# ---------------------------------------------------------------- procesadores

RX_XEON = re.compile(r"\b(Xeon|EPYC)\b", re.I)
RX_ULTRA = re.compile(r"\bCore\s*Ultra\s*([3579])\s*(\d{3})([A-Z]{0,2})\b(\s*Plus)?", re.I)
RX_CORE = re.compile(r"\bCore\s*i([3579])[\s-]*(\d{4,5})([A-Z]{0,3})\b", re.I)
RX_PENTIUM = re.compile(r"\bPentium\s*(Gold\s*)?G(\d{4})([A-Z]{0,2})\b", re.I)
RX_CELERON = re.compile(r"\bCeleron\s*G(\d{4})([A-Z]{0,2})\b", re.I)
RX_RYZEN_AI = re.compile(r"\bRyzen\s*AI\s*([3579])\s*(PRO\s*)?(\d{3})([A-Z]{0,2})\b", re.I)
RX_RYZEN = re.compile(r"\bRyzen\s*(?:([3579])\s*)?(PRO\s*)?(\d{4})([A-Z0-9]{0,4})\b", re.I)
RX_ATHLON = re.compile(r"\bAthlon\s*(X4\s*|Gold\s*|Silver\s*|PRO\s*)?(\d{3,4})([A-Z]{0,2})\b", re.I)
RX_ASERIE = re.compile(r"\bA(6|8|10|12)[\s-]*(9\d{3})([A-Z]?)\b", re.I)

GEN_CORE = {6: "skylake", 7: "kaby", 8: "coffee", 9: "coffee_r", 10: "comet", 11: "rocket",
            12: "alder", 13: "raptor", 14: "raptor_r"}


def familia_pentium(k):
    if 4400 <= k < 4560:
        return "skylake"
    if 4560 <= k < 4700:
        return "kaby"
    if 5400 <= k < 5700:
        return "coffee"
    if 6400 <= k < 6700:
        return "comet"
    if 7400 <= k < 7500:
        return "alder"
    return None


def familia_celeron(k):
    if k in (3900, 3920):
        return "skylake"
    if k in (3930, 3950):
        return "kaby"
    if 4900 <= k < 5000:
        return "coffee"
    if 5900 <= k < 6000:
        return "comet"
    if 6900 <= k < 7000:
        return "alder"
    return None


def analizar_cpu(nombre, numeros_pieza=()):
    """(marca, nombre limpio, familia, ¿gráfica integrada según el modelo?) o None si es de servidor.

    La familia es None si el modelo no se reconoce; entonces la herramienta no da reglas.
    """
    n = limpiar(nombre)
    if RX_XEON.search(n):
        return None
    m = RX_ULTRA.search(n)
    if m:
        t, num, suf, plus = m.group(1), m.group(2), (m.group(3) or "").upper(), bool(m.group(4))
        fam = ("arrow_r" if plus else "arrow") if num.startswith("2") else None
        return "Intel", f"Intel Core Ultra {t} {num}{suf}{' Plus' if plus else ''}", fam, "F" not in suf
    m = RX_CORE.search(n)
    if m:
        t, num, suf = m.group(1), m.group(2), (m.group(3) or "").upper()
        gen = int(num[:2]) if len(num) == 5 else int(num[0])
        return "Intel", f"Intel Core i{t}-{num}{suf}", GEN_CORE.get(gen), "F" not in suf
    m = RX_PENTIUM.search(n)
    if m:
        num, suf = m.group(2), (m.group(3) or "").upper()
        k = int(num)
        oro = "Gold " if (m.group(1) or k >= 5400) else ""
        return "Intel", f"Intel Pentium {oro}G{num}{suf}", familia_pentium(k), "F" not in suf
    m = RX_CELERON.search(n)
    if m:
        num, suf = m.group(1), (m.group(2) or "").upper()
        return "Intel", f"Intel Celeron G{num}{suf}", familia_celeron(int(num)), "F" not in suf
    m = RX_RYZEN_AI.search(n)
    if m:  # Ryzen AI 400 de sobremesa (AM5, solo en equipos montados)
        t, pro, num, suf = m.group(1), m.group(2), m.group(3), (m.group(4) or "").upper()
        fam = "gorgon" if num.startswith("4") and suf.startswith("G") else None
        return "AMD", f"AMD Ryzen AI {t} {'PRO ' if pro else ''}{num}{suf}", fam, suf.startswith("G")
    m = RX_RYZEN.search(n)
    if m:
        t, pro, num, suf = m.group(1), m.group(2), m.group(3), (m.group(4) or "").upper()
        nombre_l = "AMD Ryzen " + (f"{t} " if t else "") + ("PRO " if pro else "") + num + suf
        serie = num[0]
        apu = suf.startswith("G")  # G, GE, GT
        fam = None
        if serie == "1":
            # el 1600 «AF» es Zen+ (12 nm): se distingue por el número de pieza YD1600BBAFBOX
            af = "AF" in suf or bool(re.search(rf"\b{num}\s*AF\b", n, re.I)) or any(
                re.search(r"BAF", x or "", re.I) for x in numeros_pieza)
            fam = "pinnacle" if af else "summit"
            if af:
                nombre_l = "AMD Ryzen " + (f"{t} " if t else "") + ("PRO " if pro else "") + num + " AF"
        elif serie == "2":
            fam = "raven" if apu else "pinnacle"
        elif serie == "3":
            fam = "picasso" if apu else "matisse"
        elif serie == "4":
            fam = "renoir"
        elif serie == "5":
            fam = "cezanne" if apu or (suf == "" and num in ("5300", "5500", "5700")) else "vermeer"
        elif serie == "7":
            fam = "raphael"
        elif serie == "8":
            fam = "phoenix"
        elif serie == "9":
            fam = "granite"
        if serie in "12345":
            igpu = apu and "AF" not in suf
        else:
            igpu = "F" not in suf
        return "AMD", nombre_l, fam, igpu
    m = RX_ATHLON.search(n)
    if m:
        pre, num, suf = (m.group(1) or "").strip().upper(), m.group(2), (m.group(3) or "").upper()
        if pre == "X4":
            return "AMD", f"AMD Athlon X4 {num}{suf}", "bristol" if num.startswith("9") else None, False
        prefijo = {"GOLD": "Gold ", "SILVER": "Silver ", "PRO": "PRO "}.get(pre, "")
        fam = None
        if num in ("200", "220", "240"):
            fam = "raven"
        elif num.startswith("3"):
            fam = "picasso"
        return "AMD", f"AMD Athlon {prefijo}{num}{suf}", fam, True
    m = RX_ASERIE.search(n)
    if m:
        a, num, suf = m.group(1), m.group(2), (m.group(3) or "").upper()
        return "AMD", f"AMD A{a}-{num}{suf}", "bristol", True
    marca = "AMD" if re.search(r"\b(AMD|Ryzen|Athlon)\b", n, re.I) else ("Intel" if re.search(r"\bIntel\b", n, re.I) else "")
    return marca, n, None, None


def modelo_igpu(texto):
    """Nombre de la gráfica integrada tal y como viene, arreglado; None si dice que no tiene."""
    t = limpiar(texto)
    if t.lower() in ("", "none", "0", "n/a", "no", "null"):
        return None
    t = re.sub(r"^(?:Intel\s+)?UHD\s+(\d+)$", r"Intel UHD Graphics \1", t, flags=re.I)
    if re.match(r"^(UHD|HD|Iris)\b", t):
        t = "Intel " + t
    if re.match(r"^Radeon\b", t):
        t = "AMD " + t
    if t == "AMD Radeon":
        t = "AMD Radeon Graphics"
    return t


def preparar_cpus(piezas, avisos):
    grupos = {}
    for c in piezas:
        z = zocalo_de(c.get("socket"))
        if not z:
            continue
        r = analizar_cpu(c["metadata"]["name"], c["metadata"].get("part_numbers") or ())
        if r is None:
            avisos("cpu: Xeon y EPYC fuera")
            continue
        marca, nombre, fam, igpu = r
        if fam and FAMILIA_ZOCALO[fam] != z:
            avisos("cpu: zócalo de la ficha distinto al de su familia (manda la familia)")
            z = FAMILIA_ZOCALO[fam]
        sp = c.get("specifications") or {}
        cores = c.get("cores") or {}
        relojes = (c.get("clocks") or {}).get("performance") or {}
        mem = sp.get("memory") or {}
        ig = sp.get("integratedGraphics")
        modelo = modelo_igpu(ig.get("model")) if isinstance(ig, dict) else None
        md = c.get("metadata") or {}
        reg = {
            "uuid": c.get("opendb_id"),
            "amazon": asin_es(c),
            "nombre": nombre,
            "zocalo": z,
            "familia": fam,
            "igpu": igpu,
            "igpu_modelo": modelo if igpu else None,
            "nucleos": entero(cores.get("total")),
            "hilos": entero(cores.get("threads")),
            "boost": numero(relojes.get("boost")),
            "tdp": entero(sp.get("tdp")),
            "ram": sorted({t for t in (mem.get("types") or []) if t in ("DDR4", "DDR5")}),
            "anio": entero(md.get("releaseYear")),
            "_oem": "OEM" in md.get("name", "").upper() or "TRAY" in md.get("name", "").upper(),
            "_revisada": bool(md.get("last_manually_spec_verified_at")),
        }
        if igpu is not None and isinstance(ig, dict) and (modelo is not None) != igpu:
            avisos("cpu: la ficha y el modelo no coinciden en la gráfica integrada (manda el modelo)")
        grupos.setdefault((z, nombre.lower()), []).append(reg)
    salida = []
    for (z, _), regs in grupos.items():
        def nota(r):
            return (r["_revisada"] * 8 + (not r["_oem"]) * 4 + bool(r["ram"]) * 2
                    + bool(r["nucleos"]) + bool(r["igpu_modelo"]))
        regs.sort(key=nota, reverse=True)
        mejor = dict(regs[0])
        for otro in regs[1:]:
            for k in ("nucleos", "hilos", "boost", "tdp", "igpu_modelo", "anio"):
                if mejor[k] is None and otro[k] is not None:
                    mejor[k] = otro[k]
            if not mejor["ram"] and otro["ram"]:
                mejor["ram"] = otro["ram"]
        # en Amazon, solo la versión en caja (la «tray» u OEM es otro producto: sin disipador y otra garantía)
        mejor["amazon"] = next((r["amazon"] for r in regs if r["amazon"] and not r["_oem"]), "")
        # AMD llama «Radeon Graphics» (con sus núcleos) a la gráfica de los 4000G y 5000G, no «Vega N»
        m = re.search(r"Vega\s*(\d+)", mejor["igpu_modelo"] or "")
        if m and mejor["familia"] in ("renoir", "cezanne"):
            mejor["igpu_modelo"] = f"AMD Radeon Graphics ({m.group(1)} núcleos)"
        mejor["id"] = slug(re.sub(r"^(Intel|AMD)\s+", "", mejor["nombre"]))
        salida.append(mejor)
    # dos modelos distintos con el mismo id (raro): se desempatan con el zócalo
    vistos = {}
    for r in salida:
        vistos.setdefault(r["id"], []).append(r)
    for regs in vistos.values():
        if len(regs) > 1:
            for r in regs:
                r["id"] = f"{r['id']}-{slug(r['zocalo'])}"
    salida.sort(key=lambda r: (r["nombre"].lower(), r["zocalo"]))
    return salida


# ---------------------------------------------------------------- placas base

RX_GEN = re.compile(r"(?:PCI-?E\s*(?:GEN\s*)?|GEN\s*)(\d)(?:\.0)?", re.I)
RX_CARRILES = re.compile(r"x\s?(\d{1,2})", re.I)


def leer_hueco_m2(hueco):
    """[longitudes, gen PCIe (0 = no se sabe), carriles (0 = no se sabe), modo] o None si no es para discos.

    modo: «p» PCIe, «ps» PCIe o SATA, «s» solo SATA, «?» no se sabe.
    """
    clave = (hueco.get("key") or "M").upper()
    if clave not in ("M", "B+M"):
        return None
    tam = hueco.get("size") or ""
    longs = {l for l in LONGITUDES_M2 if re.search(rf"(?<!\d){l}(?!\d)", tam)}
    for a, b in re.findall(r"(\d{4,5})\s*-\s*(\d{4,5})", tam):
        for serie in (LARGOS_22, LARGOS_25):
            if a in serie and b in serie:
                i, j = sorted((serie.index(a), serie.index(b)))
                longs.update(serie[i:j + 1])
    # un hueco para SSD de 25 mm de ancho también lleva los de 22 mm del mismo largo
    # (Gigabyte, por ejemplo, los anuncia como «25110/2280»)
    if "2580" in longs:
        longs.add("2280")
    if "25110" in longs:
        longs.add("22110")
    longs = sorted(longs, key=int)
    interfaz = limpiar(hueco.get("interface") or "")
    gens = [int(g) for g in RX_GEN.findall(interfaz) if g in "2345"]
    carriles = [int(x) for x in RX_CARRILES.findall(interfaz) if x in ("1", "2", "4", "8", "16")]
    sata = "SATA" in interfaz.upper()
    pcie = bool(gens) or "PCI" in interfaz.upper() or bool(re.search(r"\bGEN\s*\d", interfaz, re.I))
    if pcie and sata:
        modo = "ps"
    elif pcie:
        modo = "p"
    elif sata:
        modo = "s"
    else:
        modo = "?"
    return [",".join(longs), max(gens) if gens else 0, max(carriles) if carriles else 0, modo]


# conectores de «display_outputs» (salidas confirmadas por BuildCores) → nombre en la web
CONECTORES_VIDEO = {"hdmi": "HDMI", "displayport": "DisplayPort", "mini_displayport": "DisplayPort", "usb_c": "USB-C",
                    "dvi_d": "DVI", "dvi_i": "DVI", "dvi": "DVI", "vga": "VGA", "thunderbolt": "Thunderbolt"}


def salidas_video(placa):
    """Salidas de vídeo de la placa: lista con nombres; [] si BuildCores confirma que no tiene ninguna para la
    gráfica integrada; None si la ficha no dice ninguna (puede tenerlas o no)."""
    confirmadas = placa.get("display_outputs") or []
    if confirmadas:
        salidas = []
        for s in confirmadas:
            if not isinstance(s, dict) or s.get("graphics_route") == "discrete":
                continue  # p. ej. el DisplayPort de entrada de las placas con Thunderbolt, que saca la imagen de la gráfica
            nombre = CONECTORES_VIDEO.get(str(s.get("connector") or "").lower())
            if not nombre and str(s.get("video_signal") or "").lower() in CONECTORES_VIDEO:
                nombre = CONECTORES_VIDEO[str(s.get("video_signal")).lower()]
            if nombre and nombre not in salidas:
                salidas.append(nombre)
        return salidas
    puertos = [str(p) for p in (placa.get("back_panel_ports") or [])]
    # las entradas (DisplayPort In de las placas con Thunderbolt) no son salidas
    puertos = [p for p in puertos if not re.search(r"\b(in|input)\b", p, re.I)]
    texto = " ".join(puertos).lower().replace("display port", "displayport")
    salidas = []
    for clave, nombre in (("hdmi", "HDMI"), ("displayport", "DisplayPort"), ("dvi", "DVI"),
                          ("vga", "VGA"), ("d-sub", "VGA"), ("usb4", "USB4"), ("thunderbolt", "Thunderbolt")):
        if clave in texto and nombre not in salidas:
            salidas.append(nombre)
    # Que la lista de puertos no traiga ninguna no prueba que no tenga: ASUS, por ejemplo, pone las salidas
    # de vídeo en otro apartado de la ficha (pasa con la B650M-AYW WIFI, que sí tiene HDMI). Así que: no se sabe.
    return salidas or None


def preparar_placas(piezas, reglas, avisos):
    grupos = {}
    for p in piezas:
        z = zocalo_de(p.get("socket"))
        if not z:
            continue
        chip = limpiar(p.get("chipset") or "")
        chip = re.sub(r"^(AMD|Intel)\s+", "", chip, flags=re.I).upper()
        chip = CHIPSET_ALIAS.get(chip, chip)
        if re.match(r"^C2\d\d$", chip):
            avisos("placa: chipset de servidor fuera")
            continue
        md = p.get("metadata") or {}
        nombre = limpiar(md.get("name"))
        fab = limpiar(md.get("manufacturer"))
        if fab and not nombre.lower().startswith(fab.lower()):
            nombre = f"{fab} {nombre}"
        mem = p.get("memory") or {}
        ram = mem.get("ram_type") if mem.get("ram_type") in ("DDR3", "DDR4", "DDR5") else None
        en_nombre = set(re.findall(r"\bDDR([345])\b", nombre.upper()))
        if len(en_nombre) == 1:
            del_nombre = "DDR" + en_nombre.pop()
            if ram and ram != del_nombre:
                avisos("placa: el tipo de RAM del nombre manda sobre el de la ficha")
            ram = del_nombre
        # solo los huecos para discos (los «E» son para la tarjeta Wi-Fi)
        huecos_crudos = [h for h in (p.get("m2_slots") or [])
                         if isinstance(h, dict) and (h.get("key") or "M").upper() in ("M", "B+M")]
        firma = {(h.get("size"), h.get("interface")) for h in huecos_crudos}
        m2, nota = None, ""
        if not huecos_crudos:
            nota = "sin_datos"
        elif firma <= PLANTILLA_M2 and any(tam in PLANTILLA_RARAS for tam, _ in firma):
            nota = "plantilla"
            avisos("placa: huecos M.2 de plantilla descartados")
        else:
            m2 = [h for h in (leer_hueco_m2(x) for x in huecos_crudos) if h]
            tope = ((reglas.get(z) or {}).get("chipsets") or {}).get(chip, {}).get("m2_max")
            if tope and any(h[1] > tope for h in m2):
                m2, nota = None, "imposible"
                avisos("placa: huecos M.2 imposibles para su chipset descartados")
            elif not m2:
                m2, nota = None, "sin_datos"
            elif len(m2) >= 4 and len(m2) % 2 == 0 and m2[:len(m2) // 2] == m2[len(m2) // 2:]:
                # la ficha repite la lista entera (pasa en varias Gigabyte): son la mitad. Con solo dos huecos
                # iguales no se toca, porque hay placas que de verdad tienen dos M.2 idénticos
                m2 = m2[:len(m2) // 2]
                avisos("placa: lista de M.2 repetida en la ficha, contada una vez")
        bios = p.get("bios_features") or {}
        revisada = md.get("last_manually_spec_verified_at") or ""
        ranuras, max_gb = entero(mem.get("slots")), entero(mem.get("max"))
        reg = {
            "uuid": p.get("opendb_id"),
            "amazon": asin_es(p),
            "nombre": nombre,
            "zocalo": z,
            "chipset": chip or None,
            "formato": p.get("form_factor"),
            "ram": ram,
            "ranuras": ranuras if ranuras in (2, 4, 6, 8) else None,  # «1 ranura» es un error de la ficha
            "max_gb": max_gb if max_gb and max_gb >= 8 else None,
            "m2": m2,
            "m2_nota": nota,
            "video": salidas_video(p),
            "notas_m2": None,
            "fuente": "",
            "flashback": bios.get("flashback") if isinstance(bios.get("flashback"), bool) else None,
            "revisada": revisada[:10] if re.match(r"^\d{4}-\d{2}-\d{2}", revisada) else "",
            "anio": entero(md.get("releaseYear")),
        }
        grupos.setdefault(nombre.lower(), []).append(reg)
    salida = []
    for regs in grupos.values():
        regs.sort(key=lambda r: (bool(r["revisada"]), r["m2"] is not None, len(r["video"] or [])), reverse=True)
        regs[0]["amazon"] = next((r["amazon"] for r in regs if r["amazon"]), "")
        salida.append(regs[0])
    ids_cortos(salida)
    salida.sort(key=lambda r: r["nombre"].lower())
    return salida


# ---------------------------------------------------------------- memoria

VELOCIDADES = {"DDR4": (1600, 6000), "DDR5": (3200, 12000)}


def preparar_ram(piezas, avisos):
    grupos = {}
    for r in piezas:
        tipo = r.get("ram_type")
        if tipo not in VELOCIDADES:
            continue
        nombre = limpiar(r["metadata"]["name"])
        ff = (r.get("form_factor") or "").upper()
        if "SO-DIMM" in ff or re.search(r"SO-?DIMM", nombre, re.I):
            continue
        servidor = (r.get("registered") == "Registered" or r.get("ecc") == "ECC"
                    or re.search(r"\b(Registered|RDIMM|LRDIMM|RDIMMs)\b", nombre, re.I)
                    or re.search(r"(?<!Non-)(?<!Non )\bECC\b", nombre, re.I))
        if servidor:
            avisos("ram: ECC o registrada fuera")
            continue
        vel = entero(r.get("speed"))
        mod = r.get("modules") or {}
        n, gb = entero(mod.get("quantity")), entero(mod.get("capacity_gb"))
        lo, hi = VELOCIDADES[tipo]
        if not vel or not (lo <= vel <= hi) or not n or not gb:
            avisos("ram: sin velocidad o módulos claros")
            continue
        perfiles = {x for x in (r.get("profile_support") or []) if x in ("XMP", "EXPO")}
        fab = limpiar((r.get("metadata") or {}).get("manufacturer"))
        if fab and not nombre.lower().startswith(fab.lower()):
            nombre = f"{fab} {nombre}"
        reg = {
            "uuid": r.get("opendb_id"),
            "amazon": asin_es(r),
            "nombre": nombre,
            "tipo": tipo,
            "velocidad": vel,
            "cl": entero(r.get("cas_latency")),
            "modulos": n,
            "gb": gb,
            "perfil": "+".join(sorted(perfiles, reverse=True)),
        }
        grupos.setdefault(nombre.lower(), []).append(reg)
    salida = []
    for regs in grupos.values():
        regs[0]["amazon"] = next((r["amazon"] for r in regs if r["amazon"]), "")
        salida.append(regs[0])
    ids_cortos(salida)
    salida.sort(key=lambda r: r["nombre"].lower())
    return salida


# ---------------------------------------------------------------- discos M.2

# el MP600 PRO LPX lleva disipador de serie aunque el nombre no lo diga
RX_DISIPADOR = re.compile(r"heat\s*-?\s*sink|disipador|\bw/\s*hs\b|\bMP600 PRO LPX\b", re.I)


def preparar_ssd(piezas, avisos):
    grupos = {}
    for s in piezas:
        ff = s.get("form_factor") or ""
        interfaz = s.get("interface") or ""
        if not ff.startswith("M.2-") or not interfaz.startswith("M.2"):
            continue
        largo = ff[4:]
        if largo not in LONGITUDES_M2:
            continue
        gens = RX_GEN.findall(interfaz)
        carriles = RX_CARRILES.findall(interfaz)
        if "SATA" in interfaz.upper():
            proto, gen, x = "sata", 0, 0
        else:
            proto = "nvme"
            gen = int(gens[0]) if gens else 0
            x = int(carriles[0]) if carriles else 0
        nombre = limpiar(s["metadata"]["name"])
        if x > 4:
            # un M.2 tiene como mucho cuatro carriles: el dato está mal y no se puede fiar de la velocidad
            avisos("ssd: más de cuatro carriles (imposible en M.2), velocidad sin dato")
            gen, x = 0, 0
        fab = limpiar((s.get("metadata") or {}).get("manufacturer"))
        if fab and not nombre.lower().startswith(fab.lower()):
            nombre = f"{fab} {nombre}"
        reg = {
            "uuid": s.get("opendb_id"),
            "amazon": asin_es(s),
            "nombre": nombre,
            "largo": largo,
            "gen": gen,
            "carriles": x,
            "protocolo": proto,
            "gb": entero(s.get("capacity")),
            # los que traen disipador propio no siempre caben con el de la placa o debajo de la gráfica
            "disipador": 1 if RX_DISIPADOR.search(nombre) else 0,
        }
        grupos.setdefault(nombre.lower(), []).append(reg)
    salida = []
    for regs in grupos.values():
        regs[0]["amazon"] = next((r["amazon"] for r in regs if r["amazon"]), "")
        salida.append(regs[0])
    ids_cortos(salida)
    salida.sort(key=lambda r: r["nombre"].lower())
    return salida


# ---------------------------------------------------------------- escribir

CAMPOS = {
    "cpu": ["id", "nombre", "zocalo", "familia", "igpu", "igpu_modelo", "nucleos", "hilos", "boost", "tdp", "ram", "anio", "amazon"],
    "placas": ["id", "nombre", "zocalo", "chipset", "formato", "ram", "ranuras", "max_gb", "m2", "m2_nota",
               "video", "flashback", "revisada", "anio", "amazon", "notas_m2", "fuente"],
    "ram": ["id", "nombre", "tipo", "velocidad", "cl", "modulos", "gb", "perfil", "amazon"],
    "ssd": ["id", "nombre", "largo", "gen", "carriles", "protocolo", "gb", "disipador", "amazon"],
}


LICENCIA = ("Adaptado de BuildCores OpenDB (https://github.com/buildcores/buildcores-open-db). "
            "Licencia CC BY-NC-SA 4.0: https://creativecommons.org/licenses/by-nc-sa/4.0/deed.es")


def escribir_tabla(ruta, campos, registros):
    filas = [json.dumps([r[c] for c in campos], ensure_ascii=False, separators=(",", ":")) for r in registros]
    with open(ruta, "w", encoding="utf-8", newline="\n") as f:
        f.write('{"licencia":' + json.dumps(LICENCIA, ensure_ascii=False) + ',\n"campos":'
                + json.dumps(campos, separators=(",", ":")) + ',"datos":[\n')
        f.write(",\n".join(filas))
        f.write("\n]}\n")


def version_opendb(opendb):
    try:
        r = subprocess.run(["git", "-C", opendb, "log", "-1", "--format=%H %cI"],
                           capture_output=True, text=True, timeout=20, check=True)
        sha, fecha = r.stdout.strip().split(" ", 1)
        return sha, fecha
    except (OSError, subprocess.SubprocessError, ValueError):
        return None, None


def leer_reglas(ruta):
    """Sin reglas no se pueden descartar los huecos M.2 imposibles: mejor parar."""
    if not ruta or not os.path.exists(ruta):
        raise SystemExit(f"No encuentro las reglas ({ruta}): hacen falta para revisar los huecos M.2.")
    with open(ruta, encoding="utf-8") as f:
        return json.load(f).get("plataformas", {})


def comparar_con_anterior(anterior, cuentas):
    """Si de un día para otro salen muchas menos piezas, algo ha cambiado en BuildCores: mejor no tocar nada."""
    ruta = os.path.join(anterior or "", "meta.json")
    if not anterior or not os.path.exists(ruta):
        return
    with open(ruta, encoding="utf-8") as f:
        viejo = json.load(f).get("piezas", {})
    for clave, n in cuentas.items():
        antes = viejo.get(clave) or 0
        if antes and n < antes * 0.7:
            raise SystemExit(f"Ahora salen {n} piezas de «{clave}» y antes había {antes}: "
                             "¿ha cambiado el formato de BuildCores? No se escribe nada.")


CAMPOS_CORREGIBLES = ("m2", "video", "flashback", "max_gb", "notas_m2")


def aplicar_correcciones(placas, ruta, avisos):
    """Datos de placas revisados a mano con la ficha del fabricante (pc/correcciones.json): mandan sobre BuildCores."""
    if not ruta or not os.path.exists(ruta):
        return 0
    with open(ruta, encoding="utf-8") as f:
        correcciones = json.load(f).get("placas") or []
    por_nombre = {p["nombre"].lower(): p for p in placas}
    hechas = 0
    for c in correcciones:
        placa = por_nombre.get(str(c.get("nombre", "")).lower())
        if not placa:
            avisos(f"correcciones: «{c.get('nombre')}» ya no está en BuildCores")
            continue
        for campo in CAMPOS_CORREGIBLES:
            if campo in c:
                placa[campo] = c[campo]
        if "m2" in c:
            placa["m2_nota"] = ""
        placa["fuente"] = c.get("fuente") or ""
        hechas += 1
    if hechas:
        avisos.cuenta["placa: corregida a mano con la ficha del fabricante"] = hechas
    return hechas


def preparar(opendb, salida, ruta_reglas, anterior=None, ruta_correcciones=None):
    avisos = Avisos()
    reglas = leer_reglas(ruta_reglas)
    cpus = preparar_cpus(leer_categoria(opendb, "CPU", avisos), avisos)
    placas = preparar_placas(leer_categoria(opendb, "Motherboard", avisos), reglas, avisos)
    aplicar_correcciones(placas, ruta_correcciones, avisos)
    ram = preparar_ram(leer_categoria(opendb, "RAM", avisos), avisos)
    ssd = preparar_ssd(leer_categoria(opendb, "Storage", avisos), avisos)
    if not cpus or not placas or not ram or not ssd:
        raise SystemExit("Faltan piezas en alguna categoría: no se escribe nada para no estropear los datos buenos.")
    comparar_con_anterior(anterior, {"cpu": len(cpus), "placas": len(placas), "ram": len(ram), "ssd": len(ssd)})
    os.makedirs(salida, exist_ok=True)
    escribir_tabla(os.path.join(salida, "cpu.json"), CAMPOS["cpu"], cpus)
    escribir_tabla(os.path.join(salida, "placas.json"), CAMPOS["placas"], placas)
    escribir_tabla(os.path.join(salida, "ram.json"), CAMPOS["ram"], ram)
    escribir_tabla(os.path.join(salida, "ssd.json"), CAMPOS["ssd"], ssd)
    sha, fecha = version_opendb(opendb)
    meta = {
        "fuente": "BuildCores OpenDB",
        "url": "https://github.com/buildcores/buildcores-open-db",
        "licencia": "CC BY-NC-SA 4.0",
        "licencia_url": "https://creativecommons.org/licenses/by-nc-sa/4.0/deed.es",
        "cambios": "Adaptado: menos campos, nombres limpios, sin Xeon, EPYC, placas de servidor, SO-DIMM ni ECC, sin los huecos M.2 de plantilla o imposibles, y con algunas placas corregidas a mano con la ficha del fabricante.",
        "commit": sha,
        "fecha": fecha,
        "piezas": {"cpu": len(cpus), "placas": len(placas), "ram": len(ram), "ssd": len(ssd)},
        "avisos": dict(sorted(avisos.cuenta.items())),
    }
    with open(os.path.join(salida, "meta.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)
        f.write("\n")
    return meta


def main(argv=None):
    ap = argparse.ArgumentParser(description="Datos de «¿Qué le va a mi PC?» desde BuildCores OpenDB.")
    ap.add_argument("--opendb", required=True, help="carpeta con una copia de buildcores-open-db")
    ap.add_argument("--salida", default=os.path.join(RAIZ, "datos-pc"))
    ap.add_argument("--reglas", default=os.path.join(RAIZ, "pc", "reglas.json"))
    ap.add_argument("--anterior", help="carpeta con los datos anteriores: si ahora salen muchas menos piezas, no se escribe nada")
    ap.add_argument("--correcciones", default=os.path.join(RAIZ, "pc", "correcciones.json"),
                    help="placas revisadas a mano (vacío para no aplicar ninguna)")
    a = ap.parse_args(argv)
    meta = preparar(a.opendb, a.salida, a.reglas, a.anterior, a.correcciones)
    p = meta["piezas"]
    print(f"{p['cpu']} procesadores, {p['placas']} placas, {p['ram']} kits de RAM y {p['ssd']} SSD M.2"
          f" (OpenDB {str(meta['commit'] or '?')[:10]}).")
    for k, v in meta["avisos"].items():
        print(f"  {v:5d} × {k}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
