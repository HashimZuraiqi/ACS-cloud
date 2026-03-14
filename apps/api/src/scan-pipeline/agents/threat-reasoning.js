/**
 * Threat Reasoning Engine
 * 
 * Analyzes attack paths, toxic combinations, anomalies, and scan findings
 * to generate an Executive Summary and Technical Analysis.
 */

class ThreatReasoningEngine {
    /**
     * Analyze security data and reasoning about overall threat posture
     * @param {Object} data - Contains attackPaths, toxicCombinations, anomalies, scanFindings
     * @returns {Object} - The generated reasoning reports
     */
    analyze({ attackPaths = [], toxicCombinations = [], anomalies = [], scanFindings = [] }) {
        console.log('[ThreatReasoningEngine] Analyzing threat landscape...');

        const executiveSummary = this._generateExecutiveSummary(attackPaths, toxicCombinations, anomalies, scanFindings);
        const technicalAnalysis = this._generateTechnicalAnalysis(attackPaths, toxicCombinations, anomalies, scanFindings);

        return {
            type: "AI_THREAT_ANALYSIS",
            executive_summary: executiveSummary,
            technical_analysis: technicalAnalysis,
            timestamp: new Date().toISOString()
        };
    }

    _generateExecutiveSummary(attackPaths, toxicCombinations, anomalies, scanFindings) {
        let impact = 'Low';
        let explanation = 'No significant threats detected in the current infrastructure.';

        if (attackPaths.length > 0 || toxicCombinations.length > 0) {
            impact = 'Critical';
            explanation = `Detected ${attackPaths.length} potential attack path(s) and ${toxicCombinations.length} toxic combination(s) that could allow attackers to compromise critical assets. Immediate remediation is recommended to reduce business risk.`;
        } else if (anomalies.length > 0 || scanFindings.length > 0) {
            impact = 'Medium';
            explanation = `Detected suspicious behaviors or misconfigurations. While no direct attack paths to critical assets were found, these issues increase the overall attack surface.`;
        }

        return {
            business_explanation: explanation,
            impact_description: `Business Risk Level: ${impact}. Potential exposure of sensitive data or unauthorized access to system resources.`
        };
    }

    _generateTechnicalAnalysis(attackPaths, toxicCombinations, anomalies, scanFindings) {
        const attackChainExplanation = attackPaths.length > 0 
            ? `Attackers could exploit interconnected vulnerabilities to traverse the network. Example: ${attackPaths[0].description || attackPaths[0].name || 'Initial access leading to privilege escalation.'}`
            : 'No complete attack chains discovered.';

        const exploitedVulnerabilities = [];
        
        // Add toxic combination descriptions
        toxicCombinations.forEach(tc => {
             exploitedVulnerabilities.push(`Toxic Combination: ${tc.description || tc.name || 'Correlated vulnerabilities across resources.'}`);
        });

        // Add critical/high scan findings
        scanFindings.forEach(f => {
            if (f.severity === 'CRITICAL' || f.severity === 'HIGH') {
                exploitedVulnerabilities.push(`${f.severity} Finding: ${f.type || f.description || 'Misconfiguration'}`);
            }
        });

        let priority = 'Low';
        if (attackPaths.length > 0) priority = 'Critical - Address attack paths immediately';
        else if (toxicCombinations.length > 0) priority = 'High - Break toxic combinations';
        else if (anomalies.length > 0 || exploitedVulnerabilities.length > 0) priority = 'Medium - Investigate anomalies and fix misconfigurations';

        // Deduplicate and limit vulnerabilities
        const uniqueVulns = [...new Set(exploitedVulnerabilities)].slice(0, 10);

        return {
            attack_chain_explanation: attackChainExplanation,
            exploited_vulnerabilities: uniqueVulns,
            recommended_remediation_priority: priority
        };
    }
}

module.exports = new ThreatReasoningEngine();
