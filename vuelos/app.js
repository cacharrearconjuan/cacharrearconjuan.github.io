"use strict";
// Vuelos con Iberia (Houston por defecto). Esta página no busca por sí misma: lanza la búsqueda en GitHub Actions
// (repositorio privado cacharrearconjuan/Vuelos) y lee allí el resultado, con la llave del usuario.

const REPO = "cacharrearconjuan/Vuelos";
const WORKFLOW = "buscar-web.yml";
const API = "https://api.github.com/repos/" + REPO;

const PASARELAS = {
  JFK: ["Nueva York", true], BOS: ["Boston", true], ORD: ["Chicago", true], MIA: ["Miami", true],
  SFO: ["San Francisco", true], IAD: ["Washington", true], DFW: ["Dallas", true],
  ATL: ["Atlanta", false], PHL: ["Filadelfia", false], CLT: ["Charlotte", false], SEA: ["Seattle", false],
  LAX: ["Los Ángeles", false],
};

// Aerolíneas de vuelos internos en EE. UU. Las que el usuario desmarca no se buscan ni se muestran.
const AEROLINEAS_EEUU = ["United", "American", "Delta", "Southwest", "JetBlue", "Alaska", "Frontier", "Spirit",
  "Allegiant", "Breeze", "Avelo", "Sun Country"];
const HOUSTON = { IAH: "Intercontinental", HOU: "Hobby" };
const MERCADOS = { ES: "España", US: "EE. UU.", GB: "Reino Unido", MX: "México", CO: "Colombia", AR: "Argentina", IN: "India" };

// Equipaje de cada aerolínea (tarifa económica). kg/cm de la maleta facturada, maleta de mano y bolso.
// Datos de las webs de las aerolíneas; cambian a veces: cada vuelo enlaza a las normas oficiales.
const EQUIPAJE = {
  Iberia: { kg: 23, cm: "158 cm (largo + ancho + alto)", mano: "56 × 40 × 25 cm", url: "https://www.iberia.com/es/equipaje/" },
  United: { kg: 23, cm: "158 cm", mano: "56 × 35 × 23 cm", nota: "En Basic Economy no entra la maleta de mano, solo el bolso.", url: "https://www.united.com/es/us/fly/baggage.html" },
  American: { kg: 23, cm: "158 cm", mano: "56 × 36 × 23 cm", url: "https://www.aa.com/i18n/travel-info/baggage/baggage.jsp" },
  Delta: { kg: 23, cm: "158 cm", mano: "56 × 35 × 23 cm", url: "https://www.delta.com/es/es/baggage/overview" },
  Southwest: { kg: 23, cm: "158 cm", mano: "61 × 41 × 25 cm", url: "https://www.southwest.com/help/baggage" },
  JetBlue: { kg: 23, cm: "158 cm", mano: "56 × 35 × 23 cm", nota: "En Blue Basic no entra la maleta de mano, solo el bolso.", url: "https://www.jetblue.com/help/baggage" },
  Alaska: { kg: 23, cm: "158 cm", mano: "56 × 35 × 23 cm", url: "https://www.alaskaair.com/content/travel-info/baggage/overview" },
  Frontier: { kg: 18, cm: "158 cm", mano: "61 × 41 × 25 cm (se paga aparte)", nota: "Gratis solo el bolso: 36 × 46 × 20 cm.", url: "https://www.flyfrontier.com/travel/travel-info/bag-options/" },
  Spirit: { kg: 23, cm: "158 cm", mano: "56 × 46 × 25 cm (se paga aparte)", nota: "Gratis solo el bolso: 46 × 36 × 20 cm.", url: "https://www.spirit.com/optional-services" },
  Allegiant: { kg: 18, cm: "203 cm", mano: "56 × 36 × 23 cm (se paga aparte)", nota: "Gratis solo el bolso: 41 × 38 × 18 cm.", url: "https://www.allegiantair.com/popup/optional-services-fees" },
};

function equipaje(aerolineas) {
  for (const a of aerolineas || []) {
    const clave = Object.keys(EQUIPAJE).find((k) => a.toLowerCase().includes(k.toLowerCase()));
    if (clave) return { nombre: clave, ...EQUIPAJE[clave] };
  }
  return null;
}

