/**
 * IAM Deterministic Rule Engine
 * 
 * Runs ~10 boolean checks against raw IAM user configuration.
 * Each rule returns a structured finding with rule_id, severity, evidence, and compliance mapping.
 */

class IAMRuleEngine {

    evaluate(config) {
        const findings = [];
        const rules = [
            this._checkAdminAccess,
            this._checkInactiveAdmin,
            this._checkMFA,
            this._checkAccessKeyAge,
            this._checkMultipleAccessKeys,
            this._checkInlineAdminPolicies,
            this._checkNeverUsedAccount,
            this._checkStaleAccessKey,
            this._checkOverlyPermissivePolicies,
        ];

        for (const rule of rules) {
            const result = rule.call(this, config);
            if (result) findings.push(result);
        }

        return {
            resource: config.username,
            resource_type: 'IAM',
            total_rules: rules.length,
            passed: rules.length - findings.length,
            failed: findings.length,
            findings
        };
    }

    // ─── Helpers ──────────────────────────────────────────────────────

    _daysSince(dateStr) {
        if (!dateStr) return null;
        const d = new Date(dateStr);
        return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
    }

    _getLastActiveDate(config) {
        const pwdDate = config.password_last_used ? new Date(config.password_last_used) : null;
        const keyDate = config.access_key_last_used ? new Date(config.access_key_last_used) : null;

        if (pwdDate && keyDate) return pwdDate > keyDate ? pwdDate : keyDate;
        return pwdDate || keyDate || null;
    }

    // ─── Rule Definitions ────────────────────────────────────────────

    _checkAdminAccess(config) {
        if (!config.has_admin_access) return null;

        return {
            rule_id: 'IAM-001',
            title: 'User Has AdministratorAccess Policy',
            severity: 'HIGH',
            confidence: 1.0,
            passed: false,
            description: `User "${config.username}" has the AdministratorAccess managed policy attached, granting unrestricted access to all AWS services.`,
            evidence: {
                source: 'ListAttachedUserPoliciesCommand',
                admin_policy: config.attached_policies.find(p => p.policy_name === 'AdministratorAccess'),
                total_policies: config.attached_policies.length
            },
            remediation: 'Replace AdministratorAccess with specific, bounded IAM policies following least-privilege principle.',
            remediation_mode: 'MANUAL_REVIEW',
            remediation_reason: 'Detaching AdministratorAccess can unexpectedly break critical pipelines.',
            auto_fix_available: false,
            compliance: ['SOC2:CC6.1', 'SOC2:CC6.3', 'CIS:1.16', 'NIST:AC-6', 'PCI:7.1', 'HIPAA:164.312(a)(1)', 'ISO27001:A.9.2.3']
        };
    }

    _checkInactiveAdmin(config) {
        if (!config.has_admin_access) return null;

        const lastActive = this._getLastActiveDate(config);
        const inactiveDays = lastActive
            ? Math.floor((Date.now() - lastActive.getTime()) / (1000 * 60 * 60 * 24))
            : 999;

        if (inactiveDays <= 90) return null;

        return {
            rule_id: 'IAM-002',
            title: 'Inactive Admin User (>90 Days)',
            severity: 'CRITICAL',
            confidence: 1.0,
            passed: false,
            description: `Admin user "${config.username}" has been inactive for ${inactiveDays === 999 ? 'unknown/never-used' : inactiveDays + ' days'}. Dormant admin accounts are high-value targets for credential theft.`,
            evidence: {
                source: 'ListUsers / GetAccessKeyLastUsed',
                inactive_days: inactiveDays,
                password_last_used: config.password_last_used || 'Never',
                access_key_last_used: config.access_key_last_used || 'Never',
                has_admin: true
            },
            remediation: 'Remove AdministratorAccess immediately. Deactivate access keys. If user still needs access, issue bounded time-limited credentials.',
            remediation_mode: 'MANUAL_REVIEW',
            remediation_reason: 'Deactivating admin users requires verifying they are not system accounts.',
            auto_fix_available: false,
            compliance: ['SOC2:CC6.1', 'SOC2:CC6.2', 'CIS:1.3', 'NIST:AC-2', 'PCI:8.1.4', 'HIPAA:164.312(a)(1)', 'ISO27001:A.9.2.6']
        };
    }

