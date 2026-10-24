# Character Sheet

A desktop D&D character sheet (Electron + React). Opens as its own window, saves to a local file, works offline.

## Work on it (live reload)

```
npm run app:dev
```

Opens the real app window; edits to `src/` appear when you save. Close the window to stop it.

## Run it normally

```
npm install      # first time only
npm run start    # builds, then opens the app window
```

`npm run dev` runs it in a browser tab for development (saves to browser storage instead, and wikidot fetching is unavailable).

Packaging into a standalone `.exe` is set up (`npm run dist`) but intentionally not done yet. It needs Windows Developer Mode for the single-file version.

## Where your data is

`%APPDATA%\Character Sheet\characters.json` (plus a `.bak` of the previous save). Export / import from the Characters window.

## Notes

- Spell descriptions can always be typed or pasted. Fetch (by name or wikidot link) and the built-in SRD library are optional helpers.

## Credits

Spell library data includes content from the System Reference Document 5.1 and 5.2 by Wizards of the Coast LLC,
licensed under [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/), via [5e-bits/5e-database](https://github.com/5e-bits/5e-database).
This is unofficial fan software, not affiliated with Wizards of the Coast.
