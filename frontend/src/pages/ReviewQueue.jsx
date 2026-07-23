import React from 'react';
import { Sparkles } from 'lucide-react';
import { EmptyState } from '../components/UIComponents';

const ReviewQueue = () => {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-sora font-semibold text-textPrimary tracking-tight">Review Queue</h2>
      
      <div className="mt-8">
        <EmptyState 
          icon={Sparkles}
          title="Coming Soon"
          description="The Review Queue will activate once the AI Product Matching module is deployed. It will allow you to manually review and approve ambiguous matches."
        />
      </div>
    </div>
  );
};

export default ReviewQueue;
