// Gera data/capitulos.json: capítulos (= cenas do episódio) e a geometria do sprite de miniaturas.
// Uso: node ferramentas/capitulos.mjs [/caminho/do/projeto/Jesus]
// Lê producao/episodios.json (ID → pasta), o roteiro.json de cada pasta (títulos das cenas) e o
// duracoes.json (duração real de cada fala), replicando src/narracao/tempos.ts (FPS 30).
// Confere o total com a duração do MP4 em out/<composicao>.mp4.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const JESUS = process.argv[2] || '/Users/andreimagagna/Jesus';
const FPS = 30, ENTRADA = 0.6, RESPIRO = 0.35, LPS = 14.5;
// Igual ao miniaturas.sh
const SPRITE = { intervalo: 5, largura: 160, altura: 90, colunas: 10 };

const estimar = (t) => Math.max(1.6, t.length / LPS);
const ler = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

function tempos(roteiro, dur) {
  let cursor = 0;
  const cenas = roteiro.cenas.map((c) => {
    let t = ENTRADA;
    for (const f of c.falas) t += (dur[f.id]?.segundos ?? estimar(f.texto)) + RESPIRO + (f.pausa ?? 0);
    const duracao = Math.round((t + (c.cauda ?? 0.9)) * FPS);
    const cena = { id: c.id, titulo: c.titulo || c.id, inicio: cursor, duracao };
    cursor += duracao;
    return cena;
  });
  return { cenas, total: cursor };
}

const duracaoMp4 = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim());

const eps = ler(path.join(JESUS, 'producao/episodios.json'));
const porComp = Object.fromEntries(Object.entries(eps).filter(([k]) => !k.startsWith('_')).map(([id, e]) => [e.composicao, { id, ...e }]));
const saida = path.join(RAIZ, 'data/capitulos.json');
const resultado = {};
let problemas = 0;

const mp4s = fs.readdirSync(path.join(JESUS, 'out')).filter((f) => /^M\d\d-E\d\d-.+\.mp4$/.test(f) && !f.endsWith('-celular.mp4')).sort();
for (const f of mp4s) {
  const arq = f.replace(/\.mp4$/, '');
  const e = porComp[arq];
  if (!e) { console.warn(`! ${arq}: sem linha em episodios.json`); problemas++; continue; }
  const pasta = path.join(JESUS, 'src/episodios', e.pasta);
  const roteiro = ler(path.join(pasta, 'roteiro.json'));
  const durFile = path.join(pasta, 'duracoes.json');
  const dur = fs.existsSync(durFile) ? ler(durFile) : {};
  const { cenas, total } = tempos(roteiro, dur);
  const fimS = total / FPS;
  const mp4S = duracaoMp4(path.join(JESUS, 'out', f));
  const ok = Math.abs(fimS - mp4S) < 0.5;
  if (!ok) problemas++;
  console.log(`${ok ? '✓' : '✗'} ${arq.padEnd(24)} ${cenas.length} cenas  fim ${fimS.toFixed(2)}s  mp4 ${mp4S.toFixed(2)}s`);
  const sprite = fs.existsSync(path.join(RAIZ, 'img/sprites', `${arq}.jpg`))
    ? { arquivo: `img/sprites/${arq}.jpg`, ...SPRITE, quadros: Math.floor((Math.round(mp4S * FPS) - 1) / (SPRITE.intervalo * FPS)) + 1 }
    : null;
  resultado[arq] = {
    duracao: Math.round(mp4S * 10) / 10,
    capitulos: cenas.map((c) => ({ inicio_s: Math.round((c.inicio / FPS) * 100) / 100, titulo: c.titulo })),
    sprite,
  };
}

fs.mkdirSync(path.dirname(saida), { recursive: true });
fs.writeFileSync(saida, JSON.stringify(resultado, null, 1) + '\n');
console.log(`→ ${path.relative(RAIZ, saida)} (${Object.keys(resultado).length} episódios${problemas ? `, ${problemas} problema(s)` : ''})`);
process.exitCode = problemas ? 1 : 0;
