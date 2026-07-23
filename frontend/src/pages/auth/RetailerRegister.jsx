import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

const RetailerRegister = () => {
  const [form, setForm] = useState({
    fullName: '', company: '', email: '', password: '', confirmPassword: '', phone: '', agreed: false
  });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const update = (field, val) => setForm(prev => ({ ...prev, [field]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (form.password !== form.confirmPassword) { setError('Passwords do not match.'); return; }
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (!form.agreed) { setError('Please agree to the terms to continue.'); return; }
    setIsLoading(true);
    try {
      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { full_name: form.fullName } }
      });
      if (authError) throw authError;

      // 2. Create profile (role: retailer, status: pending)
      if (authData.user) {
        const { error: profileError } = await supabase.from('profiles').insert({
          id: authData.user.id,
          full_name: form.fullName,
          company_name: form.company,
          role: 'retailer',
          account_status: 'pending'
        });
        if (profileError) throw profileError;
      }

      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-background flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-200">
            <CheckCircle2 size={32} strokeWidth={1.5} className="text-success" />
          </div>
          <h1 className="font-sora font-bold text-2xl text-textPrimary tracking-tight mb-3">Application received</h1>
          <p className="text-textSecondary mb-6 leading-relaxed">
            Thank you for requesting access. Your account has been created and is pending review. You will be contacted once your access is activated.
          </p>
          <p className="text-textSecondary text-sm mb-8">Check your email to confirm your address.</p>
          <Link to="/" className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent text-white rounded-lg font-semibold text-sm hover:bg-teal-800 transition-colors">
            Back to Homepage
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <h1 className="font-sora font-bold text-2xl text-textPrimary tracking-tight mb-2">Request Retailer Access</h1>
          <p className="text-textSecondary text-sm">Create your account to start comparing wholesale supplier prices.</p>
        </div>
        
        <div className="bg-surface border border-border rounded-lg p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="p-3 text-sm text-danger bg-red-50 border border-red-200 rounded-md">{error}</div>}
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-textSecondary mb-1.5">Full Name</label>
                <input required value={form.fullName} onChange={e => update('fullName', e.target.value)} type="text" placeholder="Jane Smith" className="w-full px-3 py-2.5 bg-surface border border-border rounded-md text-textPrimary text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-textSecondary mb-1.5">Store / Business Name</label>
                <input required value={form.company} onChange={e => update('company', e.target.value)} type="text" placeholder="Aiko Store Ltd" className="w-full px-3 py-2.5 bg-surface border border-border rounded-md text-textPrimary text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-textSecondary mb-1.5">Email</label>
              <input required value={form.email} onChange={e => update('email', e.target.value)} type="email" placeholder="you@yourstore.com" className="w-full px-3 py-2.5 bg-surface border border-border rounded-md text-textPrimary text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent" />
            </div>

            <div>
              <label className="block text-sm font-medium text-textSecondary mb-1.5">Phone (optional)</label>
              <input value={form.phone} onChange={e => update('phone', e.target.value)} type="tel" placeholder="+44 7700 000000" className="w-full px-3 py-2.5 bg-surface border border-border rounded-md text-textPrimary text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent" />
            </div>

            <div>
              <label className="block text-sm font-medium text-textSecondary mb-1.5">Password</label>
              <input required value={form.password} onChange={e => update('password', e.target.value)} type="password" placeholder="Min 8 characters" className="w-full px-3 py-2.5 bg-surface border border-border rounded-md text-textPrimary text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent" />
            </div>

            <div>
              <label className="block text-sm font-medium text-textSecondary mb-1.5">Confirm Password</label>
              <input required value={form.confirmPassword} onChange={e => update('confirmPassword', e.target.value)} type="password" placeholder="••••••••" className="w-full px-3 py-2.5 bg-surface border border-border rounded-md text-textPrimary text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent" />
            </div>

            <div className="flex items-start gap-2.5 pt-1">
              <input type="checkbox" id="agree" checked={form.agreed} onChange={e => update('agreed', e.target.checked)} className="w-4 h-4 accent-accent mt-0.5 border-border rounded" />
              <label htmlFor="agree" className="text-sm text-textSecondary leading-relaxed">
                I agree to the <a href="#" className="text-accent hover:underline">Terms of Service</a> and <a href="#" className="text-accent hover:underline">Privacy Policy</a>
              </label>
            </div>
            
            <button type="submit" disabled={isLoading} className="w-full flex justify-center items-center gap-2 py-2.5 px-4 rounded-md text-sm font-semibold text-white bg-accent hover:bg-teal-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-2">
              {isLoading ? 'Creating account...' : 'Request Access'}
              {!isLoading && <ArrowRight size={16} strokeWidth={1.75} />}
            </button>
          </form>
        </div>
        
        <p className="mt-6 text-center text-sm text-textSecondary">
          Already have an account?{' '}
          <Link to="/login" className="text-accent font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
};

export default RetailerRegister;
