#!/usr/bin/env python3
"""Builds the AUTO part of css/theme-sky.css: every CSS rule that paints lime,
dark-green or violet and can apply in LIGHT mode gets a light-only copy with
sky-blue colours. Dark mode rules are never touched.
Run: python3 tools/build-theme-sky.py   (then: npm run bump)
The hand-written part lives in css/theme-sky-base.css and is copied on top."""
import re, os, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP = {"theme-sky.css", "theme-sky-base.css", "home-v2.css"}
LIGHT = ':root[data-theme="light"]'

STRONG_LIME = "c5ff60 d9ff7b d7ff8a a6e33f 9bef4f 9fd64a bce950 9ef06a b9f58c c8f56a b8ff5a".split()
PALE_LIME = "cdefa9 cfff9b dfff88 dcff9c a6df79 cdeb98 c9e5a7 e9fbc4".split()
INK_ON_LIME = "142a04 1d3a08 31501a 3d6604".split()
DARK_GREEN = "0f3326 10201a 102016 203427 1f4a38 1b2c23 26392d".split()
VIOLET = "a88fec 8b5cf6 8064c9 7c5ce0 7a52d6 6a4fc4 6952d9 8068b6 b5a0f4 8067cf".split()
PALE_VIOLET = "d1baff d7b8ff".split()
LIGHT_TEXT = "eef6e8 f4fff7 dce8e0 a9c9b4 8fb39c".split()

BLUE, BLUE_INK, BLUE_PALE = "#3b82f6", "#1d4ed8", "#dbeafe"
INK, INK2 = "#0f1b33", "#4b5b76"

def hexes(group):
    return "|".join(group)

RX_STRONG = re.compile(r"#(?:%s)\b" % hexes(STRONG_LIME), re.I)
RX_PALE = re.compile(r"#(?:%s)\b" % hexes(PALE_LIME), re.I)
RX_INK = re.compile(r"#(?:%s)\b" % hexes(INK_ON_LIME), re.I)
RX_DARK = re.compile(r"#(?:%s)\b" % hexes(DARK_GREEN), re.I)
RX_VIOLET = re.compile(r"#(?:%s)\b" % hexes(VIOLET), re.I)
RX_PVIOLET = re.compile(r"#(?:%s)\b" % hexes(PALE_VIOLET), re.I)
RX_LTEXT = re.compile(r"#(?:%s)\b" % hexes(LIGHT_TEXT), re.I)
RX_RGBA_LIME = re.compile(r"rgba?\(\s*(?:197\s*,\s*255\s*,\s*96|217\s*,\s*255\s*,\s*123|166\s*,\s*227\s*,\s*63)\s*(,\s*[\d.]+\s*)?\)", re.I)
RX_RGBA_VIOLET = re.compile(r"rgba?\(\s*168\s*,\s*143\s*,\s*236\s*(,\s*[\d.]+\s*)?\)", re.I)
TRIGGER = re.compile("|".join(r.pattern for r in (RX_STRONG, RX_PALE, RX_DARK, RX_VIOLET, RX_PVIOLET, RX_RGBA_LIME, RX_RGBA_VIOLET)), re.I)

def strip_comments(css):
    return re.sub(r"/\*.*?\*/", "", css, flags=re.S)

def blocks(css):
    """yield (prelude, body) at top level, keeping nested @media bodies raw"""
    i, n = 0, len(css)
    while i < n:
        j = css.find("{", i)
        if j < 0:
            return
        prelude = css[i:j].strip()
        depth, k = 1, j + 1
        while k < n and depth:
            if css[k] == "{": depth += 1
            elif css[k] == "}": depth -= 1
            k += 1
        yield prelude, css[j + 1:k - 1]
        i = k

def light_selector(sel):
    sel = sel.strip()
    if 'data-theme="dark"' in sel or "data-theme='dark'" in sel:
        return None
    if 'data-theme="light"' in sel:
        return sel
    if sel.startswith(":root"):
        return LIGHT + sel[5:]
    if sel.startswith("html"):
        return LIGHT + sel[4:]
    return f"{LIGHT} {sel}"

