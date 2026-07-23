import React, { useState, useEffect } from 'react';
import StatCard from '../components/StatCard';
import DataTable from '../components/DataTable';
import StatusBadge, { LiveStatusPulse } from '../components/UIComponents';
import { Package, Boxes, History, Activity } from 'lucide-react';
import { supabase } from '../supabaseClient';

const Dashboard = () => {
  const [stats, setStats] = useState({
    suppliers: 0,
    rawProducts: 0,
    priceSnapshots: 0,
    latestRunStatus: 'Unknown'
  });
  
  const [supplierStatus, setSupplierStatus] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    
    // In a real app, these might be grouped by an RPC or custom query. 
    // Here we do parallel count queries for demonstration.
    try {
      const [suppRes, prodRes, snapRes, runsRes] = await Promise.all([
        supabase.from('suppliers').select('*', { count: 'exact', head: true }),
        supabase.from('raw_products').select('*', { count: 'exact', head: true }),
        supabase.from('price_snapshots').select('*', { count: 'exact', head: true }),
        supabase.from('scraper_runs').select('*, suppliers(name)').order('started_at', { ascending: false }).limit(20)
      ]);

      const latestRun = runsRes.data?.[0];

      setStats({
        suppliers: suppRes.count || 0,
        rawProducts: prodRes.count || 0,
        priceSnapshots: snapRes.count || 0,
        latestRunStatus: latestRun ? latestRun.status : 'N/A'
      });

      // Group runs by supplier to get the latest per supplier
      if (runsRes.data) {
        const latestPerSupplier = {};
        runsRes.data.forEach(run => {
          if (!latestPerSupplier[run.supplier_id] && run.suppliers) {
            latestPerSupplier[run.supplier_id] = {
              id: run.id,
              supplierName: run.suppliers.name,
              status: run.status,
              lastRun: new Date(run.started_at).toLocaleString(),
              attempted: run.attempted_count || 0,
              successful: run.successful_price_count || 0,
              errors: run.error_count || 0,
              duration: run.duration_seconds ? `${run.duration_seconds}s` : '-'
            };
          }
        });
        setSupplierStatus(Object.values(latestPerSupplier));
      }
    } catch (err) {
      console.error("Failed to load dashboard data", err);
    } finally {
      setIsLoading(false);
    }
  };

  const tableColumns = [
    { 
      header: 'Supplier', 
      accessor: 'supplierName',
      render: (row) => (
        <div className="flex items-center gap-2">
          <LiveStatusPulse isActive={row.status === 'running'} colorClass={row.status === 'failed' ? 'bg-danger' : row.status === 'running' ? 'bg-warning' : 'bg-success'} />
          <span className="capitalize font-medium">{row.supplierName}</span>
        </div>
      )
    },
    { 
      header: 'Status', 
      accessor: 'status',
      render: (row) => {
        let type = 'default';
        if (row.status === 'success') type = 'success';
        if (row.status === 'failed') type = 'danger';
        if (row.status === 'running') type = 'warning';
        return <StatusBadge status={row.status} type={type} />;
      }
    },
    { header: 'Last Run', accessor: 'lastRun', isNumeric: true },
    { header: 'Attempted', accessor: 'attempted', isNumeric: true, align: 'right' },
    { 
      header: 'Successful', 
      accessor: 'successful', 
      isNumeric: true, 
      align: 'right',
      render: (row) => <span className="text-success font-medium">{row.successful}</span>
    },
    { 
      header: 'Errors', 
      accessor: 'errors', 
      isNumeric: true, 
      align: 'right',
      render: (row) => <span className={row.errors > 0 ? 'text-danger font-medium' : 'text-textSecondary'}>{row.errors}</span>
    },
    { header: 'Duration', accessor: 'duration', isNumeric: true, align: 'right' }
  ];

  return (
    <div className="space-y-6">
      {/* Top row stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          icon={Package} 
          value={stats.suppliers} 
          label="Total Suppliers" 
        />
        <StatCard 
          icon={Boxes} 
          value={stats.rawProducts.toLocaleString()} 
          label="Raw Products" 
        />
        <StatCard 
          icon={History} 
          value={stats.priceSnapshots.toLocaleString()} 
          label="Price Snapshots" 
        />
        <StatCard 
          icon={Activity} 
          value={stats.latestRunStatus} 
          label="Latest Run Status" 
        />
      </div>

      {/* Main Table */}
      <div className="pt-4">
        <h2 className="text-lg font-sora font-semibold text-textPrimary tracking-tight mb-4">Supplier Status</h2>
        <div className="h-[400px]">
          <DataTable 
            columns={tableColumns} 
            data={supplierStatus} 
            isLoading={isLoading} 
            emptyState={<div className="text-textSecondary">No scraper runs found.</div>}
          />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
