import React, { useState, useEffect } from 'react';
import DataTable from '../components/DataTable';
import StatusBadge, { EmptyState } from '../components/UIComponents';
import { Sparkles, CheckCircle2, XCircle, RefreshCw, AlertTriangle, Search, Check, Ban } from 'lucide-react';
import { supabase } from '../supabaseClient';

const ReviewQueue = () => {
  const [activeTab, setActiveTab] = useState('needs_review'); // 'needs_review', 'rejected', 'not_found', 'accepted'
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionProcessing, setActionProcessing] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);

  useEffect(() => {
    fetchTabItems(activeTab);
  }, [activeTab]);

  const fetchTabItems = async (tab) => {
    setIsLoading(true);
    setFeedbackMsg(null);
    try {
      if (tab === 'needs_review') {
        const { data, error } = await supabase
          .from('product_search_logs')
          .select('*, suppliers(name), raw_products(*)')
          .in('result_status', ['needs_review', 'ambiguous'])
          .order('created_at', { ascending: false });

        setItems(data || []);
      } else if (tab === 'rejected') {
        const { data: decisions } = await supabase
          .from('admin_review_decisions')
          .select('*, suppliers(name), raw_products(*)')
          .eq('decision', 'ADMIN_REJECTED')
          .eq('is_current', true)
          .order('reviewed_at', { ascending: false });

        const { data: hardRejections } = await supabase
          .from('product_search_logs')
          .select('*, suppliers(name), raw_products(*)')
          .eq('result_status', 'rejected')
          .order('created_at', { ascending: false });

        const merged = [
          ...(decisions || []).map(d => ({
            id: `dec_${d.id}`,
            type: 'ADMIN_REJECTED',
            source: 'ADMIN',
            reason_code: d.reason_code || 'ADMIN_REJECTED',
            explanation: d.comment || 'Rejected by administrator during review.',
            barcode: d.search_log_id,
            original_product_name: d.raw_products?.raw_title || 'Rejected Product',
            supplier_name: d.suppliers?.name || 'Wholesaler',
            reviewed_by: 'Admin User',
            created_at: d.reviewed_at
          })),
          ...(hardRejections || []).map(r => ({
            id: `log_${r.id}`,
            type: 'DETERMINISTIC_HARD_CONFLICT',
            source: 'DETERMINISTIC',
            reason_code: r.conflicting_fields ? `${r.conflicting_fields.toUpperCase()}_MISMATCH` : 'HARD_CONFLICT',
            explanation: r.validation_reason || 'Deterministic hard metadata conflict detected.',
            barcode: r.barcode,
            original_product_name: r.original_product_name,
            supplier_name: r.suppliers?.name || 'Wholesaler',
            reviewed_by: 'ENGINE',
            created_at: r.created_at
          }))
        ];
        setItems(merged);
      } else if (tab === 'not_found') {
        const { data, error } = await supabase
          .from('product_search_logs')
          .select('*, suppliers(name)')
          .eq('result_status', 'search_strategy_exhausted')
          .order('created_at', { ascending: false });

        setItems(data || []);
      } else if (tab === 'accepted') {
        const { data: autoVerified } = await supabase
          .from('product_search_logs')
          .select('*, suppliers(name), raw_products(*)')
          .in('result_status', ['verified_exact', 'verified_equivalent', 'success'])
          .order('created_at', { ascending: false });

        setItems(autoVerified || []);
      }
    } catch (err) {
      console.error(`Error fetching ${tab} queue:`, err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptMatch = async (item) => {
    setActionProcessing(true);
    try {
      const response = await fetch('/api/admin/catalogues/review-queue/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          catalogue_item_id: item.barcode,
          supplier_id: item.supplier_id || 1,
          raw_product_id: item.raw_product_id || 1,
          search_log_id: item.id,
          comment: 'Accepted match by admin'
        })
      });

      const resData = await response.json();
      if (response.ok) {
        setFeedbackMsg({ type: 'success', text: `Match #${item.id} ACCEPTED and published!` });
        fetchTabItems(activeTab);
      } else {
        setFeedbackMsg({ type: 'error', text: resData.error || 'Failed to accept match' });
      }
    } catch (err) {
      setFeedbackMsg({ type: 'error', text: err.message });
    } finally {
      setActionProcessing(false);
    }
  };

  const handleRejectMatch = async (item, reasonCode = 'ADMIN_REJECTED') => {
    setActionProcessing(true);
    try {
      const response = await fetch('/api/admin/catalogues/review-queue/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          catalogue_item_id: item.barcode,
          supplier_id: item.supplier_id || 1,
          raw_product_id: item.raw_product_id || 1,
          search_log_id: item.id,
          reason_code: reasonCode,
          comment: 'Rejected match by admin'
        })
      });

      const resData = await response.json();
      if (response.ok) {
        setFeedbackMsg({ type: 'success', text: `Match #${item.id} REJECTED cleanly!` });
        fetchTabItems(activeTab);
      } else {
        setFeedbackMsg({ type: 'error', text: resData.error || 'Failed to reject match' });
      }
    } catch (err) {
      setFeedbackMsg({ type: 'error', text: err.message });
    } finally {
      setActionProcessing(false);
    }
  };

  const tabs = [
    { id: 'needs_review', label: 'Needs Review', icon: AlertTriangle },
    { id: 'rejected', label: 'Rejected Products', icon: XCircle },
    { id: 'not_found', label: 'Not Found', icon: Ban },
    { id: 'accepted', label: 'Accepted / Verified', icon: CheckCircle2 },
  ];

  return (
    <div className="space-y-6 max-w-6xl font-inter">
      <div className="flex justify-between items-center bg-surface p-6 rounded-2xl border border-border">
        <div>
          <h2 className="text-xl font-sora font-bold text-textPrimary tracking-tight">Product Review & Verification Portal</h2>
          <p className="text-sm text-textSecondary mt-0.5">Audit, accept, or reject catalogue product candidate matches with full deterministic proof</p>
        </div>
        <button onClick={() => fetchTabItems(activeTab)} className="p-2 bg-[#0A0E0C] hover:bg-[#1A221D] border border-border text-textPrimary rounded-xl text-xs font-semibold flex items-center gap-2">
          <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border gap-2">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2.5 rounded-t-xl text-xs font-semibold flex items-center gap-2 transition-colors border-t border-x ${
                isActive
                  ? 'bg-surface text-textPrimary border-border border-b-transparent font-bold'
                  : 'bg-transparent text-textSecondary border-transparent hover:text-textPrimary'
              }`}
            >
              <Icon size={14} className={isActive ? 'text-accentMint' : ''} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {feedbackMsg && (
        <div className={`p-4 rounded-xl text-xs font-semibold ${feedbackMsg.type === 'success' ? 'bg-savingBg text-accentMint border border-emerald-800' : 'bg-danger/10 text-danger border border-danger/30'}`}>
          {feedbackMsg.text}
        </div>
      )}

      {/* Tab Content */}
      <div className="bg-surface border border-border rounded-2xl p-6 min-h-[400px]">
        {activeTab === 'needs_review' && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-textPrimary">Products Requiring Human Verification</h3>
            <DataTable
              columns={[
                { header: 'Barcode', accessor: 'barcode', render: (r) => <span className="font-mono text-xs text-textPrimary">{r.barcode || '—'}</span> },
                { header: 'Catalogue Product', accessor: 'original_product_name', render: (r) => <span className="font-semibold text-textPrimary">{r.original_product_name}</span> },
                { header: 'Supplier', accessor: 'supplier_name', render: (r) => <span className="text-xs text-textSecondary">{r.suppliers?.name || 'Wholesaler'}</span> },
                { header: 'Matched Candidate', accessor: 'matched_supplier_product_title', render: (r) => <span className="text-xs text-textPrimary">{r.matched_supplier_product_title || r.raw_products?.raw_title || 'Candidate'}</span> },
                { header: 'Score', accessor: 'validation_score', render: (r) => <span className="font-mono text-xs text-warning font-semibold">{r.validation_score || 70}%</span> },
                {
                  header: 'Actions',
                  accessor: 'actions',
                  align: 'right',
                  render: (r) => (
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleAcceptMatch(r)}
                        disabled={actionProcessing}
                        className="px-3 py-1.5 bg-accentSoft text-accentMint border border-emerald-800 rounded-lg text-xs font-semibold hover:bg-savingBg transition-colors"
                      >
                        Accept Match
                      </button>
                      <button
                        onClick={() => handleRejectMatch(r)}
                        disabled={actionProcessing}
                        className="px-3 py-1.5 bg-danger/10 text-danger border border-danger/30 rounded-lg text-xs font-semibold hover:bg-danger/20 transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  )
                }
              ]}
              data={items}
              isLoading={isLoading}
              emptyState={<EmptyState icon={Sparkles} title="Queue is Clean" description="Zero products currently require manual verification." />}
            />
          </div>
        )}

        {activeTab === 'rejected' && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-textPrimary">Audit Log of Rejected Product Candidates</h3>
            <DataTable
              columns={[
                { header: 'Barcode / ID', accessor: 'barcode', render: (r) => <span className="font-mono text-xs text-textPrimary">{r.barcode || r.catalogue_barcode || '—'}</span> },
                { header: 'Product', accessor: 'original_product_name', render: (r) => <span className="font-semibold text-textPrimary">{r.original_product_name || r.raw_title}</span> },
                { header: 'Supplier', accessor: 'supplier_name', render: (r) => <span className="text-xs text-textSecondary">{r.supplier_name}</span> },
                { header: 'Rejection Source', accessor: 'source', render: (r) => <span className="text-xs font-semibold text-danger">{r.source}</span> },
                { header: 'Reason Code', accessor: 'reason_code', render: (r) => <span className="font-mono text-xs text-danger font-semibold">{r.reason_code}</span> },
                { header: 'Explanation', accessor: 'explanation', render: (r) => <span className="text-xs text-textSecondary">{r.explanation}</span> },
                { header: 'Reviewer', accessor: 'reviewed_by', render: (r) => <span className="text-xs text-textSecondary">{r.reviewed_by}</span> }
              ]}
              data={items}
              isLoading={isLoading}
              emptyState={<EmptyState icon={CheckCircle2} title="No Rejected Candidates" description="Zero hard conflicts or manual rejections recorded." />}
            />
          </div>
        )}

        {activeTab === 'not_found' && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-textPrimary">Search Strategy Exhausted Products</h3>
            <DataTable
              columns={[
                { header: 'Barcode', accessor: 'barcode', render: (r) => <span className="font-mono text-xs text-textPrimary">{r.barcode}</span> },
                { header: 'Catalogue Product', accessor: 'original_product_name', render: (r) => <span className="font-semibold text-textPrimary">{r.original_product_name}</span> },
                { header: 'Supplier', accessor: 'supplier_name', render: (r) => <span className="text-xs text-textSecondary">{r.suppliers?.name || 'Wholesaler'}</span> },
                { header: 'Original Query', accessor: 'searched_term', render: (r) => <span className="font-mono text-xs text-textSecondary">{r.searched_term}</span> },
                { header: 'Attempts', accessor: 'attempt_number', render: (r) => <span className="font-mono text-xs text-textPrimary">{r.attempt_number}</span> },
                { header: 'Status', accessor: 'status', render: (r) => <span className="text-xs font-semibold text-warning">SEARCH_STRATEGY_EXHAUSTED</span> }
              ]}
              data={items}
              isLoading={isLoading}
              emptyState={<EmptyState icon={Sparkles} title="No Unresolved Items" description="Zero products currently classified as search strategy exhausted." />}
            />
          </div>
        )}

        {activeTab === 'accepted' && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-textPrimary">Verified & Accepted Product Matches</h3>
            <DataTable
              columns={[
                { header: 'Barcode', accessor: 'barcode', render: (r) => <span className="font-mono text-xs text-textPrimary">{r.barcode || r.catalogue_barcode || '—'}</span> },
                { header: 'Catalogue Product', accessor: 'original_product_name', render: (r) => <span className="font-semibold text-textPrimary">{r.original_product_name || r.raw_title}</span> },
                { header: 'Supplier', accessor: 'supplier_name', render: (r) => <span className="text-xs text-textSecondary">{r.supplier_name}</span> },
                { header: 'Source', accessor: 'source', render: (r) => <span className="text-xs font-semibold text-accentMint">{r.source}</span> },
                { header: 'Confidence Score', accessor: 'score', render: (r) => <span className="font-mono text-xs text-accentMint font-semibold">{r.score || 95}%</span> },
                { header: 'Reviewer', accessor: 'reviewed_by', render: (r) => <span className="text-xs text-textSecondary">{r.reviewed_by}</span> }
              ]}
              data={items}
              isLoading={isLoading}
              emptyState={<EmptyState icon={Sparkles} title="No Verified Products" description="No matches currently stored in verified audit history." />}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewQueue;