function equipajeHtml(v, esIberia) {
  const e = equipaje(v.aerolineas);
  if (!e) {
    return `<div class="equipaje">🧳 Mira el tamaño y peso máximo de la maleta en la web de ${esc(v.aerolineas.join(", "))}.</div>`;
  }
  const iberia = EQUIPAJE.Iberia;
  const aviso = !esIberia && e.kg < iberia.kg
    ? `<div class="equipaje-aviso">⚠️ Máximo <strong>${e.kg} kg</strong> por maleta facturada; con Iberia puedes llevar ${iberia.kg} kg. Si tu maleta pesa más, aquí te cobrarán sobrepeso.</div>`
    : "";
  return `<div class="equipaje">🧳 Facturada: máx. <strong>${e.kg} kg</strong> y ${esc(e.cm)} · Mano: ${esc(e.mano)}${e.nota ? ". " + esc(e.nota) : ""}
    <a href="${esc(e.url)}" target="_blank" rel="noopener">Normas de ${esc(e.nombre)}</a></div>${aviso}`;
}

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
let moneda = "EUR";

const fmtPrecio = (n) => n == null ? "—" : new Intl.NumberFormat("es-ES", { style: "currency", currency: moneda, maximumFractionDigits: 0 }).format(n);
const fmtHora = (iso) => iso.slice(11, 16);
const fmtFecha = (iso) => new Date(iso.slice(0, 10) + "T12:00:00").toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
const fmtEspera = (min) => {
  const d = Math.floor(min / 1440), r = min % 1440;
  const hm = `${Math.floor(r / 60)} h ${String(r % 60).padStart(2, "0")} min`;
  return d ? `${d} d ${hm}` : hm;
};
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
  // la llave también tiene que poder LEER el resultado (permiso Contents)
  const c = await gh(`/contents/README.md?ref=${encodeURIComponent(repo.default_branch)}`);
  if (c.status === 403 || c.status === 404) throw new ErrorPermiso();
  return repo.default_branch;
}

const AYUDA_CONTENTS = "A tu llave le falta el permiso para leer el resultado. En GitHub: Settings → Developer settings → " +
  "Fine-grained tokens → «Vuelos web» → Edit → Repository permissions → Contents: Read-only → Update. " +
  "La llave sigue siendo la misma: no hace falta volver a pegarla.";

