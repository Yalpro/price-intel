import React, { useState, useEffect } from 'react';
import DataTable from '../components/DataTable';
import StatusBadge, { LiveStatusPulse } from '../components/UIComponents';
import { Play, Store, Loader2 } from 'lucide-react';
import { supabase } from '../supabaseClient';

const SupplierManagement = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [runningSuppliers, setRunningSuppliers] = useState(new Set());

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('suppliers').select('*').order('id');
      if (data) setSuppliers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunNow = async (supplier) => {
    if (runningSuppliers.has(supplier.id)) return;
    
    setRunningSuppliers(prev => new Set(prev).add(supplier.id));
    
    try {
      // Call backend API
      const response = await fetch(`/api/scrapers/${supplier.name}/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to start run');
      
      // In a real implementation, we would poll /api/scrapers/:supplier/status
      // For now, we simulate completion after some time
      setTimeout(() => {
        setRunningSuppliers(prev => {
          const next = new Set(prev);
          next.delete(supplier.id);
          return next;
        });
      }, 5000);
      
    } catch (err) {
      console.error(err);
      alert(`Failed to start scraper for ${supplier.name}`);
      setRunningSuppliers(prev => {
        const next = new Set(prev);
        next.delete(supplier.id);
        return next;
      });
    }
  };

  const tableColumns = [
    { 
      header: 'Supplier Name', 
      accessor: 'name',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-textSecondary">
            <Store size={16} />
          </div>
          <span className="capitalize font-semibold text-textPrimary">{row.name}</span>
        </div>
      )
    },
    { 
      header: 'Type', 
      accessor: 'type',
      render: (row) => <StatusBadge status={row.type} type={row.type === 'wholesaler' ? 'info' : 'default'} />
    },
    { 
      header: 'Status', 
      accessor: 'active',
      render: (row) => <StatusBadge status={row.active ? 'Active' : 'Inactive'} type={row.active ? 'success' : 'default'} />
    },
    {
      header: 'Config (Branch/Depot)',
      accessor: 'config',
      render: (row) => (
        <span className="text-textSecondary text-sm font-mono bg-gray-50 px-2 py-1 rounded border border-border">
          {row.connector_config ? JSON.stringify(row.connector_config) : '{}'}
        </span>
      )
    },
    {
      header: 'Actions',
      accessor: 'actions',
      align: 'right',
      render: (row) => {
        const isRunning = runningSuppliers.has(row.id);
        
        return (
          <div className="flex justify-end items-center gap-3">
            {isRunning && <LiveStatusPulse isActive={true} colorClass="bg-warning" />}
            <button
              onClick={() => handleRunNow(row)}
              disabled={isRunning || !row.active}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                isRunning 
                  ? 'bg-gray-100 text-textSecondary cursor-not-allowed'
                  : !row.active 
                    ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                    : 'bg-accent/10 text-accent hover:bg-accent/20'
              }`}
            >
              {isRunning ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              {isRunning ? 'Running...' : 'Run Now'}
            </button>
          </div>
        );
      }
    }
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="h-[600px]">
        <DataTable 
          columns={tableColumns} 
          data={suppliers} 
          isLoading={isLoading} 
          emptyState={<div className="text-textSecondary">No suppliers configured.</div>}
        />
      </div>
    </div>
  );
};

export default SupplierManagement;
