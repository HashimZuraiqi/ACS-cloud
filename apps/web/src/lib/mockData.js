export const mockBuckets = [
  { id: '1', name: 'prod-data-bucket', region: 'us-east-1', riskScore: 85, riskLevel: 'high', lastScanned: '2026-02-17T10:00:00Z', complianceStatus: 'non-compliant' },
  { id: '2', name: 'staging-assets', region: 'us-west-2', riskScore: 45, riskLevel: 'medium', lastScanned: '2026-02-17T09:00:00Z', complianceStatus: 'warning' },
  { id: '3', name: 'logs-archive', region: 'eu-west-1', riskScore: 15, riskLevel: 'low', lastScanned: '2026-02-17T08:00:00Z', complianceStatus: 'compliant' },
];

export const mockScanResults = {
  'scan-001': {
    scanId: 'scan-001', bucketName: 'prod-data-bucket', riskScore: 85, riskLevel: 'high',
    configuration: { versioning: false, encryption: 'none', publicAccess: true, logging: false, acl: 'public-read' },
    aiAnalysis: { explanation: 'This bucket has critical security issues: public access is enabled, no encryption, versioning disabled, and logging is off. This violates multiple compliance standards.', confidence: 95, evidence: ['Public access enabled via ACL', 'No server-side encryption configured', 'Versioning is disabled', 'Access logging not enabled'] },
    complianceViolations: [
      { standard: 'SOC2 CC6.6', requirement: 'Encryption at rest', severity: 'high' },
      { standard: 'GDPR Art.32', requirement: 'Data protection measures', severity: 'high' },
      { standard: 'HIPAA 164.312(a)(2)(iv)', requirement: 'Encryption and decryption', severity: 'high' },
    ],
    remediationPlan: [
      { id: 'fix-1', title: 'Enable Server-Side Encryption', description: 'Enable AES-256 encryption', command: 'aws s3api put-bucket-encryption --bucket prod-data-bucket --server-side-encryption-configuration ...', priority: 1 },
      { id: 'fix-2', title: 'Block Public Access', description: 'Block all public access', command: 'aws s3api put-public-access-block --bucket prod-data-bucket --public-access-block-configuration BlockPublicAcls=true,...', priority: 1 },
      { id: 'fix-3', title: 'Enable Versioning', description: 'Enable versioning for data recovery', command: 'aws s3api put-bucket-versioning --bucket prod-data-bucket --versioning-configuration Status=Enabled', priority: 2 },
    ],
    timestamp: '2026-02-17T10:00:00Z', status: 'non-compliant'
  },
  'scan-002': {
    scanId: 'scan-002', bucketName: 'staging-assets', riskScore: 45, riskLevel: 'medium',
    configuration: { versioning: true, encryption: 'AES256', publicAccess: false, logging: false, acl: 'private' },
    aiAnalysis: { explanation: 'Bucket has basic security but lacks access logging. Encryption and access controls are properly configured.', confidence: 88, evidence: ['Access logging not enabled', 'Encryption configured correctly', 'Public access blocked'] },
    complianceViolations: [{ standard: 'SOC2 CC7.2', requirement: 'Monitoring and logging', severity: 'medium' }],
    remediationPlan: [{ id: 'fix-4', title: 'Enable Access Logging', description: 'Enable server access logging', command: 'aws s3api put-bucket-logging --bucket staging-assets --bucket-logging-status ...', priority: 3 }],
    timestamp: '2026-02-17T09:00:00Z', status: 'warning'
  },
};

export const mockActivityLog = [
  { id: 'act-1', action: 'Security Scan Completed', bucketName: 'prod-data-bucket', user: 'system', timestamp: '2026-02-17T10:00:00Z', status: 'completed', details: 'Full security scan completed. 3 critical issues found.' },
  { id: 'act-2', action: 'Remediation Applied', bucketName: 'staging-assets', user: 'admin@cloudguard.io', timestamp: '2026-02-17T09:30:00Z', status: 'success', details: 'Access logging enabled successfully.' },
  { id: 'act-3', action: 'Security Scan Completed', bucketName: 'logs-archive', user: 'system', timestamp: '2026-02-17T08:00:00Z', status: 'completed', details: 'Full security scan completed. No issues found.' },
];
