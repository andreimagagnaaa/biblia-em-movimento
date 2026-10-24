#!/usr/bin/env bash
# Gera o sprite de miniaturas de cada episódio (um quadro a cada 5 s, 160x90, grade de 10 colunas)
# em img/sprites/<arq>.jpg e depois atualiza data/capitulos.json (capítulos + geometria do sprite).
# Uso: ferramentas/miniaturas.sh [/caminho/do/projeto/Jesus] [arq ...]
#   sem arq: todos os out/M0?-E??-*.mp4 que não terminam em -celular
set -euo pipefail
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
JESUS="${1:-/Users/andreimagagna/Jesus}"; shift || true
INTERVALO=5; L=160; A=90; COLS=10; LIMITE=$((400 * 1024))
mkdir -p "$RAIZ/img/sprites"

if [ $# -gt 0 ]; then LISTA=("$@"); else
  LISTA=(); for f in "$JESUS"/out/M0?-E??-*.mp4; do case "$f" in *-celular.mp4) ;; *) LISTA+=("$(basename "$f" .mp4)");; esac; done
fi

um() {
  local arq="$1" mp4="$JESUS/out/$1.mp4" dst="$RAIZ/img/sprites/$1.jpg"
  local fps quadros linhas q n
  fps=30
  n=$(ffprobe -v error -select_streams v:0 -count_packets -show_entries stream=nb_read_packets -of csv=p=0 "$mp4" | tr -dc 0-9)
  quadros=$(( (n - 1) / (INTERVALO * fps) + 1 ))
  linhas=$(( (quadros + COLS - 1) / COLS ))
  # select exato: quadros 0, 150, 300... = 0 s, 5 s, 10 s...
  for q in 2 3 4 5 7 9 12; do
    ffmpeg -v error -y -i "$mp4" -an \
      -vf "select='not(mod(n\,$((INTERVALO * fps))))',scale=${L}:${A}:flags=lanczos,tile=${COLS}x${linhas}" \
      -frames:v 1 -q:v "$q" "$dst"
    [ "$(stat -f%z "$dst")" -lt "$LIMITE" ] && break
  done
  echo "  $arq: $quadros quadros, ${COLS}x${linhas}, $(( $(stat -f%z "$dst") / 1024 )) KB (q=$q)"
}
export -f um; export JESUS RAIZ INTERVALO L A COLS LIMITE

echo "Sprites (${#LISTA[@]} episódios)…"
printf '%s\n' "${LISTA[@]}" | xargs -P 6 -I{} bash -c 'um "$@"' _ {}
node "$RAIZ/ferramentas/capitulos.mjs" "$JESUS"
