import React from 'react';
import { Settings, ShieldAlert } from 'lucide-react';

const Section = ({ title, children }) => (
  <div className="bg-surface border border-border rounded-lg p-6 space-y-4">
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

const AdminSettings = () => (
  <div className="space-y-6 max-w-3xl">
    <div>
      <h1 className="font-sora font-bold text-xl text-textPrimary tracking-tight">Admin Settings</h1>
      <p className="text-textSecondary text-sm mt-0.5">Platform configuration and operational defaults.</p>
    </div>

    {/* Security Warning */}
    <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-lg p-4">
      <ShieldAlert size={18} strokeWidth={1.75} className="text-warning shrink-0 mt-0.5" />
      <p className="text-sm text-textPrimary">
        Supplier credentials, API keys and service-role secrets are managed exclusively in server-side environment variables. They are not accessible or configurable from this interface.
      </p>
    </div>

    <Section title="Validation Thresholds">
      <FieldRow label="Success threshold" hint="Minimum validation score to classify as SUCCESS">
        <input type="number" defaultValue={90} min={0} max={100} className="w-24 px-3 py-2 border border-border rounded-md text-textPrimary text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
      </FieldRow>
      <FieldRow label="Ambiguous threshold" hint="Scores below this but above rejection are flagged for manual review">
        <input type="number" defaultValue={60} min={0} max={100} className="w-24 px-3 py-2 border border-border rounded-md text-textPrimary text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
      </FieldRow>
    </Section>

    <Section title="Catalogue Settings">
      <FieldRow label="Default new account status" hint="Status assigned to newly registered retailer accounts">
        <select className="px-3 py-2 border border-border rounded-md text-textPrimary text-sm focus:outline-none focus:ring-2 focus:ring-accent bg-surface">
          <option value="pending">Pending (requires manual activation)</option>
          <option value="trial">Trial (immediate access)</option>
        </select>
      </FieldRow>
    </Section>

    <Section title="Admin User Management">
      <p className="text-sm text-textSecondary">
        Admin users are defined in the <code className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-xs">profiles</code> table with role = 'admin' or 'manager'. 
        New admin accounts must be created directly in Supabase Auth and then inserted into the profiles table with the appropriate role.
      </p>
    </Section>

    <div className="flex justify-end">
      <button className="px-5 py-2.5 bg-accent text-white text-sm font-semibold rounded-lg hover:bg-teal-800 transition-colors">
        Save Settings
      </button>
    </div>
  </div>
);
export default AdminSettings;
