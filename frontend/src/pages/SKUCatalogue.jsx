import React from 'react';
import { EmptyState } from '../components/UIComponents';
import { BookOpen, Upload } from 'lucide-react';

const SKUCatalogue = () => {
  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-sora font-semibold text-textPrimary">SKU Catalogue Versioning</h2>
      </div>

      <div className="bg-surface border border-border rounded-lg p-8 border-dashed flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors">
        <div className="w-12 h-12 bg-accentSoft rounded-full flex items-center justify-center text-accent mb-4">
          <Upload size={24} />
        </div>
        <h3 className="text-base font-semibold text-textPrimary mb-1">Upload Top 1000 CSV</h3>
        <p className="text-sm text-textSecondary text-center max-w-md">
          Drag and drop your monthly Top 1000 product list here to create a new catalogue version. 
          The system will automatically validate barcodes and detect missing names.
        </p>
      </div>

      <EmptyState 
        icon={BookOpen}
        title="No catalogue versions"
        description="Upload a CSV file to create your first active catalogue version for scraping."
      />
    </div>
  );
};

export default SKUCatalogue;
