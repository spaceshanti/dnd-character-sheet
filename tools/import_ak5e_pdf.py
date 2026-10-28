"""Put your PDF copy of the Arknights 5e book into the app's sourcebook reader.

    python tools/import_ak5e_pdf.py "C:/path/to/AK5e 1st Edition v1.3.1 - The Homebrewery.pdf"

Same as  tools/import_book_pdf.py ak5e "Arknights 5e" ak5e <pdf>  (the contents come from the book's text,
imported with tools/import_ak5e.py).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from import_book_pdf import import_pdf  # noqa: E402

if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    import_pdf("ak5e", "Arknights 5e", ["ak5e"], sys.argv[1])
