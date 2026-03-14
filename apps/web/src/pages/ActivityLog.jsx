import React, { useState, useEffect } from 'react';
import { Activity, RefreshCw, AlertCircle, Lock, Globe, Settings, FileText } from 'lucide-react';
import { api } from '@/services/api';
import ActivityTimeline from '@/components/ActivityTimeline.jsx';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
};

// Fix #10: Map remediation actions to descriptive bullet points
const getActionBullets = (findings, status) => {
  const bullets = [];
  if (!findings || !Array.isArray(findings)) return bullets;

  for (const f of findings) {
    const text = (f || '').toLowerCase();
    if (text.includes('public access') || text.includes('block public')) bullets.push('🌐 Enabled Public Access Block');
    if (text.includes('acl') || text.includes('alluser')) bullets.push('🔒 Set ACL to Private');
    if (text.includes('policy') || text.includes('wildcard') || text.includes('principal')) bullets.push('📋 Sanitized Bucket Policy');
    if (text.includes('encrypt')) bullets.push('🔐 Enabled Encryption');
    if (text.includes('version')) bullets.push('📦 Enabled Versioning');
    if (text.includes('log')) bullets.push('📝 Enabled Access Logging');
  }

  // Deduplicate
  return [...new Set(bullets)];
};

const ActivityLog = () => {
  const { currentUser } = useAuth();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const data = await api.getScans();

        // Fix #10: Expanded activity log entries
        const formattedData = data.map(scan => {
          const isSecure = scan.status === 'SECURE';
          const actionBullets = getActionBullets(scan.findings, scan.status);

          let details;
          if (isSecure && actionBullets.length > 0) {
            details = `Successfully remediated ${scan.bucket}:\n${actionBullets.map(b => `  • ${b}`).join('\n')}`;
          } else if (isSecure) {
            details = `Successfully secured ${scan.bucket}. Risk score: ${scan.risk_score || 0}/100`;
          } else {
            const findingCount = (scan.findings || []).length;
            details = `Detected ${findingCount} finding(s) on ${scan.bucket}. Risk score: ${scan.risk_score || 'Unknown'}/100`;
          }

          return {
            id: scan.scan_id,
            action: isSecure ? 'Remediation Executed' : 'Security Scan Completed',
            bucketName: scan.bucket,
            details,
            status: isSecure ? 'success' : 'warning',
            timestamp: scan.created_at,
            user: currentUser?.email || 'System',
            riskScore: scan.risk_score,
            severity: scan.severity
          };
        }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        setActivities(formattedData);
      } catch (err) {
        setError('Failed to load activity history');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [currentUser]);

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={fadeUp}
      className="space-y-8 max-w-4xl mx-auto"
    >
      <div className="flex items-center gap-4 pb-6 border-b border-white/10">
        <div className="p-3 bg-purple-500/10 rounded-2xl border border-purple-500/20 shadow-lg shadow-purple-500/10">
          <Activity className="w-8 h-8 text-purple-500" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Activity Log</h1>
          <p className="text-muted-foreground text-sm mt-1">Track all security scans and remediation actions</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="relative">
            <div className="absolute inset-0 bg-purple-500/20 rounded-full blur-xl animate-pulse"></div>
            <RefreshCw className="relative w-10 h-10 text-purple-500 animate-spin" />
          </div>
        </div>
      ) : error ? (
        <div className="bg-red-500/10 text-red-500 p-6 rounded-2xl border border-red-500/20 flex items-center gap-4">
          <AlertCircle className="w-6 h-6 shrink-0" />
          <p className="font-medium">{error}</p>
        </div>
      ) : (
        <div className="bg-card/30 backdrop-blur-md rounded-2xl border border-white/5 p-2 shadow-sm">
          <ActivityTimeline activities={activities} />
        </div>
      )}
    </motion.div>
  );
};

export default ActivityLog;
