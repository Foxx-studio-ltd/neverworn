# Registers rendered episodes (reels/lib/<id>.mp4) in data/media.json so the app's Watch feed plays them.
# artifactReels: the first episodes in drop order, which also ship inside the Claude-hosted copy.
import json, os
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
mp = os.path.join(root, "data", "media.json"); m = json.load(open(mp)) if os.path.exists(mp) else {}
order = json.load(open(os.path.join(root, "data", "cases.json")))["drops"]["order"]
lib = os.path.join(root, "reels", "lib")
def timing(i):
    # when Alice finishes asking "Real or fake?" (the app pauses there) and when the verdict lands
    try: sc = json.load(open(os.path.join(root, "reels", "build", i + ".json")))["scenes"]
    except Exception: return {}
    call = next((x for x in sc if x["scene"] == "call"), None); ver = next((x for x in sc if x["scene"] in ("verdict", "end")), None)
    if call and call.get("verdict"):   # scripted showcase cuts stamp the verdict inside the call scene: pause before the tap
        return {"ask": round(call["start"] + 1.0, 2), "verdictAt": round(call["start"] + 1.6, 2)}
    return {"ask": round(call["voiceEnd"] + .15, 2), "verdictAt": round(ver["start"] + .6, 2)} if call and ver else {}
m["reels"] = {i: {"mp4": f"reels/lib/{i}.mp4", "poster": f"reels/lib/{i}.jpg", **timing(i)} for i in order if os.path.exists(os.path.join(lib, i + ".mp4"))}
m["artifactReels"] = [i for i in order if i in m["reels"]][:8]
json.dump(m, open(mp, "w"), indent=1, ensure_ascii=False)
print(len(m["reels"]), "episodes registered")
