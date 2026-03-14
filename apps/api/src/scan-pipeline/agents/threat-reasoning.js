/**
 * Threat Reasoning Engine
 * 
 * Analyzes attack paths, toxic combinations, anomalies, and scan findings
 * to generate an Executive Summary and Technical Analysis.
 */

class ThreatReasoningEngine {
    /**
     * Analyze security data and reasoning about overall threat posture
     * @param {Object} data 
     * @returns {Object} - The generated reasoning reports
     */
    analyze({ attackPaths = [], toxicCombinations = [], anomalies = [], scanFindings = [], cloudTrail = [], escalations = [], chains = [], data = [], ueba = [], network = [] }) {
        console.log('[ThreatReasoningEngine] Analyzing deep threat landscape...');

        const executiveSummary = this._generateExecutiveSummary(attackPaths, toxicCombinations, anomalies, scanFindings, cloudTrail, escalations, chains, data, ueba, network);
        const technicalAnalysis = this._generateTechnicalAnalysis(attackPaths, toxicCombinations, anomalies, scanFindings, cloudTrail, escalations, chains, data, ueba, network);

        return {
            type: "AI_THREAT_ANALYSIS",
            executive_summary: executiveSummary,
            technical_analysis: technicalAnalysis,
            timestamp: new Date().toISOString()
        };
    }

    _generateExecutiveSummary(attackPaths, toxicCombinations, anomalies, scanFindings, cloudTrail, escalations, chains, data, ueba, network) {
        let impact = 'Low';
        let explanation = 'No significant threats detected in the current infrastructure.';

        const totalCriticals = attackPaths.length + toxicCombinations.length + escalations.length + chains.length + network.length;
        const totalAnomalies = anomalies.length + cloudTrail.length + ueba.length;

        if (totalCriticals > 0) {
            impact = 'Critical';
            explanation = `Detected ${totalCriticals} critical vulnerability combinations (including Attack Paths, Privilege Escalations, and Exploit Chains) that could allow direct compromise of business assets. Immediate remediation of the root causes is strongly recommended to reduce blast radius.`;
        } else if (totalAnomalies > 0 || data.length > 0 || scanFindings.length > 0) {
            impact = 'Medium';
            explanation = `Detected ${totalAnomalies} suspicious behavioral anomalies and ${data.length} instances of potential data exposure. While no complete network exploit chains were mapped, these indicators mandate investigation against established baselines.`;
        }

        return {
            business_explanation: explanation,
            impact_description: `Business Risk Level: ${impact}. ${totalCriticals > 0 ? 'High probability of unauthorized system control.' : 'Potential exposure of sensitive information or unauthorized recon.'}`
        };
    }

    _generateTechnicalAnalysis(attackPaths, toxicCombinations, anomalies, scanFindings, cloudTrail, escalations, chains, data, ueba, network) {
        const attackChainExplanation = (attackPaths.length > 0 || chains.length > 0 || network.length > 0 || escalations.length > 0)
            ? `Attackers could string together network misconfigurations and IAM overprivilege to traverse the environment. Example Vector: ${chains[0]?.description || attackPaths[0]?.description || escalations[0]?.description || network[0]?.description || 'Multi-step lateral movement detected.'}`
            : 'No complete cross-boundary attack chains discovered.';

        const exploitedVulnerabilities = [];
        
        toxicCombinations.forEach(tc => exploitedVulnerabilities.push(`Toxic Combo: ${tc.description || tc.name}`));
        chains.forEach(c => exploitedVulnerabilities.push(`Exploit Chain: ${c.description || c.name}`));
        escalations.forEach(e => exploitedVulnerabilities.push(`Privilege Flow: ${e.description || e.vector}`));
        data.forEach(d => exploitedVulnerabilities.push(`Exposure: ${d.evidence}`));
        cloudTrail.forEach(c => exploitedVulnerabilities.push(`Behavior: ${c.description}`));
        ueba.forEach(u => exploitedVulnerabilities.push(`Anomaly: ${u.description}`));
        network.forEach(n => exploitedVulnerabilities.push(`Routing Risk: ${n.description || n.name}`));

        // Add critical/high scan findings
        scanFindings.forEach(f => {
            if (f.severity === 'CRITICAL' || f.severity === 'HIGH') {
                exploitedVulnerabilities.push(`${f.severity} Finding: ${f.type || f.description || 'Misconfiguration'}`);
            }
        });

        let priority = 'Low';
        const totalCriticals = attackPaths.length + toxicCombinations.length + escalations.length + chains.length + network.length;

        if (totalCriticals > 0) priority = 'Critical - Sever attack chains and remove escalated shadow admins immediately';
        else if (data.length > 0) priority = 'High - Rotate exposed credentials and encrypt PII targets';
        else if (cloudTrail.length > 0 || ueba.length > 0 || anomalies.length > 0 || exploitedVulnerabilities.length > 0) priority = 'Medium - Investigate UEBA deviations and harden core misconfigurations';

        // Deduplicate and limit vulnerabilities
        const uniqueVulns = [...new Set(exploitedVulnerabilities)].slice(0, 15);

        return {
            attack_chain_explanation: attackChainExplanation,
            exploited_vulnerabilities: uniqueVulns,
            recommended_remediation_priority: priority
        };
    }
}

module.exports = new ThreatReasoningEngine();
