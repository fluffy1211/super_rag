import 'dotenv/config';

const MISTRAL_EMBED_MODEL = 'mistral-embed';

async function callMistralEmbeddings(input) {
  const response = await fetch('https://api.mistral.ai/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`
    },
    body: JSON.stringify({ model: MISTRAL_EMBED_MODEL, input })
  });

  if (!response.ok) {
    throw new Error(`Mistral embedding error ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

export async function embedText(text) {
  const data = await callMistralEmbeddings(text);
  return data.data[0].embedding;
}

export async function embedBatch(texts) {
  const data = await callMistralEmbeddings(texts);
  return data.data.map(item => item.embedding);
}
