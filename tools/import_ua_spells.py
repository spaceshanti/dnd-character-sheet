"""Import spells from an Unearthed Arcana class PDF you own into the app's spell library.

    python tools/import_ua_spells.py "C:/path/to/UA2025-ThePsion.pdf"

Reads, from your copy of the PDF:
  * the class spell list ("CANTRIPS (LEVEL 0 PSION SPELLS)", "LEVEL 1 PSION SPELLS", ...)
  * full spell write-ups in the PDF's SPELLS section, formatted for the sheet (paragraphs, bold run-in
    headings, italic names, stat blocks laid out) rather than the PDF's hard-wrapped lines
and writes <pdf-name>.json into the app's data folder (%APPDATA%/Character Sheet/extra), which the app merges into
its library on the next start. Nothing is uploaded anywhere, and nothing goes into this project.
"""
import html
import json
import os
import re
import sys

try:
    import pymupdf
except ImportError:
    sys.exit("Needs PyMuPDF:  pip install pymupdf")

SCHOOLS = {"Abjuration", "Conjuration", "Divination", "Enchantment", "Evocation", "Illusion", "Necromancy", "Transmutation"}
HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(os.environ.get("APPDATA") or os.path.expanduser("~/.config"), "Character Sheet", "extra")


def page_lines(doc):
    """All text lines, minus page furniture (copyright footers, page numbers)."""
    out = []
    for page in doc:
        for raw in page.get_text().split("\n"):
            s = raw.rstrip()
            if s.strip().startswith("©") or re.fullmatch(r"\s*\d{1,3}\s*", s) or not s.strip():
                continue
            out.append(s)
    return out


def clean_name(s):
    s = re.sub(r"\(appears in this\s*UA\)", "", s, flags=re.I)
    return re.sub(r"\s+", " ", s).strip()


def parse_list(lines):
    """Class spell list tables -> {class: {level: [(name, school, special)]}}"""
    head = re.compile(r"^(?:CANTRIPS \(LEVEL 0 (?P<c0>[A-Z' ]+?) SPELLS\)|LEVEL (?P<lv>\d) (?P<c>[A-Z' ]+?) SPELLS)\s*$")
    result = {}
    cls = level = None
    name_parts = []
    i = 0
    while i < len(lines):
        s = lines[i].strip()
        m = head.match(s)
        if m:
            cls = (m.group("c0") or m.group("c")).title()
            level = 0 if m.group("c0") else int(m.group("lv"))
            result.setdefault(cls, {}).setdefault(level, [])
            name_parts = []
            i += 1
            continue
        if cls is not None:
            if s in ("Spell", "School", "Special"):
                pass
            elif s in SCHOOLS and name_parts:
                special = lines[i + 1].strip() if i + 1 < len(lines) else ""
                result[cls][level].append((clean_name(" ".join(name_parts)), s, special))
                name_parts = []
                i += 2
                continue
            elif s.isupper() and len(s) > 3 and not head.match(s):
                cls = None  # left the table section
                name_parts = []
            else:
                name_parts.append(s)
        i += 1
    return result


def _span_html(span):
    t = html.escape(span["text"])
    f = span["font"]
    if not t.strip():
        return t
    lead = t[: len(t) - len(t.lstrip())]
    trail = t[len(t.rstrip()):]
    core = t.strip()
    if "Bold" in f:
        core = f"<b>{core}</b>"
    elif "Italic" in f:
        core = f"<i>{core}</i>"
    return lead + core + trail


def _caps(spans):
    """'I' 'NTELLECT ' 'F' 'ORTRESS' (small caps) -> 'Intellect Fortress'"""
    raw = "".join(s["text"] for s in spans).replace("’", "'").strip()
    words = raw.lower().split()
    small = {"of", "the", "and", "a", "an", "to", "in", "on", "for"}
    out = [w if (i and w in small) else w[:1].upper() + w[1:] for i, w in enumerate(words)]
    return re.sub(r"'S\b", "'s", " ".join(out))


