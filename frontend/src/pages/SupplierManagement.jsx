import React, { useState, useEffect } from 'react';
import DataTable from '../components/DataTable';
import StatusBadge, { LiveStatusPulse } from '../components/UIComponents';
import { Play, Store, Loader2, Square, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { API_BASE_URL, fetchWithAuth } from '../config/apiConfig';

const SupplierManagement = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [runningSuppliers, setRunningSuppliers] = useState(new Set());
  const [stoppingSuppliers, setStoppingSuppliers] = useState(new Set());
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    setIsLoading(true);
    try {
      const [suppRes] = await Promise.all([
        supabase.from('suppliers').select('*').order('id')
      ]);

      if (suppRes.data) setSuppliers(suppRes.data);

      // Verify genuinely running in-memory scrapers via backend API
      try {
        const activeRes = await fetchWithAuth('/api/scrapers/active');
        if (activeRes.ok) {
          const activeData = await activeRes.json();
          if (activeData.activeSuppliers && suppRes.data) {
            const activeSet = new Set();
            suppRes.data.forEach(s => {
              if (activeData.activeSuppliers.includes(s.name.toLowerCase())) {
                activeSet.add(s.id);
              }
            });
            setRunningSuppliers(activeSet);
          }
        }
      } catch (e) {
        console.warn('In-memory active scraper check fallback:', e.message);
      }

    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunNow = async (supplier) => {
    if (runningSuppliers.has(supplier.id)) return;
    
    if (!confirm(`Start manual scraper run for ${supplier.name.toUpperCase()} against active database catalogue?`)) {
      return;
    }

    setRunningSuppliers(prev => new Set(prev).add(supplier.id));
    setFeedbackMsg(null);
    
    try {
      const response = await fetchWithAuth('/api/scrapers/run', {
        method: 'POST',
        body: JSON.stringify({ supplier: supplier.name })
      });
      
      const text = await response.text();
      let resData = {};
      try {
        resData = text ? JSON.parse(text) : {};
      } catch (e) {
        resData = { error: `Server response error (${response.status}): ${text}` };
      }

      if (!response.ok || resData.success === false) {
        throw new Error(resData.error || 'Failed to start run');
      }
      
      setFeedbackMsg({ type: 'success', text: `Scraper run started for ${supplier.name.toUpperCase()}!` });
      fetchSuppliers();
      
    } catch (err) {
      console.error(err);
      setFeedbackMsg({ type: 'error', text: err.message });
      setRunningSuppliers(prev => {
        const next = new Set(prev);
        next.delete(supplier.id);
        return next;
      });
    }
  };

  const handleStopNow = async (supplier) => {
    if (!confirm(`Stop the current ${supplier.name.toUpperCase()} scraper run?`)) {
      return;
    }

    setStoppingSuppliers(prev => new Set(prev).add(supplier.id));
    setFeedbackMsg(null);

    try {
      const response = await fetchWithAuth('/api/scrapers/stop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ supplier: supplier.name })
      });

      const text = await response.text();
      let resData = {};
      try {
        resData = text ? JSON.parse(text) : {};
      } catch (e) {
        resData = { error: `Server response error (${response.status}): ${text}` };
      }

      if (!response.ok || resData.success === false) {
        throw new Error(resData.error || 'Failed to stop scraper');
      }

      setFeedbackMsg({ type: 'success', text: resData.message || `Scraper run for ${supplier.name.toUpperCase()} stopped cleanly.` });
      setRunningSuppliers(prev => {
        const next = new Set(prev);
        next.delete(supplier.id);
        return next;
      });
      fetchSuppliers();

    } catch (err) {
      console.error(err);
      setFeedbackMsg({ type: 'error', text: err.message });
    } finally {
      setStoppingSuppliers(prev => {
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
          <div className="w-8 h-8 rounded-xl bg-[#0A0E0C] border border-border flex items-center justify-center text-accentMint font-bold">
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
        <span className="text-textSecondary text-xs font-mono bg-[#0A0E0C] px-2.5 py-1 rounded-lg border border-border">
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
        const isStopping = stoppingSuppliers.has(row.id);
        
        return (
          <div className="flex justify-end items-center gap-3">
            {isRunning && <LiveStatusPulse isActive={true} colorClass="bg-warning" />}
            {isRunning ? (
              <button
                onClick={() => handleStopNow(row)}
                disabled={isStopping}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-danger/20 text-danger border border-danger/40 hover:bg-danger/30 transition-colors cursor-pointer"
              >
                {isStopping ? <Loader2 size={14} className="animate-spin" /> : <Square size={14} className="fill-current" />}
                <span>{isStopping ? 'Stopping...' : 'Stop Scraper'}</span>
              </button>
            ) : (
              <button
                onClick={() => handleRunNow(row)}
                disabled={!row.active}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  !row.active 
                    ? 'bg-[#0A0E0C] text-textSecondary cursor-not-allowed border border-border'
                    : 'bg-accent/10 text-accentMint border border-emerald-800/60 hover:bg-savingBg'
                }`}
              >
                <Play size={14} />
                <span>Run Now</span>
              </button>
            )}
          </div>
        );
      }
    }
  ];

  return (
    <div className="space-y-6 max-w-5xl font-inter">
      <div className="flex justify-between items-center bg-surface p-6 rounded-2xl border border-border">
        <div>
          <h2 className="text-xl font-sora font-bold text-textPrimary tracking-tight">Supplier Management</h2>
          <p className="text-xs text-textSecondary mt-0.5">Manage connected wholesale cash & carry suppliers and trigger manual execution</p>
        </div>
      </div>

      {feedbackMsg && (
        <div className={`p-4 rounded-xl flex items-center justify-between text-xs font-semibold ${
          feedbackMsg.type === 'success' ? 'bg-savingBg text-accentMint border border-emerald-800' : 'bg-danger/10 text-danger border border-danger/30'
        }`}>
          <div className="flex items-center gap-2">
            {feedbackMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            <span>{feedbackMsg.text}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="text-xs opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      <div className="bg-surface border border-border rounded-2xl p-6 min-h-[400px]">
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
