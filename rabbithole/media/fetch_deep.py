# Builds data/deep.json: the "deep record" layer for each case, from the intro of its Wikipedia article.
# Text is CC BY-SA 4.0; the app shows the article title, link and licence with it.
import json, re, sys, time, urllib.request, urllib.parse, urllib.error
UA = {"User-Agent": "RabbitHolePrototype/0.1 (case research)"}
D = json.load(open("data/cases.json"))
EXTRA = {"bluebook": "Project_Blue_Book", "jfk": "House_Select_Committee_on_Assassinations"}
def title(c):
    if c["id"] in EXTRA: return EXTRA[c["id"]]
    u = c["src"][1]; return urllib.parse.unquote(u.split("/wiki/")[1])
want = {c["id"]: title(c).replace("_", " ") for c in D["cases"]}
def api(params):
    q = urllib.parse.urlencode({**params, "format": "json", "formatversion": 2})
    for k in range(10):
        try: return json.load(urllib.request.urlopen(urllib.request.Request("https://en.wikipedia.org/w/api.php?" + q, headers=UA), timeout=60))
        except urllib.error.HTTPError as e:
            if e.code != 429: raise
            time.sleep(15 * (k + 1))
    raise RuntimeError("rate limited")
out = {}
ids = list(want)
for i in range(0, len(ids), 20):
    chunk = ids[i:i + 20]
    d = api({"action": "query", "prop": "extracts", "exintro": 1, "explaintext": 1, "exlimit": "max", "redirects": 1, "titles": "|".join(want[x] for x in chunk)})
    q = d["query"]; m = {}
    for n in q.get("normalized", []) + q.get("redirects", []): m[n["from"]] = n["to"]
    pages = {p["title"]: p for p in q["pages"]}
    for cid in chunk:
        t = want[cid]; t2 = m.get(m.get(t, t), m.get(t, t)); p = pages.get(t2)
        if not p or not p.get("extract"): print("missing", cid, t); continue
        txt = re.sub(r"\s+\n", "\n", p["extract"]).strip()
        paras = [x.strip() for x in txt.split("\n") if len(x.strip()) > 60]
        body, n = [], 0
        for para in paras:
            if n + len(para) > 1100 and body: break
            body.append(para); n += len(para)
        out[cid] = {"title": p["title"], "url": "https://en.wikipedia.org/wiki/" + urllib.parse.quote(p["title"].replace(" ", "_")), "paras": body}
    time.sleep(3)
json.dump(out, open("data/deep.json", "w"), indent=1, ensure_ascii=False)
print(len(out), "of", len(ids))
