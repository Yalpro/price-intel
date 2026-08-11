import React, { useState, useEffect } from 'react';
import DataTable from '../components/DataTable';
import StatusBadge, { EmptyState } from '../components/UIComponents';
import { Sparkles, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../supabaseClient';

const ReviewQueue = () => {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionProcessing, setActionProcessing] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  useEffect(() => {
    fetchReviewQueue();
  }, []);

  const fetchReviewQueue = async () => {
    setIsLoading(true);
    try {
      // Query items needing review from master_product_metadata or raw_products
      const { data, error } = await supabase
        .from('master_product_metadata')
        .select('*')
        .eq('verification_status', 'needs_review')
        .order('created_at', { ascending: false });

      if (error && error.code !== 'PGRST116') {
        // Fallback to raw products with lower confidence if master_product_metadata table is quiet
        const { data: rawData } = await supabase
          .from('raw_products')
          .select('*, suppliers(name)')
          .order('scraped_at', { ascending: false })
          .limit(20);
        setItems(rawData || []);
      } else {
        setItems(data || []);
      }
    } catch (err) {
      console.error('Error fetching review queue:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (itemId, newStatus) => {
    setActionProcessing(true);
    try {
      const { error } = await supabase
        .from('master_product_metadata')
        .update({ verification_status: newStatus, verified_at: new Date().toISOString() })
        .eq('id', itemId);

      if (!error) {
        setFeedbackMsg({ type: 'success', text: `Item #${itemId} updated to '${newStatus}'!` });
        fetchReviewQueue();
      }
    } catch (err) {
      console.error('Verify error:', err);
    } finally {
      setActionProcessing(false);
    }
  };

  const tableColumns = [
    { header: 'Barcode', accessor: 'barcode', isNumeric: true, render: (r) => <span className="font-mono text-xs text-textPrimary">{r.barcode || r.raw_barcode || '—'}</span> },
    { header: 'Product Name', accessor: 'source_product_name', render: (r) => <span className="font-semibold text-textPrimary">{r.source_product_name || r.raw_title}</span> },
    { header: 'Brand / Variant', accessor: 'normalized_brand', render: (r) => <span className="text-xs text-textSecondary">{r.normalized_brand || r.raw_pack_info || '—'}</span> },
    { 
      header: 'Confidence Score', 
      accessor: 'confidence_score',
      isNumeric: true,
      render: (r) => <span className="font-mono text-xs text-warning font-semibold">{r.confidence_score || '70%'}</span>
    },
    {
      header: 'Actions',
      accessor: 'actions',
      align: 'right',
      render: (r) => (
        <div className="flex justify-end gap-2">
          <button
            onClick={() => handleVerify(r.id, 'verified')}
            disabled={actionProcessing}
            className="px-3 py-1.5 bg-accentSoft text-accentMint border border-emerald-800 rounded-lg text-xs font-semibold hover:bg-savingBg transition-colors"
          >
            Approve Match
          </button>
          <button
            onClick={() => handleVerify(r.id, 'incomplete')}
            disabled={actionProcessing}
            className="px-3 py-1.5 bg-danger/10 text-danger border border-danger/30 rounded-lg text-xs font-semibold hover:bg-danger/20 transition-colors"
          >
            Reject
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6 max-w-6xl font-inter">
      <div className="flex justify-between items-center bg-surface p-6 rounded-2xl border border-border">
        <div>
          <h2 className="text-xl font-sora font-bold text-textPrimary tracking-tight">Product Review Queue</h2>
          <p className="text-sm text-textSecondary mt-0.5">Review and verify product barcode matches requiring manual administrator confirmation</p>
        </div>
        <button onClick={fetchReviewQueue} className="p-2 bg-[#0A0E0C] hover:bg-[#1A221D] border border-border text-textPrimary rounded-xl text-xs font-semibold flex items-center gap-2">
          <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {feedbackMsg && (
        <div className={`p-4 rounded-xl text-xs font-semibold ${feedbackMsg.type === 'success' ? 'bg-savingBg text-accentMint border border-emerald-800' : 'bg-danger/10 text-danger border border-danger/30'}`}>
          {feedbackMsg.text}
        </div>
      )}

      <div className="bg-surface border border-border rounded-2xl p-6 min-h-[400px]">
        <DataTable
          columns={tableColumns}
          data={items}
          isLoading={isLoading}
          emptyState={
            <EmptyState
              icon={Sparkles}
              title="Review Queue is Clean"
              description="Zero items currently require manual verification. All active catalogue barcodes are auto-verified."
            />
          }
        />
      </div>
    </div>
  );
};

export default ReviewQueue;
