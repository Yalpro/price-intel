import React from 'react';
import { BadgePercent } from 'lucide-react';
import { EmptyState } from '../../components/UIComponents';

const DailyDeals = () => (
  <div className="space-y-6 max-w-4xl">
    <div>
      <h1 className="font-sora font-bold text-2xl text-textPrimary tracking-tight">Daily Deals</h1>
      <p className="text-textSecondary text-sm mt-1">The best wholesale buying opportunities updated daily.</p>
    </div>
    <EmptyState
      icon={BadgePercent}
      title="Daily deals not yet available"
      description="Deal recommendations will appear here once supplier price comparisons are complete and the daily deal engine is activated. Check back soon."
    />
  </div>
);
export default DailyDeals;
