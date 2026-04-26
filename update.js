const fs   = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT       = __dirname;
const CFG        = JSON.parse(fs.readFileSync(path.join(ROOT, 'portfolio.config.json'), 'utf8'));
const HTML_PATH  = path.join(ROOT, 'index.html');
const PHOTOS_DIR = path.join(ROOT, 'photos');

const SRC_EXTS = ['.jpg', '.jpeg', '.png', '.tiff', '.tif', '.heic', '.avif'];

// Folder name as it actually exists on disk (case-insensitive lookup for Windows).
function resolveFolder(configKey) {
  const entries = fs.readdirSync(PHOTOS_DIR);
  return entries.find(e => e.toLowerCase() === configKey.toLowerCase()) || configKey;
}

function toSlug(name) {
  return name.toLowerCase().replace(/\s+/g, '-');
}

function photoUrl(folder, basename) {
  return `photos/${folder.replace(/ /g, '%20')}/${basename}.webp`;
}

function tryDelete(filePath) {
  try {
    fs.chmodSync(filePath, 0o666);
    fs.unlinkSync(filePath);
  } catch (e) {
    if (e.code === 'EPERM' || e.code === 'EACCES') {
      console.log(`    warning: could not delete ${path.basename(filePath)} — delete it manually`);
    } else {
      throw e;
    }
  }
}

function fmtMB(bytes) {
  const mb = bytes / 1024 / 1024;
  return (mb >= 10 ? mb.toFixed(1) : mb.toFixed(2)) + 'MB';
}

// ── 1. Convert source images to webp ────────────────────────────────────────
async function convertImages() {
  const folders = fs.readdirSync(PHOTOS_DIR)
    .filter(f => fs.statSync(path.join(PHOTOS_DIR, f)).isDirectory());

  let converted = 0;

  for (const folder of folders) {
    const dir = path.join(PHOTOS_DIR, folder);
    for (const file of fs.readdirSync(dir)) {
      const ext = path.extname(file).toLowerCase();
      if (!SRC_EXTS.includes(ext)) continue;

      const inputPath = path.join(dir, file);
      const base      = path.basename(file, ext);
      const outPath   = path.join(dir, base + '.webp');

      if (fs.existsSync(outPath)) {
        tryDelete(inputPath);
        continue;
      }

      const inSize = fs.statSync(inputPath).size;
      await sharp(inputPath).webp({ quality: 85 }).toFile(outPath);
      const outSize = fs.statSync(outPath).size;

      const pct = Math.round((outSize - inSize) / inSize * 100);
      const tag = `${folder}\\${file}`;
      console.log(`    converted: ${tag.padEnd(40)} → .webp  ${fmtMB(inSize).padStart(8)} → ${fmtMB(outSize).padStart(7)}  (${pct}%)`);
      converted++;
      tryDelete(inputPath);
    }
  }

  console.log(`    ${converted} image(s) converted.`);
}

// ── 2. Build PHOTOS map ──────────────────────────────────────────────────────
function buildPhotos() {
  const photos = {};

  // Hero
  const [hf, hb] = CFG.hero.split('/');
  photos['hero'] = photoUrl(resolveFolder(hf), hb);

  // Featured mosaic
  CFG.featured.forEach((ref, i) => {
    const [ff, fb] = ref.split('/');
    photos[`feat-${String(i + 1).padStart(2, '0')}`] = photoUrl(resolveFolder(ff), fb);
  });

  // About portrait
  const [af, ab] = CFG.aboutPortrait.split('/');
  photos['about-portrait'] = photoUrl(resolveFolder(af), ab);

  // Series covers + individual photos
  for (const [cfgKey, meta] of Object.entries(CFG.series)) {
    const folder = resolveFolder(cfgKey);
    const slug   = toSlug(cfgKey);
    const dir    = path.join(PHOTOS_DIR, folder);

    photos[`cover-${slug}`] = photoUrl(folder, meta.cover);

    const webps = fs.readdirSync(dir)
      .filter(f => path.extname(f).toLowerCase() === '.webp')
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    webps.forEach((file, i) => {
      photos[`${slug}-${String(i + 1).padStart(2, '0')}`] = photoUrl(folder, path.basename(file, '.webp'));
    });
  }

  return photos;
}

// ── 3. Build VIDEOS array ────────────────────────────────────────────────────
function buildVideos() {
  return CFG.videos.map((v, i) => ({
    key:      `video-${String(i + 1).padStart(2, '0')}`,
    title:    v.title,
    duration: v.duration,
    src:      `videos/${v.file}`,
  }));
}

