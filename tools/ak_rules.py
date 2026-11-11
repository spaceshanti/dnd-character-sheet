"""Character-building rules from the Arknights 5e book source: classes (table, hit dice, proficiencies,
features by level, branches), species, nationalities and backgrounds. Used by import_ak5e.py; the result
goes into src/data/extra/ak5e.json (gitignored) so the sheet can fill in a character's features."""
import re

CLASSES = ["Caster", "Defender", "Guard", "Marksman", "Medic", "Specialist", "Supporter", "Vanguard"]
LEVEL_H = re.compile(r"^#### (?:(\d+)(?:st|nd|rd|th) Level|Level (\d+)): *(.+?)\s*$", re.M)
LEVEL_STOP = r"^#### (?:\d+(?:st|nd|rd|th) Level|Level \d+)"


def _plain(s):
    from import_ak5e import plain
    return plain(s)


def _bold_field(block, name):
    m = re.search(r"\*\*\*?" + name + r":?\*\*\*?:?\s*(.*)", block)
    return re.sub(r"<br>\s*$", "", m.group(1)).strip() if m else ""


def _between(src, start_pat, end_pat, pos=0):
    a = re.compile(start_pat, re.M).search(src, pos)
    if not a:
        return "", -1
    b = re.compile(end_pat, re.M).search(src, a.end())
    return src[a.start():b.start() if b else len(src)], a.start()


def _level_features(block, stop):
    """'#### 3rd Level: Name' blocks -> [{level, name, text}], each ending at the next heading matched by stop"""
    out = []
    for m in LEVEL_H.finditer(block):
        rest = block[m.end():]
        e = re.compile(stop, re.M).search(rest)
        body = rest[:e.start()] if e else rest
        name = re.sub(r"\s*\(.*?\)\s*$", "", m.group(3)).strip()
        out.append({"level": int(m.group(1) or m.group(2)), "name": name, "text": _plain(body)})
    return out


def _table(block):
    m = re.search(r"^##### [^\n]*\n(\| *Level *\|[^\n]*\n)\|[\s:|-]+\|?\s*\n((?:\|[^\n]*\n)+)", block, re.M)
    if not m:
        return None
    cols = [c.strip() for c in m.group(1).strip().strip("|").split("|")]
    rows = {}
    for line in m.group(2).splitlines():
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        lv = re.match(r"(\d+)", cells[0])
        if lv:
            cells[0] = lv.group(1)
            rows[lv.group(1)] = cells + [""] * (len(cols) - len(cells))
    return {"columns": cols, "rows": rows}


def classes(src):
    ch = src[src.index("# Chapter 3"):src.index("# Chapter 4")]
    out = []
    for name in CLASSES:
        others = "|".join(c for c in CLASSES if c != name)
        sec, _ = _between(ch, r"^## " + name + r"\s*$", r"^## (?:" + others + r")\s*$")
        if not sec:
            print("  class not found:", name)
            continue
        # branch names come from the 1st-level Branch feature's list
        bm = re.search(r"^#### 1st Level: *\w+ Branch\s*\n(.*?)(?=^#{2,4} )", sec, re.M | re.S)
        branch_names = re.findall(r"^\s*- \*\*([^*:]+):?\*\*", bm.group(1), re.M) if bm else []
        branch_names = [b.strip() for b in branch_names]
        heads = [(m.start(), m.group(1).strip()) for m in re.finditer(r"^### (.+?)\s*$", sec, re.M)]
        # "Infuser" heads the Infusion branch; a heading has to be a single name to count ("Hunters, Assassins…" isn't)
        same = lambda n, b: n == b or (n.split()[0][:5].lower() == b[:5].lower() and len(n.split()) == len(b.split()) and "," not in n)
        starts = [(p, next(b for b in branch_names if same(n, b))) for p, n in heads if any(same(n, b) for b in branch_names)]
        first_branch = starts[0][0] if starts else len(sec)
        core = sec[:first_branch]
        feats = _level_features(core, r"^#{2,4} |^##### .*(?:Skills|Talents)\s*$")
        branches = []
        start_pos = [p for p, _ in starts]
        for p, n in starts:
            later = [q for q in start_pos if q > p]
            stop = min(later + [len(sec)])
            branches.append({"name": n, "table": _table(sec[p:stop]), "features": _level_features(sec[p:stop], r"^#{2,3} |" + LEVEL_STOP)})
        missing = [b for b in branch_names if b not in [n for _, n in starts]]
        hp = re.search(r"\*\*Hit Dice:\*\*\s*1?d(\d+)", core)
        out.append({
            "name": name, "table": _table(core), "hitDie": int(hp.group(1)) if hp else 0,
            "armor": _bold_field(core, "Armou?r"), "weapons": _bold_field(core, "Weapons"),
            "tools": _bold_field(core, "Tools"), "saves": _bold_field(core, "Saving Throws"),
            "skills": _bold_field(core, "Skills"), "features": feats, "branches": branches,
        })
        print(f"  {name}: d{out[-1]['hitDie']}, {len(feats)} features, table {'ok' if out[-1]['table'] else 'MISSING'}, "
              + ", ".join(f"{b['name']} {len(b['features'])}" for b in branches) + (f"  (missing {missing})" if missing else ""))
    return out


