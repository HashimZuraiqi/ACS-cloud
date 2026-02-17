import React, { useState } from 'react';
import { Wrench, ChevronDown, ChevronRight, Terminal, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
const RemediationPlan = ({ actions, className }) => {
  const [expandedActions, setExpandedActions] = useState(new Set());
  const [copiedCommand, setCopiedCommand] = useState(null);
  const toggleAction = (id) => { const s = new Set(expandedActions); if (s.has(id)) s.delete(id); else s.add(id); setExpandedActions(s); };
  const copyCommand = (cmd, id) => { navigator.clipboard.writeText(cmd); setCopiedCommand(id); setTimeout(() => setCopiedCommand(null), 2000); };
  const getPriorityColor = (p) => { if (p === 1) return 'bg-red-100 text-red-800 border-red-300'; if (p === 2) return 'bg-orange-100 text-orange-800 border-orange-300'; return 'bg-yellow-100 text-yellow-800 border-yellow-300'; };
  if (!actions || actions.length === 0) return (<div className={cn('bg-green-50 rounded-lg border border-green-200 p-6', className)}><div className="flex items-center gap-3"><div className="p-2 bg-green-100 rounded-lg"><Check className="w-6 h-6 text-green-600" /></div><div><h3 className="text-lg font-semibold text-green-900">No Actions Required</h3><p className="text-sm text-green-700 mt-1">This bucket meets all security requirements.</p></div></div></div>);
  return (
    <div className={cn('bg-card/40 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden', className)}>
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6"><div className="p-2 bg-orange-500/10 rounded-lg"><Wrench className="w-5 h-5 text-orange-500" /></div><div><h3 className="text-lg font-semibold text-foreground">Recommended Fix</h3><p className="text-sm text-muted-foreground">{actions.length} action{actions.length !== 1 ? 's' : ''} required</p></div></div>
        <div className="space-y-3">
          {actions.map((action, index) => {
            const isExpanded = expandedActions.has(action.id); const isCopied = copiedCommand === action.id; return (
              <div key={action.id} className="border border-white/10 rounded-xl overflow-hidden hover:border-white/20 transition-colors bg-white/5">
                <button onClick={() => toggleAction(action.id)} className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-3"><div className="flex items-center justify-center w-6 h-6 rounded-full bg-white/10 border border-white/20 text-xs font-bold text-muted-foreground">{index + 1}</div><div className="text-left"><h4 className="font-semibold text-foreground">{action.title}</h4><span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium bg-opacity-10', getPriorityColor(action.priority))}>Priority {action.priority}</span></div></div>
                  {isExpanded ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
                </button>
                {isExpanded && (<div className="p-4 bg-black/20 border-t border-white/10"><p className="text-sm text-muted-foreground mb-4 leading-relaxed">{action.description}</p>{action.command && (<div className="mt-4"><div className="flex items-center gap-2 mb-2"><Terminal className="w-4 h-4 text-muted-foreground" /><span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">CLI Command</span></div><div className="relative group"><pre className="bg-black/50 text-blue-300 p-4 rounded-lg overflow-x-auto text-xs font-mono border border-white/5">{action.command}</pre><button onClick={() => copyCommand(action.command, action.id)} className="absolute top-2 right-2 p-2 bg-white/10 hover:bg-white/20 rounded-md transition-colors opacity-0 group-hover:opacity-100">{isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-muted-foreground" />}</button></div></div>)}</div>)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
export default RemediationPlan;
