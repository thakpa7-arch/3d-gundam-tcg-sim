# 3D Gundam TCG Sim

The Gundam Card Game simulator (rules engine, AI, deck builder, online play) on a 3D table: both
playmats lie on a space-station deck in Earth orbit, rendered with Three.js. Open `index.html` in a
browser to play — no install or build needed.

## Camera

Tabletop, Top-down and Cinematic views — press **V** or the 🎥 button to cycle.

## Files

- `src/base-game.html` — the original 2D game, unchanged.
- `src/three-table.css`, `src/three-table.js` — the 3D layer (scene, camera, particles).
- `build.mjs` — combines them into `index.html`: `node build.mjs`

If Three.js cannot load, the page falls back to the plain 2D table.
