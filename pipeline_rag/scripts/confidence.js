// scripts/confidence.js
import 'dotenv/config';

/**
 * Calcule le score de confiance basé sur les résultats de recherche Pinecone
 * @param {Array} matches - Résultats de index.query() de Pinecone
 * @returns {Object} { topScore, avgScore, sufficient, confidencePercent, details }
 */
export function computeConfidence(matches) {
    const validMatches = matches.filter(m => m.score !== undefined && m.score !== null);
    
    if (validMatches.length === 0) {
        return {
            topScore: 0,
            avgScore: 0,
            sufficient: false,
            confidencePercent: 0,
            details: {
                topK: 0,
                threshold: parseFloat(process.env.CONFIDENCE_THRESHOLD || '0.75'),
                message: "Aucun document trouvé"
            }
        };
    }
    
    const topScore = validMatches[0].score;
    const topK = Math.min(3, validMatches.length);
    const avgScore = validMatches.slice(0, topK).reduce((sum, m) => sum + m.score, 0) / topK;
    
    const threshold = parseFloat(process.env.CONFIDENCE_THRESHOLD || '0.75');
    const sufficient = topScore >= threshold;
    const confidencePercent = Math.round(topScore * 100);
    
    return {
        topScore,
        avgScore,
        sufficient,
        confidencePercent,
        details: { topK, threshold, message: "" }
    };
}

/**
 * Formate le message de confiance pour affichage
 */
export function formatConfidenceMessage(confidence) {
    const { topScore, avgScore, confidencePercent, sufficient, details } = confidence;
    const threshold = details.threshold * 100;
    const status = sufficient ? '✅' : '⚠️';
    return `${status} Confiance contextuelle : ${confidencePercent}% (top match: ${topScore.toFixed(3)}, moyenne top-${details.topK}: ${avgScore.toFixed(3)}) | Seuil: ${threshold}%`;
}