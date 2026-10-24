# Bíblia em Movimento

Site da série de vídeo-aulas animadas que percorre a Bíblia em ordem cronológica. Estático, sem build.

- `index.html` + `css/site.css` + `js/catalogo.js`: capa, fileiras por módulo, painel do episódio, busca, linha do tempo.
- `js/player.js` + `css/player.css`: player próprio (capítulos, miniaturas, qualidade, atalhos, retomar, próximo).
- `data/episodios.json`: os 13 módulos e 375 episódios (gerado). `data/capitulos.json`: capítulos e sprites (gerado).
- `img/`: mural (`m/`), capas (`c/` 640×360, `h/` 1280×720), sprites de miniatura (`sprites/`).
- Vídeos: release [`videos`](../../releases/tag/videos), em `<episódio>-720.mp4` e `<episódio>-1080.mp4`.
- `api/v.js` + `vercel.json`: repassa `/v/*` com `Content-Type: video/mp4` para o Safari.

## Episódio novo
1. Suba `out/<arq>-celular.mp4` como `<arq>-720.mp4` e `out/<arq>.mp4` como `<arq>-1080.mp4` no release `videos` (com `Content-Type: video/mp4`).
2. `node ferramentas/episodios.mjs --capas` (dados + capas) e `ferramentas/miniaturas.sh /Users/andreimagagna/Jesus <arq>` (sprites + capítulos).
3. Commit, push e um único `vercel --prod --yes` (a conta tem limite de deploys por dia).
