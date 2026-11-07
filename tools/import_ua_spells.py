"""Import spells from an Unearthed Arcana class PDF you own into the app's spell library.

    python tools/import_ua_spells.py "C:/path/to/UA2025-ThePsion.pdf"

Reads, from your copy of the PDF:
  * the class spell list ("CANTRIPS (LEVEL 0 PSION SPELLS)", "LEVEL 1 PSION SPELLS", ...)
  * full spell write-ups in the PDF's SPELLS section
and writes <pdf-name>.json into the app's data folder (%APPDATA%/Character Sheet/extra), which the app merges into
its library on the next start. Nothing is uploaded anywhere, and nothing goes into this project.
"""
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


def reflow(body):
    """Join hard-wrapped PDF lines into paragraphs. New paragraph when a line is indented."""
    paras = []
    for raw in body:
        line = raw.rstrip()
        indented = raw.startswith((" ", "\t", "\u2022"))
        is_head = line.strip().isupper() and len(line.strip()) > 3
        if not paras or indented or is_head or paras[-1].isupper():
            paras.append(line.strip())
        else:
            prev = paras[-1]
            paras[-1] = prev[:-1] + line.strip() if prev.endswith("-") and not prev.endswith(" -") else prev + " " + line.strip()
    return "\n\n".join(p for p in paras if p)


def parse_spells(lines):
    """Full spell blocks: TITLE / 'Level N School (Classes)' or 'School Cantrip (Classes)' / stats / text."""
    lvl_re = re.compile(r"^(?:Level (?P<l>\d) (?P<s>[A-Z][a-z]+)|(?P<s0>[A-Z][a-z]+) Cantrip)\s*\((?P<cl>.*)$")
    starts = []
    for i in range(len(lines) - 1):
        t = lines[i].strip()
        if t.isupper() and len(t) > 3 and lvl_re.match(lines[i + 1].strip()):
            starts.append(i)
    end_markers = re.compile(r"^(FEATS|.* FEATS)$")
    spells = []
    for n, i in enumerate(starts):
        stop = starts[n + 1] if n + 1 < len(starts) else len(lines)
        for j in range(i + 2, stop):
            if end_markers.match(lines[j].strip()):
                stop = j
                break
        block = lines[i:stop]
        title = block[0].strip().title().replace("’S ", "’s ").replace("'S ", "'s ")
        m = lvl_re.match(block[1].strip())
        k = 2
        classes = m.group("cl")
        while not classes.rstrip().endswith(")") and k < len(block):
            classes += " " + block[k].strip()
            k += 1
        classes = [c.strip() for c in classes.rstrip(") ").split(",") if c.strip()]
        stats = {}
        current = None
        while k < len(block):
            s = block[k].strip()
            sm = re.match(r"^(Casting Time|Range|Components|Duration):\s*(.*)$", s)
            if sm:
                current = sm.group(1)
                stats[current] = sm.group(2)
            elif current and current != "Duration" and not block[k].startswith(" "):
                stats[current] += " " + s  # wrapped stat line
            else:
                break
            k += 1
            if current == "Duration":
                break
        comps = stats.get("Components", "")
        ct = stats.get("Casting Time", "")
        if ct in ("Action", "Bonus Action", "Reaction"):
            ct = "1 " + ct.lower()
        dur = stats.get("Duration", "")
        desc = reflow(block[k:])
        desc = re.sub(r"\n\nUsing a Higher-Level Spell Slot\.", "\n\nUsing a Higher-Level Spell Slot.", desc)
        spells.append({
            "n": title, "l": int(m.group("l")) if m.group("l") else 0, "s": m.group("s") or m.group("s0"),
            "ct": ct, "r": stats.get("Range", ""), "c": comps, "d": dur,
            "co": "concentration" in dur.lower(), "ri": "ritual" in ct.lower(),
            "cl": classes, "e": "UA", "t": desc,
        })
    return spells


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    pdf = sys.argv[1]
    doc = pymupdf.open(pdf)
    lines = page_lines(doc)
    lists = parse_list(lines)
    spells = parse_spells(lines)
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
