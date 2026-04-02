import { existsSync, createWriteStream } from 'fs';
import { mkdir, unlink } from 'fs/promises';
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const OUTPUT_FILE = join(DATA_DIR, 'glove.6B.300d.txt');
const ZIP_FILE = join(DATA_DIR, 'glove.6B.zip');

const GLOVE_URL = 'https://huggingface.co/stanfordnlp/glove/resolve/main/glove.6B.zip';

async function download() {
  if (existsSync(OUTPUT_FILE)) {
    console.log(`✓ Vectors already exist at ${OUTPUT_FILE}`);
    return;
  }

  await mkdir(DATA_DIR, { recursive: true });

  console.log('Downloading GloVe 6B vectors from Hugging Face...');
  console.log('This is ~862MB — grab a cuppa ☕\n');

  const res = await fetch(GLOVE_URL);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);

  const total = parseInt(res.headers.get('content-length') || '0', 10);
  let downloaded = 0;

  const nodeStream = Readable.fromWeb(res.body);

  nodeStream.on('data', (chunk) => {
    downloaded += chunk.length;
    if (total) {
      const pct = ((downloaded / total) * 100).toFixed(1);
      process.stdout.write(`\r  ${pct}% (${(downloaded / 1e6).toFixed(0)}MB / ${(total / 1e6).toFixed(0)}MB)`);
    }
  });

  await pipeline(nodeStream, createWriteStream(ZIP_FILE));
  console.log('\n✓ Download complete');

  console.log('Extracting glove.6B.300d.txt from zip...');
  execSync(`unzip -o -j "${ZIP_FILE}" "glove.6B.300d.txt" -d "${DATA_DIR}"`, { stdio: 'inherit' });

  await unlink(ZIP_FILE);
  console.log('✓ Cleaned up zip file');
  console.log(`✓ Vectors ready at ${OUTPUT_FILE}`);
}

download().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
