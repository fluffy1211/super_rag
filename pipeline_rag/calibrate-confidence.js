import 'dotenv/config';
import { retrieveContext } from './scripts/create-index.js';
import { computeConfidence } from './scripts/confidence.js';

const testCases = [
    {
        id: 1,
        type: "✅ HAPPY PATH",
        query: "How do I configure OpenAI models for authentication in PydanticAI?",
        expected: "0.85-0.92"
    },
    {
        id: 2,
        type: "⚠️ ZONE GRISE",
        query: "Comment réagit Node face aux erreurs en pipeline ?",
        expected: "0.60-0.75"
    },
    {
        id: 3,
        type: "❌ HORS CORPUS",
        query: "What is the best recipe for chocolate cake?",
        expected: "< 0.50"
    }
];

async function calibrate() {
    console.log('\n🔬 CALIBRATION DU SEUIL DE CONFIANCE\n');
    
    for (const test of testCases) {
        console.log(`\n${test.type}: "${test.query}"`);
        console.log(`Attendu: ${test.expected}`);
        
        const { matches: context } = await retrieveContext(test.query, 5);
        const confidence = computeConfidence(context);
        
        console.log(`📊 Top-1 score: ${confidence.topScore.toFixed(4)} (${confidence.confidencePercent}%)`);
        console.log(`📊 Top-3 moyenne: ${confidence.avgScore.toFixed(4)}`);
        
        if (context.length > 0) {
            console.log(`📚 Source trouvée: ${context[0].source} (score: ${context[0].score.toFixed(4)})`);
        }
        
        await new Promise(r => setTimeout(r, 2000));
    }
    
    console.log('\n💡 Recommandation: Ajoutez CONFIDENCE_THRESHOLD=0.72 dans votre .env');
}

calibrate().catch(console.error);