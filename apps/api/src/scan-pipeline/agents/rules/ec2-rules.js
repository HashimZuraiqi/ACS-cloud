/**
 * EC2 Deterministic Rule Engine
 * 
 * Runs ~12 boolean checks against raw EC2 instance configuration.
 * Each rule returns a structured finding with rule_id, severity, evidence, and compliance mapping.
 */

class EC2RuleEngine {

    evaluate(config) {
        const findings = [];
        const rules = [
            this._checkPublicIp,
            this._checkSecurityGroupSSH,
            this._checkSecurityGroupRDP,
            this._checkSecurityGroupAllTraffic,
            this._checkSecurityGroupDatabases,
            this._checkIMDSv2,
            this._checkEBSEncryption,
            this._checkIAMProfile,
            this._checkMonitoring,
            this._checkDefaultVPC,
            this._checkUnrestrictedEgress,
            this._checkSecurityGroupIngressPortRange,
        ];

        for (const rule of rules) {
            const result = rule.call(this, config);
            if (result) {
                if (Array.isArray(result)) {
                    findings.push(...result);
                } else {
                    findings.push(result);
                }
            }
        }

        return {
            resource: config.instance_id,
            resource_type: 'EC2',
            total_rules: rules.length,
            passed: rules.length - findings.length,
            failed: findings.length,
            findings
        };
    }

    // ─── Helpers ──────────────────────────────────────────────────────

    _getOpenCidrRules(securityGroups, targetPort) {
        const results = [];
        for (const sg of (securityGroups || [])) {
            for (const rule of (sg.inbound_rules || [])) {
                const hasOpenIPv4 = (rule.ip_ranges || []).includes('0.0.0.0/0');
                const hasOpenIPv6 = (rule.ipv6_ranges || []).includes('::/0');
                if (!hasOpenIPv4 && !hasOpenIPv6) continue;

                if (rule.protocol === '-1') {
                    results.push({ sg_id: sg.group_id, sg_name: sg.group_name, rule, type: 'all_traffic' });
                } else if (targetPort !== undefined &&
                    rule.from_port !== undefined && rule.to_port !== undefined &&
                    rule.from_port <= targetPort && rule.to_port >= targetPort) {
                    results.push({ sg_id: sg.group_id, sg_name: sg.group_name, rule, type: 'specific_port' });
                }
            }
        }
        return results;
    }

    // ─── Rule Definitions ────────────────────────────────────────────

    _checkPublicIp(config) {
        if (!config.public_ip) return null;

        return {
            rule_id: 'EC2-001',
            title: 'Instance Has Public IP Address',
            severity: 'MEDIUM',
            confidence: 1.0,
            passed: false,
            description: `Instance has a public IP (${config.public_ip}), making it directly addressable from the internet.`,
            evidence: {
                source: 'DescribeInstancesCommand',
                public_ip: config.public_ip,
                public_dns: config.public_dns
            },
            remediation: 'Remove the public IP if internet access is not required. Use a NAT Gateway or VPN for outbound access.',
            remediation_mode: 'MANUAL_REVIEW',
            remediation_reason: 'Removing a public IP will immediately disconnect external routes.',
            auto_fix_available: false,
            compliance: ['SOC2:CC6.1', 'CIS:5.1', 'NIST:SC-7', 'PCI:1.3', 'ISO27001:A.13.1.1']
        };
    }

    _checkSecurityGroupSSH(config) {
        const matches = this._getOpenCidrRules(config.security_groups, 22);
        if (matches.length === 0) return null;

        return {
            rule_id: 'EC2-002',
            title: 'SSH (Port 22) Open to the Internet',
            severity: 'CRITICAL',
            confidence: 1.0,
            passed: false,
            description: `SSH is accessible from 0.0.0.0/0 via Security Group(s): ${matches.map(m => m.sg_id).join(', ')}`,
            evidence: {
                source: 'DescribeSecurityGroupsCommand',
                open_rules: matches.map(m => ({
                    security_group: m.sg_id,
                    protocol: m.rule.protocol,
                    port_range: `${m.rule.from_port}-${m.rule.to_port}`,
                    source: '0.0.0.0/0'
                }))
            },
            remediation: 'Restrict SSH access to specific trusted IP addresses. Use AWS Systems Manager Session Manager as an alternative.',
            remediation_mode: 'MANUAL_REVIEW',
            remediation_reason: 'Altering SSH rules can lock out administrators. Use Systems Manager.',
            auto_fix_available: false,
            compliance: ['SOC2:CC6.1', 'SOC2:CC6.6', 'CIS:5.2', 'NIST:AC-17', 'PCI:1.3.4', 'HIPAA:164.312(e)(1)', 'ISO27001:A.9.4.1']
        };
    }

