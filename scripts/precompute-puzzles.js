/**
 * Pre-compute puzzle data for Lambda deployment.
 * Loads GloVe vectors locally and generates the 10 closest neighbours
 * for every puzzle word, then saves the result as compact JSON.
 *
 * Run: node scripts/precompute-puzzles.js
 * Requires: data/glove.6B.300d.txt (run `npm run download-vectors` first)
 */

import { loadVectors, mostSimilar, hasWord, allWords } from '../src/vectors.js';
import { PUZZLE_WORDS, tooSimilar } from '../src/puzzle.js';
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

    const { results } = mostSimilar(word, 50);
    const clues = [];
    for (const r of results) {
      if (clues.length >= 10) break;
      if (tooSimilar(r.word, word)) continue;
      if (clues.some(c => tooSimilar(r.word, c.word))) continue;
      clues.push({
        rank: clues.length + 1,
        word: r.word,
        similarity: Math.round(r.similarity * 10000) / 10000,
      });
    }
    puzzles[word] = clues;
    validWords.push(word);

    if (validWords.length % 10 === 0) {
      console.log(`  ${validWords.length}/${PUZZLE_WORDS.length} words processed...`);
    }
  }

  // Save puzzle data
  const output = { words: validWords, puzzles };
  const json = JSON.stringify(output);
  const outPath = join(__dirname, '..', 'api', 'puzzles.json');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, json);

  console.log(`\n✓ Pre-computed ${validWords.length} puzzles → api/puzzles.json`);
  console.log(`  File size: ${(Buffer.byteLength(json) / 1024).toFixed(1)}KB`);

  // Export vocabulary (alphabetic words only, 2+ chars) for dictionary validation
  console.log('\nExporting vocabulary for dictionary validation...');
  const vocab = allWords().filter(w => /^[a-z]{2,}$/.test(w));
  vocab.sort();
  const vocabPath = join(__dirname, '..', 'api', 'vocabulary.json');
  writeFileSync(vocabPath, JSON.stringify(vocab));

  console.log(`✓ Exported ${vocab.toLocaleString().length > 0 ? vocab.length.toLocaleString() : vocab.length} words → api/vocabulary.json`);
  console.log(`  File size: ${(Buffer.byteLength(JSON.stringify(vocab)) / (1024 * 1024)).toFixed(1)}MB`);
}

precompute().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
