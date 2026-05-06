import 'dotenv/config';
import { embedText } from './embeddings.js';
import { runAgent } from './agent-loop.js';
import { tools, toolFunctions } from './agent.js';

async function searchSimilar(query, topK = 3) {
  const embedding = await embedText(query);

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

async function ragQuery(question) {
  console.log(`\n\n--- Question : "${question}" ---\n`);
  const similarChunks = await searchSimilar(question);

  console.log('Contexte récupéré (avec scores) :\n');
  similarChunks.forEach(({ score, text }) => {
    console.log(`  [score: ${score.toFixed(3)}] ${text}`);
  });

  const contextBlock = similarChunks.map(c => `- ${c.text} (score: ${c.score.toFixed(3)})`).join('\n');
  const userMessage = `Question : ${question}\n\nContexte :\n${contextBlock}`;

  const ragHistory = [
    {
      role: 'system',
      content: `Tu es un assistant RAG. Réponds UNIQUEMENT en te basant sur le contexte fourni dans le message utilisateur.
                Règles strictes :
                1. Si la réponse est dans le contexte, cite l'information précisément.
                2. Si la réponse n'est PAS dans le contexte, dis : "Je ne trouve pas cette information dans le contexte fourni."
                3. N'invente rien. Ne fais pas de recherche web. N'utilise pas tes connaissances générales.`
    }
  ];

  await runAgent(tools, toolFunctions, userMessage, ragHistory);
}

async function main() {
  await ragQuery('Quelle version minimale de Python est requise pour installer PydanticAI ?');
}

main().catch(console.error);