    _checkSecurityGroupRDP(config) {
        const matches = this._getOpenCidrRules(config.security_groups, 3389);
        if (matches.length === 0) return null;

        return {
            rule_id: 'EC2-003',
            title: 'RDP (Port 3389) Open to the Internet',
            severity: 'CRITICAL',
            confidence: 1.0,
            passed: false,
            description: `RDP is accessible from 0.0.0.0/0 via Security Group(s): ${matches.map(m => m.sg_id).join(', ')}`,
            evidence: {
                source: 'DescribeSecurityGroupsCommand',
                open_rules: matches.map(m => ({
                    security_group: m.sg_id,
                    protocol: m.rule.protocol,
                    port_range: `${m.rule.from_port}-${m.rule.to_port}`,
                    source: '0.0.0.0/0'
                }))
            },
            remediation: 'Restrict RDP access to specific trusted IP addresses. Use a VPN or bastion host for remote access.',
            remediation_mode: 'MANUAL_REVIEW',
            remediation_reason: 'Altering RDP rules can lock out administrators.',
            auto_fix_available: false,
            compliance: ['SOC2:CC6.1', 'CIS:5.3', 'NIST:AC-17', 'PCI:1.3.4', 'ISO27001:A.9.4.1']
        };
    }

    _checkSecurityGroupAllTraffic(config) {
        for (const sg of (config.security_groups || [])) {
            for (const rule of (sg.inbound_rules || [])) {
                const hasOpenCidr = (rule.ip_ranges || []).includes('0.0.0.0/0') ||
                    (rule.ipv6_ranges || []).includes('::/0');

                if (hasOpenCidr && rule.protocol === '-1') {
                    return {
                        rule_id: 'EC2-004',
                        title: 'Security Group Allows All Inbound Traffic from Internet',
                        severity: 'CRITICAL',
                        confidence: 1.0,
                        passed: false,
                        description: `Security Group ${sg.group_id} allows ALL protocols and ALL ports from 0.0.0.0/0.`,
                        evidence: {
                            source: 'DescribeSecurityGroupsCommand',
                            security_group: sg.group_id,
                            protocol: '-1 (All)',
                            source_cidr: '0.0.0.0/0'
                        },
                        remediation: 'Remove the all-traffic inbound rule. Specify only the ports and protocols required.',
            remediation_mode: 'MANUAL_REVIEW',
            remediation_reason: 'Removing open rules requires mapping legitimate inbound traffic first.',
            auto_fix_available: false,
            compliance: ['SOC2:CC6.1', 'CIS:5.1', 'NIST:AC-4', 'PCI:1.2.1', 'HIPAA:164.312(e)(1)', 'ISO27001:A.13.1.1']
                    };
                }
            }
        }
        return null;
    }

    _checkSecurityGroupDatabases(config) {
        const dbPorts = [
            { port: 3306, name: 'MySQL/Aurora', severity: 'HIGH' },
            { port: 5432, name: 'PostgreSQL', severity: 'HIGH' },
            { port: 1433, name: 'MSSQL', severity: 'HIGH' },
            { port: 27017, name: 'MongoDB', severity: 'HIGH' },
            { port: 6379, name: 'Redis', severity: 'HIGH' },
            { port: 9200, name: 'Elasticsearch', severity: 'HIGH' },
            { port: 5601, name: 'Kibana', severity: 'MEDIUM' },
            { port: 11211, name: 'Memcached', severity: 'HIGH' },
        ];

        const findings = [];
        for (const db of dbPorts) {
            const matches = this._getOpenCidrRules(config.security_groups, db.port);
            if (matches.length > 0) {
                findings.push({
                    rule_id: 'EC2-005',
                    title: `${db.name} (Port ${db.port}) Open to the Internet`,
                    severity: db.severity,
                    confidence: 1.0,
                    passed: false,
                    description: `${db.name} port ${db.port} is accessible from 0.0.0.0/0 via SG: ${matches.map(m => m.sg_id).join(', ')}`,
                    evidence: {
                        source: 'DescribeSecurityGroupsCommand',
                        database_service: db.name,
                        port: db.port,
                        open_security_groups: matches.map(m => m.sg_id)
                    },
                    remediation: `Restrict ${db.name} access to application servers only. Database ports should never be public.`,
            remediation_mode: 'MANUAL_REVIEW',
            remediation_reason: 'Database connectivity must be carefully mapped to origin subnets.',
            auto_fix_available: false,
            compliance: ['SOC2:CC6.1', 'CIS:5.2', 'NIST:SC-7', 'PCI:1.3.6', 'HIPAA:164.312(e)(1)']
                });
            }
        }
        return findings.length > 0 ? findings : null;
    }

