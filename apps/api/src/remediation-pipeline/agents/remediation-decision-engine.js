/**
 * Remediation Decision Engine
 * 
 * Context-aware classifier that determines how each finding should be handled:
 * - AUTO_FIX:          Safe to remediate automatically
 * - SUGGEST_FIX:       Needs human review — could break things
 * - INTENTIONAL_SKIP:  Detected as intentional configuration — don't touch
 * 
 * Analyzes: resource tags, naming patterns, finding severity, fix risk,
 * whether the resource is production, and whether the config appears intentional.
 */

// Actions that are always safe (additive, non-breaking)
const SAFE_ACTIONS = new Set([
    'ENABLE_ENCRYPTION', 'ENABLE_VERSIONING', 'ENABLE_LOGGING',
    'ENABLE_MONITORING', 'ENFORCE_IMDSV2'
]);

// Actions that can break applications if applied blindly
const RISKY_ACTIONS = new Set([
    'PUT_PUBLIC_ACCESS_BLOCK', 'REMOVE_PUBLIC_ACLS', 'SANITIZE_BUCKET_POLICY',
    'RESTRICT_SSH', 'RESTRICT_SECURITY_GROUPS', 'ENCRYPT_EBS_VOLUMES'
]);

// Patterns in bucket names or tags that suggest intentional public access
const INTENTIONAL_PUBLIC_PATTERNS = [
    /website/i, /static/i, /public/i, /cdn/i, /media/i,
    /assets/i, /web-hosting/i, /landing/i, /www/i, /frontend/i
];

// Patterns suggesting the resource is production
const PRODUCTION_PATTERNS = [
    /prod/i, /production/i, /live/i, /main/i, /release/i
];

// EC2 tags/names suggesting intentional open ports
const WEB_SERVER_PATTERNS = [
    /web/i, /nginx/i, /apache/i, /httpd/i, /lb/i, /loadbalancer/i,
    /proxy/i, /gateway/i, /api-gateway/i, /frontend/i, /app-server/i
];

class RemediationDecisionEngine {

    /**
     * Classify a finding into AUTO_FIX, SUGGEST_FIX, or INTENTIONAL_SKIP.
     * 
     * @param {Object} params
     * @param {Object} params.finding - The security finding from the rule engine
     * @param {Object} params.rawConfig - Raw resource config from scanner
     * @param {string} params.action - The proposed remediation action
     * @param {string} params.resourceType - 'S3' | 'EC2' | 'IAM'
     * @returns {{ decision, reasoning, confidence, risk_of_change, details }}
     */
    classify({ finding, rawConfig, action, resourceType }) {
        const context = this._buildContext(rawConfig, resourceType);

        // Stage 1: Check if this is an intentional configuration
        const intentionalCheck = this._checkIntentional(finding, rawConfig, action, resourceType, context);
        if (intentionalCheck) return intentionalCheck;

        // Stage 2: Check if the action is safe (additive, non-breaking)
        if (SAFE_ACTIONS.has(action)) {
            return this._buildDecision('AUTO_FIX', action, finding,
                `"${action}" is an additive change that cannot break existing functionality.`,
                1.0, 'NONE', context
            );
        }

        // Stage 3: Check if the action is risky for production resources
        if (context.is_production && RISKY_ACTIONS.has(action)) {
            return this._buildDecision('SUGGEST_FIX', action, finding,
                `Resource appears to be production (${context.production_signal}). "${action}" could disrupt live services.`,
                0.9, 'HIGH', context
            );
        }

        // Stage 4: Check if the action is risky and the finding has moderate confidence
        if (RISKY_ACTIONS.has(action) && (finding.confidence || 1.0) < 0.85) {
            return this._buildDecision('SUGGEST_FIX', action, finding,
                `Finding confidence is ${finding.confidence} (below 0.85 threshold). Manual review recommended before applying "${action}".`,
                0.85, 'MEDIUM', context
            );
        }

        // Stage 5: Resource-specific classification
        const specificDecision = this._classifyByResourceType(finding, rawConfig, action, resourceType, context);
        if (specificDecision) return specificDecision;

        // Stage 6: Default — CRITICAL/HIGH findings get auto-fixed, MEDIUM/LOW get suggested
        if (finding.severity === 'CRITICAL' || finding.severity === 'HIGH') {
            return this._buildDecision('AUTO_FIX', action, finding,
                `${finding.severity} severity finding with no detected intentional configuration. Safe to auto-fix.`,
                0.9, 'LOW', context
            );
        }

        return this._buildDecision('SUGGEST_FIX', action, finding,
            `${finding.severity} severity finding. Review recommended before applying fix.`,
            0.8, 'LOW', context
        );
    }

