/**
 * Privilege Escalation Detector
 * 
 * Checks IAM configurations for known privilege escalation vectors.
 * These are IAM permissions that allow a low-privilege user to escalate to admin.
 * 
 * Based on research by Rhino Security Labs and Bishop Fox.
 * Reference: https://rhinosecuritylabs.com/aws/aws-privilege-escalation-methods-mitigation/
 */

// Known privilege escalation vectors in AWS IAM
const ESCALATION_VECTORS = [
    {
        id: 'PE-ESC-01',
        name: 'Create New Policy Version',
        dangerous_actions: ['iam:CreatePolicyVersion'],
        description: 'User can create a new version of a managed policy they have access to, potentially granting themselves admin permissions.',
        severity: 'CRITICAL',
        exploit_steps: [
            'Create a new policy version with Action: "*", Resource: "*"',
            'Set the new version as default',
            'Gains full administrative access'
        ]
    },
    {
        id: 'PE-ESC-02',
        name: 'Attach User Policy',
        dangerous_actions: ['iam:AttachUserPolicy'],
        description: 'User can attach any managed policy (including AdministratorAccess) to themselves.',
        severity: 'CRITICAL',
        exploit_steps: [
            'Attach arn:aws:iam::aws:policy/AdministratorAccess to self',
            'Gains full administrative access'
        ]
    },
    {
        id: 'PE-ESC-03',
        name: 'Attach Group Policy',
        dangerous_actions: ['iam:AttachGroupPolicy'],
        description: 'User can attach any managed policy to a group they belong to.',
        severity: 'CRITICAL',
        exploit_steps: [
            'Attach AdministratorAccess to a group the user belongs to',
            'Gains full administrative access via group membership'
        ]
    },
    {
        id: 'PE-ESC-04',
        name: 'Attach Role Policy',
        dangerous_actions: ['iam:AttachRolePolicy'],
        description: 'User can attach any managed policy to a role they can assume.',
        severity: 'HIGH',
        exploit_steps: [
            'Attach AdministratorAccess to a role',
            'Assume the role to gain elevated access'
        ]
    },
    {
        id: 'PE-ESC-05',
        name: 'Put User Policy (Inline)',
        dangerous_actions: ['iam:PutUserPolicy'],
        description: 'User can write an inline policy to themselves with unrestricted permissions.',
        severity: 'CRITICAL',
        exploit_steps: [
            'Put an inline policy on self with Action: "*", Resource: "*"',
            'Gains full administrative access'
        ]
    },
    {
        id: 'PE-ESC-06',
        name: 'Create Access Key for Another User',
        dangerous_actions: ['iam:CreateAccessKey'],
        description: 'User can create access keys for other users, including admins.',
        severity: 'HIGH',
        exploit_steps: [
            'Create access key for an admin user',
            'Use the new access key to authenticate as the admin'
        ]
    },
    {
        id: 'PE-ESC-07',
        name: 'Lambda + PassRole Escalation',
        dangerous_actions: ['iam:PassRole', 'lambda:CreateFunction', 'lambda:InvokeFunction'],
        description: 'User can create a Lambda function with an admin role and invoke it to execute privileged operations.',
        severity: 'CRITICAL',
        exploit_steps: [
            'Create a Lambda function with code that performs admin actions',
            'Assign an admin IAM role to the Lambda via PassRole',
            'Invoke the Lambda to execute admin operations'
        ]
    },
    {
        id: 'PE-ESC-08',
        name: 'EC2 + PassRole Escalation',
        dangerous_actions: ['iam:PassRole', 'ec2:RunInstances'],
        description: 'User can launch an EC2 instance with an admin role and access the role credentials via instance metadata.',
        severity: 'HIGH',
        exploit_steps: [
            'Launch an EC2 instance with an admin IAM role',
            'SSH into the instance',
            'Access admin credentials via IMDS'
        ]
    },
    {
        id: 'PE-ESC-09',
        name: 'Assume Role with Weak Trust',
        dangerous_actions: ['sts:AssumeRole'],
        description: 'User can assume a more powerful role that has a weak or overly broad trust policy.',
        severity: 'HIGH',
        exploit_steps: [
            'Assume a role with broader permissions',
            'Gain access to resources the assumed role permits'
        ]
    },
    {
        id: 'PE-ESC-10',
        name: 'Update Login Profile',
        dangerous_actions: ['iam:UpdateLoginProfile'],
        description: 'User can change the password of other IAM users, including admins.',
        severity: 'HIGH',
        exploit_steps: [
            'Reset the password of an admin user',
            'Log in as the admin via AWS Console'
        ]
    },
    {
        id: 'PE-ESC-11',
        name: 'CloudFormation + PassRole',
        dangerous_actions: ['iam:PassRole', 'cloudformation:CreateStack'],
        description: 'User can create a CloudFormation stack with an admin role, executing arbitrary resource creation.',
        severity: 'HIGH',
        exploit_steps: [
            'Create a CloudFormation template that creates admin resources',
            'Pass an admin role to the stack',
            'Stack creates resources with elevated privileges'
        ]
    },
    {
        id: 'PE-ESC-12',
        name: 'Glue + PassRole Escalation',
        dangerous_actions: ['iam:PassRole', 'glue:CreateDevEndpoint'],
        description: 'User can create a Glue Dev Endpoint with an admin role and SSH into it.',
        severity: 'HIGH',
        exploit_steps: [
            'Create a Glue Dev Endpoint with an admin IAM role',
            'SSH into the endpoint and access admin credentials'
        ]
    }
];