class ErrorPermiso extends Error {
  constructor() { super(AYUDA_CONTENTS); }
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
  const t = $("token").value.trim() || guardado.leer("vuelos-token");
  if (!t) return;
  guardado.poner("vuelos-token", t);
  $("token-estado").className = "ayuda";
  $("token-estado").textContent = "Comprobando…";
  try {
    await comprobarLlave();
    $("token").value = "";
    mostrarFormulario();
  } catch (e) {
    if (e instanceof ErrorPermiso) {
      // la llave vale para buscar; solo le falta poder leer: se guarda y se explica cómo arreglarlo
      $("token").value = "";
      mostrarConfigurar(e.message + " Después pulsa «Guardar» otra vez (con la casilla vacía).");
      return;
    }
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
  $("filtro-escala").addEventListener("input", () => ULTIMO?.resultado && dibujar());
  pintarAerolineasFormulario();
  document.querySelectorAll('input[name="destino"]').forEach((r) => r.addEventListener("change", cambiarDestino));
  document.querySelectorAll('input[name="tramos"]').forEach((r) => r.addEventListener("change", cambiarTramos));
  $("otro-destino").addEventListener("input", () => {
    $("titulo-destino").textContent = $("otro-destino").value.trim().toUpperCase() || "otro destino";
  });
  cambiarDestino();
  cambiarTramos();

  if (guardado.leer("vuelos-token")) mostrarFormulario(); else mostrarConfigurar();
}

// Houston es el destino de siempre; «Otro destino» es para una búsqueda puntual (no se guarda).
function cambiarDestino() {
  const otro = document.querySelector('input[name="destino"]:checked').value === "otro";
  $("otro-caja").hidden = !otro;
  $("houston-caja").hidden = otro;
  if (otro) $("otro-destino").focus();
  $("titulo-destino").textContent = otro ? ($("otro-destino").value.trim().toUpperCase() || "otro destino") : "Houston";
}

function leerOtroDestino() {
  const codigos = $("otro-destino").value.toUpperCase().split(/[\s,;/]+/).filter(Boolean);
  const malos = codigos.filter((c) => !/^[A-Z]{3}$/.test(c));
  return { codigos: [...new Set(codigos)].slice(0, 4), malos };
}

const CAMPOS = ["fecha_ida", "fecha_vuelta", "adultos", "maleta", "horas_min", "horas_max", "sumar_iberia", "codigo_compartido",
  "cambiar_aeropuerto", "horas_cambio"];

// Ida y vuelta, solo ida o solo vuelta: se ocultan las fechas que no tocan
function tramos() {
  return document.querySelector('input[name="tramos"]:checked').value;
}
function cambiarTramos() {
  const t = tramos();
  $("caja-ida").hidden = t === "vuelta";
  $("caja-vuelta").hidden = t === "ida";
}
const GRUPOS = { destinos: "houston", pasarelas: "pasarela", mercados: "mercado" };

// ---------------- aerolíneas excluidas (se recuerdan en el móvil) ----------------
let excluidas = new Set();
try { excluidas = new Set(JSON.parse(guardado.leer("vuelos-excluir")) || []); } catch (_) { excluidas = new Set(); }
const vuelaCon = (nombre, ex) => nombre.toLowerCase().includes(ex.toLowerCase()) || ex.toLowerCase().includes(nombre.toLowerCase());
const estaExcluida = (nombre) => [...excluidas].some((ex) => vuelaCon(nombre, ex));

function cambiarExcluida(nombre, quitar) {
  if (quitar) excluidas.add(nombre);
  else [...excluidas].filter((ex) => vuelaCon(nombre, ex)).forEach((ex) => excluidas.delete(ex));
  guardado.poner("vuelos-excluir", JSON.stringify([...excluidas]));
  document.querySelectorAll('input[name="aerolinea"]').forEach((e) => (e.checked = !estaExcluida(e.value)));
}

function pintarAerolineasFormulario() {
  $("aerolineas").innerHTML = AEROLINEAS_EEUU.map((a) =>
    `<label><input type="checkbox" name="aerolinea" value="${esc(a)}" ${estaExcluida(a) ? "" : "checked"}> ${esc(a)}</label>`).join("");
  document.querySelectorAll('input[name="aerolinea"]').forEach((e) =>
    e.addEventListener("change", () => cambiarExcluida(e.value, !e.checked)));
}

function leerFormulario() {
  const d = { origen: "MAD", moneda: "EUR", excluir_aerolineas: [...excluidas] };
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
  const t = tramos();
  if (t === "vuelta") datos.fecha_ida = "";
  if (t === "ida") datos.fecha_vuelta = "";
  if (t !== "vuelta" && !datos.fecha_ida) return alert("Pon la fecha de ida.");
  if (t !== "ida" && !datos.fecha_vuelta) return alert("Pon la fecha de vuelta (el día del Iberia a Madrid).");
  if (datos.fecha_ida && datos.fecha_vuelta && datos.fecha_vuelta < datos.fecha_ida) return alert("La vuelta no puede ser antes que la ida.");
  datos.tramos = t;
  if (!datos.pasarelas.length) return alert("Marca al menos una ciudad de Iberia.");
  const otro = document.querySelector('input[name="destino"]:checked').value === "otro";
  if (otro) {
    const { codigos, malos } = leerOtroDestino();
    if (malos.length) return alert(`«${malos.join(", ")}» no es un código de aeropuerto. Usa 3 letras, p. ej. LAS.`);
    if (!codigos.length) return alert("Escribe el código del aeropuerto de destino, p. ej. LAS.");
    datos.destinos = codigos;
  } else if (!datos.destinos.length) {
    return alert("Marca al menos un aeropuerto de Houston.");
  }
  if (!datos.mercados.length) return alert("Marca al menos un mercado.");
  // se guardan las preferencias, pero no un destino puntual: la próxima vez vuelve a Houston
  guardado.poner("vuelos-form", JSON.stringify(otro ? { ...datos, destinos: undefined } : datos));

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
  $("fase").textContent = (e instanceof ErrorPermiso ? "" : "Error: ") + e.message;
  if (e instanceof ErrorPermiso) {
    $("enlace-run").hidden = false;
    $("enlace-run").innerHTML = '<a href="https://github.com/settings/personal-access-tokens" target="_blank" rel="noopener">Abrir mis llaves en GitHub</a> · ' +
      "Cuando lo cambies, pulsa «Ver la última búsqueda»: el resultado ya está guardado.";
    $("ver-ultima").hidden = !guardado.leer("vuelos-ultima");
  }
}

async function leerResultado(id) {
  const r = await gh(`/contents/resultados/${id}.json?ref=resultados`, { headers: { Accept: "application/vnd.github.raw+json" } });
  if (r.status === 404) return null;
  if (r.status === 403) throw new ErrorPermiso();
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
let ULTIMO = null; // el último resultado, para poder filtrarlo sin volver a buscar

function pintar(estado) {
  ULTIMO = estado;
  $("progreso").hidden = true;
  $("resultados").hidden = false;
  const errores = estado.errores || [];
  $("errores-caja").hidden = !errores.length;
  $("errores-titulo").textContent = `Avisos (${errores.length} consultas fallidas)`;
  $("errores").innerHTML = errores.map((x) => `<li>${esc(x)}</li>`).join("");

  const res = estado.resultado;
  $("filtro").hidden = !res;
  if (!res) {
    $("resumen").innerHTML = cifra("Error", "—", esc(estado.fase || "La búsqueda no terminó"), false);
    $("bloque-ida").innerHTML = $("bloque-vuelta").innerHTML = "";
    return;
  }
  // la barra va de la escala mínima a la máxima con la que se buscó
  const min = Number(res.peticion.horas_min) || 3;
  const max = Math.max(min, Number(res.peticion.horas_max) || 12);
  const barra = $("filtro-escala");
  barra.min = min;
  barra.max = max;
  barra.value = max;
  dibujar();
  $("resultados").scrollIntoView({ behavior: "smooth" });
}

// Deja solo las opciones con escala <= horas y recalcula el resumen y la tabla por ciudad.
function filtrar(res, horas) {
  const limite = horas * 60;
  const parte = (d) => {
    if (!d) return d;
    const opciones = d.opciones.filter((o) => o.espera_min <= limite && !o.domestico.aerolineas.some(estaExcluida));
    const vistas = new Set();
    const porCiudad = opciones.filter((o) => !vistas.has(o.pasarela) && vistas.add(o.pasarela))
      .map(({ pasarela, ciudad, total, precio_domestico, espera_min }) => ({ pasarela, ciudad, total, precio_domestico, espera_min }));
    return { ...d, opciones, por_ciudad: porCiudad };
  };
  const ida = parte(res.ida);
  const vuelta = parte(res.vuelta);
  const mejores = [ida, vuelta].filter(Boolean).map((d) => d.opciones[0]);
  const mejor_total = mejores.length && mejores.every(Boolean) ? mejores.reduce((a, o) => a + o.total, 0) : null;
  return { ...res, ida, vuelta, mejor_total };
}

// Casillas de aerolíneas en los resultados: las que salen en los vuelos internos + las excluidas.
function pintarFiltroAerolineas() {
  const res = ULTIMO.resultado;
  const precios = new Map();
  for (const d of [res.ida, res.vuelta]) {
    for (const o of d?.opciones || []) {
      for (const a of o.domestico.aerolineas) {
        if (!precios.has(a) || o.total < precios.get(a)) precios.set(a, o.total);
      }
    }
  }
  const nombres = [...precios.keys()].sort((a, b) => precios.get(a) - precios.get(b));
  for (const ex of excluidas) if (!nombres.some((n) => vuelaCon(n, ex))) nombres.push(ex);
  const enBusqueda = res.peticion.excluir_aerolineas || [];
  $("filtro-aerolineas").innerHTML = nombres.map((a) => {
    const desde = precios.has(a) ? ` <small>desde ${fmtPrecio(precios.get(a))}</small>` : "";
    return `<label><input type="checkbox" name="filtro-aerolinea" value="${esc(a)}" ${estaExcluida(a) ? "" : "checked"}> ${esc(a)}${desde}</label>`;
  }).join("") || "<small>Sin vuelos internos en los resultados.</small>";
  document.querySelectorAll('input[name="filtro-aerolinea"]').forEach((e) => e.addEventListener("change", () => {
    cambiarExcluida(e.value, !e.checked);
    const sinBuscar = e.checked && enBusqueda.some((ex) => vuelaCon(e.value, ex));
    $("filtro-aero-nota").textContent = sinBuscar
      ? `${e.value} no se buscó en esta búsqueda: vuelve a buscar para ver sus vuelos.`
      : "Desmarca una aerolínea para quitar sus vuelos. Se recuerda para las próximas búsquedas.";
    dibujar();
  }));
}

function dibujar() {
  const barra = $("filtro-escala");
  const horas = Number(barra.value);
  const recortado = horas < Number(barra.max);
  $("filtro-valor").textContent = `${String(horas).replace(".", ",")} h`;
  $("filtro-nota").textContent = recortado
    ? `Mostrando solo escalas de hasta ${String(horas).replace(".", ",")} h (buscaste hasta ${barra.max} h).`
    : "Mueve la barra para ver solo escalas más cortas, sin volver a buscar.";

  const res = filtrar(ULTIMO.resultado, horas);
  const p = res.peticion;
  moneda = p.moneda || "EUR";
  const ida = res.ida?.opciones[0];
  const vta = res.vuelta?.opciones[0];
  const nota = p.sumar_iberia ? "vuelo interno + Iberia" : "solo vuelo interno";
  const extra = `${p.adultos > 1 ? ` · ${p.adultos} adultos` : ""}${p.maleta ? " · con maleta" : " · sin maleta"}`;
  const consejo = excluidas.size ? "Sube la escala máxima o vuelve a marcar aerolíneas" :
    recortado ? "Sube la escala máxima con la barra" : "Prueba más ciudades o más horas de escala";
  pintarFiltroAerolineas(res);
  let html = "";
  if (res.ida) {
    html += cifra("Ida más barata", ida ? fmtPrecio(ida.total) : "Sin opciones",
      ida ? `vía ${esc(ida.ciudad)} · escala ${fmtEspera(ida.espera_min)}` : consejo, !!ida);
  }
  if (res.vuelta) {
    html += cifra("Vuelta más barata", vta ? fmtPrecio(vta.total) : "Sin opciones",
      vta ? `vía ${esc(vta.ciudad)} · escala ${fmtEspera(vta.espera_min)}` : consejo, !!vta);
  }
  if (res.mejor_total != null && res.ida && res.vuelta) html += cifra("Total ida + vuelta", fmtPrecio(res.mejor_total), nota + extra, true);
  $("resumen").innerHTML = html;

  const dest = esc(res.destino || "Houston");
  $("bloque-ida").innerHTML = res.ida ? bloque(`Ida · ${fmtFecha(p.fecha_ida)}: Madrid → EE. UU. → ${dest}`, res.ida, "ida") : "";
  $("bloque-vuelta").innerHTML = res.vuelta ? bloque(`Vuelta · ${fmtFecha(p.fecha_vuelta)}: ${dest} → EE. UU. → Madrid`, res.vuelta, "vuelta") : "";
  document.querySelectorAll(".mas").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll(`.opcion[data-sentido="${b.dataset.sentido}"][hidden]`).forEach((o) => (o.hidden = false));
    b.remove();
  }));
}

