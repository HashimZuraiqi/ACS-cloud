import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { AlertTriangle, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { approveFix } from '@/lib/api';
const ApprovalModal = ({ open, onOpenChange, scanId, bucketName, actionCount, onSuccess, onError }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleApprove = async () => { setIsLoading(true); setError(null); setResult(null); try { const response = await approveFix(scanId); setResult(response); if (onSuccess) onSuccess(response); } catch (err) { setError(err.message); if (onError) onError(err); } finally { setIsLoading(false); } };
  const handleClose = () => { setResult(null); setError(null); onOpenChange(false); };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-card/90 backdrop-blur-xl border-white/10 text-foreground shadow-2xl">
        {!result && !error && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-foreground">
                <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                Confirm Remediation
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Apply security fixes to <span className="text-foreground font-medium">{bucketName}</span>?
              </DialogDescription>
            </DialogHeader>
            <div className="py-6">
              <div className="bg-white/5 rounded-xl border border-white/10 p-5 space-y-4">
                <div className="flex justify-between items-center border-b border-white/5 pb-3">
                  <span className="text-sm font-medium text-muted-foreground">Target Bucket</span>
                  <span className="text-sm font-bold text-foreground">{bucketName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-muted-foreground">Pending Actions</span>
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {actionCount} action{actionCount !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={handleClose} disabled={isLoading} className="border-white/10 hover:bg-white/5 text-foreground">
                Cancel
              </Button>
              <Button onClick={handleApprove} disabled={isLoading} className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white shadow-lg shadow-blue-500/20 border-0">
                {isLoading ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Applying...</>) : 'Approve & Apply Fixes'}
              </Button>
            </DialogFooter>
          </>
        )}

        {result && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-emerald-500">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <CheckCircle className="w-5 h-5" />
                </div>
                Remediation Successful
              </DialogTitle>
            </DialogHeader>
            <div className="py-6">
              <div className="bg-emerald-500/5 rounded-xl border border-emerald-500/10 p-5">
                <p className="text-sm text-emerald-200/80 leading-relaxed text-center">{result.message}</p>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleClose} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white border-0 shadow-lg shadow-emerald-500/20">
                Done
              </Button>
            </DialogFooter>
          </>
        )}

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