    /**
     * Classify all findings for a resource at once.
     * Returns an array of classified steps.
     */
    classifyAll(findings, rawConfig, actions, resourceType) {
        return findings.map((finding, i) => {
            const action = actions[i] || 'UNKNOWN';
            return this.classify({ finding, rawConfig, action, resourceType });
        });
    }

    // ─── Intentional Configuration Detection ────────────────────────

    _checkIntentional(finding, rawConfig, action, resourceType, context) {
        // S3: Public bucket that looks like a website
        if (resourceType === 'S3' && this._isIntentionalPublicBucket(rawConfig, finding, action)) {
            return this._buildDecision('INTENTIONAL_SKIP', action, finding,
                `Bucket name "${rawConfig.bucket}" matches website/static hosting patterns. Public access appears intentional.`,
                0.95, 'NONE', context
            );
        }

        // EC2: Open port 80/443 on a web server
        if (resourceType === 'EC2' && this._isIntentionalWebServer(rawConfig, finding, action)) {
            return this._buildDecision('INTENTIONAL_SKIP', action, finding,
                `Instance tags/name suggest this is a web server. Open HTTP/HTTPS ports are expected.`,
                0.9, 'NONE', context
            );
        }

        // IAM: Application role with required admin access
        if (resourceType === 'IAM' && this._isIntentionalIAMConfig(rawConfig, finding)) {
            return this._buildDecision('INTENTIONAL_SKIP', action, finding,
                `IAM user "${rawConfig.username}" appears to be a service account or has tags indicating required access level.`,
                0.8, 'NONE', context
            );
        }

        return null;
    }

    _isIntentionalPublicBucket(rawConfig, finding, action) {
        const bucketName = rawConfig.bucket || '';
        const isPublicFinding = ['S3-001', 'S3-002', 'S3-004'].includes(finding.rule_id);
        const isPublicAction = ['PUT_PUBLIC_ACCESS_BLOCK', 'REMOVE_PUBLIC_ACLS', 'SANITIZE_BUCKET_POLICY'].includes(action);

        if (!isPublicFinding && !isPublicAction) return false;

        // Check bucket name for website/static patterns
        if (INTENTIONAL_PUBLIC_PATTERNS.some(p => p.test(bucketName))) return true;

        // Check tags for Purpose: website or similar
        const tags = rawConfig.tags || [];
        const purposeTag = tags.find(t => t.Key === 'Purpose' || t.Key === 'purpose');
        if (purposeTag && /website|static|public|cdn|hosting/i.test(purposeTag.Value)) return true;

        return false;
    }

    _isIntentionalWebServer(rawConfig, finding, action) {
        // Only applies to network-restriction findings
        if (!['EC2-002', 'EC2-003', 'EC2-004', 'EC2-005'].includes(finding.rule_id)) return false;
        if (!['RESTRICT_SSH', 'RESTRICT_SECURITY_GROUPS'].includes(action)) return false;

        const instanceName = rawConfig.instance_name || '';
        const tags = rawConfig.tags || [];
        const nameTag = tags.find(t => t.Key === 'Name')?.Value || '';

        // Check if the instance is tagged as a web server
        if (WEB_SERVER_PATTERNS.some(p => p.test(instanceName) || p.test(nameTag))) {
            // Web servers intentionally have 80/443 open — but SSH should still be restricted
            if (finding.rule_id === 'EC2-002') return false; // SSH should never be intentionally open to 0.0.0.0/0
            return true;
        }

        // Check for ELB/ALB-style security groups
        for (const sg of (rawConfig.security_groups || [])) {
            const sgName = (sg.group_name || '').toLowerCase();
            if (sgName.includes('elb') || sgName.includes('alb') || sgName.includes('load-balancer')) {
                if (finding.rule_id === 'EC2-002') return false; // SSH never intentional
                return true;
            }
        }

        return false;
    }

    _isIntentionalIAMConfig(rawConfig, finding) {
        if (!['IAM-001', 'IAM-009'].includes(finding.rule_id)) return false;

        const username = rawConfig.username || '';
        // Service accounts often have patterns like "svc-*", "app-*", "ci-*", "deploy-*"
        if (/^(svc|service|app|ci|cd|deploy|automation|pipeline|terraform|cloudformation)/i.test(username)) {
            return true;
        }

        // Check tags
        const tags = rawConfig.tags || [];
        const typeTag = tags.find(t => t.Key === 'Type' || t.Key === 'type');
        if (typeTag && /service|automation|application/i.test(typeTag.Value)) return true;

        return false;
    }

    // ─── Resource-Specific Classification ────────────────────────────

    _classifyByResourceType(finding, rawConfig, action, resourceType, context) {
        if (resourceType === 'S3') return this._classifyS3(finding, rawConfig, action, context);
        if (resourceType === 'EC2') return this._classifyEC2(finding, rawConfig, action, context);
        if (resourceType === 'IAM') return this._classifyIAM(finding, rawConfig, action, context);
        return null;
    }

