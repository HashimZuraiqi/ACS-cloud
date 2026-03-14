import React, { useState } from 'react';
import { Wrench, ChevronDown, ChevronRight, Terminal, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
const RemediationPlan = ({ actions, planStatus, className }) => {
  const [expandedActions, setExpandedActions] = useState(new Set());
  const [copiedCommand, setCopiedCommand] = useState(null);
  
  const toggleAction = (id) => { const s = new Set(expandedActions); if (s.has(id)) s.delete(id); else s.add(id); setExpandedActions(s); };
  const copyCommand = (cmd, id) => { navigator.clipboard.writeText(cmd); setCopiedCommand(id); setTimeout(() => setCopiedCommand(null), 2000); };
  
  const getBadgeStyle = (decision) => {
    if (decision === 'AUTO_FIX') return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    if (decision === 'MANUAL_REVIEW') return 'bg-amber-100 text-amber-800 border-amber-300';
    if (decision === 'ASSISTED_FIX') return 'bg-indigo-100 text-indigo-800 border-indigo-300';
    return 'bg-blue-100 text-blue-800 border-blue-300';
  };

  if (!actions || actions.length === 0) return (<div className={cn('bg-green-50 rounded-lg border border-green-200 p-6', className)}><div className="flex items-center gap-3"><div className="p-2 bg-green-100 rounded-lg"><Check className="w-6 h-6 text-green-600" /></div><div><h3 className="text-lg font-semibold text-green-900">No Actions Required</h3><p className="text-sm text-green-700 mt-1">This resource meets all security requirements.</p></div></div></div>);

  return (
    <div className={cn('bg-card/40 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden', className)}>
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className={`p-2 rounded-lg ${['MANUAL_REVIEW_ONLY', 'ASSISTED_FIX_ONLY', 'BLOCKED'].includes(planStatus) ? 'bg-amber-500/10' : 'bg-orange-500/10'}`}>
            <Wrench className={`w-5 h-5 ${['MANUAL_REVIEW_ONLY', 'ASSISTED_FIX_ONLY', 'BLOCKED'].includes(planStatus) ? 'text-amber-500' : 'text-orange-500'}`} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              {planStatus === 'MANUAL_REVIEW_ONLY' ? 'Manual Recommendations Only' : planStatus === 'ASSISTED_FIX_ONLY' ? 'Generate Fix Scripts' : planStatus === 'BLOCKED' ? 'Manual Recommendations Remaining' : 'Remediation Plan'}
            </h3>
            <p className="text-sm text-muted-foreground">{actions.length} finding{actions.length !== 1 ? 's' : ''} reported</p>
          </div>
        </div>
        
        {['MANUAL_REVIEW_ONLY', 'ASSISTED_FIX_ONLY', 'BLOCKED'].includes(planStatus) && (
          <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <p className="text-sm text-amber-400 font-medium whitespace-pre-line">
              Remaining items require manual review. Automatic fixes have been applied.
            </p>
          </div>
        )}

        <div className="space-y-3">
          {actions.map((action, index) => {
            const uniqueId = action.rule_id || `act-${index}`;
            const isExpanded = expandedActions.has(uniqueId); 
            const isCopied = copiedCommand === uniqueId; 
            const ui = action.ui_display || {};

            return (
              <div key={uniqueId} className="border border-white/10 rounded-xl overflow-hidden hover:border-white/20 transition-colors bg-white/5">
                <button onClick={() => toggleAction(uniqueId)} className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-3"><div className="flex items-center justify-center w-6 h-6 rounded-full bg-white/10 border border-white/20 text-xs font-bold text-muted-foreground">{index + 1}</div>
                    <div className="text-left flex items-center gap-4">
                      <h4 className="font-semibold text-foreground">{action.title}</h4>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full border font-bold tracking-wide uppercase', getBadgeStyle(action.decision))}>
                        {ui.label || action.decision}
                      </span>
                    </div>
                  </div>
                  {isExpanded ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
                </button>
                {isExpanded && (
                  <div className="p-4 bg-black/20 border-t border-white/10">
                    <p className="text-sm font-medium text-blue-400 mb-2">{ui.action_text || action.description}</p>
                    <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{action.reasoning || ui.reasoning_text}</p>
                    
                    {action.assisted_fix && action.decision === 'ASSISTED_FIX' && (
                        <div className="mt-4 space-y-4">
                            {action.assisted_fix.cli && (
                                <div className="bg-black/50 rounded-lg p-4 border border-white/5 relative group">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-mono text-zinc-400 flex items-center gap-2"><Terminal className="w-3 h-3" /> AWS CLI</span>
                                        <button onClick={() => copyCommand(action.assisted_fix.cli, uniqueId + 'cli')} className="text-zinc-500 hover:text-white transition-colors">
                                            {copiedCommand === (uniqueId + 'cli') ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    <pre className="text-xs text-zinc-300 overflow-x-auto whitespace-pre-wrap font-mono">{action.assisted_fix.cli}</pre>
                                </div>
                            )}
                            {action.assisted_fix.terraform && (
                                <div className="bg-black/50 rounded-lg p-4 border border-white/5 relative group">
                                     <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-mono text-zinc-400">Terraform</span>
                                        <button onClick={() => copyCommand(action.assisted_fix.terraform, uniqueId + 'tf')} className="text-zinc-500 hover:text-white transition-colors">
                                            {copiedCommand === (uniqueId + 'tf') ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    <pre className="text-xs text-zinc-300 overflow-x-auto whitespace-pre-wrap font-mono">{action.assisted_fix.terraform}</pre>
                                </div>
                            )}
                            {action.assisted_fix.verification && (
                                <div className="bg-blue-900/20 border border-blue-500/20 rounded-lg p-4">
                                     <h5 className="text-xs font-semibold text-blue-400 mb-2">Verification Steps</h5>
                                     <p className="text-xs text-blue-100/70 whitespace-pre-line">{action.assisted_fix.verification}</p>
                                </div>
                            )}
                        </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
export default RemediationPlan;
