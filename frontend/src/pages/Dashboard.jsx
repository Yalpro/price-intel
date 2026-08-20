import React, { useState, useEffect } from 'react';
import StatCard from '../components/StatCard';
import DataTable from '../components/DataTable';
import StatusBadge, { LiveStatusPulse } from '../components/UIComponents';
import { Package, Boxes, History, Activity, AlertTriangle, CheckCircle2, RefreshCw, BarChart2, ShieldCheck, Zap } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { formatDateTime } from '../utils/formatters';

const Dashboard = () => {
  const [stats, setStats] = useState({
    activeCatalogueSkus: 0,
    verifiedToday: 0,
    needsReview: 0,
    notFound: 0,
    failedSuppliers: 0,
    dailyDealsOpportunities: 0,
    latestRunStatus: 'SUCCESS'
  });

  const [supplierHealth, setSupplierHealth] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/catalogues/dashboard-stats');
      if (res.ok) {
        const data = await res.json();
        if (data.kpis) setStats(data.kpis);
        if (data.supplierHealth) setSupplierHealth(data.supplierHealth);
      }
    } catch (err) {
      console.error('Failed to load operational dashboard stats:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const supplierColumns = [
    {
      header: 'Supplier Name',
      accessor: 'supplierName',
      render: (r) => (
        <div className="flex items-center gap-2">
          <LiveStatusPulse
            isActive={r.healthStatus === 'RUNNING'}
            colorClass={r.healthStatus === 'FAILED' ? 'bg-danger' : r.healthStatus === 'RUNNING' ? 'bg-warning' : 'bg-success'}
          />
          <span className="font-sora font-bold text-xs text-textPrimary">{r.supplierName}</span>
        </div>
      )
    },
    {
      header: 'Health Status',
      accessor: 'healthStatus',
      render: (r) => {
        let type = 'default';
        if (r.healthStatus === 'SUCCESS') type = 'success';
        if (r.healthStatus === 'FAILED') type = 'danger';
        if (r.healthStatus === 'RUNNING') type = 'warning';
        return <StatusBadge status={r.healthStatus} type={type} />;
      }
    },
    { header: 'Last Run At', accessor: 'lastRunAt', isNumeric: true, render: (r) => <span className="text-xs text-textSecondary">{formatDateTime(r.lastRunAt)}</span> },
    { header: 'Duration', accessor: 'durationSeconds', isNumeric: true, render: (r) => <span className="font-mono text-xs text-textSecondary">{r.durationSeconds ? `${r.durationSeconds}s` : '—'}</span> },
    { header: 'Attempted', accessor: 'attempted', isNumeric: true, align: 'right', render: (r) => <span className="font-mono text-xs text-textPrimary">{r.attempted}</span> },
    { header: 'Verified Prices', accessor: 'successful', isNumeric: true, align: 'right', render: (r) => <span className="font-mono text-xs text-accentMint font-semibold">{r.successful}</span> },
    { header: 'Errors', accessor: 'errors', isNumeric: true, align: 'right', render: (r) => <span className={`font-mono text-xs ${r.errors > 0 ? 'text-danger font-bold' : 'text-textSecondary'}`}>{r.errors}</span> }
  ];

  return (
    <div className="space-y-6 max-w-6xl font-inter">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-surface p-6 rounded-2xl border border-border gap-4">
        <div>
          <h2 className="text-xl font-sora font-bold text-textPrimary tracking-tight">Production Operations Dashboard</h2>
          <p className="text-sm text-textSecondary mt-0.5">Real-time wholesaler scraper health, verification coverage, and review queue workload</p>
        </div>
        <button onClick={fetchDashboardData} className="p-2 bg-[#0A0E0C] hover:bg-[#1A221D] border border-border text-textPrimary rounded-xl text-xs font-semibold flex items-center gap-2">
          <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface border border-border p-4 rounded-2xl space-y-1">
          <div className="text-xs text-textSecondary flex items-center justify-between font-medium">
            <span>Active Catalogue SKUs</span>
            <Boxes size={16} className="text-accentMint" />
          </div>
          <div className="text-2xl font-sora font-bold text-textPrimary tracking-tight">{stats.activeCatalogueSkus}</div>
          <div className="text-[11px] text-accentMint font-semibold">Active Catalogue Version 5</div>
        </div>

        <div className="bg-surface border border-border p-4 rounded-2xl space-y-1">
          <div className="text-xs text-textSecondary flex items-center justify-between font-medium">
            <span>Verified Prices Today</span>
            <ShieldCheck size={16} className="text-accentMint" />
          </div>
          <div className="text-2xl font-sora font-bold text-accentMint tracking-tight">{stats.verifiedToday}</div>
          <div className="text-[11px] text-textSecondary">Deterministic + AI Verified</div>
        </div>

        <div className="bg-surface border border-border p-4 rounded-2xl space-y-1">
          <div className="text-xs text-textSecondary flex items-center justify-between font-medium">
            <span>Needs Review</span>
            <AlertTriangle size={16} className="text-warning" />
          </div>
          <div className="text-2xl font-sora font-bold text-warning tracking-tight">{stats.needsReview}</div>
          <div className="text-[11px] text-textSecondary">Human Decision Queue</div>
        </div>

        <div className="bg-surface border border-border p-4 rounded-2xl space-y-1">
          <div className="text-xs text-textSecondary flex items-center justify-between font-medium">
            <span>Failed Suppliers</span>
            <Activity size={16} className={stats.failedSuppliers > 0 ? 'text-danger' : 'text-accentMint'} />
          </div>
          <div className={`text-2xl font-sora font-bold tracking-tight ${stats.failedSuppliers > 0 ? 'text-danger' : 'text-textPrimary'}`}>{stats.failedSuppliers}</div>
          <div className="text-[11px] text-textSecondary">Degraded Connector Runs</div>
        </div>
      </div>

      {/* Operational Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Chart A */}
        <div className="bg-surface border border-border p-5 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-sora font-bold text-xs text-textPrimary uppercase tracking-wider">7-Day Scraper Health</h3>
            <BarChart2 size={15} className="text-accentMint" />
          </div>
          <div className="h-32 flex items-end justify-between gap-2 pt-4 px-2">
            {[95, 100, 88, 100, 100, 92, 100].map((val, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full bg-accentMint/20 hover:bg-accentMint/40 rounded-t-sm transition-all" style={{ height: `${val}%` }}>
                  <div className="w-full bg-accentMint rounded-t-sm" style={{ height: `${val * 0.8}%` }}></div>
                </div>
                <span className="text-[10px] font-mono text-textSecondary">D{idx + 1}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Chart B */}
        <div className="bg-surface border border-border p-5 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-sora font-bold text-xs text-textPrimary uppercase tracking-wider">Supplier Coverage</h3>
            <ShieldCheck size={15} className="text-accentMint" />
          </div>
          <div className="space-y-3 pt-2">
            {[
              { name: 'BESTWAY', pct: 98 },
              { name: 'COSTCO', pct: 95 },
              { name: 'PARFETTS', pct: 92 },
              { name: 'BOOKER', pct: 99 },
            ].map(s => (
              <div key={s.name} className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-textPrimary">{s.name}</span>
                  <span className="text-accentMint font-mono">{s.pct}%</span>
                </div>
                <div className="w-full bg-[#0A0E0C] h-2 rounded-full overflow-hidden border border-border">
                  <div className="bg-accentMint h-full rounded-full" style={{ width: `${s.pct}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chart C */}
        <div className="bg-surface border border-border p-5 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-sora font-bold text-xs text-textPrimary uppercase tracking-wider">Review Workload Trend</h3>
            <Zap size={15} className="text-warning" />
          </div>
          <div className="space-y-3 pt-2 text-xs">
            <div className="flex justify-between items-center p-2.5 bg-[#0A0E0C] rounded-xl border border-border">
              <span className="text-textSecondary font-medium">Needs Review</span>
              <span className="font-mono font-bold text-warning">{stats.needsReview} SKUs</span>
            </div>
            <div className="flex justify-between items-center p-2.5 bg-[#0A0E0C] rounded-xl border border-border">
              <span className="text-textSecondary font-medium">Search Exhausted</span>
              <span className="font-mono font-bold text-textPrimary">{stats.notFound} SKUs</span>
            </div>
            <div className="flex justify-between items-center p-2.5 bg-[#0A0E0C] rounded-xl border border-border">
              <span className="text-textSecondary font-medium">Daily Deals Opps</span>
              <span className="font-mono font-bold text-accentMint">{stats.dailyDealsOpportunities} Deals</span>
            </div>
          </div>
        </div>
      </div>

      {/* Supplier Live Status Table */}
      <div className="bg-surface border border-border rounded-2xl p-6 space-y-4">
        <h3 className="font-sora font-bold text-sm text-textPrimary">Wholesaler Connector Live Status</h3>
        <DataTable
          columns={supplierColumns}
          data={supplierHealth}
          isLoading={isLoading}
          emptyState={<div className="text-textSecondary text-xs">No active supplier connectors found.</div>}
        />
      </div>
    </div>
  );
};

export default Dashboard;
