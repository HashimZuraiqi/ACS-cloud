/**
 * Secrets Detector
 * 
 * Scans resource configurations for hardcoded secrets, API keys, tokens,
 * and credentials using regex patterns and Shannon entropy analysis.
 */

// Regex patterns for common secret types
const SECRET_PATTERNS = [
    { id: 'SEC-001', name: 'AWS Access Key ID',        regex: /(?:^|[^A-Za-z0-9])(AKIA[0-9A-Z]{16})(?:[^A-Za-z0-9]|$)/g,    severity: 'CRITICAL' },
    { id: 'SEC-002', name: 'AWS Secret Access Key',    regex: /(?:secret[_ ]?(?:access[_ ]?)?key|aws_secret)['":\s=]+([A-Za-z0-9/+=]{40})/gi, severity: 'CRITICAL' },
    { id: 'SEC-003', name: 'Generic API Key',          regex: /(?:api[_ ]?key|apikey|api_secret)['":\s=]+([A-Za-z0-9_\-]{20,64})/gi,            severity: 'HIGH' },
    { id: 'SEC-004', name: 'Private Key Block',        regex: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/g,                                  severity: 'CRITICAL' },
    { id: 'SEC-005', name: 'JWT Token',                regex: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_\-]{10,}/g,             severity: 'HIGH' },
    { id: 'SEC-006', name: 'Password in Config',       regex: /(?:password|passwd|pwd)['":\s=]+([^\s'"]{8,})/gi,                                 severity: 'HIGH' },
    { id: 'SEC-007', name: 'Database Connection String', regex: /(?:mongodb|postgres|mysql|redis):\/\/[^\s'"]+/gi,                               severity: 'HIGH' },
    { id: 'SEC-008', name: 'Bearer Token',             regex: /[Bb]earer\s+[A-Za-z0-9_\-.]{20,}/g,                                              severity: 'MEDIUM' },
    { id: 'SEC-009', name: 'GitHub Token',             regex: /gh[ps]_[A-Za-z0-9]{36,}/g,                                                       severity: 'CRITICAL' },
    { id: 'SEC-010', name: 'Slack Webhook',            regex: /https:\/\/hooks\.slack\.com\/services\/T[A-Za-z0-9]+\/B[A-Za-z0-9]+\/[A-Za-z0-9]+/g, severity: 'HIGH' },
];

class SecretsDetector {

    /**
     * Scan all resource configurations for embedded secrets.
     * @returns {{ secrets: Array, total_found: number, by_severity: Object }}
     */
    scan({ s3Scans = [], ec2Scans = [], iamScans = [], lambdaScans = [], cloudformationScans = [] }) {
        console.log('[SecretsDetector] Scanning configurations for embedded secrets...');
        const secrets = [];

        // Scan S3 configs
        for (const scan of s3Scans) {
            const configStr = this._configToString(scan);
            secrets.push(...this._scanText(configStr, scan.bucket || 'S3 Bucket', 'S3'));
        }

        // Scan EC2 configs (user_data, tags, etc.)
        for (const scan of ec2Scans) {
            const cfg = this._parse(scan.raw_config);
            const configStr = this._configToString(scan);
            secrets.push(...this._scanText(configStr, cfg.instance_id || 'EC2 Instance', 'EC2'));

            // Special check: user_data often contains secrets
            if (cfg.user_data) {
                const decoded = this._decodeBase64(cfg.user_data);
                secrets.push(...this._scanText(decoded, `${cfg.instance_id}:user_data`, 'EC2'));
            }
        }

        // Scan IAM configs
        for (const scan of iamScans) {
            const cfg = this._parse(scan.raw_config);
            const configStr = this._configToString(scan);
            secrets.push(...this._scanText(configStr, cfg.username || 'IAM User', 'IAM'));
        }

        // Scan Lambda configs (environment variables)
        for (const scan of lambdaScans) {
            const cfg = this._parse(scan.raw_config);
            const configStr = this._configToString(scan);
            secrets.push(...this._scanText(configStr, cfg.function_name || 'Lambda Function', 'Lambda'));
            
            if (cfg.environment && cfg.environment.variables) {
                 for (const [key, value] of Object.entries(cfg.environment.variables)) {
                     // Check if environment variable value is a string and potentially a secret
                     if (typeof value === 'string') {
                         secrets.push(...this._scanText(value, `${cfg.function_name || 'Lambda Function'}:env:${key}`, 'Lambda'));
                     }
                 }
            }
        }

        // Scan CloudFormation templates
        for (const scan of cloudformationScans) {
            const cfg = this._parse(scan.raw_config);
            const configStr = this._configToString(scan);
            secrets.push(...this._scanText(configStr, cfg.stack_name || 'CloudFormation Stack', 'CloudFormation'));
        }

        // Deduplicate by value
        const unique = this._deduplicate(secrets);
        unique.sort((a, b) => {
            const sev = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
            return (sev[b.severity] || 0) - (sev[a.severity] || 0);
        });

        const bySeverity = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
        for (const s of unique) bySeverity[s.severity] = (bySeverity[s.severity] || 0) + 1;

        console.log(`[SecretsDetector] Found ${unique.length} secret(s)`);

        return {
            secrets: unique,
            total_found: unique.length,
            by_severity: bySeverity
        };
    }

    /**
     * Scan a text string for secret patterns.
     */
    _scanText(text, resource, service) {
        const found = [];
        if (!text || text.length < 10) return found;

        for (const pattern of SECRET_PATTERNS) {
            const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
            let match;
            while ((match = regex.exec(text)) !== null) {
                const value = match[1] || match[0];
                const masked = this._mask(value);
                found.push({
                    type: "SECRET_DETECTED",
                    resource: service === 'S3' ? `s3://${resource}` : resource,
                    severity: pattern.severity,
                    secret_type: pattern.name.toUpperCase().replace(/\s+/g, '_'),
                    evidence: masked,
                    rule_id: pattern.id,
                    service,
                    location: `Character position ${match.index}`,
                    entropy: this._shannonEntropy(value),
                    description: `Found ${pattern.name} in ${service} resource "${resource}" configuration.`,
                    remediation: `Remove the secret from the configuration. Use AWS Secrets Manager or SSM Parameter Store instead.`
                });
            }
        }

        // Entropy-based detection for high-entropy strings that don't match patterns
        const highEntropyStrings = this._findHighEntropyStrings(text);
        for (const hes of highEntropyStrings) {
            if (!found.some(f => f.evidence === this._mask(hes.value))) {
                found.push({
                    type: "SECRET_DETECTED",
                    resource: service === 'S3' ? `s3://${resource}` : resource,
                    severity: 'MEDIUM',
                    secret_type: 'HIGH_ENTROPY_STRING',
                    evidence: this._mask(hes.value),
                    rule_id: 'SEC-ENT',
                    service,
                    location: hes.context,
                    entropy: hes.entropy,
                    description: `High-entropy string (${hes.entropy.toFixed(2)} bits) found near "${hes.context}" in "${resource}". May be a secret.`,
                    remediation: 'Review this string. If it is a credential, move it to AWS Secrets Manager.'
                });
            }
        }

        return found;
    }

    /**
     * Calculate Shannon entropy of a string.
     * Higher entropy = more random = more likely to be a secret.
     */
    _shannonEntropy(str) {
        if (!str || str.length === 0) return 0;
        const freq = {};
        for (const ch of str) freq[ch] = (freq[ch] || 0) + 1;
        let entropy = 0;
        const len = str.length;
        for (const count of Object.values(freq)) {
            const p = count / len;
            if (p > 0) entropy -= p * Math.log2(p);
        }
        return Math.round(entropy * 100) / 100;
    }

    /**
     * Find high-entropy strings that might be secrets.
     * Looks for key=value patterns where the value has high entropy.
     */
    _findHighEntropyStrings(text) {
        const results = [];
        // Match key=value or key: value patterns
        const kvRegex = /([a-zA-Z_]{3,30})[=:]\s*["']?([A-Za-z0-9/+=_\-]{16,})["']?/g;
        let match;
        while ((match = kvRegex.exec(text)) !== null) {
            const key = match[1].toLowerCase();
            const value = match[2];
            const entropy = this._shannonEntropy(value);

            // Skip known non-secret keys
            if (/^(bucket|region|instance|arn|account|name|type|state|status|version)$/i.test(key)) continue;

            if (entropy > 4.0 && value.length >= 20) {
                results.push({ context: key, value, entropy });
            }
        }
        return results.slice(0, 5); // Limit to 5
    }

    _mask(value) {
        if (!value || value.length < 8) return '****';
        return value.substring(0, 4) + '*'.repeat(Math.min(value.length - 8, 20)) + value.substring(value.length - 4);
    }

    _deduplicate(secrets) {
        const seen = new Set();
        return secrets.filter(s => {
            const key = `${s.rule_id}:${s.evidence}:${s.resource}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    _configToString(scan) {
        const parts = [];
        if (scan.raw_config) parts.push(typeof scan.raw_config === 'string' ? scan.raw_config : JSON.stringify(scan.raw_config));
        if (scan.explanation) parts.push(scan.explanation);
        if (scan.remediation) parts.push(scan.remediation);
        return parts.join('\n');
    }

    _parse(raw) {
        if (!raw) return {};
        if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return {}; } }
        return raw;
    }

    _decodeBase64(str) {
        try { return Buffer.from(str, 'base64').toString('utf8'); } catch { return str; }
    }
}

module.exports = new SecretsDetector();
