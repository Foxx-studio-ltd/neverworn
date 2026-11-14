#!/usr/bin/env bash
# Renders a batch of library reels at 720x1280 for in-app streaming.
# Usage (repo root, server on :8765): rabbithole/reels/batch.sh <workdir> <parallel> <id...>
# Needs <workdir>/<id>-voice.wav and rabbithole/reels/build/<id>.json from voice.py.
set -uo pipefail
W=$1; J=$2; shift 2; HERE=$(cd "$(dirname "$0")" && pwd); OUT="$HERE/lib"; mkdir -p "$OUT"
one() {
  r=$1; F="$W/f-$r"; rm -rf "$F"; mkdir -p "$F"
  (cd "$HERE" && SCALE=0.6667 node render.cjs "$r" "$F" 30 > "$F.log" 2>&1) || { echo "render failed $r"; return; }
  python3 "$HERE/sound.py" "$r" "$W/$r-voice.wav" "$F/events.json" "$W/$r-mix.wav" >/dev/null || { echo "sound failed $r"; return; }
  ffmpeg -y -loglevel error -framerate 30 -i "$F/%05d.jpg" -i "$W/$r-mix.wav" -c:v libx264 -preset medium -crf 27 -pix_fmt yuv420p \
    -c:a aac -b:a 128k -af "loudnorm=I=-14:TP=-1.5:LRA=11" -shortest -movflags +faststart "$OUT/$r.mp4" &&
  ffmpeg -y -loglevel error -ss 3.2 -i "$OUT/$r.mp4" -frames:v 1 -q:v 5 "$OUT/$r.jpg" && rm -rf "$F" && echo "done $r $(du -h "$OUT/$r.mp4" | cut -f1)"
}
export -f one; export W HERE OUT
printf "%s\n" "$@" | xargs -P "$J" -I{} bash -c 'one {}'
