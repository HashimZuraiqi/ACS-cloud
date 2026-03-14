/**
 * Compliance Framework Mapping
 * 
 * Maps every rule ID to controls in SOC2, CIS AWS, NIST CSF, PCI DSS, HIPAA, and ISO 27001.
 * Also provides utility functions to compute per-framework compliance percentages.
 */

const FRAMEWORK_METADATA = {
    SOC2: { name: 'SOC 2 Type II', version: '2022', total_controls: 17 },
    CIS: { name: 'CIS AWS Foundations Benchmark', version: 'v3.0', total_controls: 36 },
    NIST: { name: 'NIST Cybersecurity Framework', version: '2.0', total_controls: 23 },
    PCI: { name: 'PCI DSS', version: 'v4.0', total_controls: 12 },
    HIPAA: { name: 'HIPAA Security Rule', version: '2023', total_controls: 9 },
    ISO27001: { name: 'ISO 27001:2022', version: '2022', total_controls: 14 },
};

/**
 * Complete rule-to-control mapping.
 * Each key is a rule_id, and the value is an object mapping framework keys to their control IDs.
 */
const RULE_COMPLIANCE_MAP = {
    // ─── S3 Rules ────────────────────────────────────────────────
    'S3-001': { SOC2: ['CC6.1', 'CC6.6'], CIS: ['2.1.5'], NIST: ['PR.AC-3'], PCI: ['1.3.6'], HIPAA: ['164.312(a)(1)'], ISO27001: ['A.9.4.1'] },
    'S3-002': { SOC2: ['CC6.1', 'CC6.6'], CIS: ['2.1.5'], NIST: ['PR.AC-3', 'PR.DS-5'], PCI: ['7.1'], HIPAA: ['164.312(a)(1)'], ISO27001: ['A.9.4.1'] },
    'S3-003': { SOC2: ['CC6.1'], CIS: ['2.1.5'], NIST: ['PR.AC-3'], HIPAA: ['164.312(a)(1)'] },
    'S3-004': { SOC2: ['CC6.1', 'CC6.6'], CIS: ['2.1.5'], NIST: ['PR.AC-3'], PCI: ['7.1'], HIPAA: ['164.312(a)(1)'], ISO27001: ['A.9.4.1'] },
    'S3-005': { SOC2: ['CC6.7'], CIS: ['2.1.1'], NIST: ['SC-8'], PCI: ['4.1'], HIPAA: ['164.312(e)(1)'] },
    'S3-006': { SOC2: ['CC6.1'], CIS: ['2.1.1'], NIST: ['SC-28'], PCI: ['3.4'], HIPAA: ['164.312(a)(2)(iv)'], ISO27001: ['A.10.1.1'] },
    'S3-007': { NIST: ['SC-12'], PCI: ['3.5'] },
    'S3-008': { SOC2: ['A1.2'], CIS: ['2.1.3'], NIST: ['CP-9'], ISO27001: ['A.12.3.1'] },
    'S3-009': { SOC2: ['CC7.2'], CIS: ['2.1.3'], NIST: ['AU-2'], PCI: ['10.1'], HIPAA: ['164.312(b)'], ISO27001: ['A.12.4.1'] },
    'S3-010': { NIST: ['MP-6'], ISO27001: ['A.8.3.2'] },
    'S3-011': { SOC2: ['CC6.6'], NIST: ['SC-7'], ISO27001: ['A.13.1.1'] },
    'S3-012': { SOC2: ['CC6.3'], CIS: ['1.16'], NIST: ['AC-3'] },
    'S3-013': { SOC2: ['CC6.1'], CIS: ['2.1.5'] },

    // ─── EC2 Rules ───────────────────────────────────────────────
    'EC2-001': { SOC2: ['CC6.1'], CIS: ['5.1'], NIST: ['SC-7'], PCI: ['1.3'], ISO27001: ['A.13.1.1'] },
    'EC2-002': { SOC2: ['CC6.1', 'CC6.6'], CIS: ['5.2'], NIST: ['AC-17'], PCI: ['1.3.4'], HIPAA: ['164.312(e)(1)'], ISO27001: ['A.9.4.1'] },
    'EC2-003': { SOC2: ['CC6.1'], CIS: ['5.3'], NIST: ['AC-17'], PCI: ['1.3.4'], ISO27001: ['A.9.4.1'] },
    'EC2-004': { SOC2: ['CC6.1'], CIS: ['5.1'], NIST: ['AC-4'], PCI: ['1.2.1'], HIPAA: ['164.312(e)(1)'], ISO27001: ['A.13.1.1'] },
    'EC2-005': { SOC2: ['CC6.1'], CIS: ['5.2'], NIST: ['SC-7'], PCI: ['1.3.6'], HIPAA: ['164.312(e)(1)'] },
    'EC2-006': { SOC2: ['CC6.1'], CIS: ['5.6'], NIST: ['AC-3'], HIPAA: ['164.312(a)(1)'], ISO27001: ['A.9.4.1'] },
    'EC2-007': { SOC2: ['CC6.1'], CIS: ['2.2.1'], NIST: ['SC-28'], PCI: ['3.4'], HIPAA: ['164.312(a)(2)(iv)'], ISO27001: ['A.10.1.1'] },
    'EC2-008': { SOC2: ['CC6.3'], CIS: ['1.18'], NIST: ['IA-2'], ISO27001: ['A.9.2.3'] },
    'EC2-009': { SOC2: ['CC7.2'], CIS: ['4.1'], NIST: ['SI-4'], ISO27001: ['A.12.4.1'] },
    'EC2-010': { CIS: ['5.1'], NIST: ['SC-7'], ISO27001: ['A.13.1.1'] },
    'EC2-011': { NIST: ['SC-7'], PCI: ['1.3.5'] },
    'EC2-012': { SOC2: ['CC6.1'], CIS: ['5.2'], NIST: ['AC-4'], PCI: ['1.2.1'] },

    // ─── IAM Rules ───────────────────────────────────────────────
    'IAM-001': { SOC2: ['CC6.1', 'CC6.3'], CIS: ['1.16'], NIST: ['AC-6'], PCI: ['7.1'], HIPAA: ['164.312(a)(1)'], ISO27001: ['A.9.2.3'] },
    'IAM-002': { SOC2: ['CC6.1', 'CC6.2'], CIS: ['1.3'], NIST: ['AC-2'], PCI: ['8.1.4'], HIPAA: ['164.312(a)(1)'], ISO27001: ['A.9.2.6'] },
    'IAM-003': { SOC2: ['CC6.1'], CIS: ['1.2'], NIST: ['IA-2(1)'], PCI: ['8.3'], HIPAA: ['164.312(d)'], ISO27001: ['A.9.4.2'] },
    'IAM-004': { SOC2: ['CC6.1'], CIS: ['1.4'], NIST: ['IA-5'], PCI: ['8.2.4'], ISO27001: ['A.9.2.4'] },
    'IAM-005': { CIS: ['1.13'], NIST: ['IA-5'] },
    'IAM-006': { SOC2: ['CC6.3'], CIS: ['1.16'], NIST: ['AC-6'] },
    'IAM-007': { SOC2: ['CC6.2'], CIS: ['1.3'], NIST: ['AC-2'], PCI: ['8.1.4'], ISO27001: ['A.9.2.6'] },
    'IAM-008': { SOC2: ['CC6.2'], CIS: ['1.4'], NIST: ['AC-2'], PCI: ['8.1.4'] },
    'IAM-009': { SOC2: ['CC6.3'], CIS: ['1.16'], NIST: ['AC-6'], PCI: ['7.1.2'], ISO27001: ['A.9.2.3'] },

    // ─── Privilege Escalation Rules ──────────────────────────────
    'PE-001': { SOC2: ['CC6.1', 'CC6.3'], CIS: ['1.16'], NIST: ['AC-6(5)'], PCI: ['7.1'], ISO27001: ['A.9.2.3'] },
};

