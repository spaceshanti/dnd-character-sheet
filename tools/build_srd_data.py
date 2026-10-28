"""Build the D&D 2024 rules data the auto-fill uses, from the free SRD 5.2.1 PDF (CC-BY-4.0).

    python tools/build_srd_data.py "SRD_CC_v5.2.1.pdf"

Writes src/data/srd52.json: classes (core traits, the per-level features table, every feature, subclasses with
their always-prepared spells), species, backgrounds and feats. The SRD is published by Wizards of the Coast under
CC-BY-4.0 (https://creativecommons.org/licenses/by/4.0/), so this file ships with the app (credited in the README).
"""
import json
import os
import re
import sys

try:
    import pymupdf
except ImportError:
    sys.exit("Needs PyMuPDF:  pip install pymupdf")

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "data", "srd52.json")
VALUE = re.compile(r"^(—|-|\+?\d+(d\d+)?|\d+d\d+|\d+/\d+)$")


def clean(t):
    """PDF text → readable paragraphs."""
    t = t.replace("­", "")
    t = re.sub(r"(\w)-\n(\w)", r"\1\2", t)          # hyphenated line breaks
    t = re.sub(r"\n?•\s*", "\n• ", t)                  # bullets
    t = t.replace("\t", "\n\n")                        # a tab starts a paragraph
    t = re.sub(r"(?<!\n)\n(?![\n•])", " ", t)          # single line breaks inside a paragraph
    t = re.sub(r"[  ]+", " ", t)
    t = re.sub(r"\n +", "\n", t)
    t = re.sub(r"\n{3,}", "\n\n", t)
    return t.strip()


class Book:
    def __init__(self, path):
        self.d = pymupdf.open(path)
        self.toc = [(l, t.strip(), p) for l, t, p in self.d.get_toc()]
        self.tables = {}

    def page_tables(self, pn):
        if pn not in self.tables:
            self.tables[pn] = self.d[pn].find_tables().tables
        return self.tables[pn]

    def page_lines(self, pn):
        """the page's text without its tables (or the header words right above a big table) and page furniture"""
        page = self.d[pn]
        boxes = [t.bbox for t in self.page_tables(pn)]
        big = [t.bbox for t in self.page_tables(pn) if t.row_count >= 8]
        out = []
        for x0, y0, x1, y1, txt, *_ in page.get_text("blocks"):
            if any(x0 >= a - 2 and y0 >= b - 2 and x1 <= c + 2 and y1 <= e + 2 for a, b, c, e in boxes):
                continue
            if any(y1 <= b + 2 and y0 >= b - 60 and x0 >= a - 4 and x1 <= c + 4 for a, b, c, e in big):
                continue
            if txt.startswith("System Reference Document"):
                continue
            out.append(txt)
        return "".join(out)

    def text(self, first, last):
        return "".join(self.page_lines(pn) for pn in range(first - 1, last))

    def features_table(self, first, last):
        """the 20-level table of a class: {columns: [...], rows: {level: [cells]}}"""
        for pn in range(first - 1, last):
            for t in self.page_tables(pn):
                rows = t.extract()
                if t.row_count < 15 or not rows or not (rows[0][0] or "").strip().startswith("1"):
                    continue
                cols = t.col_count
                # column names: the words just above the table, by column position
                full = next((r for r in t.rows if all(c is not None for c in r.cells)), None)
                xs = [(c[0], c[2]) for c in full.cells] if full else []
                names = [[] for _ in range(cols)]
                for x0, y0, x1, y1, w, *_ in self.d[pn].get_text("words"):
                    if t.bbox[1] - 48 <= y1 <= t.bbox[1] + 1 and t.bbox[0] - 2 <= x0 <= t.bbox[2]:
                        cx = (x0 + x1) / 2
                        for i, (a, b) in enumerate(xs):
                            if a - 3 <= cx <= b + 3:
                                names[i].append((round(y0), x0, w))
                columns = []
                for i, ws in enumerate(names):
                    ws.sort()
                    digit = [w for _, _, w in ws if re.fullmatch(r"[1-9]", w)]
                    columns.append(digit[0] if digit else " ".join(w for _, _, w in ws if w not in ("Spell", "Slots", "per", "Level") or len(ws) <= 2))
                columns[0], columns[1], columns[2] = "Level", "Proficiency Bonus", "Class Features"
                table = {}
                for r in rows:
                    cells = [(c or "").replace("\n", " ").strip() for c in r]
                    if sum(1 for c in cells if c) == 1:
                        # a merged row: "2 +2 Danger Sense, Reckless Attack 2 +2 2"
                        toks = cells[0].split()
                        if len(toks) < 2 or not toks[0].isdigit():
                            continue
                        lvl, pb, rest = toks[0], toks[1], toks[2:]
                        vals = [x for x in rest if VALUE.match(x)]
                        words = [x for x in rest if not VALUE.match(x)]
                        vals = vals[-(cols - 3):] if cols > 3 else []
                        cells = [lvl, pb, " ".join(words)] + vals + [""] * (cols - 3 - len(vals))
                    if cells[0].isdigit():
                        table[int(cells[0])] = cells
                if len(table) >= 15:
                    return {"columns": columns, "rows": table}
        return None

    def two_col_tables(self, first, last):
        """small [level, spells] tables (a subclass's always-prepared spells)"""
        out = {}
        for pn in range(first - 1, last):
            for t in self.page_tables(pn):
                for r in t.extract():
                    if len(r) == 2 and (r[0] or "").strip().isdigit() and r[1]:
                        out[int(r[0])] = [s.strip() for s in r[1].replace("\n", " ").split(",") if s.strip()]
        return out


