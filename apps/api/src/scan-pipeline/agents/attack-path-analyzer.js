/**
 * Attack Path Analyzer
 * 
 * Takes all scan results, builds an infrastructure graph, and identifies
 * realistic multi-hop attack paths that combine multiple vulnerabilities.
 * 
 * Templates represent known attack patterns observed in real cloud breaches.
 */

const infraGraph = require('./infra-graph');

// ─── Attack Path Templates ──────────────────────────────────────────

const ATTACK_TEMPLATES = [
    {
        id: 'AP-001',
        name: 'Internet → Public EC2 → S3 Data Exfiltration',
        description: 'Attacker gains access via public EC2 instance, then uses the instance IAM role to exfiltrate S3 data.',
        severity: 'CRITICAL',
        conditions: {
            requires_internet_to_ec2: true,
            requires_ec2_to_s3: true
        }
    },
    {
        id: 'AP-002',
        name: 'SSRF via IMDSv1 → Credential Theft → Lateral Movement',
        description: 'Attacker exploits SSRF on public EC2 to steal IAM role credentials via IMDSv1, then accesses other resources.',
        severity: 'CRITICAL',
        conditions: {
            requires_public_ec2: true,
            requires_imdsv1: true,
            requires_iam_role: true
        }
    },
    {
        id: 'AP-003',
        name: 'Inactive Admin Account → Full Account Compromise',
        description: 'Dormant admin IAM user credentials are compromised, granting unrestricted access to the entire account.',
        severity: 'CRITICAL',
        conditions: {
            requires_inactive_admin: true
        }
    },
    {
        id: 'AP-004',
        name: 'Public S3 Bucket → Sensitive Data Exposure',
        description: 'S3 bucket with public access exposes sensitive data (backups, customer data, etc.).',
        severity: 'HIGH',
        conditions: {
            requires_public_s3: true,
            requires_sensitive_bucket: true
        }
    },
    {
        id: 'AP-005',
        name: 'SSH Brute Force → Instance Compromise → Network Pivot',
        description: 'Attacker brute-forces SSH on internet-facing instance and pivots to internal resources.',
        severity: 'HIGH',
        conditions: {
            requires_ssh_open: true,
            requires_public_ip: true
        }
    },
    {
        id: 'AP-006',
        name: 'Admin Without MFA → Credential Phishing → Account Takeover',
        description: 'Admin user without MFA is susceptible to credential phishing, leading to full account compromise.',
        severity: 'CRITICAL',
        conditions: {
            requires_admin_no_mfa: true
        }
    }
];

class AttackPathAnalyzer {

    /**
     * Analyze all scan results for attack paths.
     * @param {Object} params
     * @param {Array} params.s3Scans - S3 scan results from DB
     * @param {Array} params.ec2Scans - EC2 scan results from DB
     * @param {Array} params.iamScans - IAM scan results from DB
     * @returns {{ attack_paths: Array, graph_summary: Object }}
     */
    analyze({ s3Scans = [], ec2Scans = [], iamScans = [] }) {
        console.log('[AttackPathAnalyzer] Building infrastructure graph and analyzing attack paths...');

        // Step 1: Build the infrastructure graph
        infraGraph.buildFromScanResults({ s3Scans, ec2Scans, iamScans });

        // Step 2: Check each attack template
        const attackPaths = [];

        for (const template of ATTACK_TEMPLATES) {
            const matches = this._evaluateTemplate(template, { s3Scans, ec2Scans, iamScans });
            attackPaths.push(...matches);
        }

        // Step 3: Sort by exploitability score (highest first)
        attackPaths.sort((a, b) => b.exploitability_score - a.exploitability_score);

        // Step 4: Calculate blast radius for each path's final node
        for (const path of attackPaths) {
            const lastHop = path.hops[path.hops.length - 1];
            if (lastHop) {
                const blast = infraGraph.getBlastRadius(lastHop.resource);
                path.blast_radius = blast;
            }
        }

        console.log(`[AttackPathAnalyzer] Found ${attackPaths.length} attack path(s)`);

        return {
            attack_paths: attackPaths,
            graph_summary: {
                ...infraGraph.toJSON().stats,
                orphaned_resources: infraGraph.findOrphanedResources().length
            }
        };
    }

    // ─── Template Evaluation ─────────────────────────────────────────

    _evaluateTemplate(template, scans) {
        const results = [];

        switch (template.id) {
            case 'AP-001':
                results.push(...this._checkInternetToEC2ToS3(template, scans));
                break;
            case 'AP-002':
                results.push(...this._checkSSRFIMDSv1(template, scans));
                break;
            case 'AP-003':
                results.push(...this._checkInactiveAdmin(template, scans));
                break;
            case 'AP-004':
                results.push(...this._checkPublicS3(template, scans));
                break;
            case 'AP-005':
                results.push(...this._checkSSHBruteForce(template, scans));
                break;
            case 'AP-006':
                results.push(...this._checkAdminNoMFA(template, scans));
                break;
        }

        return results;
    }

    _checkInternetToEC2ToS3(template, { ec2Scans, s3Scans }) {
        const results = [];

        for (const ec2 of ec2Scans) {
            const ec2Config = this._parse(ec2.raw_config);
            if (!ec2Config.public_ip) continue;

            const hasOpenSG = (ec2.findings || []).some(f => {
                const fStr = typeof f === 'string' ? f.toLowerCase() : (f.title || '').toLowerCase();
                return fStr.includes('ssh') || fStr.includes('rdp') || fStr.includes('0.0.0.0') || fStr.includes('all inbound');
            });
            if (!hasOpenSG) continue;

            // EC2 has public exposure — check if it can reach S3
            if (ec2Config.iam_profile) {
                for (const s3 of s3Scans) {
                    results.push(this._buildPath(template, [
                        { resource: 'Internet', type: 'INTERNET', finding: 'Entry point' },
                        { resource: ec2Config.instance_id, type: 'EC2', finding: 'Public IP + Open SG' },
                        { resource: ec2Config.iam_profile.arn, type: 'IAM_ROLE', finding: 'IAM Role attached' },
                        { resource: s3.bucket || this._parse(s3.raw_config).bucket, type: 'S3', finding: 'Reachable via IAM role' }
                    ], 88));
                }
            }
        }

        return results;
    }

