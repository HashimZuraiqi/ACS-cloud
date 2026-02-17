import React from 'react';
import { Brain, TrendingUp, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
const ExplanationCard = ({ analysis, className }) => {
  const { explanation, confidence, evidence } = analysis;
  return (
    <div className={cn('bg-white rounded-lg shadow-md border border-gray-200', className)}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2"><div className="p-2 bg-blue-100 rounded-lg"><Brain className="w-5 h-5 text-blue-600" /></div><h3 className="text-lg font-semibold text-gray-900">AI Risk Analysis</h3></div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-full"><TrendingUp className="w-4 h-4 text-blue-600" /><span className="text-sm font-medium text-blue-700">{confidence}% Confidence</span></div>
        </div>
        <div className="mb-6"><p className="text-gray-700 leading-relaxed">{explanation}</p></div>
        {evidence && evidence.length > 0 && (
          <div><div className="flex items-center gap-2 mb-3"><AlertCircle className="w-4 h-4 text-gray-600" /><h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Evidence</h4></div>
            <ul className="space-y-2">{evidence.map((item, index) => (<li key={index} className="flex items-start gap-3"><div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" /><span className="text-sm text-gray-600 leading-relaxed">{item}</span></li>))}</ul>
          </div>
        )}
      </div>
      <div className="px-6 pb-4"><div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden"><div className={cn('h-full bg-gradient-to-r transition-all duration-500', confidence >= 90 ? 'from-green-500 to-green-600' : confidence >= 70 ? 'from-blue-500 to-blue-600' : 'from-yellow-500 to-yellow-600')} style={{ width: confidence + '%' }} /></div></div>
    </div>
  );
};
export default ExplanationCard;
