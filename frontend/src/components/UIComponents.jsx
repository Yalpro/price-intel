import React from 'react';

export const StatusBadge = ({ status, type = 'default' }) => {
  const getColors = () => {
    switch (type) {
      case 'success': return 'bg-green-100 text-success border border-green-200';
      case 'warning': return 'bg-orange-100 text-warning border border-orange-200';
      case 'danger': return 'bg-red-100 text-danger border border-red-200';
      case 'info': return 'bg-blue-100 text-info border border-blue-200';
      default: return 'bg-gray-100 text-textSecondary border border-gray-200';
    }
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium font-inter ${getColors()}`}>
      {status}
    </span>
  );
};

export const LiveStatusPulse = ({ isActive, colorClass = 'bg-success' }) => {
  if (!isActive) return <div className="w-1.5 h-1.5 rounded-full bg-gray-300"></div>;
  
  return (
    <div className="relative flex items-center justify-center w-2 h-2">
      <div className={`absolute w-full h-full rounded-full opacity-75 animate-pulse ${colorClass}`}></div>
      <div className={`relative w-1.5 h-1.5 rounded-full ${colorClass}`}></div>
    </div>
  );
};

export const EmptyState = ({ icon: Icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center p-8 text-center bg-surface border border-border rounded-lg min-h-[300px]">
    {Icon && <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center text-textSecondary mb-4"><Icon size={24} strokeWidth={1.5} /></div>}
    <h3 className="text-base font-semibold text-textPrimary font-inter mb-1">{title}</h3>
    <p className="text-sm text-textSecondary max-w-sm mb-6">{description}</p>
    {action && <div>{action}</div>}
  </div>
);

export const ErrorState = ({ title = "Error loading data", message }) => (
  <div className="bg-red-50 border border-red-200 rounded-lg p-6 flex flex-col items-center justify-center text-center">
    <div className="text-danger font-semibold mb-2">{title}</div>
    <div className="text-sm text-red-700 font-mono bg-red-100/50 p-3 rounded text-left max-w-full overflow-x-auto border border-red-100">
      {message}
    </div>
  </div>
);

export default StatusBadge;
