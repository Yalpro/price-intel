import React from 'react';
import { EmptyState } from '../components/UIComponents';
import { Activity } from 'lucide-react';

const ScraperMonitoring = () => {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-sora font-semibold text-textPrimary">Scraper Monitoring</h2>
      <EmptyState 
        icon={Activity}
        title="No scraper runs recorded"
        description="Trigger a new run from the Supplier Management page to see monitoring data here."
      />
    </div>
  );
};

export default ScraperMonitoring;
