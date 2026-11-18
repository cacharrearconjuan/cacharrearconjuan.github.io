/* ¿Qué le va a mi PC? — la página. La lógica está en logica.js (window.PC). */
(function () {
  'use strict';

  const PC = window.PC;
  const app = document.getElementById('pc-app');
  if (!app || !PC) return;

  // las de «despues» se cargan tras pintar la página: así no tarda más en salir
  const TIPOS = [
    {clave: 'placa', titulo: 'Placa base', ejemplo: 'Ej.: B550 Tomahawk', archivo: 'datos/placas.json'},
    {clave: 'cpu', titulo: 'Procesador', ejemplo: 'Ej.: Ryzen 5 5600', archivo: 'datos/cpu.json'},
    {clave: 'ram', titulo: 'Memoria RAM', ejemplo: 'Ej.: DDR5-6000 CL30', archivo: 'datos/ram.json'},
    {clave: 'ssd', titulo: 'SSD M.2', ejemplo: 'Ej.: 990 Pro 2TB', archivo: 'datos/ssd.json'},
    {clave: 'gpu', titulo: 'Tarjeta gráfica', ejemplo: 'Ej.: RTX 4060', archivo: 'datos/graficas.json', despues: true},
    {clave: 'psu', titulo: 'Fuente de alimentación', ejemplo: 'Ej.: RM750e', archivo: 'datos/fuentes.json', despues: true},
    {clave: 'caja', titulo: 'Caja', ejemplo: 'Ej.: Lancool 216', archivo: 'datos/cajas.json', despues: true},
    {clave: 'disipador', titulo: 'Disipador', ejemplo: 'Ej.: Peerless Assassin', archivo: 'datos/disipadores.json', despues: true},
  ];
  const datos = {};
  // sin prototipo: un enlace con «#cpu=constructor» no encuentra nada
  const porId = {};
  const elegido = {};
  const listo = {};      // tabla cargada
  const fallo = {};      // tabla que no se ha podido cargar
  const pendiente = Object.create(null);  // piezas del enlace cuya tabla aún no ha llegado
  for (const t of TIPOS) {
    datos[t.clave] = [];
    porId[t.clave] = Object.create(null);
    elegido[t.clave] = null;
    listo[t.clave] = !t.despues;
  }
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

  const MODULAR = {total: 'modular', semi: 'semimodular', no: 'no modular'};

  function listaY(cosas) {
    return cosas.length > 1 ? cosas.slice(0, -1).join(', ') + ' y ' + cosas[cosas.length - 1] : cosas.join('');
  }

  // «LGA 115x» es como se guardan juntos los 1150, 1155 y 1156
  function zocalosTexto(zocalos) {
    return (zocalos || []).map((z) => (z === 'LGA 115x' ? 'LGA 1150/1155/1156' : z)).join(', ');
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
    if (tipo === 'gpu') {
      return [p.chip, p.gb ? p.gb + ' GB' : null, p.largo ? p.largo + ' mm' : null,
        p.ranuras ? decimal(p.ranuras) + (p.ranuras === 1 ? ' ranura' : ' ranuras') : null].filter(Boolean).join(' · ');
    }
    if (tipo === 'psu') return [p.vatios + ' W', p.formato, p.eficiencia, MODULAR[p.modular]].filter(Boolean).join(' · ');
    if (tipo === 'caja') {
      return [p.formato, p.gpu_max ? 'gráfica hasta ' + p.gpu_max + ' mm' : null,
        p.disipador_max ? 'disipador hasta ' + p.disipador_max + ' mm' : null].filter(Boolean).join(' · ');
    }
    if (tipo === 'disipador') {
      return [p.liquida ? 'Líquida' + (p.radiador ? ', radiador de ' + p.radiador + ' mm' : '') : 'De aire' + (p.alto ? ', ' + p.alto + ' mm de alto' : ''),
        zocalosTexto(p.zocalos)].filter(Boolean).join(' · ');
    }
    return ['M.2 ' + p.largo, p.protocolo === 'sata' ? 'SATA' : 'NVMe' + (p.gen ? ' PCIe ' + p.gen + '.0' : '') + (p.carriles ? ' x' + p.carriles : ''),
      p.gb ? capacidad(p.gb) : null].filter(Boolean).join(' · ');
  }

  function icono(estado) {
    const i = ICONOS[estado] || ICONOS.info;
    return `<span class="pc-icono pc-icono-${CLASE_ICONO[estado] || 'info'}" aria-hidden="true">${i[0]}</span><span class="visual-oculto">${i[1]}: </span>`;
  }

  // webs de fabricantes: lo demás (análisis, tiendas) se rotula como «comprobado en …»
  const FABRICANTES = /(^|\.)(asus|msi|gigabyte|asrock|evga|zotac|pny|sapphiretech|xfxforce|powercolor|intel|amd|nvidia|corsair|bequiet|seasonic|coolermaster|nzxt|thermaltake|lian-li|lianli|fractal-design|phanteks|noctua|thermalright|arctic|deepcool|montech|silverstonetek|silverstone|hyte|jonsbo|scythe-eu|scythe|id-cooling|antec|inno3d|palit|gainward|galax|sparkle|acer|biostar)\.[a-z.]+$/i;

  function fuente(clave) {
    if (!clave) return null;
    if (/^https?:\/\//.test(clave)) {
      const sitio = clave.replace(/^https?:\/\/(www\.|us\.)?/, '').split('/')[0];
      return {titulo: FABRICANTES.test(sitio) ? 'ficha del fabricante (' + sitio + ')' : 'comprobado en ' + sitio, url: clave};
    }
    return (R.fuentes && R.fuentes[clave]) || null;
  }

  // qué es cada dato que se puede corregir a mano (pc/correcciones.json)
  const DATO_CORREGIDO = {
    largo: 'el largo', ranuras: 'el grosor', conectores: 'los conectores de corriente', pcie: 'la interfaz PCIe', tdp: 'el consumo',
    vatios: 'la potencia', formato: 'el formato', modular: 'si es modular', placas: 'las placas que admite', psu: 'las fuentes que admite',
    gpu_max: 'el largo de gráfica que admite', disipador_max: 'la altura de disipador que admite', psu_max: 'el largo de fuente que admite',
    incluida: 'la fuente que trae', zocalos: 'los zócalos', alto: 'la altura', liquida: 'el tipo', radiador: 'el radiador',
  };

  // fila de las piezas con datos corregidos a mano: cuáles y dónde se comprobaron
  function filaComprobada(tipo, p) {
    if (!p.fuente || !p.corregidos || !p.corregidos.length) return '';
    const datos = p.corregidos.map((c) => (tipo === 'psu' && c === 'pcie' ? 'los conectores PCIe' : DATO_CORREGIDO[c] || c));
    return fila('ok', 'Corregida a mano', `Datos corregidos a mano y comprobados en el enlace de abajo: ${listaY(datos)}. Lo demás sale de la base de datos de BuildCores.`, [p.fuente]);
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

  // una fila de un bloque: icono, título, texto y fuentes
  function fila(tipo, titulo, texto, fuentes) {
    return `<li class="pc-nota-fila">${icono(tipo)}<div>${titulo ? `<h3>${esc(titulo)}</h3>` : ''}<p>${esc(texto)}</p>${htmlFuentes(fuentes)}</div></li>`;
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
    const espera = !listo[t.clave];
    const placeholder = fallo[t.clave] ? 'No se ha podido cargar: recarga la página' : espera ? 'Cargando…' : t.ejemplo;
    return `<div class="pc-pieza" data-tipo="${t.clave}">
  <h2 class="pc-pieza-titulo"><label for="busca-${t.clave}">${t.titulo}</label></h2>
  <div class="pc-busca">
    <input type="search" id="busca-${t.clave}" data-tipo="${t.clave}" placeholder="${esc(placeholder)}"${espera ? ' disabled' : ''} autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="lista-${t.clave}">
    <ul class="pc-sugerencias" id="lista-${t.clave}" role="listbox" aria-label="${t.titulo}: resultados" hidden></ul>
  </div>
</div>`;
  }

  // el peor estado de una pieza con todo lo ya elegido (null si no hay nada con qué comprobarla)
  function estadoCompat(tipo, p) {
    let e = null;
    if (tipo === 'cpu' && elegido.placa) e = PC.cpuEnPlaca(R, p, elegido.placa).estado;
    else if (tipo === 'placa' && elegido.cpu) e = PC.cpuEnPlaca(R, elegido.cpu, p).estado;
    else if (tipo === 'placa' && elegido.ram) e = PC.ramEnPlaca(R, elegido.ram, p).estado;
    else if (tipo === 'ram' && elegido.placa) e = PC.ramEnPlaca(R, p, elegido.placa).estado;
    else if (tipo === 'ram' && elegido.cpu) e = PC.ramConCpu(R, p, elegido.cpu).estado;
    else if (tipo === 'ssd' && elegido.placa) e = PC.ssdEnPlaca(R, p, elegido.placa, elegido.cpu).estado;
    // con las piezas nuevas, el peor de todo lo que se pueda comprobar
    const {placa, cpu, gpu, psu, caja, disipador} = elegido;
    const mas = [];
    if (tipo === 'gpu') {
      if (placa) mas.push(PC.graficaEnPlaca(R, p, placa, cpu).estado);
      if (psu) mas.push(PC.graficaConFuente(R, p, psu, cpu).estado);
      if (caja) mas.push(PC.graficaEnCaja(R, p, caja).estado);
    } else if (tipo === 'psu') {
      if (gpu) mas.push(PC.graficaConFuente(R, gpu, p, cpu).estado);
      if (caja) mas.push(PC.fuenteEnCaja(R, p, caja).estado);
    } else if (tipo === 'caja') {
      if (placa) mas.push(PC.placaEnCaja(R, placa, p).estado);
      if (gpu) mas.push(PC.graficaEnCaja(R, gpu, p).estado);
      if (psu) mas.push(PC.fuenteEnCaja(R, psu, p).estado);
      if (disipador) mas.push(PC.disipadorEnCaja(R, disipador, p).estado);
    } else if (tipo === 'disipador') {
      if (cpu || placa) mas.push(PC.disipadorEnZocalo(R, p, (cpu || placa).zocalo).estado);
      if (caja) mas.push(PC.disipadorEnCaja(R, p, caja).estado);
    } else if (tipo === 'placa') {
      if (caja) mas.push(PC.placaEnCaja(R, p, caja).estado);
      if (gpu) mas.push(PC.graficaEnPlaca(R, gpu, p, cpu).estado);
      if (disipador && !cpu) mas.push(PC.disipadorEnZocalo(R, disipador, p.zocalo).estado);
    } else if (tipo === 'cpu') {
      if (disipador) mas.push(PC.disipadorConCpu(R, disipador, p).estado);
    }
    if (mas.length) e = PC.peor(e ? [e].concat(mas) : mas);
    return e;
  }

  // marca de compatibilidad con lo ya elegido, para las sugerencias
  function marcaCompat(tipo, p) {
    const e = estadoCompat(tipo, p);
    return e ? icono(e) : '';
  }

  // para las listas: cuenta lo demás elegido (null si no hay nada más con qué comprobar)
  const OTRAS = {gpu: ['placa', 'psu', 'caja'], psu: ['gpu', 'caja'], caja: ['placa', 'gpu', 'psu', 'disipador'], disipador: ['cpu', 'placa', 'caja']};

  function conLoDemas(tipo, sinContar) {
    const fuera = [].concat(sinContar);
    const hay = (OTRAS[tipo] || []).some((k) => fuera.indexOf(k) < 0 && elegido[k]);
    return hay ? (p) => estadoCompat(tipo, p) : null;
  }

  const NOMBRE_LISTA = {gpu: 'gráficas', psu: 'fuentes', caja: 'cajas', disipador: 'disipadores'};

  // si la tabla de una lista aún no ha llegado (o no se ha podido cargar), se dice en vez de «0 cajas»
  let esperaLista = false;  // hay alguna lista pintada a la espera de su tabla: se repinta al llegar

  function sinTabla(tipo) {
    if (listo[tipo]) return '';
    if (!fallo[tipo]) esperaLista = true;
    return fallo[tipo] ? `No se ha podido cargar la lista de ${NOMBRE_LISTA[tipo]}: recarga la página.` : `Cargando la lista de ${NOMBRE_LISTA[tipo]}…`;
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
    const g = PC.grafica(R, c, elegido.placa, elegido.gpu);
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
    if (p.m2) {
      m2 = `<p>${p.m2.length === 1 ? 'Un hueco' : p.m2.length + ' huecos'} para SSD, según la ficha${p.fuente ? ' del fabricante' : ''}:</p>${htmlHuecos(p)}`
        + (p.notas_m2 && p.notas_m2.length ? `<ul class="pc-subnotas">${p.notas_m2.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : '');
    }
    else m2 = `<p>${esc(PC.textoSinHuecos(p))}</p>`;
    filas.push(`<li class="pc-nota-fila">${icono(p.m2 ? 'info' : 'nose')}<div><h3>SSD M.2</h3>${m2}</div></li>`);
    if (p.video && p.video.length) filas.push(`<li class="pc-nota-fila">${icono('info')}<div><h3>Salidas de vídeo</h3><p>${esc(p.video.join(', '))}. Solo dan imagen con un procesador con gráfica integrada.</p></div></li>`);
    else if (Array.isArray(p.video)) filas.push(`<li class="pc-nota-fila">${icono('aviso')}<div><h3>Salidas de vídeo</h3><p>No tiene para la gráfica integrada: con esta placa hace falta tarjeta gráfica.</p>${htmlFuentes([p.fuente])}</div></li>`);
    if (p.flashback === true) filas.push(`<li class="pc-nota-fila">${icono('ok')}<div><h3>Actualizar la BIOS sin procesador</h3><p>Se puede, con un pendrive y el botón de la placa (BIOS Flashback, Flash BIOS o Q-Flash Plus, según la marca).</p></div></li>`);
    // la ranura de la gráfica según el chipset
    const ranura = PC.pcieRanura(R, p);
    if (p.x16 === 0) {
      filas.push(fila('nose', 'Ranura para la gráfica', 'Su ficha no trae ninguna ranura PCIe x16: míralo en el manual.'));
    } else if (ranura) {
      filas.push(fila('info', 'Ranura para la gráfica', ranura.min === ranura.max
        ? `PCIe ${ranura.min}.0 x16 (lo que deja el chipset ${p.chipset}).`
        : `PCIe ${ranura.min}.0 o ${ranura.max}.0 x16: con el chipset ${p.chipset}, lo elige cada fabricante. Míralo en la ficha de la placa.`, ranura.fuentes));
    }
    if (p.formato) filas.push(fila('info', 'Formato', `${p.formato}: necesita una caja que admita placas ${PC.formatoPlaca(p.formato)}.`));
    const extra = (p.fuente ? `<p class="pc-revisada">Huecos M.2, salidas de vídeo y botón de BIOS comprobados a mano con la <a href="${esc(p.fuente)}" rel="noopener" target="_blank">ficha del fabricante</a>.</p>` : '')
      + (p.revisada ? `<p class="pc-revisada">Ficha revisada a mano por BuildCores el ${esc(fechaTexto(p.revisada))}.</p>` : '');
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

  // ------------------------------------------------------------ listas grandes: cada grupo se pinta al abrirlo

  const listas = Object.create(null);
  let nListas = 0;
  const TOPE_LISTA = 300;

  function htmlLista(tipo, grupos, ejemplo) {
    if (!grupos.length) return '';
    const id = 'l' + (nListas++);
    listas[id] = {tipo: tipo, grupos: grupos};
    return `<div class="pc-perezosa" data-lista="${id}">`
      + `<p class="pc-filtro"><label>Filtrar <input type="search" class="pc-filtro-perezoso" data-lista="${id}" placeholder="${esc(ejemplo)}" autocomplete="off" spellcheck="false"></label></p>`
      + grupos.map((g, i) => `<details class="pc-grupo" data-lista="${id}" data-i="${i}"><summary>${icono(g.estado === 'si' ? 'si' : 'aviso')}${esc(g.titulo)} <span class="pc-cuenta">${cifra(g.piezas.length)}</span></summary><ul class="pc-opciones" role="list"></ul></details>`).join('')
      + '</div>';
  }

  function pintarGrupo(det, piezas) {
    const l = listas[det.dataset.lista];
    if (!l) return;
    const muestra = piezas.slice(0, TOPE_LISTA);
    det.querySelector('.pc-opciones').innerHTML = muestra.map((p) => botonElegir(l.tipo, p)).join('')
      + (piezas.length > muestra.length ? `<li class="pc-mas">Y ${cifra(piezas.length - muestra.length)} más: escribe en «Filtrar» para encontrarlas.</li>` : '');
    det._pintado = true;
  }

  function filtrarPerezoso(input) {
    const q = PC.normal(input.value).split(' ').filter(Boolean);
    const l = listas[input.dataset.lista];
    if (!l) return;
    app.querySelectorAll(`details[data-lista="${input.dataset.lista}"]`).forEach((det) => {
      const todas = l.grupos[Number(det.dataset.i)].piezas;
      const hay = q.length ? todas.filter((p) => {
        const n = p._n || (p._n = PC.normal(p.nombre));
        return q.every((t) => n.indexOf(t) >= 0);
      }) : todas;
      det._filtradas = q.length ? hay : null;
      det.hidden = q.length > 0 && !hay.length;
      det.querySelector('.pc-cuenta').textContent = cifra(hay.length);
      if (q.length) det.open = hay.length > 0 && hay.length <= 60;
      det._pintado = false;
      if (det.open) pintarGrupo(det, hay);
    });
  }

  // ------------------------------------------------------------ gráfica, fuente, caja y disipador

  function htmlGrafica() {
    const g = elegido.gpu;
    if (!g) return '';
    const {placa, cpu, psu, caja} = elegido;
    const ch = PC.chipGrafica(R, g);
    const marca = ch && ch.marca ? ch.marca : g.marca || 'el fabricante';
    const filas = [];
    if (ch) {
      const datosChip = [ch.pcie ? `PCIe ${ch.pcie[0]}.0 x${ch.pcie[1]}` : null, ch.consumo ? `gasta hasta ${ch.consumo} W` : null].filter(Boolean);
      const t = datosChip.length ? datosChip.join(' y ') + '.' : 'No tengo comprobados su interfaz ni su consumo.';
      filas.push(fila('info', `Chip ${g.chip}`, t.charAt(0).toUpperCase() + t.slice(1)
        + (ch.consumo ? ' Las versiones de fábrica con más frecuencia (OC) pueden gastar algo más.' : ''), ch.fuentes));
    } else {
      filas.push(fila('nose', `Chip ${g.chip}`, 'No tengo comprobada la ficha de este chip: lo que ves sale de la ficha de la tarjeta, sin contrastar.'));
    }
    if (!placa) {
      const e = PC.enlaceGrafica(R, g, null, null);
      let t = 'Va en cualquier placa con ranura PCIe x16: PCIe funciona entre versiones.';
      const fuentes = (((R.graficas || {}).compatible || {}).fuentes || []).slice();
      if (e && e.max[0] > 3) {
        const e3 = {gen: 3, carriles: e.max[1], max: e.max};
        const nr = PC.notaRendimiento(R, e3, g);
        t += ` En un equipo PCIe 3.0 iría a PCIe 3.0 x${e.max[1]}${nr ? ': ' + nr.texto.charAt(0).toLowerCase() + nr.texto.slice(1) : '.'}`;
        if (nr) fuentes.push(...nr.fuentes);
      }
      filas.push(fila('info', 'Placa', t, fuentes));
    }
    if (!psu) {
      const con = PC.conectoresGrafica(R, g);
      const c = PC.consumoGrafica(R, g);
      let t = ch && ch.psu ? `${marca} pide una fuente de ${ch.psu} W o más.` : c ? `Gasta hasta ${c.w} W${c.deChip ? '' : ' según su ficha'}; no tengo la fuente que pide el fabricante.` : 'No sé cuánto gasta: mira su ficha.';
      if (con) {
        const total = con.n[0] + con.n[1] + con.n[2];
        t += total ? ` Lleva ${PC.textoConectores(con.n)}${con.de === 'referencia' ? ' (lo de la tarjeta de referencia; las de marca pueden llevar otros)' : ''}.`
          : con.de === 'ranura' ? ' Gasta 75 W o menos: muchas no llevan conector de corriente.' : '';
      } else {
        t += ' No sé qué conectores de corriente lleva: míralo en su ficha.';
      }
      filas.push(fila('info', 'Fuente de alimentación', t, ch ? ch.fuentes_psu || ch.fuentes : []));
    }
    if (!caja && (g.largo || g.ranuras)) {
      const huecos = g.ranuras ? PC.huecosGrafica(g.ranuras) : 0;
      const partes = [g.largo ? `gráficas de ${g.largo} mm o más` : null,
        huecos ? `${huecos} ranuras de expansión libres${huecos !== g.ranuras ? ' (ocupa ' + decimal(g.ranuras) + ')' : ''}` : null].filter(Boolean);
      filas.push(fila('info', 'Caja', `Necesita una caja que admita ${partes.join(' y ')}.`));
    }
    const rb = PC.notaRebar(R, g, cpu);
    if (rb) filas.push(fila(rb.tipo, 'Resizable BAR', rb.texto, rb.fuentes));
    filas.push(filaComprobada('gpu', g));
    let html = bloque('gpu', `Gráfica: ${esc(g.nombre)}`, `<ul class="pc-notas" role="list">${filas.join('')}</ul>`);
    if (!caja && g.largo) {
      if (!listo.caja) {
        html += bloque('cajas-gpu', 'Cajas donde cabe', '', esc(sinTabla('caja')));
      } else {
        const extra = conLoDemas('caja', 'gpu');
        const grupos = PC.cajasParaGrafica(R, datos.caja, g, extra);
        const n = grupos.reduce((s, x) => s + x.piezas.length, 0);
        html += bloque('cajas-gpu', 'Cajas donde cabe', htmlLista('caja', grupos, 'NZXT, Lancool, blanca…'),
          esc(`${cifra(n)} cajas de la lista admiten una gráfica de ${g.largo} mm${g.ranuras ? ' y su grosor' : ''}${extra ? ' y encajan con lo demás que has elegido' : ''}. Solo salen las que traen esa medida en su ficha.`));
      }
    }
    if (!psu) {
      if (!listo.psu) {
        html += bloque('fuentes-gpu', 'Fuentes que le valen', '', esc(sinTabla('psu')));
      } else {
        const extra = conLoDemas('psu', 'gpu');
        const grupos = PC.fuentesParaGrafica(R, datos.psu, g, cpu, extra);
        const si = grupos.filter((x) => x.estado === 'si').reduce((s, x) => s + x.piezas.length, 0);
        const texto = !grupos.length
          ? 'No sé qué fuente pide esta gráfica ni qué conectores lleva, así que no puedo filtrar las fuentes: mira su ficha.'
          : `${cifra(si)} fuentes de la lista ${ch && ch.psu ? 'cumplen lo que pide ' + marca : 'le valen'}${cpu ? ' con este procesador' : ''}${extra ? ' y encajan con lo demás que has elegido' : ''}. Las de «ojo» van justas o les falta algún dato: elige una y te digo por qué.`;
        html += bloque('fuentes-gpu', 'Fuentes que le valen', htmlLista('psu', grupos, 'Corsair, 850, Gold…'), esc(texto));
      }
    }
    return html;
  }

  function htmlFuente() {
    const p = elegido.psu;
    if (!p) return '';
    const filas = [];
    filas.push(fila('info', 'Potencia', [p.vatios + ' W', p.eficiencia, MODULAR[p.modular]].filter(Boolean).join(' · ') + '.'));
    const conectores = p.pcie ? PC.textoFuente(p.pcie) : '';
    filas.push(p.pcie
      ? fila('info', 'Conectores para la gráfica', `${conectores.charAt(0).toUpperCase() + conectores.slice(1)}.${p.pcie[1] ? ' Los de 16 pines son los 12VHPWR o 12V-2x6.' : ''}`)
      : fila('nose', 'Conectores para la gráfica', 'No sé seguro cuántos trae: su ficha no lo dice o no cuadra. Míralo en la web del fabricante antes de comprarla para una gráfica.'));
    filas.push(p.formato
      ? fila('info', 'Formato', `${p.formato}${p.largo ? ', ' + p.largo + ' mm de largo' : ''}.`)
      : fila('nose', 'Formato', 'Su ficha no dice si es ATX, SFX…: míralo antes de comprar la caja.'));
    filas.push(filaComprobada('psu', p));
    let html = bloque('psu', `Fuente: ${esc(p.nombre)}`, `<ul class="pc-notas" role="list">${filas.join('')}</ul>`);
    if (!elegido.gpu) {
      if (!listo.gpu) {
        html += bloque('gpus-psu', 'Gráficas que puede mover', '', esc(sinTabla('gpu')));
      } else {
        const extra = conLoDemas('gpu', 'psu');
        const grupos = PC.graficasParaFuente(R, datos.gpu, p, elegido.cpu, extra);
        html += bloque('gpus-psu', 'Gráficas que puede mover', htmlLista('gpu', grupos, 'RTX 4070, Sapphire, 16GB…'),
          esc(`Según la fuente que pide cada fabricante y los conectores${elegido.cpu ? ', con este procesador' : ''}${extra ? ', y que encajan con lo demás que has elegido' : ''}. Las de «ojo» van justas o les falta algún dato: elige una y te digo por qué.`));
      }
    }
    return html;
  }

  function htmlCaja() {
    const c = elegido.caja;
    if (!c) return '';
    const filas = [];
    filas.push(fila('info', 'Placas', `Admite placas ${listaY(c.placas)}.`));
    filas.push(c.gpu_max
      ? fila('info', 'Gráfica', `Hasta ${c.gpu_max} mm de largo${c.ranuras ? ', con ' + c.ranuras + ' ranuras de expansión' : ''}.`)
      : fila('nose', 'Gráfica', 'Su ficha no dice hasta qué largo de gráfica admite.'));
    filas.push(c.disipador_max
      ? fila('info', 'Disipador', `Hasta ${c.disipador_max} mm de alto.`)
      : fila('nose', 'Disipador', 'Su ficha no dice qué altura de disipador admite.'));
    filas.push(c.psu
      ? fila('info', 'Fuente de alimentación', `${listaY(c.psu)}${c.psu_max ? ', de hasta ' + c.psu_max + ' mm' : ''}.`)
      : fila('nose', 'Fuente de alimentación', 'Su ficha no dice qué fuentes admite.'));
    if (c.incluida) filas.push(fila('info', 'Trae fuente', `Viene con una fuente de ${c.incluida} W.`));
    filas.push(filaComprobada('caja', c));
    let html = bloque('caja', `Caja: ${esc(c.nombre)}`, `<ul class="pc-notas" role="list">${filas.join('')}</ul>`);
    if (!elegido.gpu && c.gpu_max) {
      if (!listo.gpu) {
        html += bloque('gpus-caja', 'Gráficas que caben', '', esc(sinTabla('gpu')));
      } else {
        const extra = conLoDemas('gpu', 'caja');
        const grupos = PC.graficasParaCaja(R, datos.gpu, c, extra);
        const n = grupos.reduce((s, x) => s + x.piezas.length, 0);
        html += bloque('gpus-caja', 'Gráficas que caben', htmlLista('gpu', grupos, 'RTX 4070, Sapphire, 16GB…'),
          esc(`${cifra(n)} gráficas de la lista miden ${c.gpu_max} mm o menos${c.ranuras ? ' y caben de grosor' : ''}${extra ? ', y encajan con lo demás que has elegido' : ''}. Solo salen las que traen su largo en la ficha.`));
      }
    }
    if (!elegido.disipador && c.disipador_max) {
      if (!listo.disipador) {
        html += bloque('disipadores-caja', 'Disipadores de aire que caben', '', esc(sinTabla('disipador')));
      } else {
        const extra = conLoDemas('disipador', 'caja');
        const grupos = PC.disipadoresParaCaja(R, datos.disipador, c, extra);
        const n = grupos.reduce((s, x) => s + x.piezas.length, 0);
        html += bloque('disipadores-caja', 'Disipadores de aire que caben', htmlLista('disipador', grupos, 'Noctua, Peerless, blanco…'),
          esc(`${cifra(n)} disipadores de la lista miden ${c.disipador_max} mm o menos de alto${extra ? ' y encajan con lo demás que has elegido' : ''}. Los de líquida no salen: depende del radiador.`));
      }
    }
    return html;
  }

  function htmlDisipador() {
    const d = elegido.disipador;
    if (!d) return '';
    const filas = [];
    filas.push(fila('info', 'Tipo', d.liquida
      ? `Refrigeración líquida${d.radiador ? ', con radiador de ' + d.radiador + ' mm' : ''}: la caja tiene que admitir ese radiador.`
      : `De aire${d.alto ? ', ' + d.alto + ' mm de alto' : ''}.`));
    const vale = PC.zocalosDisipador(R, d);
    const extra = Object.keys(vale).filter((z) => !vale[z].directo);
    const fuentesExtra = [].concat(...extra.map((z) => vale[z].grupo.fuentes || []));
    filas.push(fila('info', 'Zócalos', `Trae anclaje para ${zocalosTexto(d.zocalos)}.${extra.length ? ` Por anclaje, también vale en ${listaY(extra)}.` : ''}`, fuentesExtra));
    filas.push(filaComprobada('disipador', d));
    let html = bloque('disipador', `Disipador: ${esc(d.nombre)}`, `<ul class="pc-notas" role="list">${filas.join('')}</ul>`);
    if (!elegido.caja && !d.liquida && d.alto) {
      if (!listo.caja) {
        html += bloque('cajas-disipador', 'Cajas donde cabe', '', esc(sinTabla('caja')));
      } else {
        const extra = conLoDemas('caja', 'disipador');
        const grupos = PC.cajasParaDisipador(R, datos.caja, d, extra);
        const n = grupos.reduce((s, x) => s + x.piezas.length, 0);
        html += bloque('cajas-disipador', 'Cajas donde cabe', htmlLista('caja', grupos, 'NZXT, Lancool, blanca…'),
          esc(`${cifra(n)} cajas de la lista admiten un disipador de ${d.alto} mm de alto${extra ? ' y encajan con lo demás que has elegido' : ''}. Solo salen las que traen esa medida en su ficha.`));
      }
    }
    return html;
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
    // piezas nuevas que dependen de la placa o del procesador
    if (placa && !elegido.caja && placa.formato && listo.caja) {
      const extra = conLoDemas('caja', 'placa');
      const grupos = PC.cajasParaPlaca(R, datos.caja, placa, extra);
      const n = grupos.reduce((s, x) => s + x.piezas.length, 0);
      html += bloque('cajas-placa', 'Cajas para esta placa', htmlLista('caja', grupos, 'NZXT, Lancool, blanca…'),
        esc(`${cifra(n)} cajas de la lista admiten placas ${PC.formatoPlaca(placa.formato)}${extra ? ' y encajan con lo demás que has elegido' : ''}. Para la gráfica, el disipador y la fuente, elígelos y te digo si caben.`));
    }
    const zocalo = cpu ? cpu.zocalo : placa ? placa.zocalo : null;
    if (zocalo && !elegido.disipador && listo.disipador) {
      const extra = conLoDemas('disipador', ['cpu', 'placa']);
      const grupos = PC.disipadoresParaZocalo(R, datos.disipador, zocalo, extra);
      const n = grupos.reduce((s, x) => s + x.piezas.length, 0);
      html += bloque('disipadores-zocalo', `Disipadores para ${esc(zocalo)}`, htmlLista('disipador', grupos, 'Noctua, Peerless, 360…'),
        esc(`${cifra(n)} disipadores de la lista traen anclaje para ${zocalo} o uno que vale${extra ? ', y encajan con lo demás que has elegido' : ''}. La ficha no dice cuánto calor disipa cada uno: para un procesador que gaste mucho, mira la recomendación del fabricante.`));
    }
    return html;
  }

  function htmlIntro() {
    const n = meta && meta.piezas ? meta.piezas : null;
    const plataformas = Object.keys(R.plataformas || {}).join(', ');
    return `<section class="pc-bloque pc-intro">
  <h2>Cómo va</h2>
  <p>Elige arriba lo que tienes o lo que quieres comprar, en el orden que quieras: con una pieza te digo qué le va; con varias, si encajan entre ellas, a qué velocidad irá la memoria, dónde va el SSD, si la gráfica cabe en la caja y si la fuente puede con ella.</p>
  <p>Cubre ${esc(plataformas)}${n ? `: ${esc(cifra(n.placas))} placas, ${esc(cifra(n.cpu))} procesadores, ${esc(cifra(n.ram))} kits de memoria, ${esc(cifra(n.ssd))} SSD M.2${n.graficas ? `, ${esc(cifra(n.graficas))} gráficas, ${esc(cifra(n.fuentes))} fuentes, ${esc(cifra(n.cajas))} cajas y ${esc(cifra(n.disipadores))} disipadores` : ''}` : ''}. Lo nuevo aparece solo cada día.</p>
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

  // ------------------------------------------------------------ dónde comprarlo

  const TABLA_DE = {placa: 'placas', cpu: 'cpu', ram: 'ram', ssd: 'ssd', gpu: 'graficas', psu: 'fuentes', caja: 'cajas', disipador: 'disipadores'};

  function enlaceTienda(e) {
    const etiqueta = e.exacto ? `${e.tienda} <span class="pc-compra-exacto">(ficha exacta)</span>` : esc(e.tienda);
    return `<a class="pc-compra-enlace" href="${esc(e.url)}" target="_blank" rel="noopener noreferrer nofollow">${etiqueta}<span class="visual-oculto"> (se abre en otra pestaña)</span></a>`;
  }

  function htmlCompra() {
    const piezas = TIPOS.filter((t) => elegido[t.clave]);
    if (!piezas.length) return '';
    const filas = piezas.map((t) => {
      const e = PC.enlacesCompra(TABLA_DE[t.clave], elegido[t.clave]);
      return `<li class="pc-compra-pieza"><h3><span class="pc-compra-tipo">${esc(t.titulo)}</span> ${esc(elegido[t.clave].nombre)}</h3>
  <p class="pc-compra-fila"><span class="pc-compra-que">Comparar precios</span> ${e.comparadores.map(enlaceTienda).join(' ')}</p>
  <p class="pc-compra-fila"><span class="pc-compra-que">Tiendas</span> ${e.tiendas.map(enlaceTienda).join(' ')}</p></li>`;
    }).join('');
    const entradilla = 'Los precios cambian cada día: los comparadores ordenan las tiendas de más barata a más cara en el momento. '
      + 'Antes de pagar, mira que sea el modelo exacto (capacidad, versión DDR4 o DDR5…). Sin enlaces de afiliado: esta web no gana nada con tu compra.';
    return bloque('compra', 'Dónde comprarlo', `<ul class="pc-compra" role="list">${filas}</ul>`, entradilla);
  }

  function pintar() {
    for (const k of Object.keys(listas)) delete listas[k];
    nListas = 0;
    esperaLista = false;
    const hay = TIPOS.filter((t) => elegido[t.clave]).length;
    const resultado = hay
      ? [hay >= 2 ? htmlVeredicto() : '', htmlPlaca(), htmlCpu(), htmlListas(), htmlMemoria(), htmlSsd(),
        htmlGrafica(), htmlFuente(), htmlCaja(), htmlDisipador(), htmlCompra()].join('')
      : htmlIntro();
    app.innerHTML = `<div class="pc-equipo" role="group" aria-label="Tu equipo">${TIPOS.map(htmlPieza).join('')}</div>
<p class="pc-aviso" id="pc-perdidas" hidden></p>
<p class="pc-acciones">${hay ? '<button type="button" class="pc-boton-chico" data-accion="copiar">Copiar enlace a este equipo</button> <button type="button" class="pc-boton-chico pc-boton-suave" data-accion="cero">Empezar de cero</button>' : ''}</p>
<div class="pc-resultado">${resultado}</div>`;
  }

  // ------------------------------------------------------------ enlace para compartir

  function hashEquipo() {
    // las piezas cuya tabla aún no ha llegado se quedan en el enlace tal cual
    const partes = TIPOS.filter((t) => elegido[t.clave] || pendiente[t.clave])
      .map((t) => t.clave + '=' + encodeURIComponent(elegido[t.clave] ? elegido[t.clave].id : pendiente[t.clave]));
    return partes.length ? '#' + partes.join('&') : '';
  }

  // ¿es un enlace a un equipo? («#contenido», el del salto al contenido, no lo es)
  function esHashEquipo(hash) {
    return /(^|[#&])(placa|cpu|ram|ssd|gpu|psu|caja|disipador)=/.test(hash);
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
      delete pendiente[t.clave];
      if (!listo[t.clave] && id) {
        // su tabla llega después (o no se ha podido cargar): se queda en el enlace y se elige cuando esté
        pendiente[t.clave] = id;
        elegido[t.clave] = null;
        continue;
      }
      elegido[t.clave] = (id && porId[t.clave][id]) || null;
      if (t.clave in visto && !elegido[t.clave]) perdidas.push(t.titulo.toLowerCase());
    }
    return perdidas;
  }

  // Cuando llegan las tablas de después, elige lo que el enlace pedía de ellas.
  // Devuelve las que ya no están en la lista y cuántas ha elegido.
  function aplicarPendientes() {
    const perdidas = [];
    let aplicadas = 0;
    for (const t of TIPOS) {
      const id = pendiente[t.clave];
      if (!id || !listo[t.clave]) continue;
      delete pendiente[t.clave];
      elegido[t.clave] = porId[t.clave][id] || null;
      if (elegido[t.clave]) aplicadas++;
      else perdidas.push(t.titulo.toLowerCase());
    }
    return {perdidas: perdidas, aplicadas: aplicadas};
  }

  // Avisa de las piezas del enlace que ya no están y de las listas que no se han podido cargar
  // (esas piezas siguen en la dirección: al recargar, se eligen).
  function avisarPerdidas(perdidas) {
    const caja = document.getElementById('pc-perdidas');
    if (!caja) return;
    const caidas = TIPOS.filter((t) => fallo[t.clave] && pendiente[t.clave]).map((t) => NOMBRE_LISTA[t.clave]);
    const partes = [];
    if (perdidas.length) {
      partes.push(`Del enlace que has abierto no encuentro ${perdidas.length > 1 ? 'estas piezas' : 'esta pieza'}: ${perdidas.join(', ')}. Puede que la hayan quitado o renombrado en la lista; búscala otra vez.`);
    }
    if (caidas.length) {
      partes.push(`No se ha podido cargar la lista de ${listaY(caidas)}: ${caidas.length > 1 ? 'las piezas del enlace siguen' : 'la pieza del enlace sigue'} en la dirección, así que recarga la página para verla.`);
    }
    caja.hidden = !partes.length;
    caja.textContent = partes.join(' ');
    if (partes.length) avisar(caja.textContent);
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
    if (t.matches('.pc-filtro-perezoso')) filtrarPerezoso(t);
  });

  // las listas grandes se pintan al abrir cada grupo («toggle» no burbujea: se escucha en la captura)
  app.addEventListener('toggle', (e) => {
    const det = e.target;
    if (!det.matches || !det.matches('details[data-lista]') || !det.open || det._pintado) return;
    const l = listas[det.dataset.lista];
    if (l) pintarGrupo(det, det._filtradas || l.grupos[Number(det.dataset.i)].piezas);
  }, true);

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
      for (const t of TIPOS) {
        elegido[t.clave] = null;
        delete pendiente[t.clave];
      }
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

  function meterTabla(t, json) {
    const lista = PC.tabla(json);
    const ids = Object.create(null);
    for (const p of lista) {
      p._n = PC.normal(p.nombre);
      ids[p.id] = p;
    }
    datos[t.clave] = lista;
    porId[t.clave] = ids;
    // lo que las comprobaciones necesitan saber de toda la lista: el procesador que menos gasta
    // (suelo de la cuenta de la fuente) y los conectores de las gráficas de marca de cada chip
    if (t.clave === 'cpu') R._picoMinimo = PC.picoMinimo(R, lista);
    if (t.clave === 'gpu') R._conectoresChip = PC.conectoresPorChip(lista);
    listo[t.clave] = true;
  }

  // Repinta sin quitar a la persona lo que estaba escribiendo (en un buscador o en un filtro).
  function repintarConservando() {
    const a = document.activeElement;
    let antes = null;
    if (a && app.contains(a) && a.matches('input')) {
      const b = a.closest('.pc-bloque');
      antes = {id: a.id, bloque: b ? b.getAttribute('aria-labelledby') : '', clase: (a.className || '').split(' ')[0],
        valor: a.value, ini: a.selectionStart, fin: a.selectionEnd};
    }
    pintar();
    if (!antes) return;
    const el = antes.id ? document.getElementById(antes.id)
      : antes.bloque && antes.clase ? app.querySelector(`[aria-labelledby="${antes.bloque}"] input.${antes.clase}`) : null;
    if (!el || el.disabled) return;
    if (!el.value && antes.valor) el.value = antes.valor;
    el.focus({preventScroll: true});
    try {
      el.setSelectionRange(antes.ini, antes.fin);
    } catch (e) {
      // algunos tipos de campo no dejan poner la selección: se deja el cursor donde caiga
    }
    if (el.value && el.matches('.pc-filtro-texto')) filtrar(el);
    if (el.value && el.matches('.pc-filtro-perezoso')) filtrarPerezoso(el);
  }

  // ¿está escribiendo en algún buscador o filtro? Entonces no se repinta la página debajo de sus dedos.
  function escribiendo() {
    const a = document.activeElement;
    return !!(a && app.contains(a) && a.matches('input') && a.value);
  }

  const base = TIPOS.filter((t) => !t.despues);
  const despues = TIPOS.filter((t) => t.despues);
  // todas se piden a la vez; la página sale con las primeras y las demás se van sumando
  const llegadas = despues.map((t) => cargar(t.archivo));
  llegadas.forEach((p) => p.catch(() => {}));  // si fallan, se ve en su buscador (no es un error suelto)

  Promise.all([cargar('reglas.json'), cargar('datos/meta.json')].concat(base.map((t) => cargar(t.archivo))))
    .then((todo) => {
      R = todo[0];
      meta = todo[1];
      base.forEach((t, i) => meterTabla(t, todo[i + 2]));
      const perdidas = leerEnlace();
      pintar();
      pintarCreditos();
      avisarPerdidas(perdidas);
      guardarEnlace();
      // una tabla que no llega, o que llega con una forma que no se entiende, solo apaga su buscador
      const caida = (t) => {
        fallo[t.clave] = true;
        listo[t.clave] = false;
        datos[t.clave] = [];
        porId[t.clave] = Object.create(null);
      };
      return Promise.all(llegadas.map((p, i) => p.then((json) => {
        try {
          meterTabla(despues[i], json);
        } catch (e) {
          caida(despues[i]);
        }
      }, () => caida(despues[i])))).then(() => {
        const r2 = aplicarPendientes();
        if (escribiendo() && !r2.aplicadas && !r2.perdidas.length && !esperaLista) {
          // se habilitan los buscadores nuevos sin tocar lo demás
          for (const t of despues) {
            const input = document.getElementById('busca-' + t.clave);
            if (!input) continue;
            input.disabled = !listo[t.clave];
            input.placeholder = fallo[t.clave] ? 'No se ha podido cargar: recarga la página' : t.ejemplo;
          }
        } else {
          repintarConservando();
        }
        avisarPerdidas(perdidas.concat(r2.perdidas));
        guardarEnlace();
      });
    })
    .catch(() => {
      app.innerHTML = '<p class="pc-error">No se han podido cargar las piezas. Recarga la página; si sigue igual, prueba dentro de un rato.</p>';
    });
})();
