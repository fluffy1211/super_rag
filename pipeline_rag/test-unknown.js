// test-unknown.js
import 'dotenv/config';
import { ragQuery } from './scripts/create-index.js';

async function testUnknown() {
    console.log('\n🧪 TEST "JE NE SAIS PAS"\n');
    
    const outOfCorpusQuestion = "What is the chemical composition of dark matter?";
    
    console.log(`Question: ${outOfCorpusQuestion}\n`);
    const answer = await ragQuery(outOfCorpusQuestion, { verbose: false });
    console.log(`\nRéponse: ${answer}`);
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ Vérifiez:');
    console.log('1. Aucun appel LLM (pas de [Stats] avec tokens > 0)');
    console.log('2. Message exact de "je ne sais pas"');
}

testUnknown().catch(console.error);