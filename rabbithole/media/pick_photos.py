# Step 2 of the photo pipeline.
#   sheets: python3 -I pick_photos.py sheets <candir> <outdir>      -> contact sheets to review by eye
#   apply:  python3 -I pick_photos.py apply <candir> <picks.json> <repo rabbithole dir>
#           picks.json = {"caseId": [candidate numbers in order], ...}; copies resized photos to media/photos
#           and writes data/media.json "photos" with credit, licence and source page for each one.
import json, os, sys, re
from PIL import Image, ImageDraw, ImageOps

mode = sys.argv[1]
cand = sys.argv[2]
C = json.load(open(os.path.join(cand, "candidates.json")))

if mode == "sheets":
    out = sys.argv[3]; os.makedirs(out, exist_ok=True)
    ids = [k for k in C if C[k]]
    for s in range(0, len(ids), 8):
        rows = ids[s:s + 8]; W, H = 220, 160
        sheet = Image.new("RGB", (150 + 4 * (W + 6), len(rows) * (H + 8)), "white"); d = ImageDraw.Draw(sheet)
        for r, cid in enumerate(rows):
            y = r * (H + 8); d.text((4, y + 4), cid, fill="black")
            for c in C[cid][:4]:
                try:
                    im = Image.open(os.path.join(cand, cid, f"{c['n']:02d}.jpg")).convert("RGB"); im.thumbnail((W, H))
                    x = 150 + c["n"] * (W + 6); sheet.paste(im, (x, y)); d.rectangle([x, y, x + 22, y + 14], fill="yellow"); d.text((x + 6, y + 1), str(c["n"]), fill="black")
                except Exception as e:
                    pass
        sheet.save(os.path.join(out, f"sheet{s // 8:02d}.jpg"), quality=80)
    print("sheets in", out)

elif mode == "apply":
    picks = json.load(open(sys.argv[3])); root = sys.argv[4]
    os.makedirs(os.path.join(root, "media", "photos"), exist_ok=True)
    mp = os.path.join(root, "data", "media.json")
    media = json.load(open(mp)) if os.path.exists(mp) else {}
    media.setdefault("photos", {})
    for cid, ns in picks.items():
        out = []
        for i, n in enumerate(ns):
            c = next(x for x in C[cid] if x["n"] == n)
            im = ImageOps.exif_transpose(Image.open(os.path.join(cand, cid, f"{n:02d}.jpg"))).convert("RGB")
            im.thumbnail((1080, 1440))
            rel = f"media/photos/{cid}-{i}.jpg"
            im.save(os.path.join(root, rel), quality=78, optimize=True, progressive=True)
            artist = re.sub(r"\s+", " ", c.get("artist") or "").strip() or "Unknown"
            out.append({"f": rel, "credit": f"{artist[:60]} · {c['license'] or 'Public domain'}", "license": c["license"], "page": c["page"], "file": c["file"]})
        media["photos"][cid] = out
    json.dump(media, open(mp, "w"), indent=1, ensure_ascii=False)
    print("applied", len(picks), "cases")
