# Word Similarity Service

A lightweight Node.js API that computes semantic similarity between words using GloVe (Global Vectors for Word Representation) embeddings.

## Setup

```bash
npm install
npm run download-vectors   # Downloads GloVe 6B 300d (~862MB download, ~1GB on disk)
npm start                  # Starts on port 3200 (or PORT env var)
```

## Endpoints

### `GET /similarity?word1=cat&word2=dog`
Returns cosine similarity between two words.

```json
{
  "word1": "cat",
  "word2": "dog",
  "similarity": 0.8798,
  "percentage": "87.98%"
}
```

### `GET /similar?word=coffee&n=10`
Returns the N most similar words.

### `GET /check?word=waffle`
Checks if a word exists in the vocabulary.

### `GET /stats`
Returns vocabulary size and model info.

## How it works

GloVe maps ~400k words to 300-dimensional vectors trained on 6 billion tokens of text. Words appearing in similar contexts end up with similar vectors. Cosine similarity between vectors gives a measure of semantic relatedness.

- **1.0** = identical meaning
- **0.7–0.9** = strongly related (cat/dog, king/queen)
- **0.3–0.6** = somewhat related (coffee/morning)
- **< 0.3** = weakly related or unrelated