// ── 4. Build SERIES array ────────────────────────────────────────────────────
function buildSeries() {
  return Object.entries(CFG.series).map(([cfgKey, meta], i) => {
    const folder = resolveFolder(cfgKey);
    const dir    = path.join(PHOTOS_DIR, folder);
    const count  = fs.readdirSync(dir)
      .filter(f => path.extname(f).toLowerCase() === '.webp').length;

    return {
      id:       i + 1,
      slug:     toSlug(cfgKey),
      title:    meta.title,
      location: meta.location,
      year:     meta.year,
      count,
      h:        meta.cardHeight,
    };
  });
}

// ── 5. Inject into index.html ────────────────────────────────────────────────
function updateHtml(photos, videos, series) {
  let html = fs.readFileSync(HTML_PATH, 'utf8');

  // Build grouped PHOTOS block with section comments
  const seriesSlugs = Object.keys(CFG.series).map(k => toSlug(k));
  const photoLines  = [];

  // Hero
  photoLines.push('      // Hero');
  photoLines.push(`      "hero": "${photos['hero']}",`);
  photoLines.push('');

  // Featured
  photoLines.push('      // Featured work mosaic');
  for (let i = 1; i <= CFG.featured.length; i++) {
    const k = `feat-${String(i).padStart(2, '0')}`;
    photoLines.push(`      "${k}": "${photos[k]}",`);
  }
  photoLines.push('');

  // Covers
  photoLines.push('      // Series covers');
  for (const slug of seriesSlugs) {
    const k = `cover-${slug}`;
    photoLines.push(`      "${k}": "${photos[k]}",`);
  }
  photoLines.push('');

  // About portrait
  photoLines.push('      // About portrait');
  photoLines.push(`      "about-portrait": "${photos['about-portrait']}",`);

  // Per-series photos
  for (const [cfgKey, meta] of Object.entries(CFG.series)) {
    const slug   = toSlug(cfgKey);
    const folder = resolveFolder(cfgKey);
    const dir    = path.join(PHOTOS_DIR, folder);
    const count  = fs.readdirSync(dir)
      .filter(f => path.extname(f).toLowerCase() === '.webp').length;

    photoLines.push('');
    photoLines.push(`      // ${meta.title} — ${count} photos`);
    for (let i = 1; i <= count; i++) {
      const k = `${slug}-${String(i).padStart(2, '0')}`;
      if (photos[k]) photoLines.push(`      "${k}": "${photos[k]}",`);
    }
  }

  const photosBlock =
    `    // @@PHOTOS_START\n` +
    `    const PHOTOS = {\n${photoLines.join('\n')}\n    };\n` +
    `    // @@PHOTOS_END`;

  html = html.replace(/\/\/ @@PHOTOS_START[\s\S]*?\/\/ @@PHOTOS_END/, photosBlock);

  // VIDEOS
  const videoLines = videos.map(v =>
    `      { key:"${v.key}", title:"${v.title}", duration:"${v.duration}", src:"${v.src}" },`
  );
  const videosBlock =
    `    // @@VIDEOS_START\n` +
    `    const VIDEOS = [\n${videoLines.join('\n')}\n    ];\n` +
    `    // @@VIDEOS_END`;

  html = html.replace(/\/\/ @@VIDEOS_START[\s\S]*?\/\/ @@VIDEOS_END/, videosBlock);

  // SERIES
  const seriesLines = series.map(s =>
    `      { id:${s.id}, slug:"${s.slug}", title:"${s.title}", location:"${s.location}", year:${s.year}, count:${s.count}, h:${s.h} },`
  );
  const seriesBlock =
    `    // @@SERIES_START\n` +
    `    const SERIES = [\n${seriesLines.join('\n')}\n    ];\n` +
    `    // @@SERIES_END`;

  html = html.replace(/\/\/ @@SERIES_START[\s\S]*?\/\/ @@SERIES_END/, seriesBlock);

  // Update the hero preload link in <head>
  html = html.replace(
    /(<link rel="preload" as="image" href=")[^"]*(")/,
    `$1${photos['hero']}$2`
  );

  fs.writeFileSync(HTML_PATH, html, 'utf8');
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\nStep 1 — Converting new images to WebP...');
  await convertImages();

  console.log('\nStep 2 — Scanning series folders...');
  const photos = buildPhotos();
  const videos = buildVideos();
  const series = buildSeries();
  series.forEach(s => console.log(`    ${s.title}: ${s.count} photos`));

  console.log('\nStep 3 — Updating HTML...');
  updateHtml(photos, videos, series);

  console.log('\nDone. Refresh index.html in your browser.\n');
}

main().catch(err => { console.error(err); process.exit(1); });
