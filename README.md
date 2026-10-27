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

## Importing the Arknights 5e book

```
python tools/import_ak5e.py
```

Downloads the book's source from Homebrewery and writes `src/data/extra/ak5e.json` with every Arts pool, the new Arts and every
Operator Skill table, so the Arts library can filter by pool and the Op. Skills page can add skills from the book. Rebuild afterwards.

## Credits

Spell and item library data includes content from the System Reference Document 5.1 and 5.2 by Wizards of the Coast LLC,
licensed under [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/), via [5e-bits/5e-database](https://github.com/5e-bits/5e-database).
This is unofficial fan software, not affiliated with Wizards of the Coast, Hypergryph or Yostar.
Arknights 5e is a fan homebrew by its own authors; its text is imported locally from your own copy and is not part of this repository.
