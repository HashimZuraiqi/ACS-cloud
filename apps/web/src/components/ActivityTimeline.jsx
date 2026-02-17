import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, AlertCircle, Clock, User } from 'lucide-react';
import { cn } from '@/lib/utils';
const ActivityTimeline = ({ activities }) => {
  if (!activities || activities.length === 0) return (<div className="text-center py-12"><p className="text-gray-500">No activity history found.</p></div>);
  const getStatusIcon = (status) => { switch (status) { case 'success': case 'completed': return <CheckCircle className="w-5 h-5 text-white" />; case 'failed': return <XCircle className="w-5 h-5 text-white" />; default: return <AlertCircle className="w-5 h-5 text-white" />; } };
  const getStatusColor = (status) => { switch (status) { case 'success': case 'completed': return 'bg-green-500 ring-green-100'; case 'failed': return 'bg-red-500 ring-red-100'; default: return 'bg-yellow-500 ring-yellow-100'; } };
  return (
    <div className="relative pl-8 space-y-8 before:absolute before:inset-0 before:ml-3.5 before:h-full before:w-0.5 before:-translate-x-1/2 before:bg-white/10">
      {activities.map((activity, index) => (
        <motion.div key={activity.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.1 }} className="relative">
          <div className={cn('absolute -left-8 top-1 flex h-7 w-7 items-center justify-center rounded-full ring-4 ring-card', getStatusColor(activity.status))}>{getStatusIcon(activity.status)}</div>
          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-5 hover:bg-white/10 transition-colors">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
              <div><h4 className="text-base font-semibold text-foreground">{activity.action}</h4><p className="text-sm font-medium text-blue-400 mt-0.5">{activity.bucketName}</p></div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-white/5 px-2 py-1 rounded-lg border border-white/5 self-start sm:self-auto"><Clock className="w-3.5 h-3.5" />{new Date(activity.timestamp).toLocaleString()}</div>
            </div>
            <p className="text-sm text-muted-foreground mb-4">{activity.details}</p>
            <div className="flex items-center gap-2 pt-3 border-t border-white/5">
              <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center"><User className="w-3.5 h-3.5 text-muted-foreground" /></div>
              <span className="text-xs font-medium text-muted-foreground">{activity.user}</span>
              <span className={cn('ml-auto text-xs font-semibold px-2.5 py-1 rounded-full capitalize border', activity.status === 'failed' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-green-500/10 text-green-500 border-green-500/20')}>{activity.status}</span>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
};
export default ActivityTimeline;
