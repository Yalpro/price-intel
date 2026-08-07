import React, { useState, useEffect } from 'react';
import { 
  Flame, Search, TrendingDown, ArrowUpDown, Filter, Building2, CheckCircle2, RefreshCw, ExternalLink, ShieldCheck, Tag, Eye, ChevronRight
} from 'lucide-react';
import { supabase } from '../../supabaseClient';

export const DailyDeals = () => {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showComparisonModal, setShowComparisonModal] = useState(false);

  useEffect(() => {
    fetchDailyDeals();
  }, []);

  const fetchDailyDeals = async () => {
    setLoading(true);
    try {
      // Fetch current price snapshots joined with raw_products and active catalogue
      const { data: rawProds, error: rawErr } = await supabase
        .from('raw_products')
        .select(`
          id,
          supplier_id,
          raw_title,
          raw_barcode,
          raw_product_code,
          raw_url,
          scraped_at,
          suppliers ( id, name )
        `)
        .order('scraped_at', { ascending: false });

      if (rawErr) throw rawErr;

      const rawIds = (rawProds || []).map(r => r.id);

      const { data: snaps, error: snapErr } = await supabase
        .from('price_snapshots')
        .select('*')
        .in('raw_product_id', rawIds)
        .order('id', { ascending: false });

      if (snapErr) throw snapErr;

      // Group prices by barcode to identify best deal opportunities
      const dealsMap = new Map();

      for (const raw of (rawProds || [])) {
        const prodSnaps = (snaps || []).filter(s => s.raw_product_id === raw.id);
        if (prodSnaps.length > 0) {
          const snap = prodSnaps[0];
          const price = parseFloat(snap.case_price || snap.wholesale_price || 0);

          if (price > 0) {
            const bc = raw.raw_barcode || raw.raw_title;
            if (!dealsMap.has(bc)) {
              dealsMap.set(bc, {
                barcode: raw.raw_barcode,
                title: raw.raw_title,
                prices: []
              });
            }
            dealsMap.get(bc).prices.push({
              supplier: raw.suppliers?.name || 'Costco',
              supplierId: raw.supplier_id,
              casePrice: price,
              unitPrice: snap.unit_price ? parseFloat(snap.unit_price) : (price / 12).toFixed(2),
              supplierCode: raw.raw_product_code,
              supplierUrl: raw.raw_url,
              inStock: snap.in_stock !== false,
              scrapedAt: snap.scraped_at || raw.scraped_at
            });
          }
        }
      }

      // Compute best deal metrics per product
      const processedDeals = [];

      for (const [bc, item] of dealsMap.entries()) {
        const validPrices = item.prices.filter(p => p.casePrice > 0);
        if (validPrices.length === 0) continue;

        validPrices.sort((a, b) => a.casePrice - b.casePrice);
        const cheapest = validPrices[0];
        const secondCheapest = validPrices.length > 1 ? validPrices[1] : null;

        const absoluteSaving = secondCheapest ? (secondCheapest.casePrice - cheapest.casePrice).toFixed(2) : '0.00';
        const percentageSaving = secondCheapest ? ((absoluteSaving / secondCheapest.casePrice) * 100).toFixed(0) : '0';

        processedDeals.push({
          barcode: bc,
          title: item.title,
          cheapestSupplier: cheapest.supplier,
          cheapestPrice: cheapest.casePrice,
          cheapestUnitPrice: cheapest.unitPrice,
          cheapestUrl: cheapest.supplierUrl,
          cheapestCode: cheapest.supplierCode,
          secondPrice: secondCheapest?.casePrice || null,
          secondSupplier: secondCheapest?.supplier || null,
          absoluteSaving,
          percentageSaving,
          allPrices: validPrices,
          inStock: cheapest.inStock,
          lastChecked: cheapest.scrapedAt
        });
      }

      // Sort deals by absolute saving descending
      processedDeals.sort((a, b) => parseFloat(b.absoluteSaving) - parseFloat(a.absoluteSaving));
      setDeals(processedDeals);

    } catch (err) {
      console.error('Error fetching daily deals:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredDeals = deals.filter(deal => {
    if (inStockOnly && !deal.inStock) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return deal.title.toLowerCase().includes(q) || deal.barcode?.includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-inter">
      {/* Page Title & Refresh Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface p-6 rounded-2xl border border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accentSoft flex items-center justify-center text-accent">
              <Flame size={20} />
            </div>
            <h1 className="text-2xl font-sora font-bold text-textPrimary">Daily Wholesale Deals</h1>
          </div>
          <p className="text-sm text-textSecondary">
            Ranked margin opportunities across Booker, Parfetts, Bestway, and Costco
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block font-mono text-xs text-textSecondary">
            <p>Database Refresh</p>
            <p className="text-accentMint font-semibold">Today 06:00 UTC</p>
          </div>
          <button 
            onClick={fetchDailyDeals} 
            className="p-2.5 bg-[#1E2621] hover:bg-accent/20 border border-border text-textPrimary rounded-xl transition-colors flex items-center gap-2 text-xs font-semibold"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter Controls & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-textSecondary" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter deals by product name or barcode..."
            className="w-full pl-10 pr-4 py-2 bg-surface border border-border rounded-xl text-sm text-textPrimary placeholder:text-textSecondary focus:outline-none focus:border-accent"
          />
        </div>

        {/* Stock Toggle */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <label className="flex items-center gap-2 text-xs font-medium text-textSecondary cursor-pointer bg-surface border border-border px-3 py-2 rounded-xl">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(e) => setInStockOnly(e.target.checked)}
              className="accent-accent rounded"
            />
            <span>In-Stock Only</span>
          </label>
        </div>
      </div>

      {/* Deals Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="bg-surface border border-border rounded-2xl p-6 space-y-4 animate-pulse">
              <div className="h-4 bg-[#1E2621] rounded w-3/4" />
              <div className="h-8 bg-[#1E2621] rounded w-1/2" />
              <div className="h-12 bg-[#1E2621] rounded" />
            </div>
          ))}
        </div>
      ) : filteredDeals.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-12 text-center space-y-3">
          <Flame size={32} className="mx-auto text-textSecondary opacity-50" />
          <h3 className="text-lg font-semibold text-textPrimary">No deal opportunities match your filter</h3>
          <p className="text-sm text-textSecondary max-w-sm mx-auto">Try clearing search filter or toggling in-stock status.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDeals.map((deal) => (
            <div 
              key={deal.barcode}
              className={`bg-surface border border-border rounded-2xl p-5 space-y-4 flex flex-col justify-between hover:border-accent/50 transition-all ${
                parseFloat(deal.absoluteSaving) > 0 ? 'ring-1 ring-emerald-900/40' : ''
              }`}
            >
              {/* Card Top: Title & Barcode */}
              <div>
                <div className="flex justify-between items-start gap-2 mb-2">
                  <h3 className="font-sora font-semibold text-textPrimary text-base line-clamp-2 leading-snug">
                    {deal.title}
                  </h3>
                  {deal.barcode && (
                    <span className="font-mono text-[11px] bg-[#1A221D] text-textSecondary px-2 py-0.5 rounded shrink-0">
                      {deal.barcode}
                    </span>
                  )}
                </div>

                {/* Savings Pill */}
                {parseFloat(deal.absoluteSaving) > 0 ? (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-savingBg border border-emerald-800 text-xs font-mono font-bold text-accentMint">
                    <TrendingDown size={14} />
                    <span>Save £{deal.absoluteSaving} per case ({deal.percentageSaving}% off)</span>
                  </div>
                ) : (
                  <span className="text-xs text-textSecondary font-mono">Single Supplier Price Snapshot</span>
                )}
              </div>

              {/* Best Price Box */}
              <div className="bg-[#0A0E0C] border border-border p-4 rounded-xl space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[11px] font-mono text-textSecondary uppercase tracking-wider">Cheapest Supplier</span>
                    <p className="font-sora font-bold text-lg text-accent">
                      {deal.cheapestSupplier}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-xl font-bold text-accentMint">
                      £{deal.cheapestPrice.toFixed(2)}
                    </p>
                    <p className="text-[11px] font-mono text-textSecondary">
                      £{deal.cheapestUnitPrice}/unit
                    </p>
                  </div>
                </div>

                {deal.secondSupplier && (
                  <div className="pt-2 border-t border border-border/40 flex justify-between items-center text-xs font-mono text-textSecondary">
                    <span>Next: {deal.secondSupplier}</span>
                    <span className="line-through">£{deal.secondPrice.toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* Card Footer Actions */}
              <div className="pt-2 flex items-center justify-between gap-2">
                <span className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded ${
                  deal.inStock ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-red-950 text-red-400 border border-red-900'
                }`}>
                  {deal.inStock ? '✓ IN STOCK' : 'OUT OF STOCK'}
                </span>

                <button
                  onClick={() => {
                    setSelectedProduct(deal);
                    setShowComparisonModal(true);
                  }}
                  className="px-3.5 py-2 bg-accent hover:bg-accentHover text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Eye size={14} />
                  <span>Compare ({deal.allPrices.length})</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FULL SUPPLIER COMPARISON MODAL */}
      {showComparisonModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-surface border border-border rounded-2xl p-6 max-w-xl w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-border pb-4">
              <div>
                <span className="text-xs font-mono text-accentMint uppercase tracking-wider">Product Price Breakdown</span>
                <h3 className="text-xl font-sora font-bold text-textPrimary mt-1">
                  {selectedProduct.title}
                </h3>
                {selectedProduct.barcode && (
                  <span className="font-mono text-xs text-textSecondary mt-1 inline-block">
                    Barcode: {selectedProduct.barcode}
                  </span>
                )}
              </div>
              <button 
                onClick={() => setShowComparisonModal(false)}
                className="text-textSecondary hover:text-textPrimary p-1 text-xl"
              >
                ✕
              </button>
            </div>

            {/* Supplier Price Table Sorted Lowest -> Highest */}
            <div className="space-y-3">
              <p className="text-xs font-mono font-semibold text-textSecondary uppercase">Suppliers Sorted Lowest to Highest</p>

              {selectedProduct.allPrices.map((p, idx) => (
                <div 
                  key={idx}
                  className={`p-4 rounded-xl border flex items-center justify-between ${
                    idx === 0 
                      ? 'bg-savingBg/50 border-accent ring-1 ring-accent/40' 
                      : 'bg-[#0A0E0C] border-border'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-sora font-bold text-base text-textPrimary">{p.supplier}</span>
                      {idx === 0 && (
                        <span className="text-[10px] font-mono font-bold bg-accent text-white px-2 py-0.5 rounded-full">
                          CHEAPEST
                        </span>
                      )}
                    </div>
                    {p.supplierCode && (
                      <p className="text-xs font-mono text-textSecondary">SKU: {p.supplierCode}</p>
                    )}
                  </div>

                  <div className="text-right space-y-1">
                    <p className={`font-mono text-lg font-bold ${idx === 0 ? 'text-accentMint' : 'text-textPrimary'}`}>
                      £{p.casePrice.toFixed(2)}
                    </p>
                    {p.supplierUrl && (
                      <a 
                        href={p.supplierUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-xs text-accent hover:underline inline-flex items-center gap-1 font-medium"
                      >
                        <span>View on Portal</span>
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button 
                onClick={() => setShowComparisonModal(false)}
                className="px-5 py-2 bg-[#1E2621] hover:bg-[#2A352E] text-textPrimary text-sm font-semibold rounded-xl"
              >
                Close Comparison
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyDeals;
