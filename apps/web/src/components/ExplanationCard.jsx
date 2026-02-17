import React from 'react';
import { Brain, TrendingUp, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
const ExplanationCard = ({ analysis, className }) => {
  const { explanation, confidence, evidence } = analysis;
  return (
    <div className={cn('bg-card/40 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden', className)}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
              <Brain className="w-5 h-5 text-blue-500" />
            </div>
            <h3 className="text-lg font-bold text-foreground">AI Risk Analysis</h3>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 rounded-full border border-blue-500/20">
            <TrendingUp className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium text-blue-300">{confidence}% Confidence</span>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-muted-foreground leading-relaxed text-sm">{explanation}</p>
        </div>

        {evidence && evidence.length > 0 && (
          <div className="bg-white/5 rounded-lg p-4 border border-white/5">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-4 h-4 text-muted-foreground" />
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Evidence</h4>
            </div>
            <ul className="space-y-2">
              {evidence.map((item, index) => (
                <li key={index} className="flex items-start gap-3">
                  <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)] flex-shrink-0" />
                  <span className="text-sm text-muted-foreground leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Confidence Bar */}
      <div className="px-6 pb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-medium text-muted-foreground">Confidence Score</span>
          <span className="text-xs font-bold text-foreground">{confidence}%</span>
        </div>
        <div className="relative w-full h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className={cn('h-full bg-gradient-to-r transition-all duration-1000 shadow-[0_0_10px_rgba(59,130,246,0.5)]',
              confidence >= 90 ? 'from-emerald-500 to-green-400' :
                confidence >= 70 ? 'from-blue-500 to-cyan-400' :
                  'from-amber-500 to-orange-400'
            )}
            style={{ width: confidence + '%' }}
          />
        </div>
      </div>
    </div>
  );
};
export default ExplanationCard;
