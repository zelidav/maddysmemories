// Render manifest icons. Run with: node build-icons.js
import sharp from 'sharp';
import { writeFileSync } from 'fs';

const svg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#a83244"/>
      <stop offset="1" stop-color="#7a1f30"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#bg)"/>
  <g transform="translate(96 116) rotate(-3 160 140)">
    <rect width="320" height="280" rx="14" fill="#fdf6e3" stroke="#2a1a1a" stroke-width="3"/>
    <line x1="0" y1="56" x2="320" y2="56" stroke="#a83244" stroke-width="2" opacity="0.55"/>
    <line x1="48" y1="0" x2="48" y2="280" stroke="#a83244" stroke-width="1.5" opacity="0.45"/>
    <text x="160" y="42" font-family="Georgia, serif" font-size="34" font-style="italic" text-anchor="middle" fill="#2a1a1a">Maddy's</text>
    <line x1="64" y1="92" x2="296" y2="92" stroke="#3a2a2a" stroke-width="2" opacity="0.65" stroke-linecap="round"/>
    <line x1="64" y1="124" x2="280" y2="124" stroke="#3a2a2a" stroke-width="2" opacity="0.65" stroke-linecap="round"/>
    <line x1="64" y1="156" x2="296" y2="156" stroke="#3a2a2a" stroke-width="2" opacity="0.65" stroke-linecap="round"/>
    <line x1="64" y1="188" x2="240" y2="188" stroke="#3a2a2a" stroke-width="2" opacity="0.65" stroke-linecap="round"/>
    <line x1="64" y1="220" x2="270" y2="220" stroke="#3a2a2a" stroke-width="2" opacity="0.65" stroke-linecap="round"/>
    <line x1="64" y1="252" x2="200" y2="252" stroke="#3a2a2a" stroke-width="2" opacity="0.65" stroke-linecap="round"/>
  </g>
</svg>`;

async function build() {
  for (const size of [192, 512]) {
    const png = await sharp(Buffer.from(svg(size))).png().toBuffer();
    writeFileSync(`icon-${size}.png`, png);
    console.log(`Wrote icon-${size}.png (${png.length} bytes)`);
  }
  // Apple touch icon
  const apple = await sharp(Buffer.from(svg(180))).png().toBuffer();
  writeFileSync('apple-touch-icon.png', apple);
  console.log(`Wrote apple-touch-icon.png (${apple.length} bytes)`);
}

build().catch((e) => { console.error(e); process.exit(1); });
