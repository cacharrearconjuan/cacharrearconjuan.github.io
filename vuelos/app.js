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
  pintarCoche(res);
  document.querySelectorAll(".mas").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll(`.opcion[data-sentido="${b.dataset.sentido}"][hidden]`).forEach((o) => (o.hidden = false));
    b.remove();
  }));
}

// ---------------- alternativa en coche: Dallas (DFW) ⇄ Houston ----------------
// No hay ninguna fuente gratis con precios reales de alquiler: se calcula una estimación con valores
// típicos (editables y guardados en el móvil) y se enlaza a los buscadores con DFW → Houston ya puesto.
const COCHE_DEFECTO = {
  tarifa: 55,        // $ por 1 día, coche pequeño/medio, recogida en el aeropuerto
  solo_ida: 50,      // $ recargo por devolverlo en otra ciudad (Houston)
  seguros_espana: 35, // $ por día: lo que suma el seguro completo en un paquete «todo incluido» reservado desde España (no residentes)
  seguros: 65,       // $ por día, «a tope», comprado en el mostrador (webs de EE. UU.): daños y robo sin franquicia (LDW/CDW) + responsabilidad civil ampliada (SLI) + accidentes/efectos personales + asistencia en carretera
  impuestos: 25,     // % impuestos de Texas + tasa de concesión del aeropuerto
  tasas: 8,          // $ tasas fijas por día (instalaciones del aeropuerto, matrícula)
  gasolina: 30,      // $ unos 400 km DFW → Houston (devolverlo con el depósito como lo recogiste)
  peajes: 0,         // $ la I-45 no tiene peaje; si usas autopistas de peaje en Dallas, añádelo
  joven: 0,          // $ por día si algún conductor tiene menos de 25 años (suele ser 25–35 $)
  cambio: 0.86,      // € por 1 $
  aduana: 1.5,       // h desde que aterriza Iberia hasta tener el coche (inmigración, maleta, autobús al centro de alquiler)
  conducir: 4,       // h de DFW a Houston
  // recogida en una oficina de la ciudad (vuelta): sin la tasa del aeropuerto
  direccion: "Bering Dr, Houston, TX",
  impuestos_ciudad: 12, // % fuera del aeropuerto (impuesto de alquiler de Texas, sin tasa de concesión del aeropuerto)
  tasas_ciudad: 2,      // $ tasas fijas fuera del aeropuerto
  trafico: 0.5,         // h de más para salir de Houston (Galleria → I-45)
};
const COCHE_CAMPOS = [
  ["tarifa", "Alquiler 1 día ($)"], ["solo_ida", "Recargo por dejarlo en otra ciudad ($)"],
  ["seguros_espana", "Seguro completo en paquete desde España ($/día)"],
  ["seguros", "Seguro completo comprado en el mostrador, web de EE. UU. ($/día)"], ["impuestos", "Impuestos y tasa del aeropuerto (%)"],
  ["tasas", "Tasas fijas ($)"], ["gasolina", "Gasolina ($)"], ["peajes", "Peajes ($)"],
  ["joven", "Conductor menor de 25 años ($)"], ["cambio", "Cambio (€ por 1 $)"],
  ["aduana", "Horas desde que aterrizas hasta tener el coche"], ["conducir", "Horas conduciendo DFW ⇄ Houston"],
  ["impuestos_ciudad", "Impuestos en una oficina de la ciudad (%)"], ["tasas_ciudad", "Tasas fijas en la ciudad ($)"],
  ["trafico", "Horas de más por el tráfico de Houston"],
];
let coche = { ...COCHE_DEFECTO };
try { coche = { ...COCHE_DEFECTO, ...(JSON.parse(guardado.leer("vuelos-coche")) || {}) }; } catch (_) { coche = { ...COCHE_DEFECTO }; }

function costeCoche(c, ciudad = false, espana = true) {
  const base = c.tarifa + c.solo_ida + (espana ? c.seguros_espana : c.seguros) + c.joven;
  const impuestos = (base * (ciudad ? c.impuestos_ciudad : c.impuestos)) / 100 + (ciudad ? c.tasas_ciudad : c.tasas);
  const usd = base + impuestos + c.gasolina + c.peajes;
  return { usd, eur: Math.round(usd * c.cambio), impuestos };
}