def doc_lines(doc, first_page, last_page):
    """Every text line on those pages (0-based), in reading order, with its spans; footers dropped."""
    out = []
    for pn in range(first_page, last_page + 1):
        for b in doc[pn].get_text("dict")["blocks"]:
            for l in b.get("lines", []):
                spans = [s for s in l["spans"] if s["text"]]
                text = "".join(s["text"] for s in spans)
                if not text.strip() or text.strip().startswith("©") or "Wizards of the Coast LLC" in text or re.fullmatch(r"\s*\d{1,3}\s*", text):
                    continue
                out.append({"spans": spans, "text": text, "size": max(s["size"] for s in spans), "font": spans[0]["font"]})
    return out


def is_spell_title(line):
    s = line["spans"][0]
    return "Cambria" in s["font"] and s["size"] >= 12 and line["text"].strip()[:1].isupper()


ABIL = ("Str", "Dex", "Con", "Int", "Wis", "Cha")


def body_html(lines):
    """A spell's description lines -> simple HTML (paragraphs, bold run-in headings, a stat block if there is one)."""
    paras = []  # list of [kind, html]
    abilities = []
    for ln in lines:
        spans = ln["spans"]
        text = ln["text"]
        first = spans[0]
        # stat block pieces
        if "Bold" in first["font"] and first["size"] >= 14:
            paras.append(["h", f"<h4>{html.escape(_caps(spans))}</h4>"])
            continue
        if "Bold" in first["font"] and first["size"] >= 11.5 and text.strip().replace(" ", "").isalpha() and len(text.strip()) < 14:
            paras.append(["h", f"<p><b>{html.escape(_caps(spans))}</b></p>"])
            continue
        if first["size"] < 7:  # MOD / SAVE column labels
            continue
        if first["text"].strip() in ABIL and "Bold" in first["font"]:
            m = re.match(r"\s*(\d+)(?:\s+([+-]\d+))?", "".join(s["text"] for s in spans[1:]))
            if m:
                # the modifier sometimes sits in its own column: work it out from the score
                mod = m.group(2) or f"{(int(m.group(1)) - 10) // 2:+d}"
                abilities.append(f"<b>{first['text'].strip()}</b> {m.group(1)} ({mod})")
            continue
        if re.fullmatch(r"\s*[+-]\d+\s*", text):  # a save value on its own
            continue
        if abilities:
            paras.append(["p", "<p>" + " · ".join(abilities) + "</p>"])
            abilities = []
        h = "".join(_span_html(s) for s in spans)
        # a bold run-in heading that wrapped onto this line ("…(Ectoplasmic Entity and Ghostly" / "Entity Only).") continues it
        heading_wraps = bool(paras) and paras[-1][1].endswith("</b>") and not re.search(r"[.:]</b>$", paras[-1][1])
        starts_para = not heading_wraps and (
            not paras or paras[-1][0] == "h"
            or text.startswith((" ", "•"))
            or ("Bold" in first["font"] and first["text"].strip())
            or (first["font"].endswith("Italic") and "Bold" not in first["font"] and paras[-1][0] == "meta")
        )
        if "Italic" in first["font"] and "Bold" not in first["font"] and re.match(r"(Medium|Small|Large|Tiny|Huge) ", text.strip()):
            paras.append(["meta", f"<p><i>{html.escape(text.strip())}</i></p>"])
            continue
        if starts_para:
            paras.append(["p", h.strip()])
        else:
            prev = paras[-1][1]
            # rejoin a word hyphenated across lines
            if re.search(r"[a-z]-$", prev) and not prev.endswith(" -"):
                paras[-1][1] = prev[:-1] + h.lstrip()
            else:
                paras[-1][1] = prev.rstrip() + " " + h.strip()
    if abilities:
        paras.append(["p", "<p>" + " · ".join(abilities) + "</p>"])
    out = []
    for kind, h in paras:
        if h.startswith("<p>") or h.startswith("<h4>"):
            out.append(h)
        else:
            # bullets
            if h.startswith("•"):
                out.append(f"<ul><li>{h.lstrip(chr(0x2022)).strip()}</li></ul>")
            else:
                out.append(f"<p>{h}</p>")
    s = "".join(out)
    s = s.replace("</ul><ul>", "")
    # tidy: double spaces, spaces before punctuation, curly quotes the PDF split
    s = re.sub(r"\s{2,}", " ", s)
    # a bold / italic run split across lines or spans becomes one
    s = re.sub(r"</b>( ?)<b>", r"\1", s)
    s = re.sub(r"</i>( ?)<i>", r"\1", s)
    return s


