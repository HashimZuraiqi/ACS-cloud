const riskScorer = require('./risk-scorer.agent');

class IAMComplianceReasoner {
    /**
     * Analyze an IAM user's configuration for "Least Privilege" compliance.
     * Flag HIGH RISK if they have AdministratorAccess AND inactive for > 90 days.
     */
    async analyze(rawConfig) {
        console.log(`[IAMComplianceReasoner] Analyzing user: ${rawConfig.username}`);

        const analysis = {
            compliance_status: "COMPLIANT",
            violations: [],
            reasoning: "",
            remediation_suggestion: ""
        };

        const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
        const now = new Date();

        // Check inactivity
        let lastActiveDate = null;
        if (rawConfig.password_last_used && rawConfig.access_key_last_used) {
            const pwdDate = new Date(rawConfig.password_last_used);
            const keyDate = new Date(rawConfig.access_key_last_used);
            lastActiveDate = pwdDate > keyDate ? pwdDate : keyDate;
        } else if (rawConfig.password_last_used) {
            lastActiveDate = new Date(rawConfig.password_last_used);
        } else if (rawConfig.access_key_last_used) {
            lastActiveDate = new Date(rawConfig.access_key_last_used);
        }

        let inactiveDays = null;
        if (lastActiveDate) {
            inactiveDays = Math.floor((now - lastActiveDate) / (1000 * 60 * 60 * 24));
        } else {
            // If no activity is recorded, assume they've never been active or very inactive.
            // We'll treat this as 999 days for math purposes.
            inactiveDays = 999;
        }

        // Apply rules
        const isAdmin = rawConfig.has_admin_access;

        if (isAdmin && inactiveDays > 90) {
            analysis.compliance_status = "NON_COMPLIANT";
            analysis.violations.push("Admin access heavily unused (Inactive > 90 days)");
            analysis.reasoning = `The user ${rawConfig.username} has AdministratorAccess but hasn't been active in ${inactiveDays === 999 ? 'ever/unrecorded' : inactiveDays + ' days'}. This violates the principle of least privilege and increases blast radius if credentials are leaked.`;
            analysis.remediation_suggestion = "Remove AdministratorAccess policy. Issue specific, bounded permissions if access is still required. Deactivate unused access keys.";

            // Directly format this to score a CRITICAL severity.
            analysis.severity = "CRITICAL";
            analysis.score = 95;
        } else if (isAdmin) {
            analysis.compliance_status = "COMPLIANT";
            analysis.reasoning = `The user ${rawConfig.username} has AdministratorAccess but has been active within the last 90 days (${inactiveDays} days ago). Monitor usage to ensure full admin permissions are genuinely required.`;

            // Even if active, having admin access might be medium risk, but it's compliant against the 90 day rule
            analysis.severity = "MEDIUM";
            analysis.score = 50;
        } else {
            analysis.compliance_status = "COMPLIANT";
            analysis.reasoning = `The user ${rawConfig.username} does not have standing AdministratorAccess and follows basic least privilege boundaries.`;

            analysis.severity = "LOW";
            analysis.score = 10;
        }

        return analysis;
    }
}

module.exports = new IAMComplianceReasoner();
