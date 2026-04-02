# Clueword

A word-guessing game powered by semantic similarity. Guess the secret word from clues ranked by how closely related they are — the closer the clue, the warmer you're getting.

Built on GloVe (Global Vectors for Word Representation) embeddings with a lightweight Node.js API.

## Local Development

### Setup

```bash
npm install
```

### Downloading GloVe Data

The game uses Stanford's GloVe 6B 300-dimensional word vectors (~400k word vocabulary). The data file is **not included in the repo** — you need to download it before running locally:

```bash
npm run download-vectors
```

This downloads the vectors from Hugging Face (~862MB), extracts the 300d file (~1GB on disk), and cleans up the zip. It only needs to run once — if `data/glove.6B.300d.txt` already exists, it'll skip the download.

**Manual alternative:** Download `glove.6B.zip` from [Hugging Face](https://huggingface.co/stanfordnlp/glove/resolve/main/glove.6B.zip) or [Stanford NLP](https://nlp.stanford.edu/data/glove.6B.zip), extract `glove.6B.300d.txt`, and place it in the `data/` directory.

### Running locally

```bash
npm start
```

Starts on port 3200 (or set the `PORT` environment variable). Open `http://localhost:3200` to play.

The local server includes the full word similarity API in addition to the game.

## AWS Deployment

The game deploys to AWS as:
- **Lambda + API Gateway** — serves the puzzle API
- **S3 + CloudFront** — hosts the static frontend

CloudFront routes `/api/*` requests to the Lambda and serves everything else from S3.

### Prerequisites

- [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)
- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) configured with credentials
- GloVe data downloaded locally (for the pre-compute step)

### Pre-compute puzzle data

Before deploying, generate the puzzle data that Lambda uses. This runs locally with the full GloVe vectors and outputs a compact JSON file:

```bash
npm run precompute
```

This creates `api/puzzles.json` (~69KB) containing pre-computed clue sets for all ~142 puzzle words. The Lambda function loads this instead of the 1GB GloVe file.

> **Note:** `api/puzzles.json` is committed to the repo so you can deploy without needing the GloVe vectors. Only re-run `precompute` if you change the puzzle word list.

### Deploy

```bash
./deploy.sh [stack-name]
```

Defaults to stack name `clueword` in `eu-west-2`. Set `AWS_REGION` to override.

The script:
1. Builds the Lambda function (`sam build`)
2. Deploys the SAM stack (Lambda, API Gateway, S3, CloudFront)
3. Syncs the frontend to S3
4. Invalidates the CloudFront cache

Or deploy manually:

```bash
sam build
sam deploy --guided
aws s3 sync public/ s3://YOUR_BUCKET_NAME/ --delete
```

### Architecture

```
                    CloudFront
                   ┌──────────┐
                   │          │
            /api/* │          │  /*
           ┌───────┤          ├───────┐
           │       └──────────┘       │
           ▼                          ▼
    ┌─────────────┐            ┌─────────────┐
    │ API Gateway  │            │     S3      │
    │  (HTTP API)  │            │  (static)   │
    └──────┬──────┘            └─────────────┘
           │                    index.html
           ▼
    ┌─────────────┐
    │   Lambda    │
    │ (puzzle API)│
    └─────────────┘
     puzzles.json
```

## How Clueword Works

1. A secret word is chosen and the 10 most semantically similar words are pre-computed as clues
2. You're shown clues one at a time, starting with the *furthest* (#10) and working towards the *closest* (#1)
3. Each round you can **guess** or **skip** — both cost one of your 10 attempts
4. Scoring: ⭐⭐⭐⭐⭐ (1–2 clues) down to ⭐ (9–10 clues)

## API Endpoints

### Game (available on Lambda + local)

| Endpoint | Method | Description |
|---|---|---|
| `/api/puzzle/daily` | GET | Today's puzzle (deterministic, same for everyone) |
| `/api/puzzle/random` | GET | Random puzzle |
| `/api/puzzle/check` | POST | Validate a guess (`{ guess, puzzleId }` or `{ guess, daily: true }`) |
| `/api/health` | GET | Health check |

### Word Similarity (local only)

| Endpoint | Method | Description |
|---|---|---|
| `/similarity?word1=cat&word2=dog` | GET | Cosine similarity between two words |
| `/similar?word=coffee&n=10` | GET | N most similar words |
| `/check?word=waffle` | GET | Check if a word exists in the vocabulary |
| `/stats` | GET | Vocabulary size and model info |

## How Similarity Works

GloVe maps ~400k words to 300-dimensional vectors trained on 6 billion tokens of text. Words appearing in similar contexts end up with similar vectors. Cosine similarity between vectors gives a measure of semantic relatedness.

- **1.0** = identical meaning
- **0.7–0.9** = strongly related (cat/dog, king/queen)
- **0.3–0.6** = somewhat related (coffee/morning)
- **< 0.3** = weakly related or unrelated