/**
 * Map an array of findings (from rule engines) to per-framework compliance results.
 * @param {Array} findings - Array of finding objects with `compliance` or `rule_id` fields
 * @returns {{ frameworks: Object, failing_controls: Array, summary: Object }}
 */
function mapFindings(findings) {
    const failedControlsByFramework = {};
    const allFailingControls = [];

    // Initialize frameworks
    for (const [key] of Object.entries(FRAMEWORK_METADATA)) {
        failedControlsByFramework[key] = new Set();
    }

    for (const finding of findings) {
        if (finding.passed) continue;

        // Get compliance mapping from the finding or the master map
        const ruleMap = RULE_COMPLIANCE_MAP[finding.rule_id] || {};

        for (const [framework, controls] of Object.entries(ruleMap)) {
            for (const control of controls) {
                failedControlsByFramework[framework].add(control);
                allFailingControls.push({
                    framework,
                    control,
                    rule_id: finding.rule_id,
                    title: finding.title,
                    severity: finding.severity
                });
            }
        }
    }

    // Calculate per-framework compliance percentage
    const frameworks = {};
    for (const [key, meta] of Object.entries(FRAMEWORK_METADATA)) {
        const failedCount = failedControlsByFramework[key].size;
        const passedCount = meta.total_controls - failedCount;
        const percentage = Math.round((passedCount / meta.total_controls) * 100);

        frameworks[key] = {
            name: meta.name,
            version: meta.version,
            total_controls: meta.total_controls,
            passed_controls: Math.max(0, passedCount),
            failed_controls: failedCount,
            compliance_percentage: Math.max(0, percentage),
            failing_control_ids: Array.from(failedControlsByFramework[key])
        };
    }

    // Deduplicate failing controls by framework+control
    const uniqueFailures = {};
    for (const fc of allFailingControls) {
        const key = `${fc.framework}:${fc.control}`;
        if (!uniqueFailures[key]) {
            uniqueFailures[key] = { ...fc, related_rules: [fc.rule_id] };
        } else {
            uniqueFailures[key].related_rules.push(fc.rule_id);
        }
    }

    return {
        frameworks,
        failing_controls: Object.values(uniqueFailures),
        summary: {
            total_frameworks: Object.keys(FRAMEWORK_METADATA).length,
            frameworks_fully_compliant: Object.values(frameworks).filter(f => f.failed_controls === 0).length,
            overall_compliance_percentage: Math.round(
                Object.values(frameworks).reduce((sum, f) => sum + f.compliance_percentage, 0) / Object.keys(FRAMEWORK_METADATA).length
            )
        }
    };
}

module.exports = { FRAMEWORK_METADATA, RULE_COMPLIANCE_MAP, mapFindings };
