import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, Shield, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { getResults, scanBucket } from '@/lib/api';
import BucketTable from '@/components/BucketTable.jsx';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.45, delay: i * 0.08, ease: [0.25,0.46,0.45,0.94] } }),
};

const StatCard = ({ icon: Icon, label, value, accent, delay }) => (
  <motion.div
    initial="hidden" animate="visible" variants={fadeUp} custom={delay}
    className="group relative p-5 rounded-2xl border border-border bg-card hover:shadow-lg hover:shadow-black/[0.03] dark:hover:shadow-black/20 transition-all duration-300"
  >
    <div className="flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${accent} transition-transform group-hover:scale-110`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-sm text-muted-foreground font-medium">{label}</p>
        <p className="text-2xl font-bold text-foreground mt-0.5">{value}</p>
      </div>
    </div>
  </motion.div>
);

const Dashboard = () => {
  const { currentUser } = useAuth();
  const [buckets, setBuckets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();

  const fetchData = async () => {
    try { setLoading(true); const data = await getResults(); setBuckets(data); setError(null); }
    catch (err) { setError('Failed to load dashboard data.'); console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleScan = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setScanning(true);
    try {
      await scanBucket(searchQuery);
      toast({ title: "Scan complete", description: `Scanned: ${searchQuery}`, variant: "success" });
      await fetchData(); setSearchQuery('');
    } catch (err) { toast({ title: "Scan failed", description: err.message, variant: "destructive" }); }
    finally { setScanning(false); }
  };

  const totalBuckets = buckets.length;
  const highRisk = buckets.filter(b => b.riskLevel === 'high').length;
  const compliant = buckets.filter(b => b.status === 'compliant').length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Security Dashboard</h1>
        <p className="text-muted-foreground mt-1">Monitor and protect your S3 bucket infrastructure</p>
      </motion.div>

      {/* Scan bar */}
      <motion.form onSubmit={handleScan} initial="hidden" animate="visible" variants={fadeUp} custom={1}>
        <div className="flex flex-col sm:flex-row gap-3 p-1.5 sm:p-1.5 bg-card rounded-2xl border border-border">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text" placeholder="Enter S3 bucket name to scan..." value={searchQuery}
              onChange={(e)=>setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-all text-sm"
            />
          </div>
          <button type="submit" disabled={scanning || !searchQuery}
            className="px-6 py-3 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-blue-600 to-cyan-500 shadow-md shadow-blue-600/15 hover:shadow-blue-600/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2 whitespace-nowrap">
            {scanning ? (<><RefreshCw className="w-4 h-4 animate-spin" /> Scanning...</>) : (<><Search className="w-4 h-4" /> Scan Bucket</>)}
          </button>
        </div>
      </motion.form>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Shield} label="Total Buckets" value={totalBuckets} accent="bg-gradient-to-br from-blue-500 to-blue-600" delay={2} />
        <StatCard icon={AlertTriangle} label="High Risk" value={highRisk} accent="bg-gradient-to-br from-red-500 to-rose-600" delay={3} />
        <StatCard icon={CheckCircle2} label="Compliant" value={compliant} accent="bg-gradient-to-br from-emerald-500 to-green-600" delay={4} />
      </div>

      {/* Table */}
      <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={5} className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">Bucket Inventory</h2>
          <button onClick={fetchData} disabled={loading}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center h-56 gap-3">
            <RefreshCw className="w-8 h-8 text-muted-foreground animate-spin" />
            <p className="text-sm text-muted-foreground">Loading data...</p>
          </div>
        ) : error ? (
          <div className="p-5 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-600 dark:text-red-400">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        ) : (
          <BucketTable buckets={buckets} />
        )}
      </motion.div>
    </div>
  );
};

export default Dashboard;