def split_titles(text, titles):
    """cut text at each title line (in order); returns {title: segment}"""
    out, pos = {}, 0
    marks = []
    for t in titles:
        # titles can wrap onto two lines ("Barbarian Subclass: Path of the\nBerserker")
        m = re.search(r"(?m)^" + r"\s+".join(map(re.escape, t.split())) + r"[ \t]*$", text[pos:])
        if not m:
            continue
        marks.append((t, pos + m.start(), pos + m.end()))
        pos = pos + m.end()
    for i, (t, a, b) in enumerate(marks):
        end = marks[i + 1][1] if i + 1 < len(marks) else len(text)
        out[t] = text[b:end]
    return out


def level_features(seg):
    """'Level 3: Name' blocks → [{level, name, text}]"""
    parts = re.split(r"(?m)^Level (\d+): (.+)$", seg)
    feats = []
    for i in range(1, len(parts), 3):
        feats.append({"level": int(parts[i]), "name": parts[i + 1].strip(), "text": clean(parts[i + 2])})
    return feats


CORE_KEYS = ["Primary Ability", "Hit Point Die", "Saving Throw Proficiencies", "Skill Proficiencies", "Weapon Proficiencies",
             "Tool Proficiencies", "Armor Training", "Starting Equipment"]


def core_traits(book, pn):
    for t in book.page_tables(pn - 1) + book.page_tables(pn):
        rows = t.extract()
        if rows and (rows[0][0] or "").startswith("Primary Ability"):
            flat = " ".join(" ".join(c or "" for c in r) for r in rows).replace("\n", " ")
            flat = re.sub(r"(\w)- (\w)", r"\1\2", flat)
            out = {}
            keys = [k for k in CORE_KEYS if k.split()[0] in flat]
            for k in CORE_KEYS:
                pat = r"\s*".join(map(re.escape, k.split()))
                m = re.search(pat + r"\s+(.*?)(?=" + "|".join(r"\s*".join(map(re.escape, x.split())) for x in CORE_KEYS if x != k) + r"|$)", flat)
                if m:
                    out[k] = re.sub(r"\s+", " ", m.group(1)).strip()
            return out
    return {}


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    book = Book(sys.argv[1])
    toc = book.toc
    idx = lambda title, lvl=None: next(i for i, e in enumerate(toc) if e[1] == title and (lvl is None or e[0] == lvl))

    # ---------- classes
    ci = idx("Classes", 2)
    end = idx("Character Origins", 2)
    entries = toc[ci + 1:end]
    first_page, last_page = toc[ci][2], toc[end][2]
    text = book.text(first_page, last_page)
    titles = [t for _, t, _ in entries]
    segs = split_titles(text, titles)
    classes = []
    for i, (lvl, name, page) in enumerate(entries):
        if lvl != 3:
            continue
        nxt = next((e for e in entries[i + 1:] if e[0] == 3), toc[end])
        subs = [e for e in entries[i + 1:entries.index(nxt) if nxt in entries else len(entries)] if e[0] == 4]
        core = core_traits(book, page)
        seg = segs.get(name, "")
        feats = level_features(seg)
        # option lists (Metamagic, Eldritch Invocations) go onto the feature they belong to
        for _, sname, _ in subs:
            if "Options" in sname:
                key = sname.replace(" Options", "").split()[0].lower()
                f = next((f for f in feats if key in f["name"].lower()), None)
                if f:
                    f["text"] += "\n\n" + sname + "\n\n" + clean(segs.get(sname, ""))
        spell_ability = ""
        m = re.search(r"(\w+) is (?:your|the) spellcasting ability", " ".join(f["text"] for f in feats))
        if m:
            spell_ability = m.group(1)
        subclasses = []
        for j, (_, sname, spage) in enumerate(subs):
            if "Subclass:" not in sname:
                continue
            after = next((e for e in entries[entries.index((4, sname, spage)) + 1:] if True), toc[end])
            sfeats = level_features(segs.get(sname, ""))
            spells = book.two_col_tables(spage, after[2])
            subclasses.append({"name": sname.split("Subclass:", 1)[1].strip(), "features": sfeats, "spells": spells})
        table = book.features_table(page, nxt[2])
        # header cells sometimes pick up the end of a sentence above the table ("choice Cantrips")
        if table:
            table["columns"] = [re.sub(r"^(?:[a-z][\w’']*\s+)+", "", c.split(". ")[-1]) for c in table["columns"]]
        # the table's level-20 row sits on the next page and lands in the middle of a feature's text: move it back
        if table and "20" not in table["rows"]:
            k = len(table["columns"]) - 3
            for f in feats:
                val = r"(?:\+\d+ ft\.?|[+-]?\d+(?:d\d+)?|[Dd]\d+|—)"
                m = re.search(r" ?20 \+6 ((?:[A-Z][\w’']*|of|and|the|feature)(?: (?:[A-Z][\w’']*|of|and|the|feature))*)((?: %s){%d})(?= |\n|$)" % (val, k), f["text"])
                if m:
                    table["rows"]["20"] = ["20", "+6", m.group(1)] + re.findall(val, m.group(2))
                    f["text"] = f["text"][:m.start()] + f["text"][m.end():]
                    break
        classes.append({
            "name": name, "core": core, "spellAbility": spell_ability,
            "table": table, "features": feats, "subclasses": subclasses,
        })
        print(f"  {name}: {len(feats)} features, table {'ok' if classes[-1]['table'] else 'MISSING'}, "
              f"{len(subclasses)} subclass ({sum(len(s['features']) for s in subclasses)} features, {sum(len(s['spells']) for s in subclasses)} spell levels)")

    # ---------- backgrounds and species
    bi, si, fi = idx("Character Backgrounds"), idx("Character Species"), idx("Feats", 2)
    otext = book.text(toc[bi][2], toc[fi][2] + 1)
    bg_titles = [t for l, t, _ in toc[bi + 1:si] if l == 4]
    sp_titles = [t for l, t, _ in toc[si + 1:fi] if l == 4]
    osegs = split_titles(otext, bg_titles + ["Character Species"] + sp_titles + ["Feats"])
    backgrounds = []
    for b in bg_titles:
        seg = re.sub(r"\s+", " ", osegs.get(b, ""))
        field = lambda k: (re.search(k + r":\s*(.*?)(?=\s(?:Ability Scores|Feat|Skill Proficiencies|Tool Proficiency|Equipment):|$)", seg) or [None, ""])[1].strip()
        backgrounds.append({"name": b, "abilities": field("Ability Scores"), "feat": re.sub(r"\s*\(see “Feats”\)", "", field("Feat")),
                            "skills": field("Skill Proficiencies"), "tools": re.sub(r"\s*\(see “Equipment”\)", "", field("Tool Proficiency")),
                            "equipment": field("Equipment")})
    species = []
    for s in sp_titles:
        seg = osegs.get(s, "")
        head = lambda k: (re.search(k + r":\s*(.+)", seg) or [None, ""])[1].strip()
        body = seg.split("special traits.", 1)[1] if "special traits." in seg else seg
        traits = []
        for para in re.split(r"\t", body):
            m = re.match(r"\s*([A-Z][\w’' ]{2,40}?)\.\s+(.*)", para, re.S)
            if m:
                traits.append({"name": m.group(1).strip(), "text": clean(m.group(2))})
            elif traits:
                traits[-1]["text"] += "\n\n" + clean(para)
        species.append({"name": s, "size": head("Size"), "speed": head("Speed"), "traits": traits})
        print(f"  {s}: {len(traits)} traits, speed {species[-1]['speed']}")

    # ---------- feats
    ftext = book.text(toc[fi][2], toc[idx("Equipment", 2)][2])
    ftext = ftext[ftext.find("Origin Feats"):]
    feats = []
    for m in re.finditer(r"(?m)^([A-Z][\w’' ]+)\n((?:Origin|General|Fighting Style|Epic Boon) Feat[^\n]*)\n", ftext):
        start = m.end()
        nxt = re.search(r"(?m)^[A-Z][\w’' ]+\n(?:Origin|General|Fighting Style|Epic Boon) Feat", ftext[start:])
        body = ftext[start:start + nxt.start()] if nxt else ftext[start:]
        body = re.split(r"(?m)^(?:General Feats|Fighting Style Feats|Epic Boon Feats)\s*$", body)[0]
        feats.append({"name": m.group(1).strip(), "kind": m.group(2).strip(), "text": clean(body)})
    print(f"  {len(feats)} feats")

    data = {"source": "System Reference Document 5.2.1 (CC-BY-4.0, Wizards of the Coast)", "classes": classes,
            "species": species, "backgrounds": backgrounds, "feats": feats}
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    print(f"-> {os.path.normpath(OUT)} ({os.path.getsize(OUT) // 1024} KB)")


if __name__ == "__main__":
    main()
