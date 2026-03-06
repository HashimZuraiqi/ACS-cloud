import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, Shield, AlertTriangle, CheckCircle2, Server, Database } from 'lucide-react';
import { api } from '@/services/api';
import BucketTable from '@/components/BucketTable.jsx';
import InstanceTable from '@/components/InstanceTable.jsx';
import IAMTable from '@/components/IAMTable.jsx';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

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

const SERVICE_TABS = [
  { id: 's3', label: 'S3 Buckets', icon: Database, accent: 'from-blue-600 to-cyan-500' },
  { id: 'ec2', label: 'EC2 Instances', icon: Server, accent: 'from-orange-500 to-amber-500' },
  { id: 'iam', label: 'IAM Users', icon: Shield, accent: 'from-purple-500 to-fuchsia-500' },
];

const Dashboard = () => {
  const { currentUser } = useAuth();
  const [activeService, setActiveService] = useState('s3');
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();

  const [serviceData, setServiceData] = useState({ s3: [], ec2: [], iam: [] });
  const [serviceLoading, setServiceLoading] = useState({ s3: true, ec2: true, iam: true });
  const [serviceError, setServiceError] = useState({ s3: null, ec2: null, iam: null });
  const [serviceScanning, setServiceScanning] = useState({ s3: false, ec2: false, iam: false });

  const updateServiceState = (service, key, value) => {
    if (key === 'data') {
      setServiceData(prev => ({ ...prev, [service]: value }));
    } else if (key === 'loading') {
      setServiceLoading(prev => ({ ...prev, [service]: value }));
    } else if (key === 'error') {
      setServiceError(prev => ({ ...prev, [service]: value }));
    } else if (key === 'scanning') {
      setServiceScanning(prev => ({ ...prev, [service]: value }));
    }
  };

  const fetchS3Data = async () => {
    try {
      updateServiceState('s3', 'loading', true);
      const data = await api.getScans();
      const mapped = (data || []).map(scan => ({
        scanId: scan.scan_id,
        bucketName: scan.bucket,
        riskScore: scan.risk_score,
        riskLevel: scan.severity ? scan.severity.toLowerCase() : (scan.risk_score > 50 ? 'high' : 'low'),
        status: scan.status === 'SECURE' ? 'compliant' : 'non-compliant',
        timestamp: scan.created_at,
      }));
      updateServiceState('s3', 'data', mapped);
      updateServiceState('s3', 'error', null);
    } catch (err) {
      updateServiceState('s3', 'error', 'Failed to load S3 scan data.');
      console.error(err);
    } finally {
      updateServiceState('s3', 'loading', false);
    }
  };

  const fetchEC2Data = async () => {
    try {
      updateServiceState('ec2', 'loading', true);
      const data = await api.getEC2Scans();
      const mapped = (data || []).map(scan => {
        let rawConfig = {};
        try { rawConfig = JSON.parse(scan.raw_config || '{}'); } catch (e) { /* ignore */ }
        return {
          scanId: scan.scan_id,
          instanceId: scan.instance_id,
          instanceType: rawConfig.instance_type || 'N/A',
          instanceState: rawConfig.state || 'unknown',
          riskScore: scan.risk_score,
          riskLevel: scan.severity ? scan.severity.toLowerCase() : (scan.risk_score > 50 ? 'high' : 'low'),
          status: scan.status === 'SECURE' ? 'compliant' : 'non-compliant',
          timestamp: scan.created_at,
        };
      });
      updateServiceState('ec2', 'data', mapped);
      updateServiceState('ec2', 'error', null);
    } catch (err) {
      updateServiceState('ec2', 'error', 'Failed to load EC2 scan data.');
      console.error(err);
    } finally {
      updateServiceState('ec2', 'loading', false);
    }
  };

  const fetchIAMData = async () => {
    try {
      updateServiceState('iam', 'loading', true);
      const data = await api.getIAMScans();
      const mapped = (data || []).map(scan => {
        let rawConfig = {};
        try { rawConfig = JSON.parse(scan.raw_config || '{}'); } catch (e) { /* ignore */ }
        return {
          scanId: scan.scan_id,
          username: scan.username,
          hasAdminAccess: rawConfig.has_admin_access || false,
          passwordLastUsed: rawConfig.password_last_used,
          accessKeyLastUsed: rawConfig.access_key_last_used,
          riskScore: scan.risk_score,
          riskLevel: scan.severity ? scan.severity.toLowerCase() : 'low',
          status: scan.status === 'SECURE' ? 'compliant' : 'non-compliant',
          timestamp: scan.created_at,
        };
      });
      updateServiceState('iam', 'data', mapped);
      updateServiceState('iam', 'error', null);
    } catch (err) {
      updateServiceState('iam', 'error', 'Failed to load IAM scan data.');
      console.error(err);
    } finally {
      updateServiceState('iam', 'loading', false);
    }
  };

  const fetchData = () => {
    if (activeService === 's3') {
      fetchS3Data();
    } else if (activeService === 'ec2') {
      fetchEC2Data();
    } else if (activeService === 'iam') {
      fetchIAMData();
    }
  };

  useEffect(() => {
    setSearchQuery('');
    fetchData();
  }, [activeService]);

  const handleScan = async (e) => {
    e.preventDefault();
    updateServiceState(activeService, 'scanning', true);
    try {
      if (activeService === 's3') {
        if (!searchQuery.trim()) {
          updateServiceState('s3', 'scanning', false);
          return;
        }
        await api.triggerScan(searchQuery);
        toast({ title: "S3 Scan complete", description: `Scanned: ${searchQuery}`, variant: "success" });
      } else if (activeService === 'ec2') {
        await api.triggerEC2Scan(searchQuery.trim() || undefined);
        toast({
          title: "EC2 Scan complete",
          description: searchQuery.trim() ? `Scanned: ${searchQuery}` : "Scanned all running instances",
          variant: "success"
        });
      } else if (activeService === 'iam') {
        await api.triggerIAMScan(searchQuery.trim() || undefined);
        toast({
          title: "IAM Scan complete",
          description: searchQuery.trim() ? `Scanned: ${searchQuery}` : "Scanned all IAM users",
          variant: "success"
        });
      }
      await fetchData();
      setSearchQuery('');
    } catch (err) {
      if (err.response?.status === 403) {
        updateServiceState(activeService, 'error', "Missing AWS Credentials. Please configure your integration in Settings.");
        toast({
          title: "Missing Credentials",
          description: "Please update your AWS Integration under Settings to initiate scans.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Scan failed",
          description: err?.response?.data?.error || err.message || "Error scanning resource",
          variant: "destructive"
        });
      }
    } finally {
      updateServiceState(activeService, 'scanning', false);
    }
  };

  const currentData = serviceData[activeService];
  const totalResources = currentData.length;
  const highRisk = currentData.filter(r => r.riskLevel === 'high' || r.riskLevel === 'critical').length;
  const compliant = currentData.filter(r => r.status === 'compliant').length;
  const resourceLabel = activeService === 's3' ? 'Total Buckets' : activeService === 'ec2' ? 'Total Instances' : 'Total Users';
  const currentLoading = serviceLoading[activeService];
  const currentError = serviceError[activeService];
  const currentScanning = serviceScanning[activeService];

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

        {/* Service Tabs */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0.5}>
          <div className="inline-flex items-center p-1.5 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-lg">
            {SERVICE_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeService === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveService(tab.id)}
                  className={cn(
                    'relative flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300',
                    isActive
                      ? 'text-white shadow-lg'
                      : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="service-tab-bg"
                      className={cn('absolute inset-0 rounded-xl bg-gradient-to-r', tab.accent)}
                      transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                    />
                  )}
                  <Icon className="w-4 h-4 relative z-10" />
                  <span className="relative z-10">{tab.label}</span>
                </button>
              );
            })}
          </div>
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
                placeholder={activeService === 's3' ? 'Enter S3 bucket name to scan...' : activeService === 'ec2' ? 'Enter EC2 Instance ID to scan (or leave empty for all)...' : 'Enter IAM username to scan (or leave empty for all)...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-transparent border-none text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0 text-base rounded-[14px]"
              />
              <div className="pr-2">
                <button type="submit" disabled={currentScanning || (activeService === 's3' && !searchQuery)}
                  className={cn(
                    "px-5 py-2.5 rounded-xl font-semibold text-sm text-white shadow-lg disabled:opacity-50 disabled:shadow-none transition-all duration-300 hover:scale-105 active:scale-95 flex items-center gap-2",
                    activeService === 's3'
                      ? "bg-gradient-to-r from-blue-600 to-cyan-500 shadow-blue-500/25 hover:shadow-blue-500/40"
                      : activeService === 'ec2' ? "bg-gradient-to-r from-orange-500 to-amber-500 shadow-orange-500/25 hover:shadow-orange-500/40" : "bg-gradient-to-r from-purple-500 to-fuchsia-500 shadow-purple-500/25 hover:shadow-purple-500/40"
                  )}>
                  {currentScanning ? (<><RefreshCw className="w-4 h-4 animate-spin" /> Scanning</>) : (<>Scan</>)}
                </button>
              </div>
            </div>
          </div>
        </motion.form>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <StatCard icon={activeService === 's3' ? Shield : activeService === 'ec2' ? Server : Shield} label={resourceLabel} value={totalResources}
            accent={activeService === 's3' ? "bg-gradient-to-br from-blue-500 to-blue-600" : activeService === 'ec2' ? "bg-gradient-to-br from-orange-500 to-amber-600" : "bg-gradient-to-br from-purple-500 to-fuchsia-600"} delay={2} />
          <StatCard icon={AlertTriangle} label="High Risk" value={highRisk} accent="bg-gradient-to-br from-red-500 to-rose-600" delay={3} />
          <StatCard icon={CheckCircle2} label="Compliant" value={compliant} accent="bg-gradient-to-br from-emerald-500 to-green-600" delay={4} />
        </div>

        {/* Table */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={5} className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xl font-bold text-foreground">
              {activeService === 's3' ? 'Active Infrastructure' : activeService === 'ec2' ? 'EC2 Instances' : 'IAM Users'}
            </h2>
            <button onClick={fetchData} disabled={currentLoading}
              className="p-2 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground transition-all hover:rotate-180 duration-500">
              <RefreshCw className={`w-5 h-5 ${currentLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className={`relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-sm overflow-hidden min-h-[400px] transition-all duration-500 ${currentLoading ? 'opacity-80' : 'opacity-100'}`}>
            {currentLoading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10">
                <div className="relative">
                  <div className={cn("w-12 h-12 rounded-full border-4 animate-spin",
                    activeService === 's3' ? "border-blue-500/30 border-t-blue-500" : activeService === 'ec2' ? "border-orange-500/30 border-t-orange-500" : "border-purple-500/30 border-t-purple-500")} />
                  <div className={cn("absolute inset-0 w-12 h-12 rounded-full border-4 animate-spin-reverse",
                    activeService === 's3' ? "border-cyan-400/20 border-b-cyan-400" : activeService === 'ec2' ? "border-amber-400/20 border-b-amber-400" : "border-fuchsia-400/20 border-b-fuchsia-400")} />
                </div>
                <p className="text-sm font-medium text-muted-foreground animate-pulse">Syncing infrastructure...</p>
              </div>
            ) : currentError ? (
              <div className="absolute inset-0 flex items-center justify-center text-center p-6">
                <div className="max-w-md p-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400">
                  <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-80" />
                  <h3 className="font-semibold mb-1">Error Loading Data</h3>
                  <p className="text-sm opacity-90">{currentError}</p>
                </div>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeService}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {activeService === 's3' ? (
                    <BucketTable buckets={serviceData.s3} />
                  ) : activeService === 'ec2' ? (
                    <InstanceTable instances={serviceData.ec2} />
                  ) : (
                    <IAMTable users={serviceData.iam} />
                  )}
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;