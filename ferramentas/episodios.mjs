#!/usr/bin/env node
// Gera data/episodios.json a partir do currículo e dos MP4 prontos.
//
//   node ferramentas/episodios.mjs            # só o JSON
//   node ferramentas/episodios.mjs --capas    # JSON + capas que faltam (img/c 640×360, img/h 1280×720)
//   node ferramentas/episodios.mjs --capas --refazer   # refaz todas as capas
//
// Prontos = arquivos em ../Jesus/out/M??-E??-*.mp4 (sem -celular). Duração via ffprobe.
// Capa: um quadro do 1080p cortado entre o HUD (y<110) e a legenda (y≈880), em 16:9.
// Episódio novo: escolha o quadro em QUADRO (fração da duração); sem entrada, usa 0.4.

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const JESUS = process.env.JESUS_DIR || join(RAIZ, '..', 'Jesus');
const CRONOLOGIA = join(JESUS, 'src/curriculo/cronologia.json');
const OUT = join(JESUS, 'out');
const args = new Set(process.argv.slice(2));

const QUADRO = {
  'M01-E01-Criacao': 0.48, 'M01-E02-Queda': 0.68,
  'M08-E01-Nabucodonosor': 0.28, 'M08-E02-Ezequiel': 0.48, 'M08-E03-Cerco': 0.18,
  'M08-E04-Gloria': 0.28, 'M08-E05-Videira': 0.68, 'M08-E06-Cedro': 0.28,
  'M08-E07-Responde': 0.38, 'M08-E08-Espada': 0.58, 'M08-E09-Tiro': 0.58,
  'M08-E10-Egito': 0.08, 'M08-E11-Pastor': 0.78, 'M08-E12-Salmos': 0.08,
};

const LIVROS = {
  Gn: 'Gênesis', 'Êx': 'Êxodo', Lv: 'Levítico', Nm: 'Números', Dt: 'Deuteronômio', Js: 'Josué', Jz: 'Juízes', Rt: 'Rute',
  '1Sm': '1 Samuel', '2Sm': '2 Samuel', '1Rs': '1 Reis', '2Rs': '2 Reis', '1Cr': '1 Crônicas', '2Cr': '2 Crônicas',
  Ed: 'Esdras', Ne: 'Neemias', Et: 'Ester', 'Jó': 'Jó', Sl: 'Salmos', Pv: 'Provérbios', Ec: 'Eclesiastes', Ct: 'Cânticos',
  Is: 'Isaías', Jr: 'Jeremias', Lm: 'Lamentações', Ez: 'Ezequiel', Dn: 'Daniel', Os: 'Oseias', Jl: 'Joel', Am: 'Amós',
  Ob: 'Obadias', Jn: 'Jonas', Mq: 'Miqueias', Na: 'Naum', Hc: 'Habacuque', Sf: 'Sofonias', Ag: 'Ageu', Zc: 'Zacarias', Ml: 'Malaquias',
  Mt: 'Mateus', Mc: 'Marcos', Lc: 'Lucas', Jo: 'João', At: 'Atos', Rm: 'Romanos', '1Co': '1 Coríntios', '2Co': '2 Coríntios',
  Gl: 'Gálatas', Ef: 'Efésios', Fp: 'Filipenses', Cl: 'Colossenses', '1Ts': '1 Tessalonicenses', '2Ts': '2 Tessalonicenses',
  '1Tm': '1 Timóteo', '2Tm': '2 Timóteo', Tt: 'Tito', Fm: 'Filemom', Hb: 'Hebreus', Tg: 'Tiago', '1Pe': '1 Pedro', '2Pe': '2 Pedro',
  '1Jo': '1 João', '2Jo': '2 João', '3Jo': '3 João', Jd: 'Judas', Ap: 'Apocalipse',
};

// [{livro:'Sl',de:44,ate:44},{livro:'Sl',de:74,ate:74}] -> "Salmos 44; 74"
function passagens(lista) {
  const grupos = [];
  for (const p of lista) {
    const nome = LIVROS[p.livro] || p.livro;
    const faixa = p.de === p.ate ? `${p.de}` : `${p.de}–${p.ate}`;
    const g = grupos.at(-1);
    if (g && g.nome === nome) g.faixas.push(faixa); else grupos.push({ nome, faixas: [faixa] });
  }
  return grupos.map(g => `${g.nome} ${g.faixas.join('; ')}`).join(' · ');
}

const ffprobe = f => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim());

function capa(arq, mp4, dur) {
  const t = (dur * (QUADRO[arq] ?? 0.4)).toFixed(2);
  const corte = 'crop=1369:770:275:110';
  for (const [pasta, tam] of [['c', '640:360'], ['h', '1280:720']]) {
    const destino = join(RAIZ, 'img', pasta, `${arq}.jpg`);
    if (existsSync(destino) && !args.has('--refazer')) continue;
    mkdirSync(dirname(destino), { recursive: true });
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', t, '-i', mp4, '-frames:v', '1',
      '-vf', `${corte},scale=${tam}:flags=lanczos`, '-q:v', pasta === 'c' ? '5' : '4', destino]);
    console.log('capa', pasta, arq);
  }
}

const cron = JSON.parse(readFileSync(CRONOLOGIA, 'utf8'));
const prontos = new Map();
for (const f of readdirSync(OUT)) {
  const m = f.match(/^(M\d\d-E\d\d)-(.+)\.mp4$/);
  if (!m || f.includes('-celular')) continue;
  const arq = f.replace(/\.mp4$/, '');
  const mp4 = join(OUT, f);
  const dur = Math.round(ffprobe(mp4));
  prontos.set(m[1], { arq, dur, mp4 });
}

const modulos = cron.modulos.map(mod => {
  const num = Number(mod.id.slice(1));
  const episodios = mod.episodios.map(e => {
    const numero = Number(e.id.split('-E')[1]);
    const base = { id: e.id, numero, titulo: e.titulo, passagens: passagens(e.passagens) };
    const p = prontos.get(e.id);
    if (!p) return base;
    if (args.has('--capas')) capa(p.arq, p.mp4, p.dur);
    return { ...base, pronto: true, arq: p.arq, dur: p.dur, capa: `img/c/${p.arq}.jpg`,
      hero: existsSync(join(RAIZ, 'img/h', `${p.arq}.jpg`)) ? `img/h/${p.arq}.jpg` : `img/c/${p.arq}.jpg`,
      sinopse: e.destaque, jesus: e.jesus };
  });
  return { num, titulo: mod.titulo, periodo: mod.periodo, resumo: mod.resumo,
    total: episodios.length, prontos: episodios.filter(e => e.pronto).length, episodios };
});

const total = modulos.reduce((s, m) => s + m.total, 0);
const nProntos = modulos.reduce((s, m) => s + m.prontos, 0);
mkdirSync(join(RAIZ, 'data'), { recursive: true });
writeFileSync(join(RAIZ, 'data/episodios.json'), JSON.stringify({ gerado: new Date().toISOString().slice(0, 10), total, prontos: nProntos, modulos }) + '\n');
console.log(`data/episodios.json: ${modulos.length} módulos, ${total} episódios, ${nProntos} prontos`);
