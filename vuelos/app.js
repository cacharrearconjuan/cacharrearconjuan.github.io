"use strict";
// Vuelos Iberia ⇄ Houston. Esta página no busca por sí misma: lanza la búsqueda en GitHub Actions
// (repositorio privado cacharrearconjuan/Vuelos) y lee allí el resultado, con la llave del usuario.

const REPO = "cacharrearconjuan/Vuelos";
const WORKFLOW = "buscar-web.yml";
const API = "https://api.github.com/repos/" + REPO;

const PASARELAS = {
  JFK: ["Nueva York", true], BOS: ["Boston", true], ORD: ["Chicago", true], MIA: ["Miami", true],
  SFO: ["San Francisco", true], IAD: ["Washington", true], DFW: ["Dallas", true],
  ATL: ["Atlanta", false], PHL: ["Filadelfia", false], CLT: ["Charlotte", false], SEA: ["Seattle", false],
};
const HOUSTON = { IAH: "Intercontinental", HOU: "Hobby" };
const MERCADOS = { ES: "España", US: "EE. UU.", GB: "Reino Unido", MX: "México", CO: "Colombia", AR: "Argentina", IN: "India" };

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
let moneda = "EUR";

const fmtPrecio = (n) => n == null ? "—" : new Intl.NumberFormat("es-ES", { style: "currency", currency: moneda, maximumFractionDigits: 0 }).format(n);
const fmtHora = (iso) => iso.slice(11, 16);
const fmtFecha = (iso) => new Date(iso.slice(0, 10) + "T12:00:00").toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
const fmtEspera = (min) => `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min`;
const otroDia = (a, b) => a.slice(0, 10) !== b.slice(0, 10) ? ` <span class="sub">(${fmtFecha(b)})</span>` : "";

// ---------------- almacenamiento en el móvil ----------------
const guardado = {
  leer(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
  poner(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (_) { /* sin almacenamiento */ } },
};

// ---------------- GitHub ----------------
async function gh(ruta, opciones = {}) {
  const token = guardado.leer("vuelos-token");
  const r = await fetch(API + ruta, {
    cache: "no-store",
    ...opciones,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: "Bearer " + token,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(opciones.headers || {}),
    },
  });
  if (r.status === 401) throw new ErrorLlave("La llave no es válida o ha caducado. Crea otra y pégala de nuevo.");
  return r;
}

class ErrorLlave extends Error {}

async function comprobarLlave() {
  const r = await gh("");
  if (r.status === 404) throw new ErrorLlave("La llave no da acceso al repositorio Vuelos. Revisa que elegiste «Vuelos» en Repository access.");
  if (!r.ok) throw new Error("GitHub respondió " + r.status);
  const repo = await r.json();
  guardado.poner("vuelos-rama", repo.default_branch);
  return repo.default_branch;
}

// ---------------- pantalla ----------------
function mostrarConfigurar(mensaje) {
  $("configurar").hidden = false;
  $("formulario").hidden = true;
  $("token-estado").textContent = mensaje || "";
  $("token-estado").className = mensaje ? "error-caja" : "ayuda";
}

function mostrarFormulario() {
  $("configurar").hidden = true;
  $("formulario").hidden = false;
  $("ver-ultima").hidden = !guardado.leer("vuelos-ultima");
}

async function guardarToken() {
  const t = $("token").value.trim();
  if (!t) return;
  guardado.poner("vuelos-token", t);
  $("token-estado").className = "ayuda";
  $("token-estado").textContent = "Comprobando…";
  try {
    await comprobarLlave();
    $("token").value = "";
    mostrarFormulario();
  } catch (e) {
    guardado.poner("vuelos-token", null);
    mostrarConfigurar(e.message);
  }
}

function iniciar() {
  $("houston").innerHTML = Object.entries(HOUSTON).map(([c, n]) =>
    `<label><input type="checkbox" name="houston" value="${c}" checked> ${c} <small>${n}</small></label>`).join("");
  $("pasarelas").innerHTML = Object.entries(PASARELAS).map(([c, [n, def]]) =>
    `<label><input type="checkbox" name="pasarela" value="${c}" ${def ? "checked" : ""}> ${n} (${c})</label>`).join("");
  $("mercados").innerHTML = Object.entries(MERCADOS).map(([c, n]) =>
    `<label><input type="checkbox" name="mercado" value="${c}" checked> ${n}</label>`).join("");

  const d = new Date();
  d.setDate(d.getDate() + 30);
  $("fecha_ida").value = d.toISOString().slice(0, 10);
  cargarFormulario();

  $("guardar-token").addEventListener("click", guardarToken);
  $("cambiar-token").addEventListener("click", () => { guardado.poner("vuelos-token", null); mostrarConfigurar(); });
  $("ver-ultima").addEventListener("click", () => seguir(guardado.leer("vuelos-ultima"), null, true));
  $("formulario").addEventListener("submit", buscar);

  if (guardado.leer("vuelos-token")) mostrarFormulario(); else mostrarConfigurar();
}

