
/**
 * Formate la réponse avec footer de transparence et sources
 * @param {string} answer - Réponse générée
 * @param {Array} sources - Métadonnées des sources Pinecone
 * @param {number} confidence - Score de confiance (0-1)
 * @returns {string} Réponse formatée
 */
export function formatResponse(answer, sources = [], confidence = null) {
    const footer = [];
    
    // Ajouter les sources si disponibles
    if (sources && sources.length > 0) {
        const sourceList = sources.map((s, i) => {
            const sourceName = s.metadata?.source || s.source || 'Document';
            return `[${i + 1}] ${sourceName}`;
        }).join('\n');
        footer.push(`\n\n**Sources:**\n${sourceList}`);
    }
    
    // Ajouter la note de confiance si < 80%
    if (confidence !== null && confidence < 0.80) {
        footer.push(`\n\n> Note: score de pertinence contextuelle : ${Math.round(confidence * 100)}%.`);
    }
    
    // Disclaimer obligatoire
    footer.push(`\n\n---\n*Réponse générée par IA à partir des documents fournis. Vérifiez les sources avant toute décision importante.*`);
    
    return answer + footer.join('');
}