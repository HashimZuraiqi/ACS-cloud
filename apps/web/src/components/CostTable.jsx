import React from 'react';
import { Server, HardDrive, DollarSign, Clock, ArrowRight, TrendingDown, Download } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const CostTable = ({ resources, onDownload }) => {
    if (!resources || resources.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center text-center py-20 px-4">
                <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-6 border border-emerald-500/20">
                    <TrendingDown className="w-10 h-10 text-emerald-500" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">No Wasted Resources Detected</h3>
                <p className="text-muted-foreground max-w-sm mx-auto">
                    Your AWS account environments are optimized. Use the scan button to check again later.
                </p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead>
                    <tr className="border-b border-white/10 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        <th className="px-6 py-4 pl-8">Resource</th>
                        <th className="px-6 py-4">Region</th>
                        <th className="px-6 py-4">Details</th>
                        <th className="px-6 py-4">Monthly Cost</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-right pr-8">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                    {resources.map((resource, index) => {
                        const isEC2 = resource.resourceType === 'EC2 Instance';
                        return (
                        <motion.tr
                            key={resource.resourceId + index}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 + 0.2 }}
                            className="group hover:bg-white/[0.03] transition-colors cursor-pointer"
                        >
                            <td className="px-6 py-5 pl-8">
                                <div className="flex items-center gap-3">
                                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                                        isEC2 ? "bg-orange-500/10 text-orange-400" : "bg-purple-500/10 text-purple-400"
                                    )}>
                                        {isEC2 ? <Server className="w-4 h-4" /> : <HardDrive className="w-4 h-4" />}
                                    </div>
                                    <div>
                                        <span className="font-semibold text-foreground group-hover:text-blue-400 transition-colors text-base block mb-0.5">
                                            {resource.resourceId}
                                        </span>
                                        <span className="text-xs text-muted-foreground">{resource.resourceType}</span>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-5">
                                <span className="text-xs font-medium text-muted-foreground bg-white/5 px-2.5 py-1 rounded-full border border-white/5">
                                    {resource.region}
                                </span>
                            </td>
                            <td className="px-6 py-5">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Clock className="w-3.5 h-3.5 opacity-70" />
                                    <span>{resource.details}</span>
                                </div>
                            </td>
                            <td className="px-6 py-5">
                                <div className="flex items-center gap-1.5 font-bold text-red-400">
                                    <DollarSign className="w-4 h-4" />
                                    <span>{resource.estimatedCost}</span>
                                </div>
                            </td>
                            <td className="px-6 py-5">
                                <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-red-500/10 text-red-500 border border-red-500/20 w-fit">
                                    <span className="font-medium text-xs">{resource.status}</span>
                                </div>
                            </td>
                            <td className="px-6 py-5 text-right pr-8">
                                <button
                                    onClick={(e) => { e.stopPropagation(); if (onDownload) onDownload(resource.scanId, 'cost'); }}
                                    className="group/btn relative inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 hover:text-blue-300 transition-all active:scale-95"
                                    title="Download Cost Report"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    Report
                                </button>
                            </td>
                        </motion.tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default CostTable;
