#!/usr/bin/env bash
# Renders the cast clips (720x1280) into community/clips/. Needs community/char_voice.py output and the repo served on :8765.
# Usage (repo root): rabbithole/community/render_cast.sh <workdir> <parallel> <id...>
set -uo pipefail
W=$1; J=$2; shift 2; HERE=$(cd "$(dirname "$0")" && pwd); OUT="$HERE/clips"; mkdir -p "$OUT"
one() {
  id=$1; F="$W/fc-$id"; rm -rf "$F"; mkdir -p "$F"
  (cd "$HERE/../reels" && PAGE=char.html SCALE=0.6667 node render.cjs "char-$id" "$F" 30 > "$F.log" 2>&1) || { echo "render failed $id"; return; }
  ffmpeg -y -loglevel error -framerate 30 -i "$F/%05d.jpg" -i "$W/char-$id.wav" -c:v libx264 -preset medium -crf 27 -pix_fmt yuv420p \
    -c:a aac -b:a 128k -af "loudnorm=I=-14:TP=-1.5:LRA=11" -shortest -movflags +faststart "$OUT/$id.mp4" &&
  ffmpeg -y -loglevel error -ss 2.2 -i "$OUT/$id.mp4" -frames:v 1 -q:v 5 "$OUT/$id.jpg" && rm -rf "$F" && echo "done $id $(du -h "$OUT/$id.mp4" | cut -f1)"
}
export -f one; export W HERE OUT
printf "%s\n" "$@" | xargs -P "$J" -I{} bash -c 'one {}'
