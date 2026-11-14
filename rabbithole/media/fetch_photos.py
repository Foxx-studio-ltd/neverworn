# Finds public-domain archive photos for each case from its Wikipedia article.
# Only files that Wikimedia Commons marks as public domain or CC0 are kept, with credit + source recorded.
# Usage: python3 -I fetch_photos.py <cases.json> <outdir> [case ids...]
# Writes <outdir>/<id>/NN.jpg candidates and <outdir>/candidates.json for review (pick with pick_photos.py).
import json, os, re, sys, time, urllib.request, urllib.parse, urllib.error

UA = {"User-Agent": "RabbitHolePrototype/0.1 (archive photo research)"}
cases_path, out = sys.argv[1], sys.argv[2]
only = set(sys.argv[3:])
cases = json.load(open(cases_path))["cases"]
os.makedirs(out, exist_ok=True)

def get(url, binary=False):
    for k in range(8):
        try:
            r = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90).read()
            time.sleep(2.5)
            return r if binary else json.loads(r)
        except urllib.error.HTTPError as e:
            if e.code != 429: raise
            time.sleep(12 * (k + 1))
    raise RuntimeError("rate limited: " + url)

def api(params):
    params = {**params, "format": "json", "formatversion": 2}
    return get("https://en.wikipedia.org/w/api.php?" + urllib.parse.urlencode(params))

def article(c):
    if c.get("wiki"): return c["wiki"]
    u = c["src"][1]
    return urllib.parse.unquote(u.split("/wiki/")[1]) if "/wiki/" in u else None

SKIP = re.compile(r"logo|icon|flag of|seal of|coat of arms|emblem|signature|commons-|wiki|edit-clear|question_book|symbol|padlock|portal|\.svg$|ambox|crystal|nuvola|disambig|audio|speaker|sound", re.I)
PD = re.compile(r"public domain|^pd|cc0|cc-zero|no restrictions", re.I)

want = [c for c in cases if not only or c["id"] in only]
arts = {c["id"]: article(c) for c in want}
# 1) image lists, batched
files = {}
titles = [t for t in set(arts.values()) if t]
for i in range(0, len(titles), 20):
    d = api({"action": "query", "prop": "images|pageimages", "imlimit": "max", "piprop": "name", "redirects": 1, "titles": "|".join(titles[i:i + 20])})
    norm = {n["from"]: n["to"] for n in d["query"].get("normalized", []) + d["query"].get("redirects", [])}
    back = {}
    for t in titles[i:i + 20]:
        tt = t.replace("_", " "); tt = norm.get(tt, tt); tt = norm.get(tt, tt); back[tt] = t
    for p in d["query"]["pages"]:
        imgs = [x["title"] for x in p.get("images", [])]
        lead = "File:" + p["pageimage"] if p.get("pageimage") else None
        if lead and lead in imgs: imgs.remove(lead); imgs.insert(0, lead)
        files[back.get(p["title"], p["title"])] = [x for x in imgs if not SKIP.search(x)]
# 2) licence + urls, batched
info = {}
allf = sorted({f for v in files.values() for f in v})
for i in range(0, len(allf), 40):
    d = api({"action": "query", "prop": "imageinfo", "iiprop": "url|size|mime|extmetadata", "iiurlwidth": 1280, "titles": "|".join(allf[i:i + 40])})
    for p in d["query"]["pages"]:
        ii = (p.get("imageinfo") or [{}])[0]; m = ii.get("extmetadata", {})
        lic = m.get("LicenseShortName", {}).get("value", "") + " " + m.get("License", {}).get("value", "")
        info[p["title"]] = {"mime": ii.get("mime"), "w": ii.get("width", 0), "h": ii.get("height", 0), "thumb": ii.get("thumburl"), "orig": ii.get("url"), "bytes": ii.get("size", 0),
            "page": ii.get("descriptionurl"), "license": m.get("LicenseShortName", {}).get("value", "").strip(), "pd": bool(PD.search(lic)),
            "artist": re.sub("<[^>]+>", "", m.get("Artist", {}).get("value", "")).strip()[:120],
            "desc": re.sub("<[^>]+>", "", m.get("ImageDescription", {}).get("value", "")).strip()[:200]}
# 3) download PD candidates
cands = {}
for c in want:
    fl = [f for f in files.get(arts[c["id"]], []) if f in info and info[f]["pd"] and info[f]["mime"] in ("image/jpeg", "image/png", "image/gif", "image/tiff") and info[f]["w"] >= 450][:4]
    d = os.path.join(out, c["id"]); os.makedirs(d, exist_ok=True); cands[c["id"]] = []
    for n, f in enumerate(fl):
        p = os.path.join(d, f"{n:02d}.jpg")
        if not os.path.exists(p):
            src = info[f]["orig"] if info[f]["bytes"] < 6e6 and info[f]["mime"] in ("image/jpeg", "image/png") else info[f]["thumb"].replace("//thumb.wikimedia.org/", "//upload.wikimedia.org/").split("?")[0]
            try: open(p, "wb").write(get(src, binary=True))
            except Exception as e: print("skip", f, e); continue
        cands[c["id"]].append({"n": n, "file": f, **info[f]})
    print(c["id"], arts[c["id"]], len(cands[c["id"]]), "pd candidates", flush=True)
old = {}
try: old = json.load(open(os.path.join(out, "candidates.json")))
except Exception: pass
old.update(cands)
json.dump(old, open(os.path.join(out, "candidates.json"), "w"), indent=1)
