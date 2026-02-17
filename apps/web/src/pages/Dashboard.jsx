import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, Shield, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { getResults, scanBucket } from '@/lib/api';
import BucketTable from '@/components/BucketTable.jsx';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

const ease = [0.22, 1, 0.36, 1];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.8, delay: i * 0.1, ease },
  }),
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: (i = 0) => ({
    opacity: 1, scale: 1,
    transition: { duration: 0.6, delay: i * 0.05, ease },
  }),
};

const StatCard = ({ icon: Icon, label, value, accent, delay }) => (
  <motion.div
    initial="hidden" animate="visible" variants={scaleIn} custom={delay}
    whileHover={{ y: -5, transition: { duration: 0.2 } }}
    className="group relative p-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-xl hover:bg-white/10 hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-300 overflow-hidden"
  >
    <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full ${accent} opacity-[0.15] blur-2xl group-hover:opacity-25 transition-opacity duration-500`} />

    <div className="relative flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${accent} shadow-lg shadow-black/20 group-hover:scale-110 transition-transform duration-300`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <p className="text-sm text-muted-foreground font-medium mb-1">{label}</p>
        <div className="flex items-baseline gap-2">
          <motion.p
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: delay * 0.2 + 0.5 }}
            className="text-3xl font-bold text-foreground"
          >
            {value}
          </motion.p>
        </div>
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
    <div className="relative min-h-[calc(100vh-4rem)]">
      <div className="space-y-8 pb-10">
        {/* Header */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-2">
            <span className="bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-400 dark:from-blue-400 dark:via-cyan-300 dark:to-blue-300 bg-clip-text text-transparent">
              Security Dashboard
            </span>
          </h1>
          <p className="text-lg text-muted-foreground">Real-time infrastructure monitoring and compliance analysis.</p>
        </motion.div>

        {/* Scan bar */}
        <motion.form onSubmit={handleScan} initial="hidden" animate="visible" variants={fadeUp} custom={1}
          className="max-w-2xl"
        >
          <div className="relative group p-[2px] rounded-2xl bg-gradient-to-r from-blue-500/20 via-cyan-500/20 to-blue-500/20 hover:from-blue-500/40 hover:via-cyan-500/40 hover:to-blue-500/40 transition-colors duration-500">
            <div className="relative flex items-center bg-card/80 backdrop-blur-xl rounded-[14px]">
              <Search className="absolute left-4 w-5 h-5 text-muted-foreground group-focus-within:text-blue-500 transition-colors" />
              <input
                type="text"
                placeholder="Enter S3 bucket name to scan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-transparent border-none text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0 text-base rounded-[14px]"
              />
              <div className="pr-2">
                <button type="submit" disabled={scanning || !searchQuery}
                  className="px-5 py-2.5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-blue-600 to-cyan-500 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 disabled:opacity-50 disabled:shadow-none transition-all duration-300 hover:scale-105 active:scale-95 flex items-center gap-2">
                  {scanning ? (<><RefreshCw className="w-4 h-4 animate-spin" /> Scanning</>) : (<>Scan</>)}
                </button>
              </div>
            </div>
          </div>
        </motion.form>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <StatCard icon={Shield} label="Total Buckets" value={totalBuckets} accent="bg-gradient-to-br from-blue-500 to-blue-600" delay={2} />
          <StatCard icon={AlertTriangle} label="High Risk" value={highRisk} accent="bg-gradient-to-br from-red-500 to-rose-600" delay={3} />
          <StatCard icon={CheckCircle2} label="Compliant" value={compliant} accent="bg-gradient-to-br from-emerald-500 to-green-600" delay={4} />
        </div>

        {/* Table */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={5} className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xl font-bold text-foreground">Active Infrastructure</h2>
            <button onClick={fetchData} disabled={loading}
              className="p-2 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground transition-all hover:rotate-180 duration-500">
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className={`relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-sm overflow-hidden min-h-[400px] transition-all duration-500 ${loading ? 'opacity-80' : 'opacity-100'}`}>
            {loading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full border-4 border-blue-500/30 border-t-blue-500 animate-spin" />
                  <div className="absolute inset-0 w-12 h-12 rounded-full border-4 border-cyan-400/20 border-b-cyan-400 animate-spin-reverse" />
                </div>
                <p className="text-sm font-medium text-muted-foreground animate-pulse">Syncing infrastructure...</p>
              </div>
            ) : error ? (
              <div className="absolute inset-0 flex items-center justify-center text-center p-6">
                <div className="max-w-md p-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400">
                  <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-80" />
                  <h3 className="font-semibold mb-1">Error Loading Data</h3>
                  <p className="text-sm opacity-90">{error}</p>
                </div>
              </div>
            ) : (
              <BucketTable buckets={buckets} />
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;