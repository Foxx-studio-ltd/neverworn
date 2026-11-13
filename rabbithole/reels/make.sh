#!/usr/bin/env bash
# Builds the Rabbit Hole reels end to end.
# Needs: ffmpeg, Playwright (pre-installed), pip install kokoro-onnx soundfile scipy,
# and the Kokoro model files (kokoro-v1.0.int8.onnx, voices-v1.0.bin from the kokoro-onnx GitHub releases).
# Usage: rabbithole/reels/make.sh <kokoro.onnx> <voices.bin> <workdir>   (run from the repo root)
set -euo pipefail
MODEL=$1; VOICES=$2; W=$3; HERE=rabbithole/reels
mkdir -p "$W" "$HERE/build"
python3 "$HERE/voice.py" "$MODEL" "$VOICES" "$W"
cp "$W"/*.json "$HERE/build/"
(curl -s localhost:8765 >/dev/null) || (python3 -m http.server 8765 >/dev/null 2>&1 &) ; sleep 1
for r in mkultra northwoods; do
  mkdir -p "$W/f-$r"
  (cd "$HERE" && node render.cjs "$r" "$W/f-$r" 30)
  python3 "$HERE/sound.py" "$r" "$W/$r-voice.wav" "$W/f-$r/events.json" "$W/$r-mix.wav"
  ffmpeg -y -loglevel error -framerate 30 -i "$W/f-$r/%05d.jpg" -i "$W/$r-mix.wav" \
    -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -c:a aac -b:a 192k \
    -af "loudnorm=I=-14:TP=-1.5:LRA=11" -shortest -movflags +faststart "$HERE/rabbithole-$r.mp4"
  ffmpeg -y -loglevel error -ss 4 -i "$HERE/rabbithole-$r.mp4" -frames:v 1 -q:v 3 "$HERE/poster-$r.jpg"
done
echo "done: $HERE/rabbithole-*.mp4"
