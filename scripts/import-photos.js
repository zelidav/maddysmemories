// Resize source FB photos into web-ready sizes for use as backgrounds and a memory strip.
import sharp from 'sharp';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname, basename } from 'path';

const REPO = dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')).replace(/\/scripts$/, '');
const DOWNLOADS = process.env.HOME + '/Downloads';
const OUT_DIR = join(REPO, 'public', 'photos');
mkdirSync(OUT_DIR, { recursive: true });

const SOURCES = [
  '492371663_10012958538735959_732922768212227685_n.jpg',
  '671165533_26907362555535626_3898618944137973071_n.jpg',
  '530985902_18519201859054873_2302150941263027802_n.jpg',
  '517987344_18514005868054873_3740476947867937293_n.jpg',
  '475862870_18482237500054873_3583903132851485009_n.jpg',
  '474204292_18479733481054873_3444267017441146402_n.jpg',
  '473884788_18479741161054873_5582021181097101295_n.jpg',
  '503645706_24096995919905651_5537811350697300492_n.jpg',
  '472184702_18477095578054873_5703613184772566912_n.jpg',
  '471194278_18474576802054873_4583663532124315145_n.jpg',
  '471232552_18474576817054873_6553483505726697331_n.jpg',
  '471159822_18474576751054873_9161782788857631564_n.jpg',
  '496968732_23924995447105700_5719898080484598171_n.jpg',
  '495003925_10062156297149516_5591684746300015302_n.jpg',
  '494151975_10060769553954857_8538734552915245185_n.jpg',
];

const manifest = [];

for (let i = 0; i < SOURCES.length; i++) {
  const src = join(DOWNLOADS, SOURCES[i]);
  if (!existsSync(src)) { console.warn('skip:', SOURCES[i]); continue; }
  const buf = readFileSync(src);
  const meta = await sharp(buf).metadata();

  const slug = String(i + 1).padStart(2, '0');
  const baseName = `mem-${slug}`;

  // Hero/background size (max 1600px on long edge)
  const big = await sharp(buf).rotate().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 78, progressive: true }).toBuffer();
  // Strip thumbnail (640px on long edge)
  const small = await sharp(buf).rotate().resize(640, 640, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 75, progressive: true }).toBuffer();

  writeFileSync(join(OUT_DIR, `${baseName}.jpg`), big);
  writeFileSync(join(OUT_DIR, `${baseName}-sm.jpg`), small);

  manifest.push({
    id: baseName,
    src: `/photos/${baseName}.jpg`,
    thumb: `/photos/${baseName}-sm.jpg`,
    width: meta.width,
    height: meta.height,
    aspect: meta.width && meta.height ? meta.width / meta.height : 1,
    portrait: meta.height > meta.width,
  });

  console.log(`${baseName}: ${meta.width}x${meta.height} → big ${big.length}b, sm ${small.length}b`);
}

writeFileSync(join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('Wrote', manifest.length, 'photos →', OUT_DIR);
