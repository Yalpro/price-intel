import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { CreditCard, Building2, Mail, Shield, Send, CheckCircle2, User, Bell } from 'lucide-react';

const Account = () => {
  const { profile } = useAuth();

  return (
    <div className="space-y-8 max-w-4xl">
      
      {/* Page Title */}
      <div>
        <h1 className="font-sora font-bold text-2xl sm:text-3xl text-textPrimary tracking-tight">
          Account & Subscription Settings
        </h1>
        <p className="text-sm text-textSecondary mt-1">
          Manage your business profile, subscription status, and notification channels.
        </p>
      </div>

      {/* Subscription Card */}
      <div className="bg-white border border-border rounded-2xl p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-6 border-b border-border">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-sora font-bold text-xl text-textPrimary">Retailer Plan</span>
              <span className="text-xs font-semibold text-accent bg-accentSoft border border-accent/30 px-2.5 py-0.5 rounded-full">
                14-Day Free Trial Active
              </span>
            </div>
            <p className="text-xs text-textSecondary">
              Your free trial gives you full access to Booker, Parfetts, and Dhamecha price scans.
            </p>
          </div>

          <button
            onClick={() => alert('Subscription payment integration is coming in the next release.')}
            className="px-5 py-2.5 bg-accent text-white font-semibold text-xs rounded-xl hover:bg-teal-800 transition-colors shadow-xs shrink-0 cursor-pointer"
          >
            Upgrade to Pro (£29/mo)
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="bg-slate-50 p-4 rounded-xl border border-border">
            <span className="text-textSecondary block mb-1">Trial Status</span>
            <span className="font-semibold text-success flex items-center gap-1">
              <CheckCircle2 size={14} /> Active
            </span>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-border">
            <span className="text-textSecondary block mb-1">Trial Expiry</span>
            <span className="font-mono font-semibold text-textPrimary">14 days remaining</span>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-border">
            <span className="text-textSecondary block mb-1">Connected Wholesalers</span>
            <span className="font-semibold text-textPrimary">Booker, Parfetts, Dhamecha</span>
          </div>
        </div>
      </div>

      {/* Business Details Card */}
      <div className="bg-white border border-border rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
        <h2 className="font-sora font-semibold text-lg text-textPrimary border-b border-border pb-4">
          Business Profile
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
          <div>
            <label className="block text-xs font-medium text-textSecondary mb-1">Store / Business Name</label>
            <div className="flex items-center gap-2 p-3 bg-slate-50 border border-border rounded-xl font-medium text-textPrimary">
              <Building2 size={16} className="text-accent" />
              <span>{profile?.company_name || profile?.full_name || 'Apex Store Ltd'}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-textSecondary mb-1">Account Email</label>
            <div className="flex items-center gap-2 p-3 bg-slate-50 border border-border rounded-xl font-medium text-textPrimary">
              <Mail size={16} className="text-accent" />
              <span>{profile?.email || 'retailer@example.com'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Telegram Account Linking Card */}
      <div className="bg-white border border-border rounded-2xl p-6 sm:p-8 shadow-xs space-y-4">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
              <Send size={20} strokeWidth={2} />
            </div>
            <div>
              <h3 className="font-sora font-semibold text-base text-textPrimary">Telegram Daily Price Alerts</h3>
              <p className="text-xs text-textSecondary">Receive morning price drops and deals directly on Telegram.</p>
            </div>
          </div>

          <span className="text-xs font-medium text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full">
            Not Linked Yet
          </span>
        </div>

        <div className="bg-sky-50/60 border border-sky-200 rounded-xl p-4 text-xs text-sky-900 leading-relaxed">
          Telegram bot integration allows you to query product prices directly via chat message (e.g. <code className="bg-white px-1.5 py-0.5 rounded font-mono">/price 5449000000996</code>) and get instant supplier comparisons.
        </div>
      </div>

    </div>
  );
};

export default Account;