const sumarHoras = (iso, h) => {
  const d = new Date(iso + ":00Z");
  d.setTime(d.getTime() + h * 3600000);
  return d.toISOString().slice(0, 16);
};
const horaKayak = (iso) => `${iso.slice(0, 10)}-${String(Math.max(0, Math.min(23, Number(iso.slice(11, 13))))).padStart(2, "0")}h`;

// ---- Enlaces que abren cada buscador con la búsqueda ya rellenada ----
// Formatos y códigos comprobados uno a uno en cada web (nov. 2026). Dallas = aeropuerto DFW;
// Houston = zona Bering Dr / Galleria (o el aeropuerto IAH/HOU). Donde una web no admite enlaces
// con la búsqueda (Auto Europe, Enterprise) o no tenemos el código del lugar, va a su portada.
const LUGARES = {
  DFW: {
    nombre: "aeropuerto de Dallas (DFW)", kayakEs: "DFW-a16406", kayakCom: "DFW-a16406", priceline: "DFW",
    expediaEs: "Dallas, TX, Estados Unidos (DFW-A. Internacional de Dallas - Fort Worth)",
    expediaCom: "Dallas, TX, United States of America (DFW-Dallas-Fort Worth Intl.)",
    expediaId: "5719620", lat: "32.897552", lon: "-97.040434",
    rc: { nombre: "Aeropuerto internacional de Dallas-Fort Worth", coords: "32.89670181274414,-97.04219818115234", tipo: "A", iata: "DFW" },
    dc: 5072, hertz: "DFWT20", avis: "DFW", avisEs: "Aeropuerto Internacional Dallas/Fort Worth - Estados Unidos (DFW)", avisTipo: "AIRPORT",
  },
  CIUDAD: {
    nombre: "Houston, zona Bering Dr / Galleria", kayakEs: "Houston,Texas,Estados-Unidos-c31193", kayakCom: "Houston,Texas,United-States-c31193",
    priceline: "Bering Dr, Houston, TX 77057, US", expediaEs: "Bering Dr, Houston, Texas, EE. UU.", expediaCom: "Bering Dr, Houston, TX",
    rc: { nombre: "Galleria", coords: "29.75436019897461,-95.47549438476562", tipo: "D" },
    dc: 4765, hertz: "HOUC28", avis: "GLL", avisEs: "Houston Galleria - Estados Unidos", avisTipo: "OTHER",
  },
  IAH: { nombre: "aeropuerto de Houston (IAH)", kayakEs: "IAH", kayakCom: "IAH", priceline: "IAH", expediaEs: "IAH", expediaCom: "IAH", dc: 4765 },
  HOU: { nombre: "aeropuerto de Houston (HOU)", kayakEs: "HOU", kayakCom: "HOU", priceline: "HOU", expediaEs: "HOU", expediaCom: "HOU", dc: 4765 },
};

// Oficinas de la zona Galleria comprobadas (las de Hertz y Avis más cercanas a Bering Dr)
const OFICINAS_GALLERIA = [
  { nombre: "Hertz · Westin Galleria", dir: "5060 West Alabama St, Houston, TX 77056", horario: "entre semana hasta las 17:30" },
  { nombre: "Avis · Houston Galleria", dir: "4825 Richmond Ave, Houston, TX 77027", horario: "entre semana de 7:30 a 18:00" },
];
const ABRE = 9, CIERRA = 17; // horas «seguras» para recoger o dejar el coche en una oficina de barrio

const MESES_AVIS = ["ene.", "feb.", "mar.", "abr.", "may.", "jun.", "jul.", "ago.", "sept.", "oct.", "nov.", "dic."];
const partes = (iso) => ({ y: iso.slice(0, 4), m: iso.slice(5, 7), d: iso.slice(8, 10), H: Number(iso.slice(11, 13)), M: Number(iso.slice(14, 16)) });
const dos = (n) => String(n).padStart(2, "0");
const hora12 = (H) => ({ h: H % 12 === 0 ? 12 : H % 12, ap: H < 12 ? "AM" : "PM" });
const enc = (t) => encodeURIComponent(t).replace(/%2C/g, ",");
const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
  : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => ((Math.random() * 16) | (c === "x" ? 0 : 8)).toString(16)));

