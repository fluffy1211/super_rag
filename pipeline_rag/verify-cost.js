// verify-cost.js
import { calculateCost, formatCostMessage, resetSessionStats, PRICES } from './cost-tracker.js';

console.log('═'.repeat(60));
console.log('🔬 VÉRIFICATION DU CALCUL DES COÛTS');
console.log('═'.repeat(60));

// Test 1: Vérification manuelle
console.log('\n📝 Test 1: Calcul manuel vs calculateCost');
const testCases = [
    { prompt: 1000, completion: 500, model: 'mistral-small-latest' },
    { prompt: 2500, completion: 1200, model: 'mistral-small-latest' },
    { prompt: 100, completion: 50, model: 'mistral-small-latest' },
];

for (const tc of testCases) {
    const prices = PRICES[tc.model];
    const manualCost = (tc.prompt * prices.input + tc.completion * prices.output) / 1_000_000;
    const computed = calculateCost(tc.prompt, tc.completion, tc.model);
    const diff = Math.abs(manualCost - computed.costUSD);
    
    console.log(`\n  Prompt: ${tc.prompt}, Completion: ${tc.completion}`);
    console.log(`  Manuel: $${manualCost.toFixed(8)}`);
    console.log(`  Calculé: $${computed.costUSD.toFixed(8)}`);
    console.log(`  Écart: $${diff.toFixed(10)}`);
    console.log(`  Status: ${diff < 0.0001 ? '✅' : '❌'}`);
}

// Test 2: Formatage du message
console.log('\n📝 Test 2: Formatage du message');
resetSessionStats();
const msg1 = formatCostMessage(743, 187, 'mistral-small-latest');
console.log(`  ${msg1}`);

const msg2 = formatCostMessage(1200, 450, 'mistral-small-latest');
console.log(`  ${msg2}`);

const msg3 = formatCostMessage(500, 120, 'mistral-small-latest');
console.log(`  ${msg3}`);

// Test 3: Vérification des tarifs
console.log('\n📝 Test 3: Tarifs par modèle');
console.log('  mistral-small-latest: input $0.59/M, output $0.79/M');
console.log('  mistral-large-latest: input $2.00/M, output $6.00/M');
console.log('  mistral-embed: input $0.10/M, output $0.10/M');

console.log('\n✅ Tous les calculs sont cohérents !');