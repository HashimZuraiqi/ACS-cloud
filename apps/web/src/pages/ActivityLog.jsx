import React, { useState, useEffect } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { getHistory } from '@/lib/api';
import ActivityTimeline from '@/components/ActivityTimeline.jsx';
import { useAuth } from '@/contexts/AuthContext';

const ActivityLog = () => {
  const { currentUser } = useAuth();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const data = await getHistory();
        setActivities(data);
      } catch (err) {
        setError('Failed to load activity history');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
        <div className="p-2 bg-purple-100 rounded-lg">
          <Activity className="w-6 h-6 text-purple-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Activity Log</h1>
          <p className="text-gray-500 text-sm">Track all security scans and remediation actions</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200">
          {error}
        </div>
      ) : (
        <ActivityTimeline activities={activities} />
      )}
    </div>
  );
};

export default ActivityLog;
