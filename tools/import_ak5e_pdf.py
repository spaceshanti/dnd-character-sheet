"""Put your PDF copy of the Arknights 5e book into the app's sourcebook reader.

    python tools/import_ak5e_pdf.py "C:/path/to/AK5e 1st Edition v1.3.1 - The Homebrewery.pdf"

Renders every page to an image and saves each page's words (with their position, for search
highlighting) into the app's data folder:  %APPDATA%/Character Sheet/sourcebook/ak5e/
The reader then shows the real pages, art and all. Nothing goes into this project or the repository.
"""
import json
import os
import sys

try:
    import pymupdf
except ImportError:
    sys.exit("Needs PyMuPDF:  pip install pymupdf")

WIDTH = 1240  # rendered page width in pixels


def out_dir():
    if len(sys.argv) > 2:
        return sys.argv[2]
    base = os.environ.get("APPDATA") or os.path.expanduser("~/.config")
    return os.path.join(base, "Character Sheet", "sourcebook", "ak5e")


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    doc = pymupdf.open(sys.argv[1])
    out = out_dir()
    os.makedirs(os.path.join(out, "pages"), exist_ok=True)
    words = []
    for i, page in enumerate(doc):
        w, h = page.rect.width, page.rect.height
        pix = page.get_pixmap(matrix=pymupdf.Matrix(WIDTH / w, WIDTH / w))
        with open(os.path.join(out, "pages", f"{i + 1:03d}.jpg"), "wb") as f:
            f.write(pix.tobytes("jpeg", jpg_quality=82))
        # words as [x0, y0, x1, y1, text] in thousandths of the page; the book draws some text twice
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
    with open(os.path.join(out, "book.json"), "w", encoding="utf-8") as f:
        json.dump({"title": "Arknights 5e", "pages": doc.page_count, "aspect": first.height / first.width, "ext": "jpg"}, f)
    print(f"{doc.page_count} pages -> {out}")


if __name__ == "__main__":
    main()