def convert(decls):
    """decls: list of (prop, value). Returns new list or [] when nothing to change."""
    props = {p for p, _ in decls}
    bg_was_lime = any(p.startswith("background") and (RX_STRONG.search(v) or RX_RGBA_LIME.search(v)) for p, v in decls)
    bg_was_dark = any(p.startswith("background") and RX_DARK.search(v) for p, v in decls)
    out = []
    for prop, val in decls:
        new = val
        is_text = prop in ("color", "-webkit-text-fill-color", "caret-color")
        if is_text:
            if RX_STRONG.search(new) or RX_RGBA_LIME.search(new):
                new = RX_RGBA_LIME.sub(BLUE_INK, RX_STRONG.sub(BLUE_INK, new))
            if RX_INK.search(new):
                new = RX_INK.sub("#ffffff" if bg_was_lime else BLUE_INK, new)
            if RX_DARK.search(new):
                new = RX_DARK.sub("#ffffff" if bg_was_lime else INK, new)
            if bg_was_dark and RX_LTEXT.search(new):
                new = RX_LTEXT.sub(lambda m: INK2 if m.group(0).lower() in ("#a9c9b4", "#8fb39c") else INK, new)
            new = RX_PALE.sub(BLUE_INK, new)
            new = RX_VIOLET.sub("#2563eb", new)
        else:
            new = RX_STRONG.sub(BLUE, new)
            new = RX_PALE.sub(BLUE_PALE, new)
            new = RX_DARK.sub("#ffffff" if prop.startswith("background") else "#dbe7fb", new)
            new = RX_VIOLET.sub(BLUE, new)
            new = RX_PVIOLET.sub(BLUE_PALE, new)
            new = RX_RGBA_LIME.sub(lambda m: f"rgba(59, 130, 246{m.group(1) or ', 1'})", new)
            new = RX_RGBA_VIOLET.sub(lambda m: f"rgba(59, 130, 246{m.group(1) or ', 1'})", new)
            new = RX_INK.sub(BLUE_INK, new)
        if new != val:
            out.append((prop, new))
    # a dark card turned white: its light text must turn dark
    if bg_was_dark and "color" in props and not any(p == "color" for p, _ in out):
        for p, v in decls:
            if p == "color" and RX_LTEXT.search(v):
                out.append((p, RX_LTEXT.sub(INK, v)))
    return out

def parse_decls(body):
    decls = []
    for part in body.split(";"):
        if ":" not in part:
            continue
        p, v = part.split(":", 1)
        p, v = p.strip().lower(), v.strip()
        if not p or not v:
            continue
        v = re.sub(r"\s*!important\s*$", "", v)
        decls.append((p, v))
    return decls

def rules(css, media=None):
    for prelude, body in blocks(css):
        if prelude.startswith("@media") or prelude.startswith("@supports"):
            yield from rules(body, prelude)
        elif prelude.startswith("@"):
            continue  # keyframes, font-face …
        elif TRIGGER.search(body):
            yield media, prelude, body

def main():
    out = []
    count = 0
    for path in sorted(glob.glob(os.path.join(ROOT, "css", "*.css"))):
        name = os.path.basename(path)
        if name in SKIP:
            continue
        css = strip_comments(open(path, encoding="utf-8").read())
        chunk = []
        for media, prelude, body in rules(css):
            sels = [s for s in (light_selector(s) for s in prelude.split(",")) if s]
            if not sels:
                continue
            new = convert(parse_decls(body))
            if not new:
                continue
            text = ",\n".join(sels) + " { " + " ".join(f"{p}: {v} !important;" for p, v in new) + " }"
            chunk.append(f"{media} {{ {text} }}" if media else text)
            count += 1
        if chunk:
            out.append(f"/* from {name} */\n" + "\n".join(chunk))
    base = open(os.path.join(ROOT, "css", "theme-sky-base.css"), encoding="utf-8").read()
    head = "/* MYLIFE light mode = sky blue. GENERATED by tools/build-theme-sky.py — edit css/theme-sky-base.css, then re-run. Dark mode is not touched. */\n"
    with open(os.path.join(ROOT, "css", "theme-sky.css"), "w", encoding="utf-8") as f:
        f.write(head + "\n".join(out) + "\n\n/* ---- hand-written (css/theme-sky-base.css) ---- */\n" + base)
    print(f"theme-sky.css: {count} light rules converted")

main()
