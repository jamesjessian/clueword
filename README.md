# Clueword

A word-guessing game powered by semantic similarity. Guess the secret word from clues ranked by how closely related they are — the closer the clue, the warmer you're getting.

Built on GloVe (Global Vectors for Word Representation) embeddings with a lightweight Node.js API.

## Setup

```bash
npm install
```

### Downloading GloVe Data

The game uses Stanford's GloVe 6B 300-dimensional word vectors (~400k word vocabulary). The data file is **not included in the repo** — you need to download it before running:

```bash
npm run download-vectors
```

This downloads the vectors from Hugging Face (~862MB), extracts the 300d file (~1GB on disk), and cleans up the zip. It only needs to run once — if `data/glove.6B.300d.txt` already exists, it'll skip the download.

**Manual alternative:** Download `glove.6B.zip` from [Hugging Face](https://huggingface.co/stanfordnlp/glove/resolve/main/glove.6B.zip) or [Stanford NLP](https://nlp.stanford.edu/data/glove.6B.zip), extract `glove.6B.300d.txt`, and place it in the `data/` directory.

### Running

```bash
npm start
```

Starts on port 3200 (or set the `PORT` environment variable).

Open `http://localhost:3200` to play Clueword in the browser.

## How Clueword Works

1. A secret word is chosen and the 10 most semantically similar words are pre-computed as clues
2. You're shown clues one at a time, starting with the *furthest* (#10) and working towards the *closest* (#1)
3. Each round you can **guess** or **skip** — both cost one of your 10 attempts
4. Scoring: ⭐⭐⭐⭐⭐ (1–2 clues) down to ⭐ (9–10 clues)

## API Endpoints

### Game

- `GET /api/puzzle/daily` — Today's puzzle (deterministic, same for everyone)
- `GET /api/puzzle/random` — Random puzzle
- `POST /api/puzzle/check` — Validate a guess (`{ puzzleId, guess }`)

### Word Similarity

- `GET /similarity?word1=cat&word2=dog` — Cosine similarity between two words
- `GET /similar?word=coffee&n=10` — N most similar words
- `GET /check?word=waffle` — Check if a word exists in the vocabulary
- `GET /stats` — Vocabulary size and model info

## How Similarity Works

GloVe maps ~400k words to 300-dimensional vectors trained on 6 billion tokens of text. Words appearing in similar contexts end up with similar vectors. Cosine similarity between vectors gives a measure of semantic relatedness.

- **1.0** = identical meaning
- **0.7–0.9** = strongly related (cat/dog, king/queen)
- **0.3–0.6** = somewhat related (coffee/morning)
- **< 0.3** = weakly related or unrelated