    _classifyS3(finding, rawConfig, action, context) {
        // Blocking public access on a bucket with existing public policy = risky
        if (action === 'SANITIZE_BUCKET_POLICY' && rawConfig.policy) {
            const stmtCount = (rawConfig.policy.Statement || []).length;
            if (stmtCount > 2) {
                return this._buildDecision('SUGGEST_FIX', action, finding,
                    `Bucket has a complex policy with ${stmtCount} statements. Automated sanitization may remove legitimate access. Manual review recommended.`,
                    0.85, 'MEDIUM', context
                );
            }
        }

        return null;
    }

    _classifyEC2(finding, rawConfig, action, context) {
        // Restricting security groups when instance has many SGs = complex
        if (action === 'RESTRICT_SECURITY_GROUPS') {
            const sgCount = (rawConfig.security_groups || []).length;
            if (sgCount > 3) {
                return this._buildDecision('SUGGEST_FIX', action, finding,
                    `Instance has ${sgCount} security groups. Complex SG configuration — manual review recommended to avoid breaking network access.`,
                    0.8, 'HIGH', context
                );
            }
        }

        // EBS encryption always requires manual steps
        if (action === 'ENCRYPT_EBS_VOLUMES') {
            return this._buildDecision('SUGGEST_FIX', action, finding,
                'EBS encryption requires creating snapshots and new encrypted volumes. Cannot be automated without downtime risk.',
                1.0, 'HIGH', context
            );
        }

        return null;
    }

    _classifyIAM(finding, rawConfig, action, context) {
        // Removing admin from an active user could break things
        if (finding.rule_id === 'IAM-001' && rawConfig.access_key_last_used) {
            const daysSince = this._daysSince(rawConfig.access_key_last_used);
            if (daysSince !== null && daysSince < 7) {
                return this._buildDecision('SUGGEST_FIX', action, finding,
                    `Admin user "${rawConfig.username}" was active ${daysSince} day(s) ago. Removing admin access could break running applications.`,
                    0.95, 'CRITICAL', context
                );
            }
        }

        return null;
    }

    // ─── Helpers ─────────────────────────────────────────────────────

    _buildContext(rawConfig, resourceType) {
        const name = rawConfig.bucket || rawConfig.instance_id || rawConfig.username || '';
        const tags = rawConfig.tags || [];
        const nameTag = tags.find(t => t.Key === 'Name')?.Value || '';
        const envTag = tags.find(t => t.Key === 'Environment' || t.Key === 'env')?.Value || '';

        const isProd = PRODUCTION_PATTERNS.some(p =>
            p.test(name) || p.test(nameTag) || p.test(envTag)
        );

        return {
            resource_name: name,
            resource_type: resourceType,
            tags: tags.map(t => `${t.Key}=${t.Value}`),
            is_production: isProd,
            production_signal: isProd
                ? `matched: ${[name, nameTag, envTag].find(s => PRODUCTION_PATTERNS.some(p => p.test(s))) || 'tag'}`
                : null
        };
    }

    _buildDecision(decision, action, finding, reasoning, confidence, riskOfChange, context) {
        return {
            decision,
            action,
            rule_id: finding.rule_id,
            title: finding.title,
            severity: finding.severity,
            reasoning,
            confidence,
            risk_of_change: riskOfChange,
            reversible: SAFE_ACTIONS.has(action) || RISKY_ACTIONS.has(action),
            context: {
                resource: context.resource_name,
                resource_type: context.resource_type,
                is_production: context.is_production,
                tags: context.tags
            },
            ui_display: this._getUIDisplay(decision, action, finding, reasoning)
        };
    }

    _getUIDisplay(decision, action, finding, reasoning) {
        const icons = { AUTO_FIX: '🔧', SUGGEST_FIX: '⚠️', INTENTIONAL_SKIP: '✅' };
        const colors = { AUTO_FIX: 'green', SUGGEST_FIX: 'orange', INTENTIONAL_SKIP: 'blue' };
        const labels = { AUTO_FIX: 'Auto-Fix', SUGGEST_FIX: 'Manual Review', INTENTIONAL_SKIP: 'Intentional' };

        return {
            icon: icons[decision],
            color: colors[decision],
            label: labels[decision],
            badge: decision,
            action_text: decision === 'AUTO_FIX'
                ? `Will automatically apply: ${action}`
                : decision === 'SUGGEST_FIX'
                    ? `Recommended: ${action} (requires approval)`
                    : `Skipped: ${finding.title} — detected as intentional`,
            reasoning_text: reasoning,
            show_approve_button: decision === 'SUGGEST_FIX',
            show_dismiss_button: decision === 'SUGGEST_FIX',
            auto_execute: decision === 'AUTO_FIX'
        };
    }

    _daysSince(dateStr) {
        if (!dateStr) return null;
        return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
    }
}

module.exports = new RemediationDecisionEngine();
