import { retrieveContext, generateCompletion } from './create-index.js';
import { writeFileSync } from 'fs';

async function judgeWithLLM(question, chunks, answer) {
  const context = chunks.map((c, i) => `Chunk ${i + 1}: ${c.text}`).join('\n\n');
  const prompt = `Tu es un évaluateur de systèmes RAG. Donne deux notes uniquement.

Question: ${question}

Chunks récupérés:
${context}

Réponse générée:
${answer}

Réponds UNIQUEMENT avec ce JSON (rien d'autre):
{"pertinence": <1-5>, "fidelite": <1-5>, "notes": "<phrase simple d'évaluation max 15 mots>"}

Pertinence: les chunks étaient-ils liés à la question? (1=pas du tout, 5=parfaitement)
Fidélité: la réponse reflète-t-elle fidèlement les chunks sans inventer? (1=beaucoup d'inventions, 5=fidèle)
Notes: une phrase simple expliquant le point faible ou fort`;

  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`
    },
    body: JSON.stringify({
      model: 'mistral-small-latest',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) throw new Error(`Judge error ${response.status}: ${await response.text()}`);
  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
}

const questions = [
  "How do I configure OpenAI models for authentication in PydanticAI?",
  "What are the different message types and request/response parts available in the messages module?",
  "How can I integrate Mistral models into my PydanticAI project?",
  "What tools are available in PydanticAI and how do I use the built-in tools?",
  "How do I set up and use embeddings in my PydanticAI application?",
  "What is the difference between Ollama, Cohere, and Anthropic model implementations?",
  "How do I configure model profiles and manage multiple model configurations?",
  "What output formats does PydanticAI support and how do I structure response outputs?",
  "How does the model wrapper work and how can I wrap custom models?",
  "What is A2A in PydanticAI and how does it relate to the API structure?"
];

// Estimations de coût
const COST_PER_INPUT_TOKEN = 0.59 / 1_000_000;
const COST_PER_OUTPUT_TOKEN = 0.79 / 1_000_000;

const DELAY_MS = 10000; // Eviter le rate limiting

const results = [];

for (let i = 0; i < questions.length; i++) {
  if (i > 0) {
    console.log(`  Waiting ${DELAY_MS / 1000}s to avoid rate limit...`);
    await new Promise(r => setTimeout(r, DELAY_MS));
  }
  const q = questions[i];
  console.log(`\n[${i + 1}/10] ${q}`);

  const { matches: context, retrievalTime } = await retrieveContext(q, 5);

  const top1Score = context.length > 0 ? context[0].score : 0;
  const top3Scores = context.slice(0, 3).map(c => c.score);
  const avgTop3Score = top3Scores.length > 0
    ? top3Scores.reduce((s, x) => s + x, 0) / top3Scores.length
    : 0;

  const { answer, generationTime, data } = await generateCompletion(q, context);

  const promptTokens = data.usage.prompt_tokens;
  const completionTokens = data.usage.completion_tokens;
  const costUSD = promptTokens * COST_PER_INPUT_TOKEN + completionTokens * COST_PER_OUTPUT_TOKEN;

  const { pertinence, fidelite, notes } = await judgeWithLLM(q, context, answer);

  console.log(`  top1=${top1Score.toFixed(2)} avg3=${avgTop3Score.toFixed(2)} tokens=${promptTokens}/${completionTokens} cost=$${costUSD.toFixed(4)} latency=${retrievalTime + generationTime}ms`);
  console.log(`  pertinence=${pertinence}/5 fidelite=${fidelite}/5`);
  console.log(`  notes: ${notes}`);
  console.log(`  Answer snippet: ${answer.slice(0, 120)}...`);

  results.push({
    index: i + 1,
    question: q,
    top1Score,
    avgTop3Score,
    promptTokens,
    completionTokens,
    costUSD,
    latencyMs: retrievalTime + generationTime,
    answer,
    pertinence,
    fidelite,
    notes
  });
}

// Build markdown table
const rows = results.map(r => {
  return `| ${r.index} | ${r.question} | ${r.top1Score.toFixed(2)} | ${r.avgTop3Score.toFixed(2)} | ${r.promptTokens} / ${r.completionTokens} | $${r.costUSD.toFixed(4)} | ${r.pertinence} | ${r.fidelite} | ${r.notes} |`;
});

const avgPertinence = (results.reduce((s, r) => s + r.pertinence, 0) / results.length).toFixed(1);
const avgFidelite = (results.reduce((s, r) => s + r.fidelite, 0) / results.length).toFixed(1);
const totalCost = results.reduce((s, r) => s + r.costUSD, 0);
const avgLatency = Math.round(results.reduce((s, r) => s + r.latencyMs, 0) / results.length);

const table = `# Eval Table — RAG Pipeline

| # | Question | Top-1 score | Avg top-3 score | Tokens (in/out) | Coût ($) | Pertinence (1-5) | Fidélité (1-5) | Notes |
|---|----------|-------------|-----------------|-----------------|----------|------------------|----------------|-------|
${rows.join('\n')}
| | **Moyenne Pertinence** | | | | | ${avgPertinence} | | |
| | **Moyenne Fidélité** | | | | | | ${avgFidelite} | |
| | **Coût total (10 requêtes)** | | | | $${totalCost.toFixed(4)} | | | |
| | **Latence moyenne** | | | | ${avgLatency} ms | | | |
`;

writeFileSync(
  new URL('../../eval-table.md', import.meta.url).pathname,
  table,
  'utf-8'
);

console.log('\n✓ eval-table.md written');
