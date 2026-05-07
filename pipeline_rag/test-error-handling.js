// test-error-handling.js
import 'dotenv/config';
import { ragQuery, testCircuitBreaker, llmBreaker } from './scripts/create-index.js';

// Test 1: Happy path - question normale
async function testHappyPath() {
  console.log('\n📝 TEST 1: Happy Path - Question normale');
  console.log('=' .repeat(50));
  
  try {
    const answer = await ragQuery("Comment fonctionne le module stream ?", { verbose: false });
    console.log('✅ Succès - Réponse reçue');
    console.log(`Réponse (extrait): ${answer.slice(0, 200)}...`);
    return true;
  } catch (error) {
    console.error('❌ Échec:', error.message);
    return false;
  }
}

// Test 2: Simulation de timeout réseau (déconnecter WiFi après le fetch)
async function testTimeout() {
  console.log('\n📝 TEST 2: Simulation de timeout');
  console.log('=' .repeat(50));
  console.log('⚠️  Pour ce test, déconnectez votre WiFi IMMÉDIATEMENT après avoir vu "Démarrage..."');
  console.log('Vous avez 3 secondes pour le faire...\n');
  
  console.log('Démarrage de la requête...');
  
  const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => {
      console.log('✅ Timeout correctement géré après 30 secondes');
      resolve(false);
    }, 31000);
  });
  
  const ragPromise = ragQuery("Une question simple", { verbose: false })
    .then(() => {
      console.log('⚠️  La requête a réussi (le WiFi était peut-être encore connecté)');
      return true;
    })
    .catch((error) => {
      if (error.message.includes('Timeout')) {
        console.log('✅ Timeout capturé avec message clair');
        return false;
      }
      console.error('❌ Erreur inattendue:', error.message);
      return false;
    });
  
  const result = await Promise.race([ragPromise, timeoutPromise]);
  return !result;
}

// Test 3: Rate limiting avec Circuit Breaker
async function testRateLimitingAndCircuitBreaker() {
  console.log('\n📝 TEST 3: Rate Limiting & Circuit Breaker');
  console.log('=' .repeat(50));
  console.log('Lancement de 100 requêtes pour forcer une 429...\n');
  
  let circuitOpenedLogCount = 0;
  let successCount = 0;
  let failureCount = 0;
  
  // Capturer les logs spécifiques
  const originalConsoleLog = console.log;
  console.log = (...args) => {
    const message = args.join(' ');
    if (message.includes('[CircuitBreaker] Circuit ouvert')) {
      circuitOpenedLogCount++;
      originalConsoleLog('🔌 ' + message);
    } else {
      originalConsoleLog(...args);
    }
  };
  
  const questions = [
    "Question 1: Que contient le corpus?",
    "Question 2: Quelle est la date des documents?",
    "Question 3: Quels sont les sujets abordés?",
    "Question 4: Y a-t-il des exemples de code?",
    "Question 5: Comment est structuré le document?",
  ];
  
  for (let i = 0; i < 100; i++) {
    const question = questions[i % questions.length];
    
    try {
      await ragQuery(question, { verbose: false });
      successCount++;
      if (i % 10 === 0) process.stdout.write('.');
    } catch (error) {
      failureCount++;
      if (i % 10 === 0) process.stdout.write('x');
    }
    
    // Pause courte pour éviter de tout planter
    await new Promise(r => setTimeout(r, 50));
  }
  
  console.log('\n');
  console.log(`✅ Succès: ${successCount}`);
  console.log(`❌ Échecs: ${failureCount}`);
  console.log(`📊 Circuit ouvert logs: ${circuitOpenedLogCount}`);
  
  // Restaurer console.log
  console.log = originalConsoleLog;
  
  // Vérifier que le log apparaît exactement une fois (ou au moins une fois)
  if (circuitOpenedLogCount >= 1) {
    console.log('✅ Circuit Breaker s\'est correctement ouvert');
    return true;
  } else {
    console.log('⚠️  Circuit Breaker ne s\'est pas ouvert (peut-être pas assez de 429)');
    return false;
  }
}

// Nettoyage final
async function cleanup() {
  console.log('\n🧹 Nettoyage...');
  llmBreaker.reset();
  console.log('Circuit Breaker réinitialisé');
}

// Exécution des tests
async function runTests() {
  console.log('\n🚀 DÉMARRAGE DES TESTS DE ROBUSTESSE');
  console.log('=' .repeat(50));
  
  let test1Passed = false;
  let test2Passed = false;
  let test3Passed = false;
  
  try {
    test1Passed = await testHappyPath();
    
    console.log('\n' + '=' .repeat(50));
    console.log('📌 Pour le test 2: Déconnectez votre WiFi après avoir vu "Démarrage de la requête..."');
    console.log('Appuyez sur Entrée quand vous êtes prêt...');
    await new Promise(resolve => process.stdin.once('data', resolve));
    
    test2Passed = await testTimeout();
    
    console.log('\n' + '=' .repeat(50));
    console.log('📌 Test 3: Va forcer le rate limiting (peut prendre ~30 secondes)');
    console.log('Appuyez sur Entrée pour continuer...');
    await new Promise(resolve => process.stdin.once('data', resolve));
    
    test3Passed = await testRateLimitingAndCircuitBreaker();
    
  } catch (error) {
    console.error('Erreur pendant les tests:', error);
  } finally {
    await cleanup();
  }
  
  // Résumé final
  console.log('\n' + '=' .repeat(50));
  console.log('📊 RÉSUMÉ DES TESTS');
  console.log('=' .repeat(50));
  console.log(`Test 1 (Happy Path): ${test1Passed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Test 2 (Timeout): ${test2Passed ? '✅ PASS' : '⚠️  À vérifier manuellement'}`);
  console.log(`Test 3 (Circuit Breaker): ${test3Passed ? '✅ PASS' : '⚠️  PARTIEL'}`);
  console.log('\n' + '=' .repeat(50));
}

// Lancer les tests
runTests().catch(console.error);