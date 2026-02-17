import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import PrivateRoute from '@/components/PrivateRoute.jsx';
import Sidebar from '@/components/Sidebar.jsx';
import ProtectedHeader from '@/components/ProtectedHeader.jsx';
import Dashboard from '@/pages/Dashboard.jsx';
import BucketDetail from '@/pages/BucketDetail.jsx';
import ActivityLog from '@/pages/ActivityLog.jsx';
import Landing from '@/pages/Landing.jsx';
import Login from '@/pages/Login.jsx';
import Signup from '@/pages/Signup.jsx';
import { motion } from 'framer-motion';

// Error Boundary
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', color: 'red', fontFamily: 'monospace', whiteSpace: 'pre-wrap', background: '#333', minHeight: '100vh' }}>
          <h1>⚠️ Application Error</h1>
          <p>{this.state.error?.message}</p>
          <p>{this.state.error?.stack}</p>
        </div>
      );
    }

    return this.props.children;
  }
}

// Layout for protected routes
const ProtectedLayout = () => {
  return (
    <div className="flex h-screen bg-background overflow-hidden font-sans">
      <Sidebar className="hidden md:flex flex-shrink-0" />
      <main className="flex-1 flex flex-col overflow-hidden">
        <ProtectedHeader />
        <div className="flex-1 overflow-y-auto p-4 md:p-8 max-w-7xl mx-auto w-full">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Outlet />
          </motion.div>
        </div>
      </main>
    </div>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
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
                <Route path="/settings" element={<div className="p-8 text-center text-muted-foreground">Settings module coming soon</div>} />
              </Route>

              {/* Catch all */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            
            <Toaster />
          </Router>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;