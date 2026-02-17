import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, ShieldAlert, FileJson, BrainCircuit, CheckCircle2, AlertTriangle } from 'lucide-react';
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
import { motion } from 'framer-motion';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.5,
      ease: "easeOut"
    }
  })
};

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
    return (<div className="flex items-center justify-center h-[calc(100vh-200px)]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>);
  }

  if (error || !scanResult) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] text-center p-8">
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">Error Loading Scan</h2>
        <p className="text-muted-foreground mb-6">{error || "Scan result not found"}</p>
        <Button onClick={() => navigate('/dashboard')} variant="outline" className="gap-2">
          <ArrowLeft className="w-4 h-4" />Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
        <Button variant="ghost" onClick={() => navigate('/dashboard')} className="text-muted-foreground hover:text-foreground pl-0 hover:bg-transparent -ml-2 mb-2 group">
          <ArrowLeft className="w-4 h-4 mr-2 transition-transform group-hover:-translate-x-1" />Back to Dashboard
        </Button>
      </motion.div>

      <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={1}
        className="bg-card/40 backdrop-blur-md rounded-2xl border border-white/10 p-6 md:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-8">
          <div>
            <div className="flex items-center gap-4 mb-3">
              <h1 className="text-3xl font-bold text-foreground">{scanResult.bucketName}</h1>
              <RiskBadge riskScore={scanResult.riskScore} />
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10">
                {scanResult.status === 'compliant' ? (
                  <><ShieldCheck className="w-4 h-4 text-emerald-500" /><span className="text-emerald-500 font-medium capitalize">{scanResult.status}</span></>
                ) : (
                  <><ShieldAlert className="w-4 h-4 text-red-500" /><span className="text-red-500 font-medium capitalize">{scanResult.status}</span></>
                )}
              </span>
              <span>Region: <span className="text-foreground font-medium">{scanResult.configuration.region}</span></span>
              <span>Scanned: <span className="text-foreground font-medium">{new Date(scanResult.timestamp).toLocaleString()}</span></span>
            </div>
          </div>
          <div className="w-full md:w-72 bg-white/5 rounded-xl p-4 border border-white/10">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Security Score</h3>
            <RiskScoreBar score={scanResult.riskScore} />
            <div className="mt-2 text-right text-xs text-muted-foreground">
              {scanResult.riskScore >= 70 ? 'High Risk' : scanResult.riskScore >= 40 ? 'Medium Risk' : 'Low Risk'}
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={2} className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500"><FileJson className="w-5 h-5" /></div>
            <h2 className="text-lg font-semibold text-foreground">Bucket Configuration</h2>
          </div>
          <div className="bg-card/40 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
            <JsonViewer data={scanResult.configuration} />
          </div>
        </motion.div>

        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={3} className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500"><BrainCircuit className="w-5 h-5" /></div>
            <h2 className="text-lg font-semibold text-foreground">AI Security Analysis</h2>
          </div>
          <ExplanationCard analysis={scanResult.aiAnalysis} />

          {scanResult.complianceViolations?.length > 0 && (
            <div className="bg-red-500/5 backdrop-blur-sm border border-red-500/20 rounded-xl p-5">
              <h3 className="text-sm font-bold text-red-500 mb-4 uppercase tracking-wide flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Compliance Violations
              </h3>
              <ul className="space-y-3">
                {scanResult.complianceViolations.map((violation, idx) => (
                  <li key={idx} className="flex gap-3 text-sm bg-red-500/5 p-3 rounded-lg border border-red-500/10">
                    <span className="font-bold text-red-400 min-w-[80px]">{violation.standard}:</span>
                    <span className="text-foreground/90">{violation.requirement}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </motion.div>
      </div>

      <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={4} className="pt-8 border-t border-white/10">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500"><CheckCircle2 className="w-5 h-5" /></div>
            <h2 className="text-xl font-bold text-foreground">Remediation Plan</h2>
          </div>
          {scanResult.remediationPlan?.length > 0 && (
            <Button
              onClick={() => setShowApprovalModal(true)}
              className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white shadow-lg shadow-blue-500/20 border-0"
            >
              Approve & Apply Fixes
            </Button>
          )}
        </div>
        <RemediationPlan actions={scanResult.remediationPlan} />
      </motion.div>

      <ApprovalModal open={showApprovalModal} onOpenChange={setShowApprovalModal} scanId={scanResult.scanId} bucketName={scanResult.bucketName} actionCount={scanResult.remediationPlan?.length || 0} onSuccess={handleRemediationSuccess} />
    </div>
  );
};

export default BucketDetail;