const CONSTRUCTORES = {
  "Kayak.es": (o, d, r, e) => `https://www.kayak.es/cars/${o.kayakEs}/${d.kayakEs}/${horaKayak(r)}/${horaKayak(e)}?sort=price_a`,
  "Kayak.com": (o, d, r, e) => `https://www.kayak.com/cars/${o.kayakCom}/${d.kayakCom}/${horaKayak(r)}/${horaKayak(e)}?sort=price_a`,
  "Priceline": (o, d, r, e) => {
    const t = (iso) => `${iso.slice(0, 4)}${iso.slice(5, 7)}${iso.slice(8, 10)}-${iso.slice(11, 16)}`;
    return `https://www.priceline.com/drive/search/r/listings/${enc(o.priceline)}/${enc(d.priceline)}/${t(r)}/${t(e)}/list`;
  },
  "Expedia.es": (o, d, r, e) => {
    const a = partes(r), b = partes(e);
    const q = new URLSearchParams({ locn: o.expediaEs, date1: r.slice(0, 10), d1: r.slice(0, 10), time1: `${a.H}:${a.M}`,
      loc2: d.expediaEs, date2: e.slice(0, 10), d2: e.slice(0, 10), time2: `${b.H}:${b.M}` });
    if (o.expediaId) { q.set("dpln", o.expediaId); q.set("olat", o.lat); q.set("olon", o.lon); }
    if (d.expediaId) { q.set("drid1", d.expediaId); q.set("dlat", d.lat); q.set("dlon", d.lon); }
    return `https://www.expedia.es/carsearch?${q}`;
  },
  "Expedia.com": (o, d, r, e) => {
    const a = partes(r), b = partes(e), ha = hora12(a.H), hb = hora12(b.H);
    const q = new URLSearchParams({ date1: `${a.m}/${a.d}/${a.y}`, date2: `${b.m}/${b.d}/${b.y}`,
      time1: `${ha.h}${dos(a.M)}${ha.ap}`, time2: `${hb.h}${dos(b.M)}${hb.ap}`, locn: o.expediaCom, loc2: d.expediaCom });
    if (o.expediaId) { q.set("dpln", o.expediaId); q.set("olat", o.lat); q.set("olon", o.lon); }
    if (d.expediaId) { q.set("drid1", d.expediaId); q.set("dlat", d.lat); q.set("dlon", d.lon); }
    return `https://www.expedia.com/carsearch?${q}`;
  },
  "Rentalcars": (o, d, r, e) => {
    if (!o.rc || !d.rc) return null;
    const a = partes(r), b = partes(e);
    const q = new URLSearchParams({ intent: "direct", location: "", dropLocation: "",
      locationName: o.rc.nombre, coordinates: o.rc.coords, ftsType: o.rc.tipo,
      dropLocationName: d.rc.nombre, dropCoordinates: d.rc.coords, dropFtsType: d.rc.tipo, driversAge: "30",
      puDay: String(Number(a.d)), puMonth: String(Number(a.m)), puYear: a.y, puHour: String(a.H), puMinute: String(a.M),
      doDay: String(Number(b.d)), doMonth: String(Number(b.m)), doYear: b.y, doHour: String(b.H), doMinute: String(b.M) });
    if (o.rc.iata) q.set("locationIata", o.rc.iata);
    if (d.rc.iata) q.set("dropLocationIata", d.rc.iata);
    return `https://www.rentalcars.com/search-results?${q}`;
  },
  "DiscoverCars": (o, d, r, e) => {
    const sq = btoa(JSON.stringify({ PickupLocationId: o.dc, DropOffLocationId: d.dc, PickupDateTime: `${r}:00`,
      DropOffDateTime: `${e}:00`, ResidenceCountry: "ES", DriverAge: 35, Hash: "" }));
    return `https://www.discovercars.com/es/search/${uuid()}?sq=${encodeURIComponent(sq)}&searchVersion=2`;
  },
  "Hertz.es": (o, d, r, e) => o.hertz && d.hertz
    ? `https://www.hertz.es/es/es/book/vehicles?${new URLSearchParams({ age: "25", ddate: `${e}:00`, did: d.hertz, pCountryCode: "US", pdate: `${r}:00`, pid: o.hertz })}` : null,
  "Hertz.com": (o, d, r, e) => o.hertz && d.hertz
    ? `https://www.hertz.com/us/en/book/vehicles?${new URLSearchParams({ age: "25", ddate: `${e}:00`, did: d.hertz, pCountryCode: "US", pdate: `${r}:00`, pid: o.hertz })}` : null,
  "Avis.es": (o, d, r, e) => {
    if (!o.avis || !d.avis) return null;
    const a = partes(r), b = partes(e);
    const disp = (p) => `${Number(p.d)} ${MESES_AVIS[Number(p.m) - 1]} ${p.y.slice(2)}`;
    // mismos campos y en el mismo orden que la búsqueda comprobada en avis.es (los vacíos también)
    const q = new URLSearchParams({ isNewHomePageTemplate: "true", tid: "", vehicleCategory: "default", exclusiveSearch: "", partnerBrand: "",
      templateName: "AvisBookingFlow:pages/homePageAbg", locationBrand: "avis", dropLocationBrand: "", budgetPickupLocCode: "",
      budgetDropoffLocCode: "", driverDob: "", isUasorSds: "", fccRecg: "", userAwdCode: "", "hire-country": "GB",
      maxLocationRentalDays: "360", afBetaFlow: "",
      "hire-search": o.avisEs, "hire-location": o.avis, "return-search": d.avisEs, "return-location": d.avis, "trigger-return-location": "on",
      "date-from-display": disp(a), "date-from": `${a.d}/${a.m}/${a.y}`, "time-from-display": `${dos(a.H)}:${dos(a.M)}`, "time-from": `${dos(a.H)}${dos(a.M)}`,
      "date-to-display": disp(b), "date-to": `${b.d}/${b.m}/${b.y}`, "time-to-display": `${dos(b.H)}:${dos(b.M)}`, "time-to": `${dos(b.H)}${dos(b.M)}`,
      offerStartDate: "", offerEndDate: "", blackoutStartDate: "", blackoutEndDate: "", cor: "",
      hideAwdNumber: "false", hideAwdCodeAndMessage: "false", "yds-applicable": "on", awdcode: "" });
    return `https://secure.avis.es/resultados-b%C3%BAsqueda?${q}`;
  },
  "Avis.com": (o, d, r, e) => {
    if (!o.avis || !d.avis) return null;
    const a = partes(r), b = partes(e), ha = hora12(a.H), hb = hora12(b.H);
    const q = new URLSearchParams({ pickup_suggestion_type_code: o.avisTipo, dropoff_suggestion_type_code: d.avisTipo, pickup_location_region: "NAM",
      pickup_hour: dos(ha.h), pickup_minute: dos(a.M), pickup_am_pm: ha.ap, pickup_day: a.d, pickup_month: a.m, pickup_year: a.y,
      return_hour: dos(hb.h), return_minute: dos(b.M), return_am_pm: hb.ap, return_day: b.d, return_month: b.m, return_year: b.y,
      residency_value: "US", pickup_location_code: o.avis, return_location_code: d.avis, age: "25", country: "us", locale: "en-US", brand: "avis" });
    return `https://www.avis.com/en/reservation/vehicle-availability?${q}`;
  },
};
const PORTADAS = {
  "Rentalcars": "https://www.rentalcars.com/es/", "Hertz.es": "https://www.hertz.es/", "Hertz.com": "https://www.hertz.com/",
  "Avis.es": "https://www.avis.es/", "Avis.com": "https://www.avis.com/",
  "Auto Europe": "https://www.autoeurope.es/", "Enterprise": "https://www.enterprise.com/",
};
const GRUPOS_COCHE = {
  "Desde España": ["Kayak.es", "Avis.es", "Rentalcars", "DiscoverCars", "Expedia.es", "Hertz.es", "Auto Europe"],
  "Webs de EE. UU.": ["Kayak.com", "Priceline", "Expedia.com", "Avis.com", "Hertz.com", "Enterprise"],
};
// Lo que incluye el precio que enseña cada web (comprobado en sus resultados, nov. 2026)
const INCLUYE = {
  "Avis.es": "incluye la cobertura de daños y robo (LDW), tasas del aeropuerto/ciudad y kilometraje ilimitado; es lo más completo",
  "Rentalcars": "total con tasas; en ofertas como la de Hertz, daños y robo con franquicia 0 €; pide fianza",
  "DiscoverCars": "muchas ofertas «sin franquicia»; su «Cobertura total» es un extra que no va en el precio",
  "Expedia.es": "incluye tasas, impuestos y el cargo por dejarlo en otra ciudad; algunas ofertas con cobertura sin franquicia",
  "Kayak.es": "comparador: lo que incluye depende de la web a la que te manda",
  "Hertz.es": "precio estimado; las coberturas se eligen después y no van en el precio",
  "Auto Europe": "incluye el cargo por dejarlo en otra ciudad e IVA; puede haber tasas en el mostrador",
  "Priceline": "varía por oferta: unas incluyen daños (CDW) y responsabilidad civil, otras no",
  "Expedia.com": "incluye tasas; la cobertura varía según la oferta",
  "Avis.com": "las coberturas se eligen aparte",
  "Hertz.com": "las coberturas se eligen aparte",
  "Kayak.com": "comparador: lo que incluye depende de la web a la que te manda",
  "Enterprise": "las coberturas se añaden después",
};

