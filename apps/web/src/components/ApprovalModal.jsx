import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { AlertTriangle, CheckCircle, XCircle, Loader2, Shield, Server, ExternalLink, ArrowRight, Info } from 'lucide-react';
import { api } from '@/services/api';
import { cn } from '@/lib/utils';

const AWS_VERIFY_STEPS = {
  s3: {
    title: 'Verify in AWS Console — S3',
    steps: [
      { action: 'PUT_PUBLIC_ACCESS_BLOCK', label: 'Block Public Access', where: 'S3 → Bucket → Permissions → Block public access', check: 'All four settings should show "On"' },
      { action: 'REMOVE_PUBLIC_ACLS', label: 'ACL Set to Private', where: 'S3 → Bucket → Permissions → Access control list (ACL)', check: 'Only the bucket owner should have permissions listed' },
      { action: 'SANITIZE_BUCKET_POLICY', label: 'Bucket Policy Sanitized', where: 'S3 → Bucket → Permissions → Bucket policy', check: 'No statements with Principal: * and Effect: Allow should remain' },
      { action: 'ENABLE_ENCRYPTION', label: 'Encryption Enabled', where: 'S3 → Bucket → Properties → Default encryption', check: 'Should show "Server-side encryption with Amazon S3 managed keys (SSE-S3)"' },
      { action: 'ENABLE_VERSIONING', label: 'Versioning Enabled', where: 'S3 → Bucket → Properties → Bucket Versioning', check: 'Status should show "Enabled"' },
      { action: 'ENABLE_LOGGING', label: 'Access Logging', where: 'S3 → Bucket → Properties → Server access logging', check: 'Should show logging enabled with target prefix "access-logs/"' },
    ]
  },
  ec2: {
    title: 'Verify in AWS Console — EC2',
    steps: [
      { action: 'RESTRICT_SSH', label: 'SSH Restricted', where: 'EC2 → Instance → Security → Security Groups → Inbound rules', check: 'Port 22 should NOT have 0.0.0.0/0 as source. Add your trusted IP manually.' },
      { action: 'RESTRICT_SECURITY_GROUPS', label: 'Security Groups Hardened', where: 'EC2 → Instance → Security → Security Groups → Inbound rules', check: 'No rules should allow 0.0.0.0/0 on database ports (3306, 5432, 27017) or all traffic' },
      { action: 'ENFORCE_IMDSV2', label: 'IMDSv2 Enforced', where: 'EC2 → Instance → Actions → Instance settings → Modify instance metadata options', check: 'IMDSv2 should show "Required" (HttpTokens: required)' },
      { action: 'ENABLE_MONITORING', label: 'Detailed Monitoring', where: 'EC2 → Instance → Monitoring tab', check: 'Detailed monitoring should show "Enabled" with 1-minute CloudWatch metrics' },
      { action: 'ENCRYPT_EBS_VOLUMES', label: 'EBS Encryption', where: 'EC2 → Elastic Block Store → Volumes', check: 'Check the "Encrypted" column. Unencrypted volumes require manual migration.' },
    ]
  }
};

