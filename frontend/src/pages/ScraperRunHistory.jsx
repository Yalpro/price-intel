import React, { useState, useEffect } from 'react';
import DataTable from '../components/DataTable';
import StatusBadge, { LiveStatusPulse, EmptyState } from '../components/UIComponents';
import { History, Filter, ChevronLeft, ChevronRight, RefreshCw, Eye } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { formatDateTime } from '../utils/formatters';

const ScraperRunHistory = () => {
  const [runs, setRuns] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [searchRunId, setSearchRunId] = useState('');
  const [selectedRunDetail, setSelectedRunDetail] = useState(null);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [page, pageSize, selectedSupplier, selectedStatus, searchRunId]);

  const fetchSuppliers = async () => {
    const { data } = await supabase.from('suppliers').select('*').order('name');
    if (data) setSuppliers(data);
  };

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('scraper_runs')
        .select('*, suppliers(id, name)', { count: 'exact' });

      if (selectedSupplier) query = query.eq('supplier_id', selectedSupplier);
      if (selectedStatus) query = query.eq('status', selectedStatus);
      if (searchRunId) query = query.eq('id', searchRunId);

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, count, error } = await query
        .order('id', { ascending: false })
        .range(from, to);

      if (data) {
        setRuns(data);
        setTotalCount(count || 0);
        setTotalPages(Math.ceil((count || 0) / pageSize) || 1);
      }
    } catch (err) {
      console.error('Error fetching scraper run history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const tableColumns = [
    { header: 'Run ID', accessor: 'id', render: (r) => <span className="font-mono font-bold text-xs text-textPrimary">#{r.id}</span> },
    {
      header: 'Supplier',
      accessor: 'supplier_id',
      render: (r) => (
        <span className="font-sora font-semibold text-xs text-textPrimary capitalize">
          {r.suppliers?.name || `Supplier ${r.supplier_id}`}
        </span>
      )
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (r) => {
        let type = 'default';
        if (r.status === 'success') type = 'success';
        if (r.status === 'failed') type = 'danger';
        if (r.status === 'running') type = 'warning';
        return <StatusBadge status={r.status} type={type} />;
      }
    },
    { header: 'Started At', accessor: 'started_at', isNumeric: true, render: (r) => <span className="text-xs text-textSecondary">{formatDateTime(r.started_at)}</span> },
    { header: 'Duration', accessor: 'duration_seconds', isNumeric: true, render: (r) => <span className="font-mono text-xs text-textSecondary">{r.duration_seconds ? `${r.duration_seconds}s` : '—'}</span> },
    { header: 'Attempted', accessor: 'attempted_count', isNumeric: true, align: 'right', render: (r) => <span className="font-mono text-xs text-textPrimary">{r.attempted_count || 0}</span> },
    { header: 'Priced', accessor: 'successful_price_count', isNumeric: true, align: 'right', render: (r) => <span className="font-mono text-xs text-accentMint font-semibold">{r.successful_price_count || 0}</span> },
    { header: 'Errors', accessor: 'error_count', isNumeric: true, align: 'right', render: (r) => <span className={`font-mono text-xs ${r.error_count > 0 ? 'text-danger font-bold' : 'text-textSecondary'}`}>{r.error_count || 0}</span> },
    {
      header: 'Actions',
      accessor: 'actions',
      align: 'right',
      render: (r) => (
        <button
          onClick={() => setSelectedRunDetail(r)}
          className="px-2.5 py-1 bg-[#1A221D] hover:bg-[#25322B] text-textPrimary rounded-lg text-xs font-medium flex items-center gap-1.5 ml-auto border border-border"
        >
          <Eye size={13} />
          <span>Details</span>
        </button>
      )
    }
  ];

  return (
    <div className="space-y-6 max-w-6xl font-inter">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-surface p-6 rounded-2xl border border-border gap-4">
        <div>
          <h2 className="text-xl font-sora font-bold text-textPrimary tracking-tight">Scraper Run Execution History</h2>
          <p className="text-sm text-textSecondary mt-0.5">Permanent server-side execution logs and performance metrics across all wholesaler scrapers</p>
        </div>
        <button onClick={fetchHistory} className="p-2 bg-[#0A0E0C] hover:bg-[#1A221D] border border-border text-textPrimary rounded-xl text-xs font-semibold flex items-center gap-2">
          <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-surface border border-border rounded-2xl p-4 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2 text-xs font-semibold text-textSecondary">
          <Filter size={15} />
          <span>Filters:</span>
        </div>

        <select
          value={selectedSupplier}
          onChange={(e) => { setSelectedSupplier(e.target.value); setPage(1); }}
          className="bg-[#0A0E0C] border border-border text-textPrimary rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-none focus:border-accent"
        >
          <option value="">All Suppliers</option>
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name.toUpperCase()}</option>)}
        </select>

        <select
          value={selectedStatus}
          onChange={(e) => { setSelectedStatus(e.target.value); setPage(1); }}
          className="bg-[#0A0E0C] border border-border text-textPrimary rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-none focus:border-accent"
        >
          <option value="">All Statuses</option>
          <option value="success">SUCCESS</option>
          <option value="failed">FAILED</option>
          <option value="running">RUNNING</option>
        </select>

        <input
          type="text"
          placeholder="Filter by Run ID (#)..."
          value={searchRunId}
          onChange={(e) => { setSearchRunId(e.target.value); setPage(1); }}
          className="bg-[#0A0E0C] border border-border text-textPrimary rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-none focus:border-accent w-44"
        />

        <div className="ml-auto flex items-center gap-2 text-xs text-textSecondary">
          <span>Show:</span>
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            className="bg-[#0A0E0C] border border-border text-textPrimary rounded-xl px-2 py-1 text-xs font-medium"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface border border-border rounded-2xl p-6 min-h-[400px]">
        <DataTable
          columns={tableColumns}
          data={runs}
          isLoading={isLoading}
          emptyState={<EmptyState icon={History} title="No Run History Found" description="No scraper runs match the specified filter criteria." />}
        />

        {/* Server-Side Pagination Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-center mt-6 pt-4 border-t border-border gap-4 text-xs text-textSecondary">
          <div>
            Showing <span className="font-semibold text-textPrimary">{(page - 1) * pageSize + 1}</span> to <span className="font-semibold text-textPrimary">{Math.min(page * pageSize, totalCount)}</span> of <span className="font-semibold text-textPrimary">{totalCount}</span> execution runs
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 bg-[#0A0E0C] border border-border rounded-lg disabled:opacity-40 text-textPrimary cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="font-mono text-xs font-semibold text-textPrimary px-2">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 bg-[#0A0E0C] border border-border rounded-lg disabled:opacity-40 text-textPrimary cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedRunDetail && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl p-6 max-w-lg w-full space-y-4">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="font-sora font-bold text-lg text-textPrimary">Scraper Run #{selectedRunDetail.id} Details</h3>
              <button onClick={() => setSelectedRunDetail(null)} className="text-textSecondary hover:text-textPrimary">✕</button>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-textSecondary">Supplier:</span>
                <span className="font-semibold text-textPrimary uppercase">{selectedRunDetail.suppliers?.name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-textSecondary">Status:</span>
                <span className="font-semibold text-textPrimary">{selectedRunDetail.status}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-textSecondary">Started At:</span>
                <span className="font-mono text-textPrimary">{formatDateTime(selectedRunDetail.started_at)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-textSecondary">Finished At:</span>
                <span className="font-mono text-textPrimary">{formatDateTime(selectedRunDetail.completed_at)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-textSecondary">Duration:</span>
                <span className="font-mono text-textPrimary">{selectedRunDetail.duration_seconds}s</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-textSecondary">Attempted SKUs:</span>
                <span className="font-mono text-textPrimary">{selectedRunDetail.attempted_count || 0}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-textSecondary">Priced Matches:</span>
                <span className="font-mono text-accentMint font-semibold">{selectedRunDetail.successful_price_count || 0}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-textSecondary">Errors:</span>
                <span className="font-mono text-danger font-semibold">{selectedRunDetail.error_count || 0}</span>
              </div>
            </div>
            <button onClick={() => setSelectedRunDetail(null)} className="w-full py-2 bg-[#1A221D] hover:bg-[#25322B] text-textPrimary rounded-xl text-xs font-semibold">Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScraperRunHistory;