    _checkIMDSv2(config) {
        if (config.imdsv2_required) return null;

        return {
            rule_id: 'EC2-006',
            title: 'IMDSv2 Not Enforced',
            severity: 'HIGH',
            confidence: 1.0,
            passed: false,
            description: 'Instance Metadata Service v2 (IMDSv2) is not enforced. IMDSv1 is vulnerable to SSRF-based credential theft attacks.',
            evidence: {
                source: 'DescribeInstancesCommand',
                http_tokens: config.metadata_options?.HttpTokens || 'optional',
                imdsv2_required: false
            },
            remediation: 'Set HttpTokens to "required" in the instance metadata options to enforce IMDSv2.',
            remediation_mode: 'AUTO_FIX',
            remediation_reason: 'Enforcing IMDSv2 is generally safe for modern applications.',
            auto_fix_available: true,
            compliance: ['SOC2:CC6.1', 'CIS:5.6', 'NIST:AC-3', 'HIPAA:164.312(a)(1)', 'ISO27001:A.9.4.1']
        };
    }

    _checkEBSEncryption(config) {
        if (!config.ebs_volumes || !Array.isArray(config.ebs_volumes)) return null;

        const unencrypted = config.ebs_volumes.filter(v => !v.encrypted);
        if (unencrypted.length === 0) return null;

        return {
            rule_id: 'EC2-007',
            title: 'EBS Volumes Not Encrypted',
            severity: 'HIGH',
            confidence: 1.0,
            passed: false,
            description: `${unencrypted.length} of ${config.ebs_volumes.length} EBS volume(s) are not encrypted: ${unencrypted.map(v => v.volume_id).join(', ')}`,
            evidence: {
                source: 'DescribeVolumesCommand',
                unencrypted_volumes: unencrypted.map(v => ({
                    volume_id: v.volume_id,
                    size_gb: v.size_gb,
                    type: v.volume_type
                })),
                total_volumes: config.ebs_volumes.length
            },
            remediation: 'Enable EBS encryption. For existing volumes: create an encrypted snapshot, then replace the volume.',
            remediation_mode: 'ASSISTED_FIX',
            remediation_reason: 'In-place root volume encryption is not supported; requires snapshot and replace.',
            auto_fix_available: false,
            compliance: ['SOC2:CC6.1', 'CIS:2.2.1', 'NIST:SC-28', 'PCI:3.4', 'HIPAA:164.312(a)(2)(iv)', 'ISO27001:A.10.1.1']
        };
    }

    _checkIAMProfile(config) {
        if (config.iam_profile) return null;

        return {
            rule_id: 'EC2-008',
            title: 'No IAM Instance Profile Attached',
            severity: 'MEDIUM',
            confidence: 1.0,
            passed: false,
            description: 'No IAM Instance Profile is attached. Applications may be using hardcoded credentials instead of IAM roles.',
            evidence: {
                source: 'DescribeInstancesCommand',
                iam_profile: null
            },
            remediation: 'Create and attach an IAM Instance Profile with least-privilege permissions. Remove any hardcoded credentials.',
            remediation_mode: 'MANUAL_REVIEW',
            remediation_reason: 'Creating an IAM profile requires evaluating what permissions the app needs.',
            auto_fix_available: false,
            compliance: ['SOC2:CC6.3', 'CIS:1.18', 'NIST:IA-2', 'ISO27001:A.9.2.3']
        };
    }

