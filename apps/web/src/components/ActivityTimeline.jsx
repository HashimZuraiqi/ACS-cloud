import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, AlertCircle, Clock, User } from 'lucide-react';
import { cn } from '@/lib/utils';
const ActivityTimeline = ({ activities }) => {
  if (!activities || activities.length === 0) return (<div className="text-center py-12"><p className="text-gray-500">No activity history found.</p></div>);
  const getStatusIcon = (status) => { switch (status) { case 'success': case 'completed': return <CheckCircle className="w-5 h-5 text-white" />; case 'failed': return <XCircle className="w-5 h-5 text-white" />; default: return <AlertCircle className="w-5 h-5 text-white" />; } };
  const getStatusColor = (status) => { switch (status) { case 'success': case 'completed': return 'bg-green-500 ring-green-100'; case 'failed': return 'bg-red-500 ring-red-100'; default: return 'bg-yellow-500 ring-yellow-100'; } };
  return (
    <div className="relative pl-8 space-y-8 before:absolute before:inset-0 before:ml-3.5 before:h-full before:w-0.5 before:-translate-x-1/2 before:bg-gray-200">
      {activities.map((activity, index) => (
        <motion.div key={activity.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.1 }} className="relative">
          <div className={cn('absolute -left-8 top-1 flex h-7 w-7 items-center justify-center rounded-full ring-4', getStatusColor(activity.status))}>{getStatusIcon(activity.status)}</div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
              <div><h4 className="text-base font-semibold text-gray-900">{activity.action}</h4><p className="text-sm font-medium text-blue-600 mt-0.5">{activity.bucketName}</p></div>
              <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded-md self-start sm:self-auto"><Clock className="w-3.5 h-3.5" />{new Date(activity.timestamp).toLocaleString()}</div>
            </div>
            <p className="text-sm text-gray-600 mb-3">{activity.details}</p>
            <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
              <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center"><User className="w-3.5 h-3.5 text-gray-500" /></div>
              <span className="text-xs font-medium text-gray-500">{activity.user}</span>
              <span className={cn('ml-auto text-xs font-semibold px-2 py-0.5 rounded-full capitalize', activity.status === 'failed' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700')}>{activity.status}</span>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
};
export default ActivityTimeline;