function cifra(etq, valor, detalle, destacada) {
  return `<div class="cifra ${destacada ? "destacada" : ""}"><div class="etiqueta">${etq}</div><div class="valor">${valor}</div><div class="detalle">${detalle}</div></div>`;
}

function bloque(titulo, datos, sentido) {
  let h = `<section class="tarjeta"><h2 style="margin-top:0">${titulo}</h2>`;
  if (datos.por_ciudad.length) {
    h += `<table class="tabla-ciudades"><thead><tr><th>Conexión en</th><th class="num">Precio</th><th class="num">Escala</th></tr></thead><tbody>`;
    h += datos.por_ciudad.map((c, i) => `<tr><td>${i === 0 ? "🏆 " : ""}${esc(c.ciudad)} (${esc(c.pasarela)})</td><td class="num"><strong>${fmtPrecio(c.total)}</strong></td><td class="num">${fmtEspera(c.espera_min)}</td></tr>`).join("");
    h += `</tbody></table>`;
  }
  if (datos.ciudades_sin_iberia.length) {
    h += `<p class="sin-iberia">Sin vuelo directo de Iberia ese día: ${datos.ciudades_sin_iberia.map(esc).join(", ")}.</p>`;
  }
  if (!datos.opciones.length) {
    return h + `<p>No hay combinaciones que cumplan las reglas. Prueba a marcar más ciudades o a subir la escala máxima.</p></section>`;
  }
  const VISIBLES = 6;
  h += datos.opciones.map((o, i) => opcion(o, i, sentido, i >= VISIBLES)).join("");
  if (datos.opciones.length > VISIBLES) h += `<button type="button" class="mas" data-sentido="${sentido}">Ver ${datos.opciones.length - VISIBLES} opciones más</button>`;
  return h + `</section>`;
}

