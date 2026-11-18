/* ¿Qué le va a mi PC? — la lógica de compatibilidad, sin nada de la página.
 *
 * Funciona igual en el navegador (window.PC) que en Node (require), para las pruebas.
 * Piezas: BuildCores OpenDB (CC BY-NC-SA 4.0), preparadas por web/datos_pc.py.
 * Reglas: pc/reglas.json, sacadas de las fichas oficiales de AMD e Intel (cada dato con su fuente).
 *
 * Estados que devuelve todo: «si», «bios» (sí, con la BIOS al día), «depende», «no» y «nose».
 */
(function (raiz) {
  'use strict';

  const ORDEN_ESTADOS = ['si', 'bios', 'depende', 'nose', 'no'];

  // ------------------------------------------------------------ datos

  // {"campos": [...], "datos": [[...], ...]} -> [{campo: valor}, ...]
  function tabla(json) {
    const campos = json.campos;
    return json.datos.map((fila) => {
      const o = {};
      for (let j = 0; j < campos.length; j++) o[campos[j]] = fila[j];
      return o;
    });
  }

  // ------------------------------------------------------------ búsqueda

  function normal(t) {
    t = String(t == null ? '' : t).toLowerCase();
    if (t.normalize) t = t.normalize('NFD').replace(/[̀-ͯ]/g, '');
    return t.replace(/[™®]/g, '').replace(/[-_/(),.+:;'"]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function posicion(n, trozo) {
    const p = n.indexOf(trozo);
    return p === 0 || n.charAt(p - 1) === ' ' ? p : p + 1000;  // mejor al principio de palabra
  }

  // Todas las palabras de la consulta tienen que estar en el nombre, en cualquier orden.
  function buscar(lista, consulta, max) {
    const q = normal(consulta);
    if (q.length < 2) return [];
    const trozos = q.split(' ');
    const hallados = [];
    for (const pieza of lista) {
      const n = pieza._n || (pieza._n = normal(pieza.nombre));
      if (trozos.every((t) => n.indexOf(t) >= 0)) hallados.push(pieza);
    }
    hallados.sort((a, b) => posicion(a._n, trozos[0]) - posicion(b._n, trozos[0])
      || a._n.length - b._n.length || (a._n < b._n ? -1 : a._n > b._n ? 1 : 0));
    return hallados.slice(0, max || 30);
  }

  // ------------------------------------------------------------ reglas

  function plataforma(R, zocalo) {
    return (R.plataformas && R.plataformas[zocalo]) || null;
  }

  function familia(R, clave) {
    return (clave && R.familias && R.familias[clave]) || null;
  }

  function reglasChipset(R, placa) {
    const p = plataforma(R, placa.zocalo);
    return (p && placa.chipset && p.chipsets && p.chipsets[placa.chipset]) || null;
  }

  function de(obj, clave) {
    return obj && clave in obj ? obj[clave] : null;
  }

  // las fuentes pueden venir sueltas o en listas: se aplanan y se quitan las repetidas
  function nota(tipo, texto, fuentes) {
    const todas = [].concat.apply([], (fuentes || []).map((f) => (Array.isArray(f) ? f : [f]))).filter(Boolean);
    return {tipo: tipo, texto: texto, fuentes: todas.filter((f, i) => todas.indexOf(f) === i)};
  }

  // gama del procesador para las velocidades que cambian según la gama (Intel)
  function gama(cpu) {
    const n = cpu.nombre || '';
    let m = /Core Ultra ([3579])\b/i.exec(n);
    if (m) return 'u' + m[1];
    m = /Core i([3579])\b/i.exec(n);
    if (m) return 'i' + m[1];
    if (/Pentium/i.test(n)) return 'pentium';
    if (/Celeron/i.test(n)) return 'celeron';
    if (/Athlon/i.test(n)) return 'athlon';
    return '';
  }

  function tiposCpu(R, cpu) {
    const F = familia(R, cpu.familia);
    if (F && F.ram) return Object.keys(F.ram);
    return cpu.ram || [];
  }

  function mayuscula(texto) {
    return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : texto;
  }

  function ddr(tipo, velocidad) {
    return tipo + '-' + velocidad;
  }

  // ------------------------------------------------------------ procesador y placa

  function cpuEnPlaca(R, cpu, placa) {
    const r = {estado: 'nose', texto: '', notas: [], fuentes: []};
    if (cpu.zocalo !== placa.zocalo) {
      r.estado = 'no';
      r.texto = `No encaja: el procesador es ${cpu.zocalo} y la placa ${placa.zocalo}.`;
      return r;
    }
    const P = plataforma(R, placa.zocalo);
    const F = familia(R, cpu.familia);
    const ch = reglasChipset(R, placa);
    if (!P) {
      r.texto = `Mismo zócalo (${placa.zocalo}), pero es una plataforma nueva que aún no tiene reglas comprobadas: mira la lista de procesadores de la placa en la web del fabricante.`;
      return r;
    }
    if (!F) {
      r.texto = 'Mismo zócalo, pero no reconozco la familia de este procesador: mira la lista de procesadores de la placa en la web del fabricante.';
      return r;
    }
    if (!ch) {
      r.texto = `Mismo zócalo, pero no tengo reglas del chipset ${placa.chipset || 'de esta placa'}: mira la lista de procesadores de la placa en la web del fabricante.`;
      return r;
    }
    // un modelo concreto puede ir distinto que su familia (p. ej. los Athlon con gráfica en X570)
    const porModelo = de(ch.soporte_modelo, cpu.id);
    const s = porModelo || de(ch.soporte, cpu.familia);
    const quien = porModelo ? `el ${cpu.nombre}` : `los ${F.nombre}`;
    r.fuentes = (ch.fuentes || []).concat(porModelo ? ch.fuentes_modelo || [] : []);
    if (s === 'si') {
      r.estado = 'si';
      r.texto = `Sí: el chipset ${placa.chipset} admite ${quien} de serie.`;
      if (cpu.anio && placa.anio && cpu.anio > placa.anio) {
        r.notas.push(`El procesador es de ${cpu.anio} y la placa de ${placa.anio}: si la placa lleva la BIOS de fábrica, puede que haya que actualizarla.`);
      }
    } else if (s === 'bios') {
      r.estado = 'bios';
      const cual = de(ch.bios_modelo, cpu.id) || de(ch.bios, cpu.familia);
      r.texto = `Sí, con la BIOS actualizada${cual ? ' (' + cual + ')' : ''}: el chipset ${placa.chipset} admite ${quien}, pero una placa con la BIOS de fábrica antigua no ${porModelo ? 'lo' : 'los'} reconoce.`;
      r.notas.push(placa.flashback === true
        ? 'Esta placa se puede actualizar con un pendrive y sin procesador (BIOS Flashback, Flash BIOS o Q-Flash Plus, según la marca).'
        : 'Si la BIOS es antigua, actualízala antes de cambiar el procesador (con el procesador viejo puesto). Algunas placas se actualizan sin procesador (BIOS Flashback): mira el manual.');
    } else if (s === 'depende') {
      r.estado = 'depende';
      r.texto = `Depende de tu placa: ${de(ch.depende_modelo, cpu.id) || de(ch.depende, cpu.familia) || 'no todos los fabricantes sacaron una BIOS para esta familia.'} Mira la lista de procesadores de tu modelo exacto.`;
    } else if (s === 'no') {
      r.estado = 'no';
      const motivo = de(ch.motivo_modelo, cpu.id) || de(ch.motivo, cpu.familia);
      r.texto = `No: el chipset ${placa.chipset} no admite ${quien}.${motivo ? ' ' + motivo : ''}`;
    } else {
      r.texto = `No tengo comprobado si el chipset ${placa.chipset} admite ${quien}: mira la lista de procesadores de la placa.`;
    }
    if (r.estado !== 'no') {
      const extra = de(ch.notas, cpu.familia);
      if (extra) r.notas.push(extra);
      if (ch.tdp_max && cpu.tdp && cpu.tdp > ch.tdp_max && ch.nota_tdp) r.notas.push(ch.nota_tdp);
      if (F.nota_placa) {
        r.notas.push(F.nota_placa);
        r.fuentes = r.fuentes.concat(F.fuentes_nota_placa || []);
      }
    }
    return r;
  }

  // ------------------------------------------------------------ memoria

  function ramEnPlaca(R, kit, placa) {
    const total = kit.modulos * kit.gb;
    if (placa.ram && kit.tipo !== placa.ram) {
      return {estado: 'no', texto: `No: la placa usa ${placa.ram} y la memoria es ${kit.tipo}. La muesca está en otro sitio: no entra.`, notas: []};
    }
    if (placa.ranuras && kit.modulos > placa.ranuras) {
      return {estado: 'no', texto: `No: son ${kit.modulos} módulos y la placa tiene ${placa.ranuras} ${placa.ranuras === 1 ? 'ranura' : 'ranuras'}.`, notas: []};
    }
    const r = {estado: 'si', texto: '', notas: []};
    if (!placa.ram) {
      r.estado = 'depende';
      r.texto = `La ficha de la placa no dice qué memoria usa: comprueba que sea ${kit.tipo}.`;
    } else {
      r.texto = `Sí: ${kit.tipo}, ${kit.modulos} ${kit.modulos === 1 ? 'módulo' : 'módulos'}${placa.ranuras ? ' en una placa de ' + placa.ranuras + ' ranuras' : ''}.`;
    }
    if (placa.max_gb && total > placa.max_gb) {
      r.estado = 'depende';
      r.notas.push(`Son ${total} GB y la ficha de la placa dice ${placa.max_gb} GB como máximo. Con BIOS nuevas muchas placas admiten más: confírmalo en la web del fabricante.`);
    }
    if (kit.modulos === 1 && (placa.ranuras || 2) >= 2) {
      r.notas.push('Con un solo módulo la memoria trabaja en un canal y pierdes la mitad del ancho de banda: mejor dos módulos iguales.');
    }
    if (kit.modulos === 2 && placa.ranuras === 4) {
      r.notas.push('Con dos módulos en una placa de cuatro ranuras, ponlos donde diga el manual (casi siempre en la 2.ª y la 4.ª: A2 y B2).');
    }
    return r;
  }

  function ramConCpu(R, kit, cpu) {
    const tipos = tiposCpu(R, cpu);
    if (tipos.length && tipos.indexOf(kit.tipo) < 0) {
      return {estado: 'no', texto: `No: el procesador solo admite ${tipos.join(' y ')}.`};
    }
    return {estado: 'si', texto: ''};
  }

  // ¿Deja la placa subir la memoria con este procesador? (true, false o null si no se sabe)
  function ramOcDe(ch, cpu) {
    if (!ch) return null;
    if (cpu && ch.ram_oc_familia && cpu.familia in ch.ram_oc_familia) return ch.ram_oc_familia[cpu.familia];
    return de(ch, 'ram_oc');
  }

  function nombrePerfil(kit, P) {
    if (P && P.marca === 'Intel') return kit && kit.perfil === 'EXPO' ? 'EXPO (si tu placa lo lee)' : 'XMP';  // las placas Intel leen XMP
    if (kit && kit.tipo === 'DDR4') return 'XMP';  // EXPO solo existe en DDR5
    if (kit && kit.perfil) return kit.perfil.replace('+', ' o ');
    return 'EXPO o XMP';
  }

  // Lo oficial, lo óptimo y a qué irá. piezas = {cpu, placa, ram} (cualquiera puede faltar).
  function velocidad(R, piezas) {
    const cpu = piezas.cpu || null;
    const placa = piezas.placa || null;
    const kit = piezas.ram || null;
    const F = cpu ? familia(R, cpu.familia) : null;
    let tipo = kit ? kit.tipo : placa && placa.ram ? placa.ram : null;
    if (!tipo && cpu) {
      const t = tiposCpu(R, cpu);
      if (t.length === 1) tipo = t[0];
    }
    const zocalo = cpu ? cpu.zocalo : placa ? placa.zocalo : null;
    const P = zocalo ? plataforma(R, zocalo) : null;
    const ch = placa ? reglasChipset(R, placa) : null;
    const r = {tipo: tipo, oficial: null, oficial4: null, fuentesOficial: [], optimo: null, ira: null, notas: []};
    if (!tipo) return r;
    // una memoria que no encaja no tiene velocidad: el veredicto ya dice por qué
    if (kit && placa && placa.ram && kit.tipo !== placa.ram) {
      r.notas.push(nota('mal', `Esta memoria no vale para esta placa: es ${kit.tipo} y la placa usa ${placa.ram}.`, []));
      return r;
    }
    if (kit && cpu && tiposCpu(R, cpu).length && tiposCpu(R, cpu).indexOf(kit.tipo) < 0) {
      r.notas.push(nota('mal', `Esta memoria no vale para este procesador: admite ${tiposCpu(R, cpu).join(' y ')}.`, []));
      return r;
    }

    const fr = F && F.ram ? F.ram[tipo] : null;
    if (fr) {
      // los «T» (de bajo consumo) van como su modelo normal: i5-13500T como i5-13500
      const propio = (fr.por_modelo && cpu && (fr.por_modelo[cpu.id] || fr.por_modelo[cpu.id.replace(/t$/, '')]))
        || (fr.por_gama && cpu && fr.por_gama[gama(cpu)]) || null;
      r.oficial = propio || fr.oficial || null;
      r.oficial4 = fr.oficial_4 || null;
      r.fuentesOficial = fr.fuentes || [];
    }
    const notaFr = fr && fr.nota && cpu && (!fr.nota_desde || (r.oficial && r.oficial >= fr.nota_desde)) ? fr.nota : '';
    // lo que Intel da en placas de cuatro ranuras (si la placa tiene dos, no aplica)
    const nota4 = fr && fr.nota_4ranuras && cpu && (!placa || !placa.ranuras || placa.ranuras >= 4)
      ? nota('info', fr.nota_4ranuras, fr.fuentes_4ranuras || []) : null;
    r.optimo = (F && F.optimo && F.optimo[tipo]) || (P && P.optimo && P.optimo[tipo]) || null;
    const ramOc = ramOcDe(ch, cpu);
    // «con el chipset B460» o, si depende del procesador, «con este procesador en una placa B560»
    const enPlaca = ch && cpu && ch.ram_oc_familia && cpu.familia in ch.ram_oc_familia
      ? `con este procesador en una placa ${placa.chipset}` : placa ? `con el chipset ${placa.chipset}` : '';
    const fuentesCh = ch ? ch.fuentes || [] : [];

    if (!kit) {
      if (!cpu) r.notas.push(nota('info', 'Lo oficial depende del procesador: elígelo arriba y te digo la cifra exacta.', []));
      if (r.oficial) {
        r.notas.push(nota('info', `Lo oficial de este procesador: ${ddr(tipo, r.oficial)} con dos módulos${r.oficial4 ? ' y ' + ddr(tipo, r.oficial4) + ' con cuatro' : ''}.${notaFr ? ' ' + notaFr : ''}`, r.fuentesOficial));
        if (nota4) r.notas.push(nota4);
      }
      if (ramOc === false && r.oficial) {
        r.notas.push(nota('aviso', `${mayuscula(enPlaca)}, la memoria no pasa de lo oficial del procesador: memoria más rápida que ${ddr(tipo, r.oficial)} no sirve de nada aquí.`, fuentesCh));
      } else if (ramOc === false) {
        r.notas.push(nota('aviso', `${mayuscula(enPlaca)}, la memoria no pasa de lo oficial del procesador que pongas.`, fuentesCh));
      } else if (r.optimo) {
        r.notas.push(nota('ok', `Lo que mejor rinde: ${ddr(tipo, r.optimo.velocidad)}${r.optimo.cl ? ' CL' + r.optimo.cl : ''}, en dos módulos iguales.${r.optimo.nota ? ' ' + r.optimo.nota : ''}`, r.optimo.fuentes));
      }
      return r;
    }

    // con memoria elegida
    const S = kit.velocidad;
    const N = kit.modulos;
    const oficial = N > 2 && r.oficial4 ? r.oficial4 : r.oficial;
    const perfil = nombrePerfil(kit, P);
    const o = r.optimo;
    if (P && P.marca === 'Intel' && kit.perfil === 'EXPO') {
      r.notas.push(nota('aviso', 'Este kit solo trae perfil EXPO, que es el de AMD: muchas placas Intel no lo leen, y entonces hay que poner la velocidad y las latencias a mano en la BIOS.', []));
    }
    if (oficial && ramOc === false && S > oficial) {
      r.ira = oficial;
      r.notas.push(nota('mal', `Irá a ${ddr(tipo, oficial)}, no a ${S}: ${enPlaca}, la memoria no puede pasar de lo oficial del procesador. Pagar por más velocidad aquí no sirve.`, fuentesCh.concat(r.fuentesOficial)));
    } else if (oficial && S > oficial) {
      r.ira = S;
      // con cuatro módulos o por encima de lo que rinde bien, que arranque no está tan claro
      const arriesgado = N > 2 || (o && o.techo && S > o.techo);
      r.notas.push(nota('aviso', `Puede ir a ${ddr(tipo, S)} activando el perfil ${perfil} en la BIOS, pero eso ya es overclock de memoria: lo oficial del procesador es ${ddr(tipo, oficial)}${N > 2 ? ' con cuatro módulos' : ''}. ${arriesgado ? 'Puede que no arranque a esa velocidad: depende de la placa y de tu procesador. Si da fallos, bájala.' : 'Casi siempre va; si da fallos, bájala un punto.'}`, r.fuentesOficial));
    } else if (oficial) {
      r.ira = S;
      r.notas.push(nota('ok', `Irá a ${ddr(tipo, S)}: está dentro de lo oficial del procesador (${ddr(tipo, oficial)}). ${kit.perfil ? `Activa el perfil ${perfil} en la BIOS: sin él suele arrancar más despacio.` : `Si arranca más despacio, activa en la BIOS el perfil ${perfil} (la ficha no dice cuál trae).`}`, r.fuentesOficial));
    } else if (cpu) {
      r.notas.push(nota('info', 'No tengo la velocidad oficial de este procesador: mira su ficha en la web del fabricante.', []));
    } else {
      r.notas.push(nota('info', 'Elige también el procesador y te digo a qué velocidad irá: lo oficial depende de él.', []));
      if (ramOc === false) r.notas.push(nota('aviso', `Ojo: ${enPlaca}, la memoria no pasa de lo oficial del procesador que pongas.`, fuentesCh));
    }
    if (N > 2 && r.oficial4 && r.oficial && r.oficial4 < r.oficial) {
      r.notas.push(nota('aviso', `Con cuatro módulos lo oficial baja a ${ddr(tipo, r.oficial4)} (con dos es ${ddr(tipo, r.oficial)}). Si buscas velocidad, mejor dos módulos más grandes.`, r.fuentesOficial));
    } else if (N > 2) {
      r.notas.push(nota('aviso', 'Con cuatro módulos el controlador va más cargado y casi siempre hay que bajar algo la velocidad. Si buscas velocidad, mejor dos módulos más grandes.', []));
    }
    if (notaFr) r.notas.push(nota('info', notaFr, r.fuentesOficial));
    if (nota4 && oficial) r.notas.push(nota4);
    if (o && o.velocidad && ramOc !== false) {
      if (o.techo && S > o.techo) {
        r.notas.push(nota('info', o.texto_techo || `Por encima de ${ddr(tipo, o.techo)} se gana poco o nada en esta plataforma: no pagues de más por memoria más rápida.`, o.fuentes_techo || o.fuentes));
      } else if (S < o.velocidad) {
        r.notas.push(nota('info', `Va bien, aunque lo que mejor rinde aquí es ${ddr(tipo, o.velocidad)}${o.cl ? ' CL' + o.cl : ''}.`, o.fuentes));
      } else if (S === o.velocidad && (!o.cl || (kit.cl && kit.cl <= o.cl))) {
        r.notas.push(nota('ok', 'Es justo la memoria que mejor rinde en esta plataforma.', o.fuentes));
      }
    }
    return r;
  }

  // La memoria que recomendaría para esta placa y/o procesador, y los kits de la lista que la cumplen.
  function ramRecomendada(R, piezas, kits, max) {
    const placa = piezas.placa || null;
    const cpu = piezas.cpu || null;
    const v = velocidad(R, {placa: placa, cpu: cpu});
    const nada = {velocidad: v, kits: [], total: 0};
    if (!v.tipo) return nada;
    const ch = placa ? reglasChipset(R, placa) : null;
    // lo óptimo si hay dato y la placa deja subir la memoria; si no, lo oficial del procesador
    let objetivo = v.optimo && v.optimo.velocidad ? v.optimo.velocidad : v.oficial;
    let clMax = v.optimo && v.optimo.velocidad && v.optimo.cl ? v.optimo.cl + 2 : 99;
    if (ramOcDe(ch, cpu) === false) {
      objetivo = v.oficial;
      clMax = 99;
    }
    if (!objetivo) return nada;
    const tope = placa && placa.max_gb ? placa.max_gb : Infinity;
    // 2666 y 2667 son lo mismo (AMD pone 2667; las memorias, 2666)
    const lista = kits.filter((k) => k.tipo === v.tipo && Math.abs(k.velocidad - objetivo) <= 1 && k.modulos === 2
      && (k.cl || 99) <= clMax && k.modulos * k.gb <= tope);
    lista.sort((a, b) => (a.cl || 99) - (b.cl || 99) || a.gb - b.gb || (a._n || a.nombre).localeCompare(b._n || b.nombre));
    return {velocidad: v, objetivo: objetivo, kits: lista.slice(0, max || 12), total: lista.length};
  }

  // ------------------------------------------------------------ SSD M.2

  function genTexto(g) {
    return g ? `PCIe ${g}.0` : 'PCIe';
  }

  // Por qué no se enseñan los huecos M.2 de una placa.
  function textoSinHuecos(placa) {
    if (placa.m2_nota === 'sin_datos') return 'La ficha de esta placa no trae sus huecos M.2: míralos en el manual o en la web del fabricante.';
    if (placa.m2_nota === 'imposible') return 'La ficha de esta placa trae huecos M.2 más rápidos de lo que permite su chipset, así que no me fío: míralos en el manual o en la web del fabricante.';
    return 'La ficha de esta placa trae los huecos M.2 con datos de relleno, así que no me fío: míralos en el manual o en la web del fabricante.';
  }

  function listaO(cosas) {
    return cosas.length > 1 ? cosas.slice(0, -1).join(', ') + ' o ' + cosas[cosas.length - 1] : cosas.join('');
  }

  // Ancho de banda de un enlace PCIe, en «PCIe 3.0 x1» (PCIe 4.0 x4 = 8, igual que PCIe 5.0 x2).
  function banda(gen, carriles) {
    return gen ? Math.pow(2, gen - 3) * carriles : 0;
  }

  // Modos en que puede ir un SSD. Los PCIe 5.0 x2 (Samsung 990 EVO y 990 EVO Plus) también van como PCIe 4.0 x4.
  function modosSsd(ssd) {
    const x = ssd.carriles || 4;
    const modos = [[ssd.gen, x]];
    if (ssd.gen === 5 && x === 2) modos.push([4, 4]);
    return modos;
  }

  function enlaceTexto(gen, carriles) {
    return genTexto(gen) + (carriles ? ' x' + carriles : '');
  }

  function ssdEnPlaca(R, ssd, placa, cpu) {
    const r = {estado: 'nose', texto: '', huecos: [], notas: [], mejor: null};
    if (!placa.m2) {
      r.texto = textoSinHuecos(placa);
      return r;
    }
    const F = cpu ? familia(R, cpu.familia) : null;
    const ch = reglasChipset(R, placa);
    const deChipset = ch && ch.pcie_chipset ? ch.pcie_chipset : 0;
    // lo que da la CPU, recortado por la placa (p. ej. un Ryzen 5000 en una A520 va a PCIe 3.0)
    const deCpu = F && F.pcie ? Math.min(F.pcie, ch && ch.pcie_cpu_max ? ch.pcie_cpu_max : F.pcie) : 0;
    const techo = deCpu ? Math.max(deCpu, deChipset) : 0;
    // con algunos procesadores, el M.2 que va a la CPU se apaga (p. ej. 10.ª gen en placa Intel 500)
    const apagado = cpu && ch && (ch.m2_cpu_apagado || []).indexOf(cpu.familia) >= 0;
    // si el chipset da más que la CPU, no sé qué hueco es de cuál: el de la CPU irá más lento
    const dudaCpu = deCpu && deChipset > deCpu;
    const ancho = (l) => String(l).slice(0, 2);
    placa.m2.forEach((h, i) => {
      const longs = h[0] ? String(h[0]).split(',') : [];
      const e = {n: i + 1, longs: longs, gen: h[1] || 0, carriles: h[2] || 0, modo: h[3] || '?', cabe: true, dudas: [], motivo: '', real: 0};
      if (apagado && deChipset && e.gen > deChipset) {
        e.cabe = false;
        e.motivo = 'es el que va a la CPU y con este procesador no funciona';
      } else if (longs.length && longs.indexOf(ssd.largo) < 0) {
        // si solo dice largos mayores, casi seguro que también lleva este (el tornillo va por posiciones)
        if (longs.some((l) => ancho(l) === ancho(ssd.largo) && Number(l) > Number(ssd.largo))) {
          e.dudas.push('tamaño');
        } else {
          e.cabe = false;
          e.motivo = `es para ${listaO(longs)}, y el SSD es ${ssd.largo}`;
        }
      } else if (ssd.protocolo === 'nvme' && e.modo === 's') {
        e.cabe = false;
        e.motivo = 'solo admite SATA (un SSD NVMe no funciona ahí)';
      }
      if (e.cabe) {
        if (!longs.length) e.dudas.push('tamaño');
        if (ssd.protocolo === 'sata' && e.modo !== 'ps' && e.modo !== 's') e.dudas.push('sata');
        if (ssd.protocolo === 'nvme') {
          let g = e.gen && ssd.gen ? Math.min(e.gen, ssd.gen) : e.gen || ssd.gen || 0;
          if (!e.gen) {
            e.dudas.push('generación');
            if (ch && ch.m2_max && g > ch.m2_max) g = ch.m2_max;
          }
          if (techo && g > techo) g = techo;
          if (dudaCpu && g > deCpu) e.dudas.push('cpu');
          // el mejor enlace entre los modos del SSD y lo que da el hueco
          const tope = e.gen ? g : (g || ssd.gen);
          let mejor = [g, Math.min(ssd.carriles || 4, e.carriles || 4)];
          if (ssd.gen) {
            for (const [mg, mx] of modosSsd(ssd)) {
              const cand = [Math.min(mg, tope || mg), Math.min(mx, e.carriles || 4)];
              if (banda(cand[0], cand[1]) > banda(mejor[0], mejor[1])) mejor = cand;
            }
          }
          e.real = mejor[0];
          e.enlace = mejor;
        }
      }
      r.huecos.push(e);
    });
    const valen = r.huecos.filter((e) => e.cabe);
    if (!valen.length) {
      r.estado = 'no';
      r.texto = 'No le veo hueco: ' + r.huecos.map((e) => `el M.2 ${e.n} ${e.motivo}`).join('; ') + '.';
      return r;
    }
    valen.sort((a, b) => (a.dudas.length - b.dudas.length) || (b.real - a.real) || (b.carriles - a.carriles) || (a.n - b.n));
    const m = valen[0];
    r.mejor = m.n;
    const dudas = {
      'tamaño': `la ficha no dice si admite el tamaño ${ssd.largo}`,
      sata: 'la ficha no dice que admita SATA (muchos solo son NVMe)',
      'generación': 'la ficha no dice a qué velocidad va',
      cpu: `si es el que va a la CPU, con este procesador irá a ${genTexto(deCpu)}`,
    };
    const porQue = m.dudas.map((d) => dudas[d]).join(', y ');
    if (ssd.protocolo === 'sata') {
      r.estado = m.dudas.length ? 'depende' : 'si';
      r.texto = m.dudas.length
        ? `Puede que sí (M.2 ${m.n}), pero ${porQue}. Míralo en el manual antes de comprar.`
        : `Sí: en el M.2 ${m.n}, que admite SATA. Irá a velocidad SATA (unos 550 MB/s), como cualquier SSD SATA.`;
      return r;
    }
    const maximo = ssd.gen ? Math.max.apply(null, modosSsd(ssd).map(([g, x]) => banda(g, x))) : 0;
    const enlace = m.enlace || [m.real, m.carriles];
    const lleno = !ssd.gen || banda(enlace[0], enlace[1]) >= maximo;
    if (m.dudas.length) {
      r.estado = 'depende';
      r.texto = `Seguramente sí (M.2 ${m.n}${m.real && m.dudas.indexOf('generación') < 0 ? ', a ' + genTexto(m.real) : ''}), pero ${porQue}. Míralo en el manual.`;
    } else if (!ssd.gen) {
      r.estado = 'si';
      r.texto = `Sí: en el M.2 ${m.n}, que va a ${enlaceTexto(m.real, m.carriles)}. La ficha del SSD no dice su velocidad, así que no sé si lo aprovecha entero.`;
    } else if (lleno) {
      r.estado = 'si';
      r.texto = `Sí: en el M.2 ${m.n} va a toda su velocidad (${enlaceTexto(enlace[0], enlace[1])}).`;
    } else {
      r.estado = 'depende';
      const motivo = modosSsd(ssd).length > 1
        ? `irá a ${enlaceTexto(enlace[0], enlace[1])} y el SSD da para el doble (${enlaceTexto(ssd.gen, ssd.carriles)} o ${enlaceTexto(4, 4)})`
        : m.real < ssd.gen
          ? `irá a ${genTexto(m.real)} y el SSD es ${genTexto(ssd.gen)}`
          : `el hueco es x${enlace[1]} y el SSD x${ssd.carriles}`;
      r.texto = `Funciona, pero no a tope: en el mejor hueco (M.2 ${m.n}) ${motivo}. Pierdes velocidad máxima; en el día a día casi no se nota.`;
    }
    const S = R.ssd || {};
    if (ssd.protocolo === 'nvme' && modosSsd(ssd).length > 1 && S.doble_modo) {
      r.notas.push(nota('info', S.doble_modo.texto, S.doble_modo.fuentes));
    }
    if (ssd.disipador && S.disipador) {
      r.notas.push(nota('aviso', S.disipador.texto, S.disipador.fuentes));
    } else if (ssd.protocolo === 'nvme' && ssd.gen >= 5 && (ssd.carriles || 4) >= 4 && S.gen5_calor) {
      r.notas.push(nota('info', S.gen5_calor.texto, S.gen5_calor.fuentes));
    }
    if (!apagado && deCpu && r.huecos.some((e) => e.gen > deCpu && e.gen > deChipset)) {
      const motivo = deCpu < F.pcie ? `con el chipset ${placa.chipset}, el procesador va a ${genTexto(deCpu)}` : `el procesador es ${genTexto(F.pcie)}`;
      r.notas.push(nota('aviso', `Ojo: ${motivo}, así que el M.2 conectado a la CPU funciona a ${genTexto(deCpu)} aunque la placa lo anuncie más rápido.`, F.fuentes_pcie));
    }
    return r;
  }

  // Notas de la placa sobre sus M.2 que no dependen del SSD (y sí del procesador).
  function notasM2(R, placa, cpu) {
    const notas = [];
    const P = plataforma(R, placa.zocalo);
    const ch = reglasChipset(R, placa);
    if (placa.m2 && P && P.aviso_m2_gen5 && placa.m2.some((h) => h[1] >= 5)) {
      notas.push(nota('aviso', P.aviso_m2_gen5.texto, P.aviso_m2_gen5.fuentes));
    }
    if (cpu && ch && ch.notas_m2 && ch.notas_m2[cpu.familia]) {
      notas.push(nota('aviso', ch.notas_m2[cpu.familia], ch.fuentes));
    }
    if (placa.notas_m2 && placa.notas_m2.length) {
      for (const t of placa.notas_m2) notas.push(nota('aviso', t, placa.fuente ? [placa.fuente] : []));
    } else if (placa.m2 && placa.m2.length) {
      notas.push(nota('info', 'Algunos M.2 comparten carriles con puertos SATA o ranuras PCIe: al usarlos, puede apagarse algo. El manual de la placa lo dice en la página de los M.2.', []));
    }
    return notas;
  }

  // ------------------------------------------------------------ gráfica integrada

  function grafica(R, cpu, placa, gpu) {
    const F = familia(R, cpu.familia);
    if (gpu) {
      // con tarjeta, la imagen sale de ella: la integrada solo sirve de repuesto
      if (cpu.igpu === false) return {estado: 'ok', texto: `No tiene gráfica integrada${F && F.igpu_nota ? ' (' + F.igpu_nota + ')' : ''}, pero no la necesitas: la imagen sale de la tarjeta gráfica. Conecta el monitor a la tarjeta.`};
      if (cpu.igpu === true) return {estado: 'ok', texto: `Sí: ${(F && F.igpu_modelo) || cpu.igpu_modelo || 'gráfica integrada'}. Con la tarjeta gráfica, conecta el monitor a la tarjeta, no a la placa. La integrada te sirve para tener imagen si la tarjeta falla.`};
    }
    if (cpu.igpu === true) {
      const modelo = (F && F.igpu_modelo) || cpu.igpu_modelo || 'gráfica integrada';
      if (placa && Array.isArray(placa.video) && !placa.video.length) {
        // BuildCores confirma que la placa no tiene salidas para la gráfica integrada
        return {estado: 'depende', texto: `Sí: ${modelo}. Pero esta placa no tiene salidas de vídeo para ella, así que con esta placa necesitas tarjeta gráfica.`};
      }
      let t = `Sí: ${modelo}. Puedes tener imagen sin tarjeta gráfica`;
      if (placa) {
        t += placa.video && placa.video.length
          ? `, conectando el monitor a la placa (${placa.video.join(', ')}).`
          : ' si la placa tiene salidas de vídeo (HDMI o DisplayPort detrás). Su ficha no dice ninguna: algunas placas no traen, así que míralo antes de comprar sin tarjeta.';
      } else {
        t += ' si la placa tiene salidas de vídeo (HDMI o DisplayPort detrás).';
      }
      return {estado: 'si', texto: t};
    }
    if (cpu.igpu === false) {
      return {estado: 'no', texto: `No tiene gráfica integrada${F && F.igpu_nota ? ' (' + F.igpu_nota + ')' : ''}: sin tarjeta gráfica no hay imagen, y las salidas de vídeo de la placa no funcionan con este procesador.`};
    }
    return {estado: 'nose', texto: 'No sé seguro si tiene gráfica integrada: mira su ficha en la web del fabricante.'};
  }

  // ------------------------------------------------------------ tarjeta gráfica

  // el peor de varios estados (para juntar comprobaciones)
  function peor(estados) {
    const orden = ['si', 'bios', 'depende', 'nose', 'no'];
    return estados.reduce((a, b) => (orden.indexOf(b) > orden.indexOf(a) ? b : a), 'si');
  }

  function reglasGraficas(R) {
    return R.graficas || {};
  }

  function chipGrafica(R, gpu) {
    const c = reglasGraficas(R).chips;
    const ch = (gpu && gpu.chip && c && c[gpu.chip]) || null;
    // algunas versiones de más memoria gastan más (la RTX 2060 de 12 GB)
    const v = ch && ch.por_memoria && gpu.gb && ch.por_memoria[gpu.gb];
    return v ? Object.assign({}, ch, v) : ch;
  }

  // Interfaz de la gráfica: la del chip (ficha del fabricante) o, si no hay regla, la de su ficha si dice versión y carriles.
  function pcieGrafica(R, gpu) {
    const ch = chipGrafica(R, gpu);
    if (ch && ch.pcie) return {gen: ch.pcie[0], carriles: ch.pcie[1], fuentes: ch.fuentes || [], deChip: true};
    if (gpu.pcie) return {gen: gpu.pcie[0], carriles: gpu.pcie[1], fuentes: [], deChip: false};
    return null;
  }

  // Lo que da el procesador a la gráfica, o null si no hay regla.
  function pcieCpuGrafica(R, cpu) {
    const F = cpu ? familia(R, cpu.familia) : null;
    const g = F && F.grafica;
    if (!g) return null;
    const m = g.por_modelo && (g.por_modelo[cpu.id] || g.por_modelo[cpu.id.replace(/t$/, '')]);
    return {gen: m ? m[0] : g.gen, carriles: m ? m[1] : g.carriles, fuentes: g.fuentes || []};
  }

  // Generación de la ranura de la gráfica según el chipset: {min, max} (distintos si la elige cada placa), o null.
  function pcieRanura(R, placa) {
    const ch = placa ? reglasChipset(R, placa) : null;
    const g = ch ? ch.grafica : null;
    if (!g) return null;
    const f = ch.fuentes_grafica || ch.fuentes || [];
    return Array.isArray(g) ? {min: g[0], max: g[1], fuentes: f} : {min: g, max: g, fuentes: f};
  }

  // El enlace PCIe con el que irá la gráfica: el menor de la gráfica, el procesador y la ranura.
  function enlaceGrafica(R, gpu, placa, cpu) {
    const g = pcieGrafica(R, gpu);
    if (!g) return null;
    const c = pcieCpuGrafica(R, cpu);
    const s = pcieRanura(R, placa);
    const genCpu = c ? c.gen : 99;
    const genPlaca = s ? s.max : 99;
    const gen = Math.min(g.gen, genCpu, genPlaca);
    // si cada placa del chipset pone una ranura distinta, lo seguro es la más lenta
    const seguro = s ? Math.min(gen, s.min) : gen;
    return {
      gen: seguro,
      carriles: Math.min(g.carriles, c ? c.carriles : 99),
      max: [g.gen, g.carriles],
      genDuda: seguro < gen ? gen : 0,
      porCpu: (genCpu === gen && genCpu < g.gen) || (c ? c.carriles < g.carriles : false),
      porPlaca: (genPlaca === gen && genPlaca < g.gen) || seguro < gen,
      fuentes: g.fuentes.concat(c ? c.fuentes : [], s ? s.fuentes : []),
      deChip: g.deChip,
    };
  }

  // Nota de rendimiento cuando la gráfica no va a toda su velocidad (las pruebas publicadas, en reglas.json).
  // Algunos tramos son solo para gráficas de poca memoria (gb_max): son las que más pierden.
  function notaRendimiento(R, e, gpu) {
    const tramos = reglasGraficas(R).rendimiento || [];
    const b = banda(e.gen, e.carriles);
    const gb = gpu && gpu.gb;
    const t = tramos.find((x) => b <= x.hasta && banda(e.max[0], e.max[1]) > b && (!x.gb_max || (gb && gb <= x.gb_max)));
    return t ? nota(t.tipo || 'info', t.texto, t.fuentes) : null;
  }

  // quién deja la gráfica más lenta, y si el verbo va en plural («el procesador y la placa la dejan»)
  function quienLimita(e, placa) {
    if (e.porCpu && e.porPlaca) return {quien: `el procesador y la placa${placa && placa.chipset ? ' (' + placa.chipset + ')' : ''}`, plural: true};
    if (e.porPlaca) return {quien: `la placa${placa && placa.chipset ? ' (chipset ' + placa.chipset + ')' : ''}`, plural: false};
    return {quien: 'el procesador', plural: false};
  }

  // «ryzen-5-8500g» -> «Ryzen 5 8500G» (los modelos sueltos de las reglas van por su id)
  function nombreModelo(id) {
    return id.split('-').map((w) => (/^\d/.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
  }

  // Sin procesador elegido: los que admite la placa con los que la gráfica iría más lenta que sin ellos.
  // [{quien: «los Ryzen 4000G…» o «el Athlon 3000G», enlace}], de lo más nuevo a lo más viejo.
  function cpusQueLimitan(R, gpu, placa) {
    const ch = reglasChipset(R, placa);
    const soporte = (ch && ch.soporte) || {};
    const base = enlaceGrafica(R, gpu, placa, null);
    if (!base) return [];
    const b0 = banda(base.gen, base.carriles);
    const salida = [];
    for (const k of familiasEnOrden(R).slice().reverse()) {
      const F = familia(R, k);
      if (!soporte[k] || soporte[k] === 'no' || !F || !F.grafica) continue;
      const general = enlaceGrafica(R, gpu, placa, {familia: k, id: ''});
      if (general && banda(general.gen, general.carriles) < b0) salida.push({quien: 'los ' + F.nombre, enlace: general});
      // los modelos que van distinto del resto de su familia (los Athlon con x4, el 8500G…)
      for (const id of Object.keys(F.grafica.por_modelo || {})) {
        const e = enlaceGrafica(R, gpu, placa, {familia: k, id: id});
        if (e && banda(e.gen, e.carriles) < b0 && !(general && e.gen === general.gen && e.carriles === general.carriles)) {
          salida.push({quien: 'el ' + nombreModelo(id), enlace: e});
        }
      }
    }
    return salida;
  }

  // La gráfica en la placa (o, sin placa, con el procesador): si entra y a qué velocidad irá.
  function graficaEnPlacaSinFicha(R, gpu, placa, cpu) {
    const r = {estado: 'si', texto: '', notas: [], fuentes: []};
    const G = reglasGraficas(R);
    if (placa && placa.x16 === 0) {
      r.estado = 'depende';
      r.texto = 'La ficha de esta placa no trae ninguna ranura PCIe x16: míralo en el manual antes de comprar la gráfica.';
      return r;
    }
    const e = enlaceGrafica(R, gpu, placa, cpu);
    r.fuentes = ((G.compatible || {}).fuentes || []).slice();
    if (!e) {
      r.texto = placa
        ? 'Sí: entra en la ranura PCIe x16 de la placa (PCIe funciona entre versiones). No tengo comprobada la interfaz de este chip, así que no sé si irá a toda su velocidad.'
        : 'Sí: va con cualquier procesador (PCIe funciona entre versiones). No tengo comprobada la interfaz de este chip, así que no sé si irá a toda su velocidad.';
    } else {
      r.fuentes = r.fuentes.concat(e.fuentes);
      const max = enlaceTexto(e.max[0], e.max[1]);
      const real = enlaceTexto(e.gen, e.carriles);
      const pleno = banda(e.gen, e.carriles) >= banda(e.max[0], e.max[1]);
      // con placa y sin procesador: los procesadores de esa placa que la dejarían más lenta
      const limitan = placa && !cpu ? cpusQueLimitan(R, gpu, placa) : [];
      if (pleno) {
        if (!placa) r.texto = `Sí: con este procesador puede ir a toda su velocidad (${max}). Falta la placa: elígela y miro su ranura.`;
        else if (limitan.length) r.texto = `Sí: entra en la ranura x16 y va a toda su velocidad (${max}), salvo con los procesadores de la nota.`;
        else r.texto = `Sí: entra en la ranura x16 y va a toda su velocidad (${max}).`;
      } else {
        const q = quienLimita(e, placa);
        const duda = e.genDuda ? ` (o a ${enlaceTexto(e.genDuda, e.carriles)} si la placa tiene la ranura PCIe ${e.genDuda}.0: míralo en su ficha)` : '';
        const nr = notaRendimiento(R, e, gpu);
        // con poco ancho de banda se pierde rendimiento de verdad: no es un «sí» sin más
        r.estado = nr && nr.tipo === 'aviso' ? 'depende' : 'si';
        r.texto = `${placa ? 'Sí, entra, pero no va' : 'Va, pero no'} a toda su velocidad: la gráfica es ${max} y ${q.quien} la ${q.plural ? 'dejan' : 'deja'} en ${real}${duda}.`;
        if (nr) {
          r.notas.push(nr.texto);
          r.fuentes = r.fuentes.concat(nr.fuentes);
        }
      }
      if (limitan.length) {
        // los que dejan la gráfica igual van juntos: «con los A o el B, a PCIe 3.0 x8»
        const porEnlace = [];
        for (const x of limitan) {
          const t = enlaceTexto(x.enlace.gen, x.enlace.carriles);
          const g = porEnlace.find((y) => y.t === t) || (porEnlace[porEnlace.length] = {t: t, quienes: []});
          g.quienes.push(x.quien);
        }
        const partes = porEnlace.map((g) => `con ${listaO(g.quienes)}, a ${g.t}`);
        r.notas.push(`Depende del procesador: ${partes.join('; ')}. Elige el procesador y te digo cómo va.`);
        for (const x of limitan) r.fuentes = r.fuentes.concat(x.enlace.fuentes);
      }
    }
    const rb = notaRebar(R, gpu, cpu);
    if (rb) {
      if (rb.tipo === 'mal' || rb.tipo === 'aviso') r.estado = peor([r.estado, 'depende']);
      r.notas.push(rb.texto);
      r.fuentes = r.fuentes.concat(rb.fuentes);
    }
    if (placa && placa.notas_grafica && placa.notas_grafica.length) {
      r.notas = r.notas.concat(placa.notas_grafica);
      if (placa.fuente && corregido(placa, 'notas_grafica')) r.fuentes.push(placa.fuente);
    }
    return r;
  }

  // Las Intel Arc necesitan Resizable BAR: nota según el procesador (o lo que pide, si no hay procesador).
  function notaRebar(R, gpu, cpu) {
    const ch = chipGrafica(R, gpu);
    const rb = reglasGraficas(R).rebar;
    if (!ch || !ch.rebar || !rb) return null;
    if (!cpu) return nota('aviso', rb.texto_pide, rb.fuentes);
    if ((rb.familias || []).indexOf(cpu.familia) >= 0) return nota('info', rb.texto_si, rb.fuentes);
    if (!familia(R, cpu.familia)) return nota('aviso', rb.texto_pide, rb.fuentes);
    return nota('aviso', rb.texto_no, rb.fuentes);
  }

  // ------------------------------------------------------------ gráfica y fuente

  // Consumo de la gráfica: el de referencia del fabricante del chip o, si no hay regla, el de su ficha.
  function consumoGrafica(R, gpu) {
    const ch = chipGrafica(R, gpu);
    if (ch && ch.consumo) return {w: ch.consumo, deChip: true, fuentes: ch.fuentes || []};
    if (gpu.tdp) return {w: gpu.tdp, deChip: false, fuentes: []};
    return null;
  }

  // Lo que puede gastar el procesador en pico (estimación con las reglas de AMD e Intel), o null.
  function consumoCpu(R, cpu) {
    if (!cpu || !cpu.tdp) return null;
    const C = R.cpu_consumo || {};
    const coma = (x) => String(x).replace('.', ',');
    if (/^AM/.test(cpu.zocalo || '') && C.amd_factor) {
      return {w: Math.round(cpu.tdp * C.amd_factor), base: `${cpu.tdp} W de TDP × ${coma(C.amd_factor)}, el límite que da AMD`, fuentes: C.fuentes_amd || []};
    }
    // «Intel Core i5-13600KF» -> 13600 y K; «Intel Core Ultra 5 250K Plus» -> 250 y K
    const m = /(\d{3,5})([A-Z]*)(?:\s+Plus)?\s*$/i.exec(cpu.nombre || '');
    const numero = m ? m[1] : '';
    const sufijo = m ? ({KF: 'K', K: 'K', KS: 'KS', T: 'T'}[m[2].toUpperCase()] || '') : '';
    const g = gama(cpu);
    const regla = (C.intel || []).find((x) => x.familias.indexOf(cpu.familia) >= 0 && x.gamas.indexOf(g) >= 0
      && x.sufijos.indexOf(sufijo) >= 0 && (!x.modelos || x.modelos.indexOf(numero) >= 0));
    if (regla) {
      return {w: regla.pl2, base: regla.estimacion ? 'el consumo máximo, o PL2, que da Intel para sus hermanos' : 'su consumo máximo, el PL2 que da Intel',
        fuentes: regla.fuentes || []};
    }
    const f = (C.intel_factor || []).find((x) => x.familias.indexOf(cpu.familia) >= 0);
    if (f) {
      return {w: Math.round(cpu.tdp * f.factor), fuentes: f.fuentes || [],
        base: `${cpu.tdp} W de TDP × ${coma(f.factor)}, el límite por defecto de Intel${f.estimacion ? ' en 8.ª y 9.ª generación' : ''}`};
    }
    return null;
  }

  // Conectores que pide la gráfica: [6 pines, 8 pines, 16 pines] y de dónde sale el dato.
  function conectoresGrafica(R, gpu) {
    if (gpu.conectores) return {n: gpu.conectores, de: 'ficha'};
    const c = consumoGrafica(R, gpu);
    if (c && c.w <= 75) return {n: [0, 0, 0], de: 'ranura'};
    const ch = chipGrafica(R, gpu);
    if (ch && ch.ref) return {n: ch.ref, de: 'referencia'};
    return null;
  }

  // «un conector de 8 pines y uno de 6 pines», «2 conectores de 8 pines»
  function textoConectores(n) {
    const partes = [];
    const pon = (cuantos, que) => {
      const primero = !partes.length;
      if (cuantos === 1) partes.push(primero ? `un conector de ${que}` : `uno de ${que}`);
      else partes.push(primero ? `${cuantos} conectores de ${que}` : `${cuantos} de ${que}`);
    };
    if (n[2]) pon(n[2], '16 pines (12VHPWR o 12V-2x6)');
    if (n[1]) pon(n[1], '8 pines');
    if (n[0]) pon(n[0], '6 pines');
    return listaY(partes);
  }

  function listaY(cosas) {
    return cosas.length > 1 ? cosas.slice(0, -1).join(', ') + ' y ' + cosas[cosas.length - 1] : cosas.join('');
  }

  function listaO(cosas) {
    return cosas.length > 1 ? cosas.slice(0, -1).join(', ') + ' o ' + cosas[cosas.length - 1] : cosas.join('');
  }

  function conMarca(R, gpu) {
    const ch = chipGrafica(R, gpu);
    return ch && ch.marca ? ch.marca : gpu.marca || 'el fabricante';
  }

  // ¿Se corrigió a mano ese dato de la pieza, con su ficha? (pc/correcciones.json)
  function corregido(p, campo) {
    return !!(p && p.corregidos && p.corregidos.indexOf(campo) >= 0);
  }

  // «2 conectores de 6+2 pines y uno de 16 pines» (los PCIe de una fuente: [6+2, 16 pines])
  function textoFuente(pcie) {
    const trozos = [];
    if (pcie[0]) trozos.push(`${pcie[0] === 1 ? 'un conector' : pcie[0] + ' conectores'} de 6+2 pines`);
    if (pcie[1]) {
      trozos.push(trozos.length ? `${pcie[1] === 1 ? 'uno' : pcie[1]} de 16 pines`
        : `${pcie[1] === 1 ? 'un conector' : pcie[1] + ' conectores'} de 16 pines y ninguno de 6+2`);
    }
    return listaY(trozos);
  }

  // ¿Llegan los conectores de la fuente ([6+2, 16 pines]) para los de la gráfica ([6, 8, 16 pines])?
  // Los de 16 pines van a los nativos de la fuente y, si no quedan, al adaptador de la gráfica (de «adaptador» × 8 pines).
  function encaja(n, pcie, adaptador) {
    let ocho = pcie[0];
    let dieciseis = pcie[1];
    const r = {falta: false, sinDato: false, adaptador: 0, nativo: 0};
    for (let i = 0; i < n[2]; i++) {
      if (dieciseis > 0) {
        dieciseis--;
        r.nativo++;
      } else if (adaptador) {
        if (ocho >= adaptador) {
          ocho -= adaptador;
          r.adaptador += adaptador;
        } else {
          r.falta = true;
        }
      } else {
        r.sinDato = true;
      }
    }
    if (ocho < n[0] + n[1]) r.falta = true;
    return r;
  }

  // Los conectores distintos que llevan las tarjetas de cada chip en la lista (las de marca), para no fiarse
  // solo de la de referencia: la página lo guarda en R._conectoresChip al cargar las gráficas.
  function conectoresPorChip(gpus) {
    const por = {};
    for (const g of gpus) {
      if (!g.chip || !g.conectores) continue;
      const l = por[g.chip] || (por[g.chip] = []);
      if (!l.some((c) => c[0] === g.conectores[0] && c[1] === g.conectores[1] && c[2] === g.conectores[2])) l.push(g.conectores);
    }
    return por;
  }

  // El procesador de la lista que menos gasta en pico: el suelo de la cuenta mientras no se elige uno
  // (la página lo guarda en R._picoMinimo al cargar los procesadores).
  function picoMinimo(R, cpus) {
    let min = null;
    for (const c of cpus) {
      const p = consumoCpu(R, c);
      if (p && (!min || p.w < min.w)) min = {w: p.w, nombre: c.nombre, fuentes: p.fuentes};
    }
    return min;
  }

  function sumaConectores(n) {
    return n[0] + n[1] + n[2];
  }

  function textoLleva(sujeto, n) {
    return sumaConectores(n) ? `${sujeto} lleva ${textoConectores(n)}` : `${sujeto} no lleva conector de corriente`;
  }

  function graficaConFuenteSinFicha(R, gpu, psu, cpu) {
    const r = {estado: 'si', texto: '', notas: [], fuentes: []};
    const ch = chipGrafica(R, gpu);
    const G = reglasGraficas(R);
    const c = consumoGrafica(R, gpu);
    const cpuW = cpu && cpu.tdp ? cpu.tdp : null;
    const pico = consumoCpu(R, cpu);
    const pide = ch && ch.psu ? ch.psu : null;
    const marca = conMarca(R, gpu);
    // lo que gasta el resto del equipo (placa, memoria, discos y ventiladores): estimación con fuentes
    const resto = G.resto || {min: 50, max: 100, fuentes: []};
    const minimo = !cpu && R._picoMinimo ? R._picoMinimo : null;
    // --- potencia
    let ePot = 'nose';
    let tPot = '';
    let segunMarca = '';  // «NVIDIA pide…»: el «Sí:» de delante depende de cómo acabe todo
    if (c && psu.vatios < c.w + (cpuW || 0)) {
      ePot = 'no';
      tPot = cpuW
        ? `No llega: la gráfica gasta hasta ${c.w} W y el procesador tiene ${cpuW} W de TDP. Ya suman ${c.w + cpuW} W sin contar el resto, y la fuente es de ${psu.vatios} W.`
        : `No llega: solo la gráfica gasta hasta ${c.w} W y la fuente es de ${psu.vatios} W.`;
      r.fuentes = r.fuentes.concat(c.fuentes);
    } else if (c && minimo && psu.vatios < c.w + minimo.w + resto.min && !(pide && psu.vatios >= pide)) {
      // sin procesador elegido: ni con el que menos gasta de la lista llega
      ePot = 'no';
      tPot = `No llega: la gráfica gasta hasta ${c.w} W, el procesador que menos gasta de la lista (${minimo.nombre}) llega a unos ${minimo.w} W y el resto del equipo, a ${resto.min} W como poco. Ya son ${c.w + minimo.w + resto.min} W, y la fuente es de ${psu.vatios} W.`;
      r.fuentes = r.fuentes.concat(c.fuentes, minimo.fuentes, resto.fuentes || []);
    } else if (pide && psu.vatios >= pide) {
      ePot = 'si';
      segunMarca = `${marca} pide una fuente de ${pide} W para esta gráfica y esta es de ${psu.vatios} W.`;
      r.fuentes = r.fuentes.concat(ch.fuentes_psu || ch.fuentes || []);
    } else if (pide) {
      ePot = 'depende';
      const justa = psu.vatios >= pide * 0.9;
      tPot = justa
        ? `Justa: ${marca} pide una fuente de ${pide} W para esta gráfica y esta es de ${psu.vatios} W.`
        : `Se queda corta según ${marca}: pide una fuente de ${pide} W para esta gráfica y esta es de ${psu.vatios} W.`;
      r.fuentes = r.fuentes.concat(ch.fuentes_psu || ch.fuentes || []);
      if (justa && G.margen) {
        r.notas.push(G.margen.texto);
        r.fuentes = r.fuentes.concat(G.margen.fuentes || []);
      }
    } else if (c) {
      ePot = 'depende';
      tPot = `No tengo la fuente que pide el fabricante para esta gráfica. Gasta hasta ${c.w} W${c.deChip ? '' : ' según su ficha'} y la fuente es de ${psu.vatios} W.`;
      r.fuentes = r.fuentes.concat(c.fuentes);
    } else {
      tPot = 'No sé cuánto gasta esta gráfica: mira en su ficha qué fuente pide el fabricante.';
    }
    // estimación del pico del equipo (etiquetada), si hay con qué
    if (c && ePot !== 'no') {
      const cpuPico = pico ? pico.w : null;
      if (cpuPico) {
        const bajo = c.w + cpuPico + resto.min;
        const alto = c.w + cpuPico + resto.max;
        const veredicto = psu.vatios < bajo ? ' La fuente se queda por debajo de ese pico: busca una más potente.'
          : psu.vatios < alto ? ' La fuente va justa: mejor una con algo de margen.' : '';
        r.notas.push(`Estimación: en pico, el equipo puede llegar a unos ${bajo}-${alto} W. La gráfica, ${c.w} W; el procesador, hasta ${cpuPico} W (${pico.base}), y el resto del equipo (placa, memoria, discos y ventiladores), entre ${resto.min} y ${resto.max} W.${veredicto}`);
        r.fuentes = r.fuentes.concat(pico.fuentes, resto.fuentes || []);
        if (psu.vatios < bajo) {
          if (ePot === 'depende' && pide) {
            // el fabricante y la cuenta coinciden: no llega
            ePot = 'no';
            tPot = `No llega: ${marca} pide una fuente de ${pide} W para esta gráfica y esta es de ${psu.vatios} W. Con este procesador, el equipo puede pasar de ${bajo} W en pico.`;
          } else if (ePot === 'si') {
            ePot = 'depende';
            tPot = `${marca} pide una fuente de ${pide} W para esta gráfica y esta es de ${psu.vatios} W, pero con este procesador puede quedarse corta.`;
            segunMarca = '';
          }
        } else if (ePot === 'depende' && pide && psu.vatios >= alto && G.margen && r.notas.indexOf(G.margen.texto) < 0) {
          r.notas.push(G.margen.texto);
          r.fuentes = r.fuentes.concat(G.margen.fuentes || []);
        }
      } else if (!cpu) {
        r.notas.push('Elige el procesador y afino la cuenta: lo que gasta cambia mucho de uno a otro.');
      }
    }
    // --- conectores
    let eCon = 'si';
    let tCon = '';
    const need = conectoresGrafica(R, gpu);
    const ref = !!need && need.de === 'referencia';
    const a = ch && ch.adaptador ? ch.adaptador : 0;
    // con la de referencia, también las de marca de ese chip que llevan otros conectores
    const otras = ref ? (((R._conectoresChip || {})[gpu.chip]) || []).filter((v) => !(v[0] === need.n[0] && v[1] === need.n[1] && v[2] === need.n[2])) : [];
    if (!need) {
      eCon = 'nose';
      tCon = 'No sé qué conectores de corriente lleva esta gráfica: míralo en su ficha.';
    } else if (!sumaConectores(need.n) && !otras.some(sumaConectores)) {
      tCon = need.de === 'ranura'
        ? 'Gasta 75 W o menos, lo que da la ranura: muchas no llevan conector de corriente, pero algunas versiones con más frecuencia llevan uno de 6 u 8 pines. Mira la tuya.'
        : ref ? 'La de referencia no lleva conector de corriente: se alimenta de la ranura.' : 'No lleva conector de corriente: se alimenta de la ranura.';
      r.fuentes = r.fuentes.concat((G.potencia || {}).fuentes || []);
    } else if (!psu.pcie) {
      eCon = 'depende';
      tCon = `No sé seguro cuántos conectores PCIe trae la fuente: su ficha no lo dice o no cuadra. ${ref ? textoLleva('La de referencia de esta gráfica', need.n) + ' (las de marca pueden llevar otros)' : textoLleva('Esta gráfica', need.n)}: míralo antes de comprar.`;
    } else {
      const res = encaja(need.n, psu.pcie, a);
      const trae = `la fuente trae ${textoFuente(psu.pcie)}`;
      const pideAdaptador = a && need.n[2] > psu.pcie[1] ? ` El adaptador de 16 pines pide ${a} de 8 pines.` : '';
      if (ref) {
        const intro = `No sé qué conectores lleva tu modelo. ${textoLleva('La de referencia', need.n)} y ${trae}`;
        const malas = otras.filter((v) => {
          const x = encaja(v, psu.pcie, a);
          return x.falta || x.sinDato;
        });
        if (res.falta || res.sinDato) {
          eCon = 'depende';
          // si alguna de marca lleva otros con los que sí llega, se dice cuáles
          const buenas = otras.filter((v) => {
            const x = encaja(v, psu.pcie, a);
            return !x.falta && !x.sinDato;
          });
          const peso = (v) => v[0] + v[1] + v[2] * (a || 1);
          const conOtros = buenas.length ? ` Con los de algunas de marca (${textoConectores(buenas.reduce((x, y) => (peso(y) < peso(x) ? y : x)))}), sí.` : '';
          tCon = `${intro}: con esos no llegarían.${pideAdaptador}${conOtros} Mira los de tu modelo.`;
        } else if (malas.length) {
          eCon = 'depende';
          const peso = (v) => v[0] + v[1] + v[2] * (a || 1);
          const peorV = malas.reduce((x, y) => (peso(y) > peso(x) ? y : x));
          tCon = `${intro}: con esos llegan, pero hay versiones de marca con ${textoConectores(peorV)} y con esas no. Mira los de tu modelo.`;
        } else {
          tCon = `${intro}: llegan${res.adaptador ? `, con el adaptador que trae la gráfica (pide ${res.adaptador} de 8 pines)` : ''}${otras.length ? ', y también con los que llevan las versiones de marca de la lista' : ''}.`;
        }
      } else if (res.falta) {
        // los conectores de BuildCores fallan a veces: un «no» solo si los dos están comprobados a mano
        if (corregido(gpu, 'conectores') && corregido(psu, 'pcie')) {
          eCon = 'no';
          tCon = `${textoLleva('La gráfica', need.n)} y ${trae}: no llegan.${pideAdaptador}`;
        } else {
          eCon = 'depende';
          tCon = `${textoLleva('La gráfica', need.n)} y ${trae}: según sus fichas, no llegan.${pideAdaptador} Míralo en las fichas de tus modelos antes de comprar: si es así, esta fuente no te vale.`;
        }
      } else if (res.sinDato) {
        eCon = 'depende';
        tCon = `${textoLleva('La gráfica', need.n)} y ${trae}, sin conector de 16 pines: hace falta el adaptador que trae la gráfica. Mira cuántos de 8 pines pide.`;
      } else {
        tCon = `${textoLleva('La gráfica', need.n)} y ${trae}: llegan${res.adaptador ? `, con el adaptador que trae la gráfica (pide ${res.adaptador} de 8 pines)` : ''}.`;
      }
      if (res.adaptador && G.adaptador) {
        r.notas.push(G.adaptador.texto);
        r.fuentes = r.fuentes.concat(G.adaptador.fuentes || []);
      }
      // los cables de 16 pines pueden ser de 450 W: a una gráfica que gasta más no le basta
      if (res.nativo && c && c.w > 450 && G.cable16 && !res.falta) {
        r.notas.push(G.cable16.texto);
        r.fuentes = r.fuentes.concat(G.cable16.fuentes || []);
      }
      r.fuentes = r.fuentes.concat((G.potencia || {}).fuentes || []);
    }
    r.estado = peor([ePot, eCon]);
    // el «Sí:» solo si todo encaja; si los conectores fallan, la potencia va aparte
    if (segunMarca) tPot = (r.estado === 'si' ? 'Sí: ' : 'De potencia, bien: ') + segunMarca;
    r.texto = tPot + (tCon ? ' ' + tCon : '');
    return r;
  }

  // ------------------------------------------------------------ caja

  // ranuras de la caja que ocupa una gráfica (2,5 ranuras tapan 3 huecos; 2,05 se queda en 2)
  function huecosGrafica(ancho) {
    return Math.ceil(ancho - 0.1);
  }

  function graficaEnCajaSinFicha(R, gpu, caja) {
    const r = {estado: 'si', texto: '', notas: [], fuentes: []};
    const partes = [];
    let eLargo = 'nose';
    if (gpu.largo && caja.gpu_max) {
      const sobra = caja.gpu_max - gpu.largo;
      if (sobra < 0) {
        eLargo = 'no';
        partes.push(`No cabe: la gráfica mide ${gpu.largo} mm y la caja admite gráficas de hasta ${caja.gpu_max} mm.`);
      } else {
        eLargo = 'si';
        partes.push(`Cabe de largo: mide ${gpu.largo} mm y la caja admite hasta ${caja.gpu_max} mm.`);
        if (sobra < 15) r.notas.push(`Va justa (le sobran ${sobra} mm): con radiador o ventiladores delante puede que no quepa. Mira la ficha de la caja.`);
      }
    } else {
      partes.push(!caja.gpu_max ? 'La ficha de la caja no dice hasta qué largo de gráfica admite: míralo antes de comprar.'
        : 'No sé cuánto mide esta gráfica: mira su ficha.');
    }
    let eAncho = 'si';
    if (gpu.ranuras && caja.ranuras) {
      const huecos = huecosGrafica(gpu.ranuras);
      if (huecos > caja.ranuras) {
        eAncho = 'no';
        partes.push(`Y es demasiado gruesa: ocupa ${huecos} ranuras y la caja tiene ${caja.ranuras}.`);
        r.fuentes = r.fuentes.concat(((R.cajas || {}).ranuras || {}).fuentes || []);
      } else if (huecos >= caja.ranuras - 1) {
        // en muchas placas la ranura de la gráfica es la segunda: entonces cabe una menos
        r.notas.push(`De grosor va justa: ocupa ${huecos} ranuras y la caja tiene ${caja.ranuras}. Si en tu placa la ranura de la gráfica no es la primera, mira que le queden ${huecos} libres por debajo.`);
        r.fuentes = r.fuentes.concat(((R.cajas || {}).ranuras || {}).fuentes || []);
      }
    }
    r.estado = eAncho === 'no' ? 'no' : eLargo === 'nose' ? 'nose' : eLargo;
    r.texto = partes.join(' ');
    return r;
  }

  // formato de placa con el que la busca la caja (las Thin Mini-ITX van donde las Mini-ITX)
  function formatoPlaca(formato) {
    return formato === 'Thin Mini-ITX' ? 'Mini-ITX' : formato;
  }

  function placaEnCajaSinFicha(R, placa, caja) {
    const f = formatoPlaca(placa.formato);
    if (!f) return {estado: 'nose', texto: `La ficha de la placa no dice su formato: la caja admite ${listaY(caja.placas)}.`, notas: [], fuentes: []};
    if (caja.placas.indexOf(f) >= 0) return {estado: 'si', texto: `Sí: la placa es ${placa.formato} y la caja la admite.`, notas: [], fuentes: []};
    return {estado: 'no', texto: `No: la placa es ${placa.formato} y la caja solo admite ${listaY(caja.placas)}.`, notas: [], fuentes: []};
  }

  function fuenteEnCajaSinFicha(R, psu, caja) {
    const r = {estado: 'si', texto: '', notas: [], fuentes: []};
    const C = R.cajas || {};
    if (!psu.formato) {
      r.estado = 'nose';
      r.texto = 'La ficha de la fuente no dice su formato (ATX, SFX…): míralo antes de comprar.';
    } else if (caja.psu) {
      if (caja.psu.indexOf(psu.formato) >= 0) {
        r.texto = `Sí: la fuente es ${psu.formato} y la caja la admite.`;
      } else if ((psu.formato === 'SFX' || psu.formato === 'SFX-L') && caja.psu.indexOf('ATX') >= 0 && C.sfx_en_atx) {
        r.estado = 'depende';
        r.texto = `Sí, con un soporte adaptador: la fuente es ${psu.formato} y la caja es para fuentes ATX. ${C.sfx_en_atx.texto}`;
        r.fuentes = r.fuentes.concat(C.sfx_en_atx.fuentes || []);
      } else {
        r.estado = 'no';
        r.texto = `No: la fuente es ${psu.formato} y la caja es para fuentes ${listaY(caja.psu)}.`;
      }
    } else {
      r.estado = 'nose';
      r.texto = `La ficha de la caja no dice qué fuentes admite: la tuya es ${psu.formato}${psu.largo ? ' y mide ' + psu.largo + ' mm' : ''}. Míralo antes de comprar.`;
    }
    if (r.estado !== 'no' && psu.largo && caja.psu_max) {
      if (psu.largo > caja.psu_max) {
        r.estado = 'no';
        r.texto = `No cabe: la fuente mide ${psu.largo} mm y la caja admite fuentes de hasta ${caja.psu_max} mm.`;
      } else if (r.estado === 'si') {
        r.texto += ` Mide ${psu.largo} mm y caben hasta ${caja.psu_max} mm.`;
      }
    }
    if (caja.incluida) r.notas.push(`Ojo: esta caja ya trae una fuente de ${caja.incluida} W. Con la que has elegido, una de las dos sobra.`);
    return r;
  }

  // ------------------------------------------------------------ disipador

  // Zócalos donde vale el anclaje de un disipador, con los que comparten anclaje según los fabricantes.
  function zocalosDisipador(R, dis) {
    const D = R.disipadores || {};
    const vale = {};
    for (const z of dis.zocalos) vale[z] = {directo: true};
    for (const g of D.grupos || []) {
      if (g.zocalos.some((z) => vale[z] && vale[z].directo)) {
        for (const z of g.zocalos) if (!vale[z]) vale[z] = {grupo: g};
      }
    }
    return vale;
  }

  function disipadorEnZocaloSinFicha(R, dis, zocalo) {
    const r = {estado: 'si', texto: '', notas: [], fuentes: []};
    const D = R.disipadores || {};
    const vale = zocalosDisipador(R, dis);
    if (vale[zocalo] && vale[zocalo].directo) {
      r.texto = `Sí: trae anclaje para ${zocalo}.`;
    } else if (vale[zocalo]) {
      r.texto = `Sí: no pone ${zocalo} en la ficha, pero ${zocalo} tiene el mismo anclaje que ${dis.zocalos.filter((z) => vale[z].directo && vale[zocalo].grupo.zocalos.indexOf(z) >= 0).join(' y ')}.`;
      r.notas.push(vale[zocalo].grupo.texto);
      r.fuentes = r.fuentes.concat(vale[zocalo].grupo.fuentes || []);
    } else if (zocalo === 'AM5' && vale.AM4 && D.am4_en_am5) {
      r.estado = 'depende';
      r.texto = `Seguramente sí: la ficha pone AM4 y no AM5. ${D.am4_en_am5.texto}`;
      r.fuentes = r.fuentes.concat(D.am4_en_am5.fuentes || []);
    } else if (zocalo === 'AM4' && vale.AM5 && D.am5_en_am4) {
      r.estado = 'depende';
      r.texto = `Puede que sí: la ficha pone AM5 y no AM4. ${D.am5_en_am4.texto}`;
      r.fuentes = r.fuentes.concat(D.am5_en_am4.fuentes || []);
    } else {
      r.estado = 'no';
      const vale2 = dis.zocalos.filter((z) => z !== 'LGA 115x');
      r.texto = `No: su ficha no trae anclaje para ${zocalo}${vale2.length ? ' (vale para ' + listaY(vale2) + ')' : ''}. Algunos fabricantes venden o regalan el kit de anclaje: míralo en su web.`;
      // de LGA 1200 a LGA 1700 (o al revés) cambió el anclaje: lo explica el kit
      const nuevo = (z) => z === 'LGA 1700' || z === 'LGA 1851';
      const viejo = (z) => z === 'LGA 1200' || z === 'LGA 1151' || z === 'LGA 115x';
      if (D.kit && ((nuevo(zocalo) && dis.zocalos.some(viejo)) || (viejo(zocalo) && dis.zocalos.some(nuevo)))) {
        r.notas.push(D.kit.texto);
        r.fuentes = r.fuentes.concat(D.kit.fuentes || []);
      }
    }
    return r;
  }

  function disipadorConCpu(R, dis, cpu) {
    return disipadorEnZocalo(R, dis, cpu.zocalo);
  }

  function disipadorEnCajaSinFicha(R, dis, caja) {
    const r = {estado: 'si', texto: '', notas: [], fuentes: []};
    if (dis.liquida) {
      r.estado = 'nose';
      r.texto = `Es de refrigeración líquida${dis.radiador ? ' con radiador de ' + dis.radiador + ' mm' : ''}: mira en la ficha de la caja que admita ese radiador y dónde (arriba o delante). Ese dato no viene en la lista.`;
    } else if (dis.alto && caja.disipador_max) {
      if (dis.alto > caja.disipador_max) {
        r.estado = 'no';
        r.texto = `No cabe: el disipador mide ${dis.alto} mm de alto y en la caja caben hasta ${caja.disipador_max} mm.`;
      } else {
        r.texto = `Cabe: mide ${dis.alto} mm de alto y en la caja caben hasta ${caja.disipador_max} mm.`;
        if (caja.disipador_max - dis.alto < 5) r.notas.push(`Va justo: le sobran ${caja.disipador_max - dis.alto} mm.`);
      }
    } else {
      r.estado = 'nose';
      r.texto = !caja.disipador_max ? `La ficha de la caja no dice qué altura de disipador admite${dis.alto ? ' (este mide ' + dis.alto + ' mm)' : ''}: míralo antes de comprar.`
        : `No sé cuánto mide de alto este disipador: en la caja caben hasta ${caja.disipador_max} mm.`;
    }
    return r;
  }

  // ------------------------------------------------------------ fichas comprobadas a mano

  // Si un dato que usa la comprobación se corrigió a mano con la ficha de la pieza, esa ficha va con las fuentes.
  // usos: [[pieza, [campos que usa]], …]. Se hace una lista nueva: las de las reglas no se tocan.
  function conFicha(r, usos) {
    const mas = [];
    for (const [p, campos] of usos) {
      if (p && p.fuente && campos.some((c) => corregido(p, c)) && r.fuentes.indexOf(p.fuente) < 0 && mas.indexOf(p.fuente) < 0) mas.push(p.fuente);
    }
    if (mas.length) r.fuentes = r.fuentes.concat(mas);
    return r;
  }

  // (la interfaz y el consumo de la tarjeta solo cuentan si su chip no tiene regla)
  function graficaEnPlaca(R, gpu, placa, cpu) {
    const ch = chipGrafica(R, gpu);
    return conFicha(graficaEnPlacaSinFicha(R, gpu, placa, cpu), [[gpu, ch && ch.pcie ? [] : ['pcie']], [placa, ['x16', 'notas_grafica']]]);
  }

  function graficaConFuente(R, gpu, psu, cpu) {
    const ch = chipGrafica(R, gpu);
    return conFicha(graficaConFuenteSinFicha(R, gpu, psu, cpu), [[gpu, ['conectores'].concat(ch && ch.consumo ? [] : ['tdp'])], [psu, ['vatios', 'pcie']]]);
  }

  function graficaEnCaja(R, gpu, caja) {
    return conFicha(graficaEnCajaSinFicha(R, gpu, caja), [[gpu, ['largo', 'ranuras']], [caja, ['gpu_max', 'ranuras']]]);
  }

  function placaEnCaja(R, placa, caja) {
    return conFicha(placaEnCajaSinFicha(R, placa, caja), [[placa, ['formato']], [caja, ['placas']]]);
  }

  function fuenteEnCaja(R, psu, caja) {
    return conFicha(fuenteEnCajaSinFicha(R, psu, caja), [[psu, ['formato', 'largo']], [caja, ['psu', 'psu_max', 'incluida']]]);
  }

  function disipadorEnZocalo(R, dis, zocalo) {
    return conFicha(disipadorEnZocaloSinFicha(R, dis, zocalo), [[dis, ['zocalos']]]);
  }

  function disipadorEnCaja(R, dis, caja) {
    return conFicha(disipadorEnCajaSinFicha(R, dis, caja), [[dis, ['alto', 'liquida', 'radiador']], [caja, ['disipador_max']]]);
  }
  // ------------------------------------------------------------ dónde comprarlo

  // Direcciones de búsqueda comprobadas una a una en el navegador (18-11-2026). Sin afiliados: la web no
  // gana nada con la compra. Los comparadores ordenan las tiendas por precio en el momento.
  const COMPARADORES = [
    {tienda: 'idealo', url: (q) => 'https://www.idealo.es/resultados.html?q=' + encodeURIComponent(q)},
    {tienda: 'Google Shopping', url: (q) => 'https://www.google.es/search?udm=28&q=' + encodeURIComponent(q)},
  ];
  const TIENDAS = [
    {tienda: 'Amazon', url: (q) => 'https://www.amazon.es/s?k=' + encodeURIComponent(q), ficha: (c) => 'https://www.amazon.es/dp/' + c},
    {tienda: 'PcComponentes', url: (q) => 'https://www.pccomponentes.com/search/?query=' + encodeURIComponent(q)},
    {tienda: 'MediaMarkt', url: (q) => 'https://www.mediamarkt.es/es/search.html?query=' + encodeURIComponent(q)},
    {tienda: 'LDLC', url: (q) => 'https://www.ldlc.com/es-es/buscar/' + encodeURIComponent(q) + '/'},
    {tienda: 'Alternate', url: (q) => 'https://www.alternate.es/listing.xhtml?q=' + encodeURIComponent(q)},
    {tienda: 'Neobyte', url: (q) => 'https://www.neobyte.es/busqueda?controller=search&s=' + encodeURIComponent(q)},
  ];

  // Corta un nombre en la primera palabra de relleno, pero nunca antes de la marca y el modelo (dos palabras).
  function cortarTrasModelo(t, re) {
    const m = /^\S+\s+\S+/.exec(t);
    const desde = m ? m[0].length : t.length;
    const i = t.slice(desde).search(re);
    return i >= 0 ? t.slice(0, desde + i) : t;
  }

  const COLORES = /\s(Black|White|Silver|Gray|Grey|Pink|Blue|Red|Green|Orange|Yellow|Gold|Purple)(?=\s|\/|$)/gi;

  // Lo que se escribe en el buscador de una tienda: el modelo, sin el relleno de la ficha.
  function textoBusqueda(tipo, pieza) {
    let t = String(pieza.nombre || '');
    if (tipo === 'placas') {
      // se corta en el zócalo, el formato o el relleno («AM4 DDR4 ATX», «LGA1700 DDR4 Micro-ATX», «Motherboard»)
      const corte = t.search(/\s(AM[45]|LGA\s?\d{4}|s?TRX?\d|DDR[345]|E-?ATX|ATX|Micro[- ]?ATX|mATX|Mini[- ]?(ITX|DTX)|EEB|Motherboard|AMD Ryzen|Intel Core)\b/i);
      if (corte > 0) t = t.slice(0, corte);
      // en LGA 1700 hay versión DDR4 y DDR5 con casi el mismo nombre: la DDR4 lo lleva en el nombre
      if (pieza.zocalo === 'LGA 1700' && pieza.ram === 'DDR4' && !/\b(DDR4|D4)\b/i.test(t)) t += ' DDR4';
    } else if (tipo === 'ssd') {
      const corte = t.search(/\s(SSD|M\.2|PCIe|NVMe|SATA|Solid State|Internal)\b/i);
      if (corte > 0) t = t.slice(0, corte);
      t = t.replace(/\bw\/\s*/i, '');
      if (pieza.gb && !/\d\s?[GT]B\b/i.test(t)) t += ' ' + (pieza.gb >= 1000 ? (pieza.gb / 1000) + 'TB' : pieza.gb + 'GB');
    } else if (tipo === 'ram') {
      t = t.replace(/[()]/g, '');
    } else if (tipo === 'graficas') {
      // «Asus DUAL EVO GeForce RTX 4060 8GB GDDR6 Black» -> «Asus DUAL EVO GeForce RTX 4060 8GB»
      const corte = t.search(/\s(GDDR\d\w*|Graphics Card|Video Card)(?=\s|$)/i);
      if (corte > 0) t = t.slice(0, corte);
    } else if (tipo === 'fuentes') {
      // «Corsair RM750 (2019) Black ATX 750W Fully Modular 80+ Gold» -> «Corsair RM750 750W»
      t = t.replace(/\s*\([^)]*\)/g, '');
      t = cortarTrasModelo(t, /\s(Black|White|ATX|SFX-L|SFX|TFX|Flex ATX|Fully Modular|Semi-Modular|Non-Modular|80\+|\d{3,4}\s?W)(?=\s|$)/i);
      if (pieza.vatios && !/\d\s?W\b/i.test(t)) t += ' ' + pieza.vatios + 'W';
    } else if (tipo === 'cajas') {
      // «NZXT H5 Flow (2022) ATX Mid Tower Black with Tempered Glass Side Panel» -> «NZXT H5 Flow»
      const relleno = /\s(E-?ATX|ATX|Micro[- ]?ATX|mATX|Mini[- ]?ITX|ITX|HTPC|Mid[- ]Tower|Full[- ]Tower|Mini[- ]Tower|Black|White|with|Tempered Glass|Case)(?=\s|$)/i;
      const sinRelleno = (x) => x.replace(new RegExp(relleno.source, 'gi'), ' ').replace(COLORES, ' ').trim();
      t = t.replace(/\s*\([^)]*\)/g, '');
      let corto = cortarTrasModelo(t.split(' - ')[0], relleno);
      if (sinRelleno(corto).split(/\s+/).length < 2) {
        // solo queda la marca («Rosewill ATX»): el modelo tras el guion del final («… - SPECTRA C100») o el nombre sin relleno
        const tras = / - ([^-]+)$/.exec(t);
        corto = tras && tras[1].trim().split(/\s+/).length <= 4 ? t.split(/\s+/)[0] + ' ' + tras[1].trim()
          : sinRelleno(t).split(/\s+/).slice(0, 4).join(' ');
      }
      t = corto;
    } else if (tipo === 'disipadores') {
      // «Thermalright Peerless Assassin 120 SE 66.17 CFM CPU Cooler» -> «Thermalright Peerless Assassin 120 SE»
      t = cortarTrasModelo(t, /\s(\d+(?:[.,]\d+)?\s?CFM|(?:Water|Air)(?=\s+\d+(?:[.,]\d+)?\s?(?:mm|CFM))|Liquid CPU Cooler|CPU Cooler|Black|White|\d+(?:[.,]\d+)?\s?mm)(?=\s|$)/i);
      // «EK AIO»: con tan poco, mejor con la medida del radiador
      if (t.length < 8 && pieza.radiador) t += ' ' + pieza.radiador;
    }
    if (tipo === 'graficas' || tipo === 'cajas' || tipo === 'disipadores') {
      // el color del final no ayuda a buscar (y a veces la tienda lo escribe de otra forma)
      t = t.replace(/(\s(Black|White|Silver|Gray|Grey|Pink|Blue|Red|Green|Orange|Yellow|Gold|Purple)(\s*\/\s*\w+)*)+$/i, '');
    }
    return t.replace(/\s+/g, ' ').trim();
  }

  // Enlaces para comprar una pieza: comparadores de precio y tiendas (en Amazon, la ficha exacta si BuildCores la da).
  function enlacesCompra(tipo, pieza) {
    const q = textoBusqueda(tipo, pieza);
    return {
      busqueda: q,
      comparadores: COMPARADORES.map((t) => ({tienda: t.tienda, url: t.url(q), exacto: false})),
      tiendas: TIENDAS.map((t) => (t.ficha && pieza.amazon
        ? {tienda: t.tienda, url: t.ficha(pieza.amazon), exacto: true}
        : {tienda: t.tienda, url: t.url(q), exacto: false})),
    };
  }

  // ------------------------------------------------------------ listas

  function familiasEnOrden(R) {
    return Object.keys(R.familias || {});
  }

  // Procesadores para una placa, por estado y familia.
  function cpusParaPlaca(R, cpus, placa) {
    const orden = familiasEnOrden(R);
    const grupos = {};
    for (const c of cpus) {
      if (c.zocalo !== placa.zocalo) continue;
      const e = cpuEnPlaca(R, c, placa).estado;
      const g = grupos[e] || (grupos[e] = {});
      const clave = c.familia || '?';
      (g[clave] || (g[clave] = [])).push(c);
    }
    return ORDEN_ESTADOS.filter((e) => grupos[e]).map((e) => ({
      estado: e,
      familias: Object.keys(grupos[e])
        .sort((a, b) => orden.indexOf(b) - orden.indexOf(a))  // lo más nuevo primero
        .map((f) => ({clave: f, nombre: familia(R, f) ? familia(R, f).nombre : 'Otros', cpus: grupos[e][f]})),
    }));
  }

  // Placas para un procesador, por chipset.
  function placasParaCpu(R, placas, cpu) {
    const grupos = {};
    for (const p of placas) {
      if (p.zocalo !== cpu.zocalo) continue;
      const clave = p.chipset || '?';
      const g = grupos[clave] || (grupos[clave] = {chipset: clave, estado: cpuEnPlaca(R, cpu, p).estado, placas: []});
      g.placas.push(p);
    }
    return Object.keys(grupos).map((k) => grupos[k])
      .sort((a, b) => ORDEN_ESTADOS.indexOf(a.estado) - ORDEN_ESTADOS.indexOf(b.estado) || (a.chipset < b.chipset ? 1 : -1));
  }

  // Placas por zócalo para las que una prueba devuelve «si» o «depende».
  function placasQue(placas, prueba) {
    const grupos = {};
    for (const p of placas) {
      const e = prueba(p);
      if (e !== 'si' && e !== 'depende' && e !== 'bios') continue;
      const g = grupos[p.zocalo] || (grupos[p.zocalo] = {zocalo: p.zocalo, si: [], depende: []});
      g[e === 'si' ? 'si' : 'depende'].push(p);
    }
    return Object.keys(grupos).sort().map((k) => grupos[k]);
  }

  function placasParaRam(R, placas, kit) {
    return placasQue(placas, (p) => ramEnPlaca(R, kit, p).estado);
  }

  function placasParaSsd(R, placas, ssd) {
    return placasQue(placas, (p) => (p.m2 ? ssdEnPlaca(R, ssd, p, null).estado : 'nose'));
  }

  // Piezas para las que una prueba da «si» o «depende», en grupos: primero las de «si».
  // grupo(p) da el título del grupo; orden(a, b) ordena los grupos dentro de cada estado.
  // extra(p), si se da, es el estado de la pieza con lo demás que ya se ha elegido: cuenta el peor.
  function agrupar(lista, prueba, grupo, orden, extra) {
    const grupos = {};
    for (const p of lista) {
      let e = prueba(p);
      if (e !== 'si' && e !== 'depende') continue;
      if (extra) e = peor([e, extra(p) || 'si']);
      if (e === 'bios') e = 'depende';
      if (e !== 'si' && e !== 'depende') continue;
      const titulo = grupo(p) || 'Otras';
      const k = e + '|' + titulo;
      (grupos[k] || (grupos[k] = {estado: e, titulo: titulo, piezas: []})).piezas.push(p);
    }
    return Object.keys(grupos).map((k) => grupos[k])
      .sort((a, b) => (a.estado === b.estado ? 0 : a.estado === 'si' ? -1 : 1) || orden(a, b));
  }

  // los chips en el orden de las reglas (por marca, de lo más nuevo a lo más viejo); los que no tienen regla, al final
  function ordenChips(R) {
    const pos = {};
    Object.keys(reglasGraficas(R).chips || {}).forEach((k, i) => { pos[k] = i; });
    const en = (t) => (t in pos ? pos[t] : 1e6);
    return (a, b) => en(a.titulo) - en(b.titulo) || porTexto(a, b);
  }

  // por el primer número del título: «De 90 a 99 mm» antes que «De 100 a 109 mm»
  function numeroDe(t) {
    const m = /\d+/.exec(t);
    return m ? Number(m[0]) : 0;
  }

  function porNumero(a, b) {
    return numeroDe(a.titulo) - numeroDe(b.titulo) || porTexto(a, b);
  }

  function porTexto(a, b) {
    return a.titulo < b.titulo ? -1 : a.titulo > b.titulo ? 1 : 0;
  }

  // fuentes: las que valen, de la más pequeña a la más grande; las de «ojo», al revés (primero las que más se acercan)
  function porVatios(a, b) {
    return a.estado === 'depende' ? porNumero(b, a) : porNumero(a, b);
  }

  function graficasParaCaja(R, gpus, caja, extra) {
    return agrupar(gpus, (g) => graficaEnCaja(R, g, caja).estado, (g) => g.chip, ordenChips(R), extra);
  }

  function graficasParaFuente(R, gpus, psu, cpu, extra) {
    return agrupar(gpus, (g) => graficaConFuente(R, g, psu, cpu).estado, (g) => g.chip, ordenChips(R), extra);
  }

  function graficasParaPlaca(R, gpus, placa, cpu, extra) {
    return agrupar(gpus, (g) => graficaEnPlaca(R, g, placa, cpu).estado, (g) => g.chip, ordenChips(R), extra);
  }

  function fuentesParaGrafica(R, psus, gpu, cpu, extra) {
    return agrupar(psus, (p) => graficaConFuente(R, gpu, p, cpu).estado, (p) => p.vatios + ' W', porVatios, extra);
  }

  function cajasParaGrafica(R, cajas, gpu, extra) {
    return agrupar(cajas, (c) => graficaEnCaja(R, gpu, c).estado, (c) => c.formato, porTexto, extra);
  }

  function cajasParaPlaca(R, cajas, placa, extra) {
    return agrupar(cajas, (c) => placaEnCaja(R, placa, c).estado, (c) => c.formato, porTexto, extra);
  }

  function cajasParaDisipador(R, cajas, dis, extra) {
    return agrupar(cajas, (c) => disipadorEnCaja(R, dis, c).estado, (c) => c.formato, porTexto, extra);
  }

  function disipadoresParaZocalo(R, diss, zocalo, extra) {
    return agrupar(diss, (d) => disipadorEnZocalo(R, d, zocalo).estado,
      (d) => (d.liquida ? 'De refrigeración líquida' : 'De aire'), porTexto, extra);
  }

  function disipadoresParaCaja(R, diss, caja, extra) {
    return agrupar(diss, (d) => disipadorEnCaja(R, d, caja).estado,
      (d) => (d.alto ? 'De ' + Math.floor(d.alto / 10) * 10 + ' a ' + (Math.floor(d.alto / 10) * 10 + 9) + ' mm de alto' : 'Otros'), porNumero, extra);
  }

  // ------------------------------------------------------------ resumen del equipo

  // Todas las comprobaciones entre las piezas elegidas, para el veredicto de arriba.
  function comprobar(R, piezas) {
    const placa = piezas.placa || null;
    const cpu = piezas.cpu || null;
    const kit = piezas.ram || null;
    const ssd = piezas.ssd || null;
    const filas = [];
    if (cpu && placa) {
      const r = cpuEnPlaca(R, cpu, placa);
      filas.push({que: 'Procesador y placa', estado: r.estado, texto: r.texto, notas: r.notas, fuentes: r.fuentes});
    }
    if (kit && placa) {
      const r = ramEnPlaca(R, kit, placa);
      filas.push({que: 'Memoria y placa', estado: r.estado, texto: r.texto, notas: r.notas, fuentes: []});
    }
    if (kit && cpu) {
      const r = ramConCpu(R, kit, cpu);
      if (r.estado === 'no') filas.push({que: 'Memoria y procesador', estado: 'no', texto: r.texto, notas: [], fuentes: []});
    }
    if (ssd && placa) {
      const r = ssdEnPlaca(R, ssd, placa, cpu);
      filas.push({que: 'SSD y placa', estado: r.estado, texto: r.texto, notas: [], fuentes: []});
    }
    const gpu = piezas.gpu || null;
    const psu = piezas.psu || null;
    const caja = piezas.caja || null;
    const dis = piezas.disipador || null;
    const fila = (que, r) => filas.push({que: que, estado: r.estado, texto: r.texto, notas: r.notas || [], fuentes: r.fuentes || []});
    if (gpu && placa) fila('Gráfica y placa', graficaEnPlaca(R, gpu, placa, cpu));
    else if (gpu && cpu) fila('Gráfica y procesador', graficaEnPlaca(R, gpu, null, cpu));
    if (gpu && psu) fila('Gráfica y fuente', graficaConFuente(R, gpu, psu, cpu));
    if (gpu && caja) fila('Gráfica y caja', graficaEnCaja(R, gpu, caja));
    if (placa && caja) fila('Placa y caja', placaEnCaja(R, placa, caja));
    if (psu && caja) fila('Fuente y caja', fuenteEnCaja(R, psu, caja));
    if (dis && cpu) fila('Disipador y procesador', disipadorConCpu(R, dis, cpu));
    else if (dis && placa) fila('Disipador y placa', disipadorEnZocalo(R, dis, placa.zocalo));
    if (dis && caja) fila('Disipador y caja', disipadorEnCaja(R, dis, caja));
    return filas;
  }

  const PC = {
    ORDEN_ESTADOS: ORDEN_ESTADOS,
    tabla: tabla,
    normal: normal,
    buscar: buscar,
    familia: familia,
    plataforma: plataforma,
    reglasChipset: reglasChipset,
    cpuEnPlaca: cpuEnPlaca,
    ramEnPlaca: ramEnPlaca,
    ramConCpu: ramConCpu,
    velocidad: velocidad,
    ramRecomendada: ramRecomendada,
    ssdEnPlaca: ssdEnPlaca,
    textoSinHuecos: textoSinHuecos,
    notasM2: notasM2,
    grafica: grafica,
    cpusParaPlaca: cpusParaPlaca,
    placasParaCpu: placasParaCpu,
    placasParaRam: placasParaRam,
    placasParaSsd: placasParaSsd,
    comprobar: comprobar,
    textoBusqueda: textoBusqueda,
    enlacesCompra: enlacesCompra,
    peor: peor,
    chipGrafica: chipGrafica,
    pcieRanura: pcieRanura,
    enlaceGrafica: enlaceGrafica,
    notaRendimiento: notaRendimiento,
    formatoPlaca: formatoPlaca,
    graficaEnPlaca: graficaEnPlaca,
    consumoGrafica: consumoGrafica,
    consumoCpu: consumoCpu,
    conectoresGrafica: conectoresGrafica,
    textoConectores: textoConectores,
    notaRebar: notaRebar,
    graficaConFuente: graficaConFuente,
    huecosGrafica: huecosGrafica,
    graficaEnCaja: graficaEnCaja,
    placaEnCaja: placaEnCaja,
    fuenteEnCaja: fuenteEnCaja,
    zocalosDisipador: zocalosDisipador,
    disipadorEnZocalo: disipadorEnZocalo,
    disipadorConCpu: disipadorConCpu,
    disipadorEnCaja: disipadorEnCaja,
    graficasParaCaja: graficasParaCaja,
    graficasParaFuente: graficasParaFuente,
    graficasParaPlaca: graficasParaPlaca,
    fuentesParaGrafica: fuentesParaGrafica,
    cajasParaGrafica: cajasParaGrafica,
    cajasParaPlaca: cajasParaPlaca,
    cajasParaDisipador: cajasParaDisipador,
    disipadoresParaZocalo: disipadoresParaZocalo,
    disipadoresParaCaja: disipadoresParaCaja,
    corregido: corregido,
    textoFuente: textoFuente,
    encaja: encaja,
    conectoresPorChip: conectoresPorChip,
    picoMinimo: picoMinimo,
    cpusQueLimitan: cpusQueLimitan,
  };

  if (typeof module === 'object' && module.exports) module.exports = PC;
  else raiz.PC = PC;
})(this);
