import React, { useState, useEffect } from 'react';
import { 
  Flame, Search, TrendingDown, RefreshCw, ExternalLink, CheckCircle2, Eye, AlertCircle
} from 'lucide-react';
import { supabase } from '../../supabaseClient';

export const DailyDeals = () => {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeVersionName, setActiveVersionName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showComparisonModal, setShowComparisonModal] = useState(false);

  useEffect(() => {
    fetchDailyDeals();
  }, []);

  const fetchDailyDeals = async () => {
    setLoading(true);
    try {
      // 1. Try backend API first
      const res = await fetch('/api/retailer/deals');
      if (res.ok) {
        const apiData = await res.json();
        if (apiData.success) {
          setActiveVersionName(apiData.activeVersionName || '');
          setDeals(apiData.deals || []);
          setLoading(false);
          return;
        }
      }

      // 2. Direct Supabase fallback
      const { data: activeVer } = await supabase
        .from('catalogue_versions')
        .select('id, version_name')
        .eq('is_active', true)
        .single();

      if (!activeVer) {
        setDeals([]);
        return;
      }
      setActiveVersionName(activeVer.version_name);

      const { data: catItems } = await supabase
        .from('catalogue_items')
        .select('id, barcode, name, source_price_mark')
        .eq('version_id', activeVer.id);

      const barcodes = (catItems || []).map(c => c.barcode).filter(Boolean);

      const { data: rawProds } = await supabase
        .from('raw_products')
        .select('id, supplier_id, raw_title, raw_barcode, raw_product_code, raw_url, raw_pack_info, suppliers(id, name)')
        .in('raw_barcode', barcodes);

      const rawIds = (rawProds || []).map(r => r.id);

      const { data: snapshots } = await supabase
        .from('price_snapshots')
        .select('id, raw_product_id, case_price, unit_cost, in_stock, snapshot_at')
        .in('raw_product_id', rawIds)
        .order('snapshot_at', { ascending: false });

      const dealsList = [];

      for (const catItem of (catItems || [])) {
        const matchedRaws = (rawProds || []).filter(r => r.raw_barcode === catItem.barcode);
        const supplierPrices = [];

        for (const raw of matchedRaws) {
          const snap = (snapshots || []).find(s => s.raw_product_id === raw.id);
          if (snap && snap.case_price > 0) {
            const casePrice = parseFloat(snap.case_price);
            const unitPrice = snap.unit_cost 
              ? parseFloat(snap.unit_cost) 
              : (casePrice / 12);

            supplierPrices.push({
              supplier: raw.suppliers?.name || 'Wholesaler',
              supplierId: raw.supplier_id,
              casePrice,
              unitPrice: unitPrice.toFixed(2),
              supplierCode: raw.raw_product_code,
              supplierUrl: raw.raw_url,
              inStock: snap.in_stock !== false,
              scrapedAt: snap.snapshot_at,
              packInfo: raw.raw_pack_info
            });
          }
        }

        if (supplierPrices.length > 0) {
          supplierPrices.sort((a, b) => a.casePrice - b.casePrice);
          const cheapest = supplierPrices[0];
          const secondCheapest = supplierPrices.length > 1 ? supplierPrices[1] : null;

          const absoluteSaving = secondCheapest 
            ? (secondCheapest.casePrice - cheapest.casePrice) 
            : 0;

          const percentageSaving = secondCheapest 
            ? ((absoluteSaving / secondCheapest.casePrice) * 100) 
            : 0;

          dealsList.push({
            id: catItem.id,
            barcode: catItem.barcode,
            name: catItem.name,
            priceMark: catItem.source_price_mark,
            cheapestSupplier: cheapest.supplier,
            cheapestPrice: cheapest.casePrice,
            cheapestUnitPrice: cheapest.unitPrice,
            secondCheapestSupplier: secondCheapest?.supplier || null,
            secondCheapestPrice: secondCheapest?.casePrice || null,
            absoluteSaving: absoluteSaving.toFixed(2),
            percentageSaving: percentageSaving.toFixed(0),
            supplierCount: supplierPrices.length,
            allPrices: supplierPrices,
            scrapedAt: cheapest.scrapedAt,
            inStock: cheapest.inStock
          });
        }
      }

      dealsList.sort((a, b) => {
        const saveDiff = parseFloat(b.absoluteSaving) - parseFloat(a.absoluteSaving);
        if (saveDiff !== 0) return saveDiff;
        return b.supplierCount - a.supplierCount;
      });

      setDeals(dealsList);

    } catch (err) {
      console.error('Failed to fetch daily deals:', err);
      setDeals([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredDeals = deals.filter(d => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return d.name.toLowerCase().includes(term) || (d.barcode && d.barcode.includes(term));
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto font-inter">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface p-6 rounded-2xl border border-border">
        <div>
          <div className="flex items-center gap-2">
            <Flame className="text-accent" size={24} />
            <h1 className="font-sora font-bold text-2xl text-textPrimary tracking-tight">Wholesale Daily Deals</h1>
          </div>
          <p className="text-xs text-textSecondary mt-1">
            Real wholesale price arbitrage opportunities ranked by highest savings across UK cash & carry suppliers
          </p>
        </div>

        <button
          onClick={fetchDailyDeals}
          className="p-2.5 bg-[#0A0E0C] hover:bg-[#1A221D] border border-border text-textPrimary rounded-xl transition-colors flex items-center gap-2 text-xs font-semibold shrink-0 cursor-pointer"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Opportunities</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-surface border border-border p-4 rounded-xl flex items-center gap-3">
        <Search size={16} className="text-textSecondary ml-2" />
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Filter daily deals by product name or barcode..."
          className="w-full bg-transparent text-sm text-textPrimary placeholder:text-textSecondary focus:outline-none font-inter"
        />
      </div>

      {/* Deals Grid */}
      {loading ? (
        <div className="bg-surface border border-border rounded-2xl p-12 text-center text-textSecondary text-sm font-mono flex items-center justify-center gap-2">
          <RefreshCw size={16} className="animate-spin text-accent" />
          <span>Analyzing active catalogue wholesale price snapshots...</span>
        </div>
      ) : filteredDeals.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-12 text-center space-y-3">
          <AlertCircle size={32} className="mx-auto text-textSecondary opacity-50" />
          <h3 className="text-base font-semibold text-textPrimary">No daily deals matched your filter</h3>
          <p className="text-xs text-textSecondary">Try clearing your filter keyword to view all active wholesale price comparisons.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredDeals.map((deal) => (
            <div 
              key={deal.id}
              className="bg-surface border border-border rounded-2xl p-5 space-y-4 hover:border-accent/40 transition-all flex flex-col justify-between shadow-sm"
            >
              <div className="space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <h3 className="font-sora font-bold text-base text-textPrimary tracking-tight line-clamp-2">{deal.name}</h3>
                    {deal.barcode && <span className="font-mono text-xs text-textSecondary">EAN: {deal.barcode}</span>}
                  </div>

                  {parseFloat(deal.absoluteSaving) > 0 && (
                    <span className="bg-savingBg text-accentMint border border-emerald-800 px-2.5 py-1 rounded-full text-xs font-mono font-bold shrink-0 flex items-center gap-1">
                      <TrendingDown size={12} /> Save £{deal.absoluteSaving}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap text-xs font-mono">
                  <span className="bg-[#0A0E0C] text-textPrimary px-2 py-0.5 rounded border border-border">
                    Cheapest: <strong className="text-accent uppercase">{deal.cheapestSupplier}</strong>
                  </span>
                  <span className="text-textSecondary">
                    {deal.supplierCount} Wholesaler{deal.supplierCount > 1 ? 's' : ''} Tracked
                  </span>
                </div>
              </div>

              {/* Price Row */}
              <div className="pt-3 border-t border-border flex justify-between items-center bg-[#0A0E0C] p-3 rounded-xl">
                <div>
                  <span className="text-[10px] font-mono text-textSecondary block uppercase">Best Wholesale Price</span>
                  <p className="text-lg font-mono font-bold text-accentMint">£{deal.cheapestPrice.toFixed(2)} <span className="text-xs text-textSecondary font-normal">/case</span></p>
                </div>

                <button
                  onClick={() => {
                    setSelectedProduct(deal);
                    setShowComparisonModal(true);
                  }}
                  className="px-3.5 py-2 bg-accent hover:bg-accentHover text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Eye size={14} />
                  <span>Compare ({deal.supplierCount})</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Comparison Modal */}
      {showComparisonModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-surface border border-border rounded-2xl p-6 max-w-xl w-full shadow-2xl space-y-5">
            <div className="flex justify-between items-start border-b border-border pb-4">
              <div>
                <span className="text-xs font-mono text-accentMint uppercase tracking-wider font-semibold">Wholesale Price Comparison</span>
                <h3 className="text-lg font-sora font-bold text-textPrimary mt-0.5">{selectedProduct.name}</h3>
                {selectedProduct.barcode && <span className="font-mono text-xs text-textSecondary">EAN: {selectedProduct.barcode}</span>}
              </div>
              <button onClick={() => setShowComparisonModal(false)} className="text-textSecondary hover:text-textPrimary text-lg">✕</button>
            </div>

            <div className="space-y-3 font-inter">
              {selectedProduct.allPrices.map((p, idx) => (
                <div 
                  key={idx} 
                  className={`p-4 rounded-xl border flex items-center justify-between ${
                    idx === 0 
                      ? 'bg-savingBg/60 border-emerald-800 ring-1 ring-emerald-500/40' 
                      : 'bg-[#0A0E0C] border-border'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-sora font-bold text-base text-textPrimary uppercase">{p.supplier}</span>
                      {idx === 0 && (
                        <span className="text-[10px] font-mono font-bold bg-accent text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 size={10} /> CHEAPEST
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs font-mono text-textSecondary">
                      <span>Status: {p.inStock ? <span className="text-accentMint">In Stock</span> : <span className="text-amber-400">Out of Stock</span>}</span>
                      {p.scrapedAt && <span>Scraped: {new Date(p.scrapedAt).toLocaleDateString()}</span>}
                    </div>
                  </div>

                  <div className="text-right font-mono">
                    <p className={`text-xl font-bold ${idx === 0 ? 'text-accentMint' : 'text-textPrimary'}`}>
                      £{p.casePrice.toFixed(2)}
                    </p>
                    <p className="text-[11px] text-textSecondary">£{p.unitPrice}/unit</p>

                    {p.supplierUrl && (
                      <a 
                        href={p.supplierUrl} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-xs text-accent hover:underline flex items-center gap-1 justify-end mt-1 font-sans font-medium"
                      >
                        <span>View Portal</span> <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button 
                onClick={() => setShowComparisonModal(false)} 
                className="px-5 py-2.5 bg-[#1A221D] text-textPrimary text-xs font-semibold rounded-xl hover:bg-[#25322b] transition-colors"
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
