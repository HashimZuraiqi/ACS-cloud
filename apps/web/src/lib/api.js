import { mockBuckets, mockScanResults, mockActivityLog } from './mockData';
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
export const scanBucket = async (bucketName) => {
  await delay(2000);
  const bucket = mockBuckets.find(b => b.name === bucketName);
  if (!bucket) throw new Error('Bucket not found');
  const scanResult = Object.values(mockScanResults).find(r => r.bucketName === bucketName);
  if (!scanResult) throw new Error('No scan results available');
  return scanResult;
};
export const getResults = async () => { await delay(800); return Object.values(mockScanResults); };
export const getScan = async (scanId) => { await delay(500); const r = mockScanResults[scanId]; if (!r) throw new Error('Scan not found'); return r; };
export const approveFix = async (scanId) => {
  await delay(3000);
  const scanResult = mockScanResults[scanId];
  if (!scanResult) throw new Error('Scan not found');
  const success = Math.random() > 0.1;
  if (success) return { success: true, message: 'Remediation applied successfully', actionsApplied: scanResult.remediationPlan.length, newRiskScore: Math.max(0, scanResult.riskScore - 40), timestamp: new Date().toISOString() };
  else throw new Error('Insufficient permissions');
};
export const getHistory = async () => { await delay(600); return mockActivityLog; };
export const getBuckets = async () => { await delay(700); return mockBuckets; };
