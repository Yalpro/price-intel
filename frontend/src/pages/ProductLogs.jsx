import React, { useState, useEffect } from 'react';
import DataTable from '../components/DataTable';
import StatusBadge, { EmptyState } from '../components/UIComponents';
import { Database, Filter, Search, ChevronLeft, ChevronRight, RefreshCw, Eye, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { formatDateTime } from '../utils/formatters';

const ProductLogs = () => {
  const [logs, setLogs] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLogDetail, setSelectedLogDetail] = useState(null);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [page, pageSize, selectedSupplier, selectedStatus, searchQuery]);

  const fetchSuppliers = async () => {
    const { data } = await supabase.from('suppliers').select('*').order('name');
    if (data) setSuppliers(data);
  };

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('product_search_logs')
        .select('*, suppliers(id, name), raw_products(*)', { count: 'exact' });

      if (selectedSupplier) query = query.eq('supplier_id', selectedSupplier);
      if (selectedStatus) query = query.eq('result_status', selectedStatus);
      if (searchQuery) query = query.ilike('original_product_name', `%${searchQuery}%`);

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (data) {
        setLogs(data);
        setTotalCount(count || 0);
        setTotalPages(Math.ceil((count || 0) / pageSize) || 1);
      }
    } catch (err) {
      console.error('Error fetching product search logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const tableColumns = [
    { header: 'Barcode / EAN', accessor: 'barcode', isNumeric: true, render: (r) => <span className="font-mono text-xs text-textPrimary">{r.barcode || '—'}</span> },
    { header: 'Catalogue Product', accessor: 'original_product_name', render: (r) => <span className="font-semibold text-xs text-textPrimary">{r.original_product_name}</span> },
    { header: 'Supplier', accessor: 'supplier_id', render: (r) => <span className="text-xs text-textSecondary uppercase font-medium">{r.suppliers?.name || 'Wholesaler'}</span> },
    { header: 'Matched Title', accessor: 'matched_supplier_product_title', render: (r) => <span className="text-xs text-textPrimary">{r.matched_supplier_product_title || r.raw_products?.raw_title || '—'}</span> },
    {
      header: 'Match Status',
      accessor: 'result_status',
      render: (r) => {
        let type = 'default';
        if (['success', 'verified_exact', 'verified_equivalent'].includes(r.result_status)) type = 'success';
        if (['rejected', 'error'].includes(r.result_status)) type = 'danger';
        if (['needs_review', 'ambiguous'].includes(r.result_status)) type = 'warning';
        return <StatusBadge status={r.result_status} type={type} />;
      }
    },
    { header: 'Run ID', accessor: 'scraper_run_id', isNumeric: true, render: (r) => <span className="font-mono text-xs text-textSecondary">#{r.scraper_run_id}</span> },
    { header: 'Scraped At', accessor: 'created_at', isNumeric: true, render: (r) => <span className="text-xs text-textSecondary">{formatDateTime(r.created_at)}</span> },
    {
      header: 'Actions',
      accessor: 'actions',
      align: 'right',
      render: (r) => (
        <button
          onClick={() => setSelectedLogDetail(r)}
          className="px-2.5 py-1 bg-[#1A221D] hover:bg-[#25322B] text-textPrimary rounded-lg text-xs font-medium flex items-center gap-1.5 ml-auto border border-border"
        >
          <Eye size={13} />
          <span>Inspect</span>
        </button>
      )
    }
  ];

  return (
    <div className="space-y-6 max-w-6xl font-inter">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-surface p-6 rounded-2xl border border-border gap-4">
        <div>
          <h2 className="text-xl font-sora font-bold text-textPrimary tracking-tight">Raw Product Observations & Match Logs</h2>
          <p className="text-sm text-textSecondary mt-0.5">Trace real supplier products observed by scrapers, deterministic evaluation scores, and AI resolution evidence</p>
        </div>
        <button onClick={fetchLogs} className="p-2 bg-[#0A0E0C] hover:bg-[#1A221D] border border-border text-textPrimary rounded-xl text-xs font-semibold flex items-center gap-2">
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

        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-textSecondary" />
          <input
            type="text"
            placeholder="Search product / EAN..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            className="pl-8 pr-3 py-1.5 bg-[#0A0E0C] border border-border rounded-xl text-xs text-textPrimary focus:outline-none focus:border-accent w-48"
          />
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
          <option value="success">SUCCESS / VERIFIED</option>
          <option value="needs_review">NEEDS_REVIEW</option>
          <option value="rejected">REJECTED</option>
          <option value="not_found">NOT_FOUND</option>
          <option value="error">TECHNICAL ERROR</option>
        </select>

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
          data={logs}
          isLoading={isLoading}
          emptyState={<EmptyState icon={Database} title="No Product Logs Found" description="No search logs match the selected filter criteria." />}
        />

        {/* Server-Side Pagination */}
        <div className="flex flex-col sm:flex-row justify-between items-center mt-6 pt-4 border-t border-border gap-4 text-xs text-textSecondary">
          <div>
            Showing <span className="font-semibold text-textPrimary">{(page - 1) * pageSize + 1}</span> to <span className="font-semibold text-textPrimary">{Math.min(page * pageSize, totalCount)}</span> of <span className="font-semibold text-textPrimary">{totalCount}</span> log entries
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

      {/* Slide-over Detail Drawer */}
      {selectedLogDetail && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex justify-end">
          <div className="bg-surface border-l border-border w-full max-w-lg h-full p-6 overflow-y-auto space-y-6">
            <div className="flex justify-between items-center border-b border-border pb-4">
              <div>
                <h3 className="font-sora font-bold text-lg text-textPrimary">Product Match Inspection</h3>
                <p className="text-xs text-textSecondary">Log Entry ID #{selectedLogDetail.id}</p>
              </div>
              <button onClick={() => setSelectedLogDetail(null)} className="p-1 text-textSecondary hover:text-textPrimary rounded-lg bg-[#0A0E0C]">
                <X size={18} />
              </button>
            </div>

            {/* Side-by-side Metadata Comparison */}
            <div className="space-y-4 text-xs">
              <div className="bg-[#0A0E0C] p-4 rounded-xl border border-border space-y-2">
                <h4 className="font-semibold text-accentMint uppercase tracking-wider text-[10px]">Catalogue Source Product</h4>
                <div className="font-sora font-bold text-sm text-textPrimary">{selectedLogDetail.original_product_name}</div>
                <div className="font-mono text-textSecondary">EAN / Barcode: {selectedLogDetail.barcode || '—'}</div>
              </div>

              <div className="bg-[#0A0E0C] p-4 rounded-xl border border-border space-y-2">
                <h4 className="font-semibold text-accent uppercase tracking-wider text-[10px]">Scraped Supplier Candidate</h4>
                <div className="font-sora font-bold text-sm text-textPrimary">{selectedLogDetail.matched_supplier_product_title || selectedLogDetail.raw_products?.raw_title || 'None'}</div>
                <div className="font-mono text-textSecondary">Supplier: {selectedLogDetail.suppliers?.name?.toUpperCase()}</div>
                <div className="font-mono text-textSecondary">Product Code: {selectedLogDetail.selected_candidate_code || selectedLogDetail.raw_products?.raw_product_code || '—'}</div>
                <div className="font-mono text-textSecondary">Pack Info: {selectedLogDetail.raw_products?.raw_pack_info || '—'}</div>
              </div>

              <div className="bg-[#0A0E0C] p-4 rounded-xl border border-border space-y-2">
                <h4 className="font-semibold text-warning uppercase tracking-wider text-[10px]">Matching & Validation Evidence</h4>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-textSecondary">Match Status:</span>
                  <span className="font-semibold text-textPrimary">{selectedLogDetail.result_status}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-textSecondary">Deterministic Score:</span>
                  <span className="font-mono font-bold text-accentMint">{selectedLogDetail.validation_score}%</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-textSecondary">Search Strategy:</span>
                  <span className="font-mono text-textPrimary">{selectedLogDetail.search_strategy}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-textSecondary">Searched Term:</span>
                  <span className="font-mono text-textPrimary">{selectedLogDetail.searched_term}</span>
                </div>
                {selectedLogDetail.conflicting_fields && (
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-textSecondary">Conflicts:</span>
                    <span className="font-mono text-danger font-bold">{selectedLogDetail.conflicting_fields}</span>
                  </div>
                )}
                <div className="py-1">
                  <span className="text-textSecondary block mb-1">Validation Reason:</span>
                  <span className="text-textPrimary bg-[#161D19] p-2 rounded-lg block font-mono text-[11px]">{selectedLogDetail.validation_reason || '—'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductLogs;
