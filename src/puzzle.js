import { mostSimilar, hasWord, vocabSize } from './vectors.js';

// Common, guessable English words — no obscure stuff
const PUZZLE_WORDS = [
  // Animals
  'tiger', 'dolphin', 'eagle', 'rabbit', 'penguin', 'elephant', 'butterfly', 'whale',
  'giraffe', 'lion', 'monkey', 'parrot', 'shark', 'turtle', 'wolf', 'bear', 'snake',
  'chicken', 'horse', 'cat', 'dog', 'fish', 'bird', 'frog', 'spider', 'ant',
  // Food & Drink
  'chocolate', 'pizza', 'banana', 'coffee', 'sandwich', 'pancake', 'spaghetti', 'cookie',
  'burger', 'salad', 'cheese', 'bread', 'soup', 'cake', 'wine', 'beer', 'juice', 'tea',
  'honey', 'butter', 'rice', 'potato', 'tomato', 'lemon', 'strawberry', 'cherry',
  // Places
  'beach', 'mountain', 'castle', 'forest', 'island', 'desert', 'village', 'harbor',
  'garden', 'library', 'museum', 'stadium', 'bridge', 'temple', 'palace', 'tower',
  // Objects
  'guitar', 'diamond', 'telescope', 'umbrella', 'lantern', 'compass', 'candle', 'mirror',
  'bicycle', 'camera', 'clock', 'piano', 'sword', 'crown', 'rocket', 'anchor', 'balloon',
  'blanket', 'pillow', 'ladder', 'hammer', 'whistle', 'trumpet', 'drum', 'violin',
  // Nature
  'thunder', 'rainbow', 'volcano', 'glacier', 'sunset', 'ocean', 'river', 'shadow',
  'tornado', 'blizzard', 'moonlight', 'sunrise', 'waterfall', 'lightning', 'earthquake',
  // Concepts & Activities
  'adventure', 'mystery', 'treasure', 'carnival', 'festival', 'voyage', 'wizard',
  'detective', 'astronaut', 'pirate', 'knight', 'dragon', 'ghost', 'vampire',
  'painting', 'sculpture', 'orchestra', 'theater', 'circus', 'marathon',
  // Everyday
  'breakfast', 'holiday', 'birthday', 'wedding', 'kitchen', 'bedroom', 'hospital',
  'airport', 'market', 'school', 'office', 'restaurant', 'cinema', 'station',
];

/**
 * Check if two words are morphological variants of each other.
 * Catches: roast/roasted, strawberry/strawberries, paint/painting, swim/swimmer
 */
function tooSimilar(a, b) {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short.length < 4) return false; // skip very short words to avoid false positives

  // One word is a prefix of the other: roast → roasted, fish → fishing
  if (long.startsWith(short)) return true;

  // Share almost the entire shorter word as a prefix: strawberry/strawberries
  let common = 0;
  while (common < short.length && short[common] === long[common]) common++;
  if (common >= short.length - 1) return true;

  return false;
}

/**
 * Generate a puzzle: pick a secret word, find 10 closest words as clues.
 * Filters out clues that are morphological variants of the secret or each other.
 * Returns { secret, clues: [{ rank, word, similarity }] } where clues[0] is rank 1 (closest).
 */
export function generatePuzzle(seed) {
  // Pick word — use seed for deterministic daily puzzles, or random
  const idx = seed !== undefined
    ? Math.abs(seed) % PUZZLE_WORDS.length
    : Math.floor(Math.random() * PUZZLE_WORDS.length);

  const secret = PUZZLE_WORDS[idx];

  if (!hasWord(secret)) {
    throw new Error(`Secret word "${secret}" not in vocabulary`);
  }

  // Fetch extra candidates so we can filter and still get 10 good clues
  const { results } = mostSimilar(secret, 50);

  const clues = [];
  for (const r of results) {
    if (clues.length >= 10) break;
    // Skip variants of the secret word
    if (tooSimilar(r.word, secret)) continue;
    // Skip variants of already-selected clues
    if (clues.some(c => tooSimilar(r.word, c.word))) continue;

    clues.push({
      rank: clues.length + 1,
      word: r.word,
      similarity: Math.round(r.similarity * 10000) / 10000,
    });
  }

  return { secret, clues };
}

export { tooSimilar };

/**
 * Generate a daily puzzle using date as seed.
 */
export function dailyPuzzle() {
  const now = new Date();
  // Simple date-based seed: days since epoch
  const seed = Math.floor(now.getTime() / (1000 * 60 * 60 * 24));
  return { ...generatePuzzle(seed), puzzleNumber: seed - 20088 }; // arbitrary offset for nice numbers
}

export { PUZZLE_WORDS };
