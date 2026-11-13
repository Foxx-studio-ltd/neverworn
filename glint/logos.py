# Inlines brand marks (from @lobehub/icons-static-svg, MIT) into src/app.html between the //@logos marker.
# Usage: python3 logos.py <lobehub-icons-static-svg/icons> [<simple-icons/icons>]
import sys, re, json
src = sys.argv[1]
pick = {"claude": "claude-color", "openai": "openai", "grok": "grok", "gemini": "gemini-color", "perplexity": "perplexity-color"}
out = {}
for k, f in pick.items():
    s = open(f"{src}/{f}.svg").read()
    s = re.sub(r"<title>.*?</title>", "", s)
    s = re.sub(r'\s(height|width|style)="[^"]*"', "", s)
    s = s.replace("<svg", '<svg aria-hidden="true"', 1)
    out[k] = s
# Slack mark from simple-icons (CC0), coloured with Slack aubergine
import os
si = sys.argv[2] if len(sys.argv) > 2 else None
if si and os.path.exists(f"{si}/slack.svg"):
    s = open(f"{si}/slack.svg").read(); s = re.sub(r"<title>.*?</title>", "", s).replace("<svg", '<svg aria-hidden="true" fill="#4A154B"', 1); out["slack"] = s
p = "src/app.html"; h = open(p).read()
h = re.sub(r"const LOGOS = \{.*?\}; //@logos", lambda m: "const LOGOS = " + json.dumps(out) + "; //@logos", h, flags=re.S)
open(p, "w").write(h); print("ok", {k: len(v) for k, v in out.items()})
