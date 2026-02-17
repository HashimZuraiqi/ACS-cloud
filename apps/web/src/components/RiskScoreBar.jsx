import React from 'react';
import { cn } from '@/lib/utils';

const RiskScoreBar = ({ score, showLabel = true, className }) => {
  const clampedScore = Math.max(0, Math.min(100, score));
  const getGradientColor = (s) => { if (s >= 80) return 'from-red-500 to-rose-600'; if (s >= 40) return 'from-amber-400 to-orange-500'; return 'from-emerald-400 to-green-500'; };
  const getRiskLabel = (s) => { if (s >= 80) return 'High Risk'; if (s >= 40) return 'Medium Risk'; return 'Low Risk'; };

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-muted-foreground">Risk Score</span>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-foreground">{clampedScore}</span>
          {showLabel && (
            <span className={cn('text-xs font-semibold px-2 py-0.5 rounded border',
              clampedScore >= 80 ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                clampedScore >= 40 ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' :
                  'bg-emerald-500/10 text-emerald-500 border-emerald-500/20')}>
              {getRiskLabel(clampedScore)}
            </span>
          )}
        </div>
      </div>
      <div className="relative w-full h-3 bg-white/10 rounded-full overflow-hidden backdrop-blur-sm">
        <div className={cn('h-full bg-gradient-to-r transition-all duration-1000 ease-out shadow-lg', getGradientColor(clampedScore))} style={{ width: clampedScore + '%' }} />
      </div>
      <div className="flex justify-between mt-1 text-xs text-muted-foreground/60 font-medium"><span>0</span><span>50</span><span>100</span></div>
    </div>
  );
};
export default RiskScoreBar;
