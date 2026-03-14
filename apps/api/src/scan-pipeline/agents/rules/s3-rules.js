/**
 * S3 Deterministic Rule Engine
 * 
 * Runs ~15 boolean checks against raw S3 bucket configuration.
 * Each rule returns a structured finding with rule_id, severity, evidence, and compliance mapping.
 */

class S3RuleEngine {

    evaluate(config) {
        const findings = [];
        const rules = [
            this._checkPublicAccessBlock,
            this._checkPublicAcl,
            this._checkBucketPolicyWildcard,
            this._checkBucketPolicyHTTP,
            this._checkEncryption,
            this._checkEncryptionAlgorithm,
            this._checkVersioning,
            this._checkAccessLogging,
            this._checkLifecyclePolicy,
            this._checkCorsWildcard,
            this._checkPolicyConditions,
            this._checkAclAuthenticatedUsers,
            this._checkPublicAccessBlockPartial,
        ];

        for (const rule of rules) {
            const result = rule.call(this, config);
            if (result) findings.push(result);
        }

        return {
            resource: config.bucket,
            resource_type: 'S3',
            total_rules: rules.length,
            passed: rules.length - findings.length,
            failed: findings.length,
            findings
        };
    }

    // ─── Rule Definitions ────────────────────────────────────────────

    _checkPublicAccessBlock(config) {
        const pab = config.public_access_block || {};
        const allEnabled = pab.BlockPublicAcls && pab.IgnorePublicAcls &&
            pab.BlockPublicPolicy && pab.RestrictPublicBuckets;

        if (allEnabled) return null;

        const disabledSettings = [];
        if (!pab.BlockPublicAcls) disabledSettings.push('BlockPublicAcls');
        if (!pab.IgnorePublicAcls) disabledSettings.push('IgnorePublicAcls');
        if (!pab.BlockPublicPolicy) disabledSettings.push('BlockPublicPolicy');
        if (!pab.RestrictPublicBuckets) disabledSettings.push('RestrictPublicBuckets');

        return {
            rule_id: 'S3-001',
            title: 'Public Access Block Not Fully Enabled',
            severity: 'HIGH',
            confidence: 1.0,
            passed: false,
            description: `${disabledSettings.length} of 4 Public Access Block settings are disabled: ${disabledSettings.join(', ')}`,
            evidence: {
                source: 'GetPublicAccessBlockCommand',
                values: pab,
                disabled_settings: disabledSettings
            },
            remediation: 'Enable all four Public Access Block settings on this bucket.',
            remediation_mode: 'AUTO_FIX',
            remediation_reason: 'Safe zero-downtime configuration change.',
            auto_fix_available: true,
            compliance: ['SOC2:CC6.1', 'SOC2:CC6.6', 'CIS:2.1.5', 'NIST:PR.AC-3', 'PCI:1.3.6', 'HIPAA:164.312(a)(1)', 'ISO27001:A.9.4.1']
        };
    }

    _checkPublicAcl(config) {
        if (!config.acl || !Array.isArray(config.acl)) return null;

        const publicURI = 'http://acs.amazonaws.com/groups/global/AllUsers';
        const publicGrants = config.acl.filter(
            g => g.Grantee && g.Grantee.URI === publicURI
        );

        if (publicGrants.length === 0) return null;

        return {
            rule_id: 'S3-002',
            title: 'Bucket ACL Grants Public Access (AllUsers)',
            severity: 'CRITICAL',
            confidence: 1.0,
            passed: false,
            description: `Bucket ACL contains ${publicGrants.length} grant(s) to AllUsers, making objects publicly accessible.`,
            evidence: {
                source: 'GetBucketAclCommand',
                public_grants: publicGrants.map(g => ({
                    permission: g.Permission,
                    grantee: g.Grantee.URI
                }))
            },
            remediation: 'Remove all ACL grants to "AllUsers". Set bucket ACL to private.',
            remediation_mode: 'AUTO_FIX',
            remediation_reason: 'Safe automated removal of public grants.',
            auto_fix_available: true,
            compliance: ['SOC2:CC6.1', 'SOC2:CC6.6', 'CIS:2.1.5', 'NIST:PR.AC-3', 'NIST:PR.DS-5', 'PCI:7.1', 'HIPAA:164.312(a)(1)', 'ISO27001:A.9.4.1']
        };
    }

