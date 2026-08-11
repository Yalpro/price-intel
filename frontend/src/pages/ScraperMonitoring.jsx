import React, { useState, useEffect } from 'react';
import DataTable from '../components/DataTable';
import StatusBadge, { LiveStatusPulse, EmptyState } from '../components/UIComponents';
import { Activity, Play, RefreshCw, AlertTriangle, CheckCircle2, Clock, Loader2, Square } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { API_BASE_URL, fetchWithAuth } from '../config/apiConfig';

const ScraperMonitoring = () => {
  const [runs, setRuns] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [runningSuppliers, setRunningSuppliers] = useState(new Set());
  const [selectedErrorLog, setSelectedErrorLog] = useState(null);
  const [feedbackMsg, setFeedbackMsg] = useState(null);
  const [stoppingSuppliers, setStoppingSuppliers] = useState(new Set());

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [runsRes, suppRes] = await Promise.all([
        supabase
          .from('scraper_runs')
          .select('*, suppliers(id, name)')
          .order('id', { ascending: false })
          .limit(50),
        supabase
          .from('suppliers')
          .select('*')
          .eq('active', true)
          .order('name')
      ]);

      if (runsRes.data) setRuns(runsRes.data);
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
      console.error('Failed to fetch scraper runs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunSupplier = async (supplier) => {
    if (runningSuppliers.has(supplier.id)) return;

    if (!confirm(`Start manual scraper run for ${supplier.name.toUpperCase()} against active database catalogue?`)) {
      return;
    }

    setRunningSuppliers(prev => new Set(prev).add(supplier.id));
    setFeedbackMsg(null);

    try {
      const res = await fetchWithAuth('/api/scrapers/run', {
        method: 'POST',
        body: JSON.stringify({
          supplier: supplier.name
        })
      });

      const text = await res.text();
      let resData = {};
      try {
        resData = text ? JSON.parse(text) : {};
      } catch (e) {
        resData = { error: `Server response error (${res.status}): ${text}` };
      }

      if (res.ok && resData.success !== false) {
        setFeedbackMsg({ type: 'success', text: `Scraper run started for ${supplier.name.toUpperCase()}!` });
        fetchData();
      } else {
        setFeedbackMsg({ type: 'error', text: resData.error || `Failed to start ${supplier.name} scraper.` });
        setRunningSuppliers(prev => {
          const next = new Set(prev);
          next.delete(supplier.id);
          return next;
        });
      }
    } catch (err) {
      setFeedbackMsg({ type: 'error', text: err.message });
      setRunningSuppliers(prev => {
        const next = new Set(prev);
        next.delete(supplier.id);
        return next;
      });
    }
  };

  const handleStopSupplier = async (supplier) => {
    if (!confirm(`Stop the current ${supplier.name.toUpperCase()} scraper run?`)) {
      return;
    }

    setStoppingSuppliers(prev => new Set(prev).add(supplier.id));
    setFeedbackMsg(null);

    try {
      const res = await fetchWithAuth('/api/scrapers/stop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          supplier: supplier.name
        })
      });

      const text = await res.text();
      let resData = {};
      try {
        resData = text ? JSON.parse(text) : {};
      } catch (e) {
        resData = { error: `Server response error (${res.status}): ${text}` };
      }

      if (res.ok && resData.success !== false) {
        setFeedbackMsg({ type: 'success', text: resData.message || `Scraper run for ${supplier.name.toUpperCase()} stopped cleanly.` });
        setRunningSuppliers(prev => {
          const next = new Set(prev);
          next.delete(supplier.id);
          return next;
        });
        fetchData();
      } else {
        setFeedbackMsg({ type: 'error', text: resData.error || `Failed to stop ${supplier.name} scraper.` });
      }
    } catch (err) {
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
      header: 'Run ID',
      accessor: 'id',
      isNumeric: true,
      render: (row) => <span className="font-mono text-xs text-textSecondary">#{row.id}</span>
    },
    {
      header: 'Supplier',
      accessor: 'supplier',
      render: (row) => (
        <div className="flex items-center gap-2">
          <LiveStatusPulse 
            isActive={row.status === 'running'} 
            colorClass={row.status === 'failed' || row.status === 'cancelled' ? 'bg-danger' : row.status === 'running' ? 'bg-warning' : 'bg-success'} 
          />
          <span className="capitalize font-semibold text-textPrimary">{row.suppliers?.name || 'Unknown'}</span>
        </div>
      )
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => {
        let type = 'default';
        let label = row.status;
        if (row.log && row.log.toLowerCase().includes('cancelled')) {
          label = 'cancelled';
          type = 'danger';
        } else if (row.status === 'success' || row.status === 'completed') {
          type = 'success';
        } else if (row.status === 'failed') {
          type = 'danger';
        } else if (row.status === 'running') {
          type = 'warning';
        }
        return <StatusBadge status={label} type={type} />;
      }
    },
    {
      header: 'Attempted / Matched',
      accessor: 'counts',
      render: (row) => (
        <div className="font-mono text-xs">
          <span className="text-textPrimary">{row.attempted_count || 0} attempted</span>
          <span className="text-accentMint font-semibold ml-2">({row.successful_price_count || 0} matched)</span>
        </div>
      )
    },
    {
      header: 'Errors',
      accessor: 'error_count',
      isNumeric: true,
      render: (row) => (
        <span className={row.error_count > 0 ? 'text-danger font-semibold font-mono' : 'text-textSecondary font-mono'}>
          {row.error_count || 0}
        </span>
      )
    },
    {
      header: 'Duration',
      accessor: 'duration_seconds',
      isNumeric: true,
      render: (row) => <span className="font-mono text-xs text-textSecondary">{row.duration_seconds ? `${row.duration_seconds}s` : '—'}</span>
    },
    {
      header: 'Started At',
      accessor: 'started_at',
      isNumeric: true,
      render: (row) => new Date(row.started_at).toLocaleString()
    },
    {
      header: 'Logs / Details',
      accessor: 'details',
      align: 'right',
      render: (row) => (
        <div>
          {row.error_message || row.log ? (
            <button
              onClick={() => setSelectedErrorLog(row)}
              className="text-xs text-danger hover:underline font-mono"
            >
              View Log
            </button>
          ) : (
            <span className="text-xs text-textSecondary font-mono">—</span>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6 max-w-6xl font-inter">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface p-6 rounded-2xl border border-border">
        <div>
          <h2 className="text-xl font-sora font-bold text-textPrimary tracking-tight">Scraper Runs & Monitoring</h2>
          <p className="text-sm text-textSecondary mt-0.5">Real-time database monitoring and graceful execution control for cash & carry scrapers</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="p-2.5 bg-[#0A0E0C] hover:bg-[#1A221D] border border-border text-textPrimary rounded-xl transition-colors flex items-center gap-2 text-xs font-semibold"
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Execution & Stop Control Action Bar */}
      <div className="bg-surface border border-border p-6 rounded-2xl space-y-4">
        <h3 className="text-xs font-mono font-semibold uppercase text-textSecondary tracking-wider">
          Scraper Execution Controls (Active Database Catalogue)
        </h3>

        <div className="flex flex-wrap gap-3">
          {suppliers.map((s) => {
            const isRunning = runningSuppliers.has(s.id);
            const isStopping = stoppingSuppliers.has(s.id);

            return (
              <div key={s.id} className="flex items-center gap-2">
                {isRunning ? (
                  <button
                    onClick={() => handleStopSupplier(s)}
                    disabled={isStopping}
                    className="px-4 py-2.5 rounded-xl font-semibold text-xs transition-all flex items-center gap-2 cursor-pointer bg-danger/20 text-danger border border-danger/40 hover:bg-danger/30 shadow-sm"
                  >
                    {isStopping ? <Loader2 size={14} className="animate-spin" /> : <Square size={14} className="fill-current" />}
                    <span>{isStopping ? `Stopping ${s.name.toUpperCase()}...` : `Stop ${s.name.toUpperCase()}`}</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleRunSupplier(s)}
                    className="px-4 py-2.5 rounded-xl font-semibold text-xs transition-all flex items-center gap-2 cursor-pointer bg-accent hover:bg-accentHover text-white shadow-sm"
                  >
                    <Play size={14} />
                    <span>Run {s.name.toUpperCase()}</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackMsg && (
        <div className={`p-4 rounded-xl flex items-center justify-between ${
          feedbackMsg.type === 'success' ? 'bg-savingBg border border-emerald-800 text-accentMint' : 'bg-danger/10 border border-danger/30 text-danger'
        }`}>
          <div className="flex items-center gap-2 text-sm font-semibold">
            {feedbackMsg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <span>{feedbackMsg.text}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="text-xs opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Main Scraper Runs Table */}
      <div className="bg-surface border border-border rounded-2xl p-6 space-y-4">
        <h3 className="font-sora font-semibold text-textPrimary text-base">Execution History</h3>
        
        <div className="min-h-[400px]">
          <DataTable
            columns={tableColumns}
            data={runs}
            isLoading={isLoading}
            emptyState={
              <EmptyState
                icon={Activity}
                title="No scraper runs recorded"
                description="Click one of the 'Run Supplier' buttons above to trigger a controlled database-driven scraper run."
              />
            }
          />
        </div>
      </div>

      {/* Error / Cancellation Log Modal */}
      {selectedErrorLog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-surface border border-border rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex justify-between items-start border-b border-border pb-3">
              <div>
                <h4 className="font-sora font-bold text-lg text-textPrimary">Scraper Run Log #{selectedErrorLog.id}</h4>
                <p className="text-xs text-textSecondary font-mono">{selectedErrorLog.suppliers?.name?.toUpperCase()} — {new Date(selectedErrorLog.started_at).toLocaleString()}</p>
              </div>
              <button onClick={() => setSelectedErrorLog(null)} className="text-textSecondary hover:text-textPrimary p-1">✕</button>
            </div>

            <div className="bg-[#0A0E0C] border border-border p-4 rounded-xl font-mono text-xs text-danger overflow-x-auto max-h-60">
              {selectedErrorLog.error_message || selectedErrorLog.log || 'No detailed error stack recorded.'}
            </div>

            <div className="flex justify-end pt-2">
              <button onClick={() => setSelectedErrorLog(null)} className="px-4 py-2 bg-[#1A221D] text-textPrimary text-xs font-semibold rounded-xl">
                Close Log
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScraperMonitoring;
