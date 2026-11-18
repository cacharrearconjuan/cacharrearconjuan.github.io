#!/usr/bin/env node
/* Pruebas de la lógica de «¿Qué le va a mi PC?» con las reglas de verdad (pc/reglas.json).
 *
 *   node tests/probar_pc.js
 */
'use strict';

const path = require('path');
const fs = require('fs');

const RAIZ = path.join(__dirname, '..');
const PC = require(path.join(RAIZ, 'pc', 'logica.js'));
const R = JSON.parse(fs.readFileSync(path.join(RAIZ, 'pc', 'reglas.json'), 'utf8'));

let hechas = 0;
const fallos = [];

function comprobar(cond, texto) {
  hechas++;
  if (!cond) {
    fallos.push(texto);
    console.log('  FALLA:', texto);
  }
}

// ------------------------------------------------------------ piezas de prueba (mismo formato que datos-pc/)

function cpu(id, nombre, zocalo, familia, igpu, extra) {
  return Object.assign({id: id, nombre: nombre, zocalo: zocalo, familia: familia, igpu: igpu, igpu_modelo: null,
    nucleos: 6, hilos: 12, boost: 4.6, tdp: 65, ram: [], anio: 2022}, extra || {});
}

function placa(nombre, zocalo, chipset, ram, ranuras, max, m2, extra) {
  return Object.assign({id: nombre.toLowerCase().replace(/\W+/g, ''), nombre: nombre, zocalo: zocalo, chipset: chipset,
    formato: 'ATX', ram: ram, ranuras: ranuras, max_gb: max, m2: m2, m2_nota: m2 ? '' : 'plantilla',
    video: null, flashback: null, revisada: '', anio: 2021}, extra || {});
}

function kit(tipo, velocidad, cl, modulos, gb, perfil) {
  return {id: `${tipo}${velocidad}${modulos}x${gb}`, nombre: `Kit ${tipo}-${velocidad} CL${cl} ${modulos}x${gb}GB`, tipo: tipo,
    velocidad: velocidad, cl: cl, modulos: modulos, gb: gb, perfil: perfil || ''};
}

function ssd(nombre, largo, gen, carriles, protocolo, extra) {
  return Object.assign({id: nombre, nombre: nombre, largo: largo, gen: gen, carriles: carriles, protocolo: protocolo, gb: 1000, disipador: 0}, extra || {});
}

const r5600x = cpu('ryzen-5-5600x', 'AMD Ryzen 5 5600X', 'AM4', 'vermeer', false);
const r3600 = cpu('ryzen-5-3600', 'AMD Ryzen 5 3600', 'AM4', 'matisse', false);
const r1700 = cpu('ryzen-7-1700', 'AMD Ryzen 7 1700', 'AM4', 'summit', false);
const r5600g = cpu('ryzen-5-5600g', 'AMD Ryzen 5 5600G', 'AM4', 'cezanne', true, {igpu_modelo: 'AMD Radeon Vega 7'});
const r3400g = cpu('ryzen-5-3400g', 'AMD Ryzen 5 3400G', 'AM4', 'picasso', true);
const a3000g = cpu('athlon-3000g', 'AMD Athlon 3000G', 'AM4', 'picasso', true);
const r7800x3d = cpu('ryzen-7-7800x3d', 'AMD Ryzen 7 7800X3D', 'AM5', 'raphael', true, {tdp: 120});
const r9950x = cpu('ryzen-9-9950x', 'AMD Ryzen 9 9950X', 'AM5', 'granite', true, {tdp: 170});
const r8500g = cpu('ryzen-5-8500g', 'AMD Ryzen 5 8500G', 'AM5', 'phoenix', true);
const i12400 = cpu('core-i5-12400', 'Intel Core i5-12400', 'LGA 1700', 'alder', true, {igpu_modelo: 'Intel UHD Graphics 730'});
const i12400f = cpu('core-i5-12400f', 'Intel Core i5-12400F', 'LGA 1700', 'alder', false);
const i13400 = cpu('core-i5-13400', 'Intel Core i5-13400', 'LGA 1700', 'raptor', true);
const i13600k = cpu('core-i5-13600k', 'Intel Core i5-13600K', 'LGA 1700', 'raptor', true);
const i14600k = cpu('core-i5-14600k', 'Intel Core i5-14600K', 'LGA 1700', 'raptor_r', true);
const u265k = cpu('core-ultra-7-265k', 'Intel Core Ultra 7 265K', 'LGA 1851', 'arrow', true);
const i8700k = cpu('core-i7-8700k', 'Intel Core i7-8700K', 'LGA 1151', 'coffee', true);
const i8100 = cpu('core-i3-8100', 'Intel Core i3-8100', 'LGA 1151', 'coffee', true);
const i6600k = cpu('core-i5-6600k', 'Intel Core i5-6600K', 'LGA 1151', 'skylake', true);
const i7600k = cpu('core-i5-7600k', 'Intel Core i5-7600K', 'LGA 1151', 'kaby', true);
const i10400 = cpu('core-i5-10400', 'Intel Core i5-10400', 'LGA 1200', 'comet', true);
const i10700k = cpu('core-i7-10700k', 'Intel Core i7-10700K', 'LGA 1200', 'comet', true);
const i11700k = cpu('core-i7-11700k', 'Intel Core i7-11700K', 'LGA 1200', 'rocket', true);
const nuevo = cpu('core-ultra-5-999x', 'Intel Core Ultra 5 999X', 'LGA 1954', null, true);
const r1600af = cpu('ryzen-5-1600-af', 'AMD Ryzen 5 1600 AF', 'AM4', 'pinnacle', false);
const r2600 = cpu('ryzen-5-2600', 'AMD Ryzen 5 2600', 'AM4', 'pinnacle', false);
const a200ge = cpu('athlon-200ge', 'AMD Athlon 200GE', 'AM4', 'raven', true);
const r2400g = cpu('ryzen-5-2400g', 'AMD Ryzen 5 2400G', 'AM4', 'raven', true);
const r7600x3d = cpu('ryzen-5-7600x3d', 'AMD Ryzen 5 7600X3D', 'AM5', 'raphael', true, {anio: 2024});

const b550 = placa('MSI MAG B550 TOMAHAWK', 'AM4', 'B550', 'DDR4', 4, 128,
  [['2242,2260,2280,22110', 4, 4, 'p'], ['2242,2260,2280', 3, 4, 'ps']], {flashback: true, video: ['HDMI', 'DisplayPort']});
const b450 = placa('Gigabyte B450M DS3H', 'AM4', 'B450', 'DDR4', 4, 64, [['2280', 3, 4, 'ps']]);
const a320 = placa('ASUS PRIME A320M-K', 'AM4', 'A320', 'DDR4', 2, 32, [['2280', 3, 4, 'p']]);
const a520 = placa('MSI A520M-A PRO', 'AM4', 'A520', 'DDR4', 2, 64, [['2280', 3, 4, 'p']]);
const x570 = placa('ASUS TUF GAMING X570-PLUS', 'AM4', 'X570', 'DDR4', 4, 128, [['2280', 4, 4, 'p'], ['2280', 4, 4, 'ps']]);
const b650 = placa('ASUS TUF GAMING B650-PLUS', 'AM5', 'B650', 'DDR5', 4, 192, [['2280', 5, 4, 'p'], ['2280', 4, 4, 'p']]);
const a620 = placa('ASRock A620M-HDV', 'AM5', 'A620', 'DDR5', 2, 96, [['2280', 4, 4, 'p']]);
const z790 = placa('Gigabyte Z790 AORUS ELITE AX', 'LGA 1700', 'Z790', 'DDR5', 4, 192, [['2280', 5, 4, 'p'], ['2280', 4, 4, 'p']]);
const b760d4 = placa('MSI PRO B760M-A DDR4', 'LGA 1700', 'B760', 'DDR4', 4, 128, [['2280', 4, 4, 'p']]);
const b660 = placa('ASUS PRIME B660-PLUS D4', 'LGA 1700', 'B660', 'DDR4', 4, 128, [['2280', 4, 4, 'p']]);
const h610 = placa('Gigabyte H610M S2H', 'LGA 1700', 'H610', 'DDR5', 2, 64, [['2280', 3, 4, 'p']]);
const z270 = placa('MSI Z270 GAMING PRO', 'LGA 1151', 'Z270', 'DDR4', 4, 64, null);
const b150 = placa('ASUS B150M-A', 'LGA 1151', 'B150', 'DDR4', 4, 64, null);
const z390 = placa('ASUS ROG STRIX Z390-F', 'LGA 1151', 'Z390', 'DDR4', 4, 64, [['2280', 3, 4, 'ps']]);
const h310 = placa('ASRock H310CM-HDV', 'LGA 1151', 'H310', 'DDR4', 2, 32, null);
const b460 = placa('MSI B460M PRO-VDH', 'LGA 1200', 'B460', 'DDR4', 4, 128, [['2280', 3, 4, 'p']]);
const z490 = placa('ASUS ROG STRIX Z490-E', 'LGA 1200', 'Z490', 'DDR4', 4, 128, [['2280', 3, 4, 'p']]);
const b560 = placa('ASUS TUF GAMING B560M-PLUS', 'LGA 1200', 'B560', 'DDR4', 4, 128, [['2280', 4, 4, 'p'], ['2280', 3, 4, 'ps']]);
const z990 = placa('ASUS PRIME Z990-P', 'LGA 1954', 'Z990', 'DDR5', 4, 256, [['2280', 5, 4, 'p']]);
const sinDatos = placa('Placa sin huecos en la ficha', 'AM4', 'B450', 'DDR4', 4, 64, null, {m2_nota: 'sin_datos'});
const b350 = placa('MSI B350 TOMAHAWK', 'AM4', 'B350', 'DDR4', 4, 64, [['2280', 3, 4, 'ps']]);
const x870 = placa('ASUS TUF GAMING X870-PLUS', 'AM5', 'X870', 'DDR5', 4, 192, [['2280', 5, 4, 'p']], {anio: 2024});
const z890 = placa('ASUS PRIME Z890-P', 'LGA 1851', 'Z890', 'DDR5', 4, 192, [['2280', 5, 4, 'p']]);
const h110d3 = placa('ASRock H110M-DGS R3.0', 'LGA 1151', 'H110', 'DDR3', 2, 32, null);

// ------------------------------------------------------------ las reglas están completas