    _checkAclAuthenticatedUsers(config) {
        if (!config.acl || !Array.isArray(config.acl)) return null;

        const authURI = 'http://acs.amazonaws.com/groups/global/AuthenticatedUsers';
        const authGrants = config.acl.filter(
            g => g.Grantee && g.Grantee.URI === authURI
        );

        if (authGrants.length === 0) return null;

        return {
            rule_id: 'S3-003',
            title: 'Bucket ACL Grants Access to AuthenticatedUsers',
            severity: 'HIGH',
            confidence: 1.0,
            passed: false,
            description: 'Bucket ACL grants access to AuthenticatedUsers — any AWS account holder can access this bucket.',
            evidence: {
                source: 'GetBucketAclCommand',
                auth_grants: authGrants.map(g => ({
                    permission: g.Permission,
                    grantee: g.Grantee.URI
                }))
            },
            remediation: 'Remove ACL grants to "AuthenticatedUsers". This group includes every AWS account.',
            remediation_mode: 'AUTO_FIX',
            remediation_reason: 'Safe automated removal of public grants.',
            auto_fix_available: true,
            compliance: ['SOC2:CC6.1', 'CIS:2.1.5', 'NIST:PR.AC-3', 'HIPAA:164.312(a)(1)']
        };
    }

    _checkBucketPolicyWildcard(config) {
        if (!config.policy) return null;

        const policyStr = JSON.stringify(config.policy);
        const statements = config.policy.Statement || [];

        const wildcardStatements = statements.filter(stmt =>
            stmt.Effect === 'Allow' &&
            (stmt.Principal === '*' || (stmt.Principal && stmt.Principal.AWS === '*'))
        );

        if (wildcardStatements.length === 0) return null;

        return {
            rule_id: 'S3-004',
            title: 'Bucket Policy Allows Wildcard Principal',
            severity: 'CRITICAL',
            confidence: 1.0,
            passed: false,
            description: `Bucket policy contains ${wildcardStatements.length} statement(s) allowing access to Principal "*" (everyone).`,
            evidence: {
                source: 'GetBucketPolicyCommand',
                wildcard_statements: wildcardStatements.map(s => ({
                    sid: s.Sid || 'N/A',
                    effect: s.Effect,
                    principal: s.Principal,
                    action: s.Action,
                    resource: s.Resource
                }))
            },
            remediation: 'Restrict bucket policy to specific IAM principals. Remove or condition wildcard Allow statements.',
            remediation_mode: 'MANUAL_REVIEW',
            remediation_reason: 'Modifying bucket policies can break consuming applications.',
            auto_fix_available: false,
            compliance: ['SOC2:CC6.1', 'SOC2:CC6.6', 'CIS:2.1.5', 'NIST:PR.AC-3', 'PCI:7.1', 'HIPAA:164.312(a)(1)', 'ISO27001:A.9.4.1']
        };
    }

    _checkBucketPolicyHTTP(config) {
        if (!config.policy) return null;

        const statements = config.policy.Statement || [];
        const insecureStatements = statements.filter(stmt => {
            const condition = stmt.Condition || {};
            // Check if policy enforces HTTPS — look for aws:SecureTransport condition
            // If no such condition exists on Allow statements, data can travel over HTTP
            return stmt.Effect === 'Allow' && !condition.Bool?.['aws:SecureTransport'];
        });

        // Only flag if there are Allow statements without HTTPS enforcement
        if (insecureStatements.length === 0 || statements.length === 0) return null;

        return {
            rule_id: 'S3-005',
            title: 'Bucket Policy Does Not Enforce HTTPS',
            severity: 'MEDIUM',
            confidence: 0.9,
            passed: false,
            description: 'Bucket policy does not include a Deny statement for non-HTTPS requests (aws:SecureTransport = false).',
            evidence: {
                source: 'GetBucketPolicyCommand',
                statements_without_https: insecureStatements.length,
                total_statements: statements.length
            },
            remediation: 'Add a Deny statement with Condition: {"Bool": {"aws:SecureTransport": "false"}} to enforce HTTPS.',
            remediation_mode: 'MANUAL_REVIEW',
            remediation_reason: 'Enforcing HTTPS may break legacy HTTP clients.',
            auto_fix_available: false,
            compliance: ['SOC2:CC6.7', 'CIS:2.1.1', 'NIST:SC-8', 'PCI:4.1', 'HIPAA:164.312(e)(1)']
        };
    }

    _checkEncryption(config) {
        if (config.encryption && config.encryption !== 'NOT_CONFIGURED') return null;

        return {
            rule_id: 'S3-006',
            title: 'Server-Side Encryption Not Configured',
            severity: 'HIGH',
            confidence: 1.0,
            passed: false,
            description: 'No default server-side encryption is configured on this bucket. Data at rest is not encrypted by default.',
            evidence: {
                source: 'GetBucketEncryptionCommand',
                encryption_status: config.encryption || 'NOT_CONFIGURED'
            },
            remediation: 'Enable default SSE-S3 (AES-256) or SSE-KMS encryption on the bucket.',
            remediation_mode: 'AUTO_FIX',
            remediation_reason: 'Applying default AES-256 encryption is non-disruptive to existing objects.',
            auto_fix_available: true,
            compliance: ['SOC2:CC6.1', 'CIS:2.1.1', 'NIST:SC-28', 'PCI:3.4', 'HIPAA:164.312(a)(2)(iv)', 'ISO27001:A.10.1.1']
        };
    }