// desde/hasta: "DFW", "CIUDAD", "IAH" o "HOU"; recogida/entrega: "AAAA-MM-DDTHH:MM" (hora local)
function enlacesCoche(desde, hasta, recogida, entrega) {
  const o = LUGARES[desde], d = LUGARES[hasta];
  const grupos = {};
  for (const [titulo, webs] of Object.entries(GRUPOS_COCHE)) {
    grupos[titulo] = webs.map((w) => {
      const url = CONSTRUCTORES[w] ? CONSTRUCTORES[w](o, d, recogida, entrega) : null;
      return { nombre: w, url: url || PORTADAS[w], aMano: !url };
    });
  }
  return grupos;
}

function enlacesCocheHtml(grupos) {
  return Object.entries(grupos).map(([titulo, enlaces], g) =>
    `<div class="coche-grupo"><span>${esc(titulo)}:</span><div class="enlaces">${enlaces.map((x, k) =>
      `<a href="${esc(x.url)}" target="_blank" rel="noopener" class="${g === 0 && k === 0 ? "principal" : ""}" title="${esc(INCLUYE[x.nombre] || "")}">${esc(x.nombre)}${x.aMano ? " (a mano)" : ""}</a>`).join("")}</div></div>`).join("")
    + `<div class="sub">Los enlaces abren la búsqueda ya hecha. «(a mano)»: esa web no lo permite, hay que rellenarla.</div>`;
}