def _h5_features(block):
    out = []
    for part in re.split(r"^##### ", block, flags=re.M)[1:]:
        name, _, body = part.partition("\n")
        out.append({"name": name.strip(), "text": _plain(body)})
    return out


def species(src):
    ch = src[src.index("## Species"):src.index("## Nationality")]
    out, parent = [], None
    # a summon's stat block "### Actions" / "### Reactions" belongs to the species around it
    heads = [m for m in re.finditer(r"^### (.+?)\s*$", ch, re.M) if not re.match(r"^(Bonus |Legendary )?(Actions|Reactions)$", m.group(1).strip(), re.I)]
    for i, m in enumerate(heads):
        block = ch[m.end():heads[i + 1].start() if i + 1 < len(heads) else len(ch)]
        t = re.search(r"^#### [^\n]*Traits\s*$", block, re.M)
        f = re.search(r"^#### [^\n]*Features\s*$", block, re.M)
        if not t and not f:
            continue
        traits = block[t.end():f.start() if f and f.start() > t.start() else len(block)] if t else ""
        size, speed = _bold_field(traits, "Size"), _bold_field(traits, "Speed")
        entry = {"name": m.group(1).strip(), "size": _plain(size), "speed": _plain(speed),
                 "asi": _plain(_bold_field(traits, "Ability Score Improvement")),
                 "features": _h5_features(block[f.end():]) if f else []}
        if size:
            parent = entry["name"]
        elif parent:
            entry["parent"] = parent
        out.append(entry)
    print(f"  {len(out)} species ({sum(1 for s in out if 'parent' in s)} sub-species)")
    return out


def _named_feat(block, label):
    """'***Nationality Feat (Name):*** text...' -> {name, text} (text runs to the next heading or ***field***)"""
    m = re.search(r"\*\*\*" + label + r" \(([^)]+)\):\*\*\*(.*?)(?=^#{1,5} |\n\*\*\*|\Z)", block, re.M | re.S)
    return {"name": m.group(1).strip(), "text": _plain(m.group(2))} if m else None


def _choices(block, label):
    m = re.search(r"\*\*\*" + label + r":\*\*\*\s*(.*?)\n((?:\s*- [^\n]*\n)*)", block, re.S)
    if not m:
        return "", []
    return _plain(m.group(1)), [x.strip() for x in re.findall(r"^\s*- (.+)$", m.group(2), re.M)]


def nationalities(src):
    ch = src[src.index("## Nationality"):src.index("## Background")]
    out = []
    heads = list(re.finditer(r"^### (.+?)\s*$", ch, re.M))
    for i, m in enumerate(heads):
        block = ch[m.end():heads[i + 1].start() if i + 1 < len(heads) else len(ch)]
        if not re.search(r"^#### [^\n]*Features", block, re.M):
            continue
        langs = _plain(_bold_field(block, "Languages"))
        prof_text, prof_list = _choices(block, "Proficiencies")
        bg = None
        bm = re.search(r"^##### Unique Background \(([^)]+)\):?\s*\n(.*)", block, re.M | re.S)
        if bm:
            body = bm.group(2)
            bg = {"name": bm.group(1).strip(), "text": _plain(re.split(r"\*\*\*", body, maxsplit=1)[0]),
                  "proficiencies": _plain(_bold_field(body, "Proficiencies")), "feat": _named_feat(body, "Background Feat")}
        nat_block = block[:bm.start()] if bm else block
        out.append({"name": m.group(1).strip(), "languages": langs, "proficiencies": prof_text, "profChoices": prof_list,
                    "feat": _named_feat(nat_block, "Nationality Feat"), "background": bg})
    print(f"  {len(out)} nationalities ({sum(1 for n in out if n['feat'])} feats, {sum(1 for n in out if n['background'])} backgrounds)")
    return out


def backgrounds(src):
    ch = src[src.index("## Background"):src.index("# Chapter 3")]
    out = []
    heads = list(re.finditer(r"^### (.+?)\s*$", ch, re.M))
    for i, m in enumerate(heads):
        block = ch[m.end():heads[i + 1].start() if i + 1 < len(heads) else len(ch)]
        feat = _named_feat(block, "Background Feat")
        if not feat:
            continue
        out.append({"name": m.group(1).strip(), "text": _plain(re.split(r"\*\*\*", block, maxsplit=1)[0]),
                    "proficiencies": _plain(_bold_field(block, "Proficiencies")), "feat": feat})
    print(f"  {len(out)} backgrounds")
    return out


def rules(src):
    return {"classes": classes(src), "species": species(src), "nationalities": nationalities(src), "backgrounds": backgrounds(src)}


if __name__ == "__main__":
    import json
    import sys
    r = rules(open(sys.argv[1], encoding="utf-8").read())
    json.dump(r, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