    _checkEncryptionAlgorithm(config) {
        if (!config.encryption || config.encryption === 'NOT_CONFIGURED') return null;

        const rules = config.encryption.Rules || [];
        const usesKMS = rules.some(r =>
            r.ApplyServerSideEncryptionByDefault?.SSEAlgorithm === 'aws:kms'
        );

        // If using KMS, that's the best option — no finding
        if (usesKMS) return null;

        const usesAES = rules.some(r =>
            r.ApplyServerSideEncryptionByDefault?.SSEAlgorithm === 'AES256'
        );

        if (usesAES) {
            return {
                rule_id: 'S3-007',
                title: 'Encryption Uses SSE-S3 Instead of SSE-KMS',
                severity: 'LOW',
                confidence: 1.0,
                passed: false,
                description: 'Bucket uses SSE-S3 (AES-256) encryption. Consider upgrading to SSE-KMS for key management and audit logging.',
                evidence: {
                    source: 'GetBucketEncryptionCommand',
                    algorithm: 'AES256',
                    recommended: 'aws:kms'
                },
                remediation: 'Switch to SSE-KMS encryption for better key management, rotation, and CloudTrail audit logging.',
            remediation_mode: 'ASSISTED_FIX',
            remediation_reason: 'Switching to SSE-KMS requires provisioning a KMS key and setting up IAM permissions.',
            auto_fix_available: false,
            compliance: ['NIST:SC-12', 'PCI:3.5']
            };
        }

        return null;
    }

    _checkVersioning(config) {
        // If the scanner collected versioning data
        if (config.versioning && config.versioning.Status === 'Enabled') return null;

        return {
            rule_id: 'S3-008',
            title: 'Bucket Versioning Not Enabled',
            severity: 'MEDIUM',
            confidence: 1.0,
            passed: false,
            description: 'Bucket versioning is not enabled. This prevents recovery from accidental deletions or overwrites.',
            evidence: {
                source: 'GetBucketVersioningCommand',
                versioning_status: config.versioning?.Status || 'Disabled'
            },
            remediation: 'Enable bucket versioning to protect against accidental data loss and enable MFA delete.',
            remediation_mode: 'AUTO_FIX',
            remediation_reason: 'Enabling versioning is a safe, non-destructive operation.',
            auto_fix_available: true,
            compliance: ['SOC2:A1.2', 'CIS:2.1.3', 'NIST:CP-9', 'ISO27001:A.12.3.1']
        };
    }

    _checkAccessLogging(config) {
        if (config.logging && config.logging.LoggingEnabled) return null;

        return {
            rule_id: 'S3-009',
            title: 'Access Logging Not Configured',
            severity: 'MEDIUM',
            confidence: 1.0,
            passed: false,
            description: 'Server access logging is not enabled. Access requests to this bucket are not being recorded.',
            evidence: {
                source: 'GetBucketLoggingCommand',
                logging_status: config.logging ? 'Partial' : 'Not configured'
            },
            remediation: 'Enable S3 server access logging to a dedicated logging bucket for audit compliance.',
            remediation_mode: 'AUTO_FIX',
            remediation_reason: 'Enabling access logging to an isolated bucket is safe.',
            auto_fix_available: true,
            compliance: ['SOC2:CC7.2', 'CIS:2.1.3', 'NIST:AU-2', 'PCI:10.1', 'HIPAA:164.312(b)', 'ISO27001:A.12.4.1']
        };
    }

    _checkLifecyclePolicy(config) {
        if (config.lifecycle && config.lifecycle.Rules && config.lifecycle.Rules.length > 0) return null;

        return {
            rule_id: 'S3-010',
            title: 'No Lifecycle Policy Configured',
            severity: 'LOW',
            confidence: 1.0,
            passed: false,
            description: 'No lifecycle policy is configured. Old objects are never transitioned or expired, increasing storage costs and data exposure window.',
            evidence: {
                source: 'GetBucketLifecycleConfigurationCommand',
                lifecycle_rules: 0
            },
            remediation: 'Create lifecycle rules to transition old objects to cheaper storage classes and expire obsolete data.',
            remediation_mode: 'AUTO_FIX',
            remediation_reason: 'Applying a standard 90-day transition policy is safe.',
            auto_fix_available: true,
            compliance: ['NIST:MP-6', 'ISO27001:A.8.3.2']
        };
    }

