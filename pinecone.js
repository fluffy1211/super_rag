import 'dotenv/config';
import { runAgent } from './agent-loop.js';

async function getIndexInfo() {
  const response = await fetch(`https://api.pinecone.io/indexes/${process.env.PINECONE_INDEX_NAME}`, {
    headers: {
      'Api-Key': process.env.PINECONE_API_KEY,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Pinecone API error ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  console.log('Index connected:', data);
}

async function getEmbeddings(text) {
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
  return data.data[0].embedding;
}

function simpleChunk(text, maxWords = 50) {
    const words = text.split(' ');
    const chunks = [];
    for (let i = 0; i < words.length; i += maxWords) {
        chunks.push(words.slice(i, i + maxWords).join(' '));
    }
    return chunks;
}

async function upsertChunks(chunks) {
  const response = await fetch(`${process.env.PINECONE_INDEX_HOST}/vectors/upsert`, {
    method: 'POST',
    headers: {
      'Api-Key': process.env.PINECONE_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      vectors: await Promise.all(chunks.map(async (chunk, i) => ({
        id: `chunk-${Date.now()}-${i}`,
        values: await getEmbeddings(chunk),
        metadata: { text: chunk }
      })))
    })
  });

  if (!response.ok) {
    throw new Error(`Pinecone upsert error ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  console.log('Chunks upserted:', data);
}

async function searchSimilar(query, topK = 3) {
  const embedding = await getEmbeddings(query);

  const response = await fetch(`${process.env.PINECONE_INDEX_HOST}/query`, {
    method: 'POST',
    headers: {
      'Api-Key': process.env.PINECONE_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      vector: embedding,
      topK,
      includeMetadata: true
    })
  });

  if (!response.ok) {
    throw new Error(`Pinecone query error ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  return data.matches.map(match => ({ score: match.score, text: match.metadata.text }));
}


const RAG_SYSTEM_PROMPT = `Tu es un assistant qui répond uniquement en te basant sur le contexte fourni.
Règles strictes :
1. Si la réponse se trouve dans le contexte, réponds précisément en citant l'information.
2. Si la réponse N'EST PAS dans le contexte, dis explicitement : "Je ne trouve pas cette information dans le contexte fourni."
3. N'invente jamais d'information absente du contexte.
4. Ne fais pas appel à tes connaissances générales.`;

async function ragQuery(question) {
  console.log(`\n\n--- Question : "${question}" ---\n`);
  const similarChunks = await searchSimilar(question);

  console.log('Contexte récupéré (avec scores) :\n');
  similarChunks.forEach(({ score, text }) => {
    console.log(`  [score: ${score.toFixed(3)}] ${text}`);
  });

  const contextBlock = similarChunks.map(c => `- ${c.text} (score: ${c.score.toFixed(3)})`).join('\n');
  const userMessage = `Question : ${question}\n\nContexte :\n${contextBlock}`;

  const response = await runAgent([], {}, userMessage, undefined, RAG_SYSTEM_PROMPT);
}

async function main() {
  // Test 1 : réponse présente dans le corpus
  await ragQuery('De quelle couleur est le chat ?');

  // Test 2 : réponse absente du corpus
  await ragQuery('Quel est le nom du chien ?');
}

main().catch(console.error);