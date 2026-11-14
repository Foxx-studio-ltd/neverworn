# Writes data/community.json from the cast and their rendered clips. The app loads it on start and on Refresh.
import json, os, time
H = os.path.dirname(os.path.abspath(__file__)); R = os.path.join(H, "..")
cast = json.load(open(os.path.join(H, "cast.json")))["cast"]
posts = []; base = int(time.time() * 1000)
for i, c in enumerate(cast):
    if not os.path.exists(os.path.join(H, "clips", c["id"] + ".mp4")): continue
    posts.append({"id": c["id"], "handle": c["handle"], "name": c["name"], "bio": c["bio"], "caseId": c["case"], "fictional": True,
                  "mp4": f"community/clips/{c['id']}.mp4", "poster": f"community/clips/{c['id']}.jpg",
                  "caption": c["script"].split(". ")[0] + ".", "at": base - i * 3600 * 1000})
json.dump({"updated": base, "posts": posts}, open(os.path.join(R, "data", "community.json"), "w"), indent=1, ensure_ascii=False)
print(len(posts), "posts")