function tramoHtml(v, titulo, conMercados, esIberia = false) {
  const num = v.numeros.length ? " · " + esc(v.numeros.join(", ")) : "";
  const precios = Object.entries(v.precios_mercado || {});
  let mercados = "";
  if (conMercados && precios.length > 1) {
    mercados = `<div class="mercados-lista">${precios.map(([m, p]) => `${esc(m)} ${fmtPrecio(p)}`).join(" · ")}</div>`;
  }
  const chip = conMercados && v.mercado ? `<span class="mercado-chip">mercado ${esc(v.mercado)}</span>` : "";
  const maleta = v.maleta_estimada
    ? `<div class="maleta-estimada">Incluye maleta <strong>estimada</strong> +${fmtPrecio(v.maleta_estimada)}: Google no sabe lo que cobra ${esc(v.aerolineas.join(", "))} por la maleta. Compruébalo al comprar.</div>`
    : "";
  return `<div class="tramo"><div class="sub">${titulo}</div>
    <b>${esc(v.origen)} ${fmtHora(v.salida)} → ${esc(v.destino)} ${fmtHora(v.llegada)}</b>${otroDia(v.salida, v.llegada)}
    <div class="sub">${fmtFecha(v.salida)} · ${esc(v.aerolineas.join(", "))}${num}</div>
    <div class="sub">Precio: ${fmtPrecio(v.precio)}${chip}</div>${mercados}${maleta}${equipajeHtml(v, esIberia)}</div>`;
}

function opcion(o, i, sentido, oculta) {
  const ib = tramoHtml(o.iberia, "Iberia (ya lo tienes)", false, true);
  const dom = tramoHtml(o.domestico, "Vuelo interno directo", true);
  const noches = o.noches ? `<span class="noches">${o.noches} noche${o.noches > 1 ? "s" : ""} en ${esc(o.ciudad)}</span>` : "";
  let lugar = `mismo aeropuerto · ${esc(o.pasarela)}`;
  if (o.cambio_aeropuerto) {
    const [llega, sale] = sentido === "ida" ? [o.pasarela, o.aeropuerto_conexion] : [o.aeropuerto_conexion, o.pasarela];
    lugar = `<span class="alerta">cambio de aeropuerto: llegas a ${esc(llega)}, sales de ${esc(sale)}</span>`;
  }
  const espera = `<div class="espera">escala<strong>${fmtEspera(o.espera_min)}</strong>${lugar}${noches}</div>`;
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