    _checkMFA(config) {
        // If we have MFA data from the expanded scanner
        if (config.mfa_enabled === true) return null;
        if (config.mfa_enabled === undefined) {
            // Scanner hasn't collected MFA data yet — skip silently
            return null;
        }

        return {
            rule_id: 'IAM-003',
            title: 'MFA Not Enabled for Console User',
            severity: 'HIGH',
            confidence: 1.0,
            passed: false,
            description: `User "${config.username}" does not have MFA enabled. Console access without MFA is a significant security risk.`,
            evidence: {
                source: 'ListMFADevicesCommand',
                mfa_devices: 0,
                has_password: config.password_last_used !== null
            },
            remediation: 'Enable MFA (virtual or hardware) for this IAM user immediately.',
            remediation_mode: 'ASSISTED_FIX',
            remediation_reason: 'Enforcing MFA requires user coordination.',
            auto_fix_available: false,
            compliance: ['SOC2:CC6.1', 'CIS:1.2', 'NIST:IA-2(1)', 'PCI:8.3', 'HIPAA:164.312(d)', 'ISO27001:A.9.4.2']
        };
    }

    _checkAccessKeyAge(config) {
        if (config.access_key_age_days === undefined || config.access_key_age_days === null) return null;
        if (config.access_key_age_days <= 90) return null;

        return {
            rule_id: 'IAM-004',
            title: 'Access Key Not Rotated (>90 Days)',
            severity: 'MEDIUM',
            confidence: 1.0,
            passed: false,
            description: `User "${config.username}" has an access key that is ${config.access_key_age_days} days old. Keys should be rotated every 90 days.`,
            evidence: {
                source: 'ListAccessKeysCommand',
                access_key_age_days: config.access_key_age_days
            },
            remediation: 'Rotate the access key: create a new key, update all applications, then deactivate and delete the old key.',
            remediation_mode: 'ASSISTED_FIX',
            remediation_reason: 'Rotating keys requires updating the applications using them before deleting the old ones.',
            auto_fix_available: false,
            compliance: ['SOC2:CC6.1', 'CIS:1.4', 'NIST:IA-5', 'PCI:8.2.4', 'ISO27001:A.9.2.4']
        };
    }

    _checkMultipleAccessKeys(config) {
        if (!config.access_keys || config.access_keys.length <= 1) return null;

        const activeKeys = config.access_keys.filter(k => k.Status === 'Active');
        if (activeKeys.length <= 1) return null;

        return {
            rule_id: 'IAM-005',
            title: 'Multiple Active Access Keys',
            severity: 'LOW',
            confidence: 1.0,
            passed: false,
            description: `User "${config.username}" has ${activeKeys.length} active access keys. Best practice is one active key at a time.`,
            evidence: {
                source: 'ListAccessKeysCommand',
                active_key_count: activeKeys.length,
                keys: activeKeys.map(k => ({ id: k.AccessKeyId, status: k.Status }))
            },
            remediation: 'Deactivate and delete the unused access key. Maintain only one active key per user.',
            remediation_mode: 'AUTO_FIX',
            remediation_reason: 'Deactivating a clearly unused second key is safe.',
            auto_fix_available: true,
            compliance: ['CIS:1.13', 'NIST:IA-5']
        };
    }

    _checkInlineAdminPolicies(config) {
        if (!config.inline_policies || config.inline_policies.length === 0) return null;

        const suspiciousInline = config.inline_policies.filter(p =>
            p.toLowerCase().includes('admin') ||
            p.toLowerCase().includes('full') ||
            p.toLowerCase().includes('all')
        );

        if (suspiciousInline.length === 0) return null;

        return {
            rule_id: 'IAM-006',
            title: 'Inline Policy With Potentially Broad Permissions',
            severity: 'MEDIUM',
            confidence: 0.7,
            passed: false,
            description: `User "${config.username}" has inline policies with names suggesting broad permissions: ${suspiciousInline.join(', ')}. Inline policies are harder to audit than managed policies.`,
            evidence: {
                source: 'ListUserPoliciesCommand',
                suspicious_policies: suspiciousInline,
                total_inline_policies: config.inline_policies.length
            },
            remediation: 'Review and replace inline policies with managed policies. Remove any overly permissive inline policies.',
            remediation_mode: 'MANUAL_REVIEW',
            remediation_reason: 'Replacing inline policies requires carefully mapping needed actions.',
            auto_fix_available: false,
            compliance: ['SOC2:CC6.3', 'CIS:1.16', 'NIST:AC-6']
        };
    }