class PrivilegeEscalationDetector {

    /**
     * Check IAM scan results for privilege escalation paths.
     * @param {Array} iamScans - IAM scan results with raw_config
     * @returns {Array} Array of escalation findings
     */
    detect(iamScans = []) {
        console.log('[PrivilegeEscalation] Checking for privilege escalation vectors...');
        const escalationPaths = [];

        for (const scan of iamScans) {
            const rawConfig = this._parse(scan.raw_config);
            if (!rawConfig.username) continue;

            // If user already has admin, escalation is moot (but still note it)
            if (rawConfig.has_admin_access) {
                escalationPaths.push({
                    rule_id: 'PE-001',
                    title: 'User Already Has Full Admin Access',
                    severity: 'CRITICAL',
                    username: rawConfig.username,
                    description: `User "${rawConfig.username}" already has AdministratorAccess — no escalation needed. This is the maximum privilege level.`,
                    vector: 'Direct Admin',
                    exploit_steps: ['User already has full access'],
                    confidence: 1.0,
                    compliance: ['SOC2:CC6.1', 'SOC2:CC6.3', 'CIS:1.16', 'NIST:AC-6(5)', 'PCI:7.1', 'ISO27001:A.9.2.3']
                });
                continue;
            }

            // Check policy names for potential escalation permissions
            // NOTE: Full escalation detection requires parsing the actual policy DOCUMENTS
            // (via GetPolicy + GetPolicyVersion). This implementation checks policy names
            // and attached managed policy ARNs as a heuristic.
            const escalationsFound = this._checkPolicyNames(rawConfig);
            escalationPaths.push(...escalationsFound);
        }

        console.log(`[PrivilegeEscalation] Found ${escalationPaths.length} escalation path(s)`);
        return escalationPaths;
    }

    /**
     * Check policy names and ARNs for patterns indicating escalation risks.
     * This is a heuristic approach — full detection would require policy document parsing.
     */
    _checkPolicyNames(rawConfig) {
        const results = [];
        const username = rawConfig.username;
        const allPolicies = [
            ...(rawConfig.attached_policies || []).map(p => p.policy_name),
            ...(rawConfig.inline_policies || [])
        ];

        const allPolicyStr = allPolicies.join(' ').toLowerCase();

        // Check for IAM-related policies that could enable escalation
        const iamRelatedPatterns = [
            { pattern: /iam.*full/i, vectors: ['PE-ESC-01', 'PE-ESC-02', 'PE-ESC-05', 'PE-ESC-06'] },
            { pattern: /iam.*admin/i, vectors: ['PE-ESC-01', 'PE-ESC-02'] },
            { pattern: /lambda.*full/i, vectors: ['PE-ESC-07'] },
            { pattern: /cloudform.*full/i, vectors: ['PE-ESC-11'] },
            { pattern: /poweruser/i, vectors: ['PE-ESC-01'] },
        ];

        for (const { pattern, vectors } of iamRelatedPatterns) {
            if (pattern.test(allPolicyStr)) {
                for (const vectorId of vectors) {
                    const vector = ESCALATION_VECTORS.find(v => v.id === vectorId);
                    if (!vector) continue;

                    results.push({
                        rule_id: vectorId,
                        title: `Potential Privilege Escalation: ${vector.name}`,
                        severity: vector.severity,
                        username,
                        description: `User "${username}" has policies suggesting they may have ${vector.dangerous_actions.join(', ')} permissions. ${vector.description}`,
                        vector: vector.name,
                        dangerous_actions: vector.dangerous_actions,
                        exploit_steps: vector.exploit_steps,
                        confidence: 0.7, // Heuristic-based, not policy-document verified
                        note: 'This is a heuristic detection. Full validation requires parsing the actual policy document.',
                        compliance: ['SOC2:CC6.1', 'SOC2:CC6.3', 'CIS:1.16', 'NIST:AC-6(5)', 'PCI:7.1', 'ISO27001:A.9.2.3']
                    });
                }
            }
        }

        return results;
    }

    _parse(raw) {
        if (!raw) return {};
        if (typeof raw === 'string') {
            try { return JSON.parse(raw); } catch { return {}; }
        }
        return raw;
    }

    /**
     * Get all known escalation vectors for reference/documentation.
     */
    getKnownVectors() {
        return ESCALATION_VECTORS;
    }
}

module.exports = new PrivilegeEscalationDetector();