const CAMPOS = ["fecha_ida", "fecha_vuelta", "adultos", "maleta", "horas_min", "horas_max", "sumar_iberia", "codigo_compartido"];
const GRUPOS = { destinos: "houston", pasarelas: "pasarela", mercados: "mercado" };

function leerFormulario() {
  const d = { origen: "MAD", moneda: "EUR" };
  for (const c of CAMPOS) d[c] = $(c).type === "checkbox" ? $(c).checked : $(c).value;
  for (const [clave, nombre] of Object.entries(GRUPOS)) {
    d[clave] = [...document.querySelectorAll(`input[name="${nombre}"]:checked`)].map((e) => e.value);
  }
  return d;
}

function cargarFormulario() {
  let d = null;
  try { d = JSON.parse(guardado.leer("vuelos-form")); } catch (_) { d = null; }
  if (!d) return;
  for (const c of CAMPOS) {
    if (!(c in d)) continue;
    if ($(c).type === "checkbox") $(c).checked = d[c]; else if (d[c] !== "") $(c).value = d[c];
  }
  for (const [clave, nombre] of Object.entries(GRUPOS)) {
    if (Array.isArray(d[clave])) document.querySelectorAll(`input[name="${nombre}"]`).forEach((e) => (e.checked = d[clave].includes(e.value)));
  }
}

// ---------------- búsqueda ----------------
function nuevoId() {
  const t = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  return `${t}-${Math.random().toString(36).slice(2, 8)}`;
}

