"""Add a sourcebook PDF to the app's sourcebook reader.

    python tools/import_book_pdf.py <id> "<title>" <games> "C:/path/to/book.pdf"

    <id>     short folder name, e.g. srd52, phb2024, ak5e
    <games>  which characters see it: dnd5e, ak5e, or both as dnd5e,ak5e

Examples:
    python tools/import_book_pdf.py srd52 "SRD 5.2.1 (2024 rules)" dnd5e,ak5e "SRD_CC_v5.2.1.pdf"
    python tools/import_book_pdf.py phb2024 "Player's Handbook (2024)" dnd5e "my PHB.pdf"

Renders every page to an image, keeps each page's words (with positions, for search highlighting) and the
PDF's own bookmarks (for the contents sidebar), in the app's data folder:
    %APPDATA%/Character Sheet/sourcebook/<id>/
Nothing goes into this project or the repository.
"""
import json
import os
import sys

try:
    import pymupdf
except ImportError:
    sys.exit("Needs PyMuPDF:  pip install pymupdf")

WIDTH = 1240  # rendered page width in pixels


def book_dir(book_id):
    base = os.environ.get("APPDATA") or os.path.expanduser("~/.config")
    return os.path.join(base, "Character Sheet", "sourcebook", book_id)


def import_pdf(book_id, title, games, pdf_path):
    doc = pymupdf.open(pdf_path)
    out = book_dir(book_id)
    os.makedirs(os.path.join(out, "pages"), exist_ok=True)
    words = []
    for i, page in enumerate(doc):
        w, h = page.rect.width, page.rect.height
        pix = page.get_pixmap(matrix=pymupdf.Matrix(WIDTH / w, WIDTH / w))
        with open(os.path.join(out, "pages", f"{i + 1:03d}.jpg"), "wb") as f:
            f.write(pix.tobytes("jpeg", jpg_quality=82))
        # words as [x0, y0, x1, y1, text] in thousandths of the page; some books draw text twice
        # (outlines / shadows), so drop repeats at the same spot
        seen = set()
        pw = []
        for x0, y0, x1, y1, t, *_ in page.get_text("words"):
            k = (round(x0), round(y0), t)
            if k in seen:
                continue
            seen.add(k)
            pw.append([round(x0 / w * 1000), round(y0 / h * 1000), round(x1 / w * 1000), round(y1 / h * 1000), t])
        words.append(pw)
        if (i + 1) % 25 == 0:
            print(f"  {i + 1} / {doc.page_count} pages", flush=True)
    with open(os.path.join(out, "words.json"), "w", encoding="utf-8") as f:
        json.dump(words, f, ensure_ascii=False, separators=(",", ":"))
    first = doc[0].rect
    info = {
        "id": book_id, "title": title, "games": games, "pages": doc.page_count,
        "aspect": first.height / first.width, "ext": "jpg",
        # the PDF's bookmarks: [level, title, page]
        "toc": [[lvl, t.strip(), p] for lvl, t, p in doc.get_toc() if t.strip() and p > 0],
    }
    with open(os.path.join(out, "book.json"), "w", encoding="utf-8") as f:
        json.dump(info, f, ensure_ascii=False)
    print(f"{title}: {doc.page_count} pages, {len(info['toc'])} contents entries -> {out}")


def main():
    if len(sys.argv) < 5:
        sys.exit(__doc__)
    book_id, title, games, pdf = sys.argv[1:5]
    import_pdf(book_id, title, [g.strip() for g in games.split(",") if g.strip()], pdf)


if __name__ == "__main__":
    main()
