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
    if (decision === 'SUGGEST_FIX') return 'bg-amber-100 text-amber-800 border-amber-300';
    return 'bg-blue-100 text-blue-800 border-blue-300';
  };

  if (!actions || actions.length === 0) return (<div className={cn('bg-green-50 rounded-lg border border-green-200 p-6', className)}><div className="flex items-center gap-3"><div className="p-2 bg-green-100 rounded-lg"><Check className="w-6 h-6 text-green-600" /></div><div><h3 className="text-lg font-semibold text-green-900">No Actions Required</h3><p className="text-sm text-green-700 mt-1">This resource meets all security requirements.</p></div></div></div>);

  return (
    <div className={cn('bg-card/40 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden', className)}>
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className={`p-2 rounded-lg ${planStatus === 'BLOCKED' ? 'bg-amber-500/10' : 'bg-orange-500/10'}`}>
            <Wrench className={`w-5 h-5 ${planStatus === 'BLOCKED' ? 'text-amber-500' : 'text-orange-500'}`} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              {planStatus === 'BLOCKED' ? 'Manual Recommendations Remaining' : 'Remediation Plan'}
            </h3>
            <p className="text-sm text-muted-foreground">{actions.length} finding{actions.length !== 1 ? 's' : ''} reported</p>
          </div>
        </div>
        
        {planStatus === 'BLOCKED' && (
          <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <p className="text-sm text-amber-400 font-medium whitespace-pre-line">
              No further automated fixes can be safely applied without potentially increasing the overall risk score (e.g. inflating base severities). The remaining items listed are manual recommendations requiring review.
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
                    <p className="text-sm font-medium text-blue-400 mb-2">{ui.action_text}</p>
                    <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{action.reasoning || ui.reasoning_text}</p>
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
