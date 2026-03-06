import React from 'react';
import { AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
const RiskBadge = ({ riskScore, riskLevel, className }) => {
  const rawLevel = riskLevel ? riskLevel.toLowerCase() : (riskScore > 80 ? 'critical' : riskScore > 60 ? 'high' : riskScore >= 40 ? 'medium' : 'low');
  const level = rawLevel === 'critical' ? 'critical' : rawLevel === 'high' ? 'high' : rawLevel === 'medium' ? 'medium' : 'low';
  const variants = {
    critical: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300', icon: AlertTriangle, label: 'Critical Risk' },
    high: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300', icon: AlertTriangle, label: 'High Risk' },
    medium: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300', icon: AlertCircle, label: 'Medium Risk' },
    low: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300', icon: CheckCircle, label: 'Low Risk' }
  };
  const variant = variants[level] || variants.medium;
  const Icon = variant.icon;
  return (<div className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border font-medium text-sm', variant.bg, variant.text, variant.border, className)}><Icon className="w-4 h-4" /><span>{variant.label}</span></div>);
};
export default RiskBadge;
