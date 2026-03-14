import React, { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  Shield, AlertTriangle, Activity, Brain, Target, Zap, Key, Eye,
  ChevronDown, ChevronRight, RefreshCw, TrendingUp, TrendingDown,
  CheckCircle, XCircle, ArrowRight, Layers, Lock, Globe
} from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.5, ease: 'easeOut' } })
};

// ── Severity Badge ──
const SeverityBadge = ({ severity }) => {
  const colors = {
    CRITICAL: 'bg-red-500/15 text-red-400 border-red-500/30',
    HIGH: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    MEDIUM: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    LOW: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  };
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border', colors[severity] || colors.MEDIUM)}>
      {severity}
    </span>
  );
};

// ── Collapsible Section ──
const Section = ({ title, icon: Icon, iconColor, count, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}
      className="bg-card/40 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-5 hover:bg-white/5 transition-colors text-left">
        <div className={cn('p-2 rounded-xl', iconColor)}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-bold text-foreground">{title}</h3>
        </div>
        {count !== undefined && (
          <span className="text-xs font-bold text-muted-foreground bg-white/5 px-2.5 py-1 rounded-full border border-white/10">
            {count}
          </span>
        )}
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }}
            className="border-t border-white/5">
            <div className="p-5 space-y-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ── MITRE Heatmap Cell ──
const MitreCell = ({ technique }) => {
  const isExposed = technique.status === 'EXPOSED';
  return (
    <div className={cn(
      'p-2 rounded-lg border text-xs cursor-help transition-all hover:scale-105',
      isExposed ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
    )} title={`${technique.technique_id}: ${technique.name}\n${isExposed ? technique.findings?.join(', ') || '' : 'Defended'}`}>
      <div className="font-bold truncate">{technique.technique_id}</div>
      <div className="truncate opacity-70">{technique.name}</div>
    </div>
  );
};

