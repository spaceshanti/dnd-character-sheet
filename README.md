# Character Sheet

A desktop D&D character sheet (Electron + React). Opens as its own window, saves to a local file, works offline.

## Install

Run `release/Character-Sheet-Setup-<version>.exe` (built with `npm run dist`). It installs for your user only
(no admin needed), adds Start menu and desktop shortcuts, and can be removed from Windows' Installed apps.
Your characters are stored separately, so reinstalling or updating never touches them.

## Work on it (live reload)

Double-click **`Launch Sheet.bat`** (or run `python launch.py`, or `npm run app:dev`).

Opens the real app window; edits to `src/` appear when you save. Close the window to stop it.

## Build

```
npm install          # first time only
npm run dist         # installer  -> release/Character-Sheet-Setup-<version>.exe
npm run dist:dir     # unpacked app -> release/win-unpacked/Character Sheet.exe
```

Bump `version` in `package.json` before building an update; installing it over the old one keeps your data.

## Where your data is

`%APPDATA%\Character Sheet\characters.json` (plus a `.bak` of the previous save). Export / import from the Characters window.

## Notes

- Spell descriptions can always be typed or pasted. Fetch (by name or wikidot link) and the built-in SRD library are optional helpers.

## Importing spells from a UA / class PDF you own

```
python tools/import_ua_spells.py "C:\path\to\UA2025-ThePsion.pdf"
```

Reads the class spell list and any full spell write-ups from the PDF and writes `src/data/extra/<name>.json`.
The app merges every file in that folder into the Spell Library (filter Class → Psion). Restart the app after importing.
Spells on the list that aren't in the SRD and aren't written out in the PDF appear as "name only" entries.

## Games

Each character belongs to a game, chosen when you create it (switch later in Settings → Game):

- **D&D 5e**: spell slots, prepared spells, coins, death saves.
- **Arknights 5e** ([the homebrew overhaul](https://homebrewery.naturalcrit.com/share/mt8mcG6iRDbv)): Arts with an Arts Points pool and
  max Art level, Operator Skills with SP, Mettle while Dying, Damage Reduction, Martial DC, Nationality, LMD, and the AK skill list
  (Arts, Lore, Technology, Wilderness).

Each game remembers its own UI style. The Rhodes Island style is made for the Arknights sheet.

## Exporting to a printable sheet

Settings → *Export to a printable sheet*. Add your own copy of a form-fillable sheet once (the official 2014 or 2024 sheet,
or the Current Standard CS v1.4) and export any D&D character onto it. For Arknights characters, add the three sheet page
images from the book's [imgchest link](https://imgchest.com/p/qb4zpmejdyj); the export writes onto them. The sheets stay
in the app's data folder and aren't part of this repository.

## Sourcebooks

Every character gets a **📖 Sourcebooks** reader (Ctrl + B for a side pane, Ctrl + F to search). It shows a book's real
pages with its contents, page-accurate headings, on-page search highlights and your bookmarks (★ at the top of the
contents; ☆ on any heading or in the header adds one). Books are added once from a PDF and kept in the app's data folder
(`%APPDATA%/Character Sheet/sourcebook/<id>`), never in this repository:

```
python tools/import_book_pdf.py srd52 "SRD 5.2.1 (2024 rules)" dnd5e,ak5e "SRD_CC_v5.2.1.pdf"
python tools/import_book_pdf.py ak5e "Arknights 5e" ak5e "AK5e 1st Edition v1.3.1 - The Homebrewery.pdf"
python tools/import_book_pdf.py phb2024 "Player's Handbook (2024)" dnd5e "your own PHB.pdf"
```

The last argument before the file says which characters see the book (`dnd5e`, `ak5e`, or both). With more than one,
switch books from the reader's header. The free SRD 5.2.1 PDF (the 2024 rules, CC-BY-4.0) is at
https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf

## Importing the Arknights 5e book

```
python tools/import_ak5e.py
```

Downloads the book's source from Homebrewery and writes `src/data/extra/ak5e.json` with every Arts pool, the new Arts, every
Operator Skill table and the Equipment chapter (weapons, armour, weapon properties and items, so typing an item's name on an
Arknights sheet fills it in), so the Arts library can filter by pool and the Op. Skills page can add skills from the book. Rebuild afterwards.

## Credits

Spell and item library data includes content from the System Reference Document 5.1 and 5.2 by Wizards of the Coast LLC,
licensed under [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/), via [5e-bits/5e-database](https://github.com/5e-bits/5e-database).
This is unofficial fan software, not affiliated with Wizards of the Coast, Hypergryph or Yostar.
Arknights 5e is a fan homebrew by its own authors; its text is imported locally from your own copy and is not part of this repository.
