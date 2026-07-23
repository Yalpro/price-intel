import React from 'react';
import { Bell } from 'lucide-react';
import { EmptyState } from '../../components/UIComponents';

const PriceAlerts = () => (
  <div className="space-y-6 max-w-4xl">
    <div>
      <h1 className="font-sora font-bold text-2xl text-textPrimary tracking-tight">Price Alerts</h1>
      <p className="text-textSecondary text-sm mt-1">Get notified when products drop below your target price or promotions become available.</p>
    </div>

    {/* Alert type info */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {[
        { label: 'Price below target', desc: 'Alert when a product drops below a set price.' },
        { label: 'Percentage drop', desc: 'Alert when a price falls by more than X%.' },
        { label: 'New promotion', desc: 'Alert when a supplier adds a promotional price.' },
        { label: 'Supplier cheapest', desc: 'Alert when your preferred supplier becomes cheapest.' },
        { label: 'Back in stock', desc: 'Alert when an out-of-stock product is available again.' },
      ].map(t => (
        <div key={t.label} className="bg-surface border border-border rounded-lg p-4">
          <p className="font-medium text-textPrimary text-sm mb-1">{t.label}</p>
          <p className="text-xs text-textSecondary">{t.desc}</p>
        </div>
      ))}
    </div>

    <EmptyState
      icon={Bell}
      title="No active price alerts"
      description="Save products first, then configure price alerts on your saved items. Alert delivery (email/Telegram) is coming soon."
    />
  </div>
);
export default PriceAlerts;