    _checkCorsWildcard(config) {
        if (!config.cors || !Array.isArray(config.cors)) return null;

        const wildcardRules = config.cors.filter(rule =>
            (rule.AllowedOrigins || []).includes('*')
        );

        if (wildcardRules.length === 0) return null;

        return {
            rule_id: 'S3-011',
            title: 'CORS Allows Wildcard Origin',
            severity: 'MEDIUM',
            confidence: 1.0,
            passed: false,
            description: 'CORS configuration allows requests from any origin (*). This may expose the bucket to cross-origin data exfiltration.',
            evidence: {
                source: 'GetBucketCorsCommand',
                wildcard_rules: wildcardRules.length,
                total_cors_rules: config.cors.length
            },
            remediation: 'Restrict CORS AllowedOrigins to specific trusted domains instead of wildcard (*).',
            remediation_mode: 'MANUAL_REVIEW',
            remediation_reason: 'Modifying CORS requires understanding the frontend applications leveraging the bucket.',
            auto_fix_available: false,
            compliance: ['SOC2:CC6.6', 'NIST:SC-7', 'ISO27001:A.13.1.1']
        };
    }

    _checkPolicyConditions(config) {
        if (!config.policy) return null;

        const statements = config.policy.Statement || [];
        const allowWithoutCondition = statements.filter(stmt =>
            stmt.Effect === 'Allow' &&
            stmt.Principal !== '*' &&
            (!stmt.Condition || Object.keys(stmt.Condition).length === 0)
        );

        // Only flag if there are cross-account or broad allows without conditions
        if (allowWithoutCondition.length === 0) return null;

        // Check if any of these are cross-account
        const crossAccount = allowWithoutCondition.filter(stmt => {
            const principal = stmt.Principal;
            if (typeof principal === 'string') return false;
            const aws = principal?.AWS;
            if (!aws) return false;
            const arns = Array.isArray(aws) ? aws : [aws];
            return arns.some(arn => arn.includes(':root'));
        });

        if (crossAccount.length === 0) return null;

        return {
            rule_id: 'S3-012',
            title: 'Cross-Account Access Without Conditions',
            severity: 'MEDIUM',
            confidence: 0.85,
            passed: false,
            description: `${crossAccount.length} policy statement(s) grant cross-account access without Condition constraints (e.g., MFA, IP restriction, VPC endpoint).`,
            evidence: {
                source: 'GetBucketPolicyCommand',
                unconditioned_statements: crossAccount.length
            },
            remediation: 'Add Condition keys (e.g., aws:SourceVpce, aws:SourceIp, aws:MultiFactorAuthPresent) to cross-account Allow statements.',
            remediation_mode: 'MANUAL_REVIEW',
            remediation_reason: 'Condition logic requires custom evaluation based on the organization structure.',
            auto_fix_available: false,
            compliance: ['SOC2:CC6.3', 'CIS:1.16', 'NIST:AC-3']
        };
    }

    _checkPublicAccessBlockPartial(config) {
        const pab = config.public_access_block || {};
        const settings = [pab.BlockPublicAcls, pab.IgnorePublicAcls, pab.BlockPublicPolicy, pab.RestrictPublicBuckets];
        const enabledCount = settings.filter(Boolean).length;

        // Only flag if SOME are enabled but not all (partial = inconsistent config)
        // S3-001 already catches "none enabled"; this catches "some but not all"
        if (enabledCount === 0 || enabledCount === 4) return null;

        return {
            rule_id: 'S3-013',
            title: 'Public Access Block Partially Configured',
            severity: 'MEDIUM',
            confidence: 1.0,
            passed: false,
            description: `Only ${enabledCount} of 4 Public Access Block settings are enabled, creating an inconsistent security posture.`,
            evidence: {
                source: 'GetPublicAccessBlockCommand',
                enabled_count: enabledCount,
                settings: {
                    BlockPublicAcls: !!pab.BlockPublicAcls,
                    IgnorePublicAcls: !!pab.IgnorePublicAcls,
                    BlockPublicPolicy: !!pab.BlockPublicPolicy,
                    RestrictPublicBuckets: !!pab.RestrictPublicBuckets
                }
            },
            remediation: 'Enable ALL four Public Access Block settings for consistent protection.',
            remediation_mode: 'AUTO_FIX',
            remediation_reason: 'Applying full Public Access Block is a baseline standard.',
            auto_fix_available: true,
            compliance: ['SOC2:CC6.1', 'CIS:2.1.5']
        };
    }
}

module.exports = new S3RuleEngine();
