/**
 * Impact Analyzer
 * 
 * Pre-flight analysis that explains what each remediation action will do,
 * what could break, and rates the risk of change.
 * 
 * Provides human-readable impact statements for the UI.
 */

class ImpactAnalyzer {

    /**
     * Analyze the impact of a remediation plan.
     * @param {Object} plan - The remediation plan with steps
     * @param {Object} rawConfig - Raw resource config from scanner
     * @param {string} resourceType - 'S3' | 'EC2' | 'IAM'
     * @returns {{ steps: Array<ImpactStep>, overall_risk, summary }}
     */
    analyze(plan, rawConfig, resourceType) {
        const analyzedSteps = [];

        for (const step of (plan.steps || [])) {
            const impact = this._analyzeStep(step, rawConfig, resourceType);
            analyzedSteps.push(impact);
        }

        const overallRisk = this._computeOverallRisk(analyzedSteps);

        return {
            plan_id: plan.plan_id,
            steps: analyzedSteps,
            overall_risk: overallRisk,
            summary: this._buildSummary(analyzedSteps, overallRisk),
            warnings: analyzedSteps.filter(s => s.risk_level === 'HIGH' || s.risk_level === 'CRITICAL')
                .map(s => s.warning)
        };
    }

    _analyzeStep(step, rawConfig, resourceType) {
        const action = step.action;
        const analysis = this._getActionImpact(action, rawConfig, resourceType);

        return {
            action,
            description: step.description,
            ...analysis,
            decision: step.decision || null
        };
    }

