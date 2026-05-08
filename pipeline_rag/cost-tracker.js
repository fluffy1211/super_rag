
let sessionTotalCost = 0;
let sessionTotalPromptTokens = 0;
let sessionTotalCompletionTokens = 0;
let sessionRequestCount = 0;

const MODEL_PRICES = {
    'mistral-small-latest': { input: 0.59, output: 0.79 },
    'mistral-large-latest': { input: 2.00, output: 6.00 },
    'mistral-embed': { input: 0.10, output: 0.10 },
};

export function calculateCost(promptTokens, completionTokens, model = 'mistral-small-latest') {
    const prices = MODEL_PRICES[model] || MODEL_PRICES['mistral-small-latest'];
    const inputCost = (promptTokens / 1_000_000) * prices.input;
    const outputCost = (completionTokens / 1_000_000) * prices.output;
    
    return {
        costUSD: inputCost + outputCost,
        promptTokens,
        completionTokens,
        inputCost,
        outputCost,
        model
    };
}

export function updateSessionStats(promptTokens, completionTokens, model = 'mistral-small-latest') {
    const { costUSD } = calculateCost(promptTokens, completionTokens, model);
    
    sessionTotalCost += costUSD;
    sessionTotalPromptTokens += promptTokens;
    sessionTotalCompletionTokens += completionTokens;
    sessionRequestCount++;
    
    return {
        sessionTotalCost,
        sessionTotalPromptTokens,
        sessionTotalCompletionTokens,
        sessionRequestCount,
        lastRequestCost: costUSD
    };
}

export function formatCostMessage(promptTokens, completionTokens, model = 'mistral-small-latest') {
    const { costUSD } = calculateCost(promptTokens, completionTokens, model);
    const stats = updateSessionStats(promptTokens, completionTokens, model);
    
    return `[Stats] Input: ${promptTokens} tokens | Output: ${completionTokens} tokens | Coût: $${costUSD.toFixed(6)} | Session total: $${stats.sessionTotalCost.toFixed(6)} (${stats.sessionRequestCount} req)`;
}

export function resetSessionStats() {
    sessionTotalCost = 0;
    sessionTotalPromptTokens = 0;
    sessionTotalCompletionTokens = 0;
    sessionRequestCount = 0;
    console.log('[CostTracker] Session stats réinitialisées');
}

export function getSessionStats() {
    return {
        sessionTotalCost,
        sessionTotalPromptTokens,
        sessionTotalCompletionTokens,
        sessionRequestCount
    };
}

export const PRICES = MODEL_PRICES;