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

  function grafica(R, cpu, placa) {
    const F = familia(R, cpu.familia);
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
  };

  if (typeof module === 'object' && module.exports) module.exports = PC;
  else raiz.PC = PC;
})(this);