const ApprovalModal = ({ open, onOpenChange, scanId, resourceName, actionCount, serviceType = 's3', onSuccess, onError, onDone }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const isEC2 = serviceType === 'ec2';
  const resourceLabel = isEC2 ? 'Instance' : 'Bucket';
  const ResourceIcon = isEC2 ? Server : Shield;

  const handleApprove = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = isEC2
        ? await api.approveEC2Fix(scanId)
        : await api.approveFix(scanId);
      setResult(response);
      // Don't call onSuccess here — let the user review the report first
    } catch (err) {
      const errMsg = err?.response?.data?.error || err.message || 'Unknown error';
      setError(errMsg);
      if (onError) onError(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDone = () => {
    const savedResult = result;
    setResult(null);
    setError(null);
    onOpenChange(false);
    // Call onDone with the result so the parent can navigate to the new scan
    if (onDone && savedResult) onDone(savedResult);
  };

  const handleClose = () => {
    setResult(null);
    setError(null);
    onOpenChange(false);
  };

  // Get completed verification steps based on execution results
  const getVerificationSteps = () => {
    if (!result?.details) return [];
    const verifyConfig = AWS_VERIFY_STEPS[serviceType];
    if (!verifyConfig) return [];

    return result.details.map(detail => {
      const step = verifyConfig.steps.find(s => s.action === detail.action);
      return {
        ...detail,
        label: step?.label || detail.action,
        where: step?.where || 'AWS Console',
        check: step?.check || 'Verify the change was applied',
      };
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "bg-card/90 backdrop-blur-xl border-white/10 text-foreground shadow-2xl",
        result ? "sm:max-w-[680px]" : "sm:max-w-[520px]"
      )}>
        {/* --- CONFIRMATION STATE --- */}
        {!result && !error && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-foreground">
                <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                Confirm Auto Fix
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Apply security fixes to <span className="text-foreground font-medium">{resourceName}</span>?
              </DialogDescription>
            </DialogHeader>
            <div className="py-6">
              <div className="bg-white/5 rounded-xl border border-white/10 p-5 space-y-4">
                <div className="flex justify-between items-center border-b border-white/5 pb-3">
                  <span className="text-sm font-medium text-muted-foreground">Target {resourceLabel}</span>
                  <div className="flex items-center gap-2">
                    <ResourceIcon className={`w-4 h-4 ${isEC2 ? 'text-orange-400' : 'text-blue-400'}`} />
                    <span className="text-sm font-bold text-foreground">{resourceName}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center border-b border-white/5 pb-3">
                  <span className="text-sm font-medium text-muted-foreground">Service</span>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${isEC2 ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                    {isEC2 ? 'EC2' : 'S3'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-muted-foreground">Pending Actions</span>
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {actionCount} action{actionCount !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
              <div className="mt-4 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
                <p className="text-xs text-amber-400/80 leading-relaxed">
                  <strong>⚠ Warning:</strong> This will execute AWS API calls to remediate security issues. Actions are idempotent and safe to run multiple times. The resource will be rescanned automatically after fixes.
                </p>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={handleClose} disabled={isLoading} className="border-white/10 hover:bg-white/5 text-foreground">
                Cancel
              </Button>
              <Button onClick={handleApprove} disabled={isLoading}
                className={`text-white shadow-lg border-0 ${isEC2 ? 'bg-gradient-to-r from-orange-500 to-amber-500 shadow-orange-500/20 hover:from-orange-600 hover:to-amber-600' : 'bg-gradient-to-r from-blue-600 to-cyan-500 shadow-blue-500/20 hover:from-blue-700 hover:to-cyan-600'}`}>
                {isLoading ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Applying Fixes...</>) : 'Approve & Auto Fix'}
              </Button>
            </DialogFooter>
          </>
        )}

        {/* --- SUCCESS REPORT STATE --- */}
        {result && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-emerald-500">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <CheckCircle className="w-5 h-5" />
                </div>
                Remediation Report
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {result.message}
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-5 max-h-[60vh] overflow-y-auto pr-1">
              {/* Score Change */}
              {result.newRiskScore !== undefined && (
                <div className="bg-white/5 rounded-xl border border-white/10 p-4">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Security Score</h4>
                  <div className="flex items-center justify-center gap-4">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">Before</p>
                      <p className="text-3xl font-bold text-red-400">—</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground" />
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">After</p>
                      <p className={`text-3xl font-bold ${result.newRiskScore <= 30 ? 'text-emerald-400' : result.newRiskScore <= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                        {result.newRiskScore}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Execution Log */}
              {result.details && result.details.length > 0 && (
                <div className="bg-white/5 rounded-xl border border-white/10 p-4 space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Execution Log</h4>
                  {result.details.map((detail, idx) => (
                    <div key={idx} className={cn(
                      "flex items-start gap-3 text-sm p-3 rounded-lg border",
                      detail.status === 'SUCCESS' ? 'bg-emerald-500/5 border-emerald-500/10' :
                        detail.status === 'RECOMMENDATION' ? 'bg-amber-500/5 border-amber-500/10' :
                          detail.status === 'WARNING' ? 'bg-amber-500/5 border-amber-500/10' :
                            'bg-red-500/5 border-red-500/10'
                    )}>
                      {detail.status === 'SUCCESS' ? (
                        <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                      ) : detail.status === 'RECOMMENDATION' || detail.status === 'WARNING' ? (
                        <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground text-sm">{detail.action.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{detail.message}</p>
                      </div>
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex-shrink-0",
                        detail.status === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-400' :
                          detail.status === 'RECOMMENDATION' || detail.status === 'WARNING' ? 'bg-amber-500/10 text-amber-400' :
                            'bg-red-500/10 text-red-400'
                      )}>
                        {detail.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* AWS Verification Steps */}
              <div className="bg-blue-500/5 rounded-xl border border-blue-500/10 p-4">
                <h4 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <ExternalLink className="w-3.5 h-3.5" />
                  Where to Verify in AWS Console
                </h4>
                <div className="space-y-3">
                  {getVerificationSteps().map((step, idx) => (
                    <div key={idx} className="bg-white/5 rounded-lg border border-white/5 p-3">
                      <div className="flex items-center gap-2 mb-1.5">
                        {step.status === 'SUCCESS' ? (
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                        ) : (
                          <Info className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                        )}
                        <span className="font-semibold text-foreground text-sm">{step.label}</span>
                      </div>
                      <div className="ml-5.5 space-y-1">
                        <p className="text-xs text-muted-foreground">
                          <span className="text-blue-400 font-medium">Where: </span>
                          {step.where}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          <span className="text-emerald-400 font-medium">Verify: </span>
                          {step.check}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleDone}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white border-0 shadow-lg shadow-emerald-500/20">
                Done — View Updated Scan
              </Button>
            </DialogFooter>
          </>
        )}

        {/* --- ERROR STATE --- */}
        {error && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-500">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <XCircle className="w-5 h-5" />
                </div>
                Remediation Failed
              </DialogTitle>
            </DialogHeader>
            <div className="py-6">
              <div className="bg-red-500/5 rounded-xl border border-red-500/10 p-5">
                <p className="text-sm text-red-200/80 leading-relaxed text-center">{error}</p>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleClose} variant="destructive" className="w-full shadow-lg shadow-red-500/20">
                Close
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
export default ApprovalModal;