    _checkSSRFIMDSv1(template, { ec2Scans }) {
        const results = [];

        for (const ec2 of ec2Scans) {
            const ec2Config = this._parse(ec2.raw_config);
            if (!ec2Config.public_ip) continue;
            if (ec2Config.imdsv2_required) continue;
            if (!ec2Config.iam_profile) continue;

            results.push(this._buildPath(template, [
                { resource: 'Internet', type: 'INTERNET', finding: 'Entry point' },
                { resource: ec2Config.instance_id, type: 'EC2', finding: 'Public IP + IMDSv1 enabled' },
                { resource: 'IMDS Endpoint', type: 'SERVICE', finding: 'IMDSv1 allows credential theft via SSRF' },
                { resource: ec2Config.iam_profile.arn, type: 'IAM_ROLE', finding: 'Role credentials stolen' }
            ], 92));
        }

        return results;
    }

    _checkInactiveAdmin(template, { iamScans }) {
        const results = [];

        for (const iam of iamScans) {
            const iamConfig = this._parse(iam.raw_config);
            if (!iamConfig.has_admin_access) continue;

            const isInactive = (iam.findings || []).some(f => {
                const fStr = typeof f === 'string' ? f.toLowerCase() : (f.title || '').toLowerCase();
                return fStr.includes('inactive') || fStr.includes('90 days') || fStr.includes('unused');
            });
            if (!isInactive) continue;

            results.push(this._buildPath(template, [
                { resource: iamConfig.username, type: 'IAM_USER', finding: 'Inactive admin account (>90 days)' },
                { resource: 'All AWS Resources', type: 'ACCOUNT', finding: 'AdministratorAccess grants full control' }
            ], 95));
        }

        return results;
    }

    _checkPublicS3(template, { s3Scans }) {
        const results = [];

        for (const s3 of s3Scans) {
            const s3Config = this._parse(s3.raw_config);
            const bucketName = s3Config.bucket || s3.bucket || '';

            const isPublic = (s3.findings || []).some(f => {
                const fStr = typeof f === 'string' ? f.toLowerCase() : (f.title || '').toLowerCase();
                return fStr.includes('public') || fStr.includes('alluser') || fStr.includes('wildcard');
            });
            if (!isPublic) continue;

            const isSensitive = /prod|backup|private|customer|payment|pii|database|secret/i.test(bucketName);
            if (!isSensitive) continue;

            results.push(this._buildPath(template, [
                { resource: 'Internet', type: 'INTERNET', finding: 'Entry point' },
                { resource: bucketName, type: 'S3', finding: `Public access + sensitive data (name: ${bucketName})` }
            ], 85));
        }

        return results;
    }

    _checkSSHBruteForce(template, { ec2Scans }) {
        const results = [];

        for (const ec2 of ec2Scans) {
            const ec2Config = this._parse(ec2.raw_config);
            if (!ec2Config.public_ip) continue;

            const hasSSH = (ec2.findings || []).some(f => {
                const fStr = typeof f === 'string' ? f.toLowerCase() : (f.title || '').toLowerCase();
                return fStr.includes('ssh') || fStr.includes('port 22');
            });
            if (!hasSSH) continue;

            results.push(this._buildPath(template, [
                { resource: 'Internet', type: 'INTERNET', finding: 'Entry point' },
                { resource: ec2Config.instance_id, type: 'EC2', finding: `SSH open on ${ec2Config.public_ip}` },
                { resource: `VPC: ${ec2Config.vpc_id || 'default'}`, type: 'VPC', finding: 'Lateral movement in VPC' }
            ], 75));
        }

        return results;
    }

    _checkAdminNoMFA(template, { iamScans }) {
        const results = [];

        for (const iam of iamScans) {
            const iamConfig = this._parse(iam.raw_config);
            if (!iamConfig.has_admin_access) continue;
            if (iamConfig.mfa_enabled) continue;

            results.push(this._buildPath(template, [
                { resource: 'Phishing / Credential Theft', type: 'ATTACK_VECTOR', finding: 'No MFA protection' },
                { resource: iamConfig.username, type: 'IAM_USER', finding: 'Admin without MFA' },
                { resource: 'All AWS Resources', type: 'ACCOUNT', finding: 'Full account compromise' }
            ], 90));
        }

        return results;
    }

    // ─── Helpers ──────────────────────────────────────────────────────

    _buildPath(template, hops, exploitabilityScore) {
        return {
            path_id: `${template.id}-${Date.now().toString(36)}`,
            template_id: template.id,
            name: template.name,
            description: template.description,
            severity: template.severity,
            exploitability_score: exploitabilityScore,
            hops,
            hop_count: hops.length,
            fix_steps: hops
                .filter(h => h.type !== 'INTERNET' && h.type !== 'ATTACK_VECTOR' && h.type !== 'ACCOUNT' && h.type !== 'SERVICE')
                .map(h => `Fix: ${h.finding} on ${h.resource}`),
            blast_radius: null // Populated after graph analysis
        };
    }

    _parse(raw) {
        if (!raw) return {};
        if (typeof raw === 'string') {
            try { return JSON.parse(raw); } catch { return {}; }
        }
        return raw;
    }
}

module.exports = new AttackPathAnalyzer();
