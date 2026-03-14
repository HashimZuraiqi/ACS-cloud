import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import PrivateRoute from '@/components/PrivateRoute.jsx';
import Sidebar from '@/components/Sidebar.jsx';
import ProtectedHeader from '@/components/ProtectedHeader.jsx';
import Dashboard from '@/pages/Dashboard.jsx';
import BucketDetail from '@/pages/BucketDetail.jsx';
import EC2Detail from '@/pages/EC2Detail.jsx';
import ActivityLog from '@/pages/ActivityLog.jsx';
import SecurityInsights from '@/pages/SecurityInsights.jsx';
import Landing from '@/pages/Landing.jsx';
import Login from '@/pages/Login.jsx';
import Signup from '@/pages/Signup.jsx';
import Settings from '@/pages/Settings.jsx';
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background overflow-hidden font-sans relative">
      {/* Global Background Ambience */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <motion.div animate={{ x: [0, 30, 0], y: [0, -40, 0] }} transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
          className="absolute -top-[10%] -left-[10%] w-[600px] h-[600px] bg-blue-600/10 dark:bg-blue-600/5 blur-[120px] rounded-full mix-blend-screen" />
        <motion.div animate={{ x: [0, -40, 0], y: [0, 50, 0] }} transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
          className="absolute top-[20%] -right-[5%] w-[500px] h-[500px] bg-cyan-500/10 dark:bg-cyan-500/5 blur-[100px] rounded-full mix-blend-screen" />
        <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute bottom-0 left-[20%] w-[700px] h-[400px] bg-purple-600/5 dark:bg-purple-600/5 blur-[130px] rounded-full mix-blend-screen" />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Desktop & Mobile */}
      <Sidebar 
        className={`fixed md:relative top-0 left-0 h-full z-50 transform transition-transform duration-300 ease-in-out md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } flex-shrink-0`}
        onCloseMobile={() => setMobileMenuOpen(false)} 
      />

      <main className="flex-1 flex flex-col overflow-hidden z-10 relative">
        <ProtectedHeader onMobileMenuClick={() => setMobileMenuOpen(true)} />
        <div className="flex-1 overflow-y-auto p-4 md:p-8 max-w-7xl mx-auto w-full scrollbar-none">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="w-full h-full"
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
                <Route path="/ec2/:scanId" element={<EC2Detail />} />
                <Route path="/activity" element={<ActivityLog />} />
                <Route path="/security" element={<SecurityInsights />} />
                <Route path="/history" element={<Navigate to="/activity" replace />} />
                <Route path="/settings" element={<Settings />} />
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