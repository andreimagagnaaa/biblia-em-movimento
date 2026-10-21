// Repassa um vídeo do release do GitHub com Content-Type video/mp4 (o GitHub manda application/octet-stream
// com nosniff, e o Safari recusa). Só o Safari usa esta rota; os outros navegadores vão direto ao GitHub.
export const config = { runtime: 'edge' };

const BASE = 'https://github.com/andreimagagnaaa/biblia-em-movimento/releases/download/videos/';

export default async function handler(req) {
  const nome = new URL(req.url).searchParams.get('f') || '';
  if (!/^[A-Za-z0-9-]+\.mp4$/.test(nome)) return new Response('arquivo inválido', { status: 400 });

  const cabecalhos = {};
  const range = req.headers.get('range');
  if (range) cabecalhos.range = range;
  const r = await fetch(BASE + nome, { headers: cabecalhos, redirect: 'follow' });
  if (!r.ok && r.status !== 206) return new Response('não encontrado', { status: r.status });

  const h = new Headers();
  h.set('content-type', 'video/mp4');
  h.set('accept-ranges', 'bytes');
  h.set('cache-control', 'public, max-age=86400');
  for (const k of ['content-length', 'content-range', 'etag', 'last-modified']) {
    const v = r.headers.get(k);
    if (v) h.set(k, v);
  }
  return new Response(r.body, { status: r.status, headers: h });
}
