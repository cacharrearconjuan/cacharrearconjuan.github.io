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
    video: [], flashback: null, revisada: '', anio: 2021}, extra || {});
}

function kit(tipo, velocidad, cl, modulos, gb, perfil) {
  return {id: `${tipo}${velocidad}${modulos}x${gb}`, nombre: `Kit ${tipo}-${velocidad} CL${cl} ${modulos}x${gb}GB`, tipo: tipo,
    velocidad: velocidad, cl: cl, modulos: modulos, gb: gb, perfil: perfil || ''};
}

function ssd(nombre, largo, gen, carriles, protocolo) {
  return {id: nombre, nombre: nombre, largo: largo, gen: gen, carriles: carriles, protocolo: protocolo, gb: 1000};
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
  comprobar(e(r3400g, b550) === 'no' && /se llamen 3000/.test(t(r3400g, b550)), '3400G en B550: no, y explica lo del nombre');
  comprobar(e(a3000g, b550) === 'no' && /Athlon 3000G/.test(t(a3000g, b550)), 'Athlon 3000G en B550: no, y lo nombra');
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
  comprobar(!v.notas.some((n) => /doble cara/.test(n.texto)), 'i5-13400 (4800): sin esa nota');
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
  r = PC.ssdEnPlaca(R, s990, sinDatos, null);
  comprobar(r.estado === 'nose' && /no trae/.test(r.texto), 'placa sin huecos en la ficha: no lo sé');
  r = PC.ssdEnPlaca(R, s990, z270, null);
  comprobar(r.estado === 'nose' && /relleno/.test(r.texto), 'ficha de plantilla: no me fío');
}

// ------------------------------------------------------------ gráfica, listas y búsqueda

function pruebaResto() {
  console.log('Gráfica, listas y búsqueda');
  comprobar(PC.grafica(R, r5600g, b550).estado === 'si' && /HDMI/.test(PC.grafica(R, r5600g, b550).texto), '5600G: con gráfica y salidas de la placa');
  comprobar(PC.grafica(R, r5600x, null).estado === 'no' && /acabados en G/.test(PC.grafica(R, r5600x, null).texto), '5600X: sin gráfica, explica lo de la G');
  comprobar(PC.grafica(R, i12400f, null).estado === 'no' && /F/.test(PC.grafica(R, i12400f, null).texto), '12400F: sin gráfica, explica lo de la F');
  comprobar(/2 núcleos/.test(PC.grafica(R, r7800x3d, null).texto), 'Ryzen 7000: la gráfica justa');

  const cpus = [r5600x, r3600, r1700, r5600g, r3400g, a3000g, r7800x3d, i12400];
  const grupos = PC.cpusParaPlaca(R, cpus, b550);
  comprobar(grupos.map((g) => g.estado).join() === 'si,bios,no', `B550: grupos si, bios y no (${grupos.map((g) => g.estado)})`);
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

pruebaReglas();
pruebaCpuPlaca();
pruebaMemoria();
pruebaSsd();
pruebaResto();
console.log(`\n${hechas - fallos.length} de ${hechas} comprobaciones bien.`);
process.exit(fallos.length ? 1 : 0);
