"""Import the Arknights 5e homebrew (homebrewery.naturalcrit.com) into the app's libraries.

    python tools/import_ak5e.py                      # downloads the current version
    python tools/import_ak5e.py path/to/source.txt   # or reads a copy you saved

Reads the book's markdown source and writes src/data/extra/ak5e.json with
  * every Arts pool (Flame Arts, Healing Arts, ...) as a class list, so the spell library can filter by pool
  * the full text of the new Arts the book adds
  * every Operator Skill table (Basic / Advanced / Elite, per class and branch)
and src/data/book/ak5e.md, the whole book for the in-app sourcebook reader.
The app merges the file into its libraries on the next start. Nothing is uploaded anywhere.
"""
import html
import json
import os
import re
import sys
import urllib.request

SOURCE_URL = "https://homebrewery.naturalcrit.com/source/mt8mcG6iRDbv"
BOOK = "Arknights 5e"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "src", "data", "extra", "ak5e.json")
BOOK_OUT = os.path.join(HERE, "..", "src", "data", "book", "ak5e.md")

# pool spellings → the name the SRD library uses
ALIASES = {
    "mage armour": "Mage Armor",
    "firestorm": "Fire Storm",
    "stone skin": "Stoneskin",
    "create/destroy water": "Create or Destroy Water",
    "purify food/drink": "Purify Food and Drink",
    "witchbolt": "Witch Bolt",
    "maximillian's earthen grasp": "Maximilian's Earthen Grasp",
    "rime's binding ice": "Rime's Binding Ice",
    "abi-dalzim's horrid wilting": "Abi-Dalzim's Horrid Wilting",
    "melting mines": "Melting Mine",
    "spirit shroud (necrotic only)": "Spirit Shroud",
}


def read_source(arg):
    if arg:
        text = open(arg, encoding="utf-8").read()
    else:
        req = urllib.request.Request(SOURCE_URL, headers={"User-Agent": "Mozilla/5.0"})
        text = urllib.request.urlopen(req, timeout=60).read().decode("utf-8")
    m = re.search(r"<pre[^>]*>(.*)</pre>", text, re.S)
    return html.unescape(m.group(1)) if m else text


