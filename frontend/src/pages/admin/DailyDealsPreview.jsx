import React, { useState, useEffect } from 'react';
import DataTable from '../../components/DataTable';
import StatusBadge, { EmptyState } from '../../components/UIComponents';
import { BadgePercent, Flame, TrendingDown, RefreshCw, Filter, Search } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { formatDateTime } from '../../utils/formatters';

const DailyDealsPreview = () => {
  const [deals, setDeals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState('');

  useEffect(() => {
    fetchDealsPreview();
  }, [searchQuery, selectedSupplierFilter]);

  const fetchDealsPreview = async () => {
    setIsLoading(true);
    try {
      // SAFETY INVARIANT 11: Only include VERIFIED_EXACT, VERIFIED_EQUIVALENT, or ADMIN_ACCEPTED products
      const { data: verifiedLogs } = await supabase
        .from('product_search_logs')
        .select('*, suppliers(id, name), raw_products(*)')
        .in('result_status', ['verified_exact', 'verified_equivalent', 'success'])
        .order('created_at', { ascending: false });

      const { data: adminAcceptedDecisions } = await supabase
        .from('admin_review_decisions')
        .select('*, suppliers(id, name), raw_products(*)')
        .eq('decision', 'ADMIN_ACCEPTED')
        .eq('is_current', true);

      const verifiedRawIds = new Set([
        ...(verifiedLogs || []).map(l => l.raw_product_id).filter(Boolean),
        ...(adminAcceptedDecisions || []).map(d => d.raw_product_id).filter(Boolean)
      ]);

      if (verifiedRawIds.size === 0) {
        setDeals([]);
        return;
      }

      const { data: snaps } = await supabase
        .from('price_snapshots')
        .select('*, suppliers(id, name), raw_products(*)')
        .in('raw_product_id', Array.from(verifiedRawIds))
        .order('snapshot_at', { ascending: false });

      const dealsMap = new Map();
      for (const snap of (snaps || [])) {
        if (!snap.case_price || snap.case_price <= 0) continue;

        const barcode = snap.raw_products?.raw_barcode || snap.raw_product_id;
        const title = snap.raw_products?.raw_title || 'Verified Product';

        if (!dealsMap.has(barcode)) {
          dealsMap.set(barcode, { barcode, title, prices: [] });
        }

        const priceList = dealsMap.get(barcode).prices;
        const existingSupplier = priceList.find(p => p.supplierId === snap.supplier_id);

        if (!existingSupplier) {
          priceList.push({
            supplierId: snap.supplier_id,
            supplierName: snap.suppliers?.name?.toUpperCase() || 'WHOLESALER',
            casePrice: parseFloat(snap.case_price),
            unitCost: parseFloat(snap.unit_cost || snap.case_price / 12),
            snapshotAt: snap.snapshot_at
          });
        }
      }

      const list = [];
      for (const [bc, item] of dealsMap.entries()) {
        const sorted = item.prices.sort((a, b) => a.casePrice - b.casePrice);
        if (sorted.length > 1) {
          const cheapest = sorted[0];
          const next = sorted[1];
          const saving = parseFloat((next.casePrice - cheapest.casePrice).toFixed(2));

          if (saving > 0) {
            let passSearch = true;
            if (searchQuery) {
              passSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || String(bc).includes(searchQuery);
            }

            let passSupplier = true;
            if (selectedSupplierFilter) {
              passSupplier = cheapest.supplierName.toLowerCase() === selectedSupplierFilter.toLowerCase();
            }

            if (passSearch && passSupplier) {
              list.push({
                barcode: bc,
                title: item.title,
                cheapestSupplier: cheapest.supplierName,
                cheapestPrice: cheapest.casePrice,
                nextSupplier: next.supplierName,
                nextPrice: next.casePrice,
                saving,
                lastUpdated: cheapest.snapshotAt
              });
            }
          }
        }
      }

      list.sort((a, b) => b.saving - a.saving);
      setDeals(list);
    } catch (err) {
      console.error('Error fetching verified daily deals:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const columns = [
    { header: 'Barcode', accessor: 'barcode', isNumeric: true, render: (r) => <span className="font-mono text-xs text-textPrimary">{r.barcode || '—'}</span> },
    { header: 'Verified Product Description', accessor: 'title', render: (r) => <span className="font-semibold text-xs text-textPrimary">{r.title}</span> },
    {
      header: 'Best Supplier Price',
      accessor: 'cheapestSupplier',
      render: (r) => (
        <span className="font-sora font-bold text-xs text-accentMint">
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
      header: 'Wholesale Saving',
      accessor: 'saving',
      isNumeric: true,
      align: 'right',
      render: (r) => (
        <div className="flex items-center justify-end gap-1 font-bold text-xs text-accentMint">
          <TrendingDown size={14} />
          <span>£{r.saving.toFixed(2)}</span>
        </div>
      )
    },
    { header: 'Last Price Verified', accessor: 'lastUpdated', isNumeric: true, render: (r) => <span className="text-xs text-textSecondary">{formatDateTime(r.lastUpdated)}</span> }
  ];

  return (
    <div className="space-y-6 max-w-6xl font-inter">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-surface p-6 rounded-2xl border border-border gap-4">
        <div>
          <h2 className="text-xl font-sora font-bold text-textPrimary tracking-tight">Verified Daily Deals Preview</h2>
          <p className="text-sm text-textSecondary mt-0.5">Preview verified wholesale price arbitrage opportunities for retailers based strictly on VERIFIED_EXACT, VERIFIED_EQUIVALENT, and ADMIN_ACCEPTED snapshot data</p>
        </div>
        <button onClick={fetchDealsPreview} className="p-2 bg-[#0A0E0C] hover:bg-[#1A221D] border border-border text-textPrimary rounded-xl text-xs font-semibold flex items-center gap-2">
          <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
          <span>Refresh Deals</span>
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
            placeholder="Search deals by product / EAN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-3 py-1.5 bg-[#0A0E0C] border border-border rounded-xl text-xs text-textPrimary focus:outline-none focus:border-accent w-56"
          />
        </div>

        <select
          value={selectedSupplierFilter}
          onChange={(e) => setSelectedSupplierFilter(e.target.value)}
          className="bg-[#0A0E0C] border border-border text-textPrimary rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-none focus:border-accent"
        >
          <option value="">All Best Suppliers</option>
          <option value="BESTWAY">BESTWAY</option>
          <option value="COSTCO">COSTCO</option>
          <option value="PARFETTS">PARFETTS</option>
          <option value="BOOKER">BOOKER</option>
        </select>
      </div>

      {/* Deals Table */}
      <div className="bg-surface border border-border rounded-2xl p-6 min-h-[400px]">
        <DataTable
          columns={columns}
          data={deals}
          isLoading={isLoading}
          emptyState={<EmptyState icon={BadgePercent} title="No Daily Deals Available" description="No verified wholesale price differences found matching active filters." />}
        />
      </div>
    </div>
  );
};

export default DailyDealsPreview;
