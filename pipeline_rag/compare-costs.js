// compare-costs.js - Version simplifiée et robuste
import 'dotenv/config';
import { ragQuery } from './scripts/create-index.js';
import { getSessionStats, resetSessionStats } from './cost-tracker.js';

const questions = [
    "How do I configure OpenAI models for authentication in PydanticAI?",
    "What are the different message types and request/response parts?",
];

const DELAY_MS = 2000;

async function compareWithBaseline() {
    console.log('\n' + '═'.repeat(60));
    console.log('📊 COMPARAISON DES COÛTS');
    console.log('═'.repeat(60));
    
    resetSessionStats();
    
    for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        console.log(`\n[${i + 1}/${questions.length}] ${question.substring(0, 60)}...`);
        
        if (i > 0) {
            await new Promise(r => setTimeout(r, DELAY_MS));
        }
        
        try {
            const answer = await ragQuery(question, { verbose: false, showCost: true });
            console.log(`  ✅ Réponse reçue (${answer.length} caractères)`);
        } catch (error) {
            console.error(`  ❌ Erreur: ${error.message}`);
        }
    }
    
    const stats = getSessionStats();
    console.log('\n' + '═'.repeat(60));
    console.log('📈 RÉSUMÉ');
    console.log('═'.repeat(60));
    console.log(`Requêtes: ${stats.sessionRequestCount}`);
    console.log(`Tokens input: ${stats.sessionTotalPromptTokens}`);
    console.log(`Tokens output: ${stats.sessionTotalCompletionTokens}`);
    console.log(`Coût total: $${stats.sessionTotalCost.toFixed(6)}`);
}

// Test simple d'abord
async function quickTest() {
    console.log('\n🔬 TEST RAPIDE - Une seule question');
    resetSessionStats();
    
    try {
        const answer = await ragQuery("What is PydanticAI?", { verbose: true, showCost: true });
        console.log('\n✅ Test réussi !');
        console.log(`Réponse: ${answer.substring(0, 200)}...`);
    } catch (error) {
        console.error('❌ Erreur:', error);
        console.error('Stack:', error.stack);
    }
}

// Lancer le test rapide par défaut
if (process.argv[2] === 'full') {
    compareWithBaseline();
} else {
    quickTest();
}