const INCLUYE_HTML = `<details class="incluye"><summary>¿Qué incluye el precio de cada web?</summary><ul>${
  Object.entries(INCLUYE).map(([w, t]) => `<li><strong>${esc(w)}</strong>: ${esc(t)}.</li>`).join("")}</ul>
  <p class="ayuda">Ninguna dice nada de la responsabilidad civil ampliada (SLI): si la quieres, añádela al reservar o en el mostrador.</p></details>`;

const mapsQ = (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
const oficinasHtml = () => `<div class="sub">Oficinas cerca de Bering Dr: ${OFICINAS_GALLERIA.map((o) =>
  `<a href="${esc(mapsQ(o.nombre.replace(" · ", " ") + ", " + o.dir))}" target="_blank" rel="noopener">${esc(o.nombre)}</a> (${esc(o.horario)})`).join(" · ")}.</div>`;

// Una oficina de barrio: si la hora cae fuera de horario, se mueve a la apertura (dejar) o al cierre anterior (recoger).
function horaOficina(iso, dejar) {
  const H = Number(iso.slice(11, 13)) + Number(iso.slice(14, 16)) / 60;
  if (H >= ABRE && H <= CIERRA) return { iso, movida: false };
  if (dejar) {
    const dia = H > CIERRA ? sumarHoras(iso.slice(0, 11) + "00:00", 24).slice(0, 11) : iso.slice(0, 11);
    return { iso: `${dia}${dos(ABRE)}:00`, movida: true };
  }
  const dia = H < ABRE ? sumarHoras(iso.slice(0, 11) + "00:00", -24).slice(0, 11) : iso.slice(0, 11);
  return { iso: `${dia}${dos(CIERRA)}:00`, movida: true };
}
const horasEntre = (a, b) => Math.round((new Date(b + ":00Z") - new Date(a + ":00Z")) / 36e5);
const diasAlquiler = (a, b) => {
  const h = horasEntre(a, b);
  return h <= 24 ? `${h} h con el coche: <strong>1 día</strong> de alquiler` : `${h} h con el coche: <strong>${Math.ceil(h / 24)} días</strong> de alquiler`;
};

const precioDoble = (ciudad) =>
  `≈ <strong>${fmtPrecio(costeCoche(coche, ciudad, true).eur)}</strong> desde España · ≈ ${fmtPrecio(costeCoche(coche, ciudad, false).eur)} en web de EE. UU.`;

// Sin Iberia en Dallas ese día: enlaces igualmente, con las fechas de la búsqueda (horas orientativas).
function enlacesSinIberia(res, h) {
  const p = res.peticion;
  let html = "";
  if (p.fecha_ida) {
    html += `<div class="coche-opcion"><strong>Ida · ${fmtFecha(p.fecha_ida)}</strong>: Dallas (DFW) → Houston (horas orientativas: 12:00 → 17:00; cámbialas en la web)
      <div class="coche-sitio"><strong>Dejarlo cerca de Bering Dr (Galleria)</strong>${oficinasHtml()}
        ${enlacesCocheHtml(enlacesCoche("DFW", "CIUDAD", p.fecha_ida + "T12:00", p.fecha_ida + "T17:00"))}</div>
      <div class="coche-sitio"><strong>Dejarlo en el aeropuerto de Houston (${h})</strong>
        ${enlacesCocheHtml(enlacesCoche("DFW", h, p.fecha_ida + "T12:00", p.fecha_ida + "T17:00"))}</div></div>`;
  }
  if (p.fecha_vuelta) {
    html += `<div class="coche-opcion"><strong>Vuelta · ${fmtFecha(p.fecha_vuelta)}</strong>: Houston → Dallas (DFW) (horas orientativas: 10:00 → 17:00)
      <div class="coche-sitio"><strong>Recogerlo cerca de Bering Dr (Galleria)</strong>${oficinasHtml()}
        ${enlacesCocheHtml(enlacesCoche("CIUDAD", "DFW", p.fecha_vuelta + "T10:00", p.fecha_vuelta + "T17:00"))}</div>
      <div class="coche-sitio"><strong>Recogerlo en el aeropuerto de Houston (${h})</strong>
        ${enlacesCocheHtml(enlacesCoche(h, "DFW", p.fecha_vuelta + "T10:00", p.fecha_vuelta + "T17:00"))}</div></div>`;
  }
  return html;
}

function cocheHtml(res) {
  const houston = (res.peticion.destinos || []).every((d) => d === "IAH" || d === "HOU");
  if (!houston) return "";
  const h = (res.peticion.destinos || ["IAH"]).includes("IAH") ? "IAH" : "HOU";
  const c = costeCoche(coche);
  const filas = [];
  const comparar = (d) => d?.opciones[0] ? `El vuelo interno más barato de la búsqueda: <strong>${fmtPrecio(d.opciones[0].total)}</strong> (${esc(d.opciones[0].ciudad)}).` : "";
  if (res.ida) {
    for (const ib of (res.ida.iberias || []).filter((v) => v.destino === "DFW")) {
      const recogida = sumarHoras(ib.llegada, coche.aduana);
      const llegada = sumarHoras(recogida, coche.conducir);
      const entrega = sumarHoras(recogida, 6);
      const dejar = horaOficina(sumarHoras(llegada, coche.trafico), true);
      filas.push(`<div class="coche-opcion"><strong>Ida · ${fmtFecha(ib.salida)}</strong>: Iberia ${esc(ib.numeros.join(", "))} aterriza en Dallas (DFW) a las ${fmtHora(ib.llegada)}
        → coges el coche hacia las ${fmtHora(recogida)} → llegas a Houston hacia las <strong>${fmtHora(llegada)}</strong>${otroDia(ib.llegada, llegada)}.
        <div class="sub">${comparar(res.ida)}</div>
        <div class="coche-sitio"><strong>A) Dejarlo cerca de Bering Dr (Galleria)</strong> · ${precioDoble(true)}<br>
          ${dejar.movida ? `Las oficinas de la zona están cerradas a esa hora: lo dejas el ${fmtFecha(dejar.iso)} a las ${fmtHora(dejar.iso)} (${diasAlquiler(recogida, dejar.iso)}).`
            : `Lo dejas hacia las ${fmtHora(dejar.iso)} (${diasAlquiler(recogida, dejar.iso)}).`}
          ${oficinasHtml()}
          ${enlacesCocheHtml(enlacesCoche("DFW", "CIUDAD", recogida, dejar.iso))}</div>
        <div class="coche-sitio"><strong>B) Dejarlo en el aeropuerto de Houston (${h})</strong>, abierto toda la noche · ${precioDoble(false)}
          ${enlacesCocheHtml(enlacesCoche("DFW", h, recogida, entrega))}</div></div>`);
    }
  }
  if (res.vuelta) {
    const cc = costeCoche(coche, true);
    const maps = (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
    for (const ib of (res.vuelta.iberias || []).filter((v) => v.origen === "DFW")) {
      const devolver = sumarHoras(ib.salida, -3);
      const salir = sumarHoras(devolver, -coche.conducir - 0.5);
      const salirCiudad = sumarHoras(devolver, -coche.conducir - coche.trafico - 0.5);
      const horaSalida = Number(salirCiudad.slice(11, 13));
      let avisoHorario = `<div class="sub">Comprueba el horario de la oficina: las de barrio suelen abrir de 8–9 a 18 h y menos los fines de semana.</div>`;
      if (horaSalida < 9 || horaSalida >= 18) {
        // si a esa hora está cerrada, se recoge antes (la tarde anterior, o a las 17:00 del mismo día si ya es tarde)
        const antes = horaSalida >= 18 ? salirCiudad.slice(0, 11) + "17:00" : sumarHoras(salirCiudad.slice(0, 11) + "17:00", -24);
        const horas = Math.round((new Date(devolver + ":00Z") - new Date(antes + ":00Z")) / 36e5);
        const dias = Math.ceil(horas / 24);
        avisoHorario = `<div class="equipaje-aviso">⚠️ A las ${fmtHora(salirCiudad)} muchas oficinas de barrio están cerradas (suelen abrir de 8–9 a 18 h, menos los fines de semana y algunas cierran en domingo).
          Si lo recoges antes, por ejemplo el ${fmtFecha(antes)} a las 17:00, lo tendrías ${horas} h hasta devolverlo en DFW:
          ${dias <= 1 ? "<strong>sigue siendo 1 día</strong> (menos de 24 h)." : `<strong>serían ${dias} días</strong> de alquiler (más de 24 h).`}</div>`;
      }
      filas.push(`<div class="coche-opcion"><strong>Vuelta · ${fmtFecha(ib.salida)}</strong> · Iberia ${esc(ib.numeros.join(", "))} sale de Dallas (DFW) a las ${fmtHora(ib.salida)}. Lo devuelves en DFW a las ${fmtHora(devolver)} (3 h antes).
        <div class="coche-sitio"><strong>A) Recogerlo cerca de Bering Dr (Galleria)</strong> (sin tasa del aeropuerto)<br>${precioDoble(true)}<br>
          Lo recoges hacia las <strong>${fmtHora(salirCiudad)}</strong>${otroDia(ib.salida, salirCiudad)}.
          ${avisoHorario}
          ${oficinasHtml()}
          ${enlacesCocheHtml(enlacesCoche("CIUDAD", "DFW", horaOficina(salirCiudad, false).iso, devolver))}</div>
        <div class="coche-sitio"><strong>B) Aeropuerto de Houston (${h})</strong><br>${precioDoble(false)}<br>
          Lo recoges hacia las <strong>${fmtHora(salir)}</strong>${otroDia(ib.salida, salir)}.
          ${enlacesCocheHtml(enlacesCoche(h, "DFW", salir, devolver))}</div>
        <div class="sub">${comparar(res.vuelta)}</div></div>`);
    }
  }
  const campos = COCHE_CAMPOS.map(([k, t]) =>
    `<label>${t}<input type="number" step="any" min="0" data-coche="${k}" value="${coche[k]}"></label>`).join("");
  const campoDireccion = `<label>Recoger cerca de (vuelta)<input type="text" data-coche-texto="direccion" value="${esc(coche.direccion)}"></label>`;
  const cu = costeCoche(coche, false, false);
  const desglose = `Desde España: ${Math.round(coche.tarifa)} $ alquiler + ${Math.round(coche.solo_ida)} $ dejarlo en otra ciudad + ${Math.round(coche.seguros_espana)} $ seguro completo incluido`
    + `${coche.joven ? ` + ${Math.round(coche.joven)} $ conductor joven` : ""} + ${Math.round(c.impuestos)} $ impuestos y tasas + ${Math.round(coche.gasolina)} $ gasolina`
    + `${coche.peajes ? ` + ${Math.round(coche.peajes)} $ peajes` : ""} = <strong>${Math.round(c.usd)} $ ≈ ${fmtPrecio(c.eur)}</strong>.`
    + ` En web de EE. UU. el seguro completo se paga en el mostrador (~${Math.round(coche.seguros)} $ en vez de ${Math.round(coche.seguros_espana)} $):`
    + ` <strong>${Math.round(cu.usd)} $ ≈ ${fmtPrecio(cu.eur)}</strong>. Cambio: 1 $ = ${String(coche.cambio).replace(".", ",")} €.`;
  return `<h2 style="margin-top:0">🚗 Alternativa: coche de alquiler Dallas (DFW) ⇄ Houston</h2>
    <table class="tabla-ciudades coche-tabla"><thead><tr><th>1 día con todo</th><th class="num">Reservando desde España</th><th class="num">Web de EE. UU. + seguro en mostrador</th></tr></thead><tbody>
      <tr><td>Aeropuerto</td><td class="num"><strong>${fmtPrecio(c.eur)}</strong></td><td class="num">${fmtPrecio(cu.eur)}</td></tr>
      ${res.vuelta ? `<tr><td>Oficina en la ciudad</td><td class="num"><strong>${fmtPrecio(costeCoche(coche, true, true).eur)}</strong></td><td class="num">${fmtPrecio(costeCoche(coche, true, false).eur)}</td></tr>` : ""}
    </tbody></table>
    <p class="coche-precio"><small>Estimación con precios típicos · todo el seguro y todos los gastos · precio por coche, no por persona</small></p>
    <p class="sub">${desglose}</p>
    ${filas.length ? filas.join("") : !(res.ida || res.vuelta)?.iberias
      ? `<p class="sub">Esta búsqueda es anterior a la opción del coche: vuelve a buscar para ver los horarios con el Iberia de Dallas.</p>`
      : `<p class="sub">Ese día no hay vuelo directo de Iberia en Dallas (DFW)${(res.peticion.pasarelas || []).includes("DFW") ? "" : ": marca «Dallas (DFW)» en «Más opciones»"}. Aun así puedes mirar los precios del alquiler:</p>${enlacesSinIberia(res, h)}`}
    ${INCLUYE_HTML}
    <details class="avanzado"><summary>Ajustar la estimación</summary><div class="rejilla">${campoDireccion}${campos}</div>
      <p class="ayuda">Son precios típicos, no reales: no hay ningún buscador gratis de alquiler de coches. Mira el precio de verdad en los enlaces. En las webs de EE. UU. el precio que ves no suele llevar el seguro a todo riesgo ni la responsabilidad civil ampliada (allí se da por hecho que tienes tu seguro de coche); te lo ofrecen en el mostrador y es caro. Desde España hay paquetes «todo incluido» para no residentes: con todo el seguro suelen salir más baratos. Una VPN de EE. UU. apenas cambia el precio: lo que cuenta es la web y el país de residencia, y conviene poner el real (España) para que el seguro valga. En DiscoverCars o Rentalcars la «cobertura total» es un seguro suyo: si hay daños pagas tú en el mostrador y luego te lo devuelven; la empresa de alquiler te bloqueará una fianza en la tarjeta de crédito. Para la estimación se cuenta 1 día con recogida en el aeropuerto y devolución en otra ciudad. Un día de alquiler son 24 h desde que lo recoges; si te pasas, suele haber un margen corto (unos 30 min, según la empresa) y después cobran horas o un día más.</p>
      <button type="button" class="mas" id="coche-reiniciar">Volver a los valores típicos</button></details>
    <p class="ayuda">El coche es para todos: con 2 o más personas suele salir mejor. Sin pagar maletas, pero son unas ${coche.conducir} h de carretera (I-45). Necesitas el carné de conducir español y conviene el permiso internacional.</p>`;
}

function pintarCoche(res) {
  const html = cocheHtml(res);
  const caja = $("bloque-coche");
  caja.hidden = !html;
  if (!html) return;
  const abierto = caja.querySelector("details")?.open;
  caja.innerHTML = html;
  if (abierto) caja.querySelector("details").open = true;
  caja.querySelectorAll("input[data-coche]").forEach((e) => e.addEventListener("change", () => {
    const n = Number(e.value);
    if (Number.isFinite(n) && n >= 0) coche[e.dataset.coche] = n;
    guardado.poner("vuelos-coche", JSON.stringify(coche));
    pintarCoche(res);
  }));
  caja.querySelectorAll("input[data-coche-texto]").forEach((e) => e.addEventListener("change", () => {
    coche[e.dataset.cocheTexto] = e.value.trim().slice(0, 80) || COCHE_DEFECTO[e.dataset.cocheTexto];
    guardado.poner("vuelos-coche", JSON.stringify(coche));
    pintarCoche(res);
  }));
  $("coche-reiniciar").addEventListener("click", () => {
    coche = { ...COCHE_DEFECTO };
    guardado.poner("vuelos-coche", null);
    pintarCoche(res);
  });
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
