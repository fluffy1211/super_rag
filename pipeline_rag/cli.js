import 'dotenv/config';
import readline from 'node:readline';
import { ragQuery } from './scripts/create-index.js';

const MAX_QUERY_LENGTH = 5000;

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

process.on('SIGINT', () => {
  console.log('\nBye.');
  rl.close();
  process.exit(0);
});

function ask(prompt) {
  return new Promise(resolve => rl.question(prompt, resolve));
}

console.log('Mini-Perplexity - posez vos questions sur le corpus (Ctrl+C pour quitter)\n');

while (true) {
  const query = (await ask('> ')).trim();

  if (!query) continue;

  if (query.length > MAX_QUERY_LENGTH) {
    console.error(`Query too long (${query.length} chars, max ${MAX_QUERY_LENGTH}). Please shorten it.`);
    continue;
  }

  try {
    console.log('\nRecherche en cours...\n');
    const answer = await ragQuery(query);
    console.log(answer + '\n');
  } catch (err) {
    console.error('Error:', err.message);
  }
}
