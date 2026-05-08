import 'dotenv/config';
import readline from 'node:readline';
import { ragQuery, resetCostTracking } from './scripts/create-index.js';
import { getSessionStats } from './cost-tracker.js';

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

// Option pour réinitialiser les stats
console.log('Commandes spéciales: /reset pour réinitialiser les stats, /stats pour afficher les stats\n');

while (true) {
  const query = (await ask('> ')).trim();

  if (!query) continue;

  // Commandes spéciales
    if (query === '/reset') {
        resetCostTracking();
        console.log('✅ Stats réinitialisées\n');
        continue;
    }
    
    if (query === '/stats') {
        const stats = getSessionStats();
        console.log(`\n📊 Stats session: ${stats.sessionRequestCount} requêtes | $${stats.sessionTotalCost.toFixed(6)} | ${stats.sessionTotalPromptTokens + stats.sessionTotalCompletionTokens} tokens total\n`);
        continue;
    }
    
    if (query.length > MAX_QUERY_LENGTH) {
        console.error(`Query too long (${query.length} chars, max ${MAX_QUERY_LENGTH}). Please shorten it.`);
        continue;
    }
    
    try {
        console.log('\n🔍 Recherche en cours...\n');
        const answer = await ragQuery(query, { verbose: false, showCost: true });
        console.log(answer + '\n');
    } catch (err) {
        console.error('Error:', err.message);
    }
}
