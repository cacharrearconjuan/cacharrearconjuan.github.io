/* ¿Qué le va a mi PC? — la página. La lógica está en logica.js (window.PC). */
(function () {
  'use strict';

  const PC = window.PC;
  const app = document.getElementById('pc-app');
  if (!app || !PC) return;

  const TIPOS = [
    {clave: 'placa', titulo: 'Placa base', ejemplo: 'Ej.: B550 Tomahawk', archivo: 'datos/placas.json'},
    {clave: 'cpu', titulo: 'Procesador', ejemplo: 'Ej.: Ryzen 5 5600', archivo: 'datos/cpu.json'},
    {clave: 'ram', titulo: 'Memoria RAM', ejemplo: 'Ej.: DDR5-6000 CL30', archivo: 'datos/ram.json'},
    {clave: 'ssd', titulo: 'SSD M.2', ejemplo: 'Ej.: 990 Pro 2TB', archivo: 'datos/ssd.json'},
  ];
  const datos = {placa: [], cpu: [], ram: [], ssd: []};
  // sin prototipo: un enlace con «#cpu=constructor» no encuentra nada
  const porId = {placa: Object.create(null), cpu: Object.create(null), ram: Object.create(null), ssd: Object.create(null)};
  const elegido = {placa: null, cpu: null, ram: null, ssd: null};
  let R = null;
  let meta = null;

  const TITULOS_ESTADO = {
    si: 'Le van de serie',
    bios: 'Le van con la BIOS al día',
    depende: 'Depende del modelo de placa',
    nose: 'Sin comprobar',
    no: 'No le van',
  };
  const ESTADO_PLACA = {
    si: 'le va de serie',
    bios: 'le va con la BIOS al día',
    depende: 'depende del modelo de placa',
    nose: 'sin comprobar',
    no: 'no le va',
  };
  const ICONOS = {
    si: ['✓', 'Sí'], ok: ['✓', 'Bien'], bios: ['!', 'Ojo'], depende: ['!', 'Ojo'], aviso: ['!', 'Ojo'],
    nose: ['?', 'Sin comprobar'], info: ['i', 'Dato'], no: ['✕', 'No'], mal: ['✕', 'No'],
  };
  const CLASE_ICONO = {si: 'si', ok: 'si', bios: 'aviso', depende: 'aviso', aviso: 'aviso', nose: 'nose', info: 'info', no: 'no', mal: 'no'};

  // ------------------------------------------------------------ utilidades

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]);
  }

  // como la RAE: 2794 y 12.500 (los de cuatro cifras van sin punto)
  function cifra(n) {
    const t = String(n);
    return t.length > 4 ? t.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : t;
  }

  function decimal(n) {
    return String(n).replace('.', ',');
  }

  function capacidad(gb) {
    if (gb >= 1000) return decimal(Math.round(gb / 100) / 10) + ' TB';
    return gb + ' GB';
  }

  function fechaTexto(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
    if (!m) return '';
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    return `${Number(m[3])} de ${meses[Number(m[2]) - 1]} de ${m[1]}`;
  }

  function resumen(tipo, p) {
    if (tipo === 'placa') {
      return [p.zocalo, p.chipset, p.formato, p.ram, p.ranuras ? p.ranuras + ' ranuras' : null,
        p.m2 ? p.m2.length + ' M.2' : null].filter(Boolean).join(' · ');
    }
    if (tipo === 'cpu') {
      return [p.zocalo, p.nucleos ? p.nucleos + ' núcleos' + (p.hilos && p.hilos !== p.nucleos ? ', ' + p.hilos + ' hilos' : '') : null,
        p.boost ? decimal(p.boost) + ' GHz' : null, p.tdp ? p.tdp + ' W' : null,
        p.igpu === true ? 'con gráfica' : p.igpu === false ? 'sin gráfica' : null].filter(Boolean).join(' · ');
    }
    if (tipo === 'ram') {
      return [p.tipo + '-' + p.velocidad + (p.cl ? ' CL' + p.cl : ''), p.modulos + ' × ' + p.gb + ' GB', p.perfil || null].filter(Boolean).join(' · ');
    }
    return ['M.2 ' + p.largo, p.protocolo === 'sata' ? 'SATA' : 'NVMe' + (p.gen ? ' PCIe ' + p.gen + '.0' : '') + (p.carriles ? ' x' + p.carriles : ''),
      p.gb ? capacidad(p.gb) : null].filter(Boolean).join(' · ');
  }

  function icono(estado) {
    const i = ICONOS[estado] || ICONOS.info;
    return `<span class="pc-icono pc-icono-${CLASE_ICONO[estado] || 'info'}" aria-hidden="true">${i[0]}</span><span class="visual-oculto">${i[1]}: </span>`;
  }

  function fuente(clave) {
    if (!clave) return null;
    if (/^https?:\/\//.test(clave)) return {titulo: clave.replace(/^https?:\/\/(www\.)?/, '').split('/')[0], url: clave};
    return (R.fuentes && R.fuentes[clave]) || null;
  }

  function htmlFuentes(claves) {
    const vistas = [];
    for (const k of claves || []) {
      const f = fuente(k);
      if (f && !vistas.some((v) => v.url === f.url)) vistas.push(f);
    }
    if (!vistas.length) return '';
    return `<p class="pc-fuentes">${vistas.length > 1 ? 'Fuentes' : 'Fuente'}: ${vistas.map((f) =>
      `<a href="${esc(f.url)}" rel="noopener" target="_blank">${esc(f.titulo)}</a>`).join(' · ')}</p>`;
  }

  function htmlNota(n) {
    return `<li class="pc-nota-fila">${icono(n.tipo)}<div><p>${esc(n.texto)}</p>${htmlFuentes(n.fuentes)}</div></li>`;
  }

  function htmlNotas(notas) {
    return notas.length ? `<ul class="pc-notas" role="list">${notas.map(htmlNota).join('')}</ul>` : '';
  }

  function botonElegir(tipo, p, marca) {
    return `<li><button type="button" class="pc-opcion" data-elegir="${tipo}" data-id="${esc(p.id)}">`
      + `<span class="pc-opcion-nombre">${esc(p.nombre)}</span>`
      + `<span class="pc-opcion-datos">${marca ? marca + ' ' : ''}${esc(resumen(tipo, p))}</span></button></li>`;
  }

  function filtro(placeholder) {
    return `<p class="pc-filtro"><label>Filtrar <input type="search" class="pc-filtro-texto" placeholder="${esc(placeholder)}" autocomplete="off" spellcheck="false"></label></p>`;
  }

  // ------------------------------------------------------------ las cuatro piezas

  function htmlPieza(t) {
    const p = elegido[t.clave];
    if (p) {
      return `<div class="pc-pieza pc-pieza-elegida" data-tipo="${t.clave}">
  <h2 class="pc-pieza-titulo">${t.titulo}</h2>
  <p class="pc-elegida-nombre">${esc(p.nombre)}</p>
  <p class="pc-elegida-datos">${esc(resumen(t.clave, p))}</p>
  <button type="button" class="pc-boton-chico" data-quitar="${t.clave}">Cambiar<span class="visual-oculto"> ${t.titulo.toLowerCase()}</span></button>
</div>`;
    }
    return `<div class="pc-pieza" data-tipo="${t.clave}">
  <h2 class="pc-pieza-titulo"><label for="busca-${t.clave}">${t.titulo}</label></h2>
  <div class="pc-busca">
    <input type="search" id="busca-${t.clave}" data-tipo="${t.clave}" placeholder="${esc(t.ejemplo)}" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="lista-${t.clave}">
    <ul class="pc-sugerencias" id="lista-${t.clave}" role="listbox" aria-label="${t.titulo}: resultados" hidden></ul>
  </div>
</div>`;
  }

  // marca de compatibilidad con lo ya elegido, para las sugerencias
  function marcaCompat(tipo, p) {
    let e = null;
    if (tipo === 'cpu' && elegido.placa) e = PC.cpuEnPlaca(R, p, elegido.placa).estado;
    else if (tipo === 'placa' && elegido.cpu) e = PC.cpuEnPlaca(R, elegido.cpu, p).estado;
    else if (tipo === 'placa' && elegido.ram) e = PC.ramEnPlaca(R, elegido.ram, p).estado;
    else if (tipo === 'ram' && elegido.placa) e = PC.ramEnPlaca(R, p, elegido.placa).estado;
    else if (tipo === 'ram' && elegido.cpu) e = PC.ramConCpu(R, p, elegido.cpu).estado;
    else if (tipo === 'ssd' && elegido.placa) e = PC.ssdEnPlaca(R, p, elegido.placa, elegido.cpu).estado;
    return e ? icono(e) : '';
  }

  function cerrar(input) {
    const lista = document.getElementById('lista-' + input.dataset.tipo);
    if (lista) lista.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    input._activo = -1;
  }

  function sugerir(input) {
    const tipo = input.dataset.tipo;
    const lista = document.getElementById('lista-' + tipo);
    if (PC.normal(input.value).length < 2) {
      input._hallados = [];
      cerrar(input);
      return;
    }
    const hallados = PC.buscar(datos[tipo], input.value, 40);
    input._hallados = hallados;
    input._activo = -1;
    input.removeAttribute('aria-activedescendant');
    lista.innerHTML = hallados.length
      ? hallados.map((p, i) => `<li role="option" id="op-${tipo}-${i}" class="pc-sugerencia" data-i="${i}" aria-selected="false">`
        + `<span class="pc-sug-nombre">${marcaCompat(tipo, p)}${esc(p.nombre)}</span><span class="pc-sug-datos">${esc(resumen(tipo, p))}</span></li>`).join('')
      : '<li class="pc-sin-resultados" role="option" aria-disabled="true">No lo encuentro. Prueba solo con el modelo (por ejemplo «B550» o «5600X»).</li>';
    lista.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  function mover(input, paso) {
    const n = (input._hallados || []).length;
    if (!n) return;
    let i = (input._activo == null ? -1 : input._activo) + paso;
    if (i < 0) i = n - 1;
    if (i >= n) i = 0;
    input._activo = i;
    const lista = document.getElementById('lista-' + input.dataset.tipo);
    lista.querySelectorAll('.pc-sugerencia').forEach((li) => li.setAttribute('aria-selected', li.dataset.i === String(i) ? 'true' : 'false'));
    const activo = document.getElementById(`op-${input.dataset.tipo}-${i}`);
    if (activo) {
      input.setAttribute('aria-activedescendant', activo.id);
      activo.scrollIntoView({block: 'nearest'});
    }
  }

  function avisar(texto) {
    const estado = document.getElementById('pc-estado');
    if (estado) estado.textContent = texto;
  }

  function elegir(tipo, pieza) {
    elegido[tipo] = pieza;
    guardarEnlace();
    pintar();
    const t = TIPOS.find((x) => x.clave === tipo);
    avisar(`${t.titulo}: ${pieza.nombre}. Resultados actualizados.`);
    const boton = app.querySelector(`[data-quitar="${tipo}"]`);
    if (boton) boton.focus({preventScroll: true});
  }

  // ------------------------------------------------------------ bloques del resultado

  function bloque(id, titulo, cuerpo, entradilla) {
    return `<section class="pc-bloque" aria-labelledby="t-${id}">
  <h2 id="t-${id}">${titulo}</h2>
  ${entradilla ? `<p class="pc-entradilla">${entradilla}</p>` : ''}
  ${cuerpo}
</section>`;
  }

  function htmlVeredicto() {
    const filas = PC.comprobar(R, elegido);
    if (!filas.length) return '';
    const malas = filas.filter((f) => f.estado === 'no').length;
    const dudas = filas.filter((f) => f.estado !== 'si').length;
    const titular = malas ? 'Hay algo que no encaja' : dudas ? 'Encaja, con algún «pero»' : 'Todo encaja';
    const cuerpo = `<ul class="pc-veredicto" role="list">${filas.map((f) => `<li class="pc-veredicto-fila">${icono(f.estado)}<div>
  <h3>${esc(f.que)}</h3><p>${esc(f.texto)}</p>${f.notas && f.notas.length ? '<ul class="pc-subnotas">' + f.notas.map((n) => `<li>${esc(n)}</li>`).join('') + '</ul>' : ''}${htmlFuentes(f.fuentes)}
</div></li>`).join('')}</ul>`;
    return bloque('veredicto', titular, cuerpo);
  }

  function htmlCpu() {
    const c = elegido.cpu;
    if (!c) return '';
    const F = PC.familia(R, c.familia);
    const g = PC.grafica(R, c, elegido.placa);
    const filas = [`<li class="pc-nota-fila">${icono(g.estado === 'no' ? 'aviso' : g.estado)}<div><h3>Gráfica integrada</h3><p>${esc(g.texto)}</p></div></li>`];
    if (F) {
      const tipos = Object.keys(F.ram || {});
      if (tipos.length) filas.push(`<li class="pc-nota-fila">${icono('info')}<div><h3>Memoria que admite</h3><p>${esc(tipos.join(' y '))}${tipos.length > 1 ? ' (según la placa: cada placa es de un tipo)' : ''}.</p></div></li>`);
      if (F.pcie) filas.push(`<li class="pc-nota-fila">${icono('info')}<div><h3>PCIe del procesador</h3><p>PCIe ${F.pcie}.0${F.pcie_texto ? ': ' + esc(F.pcie_texto) : ''}.</p>${htmlFuentes(F.fuentes_pcie)}</div></li>`);
    } else if (!PC.plataforma(R, c.zocalo)) {
      filas.push(`<li class="pc-nota-fila">${icono('nose')}<div><p>${esc(c.zocalo)} es una plataforma nueva y aún no tiene reglas comprobadas aquí: lo que ves sale solo de la ficha.</p></div></li>`);
    }
    const titulo = F ? `${esc(c.nombre)} <span class="pc-titulo-detalle">${esc(F.nombre)}</span>` : esc(c.nombre);
    return bloque('cpu', titulo, `<ul class="pc-notas" role="list">${filas.join('')}</ul>`);
  }

  function htmlHuecos(placa) {
    if (!placa.m2) return '';
    const modo = {p: 'NVMe (PCIe)', ps: 'NVMe o SATA', s: 'solo SATA', '?': ''};
    return `<ul class="pc-huecos" role="list">${placa.m2.map((h, i) => {
      const partes = [h[0] ? String(h[0]).split(',').join(', ') : 'tamaño sin dato', modo[h[3]] || '',
        h[1] ? `PCIe ${h[1]}.0${h[2] ? ' x' + h[2] : ''}` : ''].filter(Boolean);
      return `<li><strong>M.2 ${i + 1}</strong> ${esc(partes.join(' · '))}</li>`;
    }).join('')}</ul>`;
  }

  function htmlPlaca() {
    const p = elegido.placa;
    if (!p) return '';
    const P = PC.plataforma(R, p.zocalo);
    const ch = PC.reglasChipset(R, p);
    const filas = [];
    if (!P) {
      filas.push(`<li class="pc-nota-fila">${icono('nose')}<div><p>${esc(p.zocalo)} es una plataforma nueva y aún no tiene reglas comprobadas aquí: lo que ves sale solo de la ficha.</p></div></li>`);
    } else if (ch) {
      // EXPO solo existe en DDR5 y las placas Intel solo leen XMP
      const perfil = P.marca !== 'Intel' && (P.ram || []).indexOf('DDR5') >= 0 ? 'EXPO o XMP' : 'XMP';
      let texto;
      if (ch.cpu_oc === true && ch.ram_oc === true) texto = `Permite overclock del procesador y subir la memoria con ${perfil}.`;
      else if (ch.ram_oc === true) texto = `Permite subir la memoria con ${perfil}, pero no hacer overclock al procesador.`;
      else if (ch.ram_oc === false) texto = 'No permite overclock: la memoria se queda en lo oficial del procesador, aunque compres una más rápida.';
      else texto = '';
      // familias con las que la memoria no sube aunque el chipset lo permita (10.ª generación en B560 y H570)
      const sinSubir = Object.keys(ch.ram_oc_familia || {}).filter((f) => ch.ram_oc_familia[f] === false && PC.familia(R, f));
      if (ch.ram_oc === true && sinSubir.length) {
        texto += ' ' + sinSubir.map((f) => `Con los ${PC.familia(R, f).nombre}, no: la memoria se queda en lo oficial del procesador.`).join(' ');
      }
      const cpu = elegido.cpu;
      const frena = ch.ram_oc === false || (cpu && sinSubir.indexOf(cpu.familia) >= 0);
      filas.push(`<li class="pc-nota-fila">${icono(frena ? 'aviso' : 'info')}<div><h3>Chipset ${esc(p.chipset)}</h3><p>${esc(texto)}${ch.nota ? ' ' + esc(ch.nota) : ''}</p>${htmlFuentes(ch.fuentes)}</div></li>`);
    }
    if (P && P.nota) filas.push(`<li class="pc-nota-fila">${icono('info')}<div><h3>${esc(P.nombre)}</h3><p>${esc(P.nota)}</p>${htmlFuentes(P.fuentes)}</div></li>`);
    const mem = [p.ram, p.ranuras ? p.ranuras + ' ranuras' : null, p.max_gb ? 'hasta ' + p.max_gb + ' GB según la ficha' : null].filter(Boolean);
    if (mem.length) filas.push(`<li class="pc-nota-fila">${icono('info')}<div><h3>Memoria</h3><p>${esc(mem.join(', '))}.</p></div></li>`);
    let m2 = '';
    if (p.m2) m2 = `<p>${p.m2.length === 1 ? 'Un hueco' : p.m2.length + ' huecos'} para SSD, según la ficha:</p>${htmlHuecos(p)}`;
    else m2 = `<p>${esc(PC.textoSinHuecos(p))}</p>`;
    filas.push(`<li class="pc-nota-fila">${icono(p.m2 ? 'info' : 'nose')}<div><h3>SSD M.2</h3>${m2}</div></li>`);
    if (p.video && p.video.length) filas.push(`<li class="pc-nota-fila">${icono('info')}<div><h3>Salidas de vídeo</h3><p>${esc(p.video.join(', '))}. Solo dan imagen con un procesador con gráfica integrada.</p></div></li>`);
    if (p.flashback === true) filas.push(`<li class="pc-nota-fila">${icono('ok')}<div><h3>BIOS Flashback</h3><p>Se puede actualizar la BIOS con un pendrive, sin procesador.</p></div></li>`);
    const extra = p.revisada ? `<p class="pc-revisada">Ficha revisada a mano por BuildCores el ${esc(fechaTexto(p.revisada))}.</p>` : '';
    return bloque('placa', esc(p.nombre), `<ul class="pc-notas" role="list">${filas.join('')}</ul>${extra}`);
  }

  function htmlMemoria() {
    const {placa, cpu, ram} = elegido;
    if (!placa && !cpu && !ram) return '';
    const v = PC.velocidad(R, elegido);
    if (!v.tipo) {
      // un procesador que admite DDR4 y DDR5 sin placa elegida: las dos
      const F = cpu ? PC.familia(R, cpu.familia) : null;
      const tipos = F && F.ram ? Object.keys(F.ram) : [];
      if (tipos.length < 2) return '';
      const partes = tipos.map((t) => `<h3 class="pc-sub">${t}</h3>`
        + htmlNotas(PC.velocidad(R, {cpu: cpu, placa: {zocalo: cpu.zocalo, ram: t, chipset: null}}).notas));
      return bloque('memoria', 'Memoria: a qué velocidad', partes.join(''), 'Admite las dos, pero cada placa es de un tipo: elige la placa para afinar.');
    }
    let cuerpo = htmlNotas(v.notas);
    if (!ram) {
      const rec = PC.ramRecomendada(R, elegido, datos.ram, 12);
      if (rec.kits.length) {
        cuerpo += `<h3 class="pc-sub">Kits de la lista que lo cumplen <span class="pc-cuenta">${cifra(rec.total)}</span></h3>
<p class="pc-entradilla">${esc(v.tipo)}-${rec.objetivo}, dos módulos${placa && placa.max_gb ? ', que quepan en la placa' : ''}. Toca uno para elegirlo.</p>
<ul class="pc-opciones" role="list">${rec.kits.map((k) => botonElegir('ram', k)).join('')}</ul>`;
      }
    }
    return bloque('memoria', `Memoria ${esc(v.tipo)}: a qué velocidad`, cuerpo);
  }

  function htmlSsd() {
    const {placa, cpu, ssd} = elegido;
    if (!placa && !ssd) return '';
    let cuerpo = '';
    if (placa && ssd) {
      const r = PC.ssdEnPlaca(R, ssd, placa, cpu);
      cuerpo += `<ul class="pc-notas" role="list"><li class="pc-nota-fila">${icono(r.estado)}<div><p>${esc(r.texto)}</p></div></li></ul>`;
      if (r.huecos.length) {
        cuerpo += `<ul class="pc-huecos" role="list">${r.huecos.map((e) => `<li>${icono(e.cabe ? (!e.dudas.length && (!ssd.gen || e.real >= ssd.gen) ? 'si' : 'aviso') : 'no')}<strong>M.2 ${e.n}</strong> ${esc(e.cabe
          ? (ssd.protocolo === 'nvme' && e.real ? (e.dudas.length ? 'seguramente a ' : 'irá a ') + 'PCIe ' + e.real + '.0' + (e.carriles ? ' x' + e.carriles : '') : e.dudas.length ? 'seguramente cabe' : 'cabe')
          : e.motivo)}</li>`).join('')}</ul>`;
      }
      cuerpo += htmlNotas(r.notas.concat(PC.notasM2(R, placa, cpu)));
    } else if (placa) {
      if (placa.m2) {
        const mejor = Math.max.apply(null, placa.m2.map((h) => h[1] || 0));
        cuerpo += `<p>Le va cualquier SSD M.2 NVMe del tamaño de sus huecos (casi todos los de venta son 2280).${mejor ? ` El hueco más rápido es PCIe ${mejor}.0: un SSD más rápido que eso funciona, pero a esa velocidad.` : ''}</p>`;
        cuerpo += htmlNotas(PC.notasM2(R, placa, cpu));
      } else {
        cuerpo += `<p>${esc(PC.textoSinHuecos(placa))}</p>`;
      }
    } else {
      const grupos = PC.placasParaSsd(R, datos.placa, ssd);
      const total = grupos.reduce((s, g) => s + g.si.length + g.depende.length, 0);
      cuerpo += `<p class="pc-entradilla">Placas de la lista con un hueco donde cabe (${cifra(total)}). Solo salen las que traen bien sus M.2 en la ficha.</p>`;
      cuerpo += filtro('ASUS, ITX, WiFi…') + htmlGruposPlacas(grupos, 'A toda velocidad', 'Funciona, pero más lento o sin confirmar');
    }
    return bloque('ssd', ssd ? `SSD: ${esc(ssd.nombre)}` : 'SSD M.2', cuerpo);
  }

  function htmlGruposPlacas(grupos, textoSi, textoDepende) {
    return grupos.map((g) => {
      const partes = [];
      if (g.si.length) partes.push(`<details class="pc-grupo"><summary>${icono('si')}${esc(g.zocalo)}: ${textoSi} <span class="pc-cuenta">${cifra(g.si.length)}</span></summary><ul class="pc-opciones" role="list">${g.si.map((p) => botonElegir('placa', p)).join('')}</ul></details>`);
      if (g.depende.length) partes.push(`<details class="pc-grupo"><summary>${icono('aviso')}${esc(g.zocalo)}: ${textoDepende} <span class="pc-cuenta">${cifra(g.depende.length)}</span></summary><ul class="pc-opciones" role="list">${g.depende.map((p) => botonElegir('placa', p)).join('')}</ul></details>`);
      return partes.join('');
    }).join('');
  }

  function htmlListas() {
    const {placa, cpu, ram} = elegido;
    let html = '';
    if (placa && !cpu) {
      const grupos = PC.cpusParaPlaca(R, datos.cpu, placa);
      const cuerpo = grupos.map((g) => `<h3 class="pc-sub">${icono(g.estado)}${TITULOS_ESTADO[g.estado]}</h3>${g.familias.map((f) =>
        `<details class="pc-grupo"${g.estado === 'si' || g.estado === 'bios' ? ' open' : ''}><summary>${esc(f.nombre)} <span class="pc-cuenta">${f.cpus.length}</span></summary><ul class="pc-opciones" role="list">${f.cpus.map((c) => botonElegir('cpu', c)).join('')}</ul></details>`).join('')}`).join('');
      html += bloque('cpus', 'Procesadores para esta placa', cuerpo || '<p>No hay procesadores de este zócalo en la lista.</p>',
        esc(`Según su chipset (${placa.chipset || 'sin dato'}). Toca uno para elegirlo.`));
    }
    if (cpu && !placa) {
      const grupos = PC.placasParaCpu(R, datos.placa, cpu);
      const total = grupos.reduce((s, g) => s + g.placas.length, 0);
      const cuerpo = filtro('ASUS, B550, ITX, WiFi…') + grupos.map((g) => `<details class="pc-grupo"><summary>${icono(g.estado)}${esc(g.chipset)}: ${ESTADO_PLACA[g.estado]} <span class="pc-cuenta">${cifra(g.placas.length)}</span></summary><ul class="pc-opciones" role="list">${g.placas.map((p) => botonElegir('placa', p)).join('')}</ul></details>`).join('');
      html += bloque('placas', 'Placas para este procesador', cuerpo, esc(`${cifra(total)} placas ${cpu.zocalo} en la lista, por chipset.`));
    }
    if (ram && !placa) {
      const grupos = PC.placasParaRam(R, datos.placa, ram);
      const total = grupos.reduce((s, g) => s + g.si.length + g.depende.length, 0);
      html += bloque('placas-ram', 'Placas donde entra esta memoria',
        filtro('ASUS, B650, ITX…') + htmlGruposPlacas(grupos, 'Entra', 'Entra, pero mira la capacidad'),
        esc(`${cifra(total)} placas ${ram.tipo} con ranuras suficientes.`));
    }
    return html;
  }

  function htmlIntro() {
    const n = meta && meta.piezas ? meta.piezas : null;
    const plataformas = Object.keys(R.plataformas || {}).join(', ');
    return `<section class="pc-bloque pc-intro">
  <h2>Cómo va</h2>
  <p>Elige arriba lo que tienes o lo que quieres comprar, en el orden que quieras: con una pieza te digo qué le va; con varias, si encajan entre ellas, a qué velocidad irá la memoria y dónde va el SSD.</p>
  <p>Cubre ${esc(plataformas)}${n ? `: ${esc(cifra(n.placas))} placas, ${esc(cifra(n.cpu))} procesadores, ${esc(cifra(n.ram))} kits de memoria y ${esc(cifra(n.ssd))} SSD M.2` : ''}. Lo nuevo aparece solo cada día.</p>
</section>`;
  }

  // fecha de los datos y lista de fuentes, dentro de «De dónde sale todo» (que ya viene en la página)
  function pintarCreditos() {
    const fecha = document.getElementById('pc-fecha');
    if (fecha && meta && meta.fecha) {
      const commit = /^[0-9a-f]{40}$/.test(meta.commit || '') ? meta.commit : '';
      fecha.innerHTML = ` Última actualización: ${esc(fechaTexto(meta.fecha))}`
        + (commit ? ` (<a href="https://github.com/buildcores/buildcores-open-db/tree/${commit}" rel="noopener">versión ${commit.slice(0, 7)}</a>).` : '.');
    }
    const caja = document.getElementById('pc-fuentes');
    const fuentes = Object.keys(R.fuentes || {}).map((k) => R.fuentes[k]);
    if (caja && fuentes.length) {
      caja.innerHTML = `<details class="pc-grupo"><summary>Todas las fuentes de las reglas <span class="pc-cuenta">${fuentes.length}</span></summary><ul class="pc-lista-fuentes">${fuentes.map((f) => `<li><a href="${esc(f.url)}" rel="noopener" target="_blank">${esc(f.titulo)}</a></li>`).join('')}</ul></details>`;
    }
  }

  // ------------------------------------------------------------ pintar

  function pintar() {
    const hay = TIPOS.filter((t) => elegido[t.clave]).length;
    const resultado = hay
      ? [hay >= 2 ? htmlVeredicto() : '', htmlPlaca(), htmlCpu(), htmlListas(), htmlMemoria(), htmlSsd()].join('')
      : htmlIntro();
    app.innerHTML = `<div class="pc-equipo" role="group" aria-label="Tu equipo">${TIPOS.map(htmlPieza).join('')}</div>
<p class="pc-aviso" id="pc-perdidas" hidden></p>
<p class="pc-acciones">${hay ? '<button type="button" class="pc-boton-chico" data-accion="copiar">Copiar enlace a este equipo</button> <button type="button" class="pc-boton-chico pc-boton-suave" data-accion="cero">Empezar de cero</button>' : ''}</p>
<div class="pc-resultado">${resultado}</div>`;
  }

  // ------------------------------------------------------------ enlace para compartir

  function hashEquipo() {
    const partes = TIPOS.filter((t) => elegido[t.clave]).map((t) => t.clave + '=' + encodeURIComponent(elegido[t.clave].id));
    return partes.length ? '#' + partes.join('&') : '';
  }

  // ¿es un enlace a un equipo? («#contenido», el del salto al contenido, no lo es)
  function esHashEquipo(hash) {
    return /(^|[#&])(placa|cpu|ram|ssd)=/.test(hash);
  }

  function guardarEnlace() {
    const hash = hashEquipo();
    if (location.hash !== hash) {
      try {
        history.replaceState(null, '', location.pathname + location.search + hash);
      } catch (e) {
        location.hash = hash;
      }
    }
  }

  // Lee el equipo de la dirección. Devuelve las piezas del enlace que ya no están en la lista.
  function leerEnlace() {
    const visto = Object.create(null);
    location.hash.replace(/^#/, '').split('&').forEach((par) => {
      const i = par.indexOf('=');
      if (i <= 0) return;
      try {
        visto[par.slice(0, i)] = decodeURIComponent(par.slice(i + 1));
      } catch (e) {
        visto[par.slice(0, i)] = '';  // un «%» mal puesto: esa pieza no se encuentra
      }
    });
    const perdidas = [];
    for (const t of TIPOS) {
      const id = visto[t.clave];
      elegido[t.clave] = (id && porId[t.clave][id]) || null;
      if (t.clave in visto && !elegido[t.clave]) perdidas.push(t.titulo.toLowerCase());
    }
    return perdidas;
  }

  function avisarPerdidas(perdidas) {
    const caja = document.getElementById('pc-perdidas');
    if (!caja) return;
    caja.hidden = !perdidas.length;
    caja.textContent = perdidas.length
      ? `Del enlace que has abierto no encuentro ${perdidas.length > 1 ? 'estas piezas' : 'esta pieza'}: ${perdidas.join(', ')}. Puede que la hayan quitado o renombrado en la lista; búscala otra vez.`
      : '';
    if (perdidas.length) avisar(caja.textContent);
  }

  function copiarEnlace(boton) {
    const url = location.origin + location.pathname + location.search + hashEquipo();
    const listo = (ok) => {
      boton.textContent = ok ? 'Enlace copiado' : 'Copia la dirección del navegador';
      avisar(ok ? 'Enlace copiado.' : 'No he podido copiar el enlace: cópialo de la barra de direcciones del navegador.');
      setTimeout(() => { boton.textContent = 'Copiar enlace a este equipo'; }, 2500);
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url).then(() => listo(true), () => listo(false));
    } else {
      listo(false);
    }
  }

  // ------------------------------------------------------------ eventos

  app.addEventListener('input', (e) => {
    const t = e.target;
    if (t.matches('input[role="combobox"]')) sugerir(t);
    if (t.matches('.pc-filtro-texto')) filtrar(t);
  });

  app.addEventListener('keydown', (e) => {
    const t = e.target;
    if (!t.matches('input[role="combobox"]')) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (t.getAttribute('aria-expanded') !== 'true') sugerir(t);
      mover(t, 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      mover(t, -1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const lista = t._hallados || [];
      const i = t._activo >= 0 ? t._activo : 0;
      if (lista[i]) elegir(t.dataset.tipo, lista[i]);
    } else if (e.key === 'Escape') {
      cerrar(t);
    }
  });

  app.addEventListener('focusout', (e) => {
    const t = e.target;
    if (t.matches && t.matches('input[role="combobox"]')) setTimeout(() => cerrar(t), 150);
  });

  app.addEventListener('focusin', (e) => {
    const t = e.target;
    if (t.matches && t.matches('input[role="combobox"]') && t.value) sugerir(t);
  });

  // que pulsar una sugerencia no quite antes el foco (y cierre la lista)
  app.addEventListener('mousedown', (e) => {
    if (e.target.closest('.pc-sugerencia')) e.preventDefault();
  });

  app.addEventListener('click', (e) => {
    const sug = e.target.closest('.pc-sugerencia');
    if (sug) {
      const input = document.getElementById('busca-' + sug.closest('.pc-sugerencias').id.replace('lista-', ''));
      const pieza = input && input._hallados ? input._hallados[Number(sug.dataset.i)] : null;
      if (pieza) elegir(input.dataset.tipo, pieza);
      return;
    }
    const quitar = e.target.closest('[data-quitar]');
    if (quitar) {
      const tipo = quitar.dataset.quitar;
      elegido[tipo] = null;
      guardarEnlace();
      pintar();
      const input = document.getElementById('busca-' + tipo);
      if (input) input.focus();
      return;
    }
    const opcion = e.target.closest('[data-elegir]');
    if (opcion) {
      const tipo = opcion.dataset.elegir;
      const pieza = porId[tipo][opcion.dataset.id];
      if (pieza) {
        elegir(tipo, pieza);
        const equipo = app.querySelector('.pc-equipo');
        const quieto = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (equipo && equipo.scrollIntoView) equipo.scrollIntoView({block: 'start', behavior: quieto ? 'auto' : 'smooth'});
      }
      return;
    }
    const accion = e.target.closest('[data-accion]');
    if (accion && accion.dataset.accion === 'copiar') copiarEnlace(accion);
    if (accion && accion.dataset.accion === 'cero') {
      for (const t of TIPOS) elegido[t.clave] = null;
      guardarEnlace();
      pintar();
      const input = document.getElementById('busca-placa');
      if (input) input.focus();
    }
  });

  function filtrar(input) {
    const q = PC.normal(input.value).split(' ').filter(Boolean);
    const bloqueEl = input.closest('.pc-bloque');
    bloqueEl.querySelectorAll('.pc-grupo').forEach((g) => {
      let visibles = 0;
      g.querySelectorAll('.pc-opciones > li').forEach((li) => {
        const texto = li._n || (li._n = PC.normal(li.textContent));
        const ok = q.every((t) => texto.indexOf(t) >= 0);
        li.hidden = !ok;
        if (ok) visibles++;
      });
      g.hidden = q.length > 0 && visibles === 0;
      if (q.length) g.open = visibles > 0 && visibles <= 60;
    });
  }

  window.addEventListener('hashchange', () => {
    // «Ir al contenido» y otros saltos dentro de la página no son un equipo: se deja como estaba
    if (!esHashEquipo(location.hash)) {
      guardarEnlace();
      return;
    }
    const perdidas = leerEnlace();
    pintar();
    avisarPerdidas(perdidas);
    guardarEnlace();
  });

  // ------------------------------------------------------------ arranque

  function cargar(url) {
    return fetch(url).then((r) => {
      if (!r.ok) throw new Error(url + ': ' + r.status);
      return r.json();
    });
  }

  Promise.all([cargar('reglas.json'), cargar('datos/meta.json')].concat(TIPOS.map((t) => cargar(t.archivo))))
    .then((todo) => {
      R = todo[0];
      meta = todo[1];
      TIPOS.forEach((t, i) => {
        datos[t.clave] = PC.tabla(todo[i + 2]);
        for (const p of datos[t.clave]) {
          p._n = PC.normal(p.nombre);
          porId[t.clave][p.id] = p;
        }
      });
      const perdidas = leerEnlace();
      pintar();
      pintarCreditos();
      avisarPerdidas(perdidas);
      guardarEnlace();
    })
    .catch(() => {
      app.innerHTML = '<p class="pc-error">No se han podido cargar las piezas. Recarga la página; si sigue igual, prueba dentro de un rato.</p>';
    });
})();
