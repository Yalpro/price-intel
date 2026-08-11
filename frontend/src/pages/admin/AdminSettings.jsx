import React, { useState } from 'react';
import { Settings, ShieldAlert, CheckCircle2 } from 'lucide-react';

const Section = ({ title, children }) => (
  <div className="bg-surface border border-border rounded-2xl p-6 space-y-4">
    <h2 className="font-sora font-semibold text-base text-textPrimary tracking-tight">{title}</h2>
    {children}
  </div>
);

const FieldRow = ({ label, hint, children }) => (
  <div className="flex flex-col sm:flex-row sm:items-center gap-2 py-3 border-b border-border last:border-0">
    <div className="sm:w-64 shrink-0">
      <p className="text-sm font-medium text-textPrimary">{label}</p>
      {hint && <p className="text-xs text-textSecondary mt-0.5">{hint}</p>}
    </div>
    <div className="flex-1">{children}</div>
  </div>
);

const AdminSettings = () => {
  const [saved, setSaved] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-3xl font-inter">
      <div>
        <h1 className="font-sora font-bold text-xl text-textPrimary tracking-tight">Admin System Settings</h1>
        <p className="text-textSecondary text-sm mt-0.5">Platform configuration, catalogue source mode, and operational defaults.</p>
      </div>

      {/* Security Banner */}
      <div className="flex items-start gap-3 bg-[#0A0E0C] border border-border rounded-2xl p-4">
        <ShieldAlert size={18} className="text-accentMint shrink-0 mt-0.5" />
        <p className="text-xs text-textSecondary leading-relaxed">
          Supplier credentials, API keys, and service-role secrets are managed exclusively in server-side environment variables (`SCRAPER_API_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`). They are never exposed to browser code.
        </p>
      </div>

      {saved && (
        <div className="p-4 bg-savingBg border border-emerald-800 text-accentMint text-xs font-mono font-semibold rounded-xl flex items-center gap-2">
          <CheckCircle2 size={16} />
          <span>Operational settings saved successfully!</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <Section title="Database & Scraper Operational Mode">
          <FieldRow label="Catalogue Mode" hint="Production scrapers read active DB catalogue">
            <span className="font-mono text-xs text-accentMint bg-savingBg px-3 py-1 rounded-lg border border-emerald-800 font-bold">
              CATALOGUE_SOURCE=database
            </span>
          </FieldRow>

          <FieldRow label="Wholesalers Active" hint="Supported cash & carry scrapers">
            <div className="flex flex-wrap gap-2 text-xs font-mono">
              <span className="bg-[#0A0E0C] text-accentMint border border-border px-2.5 py-1 rounded-lg">Booker</span>
              <span className="bg-[#0A0E0C] text-accentMint border border-border px-2.5 py-1 rounded-lg">Parfetts</span>
              <span className="bg-[#0A0E0C] text-accentMint border border-border px-2.5 py-1 rounded-lg">Costco</span>
              <span className="bg-[#0A0E0C] text-accentMint border border-border px-2.5 py-1 rounded-lg">Bestway</span>
            </div>
          </FieldRow>
        </Section>

        <Section title="Validation Thresholds">
          <FieldRow label="Match Success Score" hint="Minimum validation score to record SUCCESS (Default: 90)">
            <input 
              type="number" 
              defaultValue={90} 
              disabled
              className="w-24 px-3 py-2 bg-[#0A0E0C] border border-border rounded-xl text-textPrimary text-sm font-mono opacity-80 cursor-not-allowed" 
            />
          </FieldRow>
          <FieldRow label="Ambiguous Match Score" hint="Score threshold for Review Queue flagging (Default: 60)">
            <input 
              type="number" 
              defaultValue={60} 
              disabled
              className="w-24 px-3 py-2 bg-[#0A0E0C] border border-border rounded-xl text-textPrimary text-sm font-mono opacity-80 cursor-not-allowed" 
            />
          </FieldRow>
        </Section>

        <Section title="Default Retailer Registration Access">
          <FieldRow label="New Account Status" hint="Initial status assigned to newly registered retailers">
            <select className="px-3 py-2 bg-[#0A0E0C] border border-border rounded-xl text-textPrimary text-sm focus:outline-none focus:border-accent">
              <option value="trial">Trial (Free Pilot Access)</option>
              <option value="pending">Pending (Manual approval)</option>
            </select>
          </FieldRow>
        </Section>

        <div className="flex justify-end">
          <button 
            type="submit" 
            className="px-6 py-3 bg-accent hover:bg-accentHover text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Save Settings
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdminSettings;
