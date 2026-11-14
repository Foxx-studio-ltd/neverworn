# Removes the "Real or fake?" and verdict scenes from rendered episodes, so each one goes from the evidence
# straight to Alice's cliffhanger. The answer lives in the case file. Usage: python3 cut_verdict.py [ids...]
import json, os, subprocess, sys
H = os.path.dirname(os.path.abspath(__file__))
ids = sys.argv[1:] or [f[:-4] for f in sorted(os.listdir(os.path.join(H, "lib"))) if f.endswith(".mp4")]
for i in ids:
    try: sc = json.load(open(os.path.join(H, "build", i + ".json")))["scenes"]
    except Exception: print("skip", i); continue
    call = next((x for x in sc if x["scene"] == "call"), None); end = next((x for x in sc if x["scene"] == "end"), None)
    if not call or not end: print("no call scene", i); continue
    a, b = call["start"] - .05, end["start"] - .15
    src = os.path.join(H, "lib", i + ".mp4"); tmp = src + ".cut.mp4"
    sel = f"not(between(t,{a:.2f},{b:.2f}))"
    r = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-vf", f"select='{sel}',setpts=N/FRAME_RATE/TB", "-af", f"aselect='{sel}',asetpts=N/SR/TB",
                        "-c:v", "libx264", "-preset", "medium", "-crf", "27", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", tmp])
    if r.returncode == 0: os.replace(tmp, src); print("cut", i, round(b - a, 1), "s removed", flush=True)
    else: print("failed", i)
