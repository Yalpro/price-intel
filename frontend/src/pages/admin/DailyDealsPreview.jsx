import React, { useState, useEffect } from 'react';
import DataTable from '../../components/DataTable';
import StatusBadge, { EmptyState } from '../../components/UIComponents';
import { BadgePercent, Flame, TrendingDown, RefreshCw, Eye } from 'lucide-react';
import { supabase } from '../../supabaseClient';

const DailyDealsPreview = () => {
  const [deals, setDeals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDealsPreview();
  }, []);

  const fetchDealsPreview = async () => {
    setIsLoading(true);
    try {
      const { data: rawProds } = await supabase
        .from('raw_products')
        .select('id, supplier_id, raw_title, raw_barcode, raw_product_code, raw_url, scraped_at, suppliers(name)')
        .order('scraped_at', { ascending: false });

      const rawIds = (rawProds || []).map(r => r.id);

      const { data: snaps } = await supabase
        .from('price_snapshots')
        .select('*')
        .in('raw_product_id', rawIds)
        .order('id', { ascending: false });

      const dealsMap = new Map();
      for (const raw of (rawProds || [])) {
        const prodSnaps = (snaps || []).filter(s => s.raw_product_id === raw.id);
        if (prodSnaps.length > 0) {
          const snap = prodSnaps[0];
          const price = parseFloat(snap.case_price || snap.wholesale_price || 0);

          if (price > 0) {
            const bc = raw.raw_barcode || raw.raw_title;
            if (!dealsMap.has(bc)) {
              dealsMap.set(bc, { barcode: raw.raw_barcode, title: raw.raw_title, prices: [] });
            }
            dealsMap.get(bc).prices.push({
              supplier: raw.suppliers?.name || 'Costco',
              casePrice: price,
              unitPrice: snap.unit_price ? parseFloat(snap.unit_price) : (price / 12).toFixed(2),
              inStock: snap.in_stock !== false
            });
          }
        }
      }

      const list = [];
      for (const [bc, item] of dealsMap.entries()) {
        const valid = item.prices.sort((a, b) => a.casePrice - b.casePrice);
        if (valid.length > 1) {
          const cheapest = valid[0];
          const next = valid[1];
          const saving = (next.casePrice - cheapest.casePrice).toFixed(2);
          if (parseFloat(saving) > 0) {
            list.push({
              barcode: bc,
              title: item.title,
              cheapestSupplier: cheapest.supplier,
              cheapestPrice: cheapest.casePrice,
              nextSupplier: next.supplier,
              nextPrice: next.casePrice,
              saving,
              suppliersCount: valid.length
            });
          }
        }
      }

      list.sort((a, b) => parseFloat(b.saving) - parseFloat(a.saving));
      setDeals(list);
    } catch (err) {
      console.error('Error fetching deals preview:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const columns = [
    { header: 'Barcode', accessor: 'barcode', isNumeric: true, render: (r) => <span className="font-mono text-xs text-textSecondary">{r.barcode || '—'}</span> },
    { header: 'Product Description', accessor: 'title', render: (r) => <span className="font-semibold text-textPrimary">{r.title}</span> },
    { 
      header: 'Best Supplier', 
      accessor: 'cheapestSupplier', 
      render: (r) => (
        <span className="font-sora font-bold text-accent">
          {r.cheapestSupplier} (£{r.cheapestPrice.toFixed(2)})
        </span>
      )
    },
    { 
      header: 'Next Best', 
      accessor: 'nextSupplier', 
      render: (r) => (
        <span className="font-mono text-xs text-textSecondary">
          {r.nextSupplier} (£{r.nextPrice.toFixed(2)})
        </span>
      )
    },
    { 
      header: 'Margin Opportunity', 
      accessor: 'saving', 
      isNumeric: true,
      align: 'right',
      render: (r) => (
        <span className="font-mono text-xs font-bold text-accentMint bg-savingBg px-2.5 py-1 rounded-lg border border-emerald-800">
          Save £{r.saving} / case
        </span>
      )
    }
  ];

  return (
    <div className="space-y-6 max-w-6xl font-inter">
      <div className="flex justify-between items-center bg-surface p-6 rounded-2xl border border-border">
        <div>
          <h1 className="font-sora font-bold text-xl text-textPrimary tracking-tight">Daily Deals Preview</h1>
          <p className="text-textSecondary text-sm mt-0.5">Admin preview of top calculated margin savings across wholesalers</p>
        </div>
        <button onClick={fetchDealsPreview} className="p-2 bg-[#0A0E0C] hover:bg-[#1A221D] border border-border text-textPrimary rounded-xl text-xs font-semibold flex items-center gap-2">
          <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
          <span>Refresh Deals</span>
        </button>
      </div>

      <div className="bg-surface border border-border rounded-2xl p-6 min-h-[400px]">
        <DataTable
          columns={columns}
          data={deals}
          isLoading={isLoading}
          emptyState={
            <EmptyState
              icon={BadgePercent}
              title="No deal comparisons calculated yet"
              description="Deals appear automatically when multiple wholesalers have matched active catalogue items with valid prices."
            />
          }
        />
      </div>
    </div>
  );
};

export default DailyDealsPreview;
