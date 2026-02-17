import React from 'react';
import { cn } from '@/lib/utils';
const RiskScoreBar = ({ score, showLabel = true, className }) => {
  const clampedScore = Math.max(0, Math.min(100, score));
  const getGradientColor = (s) => { if (s >= 80) return 'from-red-500 to-red-600'; if (s >= 40) return 'from-yellow-500 to-yellow-600'; return 'from-green-500 to-green-600'; };
  const getRiskLabel = (s) => { if (s >= 80) return 'High Risk'; if (s >= 40) return 'Medium Risk'; return 'Low Risk'; };
  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">Risk Score</span>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-gray-900">{clampedScore}</span>
          {showLabel && (<span className={cn('text-xs font-semibold px-2 py-0.5 rounded', clampedScore >= 80 ? 'bg-red-100 text-red-800' : clampedScore >= 40 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800')}>{getRiskLabel(clampedScore)}</span>)}
        </div>
      </div>
      <div className="relative w-full h-3 bg-gray-200 rounded-full overflow-hidden">
        <div className={cn('h-full bg-gradient-to-r transition-all duration-500 ease-out', getGradientColor(clampedScore))} style={{ width: clampedScore + '%' }} />
      </div>
      <div className="flex justify-between mt-1 text-xs text-gray-500"><span>0</span><span>50</span><span>100</span></div>
    </div>
  );
};
export default RiskScoreBar;
