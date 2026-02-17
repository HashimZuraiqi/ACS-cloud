import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, AlertCircle, CheckCircle2, Eye, EyeOff, Shield } from 'lucide-react';
import PublicHeader from '@/components/PublicHeader';
import { motion } from 'framer-motion';

const PasswordStrength = ({ password }) => {
  const getStrength = (pwd) => {
    if (!pwd) return 0;
    let s = 0;
    if (pwd.length >= 8) s++;
    if (pwd.length >= 12) s++;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) s++;
    if (/[0-9]/.test(pwd)) s++;
    if (/[^A-Za-z0-9]/.test(pwd)) s++;
    return s;
  };
  const strength = getStrength(password);
  const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500'];
  const labels = ['Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-1">
        {[...Array(5)].map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < strength ? colors[strength - 1] : 'bg-muted'}`} />
        ))}
      </div>
      {password && <p className="text-[11px] text-muted-foreground">{labels[strength - 1] || 'Very Weak'}</p>}
    </div>
  );
};

const Signup = () => {
  const navigate = useNavigate();
  const { signup, loginDemo, isAuthenticated } = useAuth();
  const [formData, setFormData] = useState({ fullName: '', email: '', password: '', confirmPassword: '', company: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (isAuthenticated) navigate('/dashboard', { replace: true }); }, [isAuthenticated, navigate]);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const validateForm = () => {
    if (!formData.email || !formData.password || !formData.fullName) { setError("Please fill in all required fields"); return false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) { setError("Please enter a valid email"); return false; }
    if (formData.password !== formData.confirmPassword) { setError("Passwords do not match"); return false; }
    if (formData.password.length < 8) { setError("Password must be at least 8 characters"); return false; }
    if (!/(?=.*\d)(?=.*[A-Z])/.test(formData.password)) { setError("Password needs at least one number and one uppercase letter"); return false; }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    if (!validateForm()) return;
    setLoading(true);
    try {
      await signup(formData.email, formData.password, formData.fullName, formData.company);
      navigate('/dashboard');
    } catch (err) {
      console.error(err);
      if (err.data?.data?.email?.code === 'validation_not_unique') setError("Email already registered. Sign in instead.");
      else setError(err.message || "Failed to create account.");
    } finally { setLoading(false); }
  };

  const handleDemo = () => { loginDemo(); };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PublicHeader />

      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-40 -right-40 w-[420px] h-[420px] bg-blue-500/[0.06] dark:bg-blue-500/[0.10] rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-[380px] h-[380px] bg-purple-500/[0.05] dark:bg-purple-500/[0.08] rounded-full blur-3xl" />
      </div>

      <div className="flex-1 flex items-center justify-center py-12 px-4 relative z-10">
        <motion.div initial={{ opacity:0, y:24 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.5, ease:[0.25,0.46,0.45,0.94] }} className="w-full max-w-[420px]">
          <div className="bg-card rounded-2xl shadow-xl shadow-black/[0.04] dark:shadow-black/20 border border-border overflow-hidden">
            {/* Header */}
            <div className="px-8 pt-10 pb-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 shadow-lg shadow-blue-600/20">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-lg bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">CloudGuard</span>
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-1">Create account</h2>
              <p className="text-sm text-muted-foreground">Start securing your cloud infrastructure</p>
            </div>

            <div className="px-8 pb-8 space-y-5">
              {error && (
                <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }}
                  className="flex items-start gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><p>{error}</p>
                </motion.div>
              )}

              <form className="space-y-4" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="fullName" className="block text-sm font-medium text-foreground mb-1.5">Full Name</label>
                  <input id="fullName" name="fullName" type="text" required className="input-field" placeholder="Jane Doe" value={formData.fullName} onChange={handleChange} />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1.5">Email</label>
                  <input id="email" name="email" type="email" required className="input-field" placeholder="you@company.com" value={formData.email} onChange={handleChange} />
                </div>
                <div>
                  <label htmlFor="company" className="block text-sm font-medium text-foreground mb-1.5">Company <span className="text-muted-foreground text-xs">(Optional)</span></label>
                  <input id="company" name="company" type="text" className="input-field" placeholder="Acme Inc." value={formData.company} onChange={handleChange} />
                </div>
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1.5">Password</label>
                  <div className="relative">
                    <input id="password" name="password" type={showPassword?'text':'password'} required className="input-field pr-10" placeholder="••••••••" value={formData.password} onChange={handleChange} />
                    <button type="button" onClick={()=>setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {formData.password && <PasswordStrength password={formData.password} />}
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <input id="confirmPassword" name="confirmPassword" type={showConfirmPassword?'text':'password'} required className="input-field pr-10" placeholder="••••••••" value={formData.confirmPassword} onChange={handleChange} />
                    <button type="button" onClick={()=>setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {formData.confirmPassword && formData.password === formData.confirmPassword && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1.5 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Passwords match</p>
                  )}
                </div>

                <button type="submit" disabled={loading}
                  className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 shadow-lg shadow-blue-600/20 hover:shadow-blue-600/35 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2">
                  {loading ? (<><Loader2 className="w-4 h-4 animate-spin" /> Creating account...</>) : 'Create Account'}
                </button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center"><span className="bg-card px-3 text-xs text-muted-foreground">or</span></div>
              </div>

              <button onClick={handleDemo}
                className="w-full py-3 rounded-xl font-semibold border border-border hover:bg-muted/50 hover:border-blue-400/40 transition-all duration-300 text-foreground text-sm">
                Continue with Demo Account
              </button>

              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link to="/login" className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">Sign in</Link>
              </p>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            By creating an account you agree to our{' '}
            <a href="#" className="text-blue-600 dark:text-blue-400 hover:underline">Terms</a> and{' '}
            <a href="#" className="text-blue-600 dark:text-blue-400 hover:underline">Privacy Policy</a>
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Signup;