def parse_spells_html(doc):
    """The SPELLS chapter: title / 'Level N School (Classes)' / Casting Time… Duration / text, to the FEATS chapter."""
    toc = doc.get_toc()
    first = next(p for l, t, p in toc if t.strip().lower() == "spells") - 1
    last = next((p for l, t, p in toc if t.strip().lower() == "feats"), doc.page_count) - 1
    lines = doc_lines(doc, first, last)
    # stop at the Feats chapter
    for i, ln in enumerate(lines):
        if ln["text"].strip().upper().replace(" ", "") == "FEATS" and ln["size"] >= 15:
            lines = lines[:i]
            break
    starts = [i for i, ln in enumerate(lines) if is_spell_title(ln) and i + 1 < len(lines) and re.match(r"\s*(Level \d|[A-Z][a-z]+ Cantrip)", lines[i + 1]["text"])]
    lvl_re = re.compile(r"^(?:Level (?P<l>\d) (?P<s>[A-Z][a-z]+)|(?P<s0>[A-Z][a-z]+) Cantrip)\s*\((?P<cl>.*)$")
    spells = []
    for n, i in enumerate(starts):
        block = lines[i:(starts[n + 1] if n + 1 < len(starts) else len(lines))]
        name = _caps(block[0]["spans"])
        k = 1
        meta = block[k]["text"].strip()
        while not meta.rstrip().endswith(")") and k + 1 < len(block):
            k += 1
            meta += " " + block[k]["text"].strip()
        m = lvl_re.match(meta)
        classes = [c.strip() for c in m.group("cl").rstrip(") ").split(",") if c.strip()]
        k += 1
        stats, cur = {}, None
        while k < len(block):
            t = block[k]["text"].strip()
            sm = re.match(r"^(Casting Time|Range|Components|Duration):\s*(.*)$", t)
            if sm:
                cur = sm.group(1)
                stats[cur] = sm.group(2).strip()
            elif cur and cur != "Duration":
                stats[cur] += " " + t
            else:
                break
            k += 1
            if cur == "Duration":
                break
        ct = stats.get("Casting Time", "")
        if ct in ("Action", "Bonus Action", "Reaction"):
            ct = "1 " + ct.lower()
        dur = stats.get("Duration", "")
        spells.append({
            "n": name, "l": int(m.group("l")) if m.group("l") else 0, "s": m.group("s") or m.group("s0"),
            "ct": ct, "r": stats.get("Range", ""), "c": stats.get("Components", ""), "d": dur,
            "co": "concentration" in dur.lower(), "ri": "ritual" in ct.lower(), "m": bool(re.search(r"worth|consume", stats.get("Components", ""), re.I)),
            "cl": classes, "e": "UA", "t": body_html(block[k:]),
        })
    return spells


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    pdf = sys.argv[1]
    doc = pymupdf.open(pdf)
    lines = page_lines(doc)
    lists = parse_list(lines)
    spells = parse_spells_html(doc)
    title = os.path.splitext(os.path.basename(pdf))[0]
    data = {
        "source": title,
        "spells": spells,
        "classLists": {
            cls: {str(lv): [{"n": n, "s": sch, "special": sp} for n, sch, sp in rows] for lv, rows in levels.items()}
            for cls, levels in lists.items()
        },
    }
    os.makedirs(OUT_DIR, exist_ok=True)
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    out = os.path.join(OUT_DIR, slug + ".json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    print(f"Wrote {os.path.relpath(out)}")
    print(f"  full spells: {len(spells)} ({', '.join(s['n'] for s in spells)})")
    for cls, levels in lists.items():
        print(f"  {cls} spell list: {sum(len(v) for v in levels.values())} spells across levels {sorted(levels)}")


if __name__ == "__main__":
    main()
