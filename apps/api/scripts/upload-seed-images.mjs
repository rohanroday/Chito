// Uploads apps/api/seed/images/** to ImageKit under <IMAGEKIT_FOLDER>/products/<category>/<file>.
// Deterministic paths (no unique suffix), so re-running overwrites instead of duplicating.
// Usage: node scripts/upload-seed-images.mjs   (from apps/api)
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Minimal .env loader (avoids a dotenv dependency before the API is scaffolded)
for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}

const { IMAGEKIT_PRIVATE_KEY, IMAGEKIT_FOLDER = '/chito' } = process.env;
if (!IMAGEKIT_PRIVATE_KEY) throw new Error('IMAGEKIT_PRIVATE_KEY missing in apps/api/.env');
const auth = 'Basic ' + Buffer.from(IMAGEKIT_PRIVATE_KEY + ':').toString('base64');

const imagesDir = join(root, 'seed', 'images');
const jobs = readdirSync(imagesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .flatMap((d) => readdirSync(join(imagesDir, d.name)).map((f) => ({ category: d.name, file: f })));

async function upload({ category, file }) {
  const form = new FormData();
  form.append('file', new Blob([readFileSync(join(imagesDir, category, file))]), file);
  form.append('fileName', file);
  form.append('folder', `${IMAGEKIT_FOLDER}/products/${category}`);
  form.append('useUniqueFileName', 'false');
  form.append('overwriteFile', 'true');
  const res = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
    method: 'POST',
    headers: { Authorization: auth },
    body: form,
  });
  if (!res.ok) throw new Error(`${category}/${file}: ${res.status} ${await res.text()}`);
  return (await res.json()).filePath;
}

let done = 0;
const failures = [];
const queue = [...jobs];
await Promise.all(
  Array.from({ length: 5 }, async () => {
    while (queue.length) {
      const job = queue.shift();
      try {
        await upload(job);
        done++;
      } catch (e) {
        failures.push(e.message);
      }
    }
  }),
);
console.log(`Uploaded ${done}/${jobs.length}`);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
