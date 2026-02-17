import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, AlertCircle, Eye, EyeOff, ArrowRight, Shield } from 'lucide-react';
import PublicHeader from '@/components/PublicHeader';
import { Checkbox } from '@/components/ui/checkbox';
import { motion } from 'framer-motion';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loginDemo, isAuthenticated } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const from = location.state?.from?.pathname || '/dashboard';

  const validateForm = () => {
    if (!email || !password) {
      setError("Please fill in all fields");
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!validateForm()) return;
    setLoading(true);
    try {
      await login(email, password);
      if (rememberMe) localStorage.setItem('rememberEmail', email);
      navigate(from, { replace: true });
    } catch (err) {
      console.error(err);
      if (err.status === 400) setError("Invalid email or password.");
      else if (err.status === 0) setError("Network error. Please check your connection.");
      else setError(err.message || "Failed to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = () => {
    loginDemo();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PublicHeader />

      {/* Subtle BG accents */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-40 -right-40 w-[420px] h-[420px] bg-blue-500/[0.06] dark:bg-blue-500/[0.10] rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-[380px] h-[380px] bg-purple-500/[0.05] dark:bg-purple-500/[0.08] rounded-full blur-3xl" />
      </div>

      <div className="flex-1 flex items-center justify-center py-12 px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.25,0.46,0.45,0.94] }}
          className="w-full max-w-[420px]"
        >
          <div className="bg-card rounded-2xl shadow-xl shadow-black/[0.04] dark:shadow-black/20 border border-border overflow-hidden">
            {/* Header */}
            <div className="px-8 pt-10 pb-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 shadow-lg shadow-blue-600/20">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-lg bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">CloudGuard</span>
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-1">Welcome back</h2>
              <p className="text-sm text-muted-foreground">Sign in to your security dashboard</p>
            </div>

            <div className="px-8 pb-8 space-y-5">
              {/* Error */}
              {error && (
                <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }}
                  className="flex items-start gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <p>{error}</p>
                </motion.div>
              )}

              <form className="space-y-4" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1.5">Email</label>
                  <input id="email" type="email" required className="input-field" placeholder="you@company.com" value={email} onChange={(e)=>setEmail(e.target.value)} />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="password" className="text-sm font-medium text-foreground">Password</label>
                    <Link to="#" className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">Forgot?</Link>
                  </div>
                  <div className="relative">
                    <input id="password" type={showPassword?'text':'password'} required className="input-field pr-10" placeholder="••••••••" value={password} onChange={(e)=>setPassword(e.target.value)} />
                    <button type="button" onClick={()=>setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox id="remember" checked={rememberMe} onCheckedChange={setRememberMe} />
                  <label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer select-none">Remember me</label>
                </div>

                <button type="submit" disabled={loading}
                  className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 shadow-lg shadow-blue-600/20 hover:shadow-blue-600/35 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2">
                  {loading ? (<><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</>) : (<>Sign In <ArrowRight className="w-4 h-4" /></>)}
                </button>
              </form>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center"><span className="bg-card px-3 text-xs text-muted-foreground">or</span></div>
              </div>

              {/* Demo */}
              <button onClick={handleDemo}
                className="w-full py-3 rounded-xl font-semibold border border-border hover:bg-muted/50 hover:border-blue-400/40 transition-all duration-300 text-foreground text-sm">
                Continue with Demo Account
              </button>

              <p className="text-center text-sm text-muted-foreground">
                Don&apos;t have an account?{' '}
                <Link to="/signup" className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">Sign up</Link>
              </p>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">Protected by enterprise-grade encryption</p>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;