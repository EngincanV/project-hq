// Desktop app icons for electron-builder, generated from public/logo.svg (the same source as the PWA icons):
//   build/icon.png  1024×1024, the mark at 824 px with transparent padding (macOS app icon grid; electron-builder
//                   turns it into icon.icns)
//   build/icon.ico  16–256 px, edge to edge (Windows installer, exe and shortcuts)
// Run `npm run icons:desktop` after changing the logo; the output is committed.
// Uses sharp and sharp-ico, which come with @vite-pwa/assets-generator (dev dependency).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import ico from 'sharp-ico';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const svg = fs.readFileSync(path.join(root, 'public', 'logo.svg'));
const out = path.join(root, 'build');
fs.mkdirSync(out, { recursive: true });

const render = (size) => sharp(svg, { density: Math.ceil((72 * size) / 512) * 2 }).resize(size, size).png().toBuffer();

const mark = await render(824);
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: mark, left: 100, top: 100 }])
  .png()
  .toFile(path.join(out, 'icon.png'));

const sizes = [16, 24, 32, 48, 64, 128, 256];
fs.writeFileSync(path.join(out, 'icon.ico'), ico.encode(await Promise.all(sizes.map(render))));
console.log('Wrote build/icon.png and build/icon.ico');
