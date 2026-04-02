import express from 'express';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { loadVectors, wordSimilarity, mostSimilar, hasWord, vocabSize } from './vectors.js';
import { generatePuzzle, dailyPuzzle } from './puzzle.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3200;
const app = express();

app.use(express.json());
app.use(express.static(join(__dirname, '..', 'public')));

// ── Similarity between two words ────────────────────────────
// GET /similarity?word1=cat&word2=dog
// POST /similarity { "word1": "cat", "word2": "dog" }

app.get('/similarity', (req, res) => {
  const { word1, word2 } = req.query;
  if (!word1 || !word2) {
    return res.status(400).json({ error: 'Both word1 and word2 query params required' });
  }
  return handleSimilarity(res, word1, word2);
});

app.post('/similarity', (req, res) => {
  const { word1, word2 } = req.body || {};
  if (!word1 || !word2) {
    return res.status(400).json({ error: 'Both word1 and word2 fields required' });
  }
  return handleSimilarity(res, word1, word2);
});

function handleSimilarity(res, word1, word2) {
  const result = wordSimilarity(word1, word2);

  if (result.missing.length > 0) {
    return res.status(404).json({
      error: `Word(s) not found in vocabulary: ${result.missing.join(', ')}`,
      missing: result.missing,
    });
  }

  return res.json({
    word1: word1.toLowerCase(),
    word2: word2.toLowerCase(),
    similarity: Math.round(result.similarity * 10000) / 10000,
    percentage: Math.round(result.similarity * 1000) / 10 + '%',
  });
}

// ── Most similar words ──────────────────────────────────────
// GET /similar?word=coffee&n=10

app.get('/similar', (req, res) => {
  const { word, n = '10' } = req.query;
  if (!word) {
    return res.status(400).json({ error: 'word query param required' });
  }

  const count = Math.min(parseInt(n, 10) || 10, 100);
  const result = mostSimilar(word, count);

  if (result.missing.length > 0) {
    return res.status(404).json({
      error: `Word not found in vocabulary: ${word}`,
    });
  }

  return res.json({
    word: word.toLowerCase(),
    results: result.results.map(r => ({
      word: r.word,
      similarity: Math.round(r.similarity * 10000) / 10000,
    })),
  });
});

// ── Check if word exists ────────────────────────────────────
// GET /check?word=waffle

app.get('/check', (req, res) => {
  const { word } = req.query;
  if (!word) {
    return res.status(400).json({ error: 'word query param required' });
  }
  return res.json({ word: word.toLowerCase(), exists: hasWord(word) });
});

// ── Stats ───────────────────────────────────────────────────

app.get('/stats', (_req, res) => {
  return res.json({
    vocabularySize: vocabSize(),
    dimensions: 300,
    model: 'GloVe 6B 300d',
  });
});

// ── Puzzle API ──────────────────────────────────────────────
// GET /api/puzzle/daily — today's puzzle (clues only, no secret)
// GET /api/puzzle/random — random puzzle
// POST /api/puzzle/check — check a guess

app.get('/api/puzzle/daily', (_req, res) => {
  const puzzle = dailyPuzzle();
  return res.json({
    puzzleNumber: puzzle.puzzleNumber,
    clues: puzzle.clues.map(c => ({ rank: c.rank, word: c.word })),
    // Secret is NOT sent — it's checked server-side
    _secret: puzzle.secret, // TODO: remove in prod, useful for dev
  });
});

app.get('/api/puzzle/random', (_req, res) => {
  const puzzle = generatePuzzle();
  const id = Buffer.from(puzzle.secret).toString('base64url');
  return res.json({
    puzzleId: id,
    clues: puzzle.clues.map(c => ({ rank: c.rank, word: c.word })),
    _secret: puzzle.secret,
  });
});

app.post('/api/puzzle/check', (req, res) => {
  const { guess, puzzleId, daily } = req.body || {};
  if (!guess) {
    return res.status(400).json({ error: 'guess is required' });
  }

  const normalised = guess.toLowerCase().trim();

  // Validate word exists in dictionary
  if (!hasWord(normalised)) {
    return res.json({ valid: false, correct: false, guess: normalised });
  }

  let secret;
  if (daily) {
    secret = dailyPuzzle().secret;
  } else if (puzzleId) {
    secret = Buffer.from(puzzleId, 'base64url').toString();
  } else {
    return res.status(400).json({ error: 'Either daily:true or puzzleId required' });
  }

  const correct = normalised === secret.toLowerCase();
  return res.json({ valid: true, correct, guess: normalised });
});

// ── Health ──────────────────────────────────────────────────

app.get('/health', (_req, res) => res.json({ ok: true }));

// ── Start ───────────────────────────────────────────────────

async function start() {
  await loadVectors();

  app.listen(PORT, () => {
    console.log(`\n🧠 Word Similarity Service running on http://localhost:${PORT}`);
    console.log(`\nEndpoints:`);
    console.log(`  GET  /similarity?word1=cat&word2=dog`);
    console.log(`  POST /similarity  { "word1": "cat", "word2": "dog" }`);
    console.log(`  GET  /similar?word=coffee&n=10`);
    console.log(`  GET  /check?word=waffle`);
    console.log(`  GET  /stats`);
    console.log(`  GET  /health\n`);
  });
}

start().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