// ── Main Page ──
const SecurityInsights = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('executive'); // executive | engineer

  useEffect(() => {
    fetchInsights();
  }, []);

  const fetchInsights = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await api.getSecurityInsights();
      setData(result);
    } catch (err) {
      setError(err.message || 'Failed to load security insights');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] gap-4">
        <div className="relative">
          <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-xl animate-pulse" />
          <RefreshCw className="relative w-12 h-12 text-blue-500 animate-spin" />
        </div>
        <p className="text-muted-foreground text-sm animate-pulse">Running 7 security engines...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] text-center gap-4">
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-bold">Analysis Failed</h2>
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={fetchInsights} variant="outline">Retry</Button>
      </div>
    );
  }

  if (!data) return null;

  const { attack_paths, mitre_simulation, anomalies, toxic_combinations, secrets, privilege_escalation, threat_reasoning, meta } = data;
  const reasoning = threat_reasoning;

  const riskLevelColors = {
    CRITICAL: 'from-red-600 to-red-500',
    HIGH: 'from-orange-600 to-amber-500',
    MEDIUM: 'from-amber-500 to-yellow-500',
    LOW: 'from-emerald-600 to-green-500'
  };

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl shadow-lg shadow-purple-500/20">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Security Insights</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {meta.resources_analyzed.s3 + meta.resources_analyzed.ec2 + meta.resources_analyzed.iam} resources analyzed • {meta.engines_run} engines
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-white/5 rounded-xl border border-white/10 p-1 flex">
            <button onClick={() => setViewMode('executive')}
              className={cn('px-4 py-2 rounded-lg text-xs font-bold transition-all', viewMode === 'executive' ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg' : 'text-muted-foreground hover:text-foreground')}>
              Executive
            </button>
            <button onClick={() => setViewMode('engineer')}
              className={cn('px-4 py-2 rounded-lg text-xs font-bold transition-all', viewMode === 'engineer' ? 'bg-gradient-to-r from-purple-600 to-pink-500 text-white shadow-lg' : 'text-muted-foreground hover:text-foreground')}>
              Engineer
            </button>
          </div>
          <Button onClick={fetchInsights} variant="outline" size="sm" className="border-white/10 gap-2">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
        </div>
      </motion.div>

      {/* Overall Risk Level */}
      <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={1}
        className={cn('bg-gradient-to-r rounded-2xl p-6 shadow-lg', riskLevelColors[reasoning?.technical_analysis?.recommended_remediation_priority?.split(' ')[0].toUpperCase()] || riskLevelColors.MEDIUM)}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/70 text-xs font-bold uppercase tracking-widest mb-1">Overall Threat Level</p>
            <h2 className="text-3xl font-black text-white">{reasoning?.technical_analysis?.recommended_remediation_priority?.split(' ')[0].toUpperCase() || 'UNKNOWN'}</h2>
            <p className="text-white/80 text-sm mt-2 max-w-2xl">{reasoning?.executive_summary?.impact_description}</p>
          </div>
          <div className="hidden md:flex gap-6 text-center">
            <div>
              <p className="text-3xl font-black text-white">{mitre_simulation?.coverage_percent || 0}%</p>
              <p className="text-white/60 text-xs font-medium">ATT&CK Coverage</p>
            </div>
            <div>
              <p className="text-3xl font-black text-white">{attack_paths?.attack_paths?.length || 0}</p>
              <p className="text-white/60 text-xs font-medium">Attack Paths</p>
            </div>
            <div>
              <p className="text-3xl font-black text-white">{anomalies?.anomaly_count || 0}</p>
              <p className="text-white/60 text-xs font-medium">Anomalies</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Quick Stats */}
      <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={2}
        className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Attack Paths', value: attack_paths?.attack_paths?.length || 0, icon: Zap, color: 'text-red-400 bg-red-500/10' },
          { label: 'Toxic Combos', value: toxic_combinations?.total_found || 0, icon: Layers, color: 'text-orange-400 bg-orange-500/10' },
          { label: 'Anomalies', value: anomalies?.anomalies?.length || 0, icon: Activity, color: 'text-purple-400 bg-purple-500/10' },
          { label: 'Secrets Found', value: secrets?.total_found || 0, icon: Key, color: 'text-amber-400 bg-amber-500/10' },
          { label: 'Priv. Escalation', value: privilege_escalation?.length || 0, icon: TrendingUp, color: 'text-cyan-400 bg-cyan-500/10' },
        ].map(stat => (
          <div key={stat.label} className="bg-card/40 backdrop-blur-sm rounded-xl border border-white/10 p-4 flex items-center gap-3">
            <div className={cn('p-2 rounded-lg', stat.color)}>
              <stat.icon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-2xl font-black text-foreground">{stat.value}</p>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</p>
            </div>
          </div>
        ))}
      </motion.div>

      {/* AI Threat Reasoning — Executive Brief */}
      {viewMode === 'executive' && reasoning?.executive_summary && (
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={3}
          className="bg-card/40 backdrop-blur-md rounded-2xl border border-white/10 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400"><Brain className="w-5 h-5" /></div>
            <h3 className="text-base font-bold text-foreground">AI Threat Briefing</h3>
            <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20 uppercase tracking-wider">Executive</span>
          </div>
          <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
            <p>{reasoning.executive_summary.business_explanation}</p>
            <p className="text-emerald-400">{reasoning.executive_summary.impact_description}</p>
          </div>
        </motion.div>
      )}

      {/* Priority Actions */}
      {reasoning?.priority_actions?.length > 0 && (
        <Section title="Priority Actions" icon={Target} iconColor="bg-red-500/10 text-red-400"
          count={reasoning.priority_actions.length} defaultOpen={true}>
          <div className="space-y-2">
            {reasoning.priority_actions.map((action, idx) => (
              <div key={idx} className={cn(
                'flex items-start gap-4 p-4 rounded-xl border',
                action.urgency === 'IMMEDIATE' ? 'bg-red-500/5 border-red-500/15' :
                  action.urgency === 'HIGH' ? 'bg-orange-500/5 border-orange-500/15' :
                    'bg-white/5 border-white/10'
              )}>
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0',
                  action.urgency === 'IMMEDIATE' ? 'bg-red-500/20 text-red-400' :
                    action.urgency === 'HIGH' ? 'bg-orange-500/20 text-orange-400' :
                      'bg-white/10 text-muted-foreground'
                )}>{action.priority}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{action.action}</p>
                  <p className="text-xs text-muted-foreground mt-1">{action.reason}</p>
                  <p className="text-xs text-emerald-400 mt-1">{action.risk_reduction}</p>
                </div>
                <span className={cn(
                  'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border flex-shrink-0',
                  action.urgency === 'IMMEDIATE' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                    action.urgency === 'HIGH' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                      'bg-blue-500/10 text-blue-400 border-blue-500/20'
                )}>{action.urgency}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* MITRE ATT&CK Simulation */}
      {mitre_simulation && (
        <Section title={`MITRE ATT&CK Coverage — ${mitre_simulation.coverage_percent}%`}
          icon={Target} iconColor="bg-purple-500/10 text-purple-400"
          count={`${mitre_simulation.blocked}/${mitre_simulation.total} defended`} defaultOpen={viewMode === 'engineer'}>
          {/* Coverage bar */}
          <div className="mb-4">
            <div className="flex justify-between text-xs mb-2">
              <span className="text-muted-foreground">Defense Coverage</span>
              <span className="font-bold text-foreground">{mitre_simulation.coverage_percent}%</span>
            </div>
            <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
              <div className={cn('h-full rounded-full transition-all duration-1000',
                mitre_simulation.coverage_percent >= 75 ? 'bg-gradient-to-r from-emerald-500 to-green-400' :
                  mitre_simulation.coverage_percent >= 50 ? 'bg-gradient-to-r from-amber-500 to-yellow-400' :
                    'bg-gradient-to-r from-red-500 to-orange-400'
              )} style={{ width: `${mitre_simulation.coverage_percent}%` }} />
            </div>
          </div>

          {/* Tactic breakdown */}
          {mitre_simulation.by_tactic && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
              {Object.entries(mitre_simulation.by_tactic).map(([tactic, counts]) => (
                <div key={tactic} className="bg-white/5 rounded-lg border border-white/5 p-3">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate">{tactic}</p>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-lg font-black text-foreground">{counts.blocked}</span>
                    <span className="text-xs text-muted-foreground">/{counts.total}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Technique grid */}
          {mitre_simulation.techniques && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {mitre_simulation.techniques.map(t => <MitreCell key={t.technique_id} technique={t} />)}
            </div>
          )}
        </Section>
      )}

      {/* Attack Paths */}
      {attack_paths?.attack_paths?.length > 0 && (
        <Section title="Attack Path Analysis" icon={Zap} iconColor="bg-red-500/10 text-red-400"
          count={attack_paths.attack_paths.length} defaultOpen={viewMode === 'engineer'}>
          {attack_paths.attack_paths.slice(0, 6).map((path, idx) => (
            <div key={path.path_id || idx} className="bg-white/5 rounded-xl border border-white/10 p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="text-sm font-bold text-foreground">{path.name}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">{path.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground bg-white/10 px-2 py-0.5 rounded-full">
                    Score: {path.exploitability_score}
                  </span>
                  <SeverityBadge severity={path.severity} />
                </div>
              </div>
              {/* Hop chain */}
              <div className="flex flex-wrap items-center gap-1 mb-3">
                {path.hops.map((hop, hIdx) => (
                  <React.Fragment key={hIdx}>
                    {hIdx > 0 && <ArrowRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
                    <div className={cn(
                      'px-2.5 py-1 rounded-lg text-xs font-medium border',
                      hop.type === 'INTERNET' || hop.type === 'ATTACK_VECTOR' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                        hop.type === 'S3' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                          hop.type === 'EC2' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                            hop.type === 'IAM_ROLE' || hop.type === 'IAM_USER' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                              'bg-white/10 text-foreground border-white/10'
                    )}>
                      {hop.resource}
                    </div>
                  </React.Fragment>
                ))}
              </div>
              {/* Fix steps */}
              {path.fix_steps?.length > 0 && (
                <div className="bg-emerald-500/5 rounded-lg border border-emerald-500/10 p-3">
                  <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1">Fix Steps</p>
                  {path.fix_steps.map((step, sIdx) => (
                    <p key={sIdx} className="text-xs text-muted-foreground">• {step}</p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </Section>
      )}

      {/* Toxic Combinations */}
      {toxic_combinations?.combinations?.length > 0 && (
        <Section title="Toxic Combinations" icon={Layers} iconColor="bg-orange-500/10 text-orange-400"
          count={toxic_combinations.total_found}>
          {toxic_combinations.combinations.map((combo, idx) => (
            <div key={combo.id || idx} className="bg-white/5 rounded-xl border border-white/10 p-4">
              <div className="flex items-start justify-between mb-2">
                <h4 className="text-sm font-bold text-foreground">{combo.name}</h4>
                <div className="flex gap-2">
                  <span className="text-[10px] text-muted-foreground bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                    Individual: {combo.individual_severity}
                  </span>
                  <SeverityBadge severity={combo.combined_severity} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mb-3">{combo.description}</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {combo.components.map((comp, cIdx) => (
                  <div key={cIdx} className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs">
                    <span className="font-semibold text-foreground">{comp.resource}:</span>{' '}
                    <span className="text-muted-foreground">{comp.issue}</span>
                  </div>
                ))}
              </div>
              <div className="bg-emerald-500/5 rounded-lg border border-emerald-500/10 p-2">
                <p className="text-xs text-emerald-400"><strong>Fix:</strong> {combo.remediation}</p>
              </div>
            </div>
          ))}
        </Section>
      )}

      {/* Anomalies */}
      {anomalies?.anomalies?.length > 0 && (
        <Section title="Behavioral Anomalies" icon={Activity} iconColor="bg-purple-500/10 text-purple-400"
          count={anomalies.anomalies.length}>
          {anomalies.anomalies.slice(0, 8).map((anomaly, idx) => (
            <div key={idx} className="flex items-start gap-4 bg-white/5 rounded-xl border border-white/10 p-4">
              <div className={cn(
                'p-2 rounded-lg flex-shrink-0',
                anomaly.severity === 'HIGH' ? 'bg-red-500/10 text-red-400' :
                  anomaly.severity === 'MEDIUM' ? 'bg-amber-500/10 text-amber-400' :
                    'bg-blue-500/10 text-blue-400'
              )}>
                <Eye className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-sm font-bold text-foreground">{anomaly.type.replace(/_/g, ' ')}</h4>
                  <SeverityBadge severity={anomaly.severity} />
                  <span className="text-[10px] text-muted-foreground bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
                    {anomaly.confidence}% confidence
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{anomaly.description}</p>
                {anomaly.indicators?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {anomaly.indicators.map((ind, iIdx) => (
                      <span key={iIdx} className="text-[10px] bg-white/5 border border-white/5 px-2 py-0.5 rounded text-muted-foreground">{ind}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </Section>
      )}

      {/* Secrets */}
      {secrets?.secrets?.length > 0 && (
        <Section title="Exposed Secrets" icon={Key} iconColor="bg-amber-500/10 text-amber-400"
          count={secrets.total_found}>
          {secrets.secrets.slice(0, 8).map((secret, idx) => (
            <div key={idx} className="flex items-start gap-4 bg-white/5 rounded-xl border border-white/10 p-4">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 flex-shrink-0">
                <Lock className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-sm font-bold text-foreground">{secret.type}</h4>
                  <SeverityBadge severity={secret.severity} />
                </div>
                <p className="text-xs text-muted-foreground">
                  <span className="text-foreground font-medium">{secret.resource}</span> ({secret.service})
                </p>
                <code className="text-[11px] text-amber-400/80 bg-amber-500/5 px-2 py-0.5 rounded mt-1 inline-block font-mono">
                  {secret.masked_value}
                </code>
                <p className="text-xs text-muted-foreground mt-1">{secret.remediation}</p>
              </div>
            </div>
          ))}
        </Section>
      )}

      {/* Privilege Escalation */}
      {privilege_escalation?.length > 0 && (
        <Section title="Privilege Escalation Vectors" icon={TrendingUp} iconColor="bg-cyan-500/10 text-cyan-400"
          count={privilege_escalation.length}>
          {privilege_escalation.slice(0, 6).map((pe, idx) => (
            <div key={idx} className="bg-white/5 rounded-xl border border-white/10 p-4">
              <div className="flex items-start justify-between mb-2">
                <h4 className="text-sm font-bold text-foreground">{pe.title || pe.vector}</h4>
                <SeverityBadge severity={pe.severity} />
              </div>
              <p className="text-xs text-muted-foreground mb-2">{pe.description}</p>
              {pe.exploit_steps?.length > 0 && (
                <div className="bg-red-500/5 rounded-lg border border-red-500/10 p-3">
                  <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-1">Exploit Steps</p>
                  {pe.exploit_steps.map((step, sIdx) => (
                    <p key={sIdx} className="text-xs text-muted-foreground">{sIdx + 1}. {step}</p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </Section>
      )}

      {/* Engineer Mode: Technical Deep-Dive */}
      {viewMode === 'engineer' && reasoning?.technical_analysis && (
        <Section title="AI Technical Deep-Dive" icon={Brain} iconColor="bg-pink-500/10 text-pink-400"
          count={`Technical Analysis`} defaultOpen={true}>
          <div className="bg-white/5 rounded-xl border border-white/10 p-4">
            <h4 className="text-sm font-bold text-foreground mb-3"><Brain className="inline w-4 h-4 mr-2" /> Attack Chain Analysis</h4>
            <div className="space-y-2">
              <div className="bg-white/5 rounded-lg border border-white/5 p-3">
                 <p className="text-xs text-muted-foreground font-mono">{reasoning.technical_analysis.attack_chain_explanation}</p>
              </div>
            </div>
          </div>
          <div className="bg-white/5 rounded-xl border border-white/10 p-4 mt-4">
            <h4 className="text-sm font-bold text-foreground mb-3"><Target className="inline w-4 h-4 mr-2" /> Exploited Vulnerabilities</h4>
            <div className="space-y-2">
              {reasoning.technical_analysis.exploited_vulnerabilities?.map((vuln, idx) => (
                <div key={idx} className="bg-white/5 rounded-lg border border-white/5 p-3">
                   <p className="text-xs text-muted-foreground">• {vuln}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white/5 rounded-xl border border-white/10 p-4 mt-4">
            <h4 className="text-sm font-bold text-foreground mb-3"><Activity className="inline w-4 h-4 mr-2" /> Recommended Remediation Priority</h4>
            <div className="bg-emerald-500/5 rounded-lg border border-emerald-500/10 p-3">
              <p className="text-xs text-emerald-400 font-bold">{reasoning.technical_analysis.recommended_remediation_priority}</p>
            </div>
          </div>
        </Section>
      )}

      {/* Footer */}
      <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={6}
        className="text-center text-xs text-muted-foreground pt-4">
        Generated at {new Date(meta.generated_at).toLocaleString()} • {meta.engines_run} engines •{' '}
        {meta.resources_analyzed.s3} S3, {meta.resources_analyzed.ec2} EC2, {meta.resources_analyzed.iam} IAM resources
      </motion.div>
    </div>
  );
};

export default SecurityInsights;
