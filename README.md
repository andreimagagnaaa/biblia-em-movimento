# Bíblia em Movimento

Site da série de vídeo-aulas animadas que percorre a Bíblia em ordem cronológica.

- `index.html`: o catálogo (estático, sem build).
- `img/`: mural da capa (`m/`), capas dos episódios (`c/`) e imagem de compartilhamento.
- Vídeos: release [`videos`](../../releases/tag/videos), em `<episódio>-720.mp4` e `<episódio>-1080.mp4`.
- `api/v.js` + `vercel.json`: repassa `/v/*` com `Content-Type: video/mp4` para o Safari.

Episódio novo: suba os dois MP4 no release e acrescente a linha em `MODULOS` no `index.html`.
