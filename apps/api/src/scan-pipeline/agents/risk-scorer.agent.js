class RiskScorerAgent {
    calculate(analysisResult) {
        console.log(`[RiskScorer] Calculating score based on analysis...`);

        // In a real scenario, this could be a secondary AI call or a weighted algorithm
        // For now, we trust the Reasoner's output but normalize it

        let severity = "LOW";
        if (analysisResult.risk_score >= 80) severity = "CRITICAL";
        else if (analysisResult.risk_score >= 60) severity = "HIGH";
        else if (analysisResult.risk_score >= 30) severity = "MEDIUM";

        return {
            score: analysisResult.risk_score,
            severity: severity,
            category: analysisResult.is_public ? "Public Exposure" : "Configuration",
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = new RiskScorerAgent();
