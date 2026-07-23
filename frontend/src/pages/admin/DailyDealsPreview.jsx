import React from 'react';
import { BadgePercent } from 'lucide-react';
import { EmptyState } from '../../components/UIComponents';

const DailyDealsPreview = () => (
  <div className="space-y-6">
    <div>
      <h1 className="font-sora font-bold text-xl text-textPrimary tracking-tight">Daily Deals Preview</h1>
      <p className="text-textSecondary text-sm mt-0.5">Review, edit and broadcast daily deal recommendations to subscribers.</p>
    </div>
    <EmptyState
      icon={BadgePercent}
      title="Daily deals will appear here after the deal engine is activated"
      description="Once supplier price comparisons are complete and the daily deal generation engine is deployed, recommended deals will appear here for review before broadcast."
    />
  </div>
);
export default DailyDealsPreview;
