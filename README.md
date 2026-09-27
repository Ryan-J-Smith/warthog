# WARTHOG

A top-down, open-map ground-attack shmup for the browser. Fly an A-10 Warthog over a living battlefield,
juggle overlapping objectives, and pick your altitude: **Low** for the deadly gun, **Medium** for
Mavericks and precise bombs, **High** for speed and a view of the whole sector.

Xevious meets Desert Strike, with a third dimension.

## Play (dev)

```bash
npm install
npm run dev          # http://localhost:5173 (or the port Vite prints)
```

Dev shortcuts: `?play=river-crossing` skips straight into the mission, and `window.__warthog` is the `Phaser.Game`.

## Controls

| Key | Action |
|---|---|
| `A` / `D` (or ← / →) | Turn |
| `W` / `S` (or ↑ / ↓) | Climb / dive one altitude band |
| `Space` (hold) | Fire the selected weapon |
| `1` `2` `3` `4` | Gun / Rockets / Maverick / Bombs |
| `Q` | Flares |
| `Esc` / `P` | Pause |
| `M` | Mute music |

**Altitude cheat sheet:** anti-aircraft guns reach Low and Medium, SAMs reach Medium and High.
Dive to Low to break a SAM lock. Hold Low over the home base to rearm and repair.

## Build and share

```bash
npm run build        # type-checks, then writes a static site to dist/
npm run preview      # serve dist/ locally to check it
```

`dist/` is a self-contained static site with relative paths, so it can be hosted anywhere:

- **itch.io:** zip the *contents* of `dist/` (so `index.html` is at the zip root), create an HTML project,
  upload the zip, and tick "This file will be played in the browser". Use a 1920×1080 or 1280×720 viewport
  with fullscreen enabled.
- **GitHub Pages:** push `dist/` to a `gh-pages` branch, or use a Pages workflow that runs `npm ci && npm run build`
  and publishes `dist/`.

## Development

```bash
npm run typecheck    # tsc --noEmit (must be zero errors)
npm test             # unit tests (Vitest)
npx vitest run --config tests/playtest/vitest.config.ts   # headless bot playtests (~3 min)
```

- `src/sim/`: pure TypeScript simulation (no Phaser). It runs at a fixed 60 Hz and emits `SimEvent`s.
- `src/render/`, `src/audio/`, `src/ui/`: Phaser-side listeners that draw and play what the sim does.
- `src/config/`: all tuning numbers. `src/content/levels/`: level data.
- `public/assets/`: SVG sprites, audio and fonts.

Third-party asset licenses are listed in [CREDITS.md](CREDITS.md).