    _getActionImpact(action, rawConfig, resourceType) {
        const impacts = {
            // ─── S3 Actions ──────────────────────────────────────
            PUT_PUBLIC_ACCESS_BLOCK: {
                what_it_does: 'Enables all four S3 Block Public Access settings on this bucket.',
                what_could_break: 'If this bucket serves public content (website, CDN, static assets), they will become inaccessible.',
                risk_level: this._hasPublicContent(rawConfig) ? 'HIGH' : 'LOW',
                reversible: true,
                rollback_method: 'Disable Block Public Access settings via AWS Console or API.',
                estimated_downtime: this._hasPublicContent(rawConfig) ? '< 1 minute (public content will be blocked immediately)' : 'None',
                warning: this._hasPublicContent(rawConfig)
                    ? '⚠️ This bucket may serve public content. Blocking public access will make it inaccessible.'
                    : null
            },
            REMOVE_PUBLIC_ACLS: {
                what_it_does: 'Sets the bucket ACL to "private", removing all public grants.',
                what_could_break: 'Applications or users relying on public ACL-based access will lose access.',
                risk_level: 'MEDIUM',
                reversible: true,
                rollback_method: 'Re-apply the original ACL grants via AWS Console.',
                estimated_downtime: 'Immediate effect on public access',
                warning: null
            },
            SANITIZE_BUCKET_POLICY: {
                what_it_does: 'Removes bucket policy statements that allow access to Principal "*" (everyone).',
                what_could_break: `Bucket has ${(rawConfig?.policy?.Statement || []).length} policy statement(s). Legitimate cross-account or service access using wildcard conditions may be removed.`,
                risk_level: (rawConfig?.policy?.Statement || []).length > 2 ? 'HIGH' : 'MEDIUM',
                reversible: true,
                rollback_method: 'Restore the original bucket policy from the snapshot.',
                estimated_downtime: 'Immediate — affected services will lose access',
                warning: (rawConfig?.policy?.Statement || []).length > 2
                    ? '⚠️ Complex bucket policy with multiple statements. Review before applying.'
                    : null
            },
            ENABLE_ENCRYPTION: {
                what_it_does: 'Enables SSE-S3 (AES-256) default encryption. New objects will be encrypted automatically.',
                what_could_break: 'Nothing. Encryption is transparent to applications. Existing unencrypted objects are not affected.',
                risk_level: 'NONE',
                reversible: true,
                rollback_method: 'Disable default encryption (not recommended).',
                estimated_downtime: 'None',
                warning: null
            },
            ENABLE_VERSIONING: {
                what_it_does: 'Enables bucket versioning. All object changes will be version-tracked.',
                what_could_break: 'Nothing. Versioning only adds protection. Note: storage costs may increase slightly.',
                risk_level: 'NONE',
                reversible: false,
                rollback_method: 'Versioning can be suspended but not disabled once enabled.',
                estimated_downtime: 'None',
                warning: null
            },
            ENABLE_LOGGING: {
                what_it_does: 'Enables S3 server access logging to record all requests.',
                what_could_break: 'Nothing. Logging is passive. Requires log delivery write permissions on the target bucket.',
                risk_level: 'NONE',
                reversible: true,
                rollback_method: 'Disable bucket logging.',
                estimated_downtime: 'None',
                warning: null
            },

            // ─── EC2 Actions ─────────────────────────────────────
            RESTRICT_SSH: {
                what_it_does: 'Removes inbound SSH (port 22) rules that allow access from 0.0.0.0/0 (the entire internet).',
                what_could_break: 'You will lose SSH access from your current IP. You must re-add your specific IP after the fix.',
                risk_level: 'HIGH',
                reversible: true,
                rollback_method: 'Re-add the SSH ingress rule with your trusted IP or restore from snapshot.',
                estimated_downtime: 'Immediate — SSH access blocked until you add a specific IP rule',
                warning: '⚠️ You will lose SSH access. Have an alternative access method ready (e.g., AWS SSM Session Manager).'
            },
            RESTRICT_SECURITY_GROUPS: {
                what_it_does: 'Removes inbound rules allowing dangerous ports (RDP, databases, all-traffic) from 0.0.0.0/0.',
                what_could_break: 'External services connecting to databases or RDP will be blocked.',
                risk_level: 'HIGH',
                reversible: true,
                rollback_method: 'Restore security group rules from the snapshot.',
                estimated_downtime: 'Immediate for affected ports',
                warning: '⚠️ Network access will be restricted. Verify no external services depend on these ports.'
            },
            ENFORCE_IMDSV2: {
                what_it_does: 'Sets instance metadata to require IMDSv2 tokens (blocks IMDSv1 unauthenticated access).',
                what_could_break: 'Applications using IMDSv1 SDK calls will need updating. AWS SDK v2+ supports IMDSv2 automatically.',
                risk_level: 'LOW',
                reversible: true,
                rollback_method: 'Set HttpTokens back to "optional" to re-allow IMDSv1.',
                estimated_downtime: 'None (unless app uses old AWS SDK)',
                warning: null
            },
            ENABLE_MONITORING: {
                what_it_does: 'Enables detailed CloudWatch monitoring (1-minute granularity instead of 5-minute).',
                what_could_break: 'Nothing. Monitoring is passive. Slight cost increase (~$3.50/month per instance).',
                risk_level: 'NONE',
                reversible: true,
                rollback_method: 'Disable detailed monitoring to return to basic monitoring.',
                estimated_downtime: 'None',
                warning: null
            },
            ENCRYPT_EBS_VOLUMES: {
                what_it_does: 'Encrypts unencrypted EBS volumes by creating encrypted snapshots and replacing volumes.',
                what_could_break: 'Requires instance stop/start. Data loss possible if done incorrectly.',
                risk_level: 'CRITICAL',
                reversible: false,
                rollback_method: 'Original unencrypted snapshots can be used to recreate unencrypted volumes.',
                estimated_downtime: '10-30 minutes (instance must be stopped)',
                warning: '⚠️ CRITICAL: Requires instance downtime. Must be performed manually. Back up data first.'
            }
        };

        return impacts[action] || {
            what_it_does: `Applies action: ${action}`,
            what_could_break: 'Unknown — manual review recommended.',
            risk_level: 'MEDIUM',
            reversible: false,
            rollback_method: 'Manual restoration required.',
            estimated_downtime: 'Unknown',
            warning: 'Unknown action — review before applying.'
        };
    }

    _hasPublicContent(rawConfig) {
        if (!rawConfig) return false;
        const name = rawConfig.bucket || '';
        return /website|static|public|cdn|media|assets/i.test(name);
    }

    _computeOverallRisk(steps) {
        const levels = { NONE: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
        const max = Math.max(...steps.map(s => levels[s.risk_level] || 2));
        const labels = ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
        return labels[max] || 'MEDIUM';
    }

    _buildSummary(steps, overallRisk) {
        const safe = steps.filter(s => s.risk_level === 'NONE' || s.risk_level === 'LOW').length;
        const risky = steps.filter(s => s.risk_level === 'HIGH' || s.risk_level === 'CRITICAL').length;
        const reversible = steps.filter(s => s.reversible).length;

        let summary = `This plan has ${steps.length} step(s). `;
        if (safe > 0) summary += `${safe} are safe with no risk. `;
        if (risky > 0) summary += `${risky} are high-risk and may impact services. `;
        summary += `${reversible} of ${steps.length} actions are reversible.`;

        return summary;
    }
}

module.exports = new ImpactAnalyzer();
