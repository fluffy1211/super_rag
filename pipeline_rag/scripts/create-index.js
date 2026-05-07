import { Pinecone } from '@pinecone-database/pinecone';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { franc } from 'franc';
import dotenv from 'dotenv';

import { callLLM, callEmbeddings, CircuitBreaker, withRetry } from '../llm.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '..', '.env') });

// Instance partagée du circuit breaker pour Mistral
export const llmBreaker = new CircuitBreaker({ threshold: 5, timeout: 30000 });

// Client Pinecone utilisé pour écrire les vecteurs dans l'index distant.
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY});

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
  console.log(`\n→ ${files.length} fichiers trouvés dans ${dir}`);
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
  return await llmBreaker.call(async () => {
    return await callEmbeddings(texts);
  });
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

// Dossier source des documents à indexer
const CORPUS_DIR = fileURLToPath(new URL('../corpus', import.meta.url));

// Orchestration complète du pipeline d'indexation:
// - lecture du corpus
// - découpage en chunks
// - génération des embeddings
// - insertion des vecteurs dans Pinecone

// Fonction d'indexation du corpus qui est appelé dans index-corpus.js.
export async function main() {
  console.log('\nChargement du corpus...');
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

export async function retrieveContext(query, topK = 5) {
    const startTime = Date.now();
    const index = pinecone.index(process.env.PINECONE_INDEX_NAME);
    const queryEmbedding = await embedBatch([query]);
    const response = await index.query({
        vector: queryEmbedding[0],
        topK,
        includeMetadata: true
    });
    const retrievalTime = Date.now() - startTime;
    return {
        matches: response.matches
            .filter(m => m.score >= 0.5)
            .map(m => ({
                text: m.metadata.text,
                source: m.metadata.source,
                score: m.score,
                chunkIndex: m.metadata.chunkIndex
            })),
        retrievalTime
    };
}

// Retourne la réponse en texte (string) générée par Mistral à partir d'une question et d'un contexte (chunks récupérés).
export async function generateCompletion(query, context) {
    const systemPrompt = `Tu es un assistant documentaire strict. Tu réponds uniquement aux questions portant sur le contenu des documents fournis. Règles :
1. Réponds en synthétisant les informations du contexte fourni. Tu peux reformuler et expliquer.
2. Cite les sources entre crochets (ex: [Source: docs_a2a.md]) pour chaque point clé.
3. Si le contexte ne contient pas l’information nécessaire, réponds : "Je ne trouve pas cette information dans les documents fournis. [Source : <liste des sources consultées>]"
4. Ne fabrique pas d’informations absentes du contexte.
5. Si la demande est hors sujet (blague, opinion, fiction, ou toute requête sans lien avec les documents), réponds uniquement : "Requête hors sujet. Je réponds uniquement aux questions sur les documents fournis."
6. Cite tes sources aussi a la fin de ta réponse sous la forme "Sources consultées: [source1, source2, ...]"`;

    const userPrompt = `Question: ${query}\n\nContexte:\n${context.map((c, i) => `Chunk ${i + 1} (source: ${c.source}):\n${c.text}\n`).join('\n')}\n\nRéponse:`;

    const start = Date.now();

    const data = await llmBreaker.call(async () => {
      return await callLLM([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], {
        temperature: 0.1,
        model: 'mistral-small-latest'
      });
    });

    const generationTime = Date.now() - start;

    return {
        data,
        answer: data.choices[0].message.content.trim(),
        generationTime
    };
}

// Ajouter des metrics qui s'envoient a la fin telles que le topscore, le avgscore, le retrievalms, le generationsms, le prompttokens, le generations tokens et le costUSD.
export async function ragQuery(questions, options = { topK: 5, verbose: false }) {
    const { matches: context, retrievalTime } = await retrieveContext(questions, options.topK);
    if (options.verbose) {
        console.log('Context retrieved:');
        context.forEach((c, i) => {
            console.log(`Chunk ${i + 1} (source: ${c.source}, score: ${c.score.toFixed(4)}):\n${c.text}\n`);
        });
    }
    const { answer, generationTime, data } = await generateCompletion(questions, context);
    if (options.verbose) {
        const metrics = {
            topScore: context.length > 0 ? context[0].score : 0,
            avgScore: context.reduce((sum, c) => sum + c.score, 0) / context.length || 0,
            retrievalMs: retrievalTime,
            generationMs: generationTime,
            promptTokens: data.usage.prompt_tokens,
            generationTokens: data.usage.completion_tokens,
        };
        console.log('Metrics:', metrics);
    }
    return answer;
}


// Fonction de test pour vérifier le circuit breaker
export async function testCircuitBreaker() {
  console.log('\n🧪 Test du Circuit Breaker:');
  console.log('Lancement de 6 requêtes qui vont échouer...\n');
  
  for (let i = 1; i <= 7; i++) {
    try {
      console.log(`Requête ${i}:`);
      // Simuler un appel qui échoue toujours
      await llmBreaker.call(async () => {
        throw new Error('429 rate limit simulé');
      });
    } catch (error) {
      console.log(`  ❌ ${error.message}`);
    }
    
    const state = llmBreaker.getState();
    console.log(`  État circuit: ${state.state} (échecs: ${state.failureCount})`);
    
    if (i < 7) await new Promise(r => setTimeout(r, 500));
  }
  
  console.log('\nAttente de réouverture...');
  await new Promise(r => setTimeout(r, 31000));
  
  // Réinitialiser pour les tests normaux
  llmBreaker.reset();
  console.log('Circuit réinitialisé pour le fonctionnement normal\n');
}


 