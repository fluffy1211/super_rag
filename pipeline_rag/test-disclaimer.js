
import 'dotenv/config';
import { ragQuery } from './scripts/create-index.js';

async function testDisclaimer() {
    console.log('\n📝 TEST DISCLAIMER\n');
    
    // Cas 1: Confiance haute (>80%)
    console.log('1️⃣ CAS HAUTE CONFIANCE:');
    const answer1 = await ragQuery("How do I configure OpenAI models in PydanticAI?", { verbose: false });
    console.log(answer1);
    
    await new Promise(r => setTimeout(r, 3000));
    
    // Cas 2: Confiance basse (hors corpus)
    console.log('\n2️⃣ CAS BASSE CONFIANCE:');
    const answer2 = await ragQuery("What is the capital of Atlantis?", { verbose: false });
    console.log(answer2);
}

testDisclaimer().catch(console.error);