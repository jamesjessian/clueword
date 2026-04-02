/**
 * Pre-compute puzzle data for Lambda deployment.
 * Loads GloVe vectors locally and generates the 10 closest neighbours
 * for every puzzle word, then saves the result as compact JSON.
 *
 * Run: node scripts/precompute-puzzles.js
 * Requires: data/glove.6B.300d.txt (run `npm run download-vectors` first)
 */

import { loadVectors, mostSimilar, hasWord } from '../src/vectors.js';
import { PUZZLE_WORDS } from '../src/puzzle.js';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function precompute() {
  console.log('Pre-computing puzzle data for Lambda deployment...\n');
  await loadVectors();

  const puzzles = {};
  const validWords = [];

  for (const word of PUZZLE_WORDS) {
    if (!hasWord(word)) {
      console.warn(`⚠ Skipping "${word}" — not in vocabulary`);
      continue;
    }

    const { results } = mostSimilar(word, 10);
    puzzles[word] = results.map((r, i) => ({
      rank: i + 1,
      word: r.word,
      similarity: Math.round(r.similarity * 10000) / 10000,
    }));
    validWords.push(word);

    if (validWords.length % 10 === 0) {
      console.log(`  ${validWords.length}/${PUZZLE_WORDS.length} words processed...`);
    }
  }

  const output = { words: validWords, puzzles };
  const json = JSON.stringify(output);
  const outPath = join(__dirname, '..', 'api', 'puzzles.json');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, json);

  console.log(`\n✓ Pre-computed ${validWords.length} puzzles → api/puzzles.json`);
  console.log(`  File size: ${(Buffer.byteLength(json) / 1024).toFixed(1)}KB`);
}

precompute().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
