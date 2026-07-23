import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { CreditCard, CheckCircle2, Clock } from 'lucide-react';

const planFeatures = {
  trial: ['Access to 1 supplier comparison', 'Product search', 'Daily price data', '14-day trial period'],
  pending: ['Account activation pending', 'Access granted once approved'],
  active: ['Full supplier comparison', 'Price history', 'Daily deals feed', 'Saved products', 'Price alerts'],
  expired: [],
  suspended: [],
};

const Subscription = () => {
  const { profile } = useAuth();
  const status = profile?.account_status || 'pending';

  const statusConfig = {
    active: { label: 'Active', color: 'text-success', bg: 'bg-green-50 border-green-200' },
    trial: { label: 'Trial', color: 'text-accent', bg: 'bg-accentSoft border-accent/30' },
    pending: { label: 'Pending Activation', color: 'text-warning', bg: 'bg-orange-50 border-orange-200' },
    expired: { label: 'Expired', color: 'text-danger', bg: 'bg-red-50 border-red-200' },
    suspended: { label: 'Suspended', color: 'text-danger', bg: 'bg-red-50 border-red-200' },
  };

  const config = statusConfig[status] || statusConfig.pending;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-sora font-bold text-2xl text-textPrimary tracking-tight">Subscription</h1>
        <p className="text-textSecondary text-sm mt-1">Your current plan and account access status.</p>
      </div>

      {/* Status Card */}
      <div className={`bg-surface border rounded-lg p-6 ${config.bg}`}>
        <div className="flex items-center gap-3 mb-4">
          <CreditCard size={20} strokeWidth={1.75} className={config.color} />
          <h2 className="font-sora font-semibold text-textPrimary">Account Status</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold border ${config.bg} ${config.color}`}>
            {config.label}
          </span>
        </div>

        {(status === 'expired' || status === 'suspended' || status === 'pending') && (
          <div className="mt-5 p-4 bg-white rounded-lg border border-border">
            <p className="text-sm text-textPrimary font-medium mb-1">
              {status === 'pending' ? 'Your account is pending activation.' : 
               status === 'expired' ? 'Your retailer access has expired.' :
               'Your account has been suspended.'}
            </p>
            <p className="text-sm text-textSecondary">
              Contact us to {status === 'pending' ? 'activate your access' : 'reactivate price intelligence access'}.
            </p>
            <a href="mailto:support@wholesalepriceintelligence.com" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline">
              Contact Support →
            </a>
          </div>
        )}
      </div>

      {/* Plan Features */}
      {planFeatures[status]?.length > 0 && (
        <div className="bg-surface border border-border rounded-lg p-6">
          <h2 className="font-sora font-semibold text-textPrimary mb-4">Your Plan Includes</h2>
          <ul className="space-y-3">
            {planFeatures[status].map(f => (
              <li key={f} className="flex items-center gap-2.5 text-sm text-textSecondary">
                <CheckCircle2 size={15} strokeWidth={2} className="text-success shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Coming Soon */}
      <div className="bg-gray-50 border border-border rounded-lg p-5 flex items-start gap-3">
        <Clock size={18} strokeWidth={1.75} className="text-textSecondary mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-textPrimary">Online subscription management coming soon</p>
          <p className="text-sm text-textSecondary mt-0.5">Subscription upgrades, renewals and billing will be managed in this section once payment integration is available. For now, contact your account manager.</p>
        </div>
      </div>
    </div>
  );
};
export default Subscription;
