
import 'dotenv/config';
import { calculateCost } from './cost-tracker.js';

// Circuit Breaker pour protéger contre les appels en cascade
export class CircuitBreaker {
  constructor(options = {}) {
    this.threshold = options.threshold || 5;      // Nombre d'échecs avant ouverture
    this.timeout = options.timeout || 30000;      // Durée de l'état ouvert (ms)
    this.failureCount = 0;
    this.state = 'CLOSED';                        // CLOSED, OPEN, HALF_OPEN
    this.nextAttempt = null;
  }

  async call(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() > this.nextAttempt) {
        console.log('[CircuitBreaker] Passage en HALF_OPEN - tentative unique autorisée');
        this.state = 'HALF_OPEN';
      } else {
        throw new Error(`[CircuitBreaker] Circuit ouvert - requête refusée (réessayez dans ${Math.ceil((this.nextAttempt - Date.now()) / 1000)}s)`);
      }
    }

    try {
      const result = await fn();
      
      // Succès - réinitialiser si HALF_OPEN
      if (this.state === 'HALF_OPEN') {
        console.log('[CircuitBreaker] Succès en HALF_OPEN - fermeture du circuit');
        this.reset();
      }
      
      return result;
    } catch (error) {
      // Ne compter que les erreurs 429/503
      const isRetriable = error.message.includes('429') || 
                          error.message.includes('503') ||
                          error.message.includes('rate limit');
      
      if (isRetriable) {
        this.failureCount++;
        console.log(`[CircuitBreaker] Échec #${this.failureCount}/${this.threshold}`);
        
        if (this.failureCount >= this.threshold) {
          this.state = 'OPEN';
          this.nextAttempt = Date.now() + this.timeout;
          console.log(`[CircuitBreaker] Circuit ouvert pour ${this.timeout / 1000}s`);
        }
      }
      
      throw error;
    }
  }

  reset() {
    this.failureCount = 0;
    this.state = 'CLOSED';
    this.nextAttempt = null;
  }

  getState() {
    return { state: this.state, failureCount: this.failureCount };
  }
}

// Retry exponentiel avec jitter
export async function withRetry(fn, maxRetries = 3, baseDelay = 1000) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Vérifier si l'erreur est réessayable (429 ou 503)
      const isRetriable = error.message.includes('429') || 
                          error.message.includes('503') ||
                          error.message.includes('rate limit');
      
      if (!isRetriable || attempt === maxRetries) {
        throw error;
      }
      
      // Délai exponentiel avec jitter
      const delay = Math.pow(2, attempt - 1) * baseDelay + Math.random() * 500;
      console.log(`[withRetry] Tentative ${attempt}/${maxRetries} échouée. Nouvel essai dans ${Math.round(delay)}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

// Appel LLM robuste avec timeout et retry intégré
export async function callLLM(messages, options = {}) {
    const {
        timeout = 30000,
        model = 'mistral-small-latest',
        temperature = 0.1,
        maxRetries = 3,
        retryDelay = 1000,
        includeCost = true
    } = options;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const makeRequest = async () => {
        try {
            const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`
                },
                body: JSON.stringify({
                    model,
                    messages,
                    temperature
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Mistral API error ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            
            // DEBUG: Afficher la structure de la réponse
            console.log('🔍 API Response structure:', Object.keys(data));
            console.log('🔍 Usage present?', !!data.usage);
            if (data.usage) {
                console.log('🔍 Usage keys:', Object.keys(data.usage));
            }
            
            // Ajouter les métadonnées de coût si demandé
            if (includeCost && data.usage) {
                const { calculateCost } = await import('./cost-tracker.js');
                const costInfo = calculateCost(
                    data.usage.prompt_tokens,
                    data.usage.completion_tokens,
                    model
                );
                data.cost = costInfo;
            } else if (includeCost && !data.usage) {
                console.warn('⚠️  Aucune donnée usage dans la réponse Mistral');
                data.usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
            }
            
            return data;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error(`Timeout LLM après ${timeout}ms`);
            }
            throw error;
        }
    }
    return await withRetry(makeRequest, maxRetries, retryDelay);
}
// Version embed avec retry
export async function callEmbeddings(texts, options = {}) {
  const {
    timeout = 30000,
    model = 'mistral-embed',
    maxRetries = 3,
    retryDelay = 1000
  } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  const makeRequest = async () => {
    try {
      const response = await fetch('https://api.mistral.ai/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`
        },
        body: JSON.stringify({ model, input: texts }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Mistral embedding error ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      return data.data.map(item => item.embedding);
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error(`Timeout embeddings après ${timeout}ms`);
      }
      
      throw error;
    }
  };

  return await withRetry(makeRequest, maxRetries, retryDelay);
}