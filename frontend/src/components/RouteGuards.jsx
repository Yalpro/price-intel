import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Clock, ShieldAlert, Mail } from 'lucide-react';

export const RequireAuth = ({ children }) => {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen />;

  if (!session) {
    const isAdminRoute = location.pathname.startsWith('/admin');
    return <Navigate to={isAdminRoute ? '/admin/login' : '/login'} state={{ from: location }} replace />;
  }

  return children;
};

export const RequireRole = ({ allowedRoles, children }) => {
  const { session, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen />;

  if (!session || !profile) {
    const isAdminRoute = location.pathname.startsWith('/admin');
    return <Navigate to={isAdminRoute ? '/admin/login' : '/login'} replace />;
  }

  if (!allowedRoles.includes(profile.role)) {
    if (['admin', 'manager'].includes(profile.role)) {
      return <Navigate to="/admin" replace />;
    } else if (profile.role === 'retailer') {
      return <Navigate to="/app" replace />;
    } else {
      return <Navigate to="/" replace />;
    }
  }

  return children;
};

export const RequireActiveRetailer = ({ children }) => {
  const { session, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen />;

  if (!session || !profile || profile.role !== 'retailer') {
    return <Navigate to="/login" replace />;
  }

  // Check trial expiration
  const isTrial = profile.account_status === 'trial';
  const trialEndsAt = profile.trial_ends_at ? new Date(profile.trial_ends_at) : null;
  const isTrialExpired = isTrial && trialEndsAt && trialEndsAt.getTime() < Date.now();

  const isAuthorized = ['active', 'trial'].includes(profile.account_status) && !isTrialExpired;
  const isAllowedPath = location.pathname === '/app/subscription' || location.pathname === '/app/account';

  if (!isAuthorized && !isAllowedPath) {
    return <TrialExpiredScreen />;
  }

  return children;
};

const TrialExpiredScreen = () => (
  <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
    <div className="bg-white border border-border rounded-2xl p-8 sm:p-10 max-w-lg w-full text-center shadow-lg">
      <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto mb-6">
        <Clock size={32} strokeWidth={2} />
      </div>

      <h1 className="font-sora font-bold text-2xl text-textPrimary tracking-tight mb-2">
        Your 14-day free trial has ended
      </h1>

      <p className="text-sm text-textSecondary leading-relaxed mb-6">
        To continue comparing daily Booker, Parfetts, and Costco wholesale prices, please subscribe to our Retailer Pro plan.
      </p>

      <div className="bg-slate-50 border border-border rounded-xl p-4 mb-6 text-left text-xs space-y-2">
        <div className="flex justify-between font-semibold text-textPrimary">
          <span>Pro Retailer Plan</span>
          <span className="font-mono text-accent">£29 / month</span>
        </div>
        <p className="text-textSecondary">Full access to daily scans, price history trends, and Telegram alerts.</p>
      </div>

      <div className="space-y-3">
        <button
          onClick={() => alert('Subscription payment integration is coming in the next release. Please contact support to activate.')}
          className="w-full py-3 px-4 bg-accent text-white font-semibold text-sm rounded-xl hover:bg-teal-800 transition-colors shadow-sm cursor-pointer"
        >
          Subscribe Now (£29/mo)
        </button>

        <Link
          to="/app/account"
          className="block w-full py-2.5 px-4 bg-white border border-border text-textPrimary font-semibold text-xs rounded-xl hover:bg-slate-50 transition-colors"
        >
          View Account Settings
        </Link>
      </div>
    </div>
  </div>
);

const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
  </div>
);