    _checkMonitoring(config) {
        if (config.monitoring_enabled) return null;

        return {
            rule_id: 'EC2-009',
            title: 'Detailed Monitoring Not Enabled',
            severity: 'LOW',
            confidence: 1.0,
            passed: false,
            description: 'Detailed CloudWatch monitoring is not enabled. Only basic 5-minute metrics are available.',
            evidence: {
                source: 'DescribeInstancesCommand',
                monitoring_state: 'basic'
            },
            remediation: 'Enable detailed monitoring for 1-minute granularity metrics and better anomaly detection.',
            remediation_mode: 'AUTO_FIX',
            remediation_reason: 'Enabling detailed monitoring is a safe configuration change.',
            auto_fix_available: true,
            compliance: ['SOC2:CC7.2', 'CIS:4.1', 'NIST:SI-4', 'ISO27001:A.12.4.1']
        };
    }

    _checkDefaultVPC(config) {
        // Simple heuristic: default VPCs have known patterns
        // A proper check would use DescribeVpcs with isDefault filter
        if (!config.is_default_vpc) return null;

        return {
            rule_id: 'EC2-010',
            title: 'Instance Running in Default VPC',
            severity: 'MEDIUM',
            confidence: 0.9,
            passed: false,
            description: 'Instance is running in the default VPC. Default VPCs have permissive configurations and should be avoided for production workloads.',
            evidence: {
                source: 'DescribeInstancesCommand',
                vpc_id: config.vpc_id,
                is_default_vpc: true
            },
            remediation: 'Migrate the instance to a custom VPC with properly configured subnets, route tables, and network ACLs.',
            remediation_mode: 'MANUAL_REVIEW',
            remediation_reason: 'Migrating VPCs requires architecture planning and downtime.',
            auto_fix_available: false,
            compliance: ['CIS:5.1', 'NIST:SC-7', 'ISO27001:A.13.1.1']
        };
    }

    _checkUnrestrictedEgress(config) {
        for (const sg of (config.security_groups || [])) {
            for (const rule of (sg.outbound_rules || [])) {
                const hasOpenCidr = (rule.ip_ranges || []).includes('0.0.0.0/0') ||
                    (rule.ipv6_ranges || []).includes('::/0');

                if (hasOpenCidr && rule.protocol === '-1') {
                    return {
                        rule_id: 'EC2-011',
                        title: 'Unrestricted Outbound Traffic Allowed',
                        severity: 'LOW',
                        confidence: 0.8,
                        passed: false,
                        description: `Security Group ${sg.group_id} allows all outbound traffic. This could enable data exfiltration if the instance is compromised.`,
                        evidence: {
                            source: 'DescribeSecurityGroupsCommand',
                            security_group: sg.group_id,
                            outbound_protocol: '-1 (All)',
                            destination: '0.0.0.0/0'
                        },
                        remediation: 'Restrict outbound rules to only required destinations and ports.',
            remediation_mode: 'MANUAL_REVIEW',
            remediation_reason: 'Restricting egress requires strict knowledge of external dependencies.',
            auto_fix_available: false,
            compliance: ['NIST:SC-7', 'PCI:1.3.5']
                    };
                }
            }
        }
        return null;
    }

    _checkSecurityGroupIngressPortRange(config) {
        for (const sg of (config.security_groups || [])) {
            for (const rule of (sg.inbound_rules || [])) {
                if (rule.protocol === '-1') continue; // handled by EC2-004
                const hasOpenCidr = (rule.ip_ranges || []).includes('0.0.0.0/0') ||
                    (rule.ipv6_ranges || []).includes('::/0');
                if (!hasOpenCidr) continue;

                const portRange = (rule.to_port || 0) - (rule.from_port || 0);
                if (portRange > 100) {
                    return {
                        rule_id: 'EC2-012',
                        title: 'Overly Broad Port Range Open to Internet',
                        severity: 'HIGH',
                        confidence: 1.0,
                        passed: false,
                        description: `Security Group ${sg.group_id} allows inbound from 0.0.0.0/0 on port range ${rule.from_port}-${rule.to_port} (${portRange + 1} ports).`,
                        evidence: {
                            source: 'DescribeSecurityGroupsCommand',
                            security_group: sg.group_id,
                            port_range: `${rule.from_port}-${rule.to_port}`,
                            ports_open: portRange + 1
                        },
                        remediation: 'Narrow the port range to only the specific ports required by the application.',
            remediation_mode: 'MANUAL_REVIEW',
            remediation_reason: 'Port ranges must be mapped to application requirements before restricting.',
            auto_fix_available: false,
            compliance: ['SOC2:CC6.1', 'CIS:5.2', 'NIST:AC-4', 'PCI:1.2.1']
                    };
                }
            }
        }
        return null;
    }
}

module.exports = new EC2RuleEngine();
