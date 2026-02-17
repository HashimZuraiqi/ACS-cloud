import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, ShieldAlert, FileJson, BrainCircuit } from 'lucide-react';
import { getScan } from '@/lib/api';
import { Button } from '@/components/ui/button.jsx';
import { useToast } from '@/components/ui/use-toast';
import RiskBadge from '@/components/RiskBadge.jsx';
import RiskScoreBar from '@/components/RiskScoreBar.jsx';
import JsonViewer from '@/components/JsonViewer.jsx';
import ExplanationCard from '@/components/ExplanationCard.jsx';
import RemediationPlan from '@/components/RemediationPlan.jsx';
import ApprovalModal from '@/components/ApprovalModal.jsx';
import { useAuth } from '@/contexts/AuthContext';

const BucketDetail = () => {
  const { scanId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const [scanResult, setScanResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);

  const fetchScan = async () => {
    try { setLoading(true); const data = await getScan(scanId); setScanResult(data); setError(null); } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  useEffect(() => { if (scanId) { fetchScan(); } }, [scanId]);

  const handleRemediationSuccess = (result) => {
    toast({ title: "Remediation Applied", description: result.message, variant: "success" });
    setScanResult(prev => ({ ...prev, riskScore: result.newRiskScore, remediationPlan: [], status: result.newRiskScore < 40 ? 'compliant' : 'warning' }));
  };

  if (loading) {
    return (<div className="flex items-center justify-center h-[calc(100vh-100px)]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>);
  }

  if (error || !scanResult) {
    return (<div className="p-8 text-center"><h2 className="text-xl font-bold text-red-600 mb-2">Error Loading Scan</h2><p className="text-gray-600 mb-4">{error || "Scan result not found"}</p><Button onClick={() => navigate('/dashboard')} variant="outline"><ArrowLeft className="w-4 h-4 mr-2" />Back to Dashboard</Button></div>);
  }

  return (
    <div className="space-y-6 pb-12">
      <Button variant="ghost" onClick={() => navigate('/dashboard')} className="text-gray-500 hover:text-gray-900 pl-0 hover:bg-transparent"><ArrowLeft className="w-4 h-4 mr-2" />Back to Dashboard</Button>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">{scanResult.bucketName}</h1>
              <RiskBadge riskScore={scanResult.riskScore} />
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1.5">{scanResult.status === 'compliant' ? (<ShieldCheck className="w-4 h-4 text-green-500" />) : (<ShieldAlert className="w-4 h-4 text-red-500" />)}{scanResult.status}</span>
              <span>Region: {scanResult.configuration.region}</span>
              <span>Scanned: {new Date(scanResult.timestamp).toLocaleString()}</span>
            </div>
          </div>
          <div className="w-full md:w-64"><RiskScoreBar score={scanResult.riskScore} /></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-2"><FileJson className="w-5 h-5 text-gray-600" /><h2 className="text-lg font-semibold text-gray-900">Bucket Configuration</h2></div>
          <JsonViewer data={scanResult.configuration} />
        </div>
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-2"><BrainCircuit className="w-5 h-5 text-blue-600" /><h2 className="text-lg font-semibold text-gray-900">AI Security Analysis</h2></div>
          <ExplanationCard analysis={scanResult.aiAnalysis} />
          {scanResult.complianceViolations?.length > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-lg p-4">
              <h3 className="text-sm font-bold text-red-800 mb-3 uppercase tracking-wide">Compliance Violations</h3>
              <ul className="space-y-2">{scanResult.complianceViolations.map((violation, idx) => (<li key={idx} className="flex gap-2 text-sm"><span className="font-semibold text-red-700 min-w-[100px]">{violation.standard}:</span><span className="text-red-900">{violation.requirement}</span></li>))}</ul>
            </div>
          )}
        </div>
      </div>

      <div className="pt-6 border-t border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Remediation Plan</h2>
          {scanResult.remediationPlan?.length > 0 && (<Button onClick={() => setShowApprovalModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20">Approve & Apply Fixes</Button>)}
        </div>
        <RemediationPlan actions={scanResult.remediationPlan} />
      </div>

      <ApprovalModal open={showApprovalModal} onOpenChange={setShowApprovalModal} scanId={scanResult.scanId} bucketName={scanResult.bucketName} actionCount={scanResult.remediationPlan?.length || 0} onSuccess={handleRemediationSuccess} />
    </div>
  );
};

export default BucketDetail;
