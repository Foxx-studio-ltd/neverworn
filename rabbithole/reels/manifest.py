# Registers rendered episodes (reels/lib/<id>.mp4) in data/media.json so the app's Watch feed plays them.
# artifactReels: the first episodes in drop order, which also ship inside the Claude-hosted copy.
import json, os
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
mp = os.path.join(root, "data", "media.json"); m = json.load(open(mp)) if os.path.exists(mp) else {}
order = json.load(open(os.path.join(root, "data", "cases.json")))["drops"]["order"]
lib = os.path.join(root, "reels", "lib")
m["reels"] = {i: {"mp4": f"reels/lib/{i}.mp4", "poster": f"reels/lib/{i}.jpg"} for i in order if os.path.exists(os.path.join(lib, i + ".mp4"))}
m["artifactReels"] = [i for i in order if i in m["reels"]][:8]
json.dump(m, open(mp, "w"), indent=1, ensure_ascii=False)
print(len(m["reels"]), "episodes registered")
