const fs = require('fs');
const path = require('path');

const s3RulesPath = path.join(__dirname, 'src/scan-pipeline/agents/rules/s3-rules.js');
const ec2RulesPath = path.join(__dirname, 'src/scan-pipeline/agents/rules/ec2-rules.js');
const iamRulesPath = path.join(__dirname, 'src/scan-pipeline/agents/rules/iam-rules.js');
const costScanPath = path.join(__dirname, 'src/scan-pipeline/cost-scan.controller.js');

const combinedRules = [
    { id: 'S3-001', mode: 'AUTO_FIX', reason: 'Safe zero-downtime configuration change.', auto_fix: true },
    { id: 'S3-002', mode: 'AUTO_FIX', reason: 'Safe automated removal of public grants.', auto_fix: true },
    { id: 'S3-003', mode: 'AUTO_FIX', reason: 'Safe automated removal of public grants.', auto_fix: true },
    { id: 'S3-004', mode: 'MANUAL_REVIEW', reason: 'Modifying bucket policies can break consuming applications.', auto_fix: false },
    { id: 'S3-005', mode: 'MANUAL_REVIEW', reason: 'Enforcing HTTPS may break legacy HTTP clients.', auto_fix: false },
    { id: 'S3-006', mode: 'AUTO_FIX', reason: 'Applying default AES-256 encryption is non-disruptive to existing objects.', auto_fix: true },
    { id: 'S3-007', mode: 'ASSISTED_FIX', reason: 'Switching to SSE-KMS requires provisioning a KMS key and setting up IAM permissions.', auto_fix: false },
    { id: 'S3-008', mode: 'AUTO_FIX', reason: 'Enabling versioning is a safe, non-destructive operation.', auto_fix: true },
    { id: 'S3-009', mode: 'AUTO_FIX', reason: 'Enabling access logging to an isolated bucket is safe.', auto_fix: true },
    { id: 'S3-010', mode: 'AUTO_FIX', reason: 'Applying a standard 90-day transition policy is safe.', auto_fix: true },
    { id: 'S3-011', mode: 'MANUAL_REVIEW', reason: 'Modifying CORS requires understanding the frontend applications leveraging the bucket.', auto_fix: false },
    { id: 'S3-012', mode: 'MANUAL_REVIEW', reason: 'Condition logic requires custom evaluation based on the organization structure.', auto_fix: false },
    { id: 'S3-013', mode: 'AUTO_FIX', reason: 'Applying full Public Access Block is a baseline standard.', auto_fix: true },

    { id: 'EC2-001', mode: 'MANUAL_REVIEW', reason: 'Removing a public IP will immediately disconnect external routes.', auto_fix: false },
    { id: 'EC2-002', mode: 'MANUAL_REVIEW', reason: 'Altering SSH rules can lock out administrators. Use Systems Manager.', auto_fix: false },
    { id: 'EC2-003', mode: 'MANUAL_REVIEW', reason: 'Altering RDP rules can lock out administrators.', auto_fix: false },
    { id: 'EC2-004', mode: 'MANUAL_REVIEW', reason: 'Removing open rules requires mapping legitimate inbound traffic first.', auto_fix: false },
    { id: 'EC2-005', mode: 'MANUAL_REVIEW', reason: 'Database connectivity must be carefully mapped to origin subnets.', auto_fix: false },
    { id: 'EC2-006', mode: 'AUTO_FIX', reason: 'Enforcing IMDSv2 is generally safe for modern applications.', auto_fix: true },
    { id: 'EC2-007', mode: 'ASSISTED_FIX', reason: 'In-place root volume encryption is not supported; requires snapshot and replace.', auto_fix: false },
    { id: 'EC2-008', mode: 'MANUAL_REVIEW', reason: 'Creating an IAM profile requires evaluating what permissions the app needs.', auto_fix: false },
    { id: 'EC2-009', mode: 'AUTO_FIX', reason: 'Enabling detailed monitoring is a safe configuration change.', auto_fix: true },
    { id: 'EC2-010', mode: 'MANUAL_REVIEW', reason: 'Migrating VPCs requires architecture planning and downtime.', auto_fix: false },
    { id: 'EC2-011', mode: 'MANUAL_REVIEW', reason: 'Restricting egress requires strict knowledge of external dependencies.', auto_fix: false },
    { id: 'EC2-012', mode: 'MANUAL_REVIEW', reason: 'Port ranges must be mapped to application requirements before restricting.', auto_fix: false },

    { id: 'IAM-001', mode: 'MANUAL_REVIEW', reason: 'Detaching AdministratorAccess can unexpectedly break critical pipelines.', auto_fix: false },
    { id: 'IAM-002', mode: 'MANUAL_REVIEW', reason: 'Deactivating admin users requires verifying they are not system accounts.', auto_fix: false },
    { id: 'IAM-003', mode: 'ASSISTED_FIX', reason: 'Enforcing MFA requires user coordination.', auto_fix: false },
    { id: 'IAM-004', mode: 'ASSISTED_FIX', reason: 'Rotating keys requires updating the applications using them before deleting the old ones.', auto_fix: false },
    { id: 'IAM-005', mode: 'AUTO_FIX', reason: 'Deactivating a clearly unused second key is safe.', auto_fix: true },
    { id: 'IAM-006', mode: 'MANUAL_REVIEW', reason: 'Replacing inline policies requires carefully mapping needed actions.', auto_fix: false },
    { id: 'IAM-007', mode: 'MANUAL_REVIEW', reason: 'Deleting an unused user should be confirmed first.', auto_fix: false },
    { id: 'IAM-008', mode: 'AUTO_FIX', reason: 'Deactivating a stale key unused for over 90 days is safe.', auto_fix: true },
    { id: 'IAM-009', mode: 'MANUAL_REVIEW', reason: 'Restricting over-permissive policies requires testing.', auto_fix: false },
];

function refactorFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');
    let original = content;

    for (const rule of combinedRules) {
        const ruleIdStr = "rule_id: '" + rule.id + "'";
        let ruleIndex = content.indexOf(ruleIdStr);
        if (ruleIndex === -1) continue;
        
        let complianceIndex = content.indexOf('compliance: [', ruleIndex);
        if (complianceIndex === -1) continue;

        let remediationIndex = content.indexOf('remediation: ', ruleIndex);
        if(remediationIndex === -1 || remediationIndex > complianceIndex) continue;

        let beforeRemediation = content.substring(0, remediationIndex);
        let afterRemediation = content.substring(complianceIndex);
        
        let linesStr = content.substring(remediationIndex, complianceIndex);
        let firstLine = linesStr.split('\n')[0].replace('\r', '');
        
        // Ensure we remove trailing comma from firstLine if it exists
        if(firstLine.endsWith(',')) firstLine = firstLine.slice(0, -1);

        let newLines = firstLine + ",\n            remediation_mode: '" + rule.mode + "',\n            remediation_reason: '" + rule.reason + "',\n            auto_fix_available: " + rule.auto_fix + ",\n            ";
        
        content = beforeRemediation + newLines + afterRemediation;
    }
    
    if (content !== original) {
        fs.writeFileSync(filePath, content);
        console.log("Refactored", filePath);
    }
}

refactorFile(s3RulesPath);
refactorFile(ec2RulesPath);
refactorFile(iamRulesPath);

let costContent = fs.readFileSync(costScanPath, 'utf8');
if(!costContent.includes('remediation_mode')) {
    // Zombie Resource 
    costContent = costContent.replace(
        'status: "Zombie Resource"',
        'status: "Zombie Resource",\n                remediation_mode: "MANUAL_REVIEW",\n                remediation_reason: "Deleting unattached storage requires confirmation that the data is no longer needed.",\n                auto_fix_available: false'
    );
    // Idle instance
    costContent = costContent.replace(
        'status: "Idle Instance"',
        'status: "Idle Instance",\n                remediation_mode: "ASSISTED_FIX",\n                remediation_reason: "Stopping instances is generally safe but requires verifying there are no background jobs running.",\n                auto_fix_available: false'
    );
    fs.writeFileSync(costScanPath, costContent);
    console.log("Refactored", costScanPath);
}

console.log("Rule refactoring complete.");
