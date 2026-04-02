import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VECTORS_PATH = join(__dirname, '..', 'data', 'glove.6B.300d.txt');

/** @type {Map<string, Float32Array>} */
const vectors = new Map();

/**
 * Load GloVe vectors into memory.
 * ~400k words × 300 dimensions — takes ~15s and ~1.5GB RAM.
 */
export async function loadVectors() {
  const start = Date.now();
  console.log('Loading GloVe vectors...');

  const rl = createInterface({
    input: createReadStream(VECTORS_PATH, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  let count = 0;
  for await (const line of rl) {
    const spaceIdx = line.indexOf(' ');
    if (spaceIdx === -1) continue;

    const word = line.substring(0, spaceIdx);
    const parts = line.substring(spaceIdx + 1).split(' ');
    const vec = new Float32Array(parts.length);
    for (let i = 0; i < parts.length; i++) {
      vec[i] = parseFloat(parts[i]);
    }
    vectors.set(word, vec);
    count++;

    if (count % 100_000 === 0) {
      console.log(`  loaded ${(count / 1000).toFixed(0)}k words...`);
    }
  }

  console.log(`✓ Loaded ${count.toLocaleString()} word vectors in ${((Date.now() - start) / 1000).toFixed(1)}s`);
  return vectors;
}

/**
 * Get the vector for a word (case-insensitive).
 */
export function getVector(word) {
  return vectors.get(word.toLowerCase()) || null;
}

/**
 * Cosine similarity between two vectors.
 * Returns a value between -1 and 1.
 */
export function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
}

/**
 * Get similarity between two words.
 * Returns { similarity, found } or throws if word not found.
 */
export function wordSimilarity(word1, word2) {
  const v1 = getVector(word1);
  const v2 = getVector(word2);

  const missing = [];
  if (!v1) missing.push(word1);
  if (!v2) missing.push(word2);

  if (missing.length > 0) {
    return { similarity: null, missing };
  }

  return {
    similarity: cosineSimilarity(v1, v2),
    missing: [],
  };
}

/**
 * Find the N most similar words to a given word.
 */
export function mostSimilar(word, n = 10) {
  const target = getVector(word);
  if (!target) return { results: null, missing: [word] };

  const scored = [];
  for (const [w, vec] of vectors) {
    if (w === word.toLowerCase()) continue;
    scored.push({ word: w, similarity: cosineSimilarity(target, vec) });
  }

  scored.sort((a, b) => b.similarity - a.similarity);
  return { results: scored.slice(0, n), missing: [] };
}

/**
 * Check if a word exists in the vocabulary.
 */
export function hasWord(word) {
  return vectors.has(word.toLowerCase());
}

/**
 * Get vocabulary size.
 */
export function vocabSize() {
  return vectors.size;
}

/**
 * Get all words in the vocabulary.
 */
export function allWords() {
  return Array.from(vectors.keys());
}
