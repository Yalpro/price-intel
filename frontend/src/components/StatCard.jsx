import React from 'react';

const StatCard = ({ icon: Icon, value, label, trend, trendLabel }) => {
  return (
    <div className="bg-surface border border-border rounded-lg p-5 shadow-sm hover:shadow-surface-raised transition-shadow duration-150">
      <div className="flex items-center justify-between mb-4">
        <div className="w-10 h-10 rounded-full bg-accentSoft flex items-center justify-center text-accent">
          <Icon size={20} strokeWidth={1.75} />
        </div>
        {trend && (
          <div className={`text-xs font-medium px-2 py-1 rounded-full ${trend > 0 ? 'bg-green-100 text-success' : 'bg-red-100 text-danger'}`}>
            {trend > 0 ? '+' : ''}{trend}%
          </div>
        )}
      </div>
      <div className="flex flex-col">
        <span className="font-mono text-3xl font-medium text-textPrimary">{value}</span>
        <span className="font-inter text-xs font-semibold tracking-wider text-textSecondary uppercase mt-1">
          {label}
        </span>
        {trendLabel && (
          <span className="text-xs text-textSecondary mt-2">
            {trendLabel}
          </span>
        )}
      </div>
    </div>
  );
};

export default StatCard;
