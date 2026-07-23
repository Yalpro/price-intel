import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { TrendingUp, ArrowRight, AlertTriangle, Eye, EyeOff } from 'lucide-react';

const RetailerSignup = () => {
  const [form, setForm] = useState({
    companyName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!form.companyName.trim()) {
      setError('Please enter your business or store name.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Calculate 14-day trial expiry date
      const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

      // 2. Register Supabase Auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          data: {
            company_name: form.companyName.trim(),
          },
        },
      });

      if (authError) {
        if (authError.message?.includes('Failed to fetch') || authError.name === 'TypeError') {
          throw new Error('Network connection error: Unable to reach registration server. Please check your connection.');
        } else if (authError.message?.includes('already registered')) {
          throw new Error('This email address is already registered. Please log in instead.');
        } else {
          throw new Error(authError.message);
        }
      }

      const user = authData.user;
      if (user) {
        // 3. Create/Upsert profiles record with trial status and trial_ends_at
        const { error: profileError } = await supabase.from('profiles').upsert({
          id: user.id,
          company_name: form.companyName.trim(),
          full_name: form.companyName.trim(),
          role: 'retailer',
          account_status: 'trial',
          trial_ends_at: trialEndsAt,
        });

        if (profileError) {
          console.warn('Profile upsert notice:', profileError.message);
        }

        // 4. Optional: Upsert subscribers table
        try {
          await supabase.from('subscribers').upsert({
            user_id: user.id,
            status: 'trial',
            trial_ends_at: trialEndsAt,
          });
        } catch (_) {
          // Ignore subscriber table fallback
        }
      }

      // 5. Redirect to /app with trial confirmation state
      navigate('/app', { 
        state: { 
          trialStarted: true, 
          companyName: form.companyName,
          trialEndsAt: trialEndsAt
        } 
      });
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-white flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-4 group">
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center text-white shadow-sm group-hover:bg-teal-800 transition-colors">
              <TrendingUp size={22} strokeWidth={2.2} />
            </div>
            <span className="font-sora font-bold text-2xl text-textPrimary tracking-tight">PriceIntel</span>
          </Link>
          <h1 className="font-sora font-bold text-2xl text-textPrimary tracking-tight">
            Start your 14-day free trial
          </h1>
          <p className="text-textSecondary text-sm mt-1.5">
            Instant access to wholesale price intelligence across top UK suppliers.
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-surface border border-border rounded-xl p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3.5 text-sm font-medium text-danger bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <span className="leading-snug">{error}</span>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-textPrimary mb-1.5">Business Name</label>
              <input
                type="text"
                required
                value={form.companyName}
                onChange={(e) => updateField('companyName', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-lg text-textPrimary text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all"
                placeholder="e.g. Apex Express Retail"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-textPrimary mb-1.5">Email address</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-lg text-textPrimary text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all"
                placeholder="you@store.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-textPrimary mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={form.password}
                  onChange={(e) => updateField('password', e.target.value)}
                  className="w-full px-3.5 py-2.5 pr-10 bg-surface border border-border rounded-lg text-textPrimary text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all"
                  placeholder="At least 6 characters"
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

            <div>
              <label className="block text-sm font-medium text-textPrimary mb-1.5">Confirm Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={form.confirmPassword}
                  onChange={(e) => updateField('confirmPassword', e.target.value)}
                  className="w-full px-3.5 py-2.5 pr-10 bg-surface border border-border rounded-lg text-textPrimary text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all"
                  placeholder="Re-enter password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-textSecondary hover:text-textPrimary p-1 rounded transition-colors focus:outline-none cursor-pointer"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-lg text-sm font-semibold text-white bg-accent hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer mt-2"
            >
              {isLoading ? 'Creating trial account...' : 'Start Free Trial'}
              {!isLoading && <ArrowRight size={17} strokeWidth={2} />}
            </button>
          </form>
        </div>

        {/* Footer Link */}
        <p className="mt-6 text-center text-sm text-textSecondary">
          Already have an account?{' '}
          <Link to="/login" className="text-accent font-semibold hover:underline">
            Log in
          </Link>
        </p>

        <p className="mt-4 text-center text-xs text-textSecondary">
          <Link to="/" className="hover:text-textPrimary transition-colors">← Back to homepage</Link>
        </p>

      </div>
    </div>
  );
};

export default RetailerSignup;
