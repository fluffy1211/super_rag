import { Pinecone } from '@pinecone-database/pinecone';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { franc } from 'franc';
import 'dotenv/config';

// Client Pinecone utilisé pour écrire les vecteurs dans l'index distant.
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

// Découpe un texte en blocs ("chunks") de taille fixe avec chevauchement.
// Le chevauchement permet de garder du contexte entre 2 chunks consécutifs.
function chunckWithOverlap(text, chunkSize, overlap) {
  const words = text.split(' ');
  const chunks = [];
  let i = 0;
  while (i < words.length) {
    chunks.push(words.slice(i, i + chunkSize).join(' '));
    i += chunkSize - overlap;
  }
  return chunks.filter(c => c.trim().length > 0);
}

// Charge tous les fichiers .md/.txt d'un dossier.
// Retourne un tableau d'objets: [{ filename, text }].
function loadCorpus(dir) {
  const files = readdirSync(dir).filter(f => f.endsWith('.md') || f.endsWith('.txt'));
  console.log(`→ ${files.length} fichiers trouvés dans ${dir}`);
  return files.map(f => ({
    filename: f,
    text: readFileSync(join(dir, f), 'utf-8')
  }));
}

// Paramètres globaux du pipeline d'indexation.
// - chunkSize: nb de mots par chunk
// - overlap: nb de mots partagés entre chunks voisins
// - batchSize: nb de vecteurs envoyés à Pinecone par upsert
// - embedConcurrency: nb de chunks envoyés simultanément à Mistral pour embedding
export const CONFIG = { chunkSize: 400, overlap: 50, batchSize: 50, embedConcurrency: 5 };

// Appelle l'API Mistral embeddings pour un lot de textes
// et retourne un tableau de vecteurs numériques.
export async function embedBatch(texts) {
    const response = await fetch('https://api.mistral.ai/v1/embeddings', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`
        },
        body: JSON.stringify({ model: 'mistral-embed', input: texts })
    });

    if (!response.ok) {
        throw new Error(`Mistral embedding error ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    return data.data.map(item => item.embedding);
}

// Transforme les chunks d'un fichier en vecteurs puis les envoie à Pinecone.
// Étapes:
// 1) Générer les embeddings par petits groupes (embedConcurrency)
// 2) Construire les enregistrements avec métadonnées utiles pour la recherche
// 3) Filtrer les vecteurs invalides
// 4) Faire les upserts vers Pinecone par lots (batchSize)
async function embedAndIndex(chunks, filename, index, progress) {
  const vectors = [];
  for (let i = 0; i < chunks.length; i += CONFIG.embedConcurrency) {
    const batch = chunks.slice(i, i + CONFIG.embedConcurrency);
    const embeddings = await embedBatch(batch);
    embeddings.forEach((embedding, j) => {
      vectors.push({
        id: `${filename}-chunk-${i + j}`,
        values: embedding,
        metadata: {
          text: batch[j],
          source: filename,
          chunkIndex: i + j,
          language: franc(batch[j]),
          indexedAt: new Date()
        }
      });
    });
  }
  const validVectors = vectors.filter(v => v.values && v.values.length > 0);
  if (validVectors.length === 0) return;
  for (let i = 0; i < validVectors.length; i += CONFIG.batchSize) {
    const batch = validVectors.slice(i, i + CONFIG.batchSize);
    await index.upsert({ records: batch });
    progress.done += batch.length;
    console.log(`Upsert ${progress.done}/${progress.total}...`);
  }
}

// Dossier source des documents à indexer.
const CORPUS_DIR = new URL('../corpus', import.meta.url).pathname;

// Orchestration complète du pipeline d'indexation:
// - lecture du corpus
// - découpage en chunks
// - génération des embeddings
// - insertion des vecteurs dans Pinecone
async function main() {
  console.log('Chargement du corpus...');
  const docs = loadCorpus(CORPUS_DIR);

  const byFile = docs.map(({ filename, text }) => ({
    filename,
    chunks: chunckWithOverlap(text, CONFIG.chunkSize, CONFIG.overlap)
  }));
  const totalChunks = byFile.reduce((sum, { chunks }) => sum + chunks.length, 0);
  console.log(`${totalChunks} chunks créés`);

  const index = pinecone.index(process.env.PINECONE_INDEX_NAME);
  console.log('Indexation en cours...');
  const progress = { done: 0, total: totalChunks };
  for (const { filename, chunks } of byFile) {
    await embedAndIndex(chunks, filename, index, progress);
  }
  console.log(`Indexation terminée : ${totalChunks} vecteurs dans l'index "${process.env.PINECONE_INDEX_NAME}"`);
}

// Point d'entrée du script.
main().catch(console.error);
