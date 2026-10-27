// Builds index.html: the original game (src/base-game.html, unchanged) plus the 3D table layer.
// Usage: node build.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const read = f => readFileSync(join(root, f), 'utf8');
let html = read('src/base-game.html');
const css = read('src/three-table.css'), js = read('src/three-table.js');

function swap(from, to) {
  if (!html.includes(from)) throw new Error('build: marker not found: ' + from.slice(0, 80));
  html = html.replace(from, () => to);
}

// The published page gets its own document skeleton, so drop the one saved with the source.
html = html.slice(html.indexOf('\n') + 1);
swap('<title>Tha Gundam TCG Sim</title>', '<title>3D Gundam TCG Sim</title>');
swap('<h1>Tha Gundam TCG Sim</h1>', '<h1>3D Gundam TCG Sim</h1>');
swap('<h2>THA GUNDAM TCG SIM</h2>', '<h2>3D GUNDAM TCG SIM</h2>');
// No offline install files ship with this project.
swap('<link rel="apple-touch-icon" href="icon-192.png">\n', '');
swap('<link rel="manifest" href="manifest.json">\n', '');
html = html.replace(/<script>\s*\/\/ Register the offline service worker[\s\S]*?<\/script>\s*/, '');

swap('</head>', '<style>\n' + css + '</style>\n</head>');
swap('<div id="app">',
  '<div id="scene3d"></div>\n<div id="board3dLayer"></div>\n<div id="fx3d"></div>\n<div id="camToast"></div>\n<div id="app">');
swap('  <div class="hand-row" id="hand"', '  <div class="board-slot"></div>\n\n  <div class="hand-row" id="hand"');
swap('🖼</button>\n  </div>', '🖼</button>\n    <button id="camBtn" class="ghost" title="Change camera view (V)">🎥</button>\n  </div>');

const importmap = `<script type="importmap">
{ "imports": {
  "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
  "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"
} }
</script>
`;
const end = html.lastIndexOf('</body>');
html = (end >= 0 ? html.slice(0, end) : html) + importmap + '<script type="module">\n' + js + '</script>\n' + (end >= 0 ? html.slice(end) : '');

writeFileSync(join(root, 'index.html'), html);
console.log('index.html', (Buffer.byteLength(html) / 1048576).toFixed(2) + ' MB');
