import React from 'react';
import { Shield, AlertTriangle, CheckCircle2, Download } from 'lucide-react';

const getRiskColor = (level) => {
    switch (level?.toLowerCase()) {
        case 'critical':
        case 'high': return 'text-red-400 bg-red-400/10 border-red-500/20';
        case 'medium': return 'text-amber-400 bg-amber-400/10 border-amber-500/20';
        case 'low': return 'text-emerald-400 bg-emerald-400/10 border-emerald-500/20';
        default: return 'text-slate-400 bg-slate-400/10 border-slate-500/20';
    }
};

const getStatusColor = (status) => {
    if (status?.toLowerCase() === 'compliant') return 'text-emerald-400 flex items-center gap-1.5';
    return 'text-red-400 flex items-center gap-1.5';
};

const IAMTable = ({ users = [], onDownload }) => {
    if (users.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
                    <Shield className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">No IAM Audits Yet</h3>
                <p className="text-muted-foreground max-w-sm">
                    Run your first IAM Least Privilege scan by entering a username or leaving the field empty to scan all users.
                </p>
            </div>
        );
    }

    return (
        <div className="w-full overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-black/20 text-muted-foreground border-b border-white/5">
                    <tr>
                        <th className="px-6 py-4 font-semibold tracking-wider">Username</th>
                        <th className="px-6 py-4 font-semibold tracking-wider">Admin Access</th>
                        <th className="px-6 py-4 font-semibold tracking-wider">Last Activity</th>
                        <th className="px-6 py-4 font-semibold tracking-wider">Inactive Days</th>
                        <th className="px-6 py-4 font-semibold tracking-wider">Risk Level</th>
                        <th className="px-6 py-4 font-semibold tracking-wider">Compliance</th>
                        <th className="px-6 py-4 font-semibold tracking-wider text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                    {users.map((user, idx) => {
                        const now = new Date();
                        let lastActiveDate = null;

                        if (user.passwordLastUsed && user.accessKeyLastUsed) {
                            const pwdDate = new Date(user.passwordLastUsed);
                            const keyDate = new Date(user.accessKeyLastUsed);
                            lastActiveDate = pwdDate > keyDate ? pwdDate : keyDate;
                        } else if (user.passwordLastUsed) {
                            lastActiveDate = new Date(user.passwordLastUsed);
                        } else if (user.accessKeyLastUsed) {
                            lastActiveDate = new Date(user.accessKeyLastUsed);
                        }

                        let inactiveDays = 'Unknown';
                        let activityString = 'Never';

                        if (lastActiveDate) {
                            inactiveDays = Math.floor((now - lastActiveDate) / (1000 * 60 * 60 * 24));
                            // formatting the date nice
                            activityString = lastActiveDate.toLocaleDateString(undefined, {
                                year: 'numeric', month: 'short', day: 'numeric'
                            });
                        }

                        return (
                            <tr key={user.scanId || idx} className="hover:bg-white/[0.02] transition-colors group">
                                <td className="px-6 py-4">
                                    <span className="font-medium text-foreground">{user.username}</span>
                                </td>

                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        {user.hasAdminAccess ? (
                                            <span className="px-2.5 py-1 rounded-md text-xs font-medium border text-rose-400 bg-rose-400/10 border-rose-500/20">
                                                Yes
                                            </span>
                                        ) : (
                                            <span className="px-2.5 py-1 rounded-md text-xs font-medium border text-slate-400 bg-slate-400/10 border-slate-500/20">
                                                No
                                            </span>
                                        )}
                                    </div>
                                </td>

                                <td className="px-6 py-4">
                                    <span className="text-muted-foreground">{activityString}</span>
                                </td>

                                <td className="px-6 py-4">
                                    <span className={`font-mono ${inactiveDays > 90 ? 'text-amber-400' : 'text-slate-400'}`}>
                                        {inactiveDays}
                                    </span>
                                </td>

                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border uppercase tracking-wider ${getRiskColor(user.riskLevel)}`}>
                                        {user.riskLevel}
                                    </span>
                                </td>

                                <td className="px-6 py-4">
                                    <div className={`font-medium ${getStatusColor(user.status)}`}>
                                        {user.status?.toLowerCase() === 'compliant' ? (
                                            <><CheckCircle2 className="w-4 h-4" /> Secure</>
                                        ) : (
                                            <><AlertTriangle className="w-4 h-4" /> Non-Compliant</>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); if (onDownload) onDownload(user.scanId, 'iam'); }} 
                                        className="p-2 text-muted-foreground hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors" 
                                        title="Download Security Report"
                                    >
                                        <Download className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default IAMTable;
