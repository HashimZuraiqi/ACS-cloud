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
      <DialogContent className="sm:max-w-[500px]">
        {!result && !error && (<><DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-orange-600" />Confirm Remediation</DialogTitle><DialogDescription>Apply security fixes to {bucketName}?</DialogDescription></DialogHeader><div className="py-4"><div className="bg-gray-50 rounded-lg p-4 space-y-3"><div><span className="text-sm font-medium text-gray-700">Bucket:</span><p className="text-base font-semibold text-gray-900 mt-1">{bucketName}</p></div><div><span className="text-sm font-medium text-gray-700">Actions:</span><p className="text-base font-semibold text-gray-900 mt-1">{actionCount} remediation action{actionCount !== 1 ? 's' : ''}</p></div></div></div><DialogFooter><Button variant="outline" onClick={handleClose} disabled={isLoading}>Cancel</Button><Button onClick={handleApprove} disabled={isLoading} className="bg-blue-600 hover:bg-blue-700 text-white">{isLoading ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Applying...</>) : 'Apply Fixes'}</Button></DialogFooter></>)}
        {result && (<><DialogHeader><DialogTitle className="flex items-center gap-2 text-green-700"><CheckCircle className="w-5 h-5" />Remediation Successful</DialogTitle></DialogHeader><div className="py-4"><div className="bg-green-50 rounded-lg p-4"><p className="text-sm text-green-800">{result.message}</p></div></div><DialogFooter><Button onClick={handleClose} className="bg-green-600 hover:bg-green-700 text-white">Close</Button></DialogFooter></>)}
        {error && (<><DialogHeader><DialogTitle className="flex items-center gap-2 text-red-700"><XCircle className="w-5 h-5" />Remediation Failed</DialogTitle></DialogHeader><div className="py-4"><div className="bg-red-50 rounded-lg p-4"><p className="text-sm text-red-800">{error}</p></div></div><DialogFooter><Button onClick={handleClose} className="bg-red-600 hover:bg-red-700 text-white">Close</Button></DialogFooter></>)}
      </DialogContent>
    </Dialog>
  );
};
export default ApprovalModal;
