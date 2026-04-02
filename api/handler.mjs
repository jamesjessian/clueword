/**
 * Clueword API — AWS Lambda handler.
 *
 * Serves puzzle endpoints from pre-computed data (no GloVe vectors needed).
 * Designed for API Gateway HTTP API (v2 payload format).
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load pre-computed puzzle data (cold start — runs once per Lambda instance)
const data = JSON.parse(readFileSync(join(__dirname, 'puzzles.json'), 'utf8'));
const { words, puzzles } = data;

// Load vocabulary for dictionary validation
const vocabulary = new Set(JSON.parse(readFileSync(join(__dirname, 'vocabulary.json'), 'utf8')));

// ── Helpers ─────────────────────────────────────────────────

function getDailySeed() {
  const now = new Date();
  return Math.floor(now.getTime() / (1000 * 60 * 60 * 24));
}

function getPuzzle(word) {
  return { secret: word, clues: puzzles[word] };
}

function dailyPuzzle() {
  const seed = getDailySeed();
  const idx = Math.abs(seed) % words.length;
  return { ...getPuzzle(words[idx]), puzzleNumber: seed - 20088 };
}

function randomPuzzle() {
  const idx = Math.floor(Math.random() * words.length);
  const word = words[idx];
  const id = Buffer.from(word).toString('base64url');
  return { ...getPuzzle(word), puzzleId: id };
}

function respond(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(body),
  };
}

// ── Handler ─────────────────────────────────────────────────

export async function handler(event) {
  const path = event.rawPath || event.requestContext?.http?.path || '';
  const method = (event.requestContext?.http?.method || event.httpMethod || 'GET').toUpperCase();

  // GET /api/puzzle/daily
  if (path === '/api/puzzle/daily' && method === 'GET') {
    const puzzle = dailyPuzzle();
    return respond(200, {
      puzzleNumber: puzzle.puzzleNumber,
      clues: puzzle.clues.map(c => ({ rank: c.rank, word: c.word })),
    });
  }

  // GET /api/puzzle/random
  if (path === '/api/puzzle/random' && method === 'GET') {
    const puzzle = randomPuzzle();
    return respond(200, {
      puzzleId: puzzle.puzzleId,
      clues: puzzle.clues.map(c => ({ rank: c.rank, word: c.word })),
    });
  }

  // POST /api/puzzle/check
  if (path === '/api/puzzle/check' && method === 'POST') {
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return respond(400, { error: 'Invalid JSON body' });
    }

    const { guess, puzzleId, daily } = body;
    if (!guess) return respond(400, { error: 'guess is required' });

    const normalised = guess.toLowerCase().trim();

    // Validate word exists in dictionary
    if (!vocabulary.has(normalised)) {
      return respond(200, { valid: false, correct: false, guess: normalised });
    }

    let secret;
    if (daily) {
      secret = dailyPuzzle().secret;
    } else if (puzzleId) {
      try {
        secret = Buffer.from(puzzleId, 'base64url').toString();
      } catch {
        return respond(400, { error: 'Invalid puzzleId' });
      }
    } else {
      return respond(400, { error: 'Either daily:true or puzzleId required' });
    }

    const correct = normalised === secret.toLowerCase();
    return respond(200, { valid: true, correct, guess: normalised, secret });
  }

  // GET /api/health
  if (path === '/api/health' || path === '/health') {
    return respond(200, {
      ok: true,
      mode: 'lambda',
      puzzleCount: words.length,
    });
  }

  return respond(404, { error: 'Not found' });
}
