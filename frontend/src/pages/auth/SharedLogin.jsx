import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { TrendingUp, ArrowRight, AlertTriangle, Eye, EyeOff } from 'lucide-react';

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
          throw new Error('Network connection error: Unable to reach authentication server. Please check your internet connection or server status.');
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
      // Note: We deliberately do NOT set isLoading(false) here on success. 
      // We are navigating away, and resetting it causes the button to flash back to "Log in".
    } catch (err) {
      console.error('Login process error:', err);
      setError(err.message || 'An unexpected error occurred during login.');
      setIsLoading(false); // Only stop loading if we hit an error and stay on the login page
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-white flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md">
        
        {/* Brand Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-4 group">
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center text-white shadow-sm group-hover:bg-teal-800 transition-colors">
              <TrendingUp size={22} strokeWidth={2.2} />
            </div>
            <span className="font-sora font-bold text-2xl text-textPrimary tracking-tight">PriceIntel</span>
          </Link>
          <h1 className="font-sora font-bold text-2xl text-textPrimary tracking-tight">
            Log in to PriceIntel
          </h1>
          <p className="text-textSecondary text-sm mt-1.5">
            Access daily wholesale prices, supplier comparisons, and alerts.
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-surface border border-border rounded-xl p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3.5 text-sm font-medium text-danger bg-red-50 border border-red-200 rounded-lg flex flex-col gap-2">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <span className="leading-snug">{error}</span>
                </div>
                {isEmailNotConfirmed && (
                  <div className="mt-1 pt-2 border-t border-red-200 flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={handleResendConfirmation}
                      disabled={resendStatus.loading}
                      className="text-xs font-semibold text-accent hover:underline text-left cursor-pointer disabled:opacity-50"
                    >
                      {resendStatus.loading ? 'Sending confirmation email...' : '→ Resend confirmation email'}
                    </button>
                    {resendStatus.message && (
                      <p className={`text-xs ${resendStatus.success ? 'text-emerald-700 font-medium' : 'text-red-700'}`}>
                        {resendStatus.message}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-textPrimary mb-1.5">Email address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-lg text-textPrimary text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all"
                placeholder="retailer@example.com"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-sm font-medium text-textPrimary">Password</label>
                <a href="#forgot" onClick={(e) => { e.preventDefault(); alert('Password reset instructions sent if email is registered.'); }} className="text-xs text-accent font-medium hover:underline">
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 pr-10 bg-surface border border-border rounded-lg text-textPrimary text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all"
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

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-lg text-sm font-semibold text-white bg-accent hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? 'Logging in...' : 'Log in'}
              {!isLoading && <ArrowRight size={17} strokeWidth={2} />}
            </button>
          </form>
        </div>

        {/* Footer links */}
        <p className="mt-6 text-center text-sm text-textSecondary">
          Don't have an account?{' '}
          <Link to="/signup" className="text-accent font-semibold hover:underline">
            Get started
          </Link>
        </p>

        <p className="mt-4 text-center text-xs text-textSecondary">
          <Link to="/" className="hover:text-textPrimary transition-colors">← Back to homepage</Link>
        </p>

      </div>
    </div>
  );
};

export default SharedLogin;

