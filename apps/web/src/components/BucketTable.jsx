import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, ShieldCheck, ShieldAlert, Clock, ArrowRight, Download } from 'lucide-react';
import { motion } from 'framer-motion';
import RiskBadge from '@/components/RiskBadge.jsx';
import RiskScoreBar from '@/components/RiskScoreBar.jsx';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';
import { useToast } from '@/components/ui/use-toast';

const BucketTable = ({ buckets }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [downloadingId, setDownloadingId] = useState(null);

  // Fix #9: Download PDF from dashboard
  const handleDownload = async (e, bucket) => {
    e.stopPropagation();
    try {
      setDownloadingId(bucket.scanId);
      const blob = await api.downloadResourceReport(bucket.scanId, 's3');
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cloudguard-security-report-${bucket.bucketName || bucket.name}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast({ title: "Report Downloaded", variant: "success" });
    } catch {
      toast({ title: "Download Failed", variant: "destructive" });
    } finally {
      setDownloadingId(null);
    }
  };

  if (!buckets || buckets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-20 px-4">
        <div className="w-20 h-20 rounded-full bg-muted/30 flex items-center justify-center mb-6">
          <ShieldAlert className="w-10 h-10 text-muted-foreground/50" />
        </div>
        <h3 className="text-xl font-semibold text-foreground mb-2">No Buckets Scanned Yet</h3>
        <p className="text-muted-foreground max-w-sm mx-auto">
          Your infrastructure inventory is empty. Use the search bar above to scan your first S3 bucket.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-white/10 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <th className="px-6 py-4 pl-8">Bucket Name</th>
            <th className="px-6 py-4">Risk Level</th>
            <th className="px-6 py-4 w-48">Security Score</th>
            <th className="px-6 py-4">Compliance</th>
            <th className="px-6 py-4">Last Scanned</th>
            <th className="px-6 py-4 text-right pr-8">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {buckets.map((bucket, index) => (
            <motion.tr
              key={bucket.scanId || bucket.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 + 0.2 }}
              className="group hover:bg-white/[0.03] transition-colors cursor-pointer"
              onClick={() => navigate(`/bucket/${bucket.scanId}`)}
            >
              <td className="px-6 py-5 pl-8">
                <span className="font-semibold text-foreground group-hover:text-blue-400 transition-colors text-base block mb-0.5">
                  {bucket.bucketName || bucket.name}
                </span>
                <span className="text-xs text-muted-foreground">{bucket.region || 'us-east-1'}</span>
              </td>
              <td className="px-6 py-5">
                <RiskBadge riskScore={bucket.riskScore} riskLevel={bucket.riskLevel} />
              </td>
              <td className="px-6 py-5">
                <RiskScoreBar score={bucket.riskScore} showLabel={false} className="max-w-[140px]" />
              </td>
              <td className="px-6 py-5">
                <div className="flex items-center gap-2">
                  {bucket.status === 'compliant' ? (
                    <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span className="font-medium text-xs">Compliant</span>
                    </div>
                  ) : (
                    <div className={cn(
                      "flex items-center gap-2 px-2.5 py-1 rounded-full border",
                      bucket.status === 'non-compliant'
                        ? "bg-red-500/10 text-red-500 border-red-500/20"
                        : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                    )}>
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span className="capitalize font-medium text-xs">{bucket.status?.replace('-', ' ') || bucket.complianceStatus}</span>
                    </div>
                  )}
                </div>
              </td>
              <td className="px-6 py-5 text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 opacity-70" />
                  {new Date(bucket.timestamp || bucket.lastScanned).toLocaleDateString()}
                </div>
              </td>
              <td className="px-6 py-5 text-right pr-8">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/bucket/${bucket.scanId}`); }}
                    className="group/btn relative inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 hover:text-blue-300 transition-all active:scale-95"
                  >
                    View Report
                    <ArrowRight className="w-3 h-3 transition-transform group-hover/btn:translate-x-0.5" />
                  </button>
                  {/* Fix #9: Download PDF button on dashboard */}
                  <button
                    onClick={(e) => handleDownload(e, bucket)}
                    disabled={downloadingId === bucket.scanId}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 hover:text-purple-300 transition-all active:scale-95 disabled:opacity-50"
                    title="Download PDF Security Report"
                  >
                    <Download className="w-3 h-3" />
                    PDF
                  </button>
                </div>
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default BucketTable;