def plain(s):
    """Homebrewery markdown → plain text the sheet can show."""
    s = re.sub(r"<[^>]+>", "", s)
    s = re.sub(r"\{\{[^\n}]*\n?|\}\}", "", s)
    s = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", s)
    s = s.replace("\\column", "").replace("\\page", "")
    s = re.sub(r"\*\*\*?([^*]+)\*\*\*?", r"\1", s)
    s = re.sub(r"(?<!\w)\*([^*\n]+)\*(?!\w)", r"\1", s)
    s = re.sub(r"^:+\s*$", "", s, flags=re.M)
    s = re.sub(r"^#+\s*", "", s, flags=re.M)
    s = re.sub(r"[ \t]+\n", "\n", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


def cells(row):
    return [c.strip() for c in row.strip().strip("|").split("|")]


def chapter(src, title, nxt):
    a = src.index("# " + title)
    b = src.index("# " + nxt, a)
    return src[a:b]


LEVELS = {"cantrip": 0, "1st": 1, "2nd": 2, "3rd": 3, "4th": 4, "5th": 5, "6th": 6, "7th": 7, "8th": 8, "9th": 9}


def arts_pools(ch5):
    """'#### Flame Arts' followed by an 'Arts Level | Arts' table → {pool: {level: [names]}}."""
    pools = {}
    for m in re.finditer(r"^#### ([A-Z][\w' ]+ Arts)\s*$", ch5, re.M):
        body = re.split(r"^#{1,4} ", ch5[m.end():], maxsplit=1, flags=re.M)[0]
        t = re.search(r"\|\s*Arts Level\s*\|.*?\n\|[-:| ]+\|\n((?:\|.*\n?)+)", body)
        if not t:
            continue
        levels = {}
        for row in t.group(1).splitlines():
            c = cells(row)
            if len(c) < 2 or c[0].lower() not in LEVELS:
                continue
            names = []
            for raw in re.split(r",(?![^()]*\))", c[1]):
                n = raw.strip()
                if not n or n == "-":
                    continue
                new = n.startswith("**")
                n = n.strip("* ").replace("’", "'")
                n = ALIASES.get(n.lower(), n)
                names.append({"n": n, "s": "", "special": "", "new": new})
            levels[str(LEVELS[c[0].lower()])] = names
        if levels:
            pools[m.group(1)] = levels
    return pools


def new_arts(ch5):
    """The 'New Art Descriptions' section: '#### Name', '*2nd-Level Evocation*', fields, text."""
    sec = ch5[ch5.index("## New Art Descriptions"):]
    blocks = re.split(r"^#### ", sec, flags=re.M)[1:]
    out = []
    for b in blocks:
        name, _, rest = b.partition("\n")
        name = name.strip().replace("’", "'")
        head = re.search(r"^\*([^*\n]+)\*\s*$", rest, re.M)
        if not head:
            continue
        kind = head.group(1).strip()
        lv = 0 if "cantrip" in kind.lower() else int((re.match(r"(\d)", kind) or [0, 0])[1] or 0)
        school = re.sub(r"(cantrip|\d\w*[- ]level)", "", kind, flags=re.I).strip(" -")
        school = school.split()[0].capitalize() if school else ""
        field = lambda k: (re.search(r"\*\*" + k + r":\*\*\s*:*\s*(.+)", rest) or [None, ""])[1].strip()
        body = re.split(r"\*\*Duration:\*\*[^\n]*\n", rest, maxsplit=1)
        text = body[1] if len(body) > 1 else rest
        text = re.sub(r"^\s*Credit\s*$", "", plain(re.sub(r"\[Credit\]\([^)]*\)", "", text)), flags=re.M).strip()
        dur = field("Duration")
        tags = kind.lower()
        out.append({
            "n": name, "l": lv, "s": school, "ct": field("Casting Time"), "r": field("Range"), "c": field("Components"),
            "d": dur, "co": dur.lower().startswith("concentration"), "ri": "ritual" in tags, "m": False,
            "cl": [], "e": "AK5e", "t": text,
        })
    return out


TIER = {"basic": "basic", "advanced": "advanced", "elite": "elite"}


def operator_skills(src):
    """Every '##### Basic Caster Skills' / '##### Liberator Elite Skills' table."""
    out = []
    pat = re.compile(r"^##### (.+?) Skills(?: Continued)?\s*\n\|\s*Name\s*\|\s*SP Cost.*\n\|[-:| ]+\|\n((?:\|.*\n?)+)", re.M)
    for m in pat.finditer(src):
        words = m.group(1).split()
        tier = next((TIER[w.lower()] for w in words if w.lower() in TIER), "")
        owner = " ".join(w for w in words if w.lower() not in TIER)
        for row in m.group(2).splitlines():
            c = cells(row)
            if len(c) < 7 or not c[0]:
                continue
            num = lambda s: int(re.sub(r"\D", "", s) or 0)
            out.append({
                "n": c[0].replace("’", "'"), "cls": owner, "tier": tier, "sp": num(c[1]), "start": num(c[2]),
                "charge": c[3], "act": c[4], "t": plain(c[5]), "dur": c[6],
            })
    return out


def main():
    src = read_source(sys.argv[1] if len(sys.argv) > 1 else "")
    ch5 = chapter(src, "Chapter 5: Arts", "Chapter 6")
    pools = arts_pools(ch5)
    spells = new_arts(ch5)
    skills = operator_skills(src)
    known = {s["n"].lower() for s in spells}
    for pool, levels in pools.items():
        for rows in levels.values():
            for r in rows:
                if r.pop("new") and r["n"].lower() not in known:
                    print("  no description found for new Art:", r["n"])
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump({"source": BOOK, "system": "ak5e", "spells": spells, "classLists": pools, "opSkills": skills}, f, ensure_ascii=False)
    print(f"{len(pools)} Arts pools, {len(spells)} new Arts, {len(skills)} Operator Skills -> {os.path.normpath(OUT)}")
    # the whole book, for the in-app sourcebook reader
    os.makedirs(os.path.dirname(BOOK_OUT), exist_ok=True)
    with open(BOOK_OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write(src.replace("\r\n", "\n"))
    print(f"book ({src.count(chr(92) + 'page') + 1} pages) -> {os.path.normpath(BOOK_OUT)}")


if __name__ == "__main__":
    main()