    _checkNeverUsedAccount(config) {
        const lastActive = this._getLastActiveDate(config);
        if (lastActive) return null;

        return {
            rule_id: 'IAM-007',
            title: 'IAM User Has Never Been Used',
            severity: 'MEDIUM',
            confidence: 0.9,
            passed: false,
            description: `User "${config.username}" has never logged in or used access keys. Orphaned accounts increase attack surface.`,
            evidence: {
                source: 'ListUsers / GetAccessKeyLastUsed',
                password_last_used: null,
                access_key_last_used: null
            },
            remediation: 'Confirm if the user account is still needed. If not, delete the IAM user and associated access keys.',
            remediation_mode: 'MANUAL_REVIEW',
            remediation_reason: 'Deleting an unused user should be confirmed first.',
            auto_fix_available: false,
            compliance: ['SOC2:CC6.2', 'CIS:1.3', 'NIST:AC-2', 'PCI:8.1.4', 'ISO27001:A.9.2.6']
        };
    }

    _checkStaleAccessKey(config) {
        if (!config.access_key_last_used) return null;

        const daysSinceKeyUse = this._daysSince(config.access_key_last_used);
        if (daysSinceKeyUse === null || daysSinceKeyUse <= 90) return null;

        // Don't duplicate with IAM-002 (inactive admin)
        if (config.has_admin_access) return null;

        return {
            rule_id: 'IAM-008',
            title: 'Stale Access Key (Unused >90 Days)',
            severity: 'MEDIUM',
            confidence: 1.0,
            passed: false,
            description: `User "${config.username}" has an access key unused for ${daysSinceKeyUse} days. Stale keys should be deactivated.`,
            evidence: {
                source: 'GetAccessKeyLastUsedCommand',
                access_key_last_used: config.access_key_last_used,
                days_since_use: daysSinceKeyUse
            },
            remediation: 'Deactivate and delete the unused access key.',
            remediation_mode: 'AUTO_FIX',
            remediation_reason: 'Deactivating a stale key unused for over 90 days is safe.',
            auto_fix_available: true,
            compliance: ['SOC2:CC6.2', 'CIS:1.4', 'NIST:AC-2', 'PCI:8.1.4']
        };
    }

    _checkOverlyPermissivePolicies(config) {
        if (!config.attached_policies || config.attached_policies.length === 0) return null;
        if (config.has_admin_access) return null; // Already flagged by IAM-001

        const broadPolicies = config.attached_policies.filter(p =>
            p.policy_name.includes('FullAccess') ||
            p.policy_name.includes('PowerUser') ||
            p.policy_arn?.includes('PowerUserAccess')
        );

        if (broadPolicies.length === 0) return null;

        return {
            rule_id: 'IAM-009',
            title: 'Overly Permissive Managed Policy Attached',
            severity: 'MEDIUM',
            confidence: 0.85,
            passed: false,
            description: `User "${config.username}" has broad policies attached: ${broadPolicies.map(p => p.policy_name).join(', ')}. Consider scoping to specific services and actions.`,
            evidence: {
                source: 'ListAttachedUserPoliciesCommand',
                broad_policies: broadPolicies,
                total_policies: config.attached_policies.length
            },
            remediation: 'Replace broad policies (e.g., *FullAccess) with custom policies granting only required permissions.',
            remediation_mode: 'MANUAL_REVIEW',
            remediation_reason: 'Restricting over-permissive policies requires testing.',
            auto_fix_available: false,
            compliance: ['SOC2:CC6.3', 'CIS:1.16', 'NIST:AC-6', 'PCI:7.1.2', 'ISO27001:A.9.2.3']
        };
    }
}

module.exports = new IAMRuleEngine();
