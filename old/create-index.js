// create-index.js
import { Pinecone } from '@pinecone-database/pinecone';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { franc } from 'franc';
import 'dotenv/config';
import { embedBatch } from './embeddings.js';

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

// Paramètres du chunking - ajustables
const CHUNK_SIZE = 200;    // mots approximatifs par chunk
const OVERLAP = 20;
const BATCH_SIZE = 15;     // vecteurs par upsert Pinecone
const EMBED_BATCH_SIZE = 5; // chunks envoyés à Mistral en une seule requête

// --- Fonctions utilitaires ---

function chunkWithOverlap(text, size, overlap) {
  const words = text.split(' ');
  const chunks = [];
  let i = 0;
  while (i < words.length) {
    chunks.push(words.slice(i, i + size).join(' '));
    i += size - overlap;
  }
  return chunks.filter(c => c.trim().length > 0);
}

// --- Traitement d'un fichier ---

async function processFile(filePath, indexName) {
  const index = pinecone.index(indexName);
  const filename = filePath.split('/').pop();
  const text = readFileSync(filePath, 'utf-8');
  const language = franc(text.slice(0, 1000));
  const indexedAt = new Date().toISOString();

  console.log(`\n→ Traitement de ${filename}...`);

  // Découpage
  const rawChunks = chunkWithOverlap(text, CHUNK_SIZE, OVERLAP);
  console.log(`  ${rawChunks.length} chunks créés`);

  // Embedding par lots
  const vectors = [];
  for (let i = 0; i < rawChunks.length; i += EMBED_BATCH_SIZE) {
    const batch = rawChunks.slice(i, i + EMBED_BATCH_SIZE);
    const embeddings = await embedBatch(batch);
    embeddings.forEach((embedding, j) => {
      vectors.push({
        id: `${filename}-chunk-${i + j}`,
        values: embedding,
        metadata: {
          text: batch[j],
          source: filename,
          chunkIndex: i + j,
          language: language,
          indexedAt: indexedAt
        }
      });
    });

    console.log(`  Embeddé ${Math.min(i + EMBED_BATCH_SIZE, rawChunks.length)}/${rawChunks.length} chunks...`);
  }

  // Upsert dans Pinecone par lots
  for (let i = 0; i < vectors.length; i += BATCH_SIZE) {
    const batch = vectors.slice(i, i + BATCH_SIZE);
    await index.upsert({ records: batch });
    console.log(`  Upsert ${Math.min(i + BATCH_SIZE, vectors.length)}/${vectors.length} vecteurs...`);
  }

  return vectors.length;
}

// --- Point d'entrée ---

async function main() {
  const INDEX_NAME = process.env.PINECONE_INDEX_NAME;
  const CORPUS_DIR = './corpus';

  const files = readdirSync(CORPUS_DIR)
    .filter(f => f.endsWith('.txt') || f.endsWith('.md'))
    .map(f => join(CORPUS_DIR, f));

  console.log(`Indexation de ${files.length} fichiers dans l'index "${INDEX_NAME}"`);

  let total = 0;
  for (const file of files) {
    try {
      const count = await processFile(file, INDEX_NAME);
      total += count;
    } catch (error) {
      console.error(`Erreur lors du traitement de ${file}:`, error);
    }
  }

  console.log(`\nIndexation terminée. ${total} vecteurs au total.`);
}

main().catch(console.error);