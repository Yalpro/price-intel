import React from 'react';
import { LineChart } from 'lucide-react';
import { EmptyState } from '../../components/UIComponents';

const PriceHistory = () => (
  <div className="space-y-6 max-w-5xl">
    <div>
      <h1 className="font-sora font-bold text-2xl text-textPrimary tracking-tight">Price History</h1>
      <p className="text-textSecondary text-sm mt-1">Track supplier price movements over time for any product in the catalogue.</p>
    </div>
    <EmptyState
      icon={LineChart}
      title="Select a product to view its price history"
      description="Price history charts will appear here once at least two data collection cycles have completed for a product. More history becomes available as daily data collection continues."
    />
  </div>
);
export default PriceHistory;
