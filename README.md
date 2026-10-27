# 3D Gundam TCG Sim

The Gundam Card Game simulator (rules engine, AI, deck builder, online play) on a 3D table: both
playmats lie on a space-station deck in Earth orbit, rendered with Three.js. Open `index.html` in a
browser to play — no install or build needed.

## Camera

Tabletop, Top-down and Cinematic views — press **V** or the 🎥 button to cycle. Phones, tablets and small or
portrait screens start in Top-down (the tilted views shrink the far mat too much to read there); the choice is
remembered once you change it.

## Performance

The board is real DOM, so its cards and text are always sharp; only the space scene behind it is WebGL. That
scene is drawn on demand: every frame while the camera moves, shakes or sparks fly, otherwise only the slow
ambient motion (60 fps on desktop, 20 fps on touch devices, none with reduced motion). Touch devices also get no
MSAA, a pixel ratio capped at 1.25, coarser spheres, fewer rocks and smaller Earth textures, which are built in
short slices so loading never stalls. If full-rate frames still run slow, the WebGL pixel ratio steps down to 0.75.

## Files

- `src/base-game.html` — the original 2D game, unchanged.
- `src/three-table.css`, `src/three-table.js` — the 3D layer (scene, camera, particles).
- `build.mjs` — combines them into `index.html`: `node build.mjs`

If Three.js cannot load, the page falls back to the plain 2D table.
