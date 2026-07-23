import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Lock } from 'lucide-react';

const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const { login, profile } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await login(email, password);
      // Profile is fetched in AuthContext after login.
      // We navigate after a brief wait for profile to load, or we re-fetch here.
      // Simpler: redirect to /admin and let the RouteGuard handle role check.
      navigate('/admin');
    } catch (err) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-full bg-accentSoft flex items-center justify-center text-accent mx-auto mb-4">
            <Lock size={22} strokeWidth={1.5} />
          </div>
          <h1 className="font-sora font-semibold text-2xl text-textPrimary tracking-tight">
            Admin Sign In
          </h1>
          <p className="text-sm text-textSecondary mt-2 max-w-xs mx-auto">
            Sign in to manage supplier integrations, catalogue data and platform operations.
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
              <label className="block text-sm font-medium text-textSecondary mb-1.5">Admin Email</label>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 bg-surface border border-border rounded-md text-textPrimary text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all"
                placeholder="admin@example.com"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-textSecondary mb-1.5">Password</label>
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 bg-surface border border-border rounded-md text-textPrimary text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all"
                placeholder="••••••••"
              />
            </div>
            
            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full flex justify-center items-center py-2.5 px-4 rounded-md text-sm font-semibold text-white bg-accent hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
