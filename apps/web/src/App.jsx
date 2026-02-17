import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/contexts/AuthContext';
import PrivateRoute from '@/components/PrivateRoute.jsx';
import Sidebar from '@/components/Sidebar.jsx';
import ProtectedHeader from '@/components/ProtectedHeader.jsx';
import Dashboard from '@/pages/Dashboard.jsx';
import BucketDetail from '@/pages/BucketDetail.jsx';
import ActivityLog from '@/pages/ActivityLog.jsx';
import Landing from '@/pages/Landing.jsx';
import Login from '@/pages/Login.jsx';
import Signup from '@/pages/Signup.jsx';

// Layout for protected routes
const ProtectedLayout = () => {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      <Sidebar className="hidden md:flex flex-shrink-0" />
      <main className="flex-1 flex flex-col overflow-hidden">
        <ProtectedHeader />
        <div className="flex-1 overflow-y-auto p-4 md:p-8 max-w-7xl mx-auto w-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Protected Routes */}
          <Route element={
            <PrivateRoute>
              <ProtectedLayout />
            </PrivateRoute>
          }>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/bucket/:scanId" element={<BucketDetail />} />
            <Route path="/activity" element={<ActivityLog />} />
            <Route path="/history" element={<Navigate to="/activity" replace />} />
            <Route path="/settings" element={<div className="p-8 text-center text-gray-500">Settings module coming soon</div>} />
          </Route>

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        
        <Toaster />
      </Router>
    </AuthProvider>
  );
}

export default App;