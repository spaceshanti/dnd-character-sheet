# Character Sheet

> **AI usage disclaimer:** this app was built with heavy use of AI. Its code, data-import tools and documentation were largely written by Claude (Anthropic's AI model, via Claude Code). This application was built to address a personal need/inconvenience of mine and not to be shipped as a product.

A desktop D&D character sheet (Electron + React). Opens as its own window, saves to a local file, works offline.

## Download (Windows)

**[⬇ Download the latest installer](https://github.com/spaceshanti/dnd-character-sheet/releases/latest/download/Character-Sheet-Setup.exe)**
(or pick a version on the [Releases page](https://github.com/spaceshanti/dnd-character-sheet/releases/latest)).

1. Run `Character-Sheet-Setup.exe`. Windows may say *"Windows protected your PC"* because the app isn't code-signed:
   click **More info → Run anyway**.
2. It installs for your user only (no admin needed) and adds Start menu and desktop shortcuts.
3. The app updates itself: new versions download in the background and install when you close it
   (Settings → *Check for updates* to check by hand).

Your characters are saved on your own computer, so reinstalling or updating never touches them.

**Books:** none are included in the download. The first time you open an Arknights character, the app downloads the
Arknights 5e book from Homebrewery by itself (Arts, gear, Operator Skills, classes for filling in features, and the book's
text in the 📖 Sourcebooks reader). Settings → **Sourcebooks** adds the rest:
- **2024 rules (SRD 5.2.1)**: one click, downloaded and set up for you.
- **Arknights 5e real pages**: add a PDF of the book (print it to PDF from Homebrewery, or get the file from your party)
  for the page view with clickable contents and spell names.

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

To publish a version, attach the three files from `release/` (`Character-Sheet-Setup-<version>.exe`, its `.blockmap` and
`latest.yml`) plus a copy of the installer named `Character-Sheet-Setup.exe` to a GitHub release tagged `v<version>`.
The installed apps check `latest.yml` there to update themselves; the plain-named copy keeps the README's download link working.

## Where your data is

`%APPDATA%\Character Sheet\characters.json` (plus a `.bak` of the previous save). Export / import from the Characters window.

## Notes

- Spell descriptions can always be typed or pasted. Fetch (by name or wikidot link) and the built-in SRD library are optional helpers.

## Extra spell lists (e.g. the UA Psion)

Settings → Sourcebooks → **＋ Add a spell list file…** loads a `.json` spell list: its class shows in the Spell Library's
filter and its spells are written out in full. To make one from an Unearthed Arcana class PDF you own:

```
python tools/import_ua_spells.py "C:\path\to\UA2025-ThePsion.pdf"
```

Reads the class spell list and any full spell write-ups from the PDF (formatted for the sheet: paragraphs, bold run-in
headings, stat blocks laid out) and writes `<name>.json` into the app's data folder (`%APPDATA%/Character Sheet/extra`);
share that file with your party and they add it the same way. The app merges every file there into the Spell Library (filter Class → Psion).
Restart the app after importing.
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
contents; ☆ on any heading or in the header adds one). Books are added from **Settings → Sourcebooks** (see Download above)
and kept in the app's data folder (`%APPDATA%/Character Sheet/sourcebook/<id>`), never in the app or this repository.
**＋ Add another book (PDF)…** there takes any PDF you have (pick a title and which characters see it).
With more than one, switch books from the reader's header.

Other PDFs you own can be added with `python tools/import_book_pdf.py <id> "<title>" <games> "book.pdf"`, for example
`python tools/import_book_pdf.py phb2024 "Player's Handbook (2024)" dnd5e "your own PHB.pdf"` (`<games>`: `dnd5e`, `ak5e`,
or both as `dnd5e,ak5e`).

Spell and Art names in the books (Arts pool tables, class spell lists, "you learn the Detect Magic Art") are links: click
one to read the spell in a card over the page and add it to your character, without leaving the book.

## Feature modifiers

A feature (or item, or spell) can change the sheet: bonuses, advantage, proficiency, **½ proficiency** and expertise on
saves, skills and Initiative. Proficiency-type modifiers count only when they're your best for that roll (the normal rule)
unless you tick **stacks**, which adds them on top. For anything a fixed number can't do, the feature editor has
**⚙ Advanced: custom formulas** at the bottom: modifiers worked out from a formula such as `max(1, wis)` or `half(prof)`,
with a reference of every variable and function a click away.

## Class symbols

On Arknights sheets, beside the portrait is a column of marks: class, branch, nationality and faction (click any to change;
an original set, or your own picture; the faction falls back to your emblem picture). On Arknights sheets the game's
official class, branch, nation and faction icons are picked automatically from the names: they're downloaded once from the
Arknights wiki into the app's data folder (`%APPDATA%/Character Sheet/symbols/ak`) and never bundled.

## Filling in features

Type a class, branch / subclass, species, background or (Arknights) nationality in the top bar and, if the character has no
features of that kind yet, the sheet offers to fill them in up to your level. Choices come first in the same box
(spellcasting ability, saving throws, skills, Ancient Versatility, ability score increases…), and Undo is offered right after.

**Arknights 5e** uses hand-made blocks for every class, branch, species, nationality and background feature
(`src/ak5e/blocks.ts`): the book's text for each feature (without its tables), plus how it's wired up: its uses and when
they come back, the actions that spend them (Shelter's bonus-action version spends Resilience…), effects, rest reminders and
the Arts it grants. Uses that grow with level (Resilience, Life Support, Aggression, Arts Points, max Art level…) follow a
formula or the class table, and keep up when you level up. The blocks hold no book text, only names and numbers.

**D&D** reads the SRD 5.2.1 (`src/data/srd52.json`, built with `python tools/build_srd_data.py SRD_CC_v5.2.1.pdf`); hand-made
blocks for D&D are still to come.

## The Arknights 5e book data

The app reads the book's markdown source from Homebrewery (`src/ak5e/parse.ts`): every Arts pool, the new Arts, every
Operator Skill table, the Equipment chapter (so typing an item's name on an Arknights sheet fills it in), and the classes,
branches, species, nationalities and backgrounds for filling in features. It's stored in the app's data folder
(`%APPDATA%/Character Sheet/extra/ak5e.json` and `books/ak5e.md`); Settings → Sourcebooks → *Update* fetches it again.

For working on the app in a browser, `python tools/import_ak5e.py` writes the same data into `src/data/extra` and
`src/data/book` (both gitignored), which only the development preview reads.

## Credits

Spell and item library data includes content from the System Reference Document 5.1 and 5.2 by Wizards of the Coast LLC,
licensed under [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/), via [5e-bits/5e-database](https://github.com/5e-bits/5e-database).
The class, species, background and feat data used to fill in features is from the System Reference Document 5.2.1 by
Wizards of the Coast LLC, licensed under CC-BY-4.0.
This is unofficial fan software, not affiliated with Wizards of the Coast, Hypergryph or Yostar.
Arknights 5e is a fan homebrew by its own authors; the app downloads it from Homebrewery onto your own computer, and none
of its text is part of this repository or the installer. The 2024 rules PDF is downloaded from D&D Beyond the same way.
PDF pages are drawn with [PDF.js](https://mozilla.github.io/pdf.js/) (Apache-2.0).
