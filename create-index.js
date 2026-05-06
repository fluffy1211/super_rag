// create-index.js
import { Pinecone } from '@pinecone-database/pinecone';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { franc } from 'franc';
import 'dotenv/config';

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

// Paramètres du chunking - ajustables
const CHUNK_SIZE = 400;   // tokens approximatifs
const OVERLAP = 50;
const BATCH_SIZE = 50;    // vecteurs par upsert Pinecone
const EMBED_CONCURRENCY = 5; // appels d'embedding en parallèle max

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

async function embedText(text) {
  // TODO : appeler l'API d'embedding Mistral
  // Endpoint : https://api.mistral.ai/v1/embeddings
  // Modèle : "mistral-embed"
  // Retourner le vecteur (tableau de nombres)
  const response = await fetch('https://api.mistral.ai/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`
    },
    body: JSON.stringify({
      model: 'mistral-embed',
      input: text
    })
  });

  if (!response.ok) {
    throw new Error(`Embedding API error ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  console.log('Embedding reçu (longueur):', data.data[0].embedding.length);
  return data.data[0].embedding;
}

async function embedBatch(texts) {
  // TODO : appeler l'API d'embedding avec plusieurs textes à la fois
  // L'API Mistral accepte un tableau dans "input"
  // Retourner un tableau de vecteurs dans le même ordre
    const response = await fetch('https://api.mistral.ai/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`
    },
    body: JSON.stringify({
      model: 'mistral-embed',
      input: texts
    })
  });

  if (!response.ok) {
    throw new Error(`Embedding API error ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  console.log(`Batch embedding reçu pour ${texts.length} textes.`);
  return data.data.map(item => item.embedding);
}

// --- Traitement d'un fichier ---

async function processFile(filePath, indexName) {
  const index = pinecone.index(indexName);
  const filename = filePath.split('/').pop();
  const language = franc(text.slice(0, 1000)); // returns 'eng', 'fra', etc.
  const indexedAt = new Date().toISOString();

  console.log(`\n→ Traitement de ${filename}...`);

  // Découpage
  const rawChunks = chunkWithOverlap(text, CHUNK_SIZE, OVERLAP);
  console.log(`  ${rawChunks.length} chunks créés`);

  // Embedding par lots concurrents
  const vectors = [];
  for (let i = 0; i < rawChunks.length; i += EMBED_CONCURRENCY) {
    const batch = rawChunks.slice(i, i + EMBED_CONCURRENCY);

    // TODO : embedder chaque chunk du batch en parallèle avec Promise.all
    // Construire un tableau de vecteurs Pinecone :
    // { id: `${filename}-chunk-${index}`, values: vecteur, metadata: { text, source, chunkIndex } }
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

    console.log(`  Embeddé ${Math.min(i + EMBED_CONCURRENCY, rawChunks.length)}/${rawChunks.length} chunks...`);
  }

  // Upsert dans Pinecone par lots
  for (let i = 0; i < vectors.length; i += BATCH_SIZE) {
    const batch = vectors.slice(i, i + BATCH_SIZE);
    // TODO : insérer le batch dans l'index Pinecone
    // Afficher la progression : "  Upsert 50/247 vecteurs..."
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
    // TODO : appeler processFile et accumuler le total
    // Gérer l'erreur si un fichier plante (continuer les autres)
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