async function buscar(ev) {
  ev.preventDefault();
  const datos = leerFormulario();
  if (!datos.fecha_ida) return alert("Pon la fecha de ida.");
  if (datos.fecha_vuelta && datos.fecha_vuelta < datos.fecha_ida) return alert("La vuelta no puede ser antes que la ida.");
  if (!datos.pasarelas.length) return alert("Marca al menos una ciudad de Iberia.");
  if (!datos.destinos.length) return alert("Marca al menos un aeropuerto de Houston.");
  if (!datos.mercados.length) return alert("Marca al menos un mercado.");
  guardado.poner("vuelos-form", JSON.stringify(datos));

  const id = nuevoId();
  $("boton").disabled = true;
  verProgreso("Enviando la búsqueda a GitHub…", 2);
  try {
    const rama = guardado.leer("vuelos-rama") || (await comprobarLlave());
    const r = await gh(`/actions/workflows/${WORKFLOW}/dispatches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ref: rama, inputs: { id, peticion: JSON.stringify(datos) } }),
    });
    if (r.status === 403 || r.status === 404) {
      throw new ErrorLlave("La llave no tiene permiso para lanzar búsquedas. Revisa que «Actions» esté en «Read and write».");
    }
    if (!r.ok) throw new Error("GitHub respondió " + r.status + " al lanzar la búsqueda");
    guardado.poner("vuelos-ultima", id);
    await seguir(id, Date.now(), false);
  } catch (e) {
    fallo(e);
  } finally {
    $("boton").disabled = false;
  }
}

function verProgreso(texto, pct) {
  $("progreso").hidden = false;
  $("resultados").hidden = true;
  $("fase").textContent = texto;
  $("barra-relleno").style.width = pct + "%";
}

function fallo(e) {
  if (e instanceof ErrorLlave) {
    $("progreso").hidden = true;
    guardado.poner("vuelos-token", null);
    mostrarConfigurar(e.message);
    return;
  }
  $("progreso").hidden = false;
  $("fase").textContent = "Error: " + e.message;
}

async function leerResultado(id) {
  const r = await gh(`/contents/resultados/${id}.json?ref=resultados`, { headers: { Accept: "application/vnd.github.raw+json" } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error("GitHub respondió " + r.status + " al leer el resultado");
  return r.json();
}

async function buscarEjecucion(id) {
  const r = await gh(`/actions/workflows/${WORKFLOW}/runs?per_page=10`);
  if (!r.ok) return null;
  const j = await r.json();
  return (j.workflow_runs || []).find((x) => (x.display_title || "").includes(id)) || null;
}

async function seguir(id, inicio, soloLeer) {
  if (!id) return;
  try {
    if (soloLeer) {
      verProgreso("Cargando la última búsqueda…", 50);
      const res = await leerResultado(id);
      if (res) return pintar(res);
      // si aún no ha terminado, se sigue esperando
      inicio = Date.now();
    }
    const ESPERADO = 120000; // ~2 minutos
    let ejecucion = null;
    let vueltas = 0;
    for (;;) {
      const t = Date.now() - inicio;
      const res = await leerResultado(id);
      if (res) {
        $("barra-relleno").style.width = "100%";
        return pintar(res);
      }
      if (vueltas % 2 === 0) ejecucion = (await buscarEjecucion(id)) || ejecucion;
      vueltas++;
      let texto = "Esperando a que GitHub empiece…";
      if (ejecucion?.status === "in_progress") texto = "Buscando en Google Flights en todos los mercados…";
      if (ejecucion?.status === "completed") {
        texto = "Guardando el resultado…";
        if (ejecucion.conclusion !== "success" && t > 30000) {
          throw new Error("La búsqueda ha fallado en GitHub. Abre el enlace de abajo para ver el motivo.");
        }
      }
      if (ejecucion) {
        $("enlace-run").hidden = false;
        $("enlace-run").innerHTML = `<a href="${esc(ejecucion.html_url)}" target="_blank" rel="noopener">Ver la búsqueda en GitHub</a>`;
      }
      $("fase").textContent = `${texto} (${Math.round(t / 1000)} s)`;
      $("barra-relleno").style.width = Math.min(95, 3 + (92 * t) / ESPERADO) + "%";
      if (t > 15 * 60000) throw new Error("La búsqueda tarda demasiado. Mírala en GitHub con el enlace de abajo.");
      await pausa(5000);
    }
  } catch (e) {
    fallo(e);
  }
}

// ---------------- resultados ----------------
function pintar(estado) {
  $("progreso").hidden = true;
  $("resultados").hidden = false;
  const errores = estado.errores || [];
  $("errores-caja").hidden = !errores.length;
  $("errores-titulo").textContent = `Avisos (${errores.length} consultas fallidas)`;
  $("errores").innerHTML = errores.map((x) => `<li>${esc(x)}</li>`).join("");

  const res = estado.resultado;
  if (!res) {
    $("resumen").innerHTML = cifra("Error", "—", esc(estado.fase || "La búsqueda no terminó"), false);
    $("bloque-ida").innerHTML = $("bloque-vuelta").innerHTML = "";
    return;
  }
  const p = res.peticion;
  moneda = p.moneda || "EUR";
  const ida = res.ida.opciones[0];
  const vta = res.vuelta?.opciones[0];
  const nota = p.sumar_iberia ? "vuelo interno + Iberia" : "solo vuelo interno";
  const extra = `${p.adultos > 1 ? ` · ${p.adultos} adultos` : ""}${p.maleta ? " · con maleta" : " · sin maleta"}`;
  let html = cifra("Ida más barata", ida ? fmtPrecio(ida.total) : "Sin opciones",
    ida ? `vía ${esc(ida.ciudad)} · ${fmtFecha(ida.domestico.salida)}` : "Prueba más ciudades o más horas de espera", !!ida);
  if (res.vuelta) {
    html += cifra("Vuelta más barata", vta ? fmtPrecio(vta.total) : "Sin opciones",
      vta ? `vía ${esc(vta.ciudad)} · ${fmtFecha(vta.domestico.salida)}` : "Prueba más ciudades o más horas de espera", !!vta);
  }
  if (res.mejor_total != null && res.vuelta) html += cifra("Total ida + vuelta", fmtPrecio(res.mejor_total), nota + extra, true);
  $("resumen").innerHTML = html;

  $("bloque-ida").innerHTML = bloque(`Ida · ${fmtFecha(p.fecha_ida)}: Madrid → EE. UU. → Houston`, res.ida, "ida");
  $("bloque-vuelta").innerHTML = res.vuelta ? bloque(`Vuelta · ${fmtFecha(p.fecha_vuelta)}: Houston → EE. UU. → Madrid`, res.vuelta, "vuelta") : "";
  document.querySelectorAll(".mas").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll(`.opcion[data-sentido="${b.dataset.sentido}"][hidden]`).forEach((o) => (o.hidden = false));
    b.remove();
  }));
  $("resultados").scrollIntoView({ behavior: "smooth" });
}

function cifra(etq, valor, detalle, destacada) {
  return `<div class="cifra ${destacada ? "destacada" : ""}"><div class="etiqueta">${etq}</div><div class="valor">${valor}</div><div class="detalle">${detalle}</div></div>`;
}

function bloque(titulo, datos, sentido) {
  let h = `<section class="tarjeta"><h2 style="margin-top:0">${titulo}</h2>`;
  if (datos.por_ciudad.length) {
    h += `<table class="tabla-ciudades"><thead><tr><th>Conexión en</th><th class="num">Precio</th><th class="num">Espera</th></tr></thead><tbody>`;
    h += datos.por_ciudad.map((c, i) => `<tr><td>${i === 0 ? "🏆 " : ""}${esc(c.ciudad)} (${esc(c.pasarela)})</td><td class="num"><strong>${fmtPrecio(c.total)}</strong></td><td class="num">${fmtEspera(c.espera_min)}</td></tr>`).join("");
    h += `</tbody></table>`;
  }
  if (datos.ciudades_sin_iberia.length) {
    h += `<p class="sin-iberia">Sin vuelo directo de Iberia ese día: ${datos.ciudades_sin_iberia.map(esc).join(", ")}.</p>`;
  }
  if (!datos.opciones.length) {
    return h + `<p>No hay combinaciones que cumplan las reglas. Prueba a marcar más ciudades o a aumentar la espera máxima.</p></section>`;
  }
  const VISIBLES = 6;
  h += datos.opciones.map((o, i) => opcion(o, i, sentido, i >= VISIBLES)).join("");
  if (datos.opciones.length > VISIBLES) h += `<button type="button" class="mas" data-sentido="${sentido}">Ver ${datos.opciones.length - VISIBLES} opciones más</button>`;
  return h + `</section>`;
}

function tramoHtml(v, titulo, conMercados) {
  const num = v.numeros.length ? " · " + esc(v.numeros.join(", ")) : "";
  const precios = Object.entries(v.precios_mercado || {});
  let mercados = "";
  if (conMercados && precios.length > 1) {
    mercados = `<div class="mercados-lista">${precios.map(([m, p]) => `${esc(m)} ${fmtPrecio(p)}`).join(" · ")}</div>`;
  }
  const chip = conMercados && v.mercado ? `<span class="mercado-chip">mercado ${esc(v.mercado)}</span>` : "";
  return `<div class="tramo"><div class="sub">${titulo}</div>
    <b>${esc(v.origen)} ${fmtHora(v.salida)} → ${esc(v.destino)} ${fmtHora(v.llegada)}</b>${otroDia(v.salida, v.llegada)}
    <div class="sub">${fmtFecha(v.salida)} · ${esc(v.aerolineas.join(", "))}${num}</div>
    <div class="sub">Precio: ${fmtPrecio(v.precio)}${chip}</div>${mercados}</div>`;
}

function opcion(o, i, sentido, oculta) {
  const ib = tramoHtml(o.iberia, "Iberia (ya lo tienes)", false);
  const dom = tramoHtml(o.domestico, "Vuelo interno directo", true);
  const espera = `<div class="espera">conexión<strong>${fmtEspera(o.espera_min)}</strong>mismo aeropuerto · ${esc(o.pasarela)}</div>`;
  const ruta = sentido === "ida" ? ib + espera + dom : dom + espera + ib;
  const enlaces = Object.entries(o.enlaces).map(([n, u], k) => `<a href="${esc(u)}" target="_blank" rel="noopener" class="${k === 0 ? "principal" : ""}">${esc(n)}</a>`).join("");
  const enlacesIb = Object.entries(o.enlaces_iberia || {}).map(([n, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(n)}</a>`).join("");
  const aviso = o.iberia.aerolineas.some((a) => !/iberia/i.test(a)) ? `<p class="alerta">Ojo: el vuelo transatlántico lo opera ${esc(o.iberia.aerolineas.join(", "))} (código compartido).</p>` : "";
  return `<article class="opcion ${i === 0 ? "mejor" : ""}" data-sentido="${sentido}" ${oculta ? "hidden" : ""}>
    <div class="opcion-cab"><div><strong>${esc(o.ciudad)}</strong>${i === 0 ? '<span class="etiqueta-mejor">MÁS BARATO</span>' : ""}</div>
    <div class="precio">${fmtPrecio(o.total)} <small>${o.total !== o.precio_domestico ? "con Iberia" : "vuelo interno"}</small></div></div>
    <div class="ruta">${ruta}</div>${aviso}
    <div class="enlaces">${enlaces}${enlacesIb}</div></article>`;
}

iniciar();
