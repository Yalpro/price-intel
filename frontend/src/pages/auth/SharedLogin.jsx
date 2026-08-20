import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { ArrowRight, AlertTriangle, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import AnapriceLogo from '../../components/AnapriceLogo';

import { useAuth } from '../../contexts/AuthContext';

const SharedLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [isEmailNotConfirmed, setIsEmailNotConfirmed] = useState(false);
  const [resendStatus, setResendStatus] = useState({ loading: false, success: false, message: '' });
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuth();

  React.useEffect(() => {
    if (user && profile) {
      const isAdmin = ['admin', 'manager'].includes(profile.role);
      const from = location.state?.from?.pathname;
      if (isAdmin) {
        navigate(from && from.startsWith('/admin') ? from : '/admin/dashboard', { replace: true });
      } else {
        navigate(from && from.startsWith('/app') ? from : '/app', { replace: true });
      }
    }
  }, [user, profile, navigate, location]);

  const handleResendConfirmation = async () => {
    if (!email.trim()) {
      setResendStatus({ loading: false, success: false, message: 'Please enter your email address first.' });
      return;
    }
    setResendStatus({ loading: true, success: false, message: '' });
    try {
      const { error: resendErr } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
      });
      if (resendErr) {
        setResendStatus({ loading: false, success: false, message: resendErr.message || 'Failed to resend confirmation email.' });
      } else {
        setResendStatus({ loading: false, success: true, message: 'Confirmation email sent! Please check your inbox.' });
      }
    } catch (err) {
      setResendStatus({ loading: false, success: false, message: 'An error occurred while resending.' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsEmailNotConfirmed(false);
    setResendStatus({ loading: false, success: false, message: '' });
    setIsLoading(true);

    try {
      // 1. Sign in with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        console.error('Supabase auth sign-in error:', authError);

        const errorCode = authError.error_code || authError.code;
        const errorMsg = (authError.message || '').toLowerCase();

        if (errorCode === 'email_not_confirmed' || errorMsg.includes('email not confirmed') || errorMsg.includes('unconfirmed')) {
          setIsEmailNotConfirmed(true);
          throw new Error('Please confirm your email address before logging in. Check your inbox for the confirmation link.');
        } else if (errorCode === 'invalid_credentials' || errorMsg.includes('invalid login credentials') || authError.status === 400) {
          throw new Error('Incorrect email or password.');
        } else if (errorMsg.includes('failed to fetch') || authError.name === 'TypeError') {
          throw new Error('Network connection error: Unable to reach authentication server. Please check your internet connection.');
        } else if (authError.status === 429 || errorCode === 'over_email_send_rate_limit') {
          throw new Error('Too many requests. Please wait a few moments and try again.');
        } else {
          throw new Error(authError.message || 'An unexpected authentication error occurred.');
        }
      }

      const userId = authData.user?.id;
      if (!userId) {
        throw new Error('Sign-in succeeded, but user account session was not returned.');
      }

      // 2. Determine user role from profiles
      const { data: profileRow, error: profileErr } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      if (profileErr) {
        console.error('Profile resolution error:', profileErr);
        throw new Error('Failed to load account profile. Please try again.');
      }

      if (!profileRow) {
        throw new Error('No user profile found for this account.');
      }

      // 3. Redirect based on role
      const isAdmin = ['admin', 'manager'].includes(profileRow.role);
      const from = location.state?.from?.pathname;
      
      if (isAdmin) {
        navigate(from && from.startsWith('/admin') ? from : '/admin/dashboard', { replace: true });
      } else {
        navigate(from && from.startsWith('/app') ? from : '/app', { replace: true });
      }
    } catch (err) {
      console.error('Login process error:', err);
      setError(err.message || 'An unexpected error occurred during login.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center px-4 py-12 font-inter text-textPrimary antialiased selection:bg-accent/30 selection:text-accentMint relative overflow-hidden">
      {/* Subtle background ambient green glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-accent/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        
        {/* Brand Header */}
        <div className="text-center space-y-3 flex flex-col items-center">
          <Link to="/" className="inline-flex items-center gap-2 group mb-2">
            <AnapriceLogo size={44} />
          </Link>
          <h1 className="font-sora font-bold text-2xl sm:text-3xl text-textPrimary tracking-tight">
            Log in to Anaprice
          </h1>
          <p className="text-textSecondary text-sm max-w-xs mx-auto leading-relaxed">
            Access daily wholesale price intelligence, comparisons and buying opportunities.
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-surface border border-border rounded-2xl p-6 sm:p-8 shadow-2xl space-y-5">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-4 text-xs font-medium text-danger bg-danger/10 border border-danger/30 rounded-xl flex flex-col gap-2">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <span className="leading-snug">{error}</span>
                </div>
                {isEmailNotConfirmed && (
                  <div className="mt-1 pt-2 border-t border-danger/30 flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={handleResendConfirmation}
                      disabled={resendStatus.loading}
                      className="text-xs font-semibold text-accentMint hover:underline text-left cursor-pointer disabled:opacity-50"
                    >
                      {resendStatus.loading ? 'Sending confirmation email...' : '→ Resend confirmation email'}
                    </button>
                    {resendStatus.message && (
                      <p className={`text-xs ${resendStatus.success ? 'text-accentMint font-medium' : 'text-danger'}`}>
                        {resendStatus.message}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-mono font-semibold uppercase text-textSecondary">
                Email address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-[#0A0E0C] border border-border rounded-xl text-textPrimary text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-all font-inter placeholder:text-textSecondary/50"
                placeholder="retailer@anaprice.co.uk"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-mono font-semibold uppercase text-textSecondary">
                  Password
                </label>
                <a 
                  href="#forgot" 
                  onClick={(e) => { e.preventDefault(); alert('Password reset instructions sent if email is registered.'); }} 
                  className="text-xs text-accent font-medium hover:underline"
                >
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-10 bg-[#0A0E0C] border border-border rounded-xl text-textPrimary text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-all font-inter placeholder:text-textSecondary/50"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-textSecondary hover:text-textPrimary p-1 rounded transition-colors focus:outline-none cursor-pointer"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center gap-2 py-3.5 px-4 rounded-xl text-sm font-semibold text-white bg-accent hover:bg-accentHover focus:outline-none focus:ring-2 focus:ring-accent transition-colors shadow-lg shadow-accent/20 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? 'Logging in...' : 'Log in to Dashboard'}
              {!isLoading && <ArrowRight size={17} />}
            </button>
          </form>
        </div>

        {/* Footer links */}
        <div className="text-center space-y-3">
          <p className="text-sm text-textSecondary">
            Don't have an account?{' '}
            <Link to="/signup" className="text-accent font-semibold hover:underline">
              Get started
            </Link>
          </p>

          <p className="text-xs text-textSecondary">
            <Link to="/" className="hover:text-textPrimary transition-colors">← Back to homepage</Link>
          </p>
        </div>

      </div>
    </div>
  );
};

export default SharedLogin;