function pruebaReglas() {
  console.log('Reglas');
  const fams = Object.keys(R.familias);
  for (const z of Object.keys(R.plataformas)) {
    const propias = fams.filter((f) => R.familias[f].plataforma === z);
    for (const [c, d] of Object.entries(R.plataformas[z].chipsets)) {
      comprobar(Object.keys(d.soporte).sort().join() === propias.slice().sort().join(), `${z} ${c}: todas las familias en «soporte»`);
      comprobar((d.fuentes || []).length > 0 && d.fuentes.every((k) => R.fuentes[k]), `${z} ${c}: con fuentes que existen`);
      comprobar(typeof d.ram_oc === 'boolean' && typeof d.cpu_oc === 'boolean', `${z} ${c}: overclock dicho`);
      const modelos = Object.keys(d.soporte_modelo || {});
      comprobar(modelos.every((m) => PC.ORDEN_ESTADOS.indexOf(d.soporte_modelo[m]) >= 0 && d.soporte_modelo[m] !== 'nose'),
        `${z} ${c}: estados por modelo válidos`);
      comprobar(['bios_modelo', 'depende_modelo', 'motivo_modelo'].every((k) => Object.keys(d[k] || {}).every((m) => modelos.indexOf(m) >= 0)),
        `${z} ${c}: los textos por modelo son de modelos con estado propio`);
      comprobar((d.fuentes_modelo || []).every((k) => R.fuentes[k]), `${z} ${c}: fuentes por modelo que existen`);
      comprobar(Object.keys(d.ram_oc_familia || {}).every((k) => propias.indexOf(k) >= 0), `${z} ${c}: memoria por familia de esta plataforma`);
    }
  }
  for (const [k, f] of Object.entries(R.familias)) {
    const tipos = Object.keys(f.ram || {});
    comprobar(tipos.length > 0, `${k}: tipo de memoria`);
    for (const t of tipos) {
      comprobar(f.ram[t].oficial > 0 && (f.ram[t].fuentes || []).every((x) => R.fuentes[x]) && f.ram[t].fuentes.length > 0,
        `${k} ${t}: velocidad oficial con fuente`);
    }
    for (const t of Object.keys(f.optimo || {})) {
      comprobar((f.optimo[t].fuentes || []).length > 0, `${k} ${t}: lo óptimo con fuente`);
    }
    comprobar(f.pcie >= 3 && f.pcie <= 5 && (f.fuentes_pcie || []).every((x) => R.fuentes[x]), `${k}: PCIe con fuente`);
    // se pinta «PCIe 4.0: <texto>», así que el texto no lleva otros dos puntos
    comprobar(!f.pcie_texto || !/:/.test(f.pcie_texto), `${k}: texto de PCIe sin dos puntos`);
    comprobar(!f.nota_placa || ((f.fuentes_nota_placa || []).length > 0 && f.fuentes_nota_placa.every((x) => R.fuentes[x])), `${k}: nota de placa con fuente`);
  }
  for (const [k, f] of Object.entries(R.fuentes)) {
    comprobar(/^https:\/\//.test(f.url) && f.titulo, `fuente ${k}: título y dirección https`);
  }
}

// ------------------------------------------------------------ procesador y placa

function pruebaCpuPlaca() {
  console.log('Procesador y placa');
  const e = (c, p) => PC.cpuEnPlaca(R, c, p).estado;
  comprobar(e(r3600, b550) === 'si', 'Ryzen 3000 en B550: de serie');
  comprobar(e(r5600x, b550) === 'bios', 'Ryzen 5000 en B550: con BIOS');
  comprobar(e(r5600x, b450) === 'bios', 'Ryzen 5000 en B450: con BIOS');
  comprobar(e(r5600x, a320) === 'depende', 'Ryzen 5000 en A320: depende de la placa');
  comprobar(e(r1700, b550) === 'no', 'Ryzen 1000 en B550: no');
  comprobar(/Ryzen 3000/.test(PC.cpuEnPlaca(R, r1700, b550).texto), 'Ryzen 1000 en B550: explica desde dónde empiezan');
  comprobar(e(r3400g, x570) === 'si', 'Ryzen 3400G en X570: sí');
  comprobar(e(a3000g, x570) === 'no', 'Athlon 3000G en X570: no (excepción por modelo)');
  comprobar(e(r5600x, b650) === 'no' && /AM4.*AM5/.test(PC.cpuEnPlaca(R, r5600x, b650).texto), 'otro zócalo: no, y lo dice');
  comprobar(e(r9950x, a620) === 'bios', 'Ryzen 9000 en A620: con BIOS');
  comprobar(PC.cpuEnPlaca(R, r9950x, a620).notas.some((n) => /65 W/.test(n)), 'Ryzen 9950X en A620: aviso de los 65 W');
  comprobar(!PC.cpuEnPlaca(R, r8500g, a620).notas.some((n) => /65 W/.test(n)), '8500G (65 W) en A620: sin aviso de potencia');
  comprobar(PC.cpuEnPlaca(R, r5600x, b550).notas.some((n) => /Flashback/.test(n)), 'BIOS: dice que esta placa tiene Flashback');
  comprobar(e(i12400, z790) === 'si', '12.ª en Z790: sí');
  comprobar(e(i13400, b660) === 'bios', '13.ª en B660: con BIOS');
  comprobar(e(i13600k, b760d4) === 'si', '13.ª en B760: sí');
  comprobar(e(i14600k, b760d4) === 'bios', '14.ª en B760: con BIOS');
  comprobar(e(u265k, z790) === 'no', 'Core Ultra en LGA 1700: no');
  comprobar(e(i8700k, z270) === 'no' && /300/.test(PC.cpuEnPlaca(R, i8700k, z270).texto), '8.ª en Z270: no, y explica lo del mismo zócalo');
  comprobar(e(i6600k, z270) === 'si', '6.ª en Z270: sí');
  comprobar(e(i7600k, b150) === 'bios', '7.ª en B150: con BIOS');
  comprobar(e(i6600k, z390) === 'no', '6.ª en Z390: no');
  comprobar(e(i11700k, b460) === 'no', '11.ª en B460: no');
  comprobar(e(i11700k, z490) === 'bios', '11.ª en Z490: con BIOS');
  comprobar(e(i10400, b560) === 'si', '10.ª en B560: sí');
  comprobar(e(nuevo, z990) === 'nose' && /nueva/.test(PC.cpuEnPlaca(R, nuevo, z990).texto), 'zócalo nuevo sin reglas: sin comprobar, y lo dice');
  comprobar(e(cpu('x', 'Raro', 'AM4', null, null), b550) === 'nose', 'familia desconocida: sin comprobar');
  comprobar(e(r5600x, placa('Rara', 'AM4', 'Z999', 'DDR4', 4, 64, null)) === 'nose', 'chipset desconocido: sin comprobar');

  // casos que AMD no pone en sus tablas, y modelos que van distinto que su familia
  const t = (c, p) => PC.cpuEnPlaca(R, c, p).texto;
  comprobar(e(r1700, b450) === 'depende' && /tabla/.test(t(r1700, b450)), 'Ryzen 1000 en B450: depende (AMD no lo pone en su tabla)');
  comprobar(e(r2400g, b450) === 'depende', 'Ryzen 2000G en B450: depende');
  comprobar(e(r2600, b450) === 'si', 'Ryzen 2000 en B450: de serie');
  comprobar(PC.cpuEnPlaca(R, r2600, b450).notas.some((n) => /Ryzen 5000/.test(n)), 'Ryzen 2000 en B450: avisa de que la BIOS nueva puede quitarlo');
  comprobar(e(r2600, b350) === 'bios', 'Ryzen 2000 en B350: con BIOS');
  comprobar(e(a200ge, b350) === 'depende' && /Athlon/.test(t(a200ge, b350)), 'Athlon 200GE en B350: depende (por modelo), y dice por qué');
  comprobar(e(r2400g, b350) === 'bios', 'Ryzen 2000G en B350: con BIOS (la excepción es solo de los Athlon)');
  comprobar(e(r1600af, x570) === 'depende' && /1600 AF|oficial/.test(t(r1600af, x570)), '1600 AF en X570: depende');
  comprobar(/Athlon con gráfica/.test(t(a3000g, x570)), 'Athlon 3000G en X570: dice por qué no');
  // AMD no los da por oficiales, pero algunos fabricantes sí (MSI A520M-A PRO, Gigabyte B550 AORUS ELITE AX V2)
  comprobar(e(r3400g, b550) === 'depende' && /se llamen 3000/.test(t(r3400g, b550)) && /A520M-A PRO/.test(t(r3400g, b550)),
    '3400G en B550: depende, explica lo del nombre y da ejemplos');
  comprobar(e(a3000g, b550) === 'depende' && /Athlon 3000G/.test(t(a3000g, b550)), 'Athlon 3000G en B550: depende, y lo nombra');
  comprobar(PC.cpuEnPlaca(R, r3400g, b550).fuentes.indexOf('msi-a520m-a-pro') >= 0, '3400G en B550: con la ficha de la placa que lo admite');
  // X570: los Ryzen 2000G según la placa; los Athlon con gráfica, no
  comprobar(e(r2400g, x570) === 'depende' && /Strix X570-E/.test(t(r2400g, x570)), '2400G en X570: depende (algunas placas sí)');
  comprobar(e(a200ge, x570) === 'no' && /Athlon/.test(t(a200ge, x570)), 'Athlon 200GE en X570: no');
  comprobar(e(a3000g, x570) === 'no', 'Athlon 3000G en X570: no');
  comprobar(e(a3000g, b450) === 'depende' && /tabla del B450/.test(t(a3000g, b450)), 'Athlon 3000G en B450: depende (no está en la tabla de AMD)');
  comprobar(/GT/.test(PC.grafica(R, r5600x, null).texto), 'sin gráfica en AM4: nombra los GT');
  comprobar(e(r7800x3d, b650) === 'bios' && /AGESA 1\.0\.0\.5c/.test(t(r7800x3d, b650)), '7800X3D en B650: con BIOS (AGESA 1.0.0.5c)');
  comprobar(PC.cpuEnPlaca(R, r7800x3d, b650).fuentes.indexOf('wccftech-x3d-agesa') >= 0, '7800X3D en B650: con la fuente del AGESA');
  comprobar(e(r7800x3d, x870) === 'si', '7800X3D en X870: de serie');
  comprobar(e(r7600x3d, b650) === 'si' && PC.cpuEnPlaca(R, r7600x3d, b650).notas.some((n) => /2024/.test(n)), '7600X3D en B650 de 2021: de serie, con la nota del año');
  comprobar(PC.cpuEnPlaca(R, i13600k, z790).notas.some((n) => /0x12F/.test(n))
    && PC.cpuEnPlaca(R, i13600k, z790).fuentes.indexOf('intel-vmin') >= 0, '13.ª: aviso de la BIOS por la inestabilidad, con fuente');
  comprobar(PC.cpuEnPlaca(R, i14600k, b760d4).notas.some((n) => /0x12F/.test(n)), '14.ª: el mismo aviso');
  comprobar(!PC.cpuEnPlaca(R, i12400, z790).notas.some((n) => /0x12F/.test(n)), '12.ª: sin ese aviso');
  comprobar(!PC.cpuEnPlaca(R, i13600k, z390).notas.length, 'si no encaja, sin notas');
}

// ------------------------------------------------------------ memoria

function pruebaMemoria() {
  console.log('Memoria');
  const e = (k, p) => PC.ramEnPlaca(R, k, p).estado;
  comprobar(e(kit('DDR5', 6000, 30, 2, 16), b550) === 'no', 'DDR5 en placa DDR4: no');
  comprobar(e(kit('DDR4', 3200, 16, 4, 8), a320) === 'no', '4 módulos en placa de 2 ranuras: no');
  comprobar(e(kit('DDR4', 3200, 16, 2, 32), a320) === 'depende', '64 GB en placa de 32 GB máx.: depende');
  comprobar(e(kit('DDR4', 3600, 16, 2, 16), b550) === 'si', 'DDR4 2×16 en B550: sí');
  comprobar(PC.ramEnPlaca(R, kit('DDR4', 3600, 16, 2, 16), b550).notas.some((n) => /A2 y B2/.test(n)), '2 módulos en 4 ranuras: dónde ponerlos');
  comprobar(PC.ramEnPlaca(R, kit('DDR4', 3200, 16, 1, 16), b550).notas.some((n) => /un canal/.test(n)), 'un solo módulo: aviso del canal');
  comprobar(PC.ramConCpu(R, kit('DDR4', 3200, 16, 2, 16), u265k).estado === 'no', 'DDR4 con Core Ultra: no');
  comprobar(PC.ramConCpu(R, kit('DDR4', 3200, 16, 2, 16), i12400).estado === 'si', 'DDR4 con 12.ª: sí');

  // velocidades
  let v = PC.velocidad(R, {cpu: r5600x, placa: b550, ram: kit('DDR4', 3600, 16, 2, 16, 'XMP')});
  comprobar(v.oficial === 3200 && v.ira === 3600, 'Ryzen 5000 + DDR4-3600: oficial 3200, irá a 3600');
  comprobar(v.notas.some((n) => n.tipo === 'aviso' && /overclock/.test(n.texto)), 'por encima de lo oficial: lo avisa');
  comprobar(v.notas.some((n) => n.tipo === 'ok' && /mejor rinde/.test(n.texto)), '3600 CL16 en Zen 3: es lo óptimo');
  comprobar(v.notas.every((n) => n.texto.length > 10), 'notas con texto');
  v = PC.velocidad(R, {cpu: r5600x, placa: b550, ram: kit('DDR4', 3600, 16, 2, 16)});
  comprobar(v.notas.some((n) => /perfil XMP/.test(n.texto)) && !v.notas.some((n) => /EXPO/.test(n.texto)), 'DDR4 en AM4: el perfil es XMP (EXPO es de DDR5)');
  v = PC.velocidad(R, {cpu: r7800x3d, placa: b650, ram: kit('DDR5', 6400, 32, 2, 16)});
  comprobar(v.notas.some((n) => /EXPO o XMP/.test(n.texto)), 'DDR5 en AM5 sin perfil en la ficha: EXPO o XMP');
  v = PC.velocidad(R, {cpu: r5600x, placa: b550, ram: kit('DDR4', 4000, 18, 2, 16)});
  comprobar(v.notas.some((n) => /3600/.test(n.texto) && n.tipo === 'info'), 'DDR4-4000 en Zen 3: se gana poco');
  v = PC.velocidad(R, {cpu: i10400, placa: b460, ram: kit('DDR4', 3200, 16, 2, 8)});
  comprobar(v.ira === 2666 && v.notas.some((n) => n.tipo === 'mal'), 'i5-10400 en B460 con 3200: se queda en 2666');
  v = PC.velocidad(R, {cpu: i10700k, placa: b460, ram: kit('DDR4', 3200, 16, 2, 8)});
  comprobar(v.ira === 2933, 'i7-10700K en B460: 2933 (por gama)');
  v = PC.velocidad(R, {cpu: i8100, placa: z390, ram: kit('DDR4', 2400, 15, 2, 8)});
  comprobar(v.oficial === 2400 && v.ira === 2400, 'i3-8100: oficial 2400 (por gama)');
  v = PC.velocidad(R, {cpu: i13400, placa: z790, ram: kit('DDR5', 6000, 30, 2, 16, 'XMP')});
  comprobar(v.oficial === 4800, 'i5-13400: DDR5-4800 (por modelo)');
  v = PC.velocidad(R, {cpu: i13600k, placa: z790, ram: kit('DDR5', 5600, 36, 2, 16)});
  comprobar(v.oficial === 5600 && v.notas.some((n) => n.tipo === 'ok'), 'i5-13600K con 5600: dentro de lo oficial');
  v = PC.velocidad(R, {cpu: i12400, placa: h610, ram: kit('DDR5', 6000, 30, 2, 16)});
  comprobar(v.ira === 4800, 'H610: la memoria se queda en lo oficial');
  v = PC.velocidad(R, {cpu: r7800x3d, placa: b650, ram: kit('DDR5', 6400, 32, 2, 16, 'EXPO')});
  comprobar(v.notas.some((n) => /6000/.test(n.texto) && n.tipo === 'info'), 'DDR5-6400 en Zen 4: se gana poco');
  v = PC.velocidad(R, {cpu: r7800x3d, placa: b650, ram: kit('DDR5', 6000, 30, 4, 16)});
  comprobar(v.notas.some((n) => /3600/.test(n.texto) && n.tipo === 'aviso'), 'cuatro módulos en AM5: baja a 3600');
  v = PC.velocidad(R, {cpu: r7800x3d, placa: b650, ram: kit('DDR5', 4800, 40, 4, 16)});
  comprobar(v.notas.some((n) => n.tipo === 'aviso' && /overclock/.test(n.texto) && /cuatro módulos/.test(n.texto)),
    'DDR5-4800 en cuatro módulos en AM5: ya pasa de lo oficial (3600)');
  v = PC.velocidad(R, {placa: b460});
  comprobar(v.notas.some((n) => n.tipo === 'aviso' && /que pongas/.test(n.texto)), 'placa B460 sola: avisa de que la memoria no sube');
  v = PC.velocidad(R, {placa: b460, ram: kit('DDR4', 3600, 16, 2, 8)});
  comprobar(v.notas.some((n) => n.tipo === 'aviso' && /B460/.test(n.texto)), 'B460 con memoria y sin procesador: avisa igual');
  v = PC.velocidad(R, {cpu: r1700, placa: b450, ram: kit('DDR4', 3200, 16, 4, 8)});
  comprobar(v.notas.some((n) => /cuatro módulos/.test(n.texto)), 'cuatro módulos sin cifra oficial: aviso general');
  v = PC.velocidad(R, {cpu: i12400});
  comprobar(v.tipo === null, '12.ª sin placa: no sabe si DDR4 o DDR5');
  v = PC.velocidad(R, {placa: b650});
  comprobar(v.tipo === 'DDR5' && v.optimo && v.optimo.velocidad === 6000, 'placa AM5 sola: lo óptimo de la plataforma');
  v = PC.velocidad(R, {placa: b550});
  comprobar(v.notas.some((n) => /elígelo/.test(n.texto)), 'placa AM4 sola: pide el procesador');

  // B560 y H570: con un Core de 10.ª la memoria no sube; con uno de 11.ª, sí
  v = PC.velocidad(R, {cpu: i10400, placa: b560, ram: kit('DDR4', 3200, 16, 2, 8)});
  comprobar(v.ira === 2666 && v.notas.some((n) => n.tipo === 'mal' && /con este procesador en una placa B560, /.test(n.texto)), 'B560 con 10.ª: la memoria se queda en lo oficial');
  v = PC.velocidad(R, {cpu: i10400, placa: b460});
  comprobar(v.notas.some((n) => /^Con el chipset B460, /.test(n.texto)), 'B460: el aviso habla del chipset');
  v = PC.velocidad(R, {cpu: i10400, placa: b560});
  comprobar(v.notas.some((n) => n.tipo === 'aviso' && /^Con este procesador en una placa B560, /.test(n.texto)), 'B560 con 10.ª sin memoria: lo avisa');
  v = PC.velocidad(R, {cpu: i11700k, placa: b560, ram: kit('DDR4', 3600, 16, 2, 8, 'XMP')});
  comprobar(v.ira === 3600 && v.notas.some((n) => n.tipo === 'aviso' && /overclock/.test(n.texto)), 'B560 con 11.ª: la memoria sí sube');
  comprobar(PC.ramRecomendada(R, {placa: b560, cpu: i10400}, [kit('DDR4', 2666, 19, 2, 8), kit('DDR4', 3600, 16, 2, 8)]).objetivo === 2666,
    'recomendada en B560 con 10.ª: lo oficial');
  // placas DDR3 de la 6.ª y la 7.ª generación
  v = PC.velocidad(R, {cpu: i6600k, placa: h110d3});
  comprobar(v.tipo === 'DDR3' && v.oficial === 1600 && v.notas.some((n) => /DDR3L/.test(n.texto)), 'placa DDR3 con 6.ª: DDR3L a 1600');
  comprobar(PC.ramEnPlaca(R, kit('DDR4', 2400, 16, 2, 8), h110d3).estado === 'no', 'DDR4 en placa DDR3: no');
  // notas de la memoria que solo valen para algunos modelos
  v = PC.velocidad(R, {cpu: i13600k, placa: z790, ram: kit('DDR5', 5600, 36, 2, 16)});
  comprobar(v.notas.some((n) => /doble cara/.test(n.texto)), 'i5-13600K (5600): nota de los módulos de doble cara');
  v = PC.velocidad(R, {cpu: i13400, placa: z790, ram: kit('DDR5', 4800, 40, 2, 16)});
  comprobar(!v.notas.some((n) => /lo baja a DDR5-5200/.test(n.texto)), 'i5-13400 (4800): sin esa nota');
  // placas de cuatro ranuras: lo que garantiza la ficha técnica de Intel
  comprobar(v.notas.some((n) => /DDR5-4400/.test(n.texto) && n.fuentes.indexOf('intel-13-14-datasheet') >= 0), 'Intel 13.ª en placa de cuatro ranuras: nota del 4400');
  v = PC.velocidad(R, {cpu: i13400, placa: placa('Z790 ITX', 'LGA 1700', 'Z790', 'DDR5', 2, 96, null), ram: kit('DDR5', 4800, 40, 2, 16)});
  comprobar(!v.notas.some((n) => /DDR5-4400/.test(n.texto)), 'Intel 13.ª en placa de dos ranuras: sin esa nota');
  v = PC.velocidad(R, {cpu: i13400, ram: kit('DDR5', 4800, 40, 2, 16)});
  comprobar(v.notas.some((n) => /DDR5-4400/.test(n.texto)), 'Intel 13.ª sin placa: la nota sale (casi todas son de cuatro)');
  v = PC.velocidad(R, {cpu: u265k, placa: z890, ram: kit('DDR5', 6000, 30, 4, 16, 'XMP')});
  comprobar(v.notas.some((n) => /DDR5-4400/.test(n.texto) && n.fuentes.indexOf('intel-200s-datasheet') >= 0), 'Core Ultra con cuatro módulos: 4400 con doble cara');
  // un kit solo EXPO en placa Intel
  v = PC.velocidad(R, {cpu: i13600k, placa: z790, ram: kit('DDR5', 6000, 30, 2, 16, 'EXPO')});
  comprobar(v.notas.some((n) => /solo trae perfil EXPO/.test(n.texto)) && !v.notas.some((n) => /perfil XMP/.test(n.texto)), 'kit solo EXPO en Intel: lo avisa y no habla de XMP');
  v = PC.velocidad(R, {cpu: r7800x3d, placa: b650, ram: kit('DDR5', 6000, 30, 2, 16, 'EXPO')});
  comprobar(!v.notas.some((n) => /solo trae perfil EXPO/.test(n.texto)), 'kit solo EXPO en AMD: sin aviso');
  // 11.ª generación en placa 400
  comprobar(PC.cpuEnPlaca(R, i11700k, placa('MSI Z490-A PRO', 'LGA 1200', 'Z490', 'DDR4', 4, 128, null)).notas.some((n) => /DDR4-2933/.test(n)),
    '11.ª en Z490: la memoria oficial es 2933');
  v = PC.velocidad(R, {cpu: r3400g, placa: b450, ram: kit('DDR4', 2933, 16, 2, 16)});
  comprobar(v.notas.some((n) => /doble cara/.test(n.texto)), '3400G: nota de los módulos de doble cara');
  v = PC.velocidad(R, {cpu: a3000g, placa: b450});
  comprobar(v.oficial === 2667, 'Athlon 3000G: 2667 (por gama)');
  v = PC.velocidad(R, {cpu: u265k, placa: z890, ram: kit('DDR5', 6400, 32, 2, 16, 'XMP')});
  comprobar(v.notas.some((n) => /200S Boost/.test(n.texto)) && v.notas.some((n) => n.fuentes.indexOf('intel-200s-boost') >= 0),
    'Core Ultra 200S en Z890: nota del 200S Boost, con fuente');

  const kits = [kit('DDR5', 6000, 30, 2, 16), kit('DDR5', 6000, 36, 2, 32), kit('DDR5', 6000, 28, 2, 64), kit('DDR5', 6400, 32, 2, 16),
    kit('DDR5', 4800, 40, 2, 8), kit('DDR4', 3600, 16, 2, 16)];
  let rec = PC.ramRecomendada(R, {placa: b650, cpu: r7800x3d}, kits);
  comprobar(rec.objetivo === 6000 && rec.kits.length === 3 && rec.kits[0].cl === 28 && rec.kits.every((k) => k.velocidad === 6000),
    'recomendada en AM5: solo DDR5-6000, la CL más baja primero');
  rec = PC.ramRecomendada(R, {placa: a620, cpu: r7800x3d}, kits);
  comprobar(rec.kits.every((k) => k.modulos * k.gb <= 96), 'recomendada: que quepa en la placa');
  rec = PC.ramRecomendada(R, {placa: h610, cpu: i12400}, kits);
  comprobar(rec.objetivo === 4800 && rec.kits.length === 1, 'recomendada sin overclock de memoria: lo oficial');
  rec = PC.ramRecomendada(R, {cpu: i12400}, kits);
  comprobar(rec.kits.length === 0, 'recomendada sin saber el tipo: nada');
}

// ------------------------------------------------------------ SSD

function pruebaSsd() {
  console.log('SSD M.2');
  const s990 = ssd('Samsung 990 Pro', '2280', 4, 4, 'nvme');
  const t705 = ssd('Crucial T705', '2280', 5, 4, 'nvme');
  const mx500 = ssd('Crucial MX500 M.2', '2280', 0, 0, 'sata');
  const largo = ssd('Micron 7450 22110', '22110', 4, 4, 'nvme');
  const corto = ssd('WD SN770M', '2230', 4, 4, 'nvme');
  let r = PC.ssdEnPlaca(R, s990, b550, r5600x);
  comprobar(r.estado === 'si' && r.mejor === 1, '990 Pro en B550 con Ryzen 5000: a tope en el M.2 1');
  r = PC.ssdEnPlaca(R, s990, b550, r5600g);
  comprobar(r.estado === 'depende' && r.notas.some((n) => /PCIe 3\.0/.test(n.texto)), 'con un 5600G: va a PCIe 3.0, y lo explica');
  r = PC.ssdEnPlaca(R, s990, x570, r5600g);
  comprobar(r.estado === 'depende' && r.huecos[0].dudas.indexOf('cpu') >= 0 && /PCIe 3\.0/.test(r.texto),
    'X570 con 5600G: no sé qué M.2 es el de la CPU (a 3.0), y lo dice');
  comprobar(PC.ssdEnPlaca(R, s990, x570, r5600x).estado === 'si', 'X570 con 5600X: a tope');
  r = PC.ssdEnPlaca(R, mx500, b550, null);
  comprobar(r.estado === 'si' && r.mejor === 2, 'SATA M.2 en B550: solo en el M.2 2');
  r = PC.ssdEnPlaca(R, mx500, z790, null);
  comprobar(r.estado === 'depende' && /SATA/.test(r.texto), 'SATA M.2 en huecos que la ficha da solo como PCIe: depende');
  r = PC.ssdEnPlaca(R, s990, placa('Solo SATA', 'AM4', 'B450', 'DDR4', 4, 64, [['2280', 3, 4, 's']]), null);
  comprobar(r.estado === 'no' && /SATA/.test(r.texto), 'NVMe en un hueco solo SATA: no, y dice por qué');
  r = PC.ssdEnPlaca(R, t705, placa('Sin generación', 'AM4', 'B450', 'DDR4', 4, 64, [['2280', 0, 4, 'p']]), null);
  comprobar(r.estado === 'depende' && r.huecos[0].real === 3 && !/a PCIe/.test(r.texto), 'hueco sin generación: como mucho lo del chipset, sin prometer velocidad');
  r = PC.ssdEnPlaca(R, largo, b550, null);
  comprobar(r.estado === 'si' && r.mejor === 1, '22110: solo en el hueco que lo admite');
  r = PC.ssdEnPlaca(R, largo, z790, null);
  comprobar(r.estado === 'no' && /22110/.test(r.texto), '22110 sin hueco largo: no, y dice por qué');
  r = PC.ssdEnPlaca(R, t705, b550, r5600x);
  comprobar(r.estado === 'depende' && /PCIe 4\.0/.test(r.texto), 'PCIe 5.0 en hueco 4.0: funciona, más lento');
  r = PC.ssdEnPlaca(R, t705, z790, i12400);
  comprobar(r.estado === 'si', 'PCIe 5.0 en Z790: a tope');
  comprobar(PC.notasM2(R, z790, i12400).some((n) => /x8/.test(n.texto)), 'LGA 1700 con M.2 5.0: aviso de la gráfica a x8');
  r = PC.ssdEnPlaca(R, s990, b560, i10400);
  comprobar(r.huecos[0].cabe === false && r.mejor === 2, '10.ª en B560: el M.2 de la CPU no funciona');
  comprobar(PC.notasM2(R, b560, i10400).some((n) => /10\.ª/.test(n.texto)), '10.ª en B560: lo explica');
  r = PC.ssdEnPlaca(R, s990, b560, i11700k);
  comprobar(r.huecos[0].cabe === true && r.huecos[0].real === 4, '11.ª en B560: el M.2 de la CPU a 4.0');
  r = PC.ssdEnPlaca(R, s990, a520, r5600x);
  comprobar(r.huecos[0].real === 3, 'A520: nada de PCIe 4.0');
  const b840gen5 = placa('B840 con un hueco 5.0 en la ficha', 'AM5', 'B840', 'DDR5', 2, 128, [['2280', 5, 4, 'p']]);
  r = PC.ssdEnPlaca(R, t705, b840gen5, r7800x3d);
  comprobar(r.huecos[0].real === 4 && r.notas.some((n) => /B840/.test(n.texto)), 'B840: el M.2 de la CPU se queda en 4.0, y lo explica');
  r = PC.ssdEnPlaca(R, corto, b550, null);
  comprobar(r.estado === 'depende' && /2230/.test(r.texto), '2230 en huecos 2242 o más largos: depende, y dice por qué');
  r = PC.ssdEnPlaca(R, corto, placa('Solo 2280', 'AM4', 'B450', 'DDR4', 4, 64, [['2280', 3, 4, 'p']]), null);
  comprobar(r.estado === 'depende', '2230 en hueco 2280: depende (casi todas llevan la posición)');
  r = PC.ssdEnPlaca(R, s990, b560, i10400);
  comprobar(!r.notas.some((n) => /Ojo/.test(n.texto)), '10.ª en B560: sin la nota de velocidad del M.2 que no funciona');

  // Samsung 990 EVO y 990 EVO Plus: PCIe 5.0 x2 o PCIe 4.0 x4, lo mismo de rápido
  const evo = ssd('Samsung 990 EVO Plus', '2280', 5, 2, 'nvme');
  r = PC.ssdEnPlaca(R, evo, placa('Hueco 4.0', 'AM4', 'B550', 'DDR4', 4, 128, [['2280', 4, 4, 'p']]), null);
  comprobar(r.estado === 'si' && /toda su velocidad \(PCIe 4\.0 x4\)/.test(r.texto)
    && r.notas.some((n) => n.fuentes.indexOf('samsung-990-evo-plus') >= 0), `990 EVO Plus en hueco 4.0 x4: a tope, y lo explica (${r.texto})`);
  r = PC.ssdEnPlaca(R, evo, placa('Hueco 5.0', 'AM5', 'X670E', 'DDR5', 4, 192, [['2280', 5, 4, 'p']]), null);
  comprobar(r.estado === 'si' && /PCIe 5\.0 x2/.test(r.texto), `990 EVO Plus en hueco 5.0: a tope (${r.texto})`);
  r = PC.ssdEnPlaca(R, evo, placa('Hueco 3.0', 'AM4', 'B450', 'DDR4', 4, 64, [['2280', 3, 4, 'p']]), null);
  comprobar(r.estado === 'depende' && /PCIe 3\.0 x4/.test(r.texto) && /doble/.test(r.texto), `990 EVO Plus en hueco 3.0: va a 3.0 x4 (${r.texto})`);
  r = PC.ssdEnPlaca(R, evo, placa('Hueco 4.0 x2', 'AM5', 'B650', 'DDR5', 4, 192, [['2280', 4, 2, 'p']]), null);
  comprobar(r.estado === 'depende' && /PCIe 4\.0 x2/.test(r.texto), `990 EVO Plus en hueco 4.0 x2: la mitad (${r.texto})`);
  r = PC.ssdEnPlaca(R, s990, placa('Hueco x2', 'AM5', 'B650', 'DDR5', 4, 192, [['2280', 4, 2, 'p']]), null);
  comprobar(r.estado === 'depende' && /x2/.test(r.texto), '4.0 x4 en hueco x2: no a tope');
  r = PC.ssdEnPlaca(R, ssd('WD SN520', '2280', 3, 2, 'nvme'), placa('Hueco 4.0', 'AM4', 'B550', 'DDR4', 4, 128, [['2280', 4, 4, 'p']]), null);
  comprobar(r.estado === 'si' && /PCIe 3\.0 x2/.test(r.texto), `SSD x2 en hueco x4: a tope, con sus dos carriles (${r.texto})`);
  r = PC.ssdEnPlaca(R, ssd('Sin velocidad', '2280', 0, 0, 'nvme'), b550, null);
  comprobar(r.estado === 'si' && /no dice su velocidad/.test(r.texto), 'NVMe sin velocidad en la ficha: lo dice');
  comprobar(PC.ssdEnPlaca(R, ssd('Samsung 990 Pro w/Heatsink', '2280', 4, 4, 'nvme', {disipador: 1}), b550, null).notas.some((n) => /disipador/.test(n.texto)),
    'SSD con disipador: avisa');
  comprobar(!PC.ssdEnPlaca(R, s990, b550, null).notas.some((n) => /disipador/.test(n.texto)), 'SSD sin disipador: sin aviso');
  comprobar(!PC.ssdEnPlaca(R, s990, b550, null).notas.some((n) => /PCIe 4\.0 x4 que en uno/.test(n.texto)), 'la nota de los 990 EVO, solo para ellos');
  r = PC.ssdEnPlaca(R, t705, b650, null);
  comprobar(r.notas.some((n) => /se calientan/.test(n.texto) && n.fuentes.indexOf('crucial-t700') >= 0), 'PCIe 5.0 sin disipador: que vaya bajo el de la placa');
  r = PC.ssdEnPlaca(R, ssd('Crucial T705 w/Heatsink', '2280', 5, 4, 'nvme', {disipador: 1}), b650, null);
  comprobar(r.notas.some((n) => /disipador propio/.test(n.texto)) && !r.notas.some((n) => /se calientan/.test(n.texto)), 'PCIe 5.0 con disipador: solo el aviso del disipador');
  comprobar(!PC.ssdEnPlaca(R, evo, b650, null).notas.some((n) => /se calientan/.test(n.texto)), '990 EVO (5.0 x2): sin el aviso de calor');
  // notas de la placa revisada a mano
  const corregida = placa('MSI MAG B550 TOMAHAWK', 'AM4', 'B550', 'DDR4', 4, 128, [['2280', 4, 4, 'ps']],
    {notas_m2: ['Con el M.2_2 ocupado, se apagan los SATA 5 y 6.'], fuente: 'https://www.msi.com/x'});
  const nm = PC.notasM2(R, corregida, null);
  comprobar(nm.some((n) => /SATA 5 y 6/.test(n.texto) && n.fuentes[0] === 'https://www.msi.com/x') && !nm.some((n) => /Algunos M\.2 comparten/.test(n.texto)),
    'placa revisada: sus notas de M.2 con su ficha, sin la genérica');
  comprobar(PC.notasM2(R, b550, null).some((n) => /Algunos M\.2 comparten/.test(n.texto)), 'placa sin revisar: la nota genérica');
  r = PC.ssdEnPlaca(R, s990, sinDatos, null);
  comprobar(r.estado === 'nose' && /no trae/.test(r.texto), 'placa sin huecos en la ficha: no lo sé');
  r = PC.ssdEnPlaca(R, s990, z270, null);
  comprobar(r.estado === 'nose' && /relleno/.test(r.texto), 'ficha de plantilla: no me fío');
}

// ------------------------------------------------------------ dónde comprarlo

function pruebaCompra() {
  console.log('Dónde comprarlo');
  const q = (tipo, nombre, extra) => PC.textoBusqueda(tipo, Object.assign({nombre: nombre}, extra || {}));
  comprobar(q('placas', 'Gigabyte B550 AORUS ELITE AX V2 DDR4 ATX', {zocalo: 'AM4', ram: 'DDR4'}) === 'Gigabyte B550 AORUS ELITE AX V2', 'placa: sin «DDR4 ATX»');
  comprobar(q('placas', 'MSI PRO B760M-A WIFI LGA1700 DDR4 Micro-ATX', {zocalo: 'LGA 1700', ram: 'DDR4'}) === 'MSI PRO B760M-A WIFI DDR4', 'placa LGA 1700 DDR4: conserva el DDR4');
  comprobar(q('placas', 'MSI PRO B760M-A WIFI LGA1700 DDR5 Micro-ATX', {zocalo: 'LGA 1700', ram: 'DDR5'}) === 'MSI PRO B760M-A WIFI', 'placa LGA 1700 DDR5: el nombre a secas');
  comprobar(q('placas', 'ASUS PRIME B460M-A LGA 1200 Intel B460 SATA 6Gb/s Micro ATX Intel Motherboard', {zocalo: 'LGA 1200', ram: 'DDR4'}) === 'ASUS PRIME B460M-A', 'placa: corta en el zócalo');
  comprobar(q('placas', 'MSI MAG B550 TOMAHAWK', {zocalo: 'AM4', ram: 'DDR4'}) === 'MSI MAG B550 TOMAHAWK', 'placa con nombre limpio: igual');
  comprobar(q('ssd', 'Samsung 990 Pro w/Heatsink 1TB SSD M.2 PCIe 4.0 NVMe', {gb: 1000}) === 'Samsung 990 Pro Heatsink 1TB', 'SSD: sin «SSD M.2 PCIe…»');
  comprobar(q('ssd', 'SAMSUNG 970 EVO PLUS M.2 2280 1TB PCIe Gen 3.0 x4', {gb: 1000}) === 'SAMSUNG 970 EVO PLUS 1TB', 'SSD: si el corte se lleva la capacidad, la vuelve a poner');
  comprobar(q('ram', 'Corsair Vengeance RGB DDR5-6000 CL30 32GB (2x16GB)') === 'Corsair Vengeance RGB DDR5-6000 CL30 32GB 2x16GB', 'memoria: sin paréntesis');
  comprobar(q('cpu', 'AMD Ryzen 5 5600') === 'AMD Ryzen 5 5600', 'procesador: el nombre');

  let e = PC.enlacesCompra('cpu', {nombre: 'AMD Ryzen 5 5600', amazon: 'B09VCHR1VH'});
  const amazon = e.tiendas.find((x) => x.tienda === 'Amazon');
  comprobar(amazon.exacto && amazon.url === 'https://www.amazon.es/dp/B09VCHR1VH', 'Amazon: la ficha exacta si BuildCores da el código');
  comprobar(e.comparadores.map((x) => x.tienda).join() === 'idealo,Google Shopping', 'comparadores: idealo y Google Shopping');
  comprobar(e.tiendas.map((x) => x.tienda).join() === 'Amazon,PcComponentes,MediaMarkt,LDLC,Alternate,Neobyte', 'tiendas: grandes y de componentes');
  comprobar(e.tiendas.find((x) => x.tienda === 'PcComponentes').url === 'https://www.pccomponentes.com/search/?query=AMD%20Ryzen%205%205600', 'PcComponentes: su buscador');
  comprobar(e.tiendas.find((x) => x.tienda === 'LDLC').url === 'https://www.ldlc.com/es-es/buscar/AMD%20Ryzen%205%205600/', 'LDLC: la búsqueda va en la ruta');
  e = PC.enlacesCompra('cpu', {nombre: 'AMD Ryzen 5 5600', amazon: ''});
  comprobar(!e.tiendas[0].exacto && /amazon\.es\/s\?k=/.test(e.tiendas[0].url), 'Amazon sin código: su buscador');
  comprobar(e.tiendas.concat(e.comparadores).every((x) => /^https:\/\//.test(x.url) && !/tag=|affid|ref=/.test(x.url)), 'todo https y sin afiliados');
  e = PC.enlacesCompra('ram', {nombre: 'Kit "raro" & <b>', amazon: ''});
  comprobar(e.tiendas.every((x) => !/[<>" ]/.test(x.url)), 'nombres raros: bien escapados en la dirección');
}

// ------------------------------------------------------------ gráfica, listas y búsqueda

function pruebaResto() {
  console.log('Gráfica, listas y búsqueda');
  comprobar(PC.grafica(R, r5600g, b550).estado === 'si' && /HDMI/.test(PC.grafica(R, r5600g, b550).texto), '5600G: con gráfica y salidas de la placa');
  comprobar(PC.grafica(R, r5600x, null).estado === 'no' && /acabados en G/.test(PC.grafica(R, r5600x, null).texto), '5600X: sin gráfica, explica lo de la G');
  comprobar(PC.grafica(R, i12400f, null).estado === 'no' && /F/.test(PC.grafica(R, i12400f, null).texto), '12400F: sin gráfica, explica lo de la F');
  comprobar(/2 núcleos/.test(PC.grafica(R, r7800x3d, null).texto), 'Ryzen 7000: la gráfica justa');
  // salidas de vídeo: las tiene, no las tiene (confirmado) o la ficha no dice ninguna
  const sinSaber = placa('Placa sin salidas en la ficha', 'AM4', 'B550', 'DDR4', 4, 128, null, {video: null});
  const sinSalidas = placa('Placa sin salidas', 'AM4', 'X570', 'DDR4', 4, 128, null, {video: []});
  const gs = PC.grafica(R, r5600g, sinSaber);
  comprobar(gs.estado === 'si' && /no dice ninguna/.test(gs.texto) && /antes de comprar/.test(gs.texto), '5600G con placa sin salidas en la ficha: avisa de mirarlo');
  const gn = PC.grafica(R, r5600g, sinSalidas);
  comprobar(gn.estado === 'depende' && /necesitas tarjeta gráfica/.test(gn.texto), '5600G con placa sin salidas: hace falta tarjeta');
  comprobar(/si la placa tiene salidas/.test(PC.grafica(R, r5600g, null).texto), '5600G sin placa: depende de las salidas de la placa');
  comprobar(PC.grafica(R, r5600x, sinSalidas).estado === 'no', '5600X: sin gráfica, con cualquier placa');

  const cpus = [r5600x, r3600, r1700, r5600g, r3400g, a3000g, r7800x3d, i12400];
  const grupos = PC.cpusParaPlaca(R, cpus, b550);
  comprobar(grupos.map((g) => g.estado).join() === 'si,bios,depende,no', `B550: grupos si, bios, depende y no (${grupos.map((g) => g.estado)})`);
  comprobar(grupos[0].familias[0].cpus[0] === r3600, 'B550: el 3600 de serie');
  comprobar(grupos[1].familias[0].clave === 'cezanne', 'B550: lo más nuevo primero');
  const porChipset = PC.placasParaCpu(R, [b550, b450, a320, x570, b650], r5600x);
  comprobar(porChipset.length === 4 && porChipset[0].estado === 'bios' && porChipset[porChipset.length - 1].estado === 'depende',
    `placas para el 5600X: 4 chipsets AM4, ordenados (${porChipset.map((g) => g.chipset + ':' + g.estado)})`);
  const paraRam = PC.placasParaRam(R, [b550, b650, z790, a620, h610], kit('DDR5', 6000, 30, 2, 48));
  comprobar(paraRam.map((g) => g.zocalo).join() === 'AM5,LGA 1700', 'placas para un kit DDR5: AM5 y LGA 1700');
  const lga = paraRam.find((g) => g.zocalo === 'LGA 1700');
  comprobar(paraRam[0].si.length === 2 && paraRam[0].depende.length === 0, 'kit de 96 GB: entra en las dos AM5 (la A620 llega justo a 96)');
  comprobar(lga.si.length === 1 && lga.depende.length === 1 && lga.depende[0] === h610, 'kit de 96 GB: en la H610 de 64 GB, «depende»');
  const paraSsd = PC.placasParaSsd(R, [b550, z790, z270], ssd('Crucial T705', '2280', 5, 4, 'nvme'));
  comprobar(paraSsd.length === 2 && paraSsd.find((g) => g.zocalo === 'LGA 1700').si.length === 1, 'placas para un SSD 5.0: la Z790 a tope');

  const lista = [{nombre: 'AMD Ryzen 5 5600X3D'}, {nombre: 'AMD Ryzen 5 5600X'}, {nombre: 'AMD Ryzen 5 5600XT'}, {nombre: 'Intel Core i5-12400F'},
    {nombre: 'Intel Core i5-12400'}, {nombre: 'MSI MAG B550 TOMAHAWK'}];
  comprobar(PC.buscar(lista, '5600x')[0].nombre === 'AMD Ryzen 5 5600X', 'buscar «5600x»: el 5600X primero');
  comprobar(PC.buscar(lista, 'i5 12400')[0].nombre === 'Intel Core i5-12400', 'buscar «i5 12400»: sin guion y el corto primero');
  comprobar(PC.buscar(lista, 'tomahawk b550').length === 1, 'buscar: palabras en cualquier orden');
  comprobar(PC.buscar(lista, 'x').length === 0, 'buscar: con una letra no busca');
  comprobar(PC.normal('Ryzen™ 7 (Zen 3) Ñ') === 'ryzen 7 zen 3 n', 'normal: sin marcas, signos ni tildes');
  const t = PC.tabla({campos: ['id', 'nombre'], datos: [['a', 'Uno'], ['b', 'Dos']]});
  comprobar(t.length === 2 && t[1].nombre === 'Dos', 'tabla: de filas a objetos');

  const filas = PC.comprobar(R, {placa: b550, cpu: r5600x, ram: kit('DDR5', 6000, 30, 2, 16), ssd: ssd('990', '2280', 4, 4, 'nvme')});
  comprobar(filas.length === 4 && filas.some((f) => f.que === 'Memoria y placa' && f.estado === 'no'), 'veredicto: la DDR5 en B550 no encaja');
}

// ------------------------------------------------------------ gráfica, fuente, caja y disipador (con reglas de prueba)

// Reglas inventadas para probar la lógica sin depender de las cifras reales (esas tienen su prueba aparte).
function reglasDePrueba() {
  const RG = JSON.parse(JSON.stringify(R));
  RG.graficas = {
    chips: {
      'GeForce RTX 4060': {marca: 'NVIDIA', pcie: [4, 8], consumo: 115, psu: 550, ref: [0, 1, 0], adaptador: null, fuentes: ['f-4060']},
      'GeForce RTX 4090': {marca: 'NVIDIA', pcie: [4, 16], consumo: 450, psu: 850, ref: [0, 0, 1], adaptador: 3, fuentes: ['f-4090']},
      'GeForce RTX 5060 Ti': {marca: 'NVIDIA', pcie: [5, 8], consumo: 180, psu: 450, ref: [0, 1, 0], adaptador: null, fuentes: []},
      'Radeon RX 6500 XT': {marca: 'AMD', pcie: [4, 4], consumo: 107, psu: 400, ref: [1, 0, 0], adaptador: null, fuentes: []},
      'Arc B580': {marca: 'Intel', pcie: [4, 8], consumo: 190, psu: null, ref: [0, 1, 0], rebar: true, fuentes: []},
      'GeForce GT 1030': {marca: 'NVIDIA', pcie: [3, 4], consumo: 30, psu: 300, ref: [0, 0, 0], fuentes: []},
    },
    rendimiento: [
      {hasta: 4, tipo: 'aviso', texto: 'Con x4 en PCIe 3.0 se pierde bastante.', fuentes: ['f-x4']},
      {hasta: 8, tipo: 'info', texto: 'Con x8 en PCIe 3.0 se pierde algo.', fuentes: []},
      {hasta: 16, tipo: 'info', texto: 'Casi no se nota.', fuentes: []},
    ],
    rebar: {familias: ['comet', 'rocket', 'alder', 'raptor', 'raptor_r', 'arrow', 'arrow_r', 'matisse', 'vermeer', 'cezanne', 'raphael', 'phoenix', 'granite'],
      texto_pide: 'Pide Resizable BAR.', texto_si: 'Este procesador tiene Resizable BAR.', texto_no: 'Este procesador no tiene Resizable BAR.', fuentes: ['f-rebar']},
    adaptador: {texto: 'Usa cables separados.', fuentes: []},
    potencia: {fuentes: []},
    compatible: {fuentes: []},
  };
  const ch = (z, c) => RG.plataformas[z].chipsets[c];
  ch('AM4', 'B450').grafica = 3;
  ch('AM4', 'A520').grafica = 3;
  ch('AM4', 'B550').grafica = 4;
  ch('AM4', 'X570').grafica = 4;
  ch('AM5', 'B650').grafica = [4, 5];
  ch('LGA 1700', 'Z790').grafica = 5;
  RG.familias.vermeer.grafica = {gen: 4, carriles: 16};
  RG.familias.matisse.grafica = {gen: 4, carriles: 16};
  RG.familias.cezanne.grafica = {gen: 3, carriles: 16};
  RG.familias.raphael.grafica = {gen: 5, carriles: 16};
  RG.familias.phoenix.grafica = {gen: 4, carriles: 8, por_modelo: {'ryzen-5-8500g': [4, 4]}};
  RG.familias.alder.grafica = {gen: 5, carriles: 16};
  RG.graficas.margen = {texto: 'Ya lleva margen.', fuentes: ['f-margen']};
  RG.graficas.cable16 = {texto: 'Cable de 600 W.', fuentes: []};
  RG.cpu_consumo = {amd_factor: 1.35, fuentes_amd: ['f-ppt'],
    intel: [{familias: ['raptor', 'raptor_r'], gamas: ['i5'], sufijos: [''], modelos: ['13400', '14400'], pl2: 148, fuentes: ['f-ark']},
      {familias: ['raptor', 'raptor_r'], gamas: ['i5'], sufijos: ['K'], pl2: 181, fuentes: []},
      {familias: ['arrow_r'], gamas: ['u7'], sufijos: ['K'], pl2: 250, fuentes: []}],
    intel_factor: [{familias: ['coffee', 'coffee_r'], factor: 1.25, fuentes: []}]};
  RG.cajas = {sfx_en_atx: {texto: 'Con soporte.', fuentes: []}, ranuras: {texto: '', fuentes: []}};
  RG.disipadores = {
    grupos: [{zocalos: ['LGA 1700', 'LGA 1851'], texto: 'Mismo anclaje 1700/1851.', fuentes: []},
      {zocalos: ['LGA 115x', 'LGA 1151', 'LGA 1200'], texto: 'Mismo anclaje 115x/1200.', fuentes: []}],
    am4_en_am5: {texto: 'AMD dice que valen.', fuentes: []},
    am5_en_am4: {texto: 'Debería valer.', fuentes: []},
    kit: {texto: 'Hace falta el kit.', fuentes: ['f-kit']},
  };
  return RG;
}

function gpu(nombre, chip, extra) {
  return Object.assign({id: nombre, nombre: nombre, chip: chip, marca: 'NVIDIA', gb: 8, largo: 250, ranuras: 2, tdp: null, conectores: null, pcie: null, amazon: ''}, extra || {});
}

function psu(nombre, vatios, pcie, extra) {
  return Object.assign({id: nombre, nombre: nombre, vatios: vatios, formato: 'ATX', largo: 160, pcie: pcie, modular: 'total', eficiencia: '80+ Gold', amazon: ''}, extra || {});
}

function caja(nombre, extra) {
  return Object.assign({id: nombre, nombre: nombre, formato: 'ATX Mid Tower', placas: ['Mini-ITX', 'Micro ATX', 'ATX'], psu: ['ATX'],
    gpu_max: 330, disipador_max: 165, psu_max: 200, ranuras: 7, incluida: null, amazon: ''}, extra || {});
}

function disipador(nombre, zocalos, extra) {
  return Object.assign({id: nombre, nombre: nombre, zocalos: zocalos, alto: 155, liquida: 0, radiador: null, amazon: ''}, extra || {});
}

function pruebaPiezasNuevas() {
  console.log('Gráfica, fuente, caja y disipador');
  const RG = reglasDePrueba();
  const g4060 = gpu('RTX 4060 Dual', 'GeForce RTX 4060', {conectores: [0, 1, 0]});
  const g4090 = gpu('RTX 4090 Gaming', 'GeForce RTX 4090', {conectores: [0, 0, 1], largo: 340, ranuras: 3.5});
  const g6500 = gpu('RX 6500 XT Pulse', 'Radeon RX 6500 XT', {marca: 'AMD'});
  const g5060 = gpu('RTX 5060 Ti', 'GeForce RTX 5060 Ti', {conectores: [0, 1, 0]});
  const arc = gpu('Arc B580 LE', 'Arc B580', {marca: 'Intel', conectores: [0, 1, 0]});
  const g1030 = gpu('GT 1030', 'GeForce GT 1030');
  const rara = gpu('Tarjeta rara', 'Chip desconocido', {tdp: 250});

  // --- gráfica y placa
  let r = PC.graficaEnPlaca(RG, g4060, b550, r5600x);
  comprobar(r.estado === 'si' && /toda su velocidad \(PCIe 4\.0 x8\)/.test(r.texto), 'RTX 4060 en B550 con 5600X: a toda velocidad');
  r = PC.graficaEnPlaca(RG, g4060, b450, r5600x);
  comprobar(r.estado === 'si' && /PCIe 3\.0 x8/.test(r.texto) && /la placa \(chipset B450\)/.test(r.texto) && r.notas[0] === 'Con x8 en PCIe 3.0 se pierde algo.',
    'RTX 4060 en B450: a PCIe 3.0 x8 por la placa, con nota');
  r = PC.graficaEnPlaca(RG, g6500, b450, r3600);
  comprobar(r.estado === 'depende' && /PCIe 3\.0 x4/.test(r.texto) && r.fuentes.indexOf('f-x4') >= 0, 'RX 6500 XT en B450: depende (x4 en PCIe 3.0)');
  r = PC.graficaEnPlaca(RG, g4090, a520, r5600g);
  comprobar(r.estado === 'si' && /el procesador y la placa \(A520\) la dejan en PCIe 3\.0 x16/.test(r.texto), 'RTX 4090 con 5600G en A520: limitan los dos (y «la dejan»)');
  r = PC.graficaEnPlaca(RG, g4060, b650, r8500g);
  comprobar(/PCIe 4\.0 x4/.test(r.texto) && /el procesador/.test(r.texto), '8500G: la gráfica va a x4');
  r = PC.graficaEnPlaca(RG, g5060, b650, r7800x3d);
  comprobar(/PCIe 4\.0 x8/.test(r.texto) && /o a PCIe 5\.0 x8 si la placa/.test(r.texto), 'B650: 4.0 o 5.0 según la placa');
  r = PC.graficaEnPlaca(RG, arc, z790, i12400);
  comprobar(r.estado === 'si' && r.notas.indexOf('Este procesador tiene Resizable BAR.') >= 0, 'Arc con 12.ª gen: Resizable BAR');
  r = PC.graficaEnPlaca(RG, arc, z390, i8700k);
  comprobar(r.estado === 'depende' && r.notas.indexOf('Este procesador no tiene Resizable BAR.') >= 0, 'Arc con 8.ª gen: depende (sin Resizable BAR)');
  r = PC.graficaEnPlaca(RG, rara, b550, r5600x);
  comprobar(r.estado === 'si' && /No tengo comprobada la interfaz/.test(r.texto), 'chip sin regla: entra, sin velocidad');
  r = PC.graficaEnPlaca(RG, g4060, Object.assign({}, b550, {x16: 0}), r5600x);
  comprobar(r.estado === 'depende' && /ninguna ranura PCIe x16/.test(r.texto), 'placa sin x16 en la ficha: depende');
  r = PC.graficaEnPlaca(RG, gpu('Con ficha', 'Chip desconocido', {pcie: [3, 16]}), b550, r5600x);
  comprobar(r.estado === 'si' && /toda su velocidad \(PCIe 3\.0 x16\)/.test(r.texto), 'sin regla de chip: usa la interfaz de su ficha');

  // --- gráfica y fuente
  r = PC.graficaConFuente(RG, g4060, psu('550', 550, [2, 0]), r5600x);
  comprobar(r.estado === 'si' && /NVIDIA pide una fuente de 550 W/.test(r.texto) && /llegan/.test(r.texto), 'RTX 4060 con 550 W y dos 6+2: sí');
  comprobar(r.notas.some((n) => /Estimación: en pico, el equipo puede llegar a unos 253-303 W/.test(n)) && r.fuentes.indexOf('f-ppt') >= 0, 'estimación del pico con el PPT de AMD');
  r = PC.graficaConFuente(RG, g4060, psu('450', 450, [1, 0]), r5600x);
  comprobar(r.estado === 'depende' && /^Se queda corta según NVIDIA: pide una fuente de 550 W/.test(r.texto), 'RTX 4060 con 450 W: se queda corta según NVIDIA');
  r = PC.graficaConFuente(RG, g4060, psu('500', 500, [1, 0]), r5600x);
  comprobar(r.estado === 'depende' && /^Justa: NVIDIA pide/.test(r.texto) && r.notas.indexOf('Ya lleva margen.') >= 0, 'RTX 4060 con 500 W (más del 90 %): justa, con el margen');
  r = PC.graficaConFuente(RG, g4090, psu('850', 850, [4, 0]), r7800x3d);
  comprobar(r.estado === 'si' && /adaptador/.test(r.texto) && r.notas.indexOf('Usa cables separados.') >= 0, 'RTX 4090 con 850 W y cuatro 6+2: sí, con adaptador');
  r = PC.graficaConFuente(RG, g4090, psu('1000', 1000, [2, 0]), r7800x3d);
  comprobar(r.estado === 'depende' && /según sus fichas, no llegan/.test(r.texto) && /pide 3 de 8 pines/.test(r.texto) && /^De potencia, bien: NVIDIA/.test(r.texto),
    'RTX 4090 con dos 6+2 (sin comprobar a mano): según las fichas no llegan, y el «Sí» no va delante');
  r = PC.graficaConFuente(RG, Object.assign({}, g4090, {fuente: 'https://x/g', corregidos: ['conectores']}),
    psu('1000 comprobada', 1000, [2, 0], {fuente: 'https://x/f', corregidos: ['pcie']}), r7800x3d);
  comprobar(r.estado === 'no' && /: no llegan\./.test(r.texto) && /^De potencia, bien:/.test(r.texto) && r.fuentes.indexOf('https://x/g') >= 0 && r.fuentes.indexOf('https://x/f') >= 0,
    'RTX 4090 con dos 6+2, las dos comprobadas a mano: no llegan, citando sus fichas');
  r = PC.graficaConFuente(RG, g4090, psu('850 nativa', 850, [2, 1]), r7800x3d);
  comprobar(r.estado === 'si' && !/adaptador/.test(r.texto), 'RTX 4090 con conector de 16 pines: sin adaptador');
  r = PC.graficaConFuente(RG, g4090, psu('400', 400, [2, 0]), r7800x3d);
  comprobar(r.estado === 'no' && /No llega/.test(r.texto) && /570 W/.test(r.texto), 'RTX 4090 con 400 W: no llega');
  r = PC.graficaConFuente(RG, g4090, psu('700', 700, [4, 0]), cpu('ryzen-9-7950x', 'AMD Ryzen 9 7950X', 'AM5', 'raphael', true, {tdp: 170}));
  comprobar(r.estado === 'no' && /No llega: NVIDIA pide una fuente de 850 W/.test(r.texto) && /puede pasar de 730 W/.test(r.texto),
    'por debajo de lo que pide el fabricante y del pico estimado: no');
  r = PC.graficaConFuente(RG, g4090, psu('Solo 16', 1000, [0, 1]), r7800x3d);
  comprobar(r.estado === 'si' && /trae un conector de 16 pines y ninguno de 6\+2/.test(r.texto), 'fuente con solo 16 pines: bien dicho');
  r = PC.graficaConFuente(RG, g4060, psu('550', 550, [2, 0]), r5600x);
  comprobar(/La gráfica lleva un conector de 8 pines y la fuente trae 2 conectores de 6\+2 pines: llegan/.test(r.texto), 'conectores: bien dicho');
  comprobar(PC.textoConectores([1, 1, 0]) === 'un conector de 8 pines y uno de 6 pines' && PC.textoConectores([0, 2, 0]) === '2 conectores de 8 pines',
    'textos de conectores');
  r = PC.graficaConFuente(RG, g1030, psu('300', 300, null), i12400);
  comprobar(r.estado === 'si' && /75 W o menos/.test(r.texto), 'GT 1030: sin conector, con la ranura vale');
  r = PC.graficaConFuente(RG, g4060, psu('sin dato', 650, null), r5600x);
  comprobar(r.estado === 'depende' && /No sé seguro cuántos conectores PCIe trae la fuente/.test(r.texto), 'fuente sin conectores en la ficha: depende');
  r = PC.graficaConFuente(RG, rara, psu('750', 750, [2, 0]), r5600x);
  comprobar(r.estado === 'nose' && /No sé qué conectores/.test(r.texto), 'chip sin regla ni conectores: sin comprobar');
  r = PC.graficaConFuente(RG, g6500, psu('400', 400, [1, 0]), r5600x);
  comprobar(r.estado === 'si' && /No sé qué conectores lleva tu modelo\. La de referencia lleva un conector de 6 pines y la fuente trae un conector de 6\+2 pines: llegan\./.test(r.texto),
    'sin conectores en la ficha: los de la referencia, avisando');
  // con la de referencia, también las de marca de la lista
  RG._conectoresChip = {'Radeon RX 6500 XT': [[1, 0, 0], [0, 1, 0]], 'GeForce RTX 4090': [[0, 0, 1], [0, 0, 2]]};
  r = PC.graficaConFuente(RG, g6500, psu('400', 400, [1, 0]), r5600x);
  comprobar(r.estado === 'si' && /también con los que llevan las versiones de marca/.test(r.texto), 'referencia: llegan también para las de marca');
  RG._conectoresChip['Radeon RX 6500 XT'].push([0, 2, 0]);
  r = PC.graficaConFuente(RG, g6500, psu('400', 400, [1, 0]), r5600x);
  comprobar(r.estado === 'depende' && /con esos llegan, pero hay versiones de marca con 2 conectores de 8 pines y con esas no/.test(r.texto),
    'referencia: si alguna de marca pide más, depende');
  r = PC.graficaConFuente(RG, gpu('4090 sin ficha', 'GeForce RTX 4090'), psu('1000', 1000, [2, 0]), r7800x3d);
  comprobar(r.estado === 'depende' && /con esos no llegarían/.test(r.texto) && /Mira los de tu modelo/.test(r.texto),
    'referencia que no llega: depende, no «no» (falta el dato de la tarjeta)');
  delete RG._conectoresChip;
  r = PC.graficaConFuente(RG, g4060, psu('650', 650, [2, 0]), null);
  comprobar(r.notas.some((n) => /Elige el procesador/.test(n)), 'sin procesador: pide elegirlo para afinar');
  comprobar(PC.consumoCpu(RG, i13600k).w === 181 && PC.consumoCpu(RG, i13400).w === 148 && PC.consumoCpu(RG, i13400).fuentes[0] === 'f-ark',
    'consumo de Intel por gama, sufijo y modelo');
  const i8700k95 = cpu('core-i7-8700k', 'Intel Core i7-8700K', 'LGA 1151', 'coffee', true, {tdp: 95});
  comprobar(PC.consumoCpu(RG, i8700k95).w === 119 && /95 W de TDP × 1,25/.test(PC.consumoCpu(RG, i8700k95).base), 'consumo de 8.ª gen: TDP × 1,25');
  comprobar(PC.consumoCpu(RG, cpu('core-ultra-7-270k-plus', 'Intel Core Ultra 7 270K Plus', 'LGA 1851', 'arrow_r', true, {tdp: 125})).w === 250,
    'consumo de un «K Plus»');
  comprobar(PC.consumoCpu(RG, r5600x).w === 88 && /× 1,35/.test(PC.consumoCpu(RG, r5600x).base), 'consumo de AMD: TDP × 1,35');
  r = PC.graficaConFuente(RG, g4060, psu('450', 450, [1, 0]), r5600x);
  comprobar(r.notas.indexOf('Ya lleva margen.') >= 0 && r.fuentes.indexOf('f-margen') >= 0, 'fuente por debajo de lo que pide: explica el margen');
  const g5090 = gpu('RTX 5090', 'GeForce RTX 5090', {conectores: [0, 0, 1]});
  RG.graficas.chips['GeForce RTX 5090'] = {marca: 'NVIDIA', pcie: [5, 16], consumo: 575, psu: 1000, ref: [0, 0, 1], adaptador: 4, fuentes: []};
  r = PC.graficaConFuente(RG, g5090, psu('1200', 1200, [4, 1]), r7800x3d);
  comprobar(r.estado === 'si' && r.notas.indexOf('Cable de 600 W.') >= 0, 'gráfica de más de 450 W con cable de 16 pines: mira que sea de 600 W');
  r = PC.graficaConFuente(RG, g4090, psu('850 nativa', 850, [2, 1]), r7800x3d);
  comprobar(r.notas.indexOf('Cable de 600 W.') < 0, 'con 450 W o menos, sin aviso del cable');

  // --- caja
  r = PC.graficaEnCaja(RG, g4060, caja('Caja'));
  comprobar(r.estado === 'si' && /Cabe de largo/.test(r.texto) && !r.notas.length, 'gráfica de 250 mm en caja de 330: cabe');
  r = PC.graficaEnCaja(RG, gpu('Larga', 'GeForce RTX 4060', {largo: 320}), caja('Caja'));
  comprobar(r.estado === 'si' && /Va justa \(le sobran 10 mm\)/.test(r.notas[0] || ''), 'gráfica de 320 mm en 330: cabe justa');
  r = PC.graficaEnCaja(RG, g4090, caja('Caja'));
  comprobar(r.estado === 'no' && /mide 340 mm/.test(r.texto), 'gráfica de 340 mm en 330: no');
  r = PC.graficaEnCaja(RG, g4090, caja('ITX', {gpu_max: 350, ranuras: 3}));
  comprobar(r.estado === 'no' && /ocupa 4 ranuras y la caja tiene 3/.test(r.texto), 'gráfica de 3,5 ranuras en caja de 3: no');
  comprobar(PC.huecosGrafica(2.05) === 2 && PC.huecosGrafica(2.5) === 3 && PC.huecosGrafica(2.2) === 3, 'huecos: 2,05 son 2 y 2,5 son 3');
  r = PC.graficaEnCaja(RG, gpu('Sin largo', 'GeForce RTX 4060', {largo: null}), caja('Caja'));
  comprobar(r.estado === 'nose', 'gráfica sin largo: sin comprobar');
  r = PC.graficaEnCaja(RG, g4060, caja('Sin medida', {gpu_max: null}));
  comprobar(r.estado === 'nose' && /no dice hasta qué largo/.test(r.texto), 'caja sin medida de gráfica: sin comprobar');
  comprobar(PC.placaEnCaja(RG, b450, caja('Caja')).estado === 'si', 'placa ATX en caja ATX');
  comprobar(PC.placaEnCaja(RG, Object.assign({}, b450, {formato: 'EATX'}), caja('Caja')).estado === 'no', 'placa EATX en caja ATX: no');
  comprobar(PC.placaEnCaja(RG, Object.assign({}, b450, {formato: 'Thin Mini-ITX'}), caja('Caja')).estado === 'si', 'Thin Mini-ITX donde las Mini-ITX');
  comprobar(PC.placaEnCaja(RG, Object.assign({}, b450, {formato: null}), caja('Caja')).estado === 'nose', 'placa sin formato: sin comprobar');
  comprobar(PC.fuenteEnCaja(RG, psu('ATX', 750, [2, 0]), caja('Caja')).estado === 'si', 'fuente ATX en caja ATX');
  r = PC.fuenteEnCaja(RG, psu('SFX', 750, [2, 0], {formato: 'SFX'}), caja('Caja'));
  comprobar(r.estado === 'depende' && /soporte adaptador/.test(r.texto), 'fuente SFX en caja ATX: con soporte');
  comprobar(PC.fuenteEnCaja(RG, psu('ATX', 750, [2, 0]), caja('Mini', {psu: ['SFX', 'SFX-L']})).estado === 'no', 'fuente ATX en caja SFX: no');
  comprobar(PC.fuenteEnCaja(RG, psu('ATX', 750, [2, 0]), caja('Sin dato', {psu: null})).estado === 'nose', 'caja sin formatos de fuente: sin comprobar');
  comprobar(PC.fuenteEnCaja(RG, psu('Larga', 750, [2, 0], {largo: 210}), caja('Caja')).estado === 'no', 'fuente de 210 mm en hueco de 200: no');
  r = PC.fuenteEnCaja(RG, psu('ATX', 750, [2, 0]), caja('Con fuente', {incluida: 500}));
  comprobar(r.notas.some((n) => /ya trae una fuente de 500 W/.test(n)), 'caja con fuente incluida: aviso');

  // --- disipador
  const moderno = disipador('Moderno', ['AM5', 'AM4', 'LGA 1700']);
  const viejo = disipador('Viejo', ['AM4', 'LGA 1200', 'LGA 1151', 'LGA 115x']);
  r = PC.disipadorConCpu(RG, moderno, u265k);
  comprobar(r.estado === 'si' && /mismo anclaje que LGA 1700/.test(r.texto), 'disipador de LGA 1700 en LGA 1851: mismo anclaje');
  r = PC.disipadorConCpu(RG, viejo, r7800x3d);
  comprobar(r.estado === 'depende' && /AMD dice que valen/.test(r.texto), 'disipador de AM4 en AM5: seguramente sí');
  r = PC.disipadorConCpu(RG, viejo, i12400);
  comprobar(r.estado === 'no' && /No: su ficha no trae anclaje para LGA 1700/.test(r.texto) && !/115x/.test(r.texto)
    && r.notas.indexOf('Hace falta el kit.') >= 0 && r.fuentes.indexOf('f-kit') >= 0, 'disipador de LGA 1200 en LGA 1700: no, con el kit');
  r = PC.disipadorEnZocalo(RG, disipador('Solo AM5', ['AM5']), 'AM4');
  comprobar(r.estado === 'depende' && /Debería valer/.test(r.texto), 'disipador de AM5 en AM4: puede que sí');
  r = PC.disipadorEnZocalo(RG, disipador('Solo AM4', ['AM4']), 'LGA 1700');
  comprobar(r.estado === 'no' && !r.notas.length, 'de AM4 a Intel: no, sin hablar del kit de Intel');
  comprobar(PC.disipadorConCpu(RG, disipador('Solo 1151', ['LGA 1151']), i10400).estado === 'si', 'disipador de LGA 1151 en LGA 1200: sí');
  comprobar(PC.disipadorEnCaja(RG, moderno, caja('Caja')).estado === 'si', 'disipador de 155 mm en caja de 165: cabe');
  comprobar(PC.disipadorEnCaja(RG, disipador('Alto', ['AM4'], {alto: 170}), caja('Caja')).estado === 'no', 'disipador de 170 mm en 165: no');
  r = PC.disipadorEnCaja(RG, disipador('AIO', ['AM5'], {alto: null, liquida: 1, radiador: 360}), caja('Caja'));
  comprobar(r.estado === 'nose' && /radiador de 360 mm/.test(r.texto), 'líquida: mira el radiador');
  comprobar(PC.disipadorEnCaja(RG, moderno, caja('Sin dato', {disipador_max: null})).estado === 'nose', 'caja sin altura de disipador: sin comprobar');

  // --- gráfica integrada con tarjeta
  comprobar(PC.grafica(RG, i12400f, z790, g4060).estado === 'ok', 'F con tarjeta: no le hace falta gráfica integrada (bien, no «sí»)');
  comprobar(/conecta el monitor a la tarjeta/.test(PC.grafica(RG, i12400, z790, g4060).texto), 'con tarjeta: el monitor a la tarjeta');

  // --- listas en los dos sentidos
  const gpus = [g4060, g4090, g6500, g1030];
  const enCaja = PC.graficasParaCaja(RG, gpus, caja('Caja'));
  comprobar(enCaja.every((x) => x.estado === 'si') && enCaja.reduce((s, x) => s + x.piezas.length, 0) === 3, 'gráficas que caben: todas menos la de 340 mm');
  comprobar(enCaja.map((x) => x.titulo).join('|') === 'GeForce RTX 4060|Radeon RX 6500 XT|GeForce GT 1030', 'gráficas por chip: en el orden de las reglas');
  const sinRegla = PC.graficasParaCaja(RG, [g4060, gpu('Rara', 'Chip desconocido', {largo: 200})], caja('Caja'));
  comprobar(sinRegla[sinRegla.length - 1].titulo === 'Chip desconocido', 'gráficas por chip: las que no tienen regla, al final');
  const fuentes = PC.fuentesParaGrafica(RG, [psu('a', 650, [2, 0]), psu('b', 450, [2, 0]), psu('c', 300, [2, 0]), psu('d', 750, [2, 0])], g4060, r5600x);
  comprobar(fuentes.map((x) => x.estado + ' ' + x.titulo).join('|') === 'si 650 W|si 750 W|depende 450 W|depende 300 W',
    'fuentes para una gráfica: las que valen de menor a mayor; las de «ojo», de la más cercana a la más lejana');
  r = PC.graficaConFuente(RG, g4060, psu('250', 250, [2, 0]), r5600x);
  comprobar(r.estado === 'no' && r.notas.some((n) => /por debajo de ese pico/.test(n)), 'fuente por debajo de lo que pide y del pico: no, y lo dice');
  const zocalo = PC.disipadoresParaZocalo(RG, [moderno, viejo, disipador('Solo Intel', ['LGA 1200'])], 'AM5');
  comprobar(zocalo.length === 2 && zocalo[0].estado === 'si' && zocalo[1].estado === 'depende', 'disipadores para AM5: los de AM4, aparte');
  const filas = PC.comprobar(RG, {placa: b550, cpu: r5600x, gpu: g4060, psu: psu('650', 650, [2, 0]), caja: caja('Caja'), disipador: moderno});
  comprobar(['Gráfica y placa', 'Gráfica y fuente', 'Gráfica y caja', 'Placa y caja', 'Fuente y caja', 'Disipador y procesador', 'Disipador y caja']
    .every((q) => filas.some((f) => f.que === q)), 'veredicto: las siete comprobaciones nuevas');
  comprobar(PC.peor(['si', 'depende', 'si']) === 'depende' && PC.peor(['si', 'no', 'nose']) === 'no', 'peor de varios estados');
  const comprobada = Object.assign({}, g4060, {fuente: 'https://www.asus.com/ficha', corregidos: ['largo', 'conectores']});
  comprobar(PC.graficaEnCaja(RG, comprobada, caja('Caja')).fuentes.indexOf('https://www.asus.com/ficha') >= 0
    && PC.graficaConFuente(RG, comprobada, psu('650', 650, [2, 0]), r5600x).fuentes.indexOf('https://www.asus.com/ficha') >= 0
    && PC.graficaEnCaja(RG, g4060, caja('Caja')).fuentes.indexOf('https://www.asus.com/ficha') < 0, 'piezas comprobadas a mano: su ficha va en las fuentes');
  const soloGrosor = Object.assign({}, g4060, {fuente: 'https://www.asus.com/ficha', corregidos: ['ranuras']});
  comprobar(PC.graficaConFuente(RG, soloGrosor, psu('650', 650, [2, 0]), r5600x).fuentes.indexOf('https://www.asus.com/ficha') < 0
    && PC.graficaEnCaja(RG, soloGrosor, caja('Caja')).fuentes.indexOf('https://www.asus.com/ficha') >= 0,
    'la ficha corregida solo se cita donde se usa un dato corregido');
  const conTdp = Object.assign({}, g4060, {fuente: 'https://www.asus.com/ficha', corregidos: ['tdp']});
  comprobar(PC.graficaConFuente(RG, conTdp, psu('650', 650, [2, 0]), r5600x).fuentes.indexOf('https://www.asus.com/ficha') < 0,
    'el consumo corregido de la tarjeta no se cita si manda el del chip');

  // --- revisión de código (18-11-2026)
  // sin procesador: los de la placa que dejarían la gráfica más lenta, y una fila «Gráfica y procesador» sin placa
  r = PC.graficaEnPlaca(RG, g4060, b550, null);
  comprobar(r.estado === 'si' && /salvo con los procesadores de la nota/.test(r.texto)
    && r.notas.some((n) => /^Depende del procesador: con los Ryzen 5000G y Ryzen 5500\/5700 \(Cezanne\)/.test(n) && /a PCIe 3\.0 x8/.test(n)),
    'placa sin procesador: no dice «a toda su velocidad» sin más');
  r = PC.graficaEnPlaca(RG, g4060, b650, null);
  comprobar(r.notas.some((n) => /con el Ryzen 5 8500G, a PCIe 4\.0 x4/.test(n)), 'sin procesador: nombra el modelo suelto que va distinto (8500G)');
  r = PC.graficaEnPlaca(RG, g4060, b550, r5600x);
  comprobar(!r.notas.some((n) => /Depende del procesador/.test(n)), 'con procesador, sin la nota de los que limitan');
  let filasCpu = PC.comprobar(RG, {cpu: r8500g, gpu: g4060});
  comprobar(filasCpu.length === 1 && filasCpu[0].que === 'Gráfica y procesador' && /el procesador la deja en PCIe 4\.0 x4/.test(filasCpu[0].texto),
    'gráfica y procesador sin placa: se comprueba el enlace');
  filasCpu = PC.comprobar(RG, {cpu: r5600x, gpu: g4060});
  comprobar(filasCpu[0].estado === 'si' && /Falta la placa/.test(filasCpu[0].texto), 'gráfica y procesador a toda velocidad: falta la placa');
  // las fuentes de las reglas no se tocan al citar la ficha de una pieza
  const antes = JSON.stringify(RG.graficas.compatible);
  PC.graficaEnPlaca(RG, gpu('Sin interfaz', 'Chip desconocido', {fuente: 'https://x/970', corregidos: ['pcie']}), b550, r5600x);
  comprobar(JSON.stringify(RG.graficas.compatible) === antes, 'citar una ficha corregida no cambia las reglas');
  // sin procesador: suelo con el que menos gasta de la lista
  RG._picoMinimo = {w: 44, nombre: 'Intel Core i3-7100T', fuentes: ['f-ark']};
  RG.graficas.resto = {min: 50, max: 100, fuentes: ['f-resto']};
  r = PC.graficaConFuente(RG, g4090, psu('500', 500, [4, 0]), null);
  comprobar(r.estado === 'no' && /el procesador que menos gasta de la lista \(Intel Core i3-7100T\) llega a unos 44 W/.test(r.texto) && /Ya son 544 W/.test(r.texto)
    && r.fuentes.indexOf('f-resto') >= 0, 'sin procesador, muy por debajo: no llega ni con el que menos gasta');
  r = PC.graficaConFuente(RG, g4090, psu('650', 650, [4, 0]), null);
  comprobar(r.estado === 'depende' && /^Se queda corta según NVIDIA/.test(r.texto) && r.notas.indexOf('Ya lleva margen.') < 0,
    'sin procesador, lejos de lo que pide: se queda corta, sin la nota del margen');
  r = PC.graficaConFuente(RG, g4090, psu('800', 800, [4, 0]), null);
  comprobar(r.estado === 'depende' && /^Justa:/.test(r.texto) && r.notas.indexOf('Ya lleva margen.') >= 0, 'sin procesador, cerca de lo que pide: justa');
  r = PC.graficaConFuente(RG, g4060, psu('550', 550, [2, 0]), r5600x);
  comprobar(r.notas.some((n) => /el resto del equipo \(placa, memoria, discos y ventiladores\), entre 50 y 100 W/.test(n)) && r.fuentes.indexOf('f-resto') >= 0,
    'la estimación dice qué es «el resto» y cita de dónde sale');
  delete RG._picoMinimo;
  r = PC.graficaConFuente(RG, g4090, psu('500', 500, [4, 0]), null);
  comprobar(r.estado === 'depende', 'sin la lista de procesadores, no hay suelo: depende');
  delete RG.graficas.resto;
  // «Sí:» solo si todo encaja
  r = PC.graficaConFuente(RG, g4090, psu('1000', 1000, [2, 0]), r7800x3d);
  comprobar(!/^Sí:/.test(r.texto) && /^De potencia, bien:/.test(r.texto), 'conectores que no llegan: el texto no empieza por «Sí:»');
  // utilidades nuevas
  comprobar(PC.encaja([0, 0, 1], [3, 0], 3).adaptador === 3 && PC.encaja([0, 0, 1], [2, 0], 3).falta && PC.encaja([0, 0, 1], [0, 1], 3).nativo === 1
    && PC.encaja([0, 0, 1], [4, 0], null).sinDato && PC.encaja([1, 1, 0], [2, 0], null).falta === false, 'encaja: nativos, adaptador, sin dato');
  comprobar(PC.textoFuente([0, 2]) === '2 conectores de 16 pines y ninguno de 6+2' && PC.textoFuente([3, 1]) === '3 conectores de 6+2 pines y uno de 16 pines',
    'texto de los conectores de una fuente');
  const porChip = PC.conectoresPorChip([g4060, gpu('Otra 4060', 'GeForce RTX 4060', {conectores: [0, 1, 0]}), gpu('4060 rara', 'GeForce RTX 4060', {conectores: [1, 1, 0]}), g6500]);
  comprobar(porChip['GeForce RTX 4060'].length === 2 && !porChip['Radeon RX 6500 XT'], 'conectores por chip: distintos y solo con dato');
  const pm = PC.picoMinimo(RG, [r5600x, i13400, cpu('core-i3-8100t', 'Intel Core i3-8100T', 'LGA 1151', 'coffee', true, {tdp: 35})]);
  comprobar(pm && pm.nombre === 'Intel Core i3-8100T' && pm.w === 44, 'el procesador que menos gasta de la lista');
  // caja: grosor que llena la caja; textos con su unidad
  r = PC.graficaEnCaja(RG, gpu('Gruesa', 'GeForce RTX 4090', {conectores: [0, 0, 1], largo: 300, ranuras: 3.5}), caja('Cuatro', {gpu_max: 350, ranuras: 4}));
  comprobar(r.estado === 'si' && r.notas.some((n) => /De grosor va justa: ocupa 4 ranuras y la caja tiene 4/.test(n)), 'gráfica que llena las ranuras de la caja: aviso');
  r = PC.graficaEnCaja(RG, gpu('Gruesa', 'GeForce RTX 4090', {conectores: [0, 0, 1], largo: 300, ranuras: 3.5}), caja('Siete', {gpu_max: 350, ranuras: 7}));
  comprobar(!r.notas.length, 'con ranuras de sobra, sin aviso');
  comprobar(/caben hasta 200 mm\./.test(PC.fuenteEnCaja(RG, psu('Corta', 750, [2, 0], {largo: 150}), caja('Caja')).texto), 'fuente en caja: «hasta 200 mm»');
  r = PC.disipadorEnCaja(RG, disipador('Justo', ['AM4'], {alto: 162}), caja('Caja'));
  comprobar(r.notas.indexOf('Va justo: le sobran 3 mm.') >= 0, 'disipador justo: sin suponer nada de la tapa');
  // listas: lo demás elegido cuenta, y orden por número
  const conExtra = PC.disipadoresParaZocalo(RG, [moderno, viejo], 'AM5', (d) => (d === moderno ? 'no' : 'si'));
  comprobar(conExtra.length === 1 && conExtra[0].piezas[0] === viejo && conExtra[0].estado === 'depende', 'listas: lo que no encaja con lo demás, fuera');
  const altos = PC.disipadoresParaCaja(RG, [disipador('Bajo', ['AM4'], {alto: 95}), disipador('Alto', ['AM4'], {alto: 158})], caja('Caja'));
  comprobar(altos.map((x) => x.titulo).join('|') === 'De 90 a 99 mm de alto|De 150 a 159 mm de alto', 'grupos por altura: por número, no como texto');

  // --- dónde comprarlo
  const busca = (t, nombre, extra) => PC.textoBusqueda(t, Object.assign({nombre: nombre}, extra || {}));
  comprobar(busca('cajas', 'GameMax Black Diamond ARGB ATX Mid Tower Black with Tempered Glass Side Panel') === 'GameMax Black Diamond ARGB', 'buscar caja: «Black» del modelo se queda');
  comprobar(busca('cajas', 'Rosewill ATX Mid Tower Gaming PC Computer Case with Dual Ring Blue LED Fans - SPECTRA C100') === 'Rosewill SPECTRA C100', 'buscar caja: el modelo tras el guion');
  comprobar(busca('cajas', 'Corsair 4000D AIRFLOW Tempered Glass Mid-Tower ATX Case - Black') === 'Corsair 4000D AIRFLOW', 'buscar caja: sin el color tras el guion');
  comprobar(busca('disipadores', 'Thermaltake Water 3.0 Riing Red Water 140mm 40.6 CFM Black / Red') === 'Thermaltake Water 3.0 Riing', 'buscar líquida: «Water» del modelo se queda');
  comprobar(busca('disipadores', 'Cooler Master Hyper 212 Air 163mm LED Turbo 66.3 CFM Red') === 'Cooler Master Hyper 212', 'buscar disipador: sin «Air» ni medida');
  comprobar(busca('disipadores', 'Alpenföhn BLACK RIDGE Air 47.1 CFM Black') === 'Alpenföhn BLACK RIDGE', 'buscar disipador: «BLACK» del modelo se queda');
  comprobar(busca('graficas', 'Asus DUAL EVO GeForce RTX 4060 8GB GDDR6 Black') === 'Asus DUAL EVO GeForce RTX 4060 8GB', 'buscar gráfica: sin GDDR ni color');
  comprobar(busca('graficas', 'MSI GeForce RTX 4070 VENTUS 2X 12G OC White') === 'MSI GeForce RTX 4070 VENTUS 2X 12G OC', 'buscar gráfica: sin color al final');
  comprobar(busca('fuentes', 'Corsair RM750 (2019) Black ATX 750W Fully Modular 80+ Gold', {vatios: 750}) === 'Corsair RM750 750W', 'buscar fuente: modelo y vatios');
  comprobar(busca('fuentes', 'Corsair RM750 750W 80+ Gold Certified Fully Modular ATX', {vatios: 750}) === 'Corsair RM750 750W', 'buscar fuente: vatios una vez');
  comprobar(busca('cajas', 'NZXT H5 Flow (2022) ATX Mid Tower Black with Tempered Glass Side Panel') === 'NZXT H5 Flow', 'buscar caja: solo el modelo');
  comprobar(busca('disipadores', 'Thermalright Peerless Assassin 120 SE 66.17 CFM CPU Cooler') === 'Thermalright Peerless Assassin 120 SE', 'buscar disipador de aire');
  comprobar(busca('disipadores', 'ARCTIC Liquid Freezer III 360 A-RGB 48.82 CFM Water 360mm Black') === 'ARCTIC Liquid Freezer III 360 A-RGB', 'buscar líquida');
}

// ------------------------------------------------------------ reglas reales de las gráficas

function pruebaReglasGraficas() {
  console.log('Reglas de las gráficas (pc/reglas.json)');
  const chips = (R.graficas || {}).chips || {};
  const nombres = Object.keys(chips);
  comprobar(nombres.length >= 70, `hay reglas de chips (${nombres.length})`);
  for (const n of nombres) {
    const c = chips[n];
    const bien = c.fuentes && c.fuentes.length && c.fuentes.every((f) => R.fuentes[f])
      && ['NVIDIA', 'AMD', 'Intel'].indexOf(c.marca) >= 0
      && (!c.pcie || ([1, 2, 3, 4, 5].indexOf(c.pcie[0]) >= 0 && [1, 4, 8, 16].indexOf(c.pcie[1]) >= 0))
      && (!c.consumo || (c.consumo >= 10 && c.consumo <= 700))
      && (!c.psu || (c.psu >= 200 && c.psu <= 1600 && (!c.consumo || c.psu > c.consumo)))
      && (!c.psu || (c.fuentes_psu && c.fuentes_psu.length && c.fuentes_psu.every((f) => R.fuentes[f])))
      && (!c.ref || (c.ref.length === 3 && c.ref.every((x) => Number.isInteger(x) && x >= 0 && x <= 4)))
      && (!c.adaptador || (c.adaptador >= 1 && c.adaptador <= 4))
      && (!c.por_memoria || Object.keys(c.por_memoria).every((gb) => {
        const v = c.por_memoria[gb];
        return (v.consumo || c.consumo) > 0 && (!v.psu || v.psu > (v.consumo || c.consumo));
      }));
    comprobar(bien, `chip ${n}: datos posibles y con fuente`);
  }
  const es = (n, campo, v) => comprobar(JSON.stringify((chips[n] || {})[campo]) === JSON.stringify(v), `${n}: ${campo} = ${JSON.stringify(v)}`);
  // cifras de las fichas de los fabricantes (si cambian, hay que mirar la fuente otra vez)
  es('GeForce RTX 4060', 'pcie', [4, 8]);
  es('GeForce RTX 4060', 'consumo', 115);
  es('GeForce RTX 4060', 'psu', 550);
  es('GeForce RTX 4090', 'adaptador', 3);
  es('GeForce RTX 5090', 'psu', 1000);
  es('Radeon RX 6500 XT', 'pcie', [4, 4]);
  es('Radeon RX 7600', 'pcie', [4, 8]);
  es('Radeon RX 9070 XT', 'pcie', [5, 16]);
  es('Arc B580', 'rebar', true);
  es('Arc B580', 'pcie', [4, 8]);
  es('GeForce RTX 4060 Ti', 'consumo', 165);
  comprobar(PC.consumoGrafica(R, gpu('2060 de 12', 'GeForce RTX 2060', {gb: 12})).w === 185
    && PC.chipGrafica(R, gpu('2060 de 12', 'GeForce RTX 2060', {gb: 12})).psu === 550
    && PC.consumoGrafica(R, gpu('2060 de 6', 'GeForce RTX 2060', {gb: 6})).w === 160, 'RTX 2060: la de 12 GB gasta más');

  // ranura de la gráfica y carriles del procesador (AMD, Intel y las placas)
  const ranura = (z, c) => R.plataformas[z].chipsets[c].grafica;
  comprobar(ranura('AM4', 'B450') === 3 && ranura('AM4', 'A520') === 3 && ranura('AM4', 'B550') === 4 && ranura('AM4', 'X570') === 4,
    'AM4: B450 y A520 a PCIe 3.0; B550 y X570 a 4.0');
  comprobar(ranura('AM5', 'B650') === 4 && ranura('AM5', 'B650E') === 5 && ranura('AM5', 'X870') === 5
    && JSON.stringify(ranura('AM5', 'B850')) === '[4,5]', 'AM5: B650 a 4.0, B650E y X870 a 5.0, B850 según la placa');
  comprobar(ranura('LGA 1200', 'B460') === 3 && ranura('LGA 1200', 'B560') === 4, 'LGA 1200: B460 a 3.0 y B560 a 4.0');
  let todos = true;
  for (const z of Object.keys(R.plataformas)) {
    for (const c of Object.keys(R.plataformas[z].chipsets)) {
      const d = R.plataformas[z].chipsets[c];
      const g = d.grafica;
      const bien = (Number.isInteger(g) && g >= 3 && g <= 5) || (Array.isArray(g) && g[0] < g[1] && g[0] >= 3 && g[1] <= 5);
      if (!bien || !(d.fuentes_grafica || []).length || !d.fuentes_grafica.every((f) => R.fuentes[f])) {
        todos = false;
        comprobar(false, `ranura de la gráfica en ${z} ${c}: ${JSON.stringify(g)}`);
      }
    }
  }
  comprobar(todos, 'todos los chipsets: ranura de la gráfica posible y con fuente');
  comprobar(Object.keys(R.familias).every((f) => {
    const g = R.familias[f].grafica;
    return g && [3, 4, 5].indexOf(g.gen) >= 0 && [4, 8, 16].indexOf(g.carriles) >= 0 && g.fuentes.length && g.fuentes.every((x) => R.fuentes[x]);
  }), 'todas las familias: carriles para la gráfica, con fuente');
  comprobar(R.familias.phoenix.grafica.carriles === 8 && JSON.stringify(R.familias.phoenix.grafica.por_modelo['ryzen-5-8500g']) === '[4,4]'
    && R.familias.cezanne.grafica.gen === 3 && R.familias.raphael.grafica.gen === 5, 'carriles: 8000G a x8 (8500G a x4), 5000G a PCIe 3.0, 7000 a 5.0');
  const tramos = R.graficas.rendimiento;
  comprobar(tramos.length >= 4 && tramos.every((t, i) => t.fuentes.length && t.fuentes.every((f) => R.fuentes[f]) && (!i || t.hasta >= tramos[i - 1].hasta)),
    'tramos de rendimiento: en orden y con fuente');
  comprobar(R.graficas.rebar && R.graficas.rebar.familias.indexOf('vermeer') >= 0 && R.graficas.rebar.familias.indexOf('coffee') < 0,
    'Resizable BAR: Ryzen 5000 sí, Core 8.ª gen no');

  // casos reales: lo que pasa con piezas de verdad
  const g4060 = gpu('RTX 4060', 'GeForce RTX 4060', {gb: 8, conectores: [0, 1, 0]});
  let r = PC.graficaEnPlaca(R, g4060, b450, r5600x);
  comprobar(r.estado === 'depende' && /PCIe 3\.0 x8/.test(r.texto) && r.notas.some((n) => /8 GB/.test(n)),
    'RTX 4060 (8 GB) en B450: a PCIe 3.0 x8, con aviso de memoria');
  r = PC.graficaEnPlaca(R, gpu('RTX 4060 Ti 16 GB', 'GeForce RTX 4060 Ti', {gb: 16}), b450, r5600x);
  comprobar(r.estado === 'si' && /PCIe 3\.0 x8/.test(r.texto), 'RTX 4060 Ti de 16 GB en B450: sí, con nota');
  r = PC.graficaEnPlaca(R, gpu('RX 6500 XT', 'Radeon RX 6500 XT', {gb: 4}), a520, r5600g);
  comprobar(r.estado === 'depende' && /PCIe 3\.0 x4/.test(r.texto), 'RX 6500 XT en A520: depende (PCIe 3.0 x4)');
  r = PC.graficaEnPlaca(R, gpu('RTX 4090', 'GeForce RTX 4090', {gb: 24}), b550, r5600x);
  comprobar(r.estado === 'si' && /toda su velocidad \(PCIe 4\.0 x16\)/.test(r.texto), 'RTX 4090 en B550 con 5600X: a toda velocidad');
  r = PC.graficaEnPlaca(R, gpu('RTX 5090', 'GeForce RTX 5090', {gb: 32}), b650, r7800x3d);
  comprobar(r.estado === 'si' && /PCIe 4\.0 x16/.test(r.texto) && r.notas.some((n) => /diferencia medida es pequeña/.test(n)), 'RTX 5090 en B650: a 4.0, pierde poco');
  r = PC.graficaEnPlaca(R, gpu('RTX 4060', 'GeForce RTX 4060', {gb: 8}), b650, r8500g);
  comprobar(/PCIe 4\.0 x4/.test(r.texto) && r.estado === 'depende', 'RTX 4060 con 8500G: a x4, ojo');
}

pruebaReglas();
pruebaCpuPlaca();
pruebaMemoria();
pruebaSsd();
pruebaResto();
pruebaCompra();
pruebaPiezasNuevas();
pruebaReglasGraficas();
console.log(`\n${hechas - fallos.length} de ${hechas} comprobaciones bien.`);
process.exit(fallos.length ? 1 : 0);
