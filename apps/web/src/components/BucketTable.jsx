import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, ShieldCheck, ShieldAlert, Clock, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import RiskBadge from '@/components/RiskBadge.jsx';
import RiskScoreBar from '@/components/RiskScoreBar.jsx';
import { cn } from '@/lib/utils';

const BucketTable = ({ buckets }) => {
  const navigate = useNavigate();

  if (!buckets || buckets.length === 0) {
    return (
      <div className="text-center py-16 rounded-2xl border-2 border-dashed border-border bg-card/40">
        <ShieldAlert className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <h3 className="text-base font-semibold text-foreground">No Buckets Scanned Yet</h3>
        <p className="text-sm text-muted-foreground mt-1">Use the search bar above to scan an S3 bucket</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Bucket</th>
              <th className="px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Risk</th>
              <th className="px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-40">Score</th>
              <th className="px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Scanned</th>
              <th className="px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {buckets.map((bucket) => (
              <tr
                key={bucket.scanId || bucket.id}
                className="group hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => navigate(`/bucket/${bucket.scanId}`)}
              >
                <td className="px-5 py-4">
                  <span className="font-medium text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {bucket.bucketName || bucket.name}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <RiskBadge riskScore={bucket.riskScore} riskLevel={bucket.riskLevel} />
                </td>
                <td className="px-5 py-4">
                  <RiskScoreBar score={bucket.riskScore} showLabel={false} className="max-w-[140px]" />
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-1.5">
                    {bucket.status === 'compliant' ? (
                      <><ShieldCheck className="w-4 h-4 text-emerald-500" /><span className="text-emerald-600 dark:text-emerald-400 font-medium text-xs">Compliant</span></>
                    ) : (
                      <><ShieldAlert className={cn("w-4 h-4", bucket.status === 'non-compliant' ? "text-red-500" : "text-amber-500")} /><span className="capitalize font-medium text-xs text-foreground">{bucket.status?.replace('-', ' ') || bucket.complianceStatus}</span></>
                    )}
                  </div>
                </td>
                <td className="px-5 py-4 text-muted-foreground text-xs">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    {new Date(bucket.timestamp || bucket.lastScanned).toLocaleDateString()}
                  </div>
                </td>
                <td className="px-5 py-4 text-right">
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/bucket/${bucket.scanId}`); }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-500/[0.08] hover:bg-blue-500/[0.15] transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Details
                    <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BucketTable;