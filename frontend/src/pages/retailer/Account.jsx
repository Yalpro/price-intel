import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Building2, Mail, CheckCircle2, Shield, LogOut } from 'lucide-react';

export const Account = () => {
  const { profile, logout } = useAuth();

  return (
    <div className="space-y-8 max-w-4xl mx-auto font-inter">
      {/* Page Title */}
      <div>
        <h1 className="font-sora font-bold text-2xl sm:text-3xl text-textPrimary tracking-tight">
          Account & Access Settings
        </h1>
        <p className="text-sm text-textSecondary mt-1">
          Manage your business profile and pilot subscription access.
        </p>
      </div>

      {/* Subscription Card */}
      <div className="bg-surface border border-border rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-border">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-sora font-bold text-xl text-textPrimary">Anaprice Retailer Access</span>
              <span className="text-xs font-mono font-bold text-accentMint bg-savingBg border border-emerald-800 px-2.5 py-0.5 rounded-full">
                Free Pilot Access Active
              </span>
            </div>
            <p className="text-xs text-textSecondary">
              Your free account provides full daily price comparison across Booker, Parfetts, Bestway, and Costco.
            </p>
          </div>

          <button
            onClick={logout}
            className="px-4 py-2 bg-danger/10 border border-danger/30 text-danger hover:bg-danger/20 font-semibold text-xs rounded-xl transition-colors shrink-0 cursor-pointer flex items-center gap-1.5"
          >
            <LogOut size={15} />
            <span>Sign Out</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
          <div className="bg-[#0A0E0C] p-4 rounded-xl border border-border">
            <span className="text-textSecondary block mb-1">Access Status</span>
            <span className="font-semibold text-success flex items-center gap-1">
              <CheckCircle2 size={14} /> Active Free Pilot
            </span>
          </div>

          <div className="bg-[#0A0E0C] p-4 rounded-xl border border-border">
            <span className="text-textSecondary block mb-1">Scraper Frequency</span>
            <span className="font-semibold text-textPrimary">Daily 06:00 UTC</span>
          </div>

          <div className="bg-[#0A0E0C] p-4 rounded-xl border border-border">
            <span className="text-textSecondary block mb-1">Wholesaler Coverage</span>
            <span className="font-semibold text-textPrimary">Booker, Parfetts, Bestway, Costco</span>
          </div>
        </div>
      </div>

      {/* Business Details Card */}
      <div className="bg-surface border border-border rounded-2xl p-6 sm:p-8 space-y-6">
        <h2 className="font-sora font-semibold text-lg text-textPrimary border-b border-border pb-4">
          Retailer Store Profile
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
          <div>
            <label className="block text-xs font-mono font-semibold text-textSecondary mb-1.5 uppercase">Store / Business Name</label>
            <div className="flex items-center gap-2.5 p-3.5 bg-[#0A0E0C] border border-border rounded-xl font-medium text-textPrimary">
              <Building2 size={16} className="text-accent" />
              <span>{profile?.company_name || profile?.full_name || 'Independent Retailer'}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono font-semibold text-textSecondary mb-1.5 uppercase">Account Email</label>
            <div className="flex items-center gap-2.5 p-3.5 bg-[#0A0E0C] border border-border rounded-xl font-medium text-textPrimary">
              <Mail size={16} className="text-accent" />
              <span>{profile?.email || 'retailer@anaprice.co.uk'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Account;
