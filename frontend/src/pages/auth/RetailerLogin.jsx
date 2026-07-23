import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Lock, ArrowRight, Eye, EyeOff } from 'lucide-react';

const RetailerLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await login(email, password);
      // RouteGuards in App.jsx will handle redirect based on role.
      // We push to /app, admins will be redirected from there by RequireRole.
      navigate('/app');
    } catch (err) {
      setError(err.message || 'Invalid email or password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <h1 className="font-sora font-bold text-2xl text-textPrimary tracking-tight mb-2">
            Retailer Sign In
          </h1>
          <p className="text-textSecondary text-sm">
            Access current supplier prices, product comparisons and your saved buying intelligence.
          </p>
        </div>
        
        <div className="bg-surface border border-border rounded-lg p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 text-sm text-danger bg-red-50 border border-red-200 rounded-md">
                {error}
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-textSecondary mb-1.5">Email</label>
              <input 
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 bg-surface border border-border rounded-md text-textPrimary text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all"
                placeholder="you@yourstore.com"
              />
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-sm font-medium text-textSecondary">Password</label>
                <Link to="/forgot-password" className="text-xs text-accent hover:underline">Forgot password?</Link>
              </div>
              <div className="relative">
                <input 
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2.5 pr-10 bg-surface border border-border rounded-md text-textPrimary text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-textSecondary hover:text-textPrimary p-1 rounded transition-colors focus:outline-none cursor-pointer"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="remember" className="w-4 h-4 accent-accent rounded border-border" />
              <label htmlFor="remember" className="text-sm text-textSecondary">Remember me</label>
            </div>
            
            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full flex justify-center items-center gap-2 py-2.5 px-4 rounded-md text-sm font-semibold text-white bg-accent hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
              {!isLoading && <ArrowRight size={16} strokeWidth={1.75} />}
            </button>
          </form>
        </div>
        
        <p className="mt-6 text-center text-sm text-textSecondary">
          Don't have an account?{' '}
          <Link to="/register" className="text-accent font-medium hover:underline">
            Request access
          </Link>
        </p>
        <p className="mt-2 text-center text-xs text-textSecondary">
          <Link to="/" className="hover:text-textPrimary">← Back to homepage</Link>
        </p>
      </div>
    </div>
  );
};

export default RetailerLogin;
